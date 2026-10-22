const TIME_ZONE = 'Africa/Luanda';
const DAY = 24 * 60 * 60 * 1000;

export type ReportPeriodQuery = { period?: string | null; from?: string | null; to?: string | null };
export type ReportPeriod = { key: string; start: Date; endExclusive: Date; timeZone: typeof TIME_ZONE };

export function parseReportPeriod(query: ReportPeriodQuery, now = new Date()): ReportPeriod {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const today = Date.UTC(get('year'), get('month') - 1, get('day'));
  const offset = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - (now.getTime() - now.getMilliseconds());
  const fromLocal = (date: number) => new Date(date - offset);
  const period = query.period || 'today';
  let start: number;
  let endExclusive: number;
  if (period === 'custom') {
    const from = parseDateOnly(query.from);
    const to = parseDateOnly(query.to);
    if (from === null || to === null || from > to) throw new RangeError('Intervalo de datas inválido.');
    start = from;
    endExclusive = to + DAY;
  } else if (period === 'today') {
    start = today; endExclusive = today + DAY;
  } else if (period === 'last7days') {
    start = today - 6 * DAY; endExclusive = today + DAY;
  } else if (period === 'last30days') {
    start = today - 29 * DAY; endExclusive = today + DAY;
  } else if (period === 'thisMonth') {
    start = Date.UTC(get('year'), get('month') - 1, 1); endExclusive = Date.UTC(get('year'), get('month'), 1);
  } else if (period === 'lastMonth') {
    start = Date.UTC(get('year'), get('month') - 2, 1); endExclusive = Date.UTC(get('year'), get('month') - 1, 1);
  } else if (period === 'thisQuarter') {
    const quarterMonth = Math.floor((get('month') - 1) / 3) * 3;
    start = Date.UTC(get('year'), quarterMonth, 1); endExclusive = Date.UTC(get('year'), quarterMonth + 3, 1);
  } else if (period === 'thisYear') {
    start = Date.UTC(get('year'), 0, 1); endExclusive = Date.UTC(get('year') + 1, 0, 1);
  } else {
    throw new RangeError('Período inválido.');
  }
  return { key: period, start: fromLocal(start), endExclusive: fromLocal(endExclusive), timeZone: TIME_ZONE };
}

function parseDateOnly(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = Date.UTC(year, month - 1, day);
  const check = new Date(date);
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? date : null;
}
