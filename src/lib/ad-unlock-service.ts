import 'server-only';

import crypto from 'crypto';
import { prisma } from './prisma';
import {
  AD_UNLOCK_MESSAGES,
  AD_UNLOCK_PENDING_TTL_MS,
  AD_UNLOCK_WATCH_SECONDS,
  evaluateWatchCompletion,
} from './ad-unlock-core';

// Desbloqueio por anúncio — estado no SERVIDOR, por empresa (tenant).
//
// Estados: PENDING (visualização iniciada) → GRANTED (disponível) → CONSUMED
// (gasto por exactamente uma factura). O acesso é por SQL parametrizado
// (prisma.$queryRaw/$executeRaw) porque as emissões precisam de executar o
// "claim" DENTRO da transacção de emissão (mesma ligação, mesmo lock).
//
// Protecções implementadas:
// - Índice único parcial: só pode existir UM PENDING por empresa;
// - begin reutiliza o PENDING existente (retoma a contagem iniciada no servidor);
// - complete valida o tempo mínimo com o relógio do servidor e janela máxima;
// - claim é um UPDATE condicional atómico (FOR UPDATE SKIP LOCKED) dentro da
//   transacção de emissão — impossível consumir o mesmo desbloqueio duas vezes,
//   mesmo com emissões concorrentes ou várias sessões;
// - o limite e os desbloqueios são por EMPRESA, nunca por navegador.

export class AdUnlockError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = 'AdUnlockError';
  }
}

// Executor SQL: a instância principal ou a transacção de emissão (tx).
// O prisma deste projecto é tipado como `any`; mantemos a interface mínima usada aqui.
export type SqlExecutor = {
  $queryRaw: <T = unknown[]>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
};

type UnlockRow = {
  id: string;
  tenant_id: string;
  status: string;
  started_at: Date;
  granted_at: Date | null;
  consumed_at: Date | null;
  consumed_by_invoice_id: string | null;
};

const db = (): SqlExecutor => prisma as SqlExecutor;

export type AdWatchSession =
  | { status: 'READY' } // já existe um desbloqueio disponível — pode emitir
  | { status: 'PENDING'; startedAt: string; seconds: number };

// Inicia (ou retoma) a visualização. Chamado quando o cliente abre a janela
// de desbloqueio. O timestamp autoritativo é o do servidor.
export async function beginAdWatch(tenantId: string, executor: SqlExecutor = db()): Promise<AdWatchSession> {
  // 1) Limpa pendências expiradas (abandonadas além da janela).
  const staleCutoff = new Date(Date.now() - AD_UNLOCK_PENDING_TTL_MS);
  await executor.$executeRaw`DELETE FROM "AdUnlock" WHERE tenant_id = ${tenantId} AND status = 'PENDING' AND started_at < ${staleCutoff}`;

  // 2) Já há desbloqueio pronto? Nada a visualizar — pode emitir.
  const granted = await executor.$queryRaw`SELECT id FROM "AdUnlock" WHERE tenant_id = ${tenantId} AND status = 'GRANTED' AND consumed_at IS NULL LIMIT 1`;
  if (granted.length > 0) return { status: 'READY' };

  // 3) Retoma uma visualização ainda válida (contagem iniciada no servidor).
  const pending = await executor.$queryRaw<UnlockRow[]>`SELECT id, started_at FROM "AdUnlock" WHERE tenant_id = ${tenantId} AND status = 'PENDING' LIMIT 1`;
  if (pending.length > 0) {
    return { status: 'PENDING', startedAt: pending[0].started_at.toISOString(), seconds: AD_UNLOCK_WATCH_SECONDS };
  }

  // 4) Cria a sessão. Concorrência: o índice único parcial (1 PENDING por
  //    empresa) faz a segunda inserção falhar — reutilizamos a existente.
  const startedAt = new Date();
  try {
    await executor.$executeRaw`INSERT INTO "AdUnlock" ("id", "tenant_id", "status", "started_at", "created_at") VALUES (${crypto.randomUUID()}, ${tenantId}, 'PENDING', ${startedAt}, ${startedAt})`;
  } catch {
    const raced = await executor.$queryRaw<UnlockRow[]>`SELECT id, started_at FROM "AdUnlock" WHERE tenant_id = ${tenantId} AND status = 'PENDING' LIMIT 1`;
    if (raced.length === 0) throw new AdUnlockError(AD_UNLOCK_MESSAGES.raced, 409);
    return { status: 'PENDING', startedAt: raced[0].started_at.toISOString(), seconds: AD_UNLOCK_WATCH_SECONDS };
  }
  return { status: 'PENDING', startedAt: startedAt.toISOString(), seconds: AD_UNLOCK_WATCH_SECONDS };
}

// Conclui a visualização. O servidor recusa pedidos antes do tempo mínimo e
// depois da janela — o cliente não controla a validação.
export async function completeAdWatch(tenantId: string, executor: SqlExecutor = db(), now: Date = new Date()): Promise<{ status: 'GRANTED' }> {
  const pending = await executor.$queryRaw<UnlockRow[]>`SELECT id, started_at FROM "AdUnlock" WHERE tenant_id = ${tenantId} AND status = 'PENDING' LIMIT 1`;

  if (pending.length === 0) {
    const granted = await executor.$queryRaw`SELECT id FROM "AdUnlock" WHERE tenant_id = ${tenantId} AND status = 'GRANTED' AND consumed_at IS NULL LIMIT 1`;
    if (granted.length > 0) return { status: 'GRANTED' }; // idempotente
    throw new AdUnlockError(AD_UNLOCK_MESSAGES.notWatching, 409);
  }

  const verdict = evaluateWatchCompletion({ startedAt: pending[0].started_at, now });
  if (!verdict.ok && verdict.reason === 'EXPIRED') {
    await executor.$executeRaw`DELETE FROM "AdUnlock" WHERE id = ${pending[0].id} AND status = 'PENDING'`;
    throw new AdUnlockError(AD_UNLOCK_MESSAGES.expired, 410);
  }
  if (!verdict.ok) throw new AdUnlockError(AD_UNLOCK_MESSAGES.tooSoon(verdict.waitSeconds), 425);

  const updated = await executor.$executeRaw`UPDATE "AdUnlock" SET status = 'GRANTED', granted_at = ${now} WHERE id = ${pending[0].id} AND status = 'PENDING'`;
  if (updated !== 1) throw new AdUnlockError(AD_UNLOCK_MESSAGES.raced, 409);
  return { status: 'GRANTED' };
}

// Reserva (claim) atómico de UM desbloqueio para uma emissão. Corre DENTRO da
// transacção da emissão: se a emissão falhar, o claim reverte com a transacção.
// Devolve null quando não há desbloqueio disponível (a emissão deve falhar
// com AdUnlockRequiredError).
export async function claimUnlockForEmission(tenantId: string, executor: SqlExecutor): Promise<string | null> {
  const rows = await executor.$queryRaw<{ id: string }[]>`
    UPDATE "AdUnlock" SET status = 'CONSUMED', consumed_at = CURRENT_TIMESTAMP
    WHERE id = (
      SELECT id FROM "AdUnlock"
      WHERE tenant_id = ${tenantId} AND status = 'GRANTED' AND consumed_at IS NULL
      ORDER BY granted_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    ) AND status = 'GRANTED' AND consumed_at IS NULL
    RETURNING id`;
  return rows[0]?.id ?? null;
}

// Após a emissão confirmada, liga o desbloqueio à factura criada (auditoria).
// Best-effort: falhas aqui não afectam a factura (o desbloqueio já está
// CONSUMED — não é reutilizável de qualquer forma).
export async function linkUnlockToInvoice(tenantId: string, unlockId: string, invoiceId: string, executor: SqlExecutor = db()): Promise<void> {
  await executor.$executeRaw`UPDATE "AdUnlock" SET consumed_by_invoice_id = ${invoiceId} WHERE id = ${unlockId} AND tenant_id = ${tenantId} AND status = 'CONSUMED' AND consumed_by_invoice_id IS NULL`;
}

// Existe um desbloqueio disponível (não consumido)?
export async function hasAvailableUnlock(tenantId: string, executor: SqlExecutor = db()): Promise<boolean> {
  const rows = await executor.$queryRaw`SELECT 1 FROM "AdUnlock" WHERE tenant_id = ${tenantId} AND status = 'GRANTED' AND consumed_at IS NULL LIMIT 1`;
  return rows.length > 0;
}
