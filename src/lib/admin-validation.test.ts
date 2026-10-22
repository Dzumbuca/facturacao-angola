import { describe, expect, it } from 'vitest';
import { parseAdminListQuery, parseAdminPeriod } from './admin-validation';

describe('admin list query validation', () => {
  it('caps page size, trims search, and accepts only allow-listed sorting and filters', () => {
    expect(parseAdminListQuery({ page: '3', pageSize: '900', search: '  Loja  ', sort: 'name', direction: 'asc', status: 'ACTIVE' }, {
      sort: ['createdAt', 'name'], status: ['ACTIVE', 'SUSPENDED'],
    })).toEqual({ page: 3, pageSize: 100, skip: 200, search: 'Loja', sort: 'name', direction: 'asc', status: 'ACTIVE', role: '' });
  });

  it('uses safe defaults for repeated, malformed, oversized, or unsupported values', () => {
    const query = parseAdminListQuery({ page: ['2', '3'], pageSize: 'many', search: 'x'.repeat(300), sort: 'password', direction: 'sideways', status: 'ROOT' }, {
      sort: ['createdAt', 'name'], status: ['ACTIVE', 'SUSPENDED'],
    });
    expect(query).toMatchObject({ page: 1, pageSize: 25, skip: 0, sort: 'createdAt', direction: 'desc', status: '' });
    expect(query.search).toHaveLength(100);
  });

  it('bounds pagination offsets', () => {
    const query = parseAdminListQuery({ page: '999999999', pageSize: '100' }, { sort: ['createdAt'], status: [] });
    expect(query.page).toBe(10_000);
    expect(query.skip).toBe(999_900);
  });

  it('accepts only an explicitly allow-listed role filter', () => {
    const query = parseAdminListQuery({ role: 'COMPANY_ADMIN' }, {
      sort: ['createdAt', 'name'], status: ['ACTIVE', 'SUSPENDED'], roles: ['USER', 'COMPANY_ADMIN', 'BILLING', 'VIEWER'],
    });
    expect(query.role).toBe('COMPANY_ADMIN');
  });
});

describe('admin dashboard period validation', () => {
  const now = new Date('2026-10-20T12:00:00+01:00');

  it('supports bounded 7, 30, and 90 day periods using Luanda calendar dates', () => {
    expect(parseAdminPeriod({ period: '7d' }, now).from).toBe('2026-10-14');
    expect(parseAdminPeriod({ period: '30d' }, now).from).toBe('2026-09-21');
    expect(parseAdminPeriod({ period: '90d' }, now).from).toBe('2026-07-23');
  });

  it('rejects invalid dates and custom ranges over one year', () => {
    expect(() => parseAdminPeriod({ period: 'custom', from: '2026-02-30', to: '2026-03-01' }, now)).toThrow();
    expect(() => parseAdminPeriod({ period: 'custom', from: '2024-01-01', to: '2026-01-01' }, now)).toThrow();
  });
});
