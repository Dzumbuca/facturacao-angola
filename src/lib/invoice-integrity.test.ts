import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  reserveInvoiceNumber,
  loadOrInitChainState,
  lockIntegrityChain,
  checkIdempotency,
} from './invoice-integrity';

describe('invoice-integrity — unit-level', () => {
  let tx: any;

  beforeEach(() => {
    tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn(),
    };
  });

  it('lockIntegrityChain always issues the advisory lock', async () => {
    await lockIntegrityChain(tx, 't1');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('reserveInvoiceNumber performs INSERT ON CONFLICT then UPDATE RETURNING', async () => {
    tx.$queryRaw.mockResolvedValueOnce([{ lastNumber: 5 }]);
    const n = await reserveInvoiceNumber(tx, 't1', 'A', 'FT', 2026);
    expect(n).toBe(5);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('loadOrInitChainState initialises then reads FOR UPDATE', async () => {
    tx.$queryRaw.mockResolvedValueOnce([{ lastHash: 'abc', lastSequence: 3, lastInvoiceId: 'inv-1' }]);
    const state = await loadOrInitChainState(tx, 't1');
    expect(state).toEqual({ lastHash: 'abc', lastSequence: 3, lastInvoiceId: 'inv-1' });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('checkIdempotency returns fresh when no record found', async () => {
    tx.$queryRaw.mockResolvedValueOnce([]);
    const decision = await checkIdempotency(tx, 't1', 'k', 'INVOICE', 'h');
    expect(decision).toEqual({ kind: 'fresh' });
  });

  it('checkIdempotency returns replay when payloadHash matches', async () => {
    tx.$queryRaw.mockResolvedValueOnce([{ payloadHash: 'h', resultId: 'inv1' }]);
    const decision = await checkIdempotency(tx, 't1', 'k', 'INVOICE', 'h');
    expect(decision).toEqual({ kind: 'replay', resultId: 'inv1', payloadHash: 'h' });
  });

  it('checkIdempotency returns conflict when payloadHash differs', async () => {
    tx.$queryRaw.mockResolvedValueOnce([{ payloadHash: 'h2', resultId: 'inv1' }]);
    const decision = await checkIdempotency(tx, 't1', 'k', 'INVOICE', 'h1');
    expect(decision).toEqual({ kind: 'conflict', resultId: 'inv1', payloadHash: 'h2' });
  });
});
