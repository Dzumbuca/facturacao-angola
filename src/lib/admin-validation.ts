export type AdminListQuery = {
  page: number;
  pageSize: number;
  skip: number;
  search: string;
  sort: string;
  direction: 'asc' | 'desc';
  status: string;
  role: string;
};

type AdminListOptions = { sort: readonly string[]; status: readonly string[]; roles?: readonly string[] };
type AdminPeriodInput = { period?: unknown; from?: unknown; to?: unknown };

const scalar = (value: unknown) => typeof value === 'string' ? value : '';
const positiveInt = (value: unknown, fallback: number, max: number) => {
  const raw = scalar(value);
  if (!/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return parsed >= 1 && Number.isSafeInteger(parsed) ? Math.min(parsed, max) : fallback;
};

export function parseAdminListQuery(input: Record<string, unknown>, options: AdminListOptions): AdminListQuery {
  const page = positiveInt(input.page, 1, 10_000);
  const pageSize = positiveInt(input.pageSize, 25, 100);
  const rawSearch = scalar(input.search).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  const rawSort = scalar(input.sort);
  const rawStatus = scalar(input.status);
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    search: rawSearch.slice(0, 100),
    sort: options.sort.includes(rawSort) ? rawSort : options.sort[0] ?? 'createdAt',
    direction: input.direction === 'asc' ? 'asc' : 'desc',
    status: options.status.includes(rawStatus) ? rawStatus : '',
    role: options.roles?.includes(scalar(input.role)) ? scalar(input.role) : '',
  };
}

function luandaToday(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function addCalendarDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function validDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseAdminPeriod(input: AdminPeriodInput, now = new Date()) {
  const period = scalar(input.period) || '30d';
  let from: string;
  let to: string;
  if (period === 'custom') {
    if (!validDateOnly(input.from) || !validDateOnly(input.to)) throw new RangeError('Indica um intervalo de datas válido.');
    from = input.from;
    to = input.to;
  } else {
    const daysByPeriod: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysByPeriod[period];
    if (!days) throw new RangeError('Período inválido.');
    to = luandaToday(now);
    from = addCalendarDays(to, 1 - days);
  }

  const start = new Date(`${from}T00:00:00+01:00`);
  const endExclusive = new Date(`${addCalendarDays(to, 1)}T00:00:00+01:00`);
  if (endExclusive <= start || endExclusive.getTime() - start.getTime() > 366 * 86_400_000) {
    throw new RangeError('O intervalo máximo é de 366 dias.');
  }
  return { period, from, to, start, endExclusive };
}
