import { describe, expect, it } from 'vitest';
import { buildAdminMoneySummary } from './admin-data-core';

describe('platform dashboard money indicators', () => {
  it('keeps billed volume, confirmed receipts, and outstanding balance separate', () => {
    const summary = buildAdminMoneySummary({ invoiced: 1000, received: 350, outstanding: 650 });
    expect(summary).toEqual({ invoiced: 1000, received: 350, outstanding: 650 });
    expect(summary).not.toHaveProperty('revenue');
  });

  it('rounds aggregate decimal values to cents', () => {
    expect(buildAdminMoneySummary({ invoiced: 1.105, received: 0.105, outstanding: 1 })).toEqual({
      invoiced: 1.11, received: 0.11, outstanding: 1,
    });
  });
});
