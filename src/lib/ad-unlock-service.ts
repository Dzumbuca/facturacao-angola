import 'server-only';

import crypto from 'crypto';
import { prisma } from './prisma';
import {
  AD_UNLOCK_MESSAGES,
  AD_UNLOCK_PENDING_TTL_MS,
  AD_UNLOCK_WATCH_SECONDS,
  evaluateWatchCompletion,
} from './ad-unlock-core';

// Desbloqueio por anuncio - estado no SERVIDOR, por empresa (tenant).
//
// Estados: PENDING (visualizacao iniciada) -> GRANTED (disponivel) -> CONSUMED
// (gasto por exactamente uma factura). O acesso e por SQL parametrizado
// (prisma.$queryRaw/$executeRaw) porque as emissoes precisam de executar o
// "claim" DENTRO da transaccao de emissao (mesma ligacao, mesmo lock).
//
// RLS/sem-BYPASSRLS (preparacao): quando a operacao usa o cliente global
// (ex.: rotas /ads/unlock), definimos app.tenant_id localmente na transacao.
// Quando recebe um executor tx ja dentro de runWithTenant (ex.: emissao),
// nao abrimos transacao extra nem sobrescrevemos o contexto.

export class AdUnlockError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = 'AdUnlockError';
  }
}

export type SqlExecutor = {
  $queryRaw: <T = unknown[]>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
  $transaction?: <T>(fn: (tx: SqlExecutor) => Promise<T>) => Promise<T>;
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

const db = (): SqlExecutor => prisma as unknown as SqlExecutor;

async function withTenantContext<T>(tenantId: string, executor: SqlExecutor, fn: (ex: SqlExecutor) => Promise<T>): Promise<T> {
  if (!executor.$transaction) return fn(executor);
  return executor.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.user_id', '', true)`;
    await tx.$executeRaw`SELECT set_config('app.is_admin', 'false', true)`;
    return fn(tx);
  });
}

export type AdWatchSession =
  | { status: 'READY' }
  | { status: 'PENDING'; startedAt: string; seconds: number };

export async function beginAdWatch(tenantId: string, executor: SqlExecutor = db()): Promise<AdWatchSession> {
  return withTenantContext(tenantId, executor, async (ex) => {
    const staleCutoff = new Date(Date.now() - AD_UNLOCK_PENDING_TTL_MS);
    await ex.$executeRaw`DELETE FROM "AdUnlock" WHERE tenant_id = ${tenantId} AND status = 'PENDING' AND started_at < ${staleCutoff}`;

    const granted = await ex.$queryRaw<{ id: string }[]>`SELECT id FROM "AdUnlock" WHERE tenant_id = ${tenantId} AND status = 'GRANTED' AND consumed_at IS NULL LIMIT 1`;
    if (granted.length > 0) return { status: 'READY' };

    const pending = await ex.$queryRaw<UnlockRow[]>`SELECT id, tenant_id, status, started_at, granted_at, consumed_at, consumed_by_invoice_id FROM "AdUnlock" WHERE tenant_id = ${tenantId} AND status = 'PENDING' LIMIT 1`;
    if (pending.length > 0) {
      return { status: 'PENDING', startedAt: pending[0].started_at.toISOString(), seconds: AD_UNLOCK_WATCH_SECONDS };
    }

    const startedAt = new Date();
    try {
      await ex.$executeRaw`INSERT INTO "AdUnlock" ("id", "tenant_id", "status", "started_at", "created_at") VALUES (${crypto.randomUUID()}, ${tenantId}, 'PENDING', ${startedAt}, ${startedAt})`;
    } catch {
      const raced = await ex.$queryRaw<UnlockRow[]>`SELECT id, tenant_id, status, started_at, granted_at, consumed_at, consumed_by_invoice_id FROM "AdUnlock" WHERE tenant_id = ${tenantId} AND status = 'PENDING' LIMIT 1`;
      if (raced.length === 0) throw new AdUnlockError(AD_UNLOCK_MESSAGES.raced, 409);
      return { status: 'PENDING', startedAt: raced[0].started_at.toISOString(), seconds: AD_UNLOCK_WATCH_SECONDS };
    }
    return { status: 'PENDING', startedAt: startedAt.toISOString(), seconds: AD_UNLOCK_WATCH_SECONDS };
  });
}

export async function completeAdWatch(tenantId: string, executor: SqlExecutor = db(), now: Date = new Date()): Promise<{ status: 'GRANTED' }> {
  return withTenantContext(tenantId, executor, async (ex) => {
    const pending = await ex.$queryRaw<UnlockRow[]>`SELECT id, tenant_id, status, started_at, granted_at, consumed_at, consumed_by_invoice_id FROM "AdUnlock" WHERE tenant_id = ${tenantId} AND status = 'PENDING' LIMIT 1`;

    if (pending.length === 0) {
      const granted = await ex.$queryRaw<{ id: string }[]>`SELECT id FROM "AdUnlock" WHERE tenant_id = ${tenantId} AND status = 'GRANTED' AND consumed_at IS NULL LIMIT 1`;
      if (granted.length > 0) return { status: 'GRANTED' };
      throw new AdUnlockError(AD_UNLOCK_MESSAGES.notWatching, 409);
    }

    const verdict = evaluateWatchCompletion({ startedAt: pending[0].started_at, now });
    if (!verdict.ok && verdict.reason === 'EXPIRED') {
      await ex.$executeRaw`DELETE FROM "AdUnlock" WHERE id = ${pending[0].id} AND status = 'PENDING'`;
      throw new AdUnlockError(AD_UNLOCK_MESSAGES.expired, 410);
    }
    if (!verdict.ok) throw new AdUnlockError(AD_UNLOCK_MESSAGES.tooSoon(verdict.waitSeconds), 425);

    const updated = await ex.$executeRaw`UPDATE "AdUnlock" SET status = 'GRANTED', granted_at = ${now} WHERE id = ${pending[0].id} AND status = 'PENDING'`;
    if (updated !== 1) throw new AdUnlockError(AD_UNLOCK_MESSAGES.raced, 409);
    return { status: 'GRANTED' };
  });
}

export async function claimUnlockForEmission(tenantId: string, executor: SqlExecutor): Promise<string | null> {
  return withTenantContext(tenantId, executor, async (ex) => {
    const rows = await ex.$queryRaw<{ id: string }[]>`
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
  });
}

export async function linkUnlockToInvoice(tenantId: string, unlockId: string, invoiceId: string, executor: SqlExecutor = db()): Promise<void> {
  await withTenantContext(tenantId, executor, async (ex) => {
    await ex.$executeRaw`UPDATE "AdUnlock" SET consumed_by_invoice_id = ${invoiceId} WHERE id = ${unlockId} AND tenant_id = ${tenantId} AND status = 'CONSUMED' AND consumed_by_invoice_id IS NULL`;
  });
}

export async function hasAvailableUnlock(tenantId: string, executor: SqlExecutor = db()): Promise<boolean> {
  return withTenantContext(tenantId, executor, async (ex) => {
    const rows = await ex.$queryRaw<{ ok: number }[]>`SELECT 1 as ok FROM "AdUnlock" WHERE tenant_id = ${tenantId} AND status = 'GRANTED' AND consumed_at IS NULL LIMIT 1`;
    return rows.length > 0;
  });
}