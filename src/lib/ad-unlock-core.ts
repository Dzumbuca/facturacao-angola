// Núcleo puro do desbloqueio por anúncio — sem base de dados, testável.
// Regra de negócio: após esgotar as 20 facturas gratuitas, cada nova emissão
// exige uma visualização com duração mínima; cada desbloqueio autoriza
// exactamente UMA emissão.

export const AD_UNLOCK_WATCH_SECONDS = 20;
// Janela para concluir uma visualização iniciada (evita retomar sessões
// abandonadas horas depois): 10 minutos.
export const AD_UNLOCK_PENDING_TTL_MS = 10 * 60 * 1000;

export type AdUnlockStatus = 'PENDING' | 'GRANTED' | 'CONSUMED';

export type WatchVerdict =
  | { ok: true }
  | { ok: false; reason: 'TOO_SOON'; waitSeconds: number }
  | { ok: false; reason: 'EXPIRED' };

// Valida, pelo relógio do SERVIDOR, se a visualização já cumpriu o tempo
// mínimo. O cliente não decide nada: envia apenas o pedido e o servidor
// compara com o started_at que ele próprio registou no begin.
export function evaluateWatchCompletion(params: {
  startedAt: Date;
  now: Date;
  watchSeconds?: number;
  ttlMs?: number;
}): WatchVerdict {
  const watchSeconds = params.watchSeconds ?? AD_UNLOCK_WATCH_SECONDS;
  const ttlMs = params.ttlMs ?? AD_UNLOCK_PENDING_TTL_MS;
  const elapsedMs = params.now.getTime() - params.startedAt.getTime();
  if (elapsedMs < 0) return { ok: false, reason: 'TOO_SOON', waitSeconds: watchSeconds };
  if (elapsedMs > ttlMs) return { ok: false, reason: 'EXPIRED' };
  const waitSeconds = Math.ceil(watchSeconds - elapsedMs / 1000);
  if (waitSeconds > 0) return { ok: false, reason: 'TOO_SOON', waitSeconds };
  return { ok: true };
}

// Mensagens de utilizador (PT-AO) centralizadas para coerência entre modal e rotas.
export const AD_UNLOCK_MESSAGES = {
  notWatching: 'Não há uma visualização de anúncio em curso. Abra novamente o desbloqueio.',
  expired: 'A sessão de visualização expirou. Inicie o desbloqueio novamente.',
  tooSoon: (waitSeconds: number) => `Faltam ${waitSeconds} s de anúncio visível para desbloquear.`,
  raced: 'O desbloqueio foi processado noutra sessão. Actualize e tente novamente.',
  alreadyUsed: 'Este desbloqueio já foi utilizado numa factura emitida.',
};
