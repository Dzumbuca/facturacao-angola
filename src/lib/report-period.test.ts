import { describe, expect, it } from 'vitest';
import { parseReportPeriod } from './report-period';

const now = new Date('2026-10-19T12:30:00.000Z');

describe('parseReportPeriod', () => {
  it('creates Luanda-local calendar boundaries and exclusive end', () => {
    const today = parseReportPeriod({ period: 'today' }, now);
    expect(today.start.toISOString()).toBe('2026-10-18T23:00:00.000Z');
    expect(today.endExclusive.toISOString()).toBe('2026-10-19T23:00:00.000Z');
  });
  it('supports the preset periods', () => {
    expect(parseReportPeriod({ period: 'last7days' }, now).start.toISOString()).toBe('2026-10-12T23:00:00.000Z');
    expect(parseReportPeriod({ period: 'thisMonth' }, now).start.toISOString()).toBe('2026-09-30T23:00:00.000Z');
    expect(parseReportPeriod({ period: 'lastMonth' }, now).start.toISOString()).toBe('2026-08-31T23:00:00.000Z');
    expect(parseReportPeriod({ period: 'thisQuarter' }, now).start.toISOString()).toBe('2026-09-30T23:00:00.000Z');
    expect(parseReportPeriod({ period: 'thisYear' }, now).start.toISOString()).toBe('2025-12-31T23:00:00.000Z');
  });
  it('uses inclusive custom end dates and rejects invalid ranges', () => {
    const custom = parseReportPeriod({ period: 'custom', from: '2026-10-01', to: '2026-10-05' }, now);
    expect(custom.endExclusive.toISOString()).toBe('2026-10-05T23:00:00.000Z');
    expect(() => parseReportPeriod({ period: 'custom', from: '2026-02-30', to: '2026-03-01' }, now)).toThrow();
  });
});
