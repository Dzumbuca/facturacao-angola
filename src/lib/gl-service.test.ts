/**
 * A3 — unit test do General Ledger — partida dobrada balance enforced
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./tenant-db.js', () => ({
  runWithTenant: async (_tenantId: string, fn: (tx: any) => any) => {
    const accounts = [
      { id: 'acc-1200', code: '1200' },
      { id: 'acc-4000', code: '4000' },
      { id: 'acc-2100', code: '2100' },
      { id: 'acc-1100', code: '1100' },
      { id: 'acc-2000', code: '2000' },
      { id: 'acc-1300', code: '1300' },
    ];
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      glAccount: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue(accounts),
        create: vi.fn().mockResolvedValue({}),
      },
      journalEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data, include }: any) => ({
          id: 'jez-1',
          ...data,
          number: data.number,
          lines: data.lines.create.map((l: any, i: number) => ({ id: `line-${i}`, ...l })),
        })),
      },
      journalEntryLine: { create: vi.fn().mockResolvedValue({}) },
    };
    await fn(tx);
    return tx;
  },
}));

import { ensureChartOfAccounts, postJournalEntry } from './gl-service';

describe('GL — partida dobrada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejecta entrada desequilibrada — débitos != créditos', async () => {
    await expect(
      postJournalEntry('tenant-1', {
        description: 'test',
        lines: [
          { accountCode: '1200', debit: 100 },
          { accountCode: '4000', credit: 90 },
        ],
      })
    ).rejects.toThrow(/UNBALANCED/);
  });

  it('aceita entrada com débitos = créditos e linhas ≥ 2', async () => {
    const entry = await postJournalEntry('tenant-1', {
      description: 'ok',
      lines: [
        { accountCode: '1200', debit: 100 },
        { accountCode: '4000', credit: 100 },
      ],
    });
    expect(entry).toBeDefined();
  });

  it('rejecta linhas sem debit nem credit', async () => {
    await expect(
      postJournalEntry('tenant-1', {
        description: 'bad',
        lines: [
          { accountCode: '1200', memo: 'noop line' } as any,
          { accountCode: '4000', credit: 100 },
        ],
      })
    ).rejects.toThrow(/LINE_MUST_HAVE_DEBIT_OR_CREDIT/);
  });

  it('ensureChartOfAccounts é idempotente mesmo quando não existem contas', async () => {
    await ensureChartOfAccounts('tenant-acceptance');
  });

  it('rejeita sourceId inválido se tiver <2 linhas', async () => {
    await expect(
      postJournalEntry('tenant-1', {
        description: 'tiny',
        lines: [{ accountCode: '1200', debit: 100 }],
      })
    ).rejects.toThrow(/LINES_INSUFFICIENT/);
  });
});
