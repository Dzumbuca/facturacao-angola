import { describe, expect, it } from 'vitest';
import {
  AD_UNLOCK_MESSAGES,
  AD_UNLOCK_PENDING_TTL_MS,
  AD_UNLOCK_WATCH_SECONDS,
  evaluateWatchCompletion,
} from './ad-unlock-core';

const startedAt = new Date('2026-10-29T10:00:00.000Z');
const at = (seconds: number) => new Date(startedAt.getTime() + seconds * 1000);

describe('evaluateWatchCompletion', () => {
  it('exige o tempo mínimo de visualização medido pelo relógio do servidor', () => {
    expect(evaluateWatchCompletion({ startedAt, now: at(AD_UNLOCK_WATCH_SECONDS - 1) }))
      .toEqual({ ok: false, reason: 'TOO_SOON', waitSeconds: 1 });
    expect(evaluateWatchCompletion({ startedAt, now: at(AD_UNLOCK_WATCH_SECONDS) }))
      .toEqual({ ok: true });
  });

  it('nunca aceita um tempo negativo (relógio do cliente adiantado ou sessão futura)', () => {
    expect(evaluateWatchCompletion({ startedAt, now: at(-5) }))
      .toEqual({ ok: false, reason: 'TOO_SOON', waitSeconds: AD_UNLOCK_WATCH_SECONDS });
  });

  it('rejeita sessões abandonadas depois da janela de conclusão', () => {
    const afterTtl = AD_UNLOCK_PENDING_TTL_MS / 1000 + 1;
    expect(evaluateWatchCompletion({ startedAt, now: at(afterTtl) }))
      .toEqual({ ok: false, reason: 'EXPIRED' });
    // Ainda dentro da janela continua válida.
    expect(evaluateWatchCompletion({ startedAt, now: at(AD_UNLOCK_PENDING_TTL_MS / 1000 - 1) }).ok).toBe(true);
  });

  it('respeita tempos e janela configuráveis sem deixar de validar', () => {
    expect(evaluateWatchCompletion({ startedAt, now: at(10), watchSeconds: 30, ttlMs: 60_000 }))
      .toEqual({ ok: false, reason: 'TOO_SOON', waitSeconds: 20 });
    expect(evaluateWatchCompletion({ startedAt, now: at(30), watchSeconds: 30, ttlMs: 60_000 }))
      .toEqual({ ok: true });
    expect(evaluateWatchCompletion({ startedAt, now: at(61), watchSeconds: 30, ttlMs: 60_000 }))
      .toEqual({ ok: false, reason: 'EXPIRED' });
  });
});

describe('AD_UNLOCK_MESSAGES', () => {
  it('indica os segundos em falta em português', () => {
    expect(AD_UNLOCK_MESSAGES.tooSoon(7)).toContain('7');
    expect(AD_UNLOCK_MESSAGES.tooSoon(7)).toContain('anúncio');
  });

  it('explica que um desbloqueio só serve para uma factura', () => {
    expect(AD_UNLOCK_MESSAGES.alreadyUsed).toContain('já foi utilizado');
  });
});
