import 'server-only';
import { prisma } from '@/lib/prisma';
import { parseAdminListQuery, parseAdminPeriod } from './admin-validation';
import { requirePlatformPermission } from './admin-auth';

const db = prisma as any;
const userSelect = { id: true, name: true, email: true, tenantId: true, tenantRole: true, platformRole: true, status: true, createdAt: true, tenant: { select: { id: true, name: true, status: true } } };

function pageResult<T>(items: T[], total: number, query: { page: number; pageSize: number }) {
  return { items, total, page: query.page, pageSize: query.pageSize, pageCount: Math.ceil(total / query.pageSize) };
}

export async function listAdminTenants(input: Record<string, unknown>) {
  await requirePlatformPermission('companies.read');
  const q = parseAdminListQuery(input, { sort: ['createdAt', 'name'], status: ['ACTIVE', 'SUSPENDED'] });
  const where: any = {};
  if (q.status) where.status = q.status;
  if (q.search) where.OR = [{ name: { contains: q.search, mode: 'insensitive' } }, { nif: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }];
  const [items, total] = await Promise.all([
    db.tenant.findMany({ where, skip: q.skip, take: q.pageSize, orderBy: [{ [q.sort]: q.direction }, { id: 'asc' }], select: { id: true, name: true, nif: true, email: true, status: true, createdAt: true, _count: { select: { users: true, invoices: true, customers: true } } } }),
    db.tenant.count({ where }),
  ]);
  return pageResult(items, total, q);
}

export async function listAdminUsers(input: Record<string, unknown>) {
  const actor = await requirePlatformPermission('users.read');
  const q = parseAdminListQuery(input, { sort: ['createdAt', 'name', 'email'], status: ['ACTIVE', 'SUSPENDED'], roles: ['USER', 'COMPANY_ADMIN', 'BILLING', 'VIEWER'] });
  const where: any = actor.platformRole === 'USER_MANAGER' ? { tenantId: actor.tenantId ?? '__no_tenant_access__' } : {};
  if (q.status) where.status = q.status;
  if (q.role) where.tenantRole = q.role;
  if (q.search) where.OR = [{ name: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }, { tenant: { is: { name: { contains: q.search, mode: 'insensitive' } } } }];
  const [items, total] = await Promise.all([
    db.user.findMany({ where, skip: q.skip, take: q.pageSize, orderBy: [{ [q.sort]: q.direction }, { id: 'asc' }], select: userSelect }),
    db.user.count({ where }),
  ]);
  return pageResult(items, total, q);
}

export async function listAdminPlatformTeam(input: Record<string, unknown>) {
  await requirePlatformPermission('team.read');
  const roles = ['ADMIN', 'SUPERADMIN', 'COMPANY_MANAGER', 'USER_MANAGER', 'DOCUMENT_MANAGER', 'AUDITOR', 'SUPPORT'];
  const q = parseAdminListQuery(input, { sort: ['createdAt', 'name', 'email'], status: ['ACTIVE', 'SUSPENDED'], roles });
  const where: any = { platformRole: { in: roles } };
  if (q.status) where.status = q.status;
  if (q.role) where.platformRole = q.role;
  if (q.search) where.OR = [{ name: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }];
  const [items, total, active, suspended] = await Promise.all([
    db.user.findMany({ where, skip: q.skip, take: q.pageSize, orderBy: [{ [q.sort]: q.direction }, { id: 'asc' }], select: { id: true, name: true, email: true, platformRole: true, status: true, createdAt: true } }),
    db.user.count({ where }),
    db.user.count({ where: { platformRole: { in: roles }, status: 'ACTIVE' } }),
    db.user.count({ where: { platformRole: { in: roles }, status: 'SUSPENDED' } }),
  ]);
  return { ...pageResult(items, total, q), active, pendingInvites: null, suspended };
}

export async function listAdminInvoices(input: Record<string, unknown>) {
  await requirePlatformPermission('documents.read');
  const q = parseAdminListQuery(input, { sort: ['issuedAt', 'number', 'total'], status: ['ISSUED', 'CANCELLED', 'DRAFT'] });
  const where: any = {};
  if (q.status) where.status = q.status;
  if (q.search) where.OR = [{ number: { contains: q.search, mode: 'insensitive' } }, { tenant: { is: { name: { contains: q.search, mode: 'insensitive' } } } }, { customer: { is: { name: { contains: q.search, mode: 'insensitive' } } } }];
  const [items, total] = await Promise.all([
    db.invoice.findMany({ where, skip: q.skip, take: q.pageSize, orderBy: [{ [q.sort]: q.direction }, { id: 'asc' }], select: { id: true, number: true, type: true, status: true, total: true, currency: true, issuedAt: true, tenant: { select: { id: true, name: true } }, customer: { select: { name: true } } } }),
    db.invoice.count({ where }),
  ]);
  return pageResult(items, total, q);
}

export async function listAdminAuditLogs(input: Record<string, unknown>) {
  await requirePlatformPermission('audit.read');
  const q = parseAdminListQuery(input, { sort: ['createdAt'], status: ['SUCCESS', 'FAILURE'] });
  const where: any = {};
  if (q.status) where.result = q.status;
  if (q.search) where.OR = [{ action: { contains: q.search, mode: 'insensitive' } }, { resourceType: { contains: q.search, mode: 'insensitive' } }, { resourceId: { contains: q.search, mode: 'insensitive' } }, { reason: { contains: q.search, mode: 'insensitive' } }];
  const [items, total] = await Promise.all([
    db.adminAuditLog.findMany({ where, skip: q.skip, take: q.pageSize, orderBy: [{ createdAt: q.direction }, { id: 'asc' }], select: { id: true, actorType: true, action: true, resourceType: true, resourceId: true, reason: true, result: true, metadata: true, createdAt: true, actorUser: { select: { id: true, name: true, email: true } } } }),
    db.adminAuditLog.count({ where }),
  ]);
  return pageResult(items, total, q);
}

export async function getAdminDashboard(input: { period?: unknown; from?: unknown; to?: unknown } = {}) {
  await requirePlatformPermission('dashboard.read');
  const period = parseAdminPeriod(input);
  const dateWhere = { gte: period.start, lt: period.endExclusive };
  const [tenants, users, invoiceGroups, payments, debtGroups, tenantTrend, userTrend, invoiceTrend, recent] = await Promise.all([
    Promise.all([db.tenant.count(), db.tenant.count({ where: { status: 'ACTIVE' } }), db.tenant.count({ where: { status: 'SUSPENDED' } })]),
    Promise.all([db.user.count(), db.user.count({ where: { status: 'ACTIVE' } })]),
    db.invoice.groupBy({ by: ['currency'], where: { issuedAt: dateWhere, status: { not: 'CANCELLED' } }, _count: true, _sum: { total: true } }),
    db.payment.groupBy({ by: ['currency'], where: { status: 'CONFIRMED', paymentDate: dateWhere }, _sum: { amount: true } }),
    db.$queryRaw`SELECT i.currency, SUM(GREATEST(i.total - COALESCE(p.received, 0), 0)) AS amount FROM "Invoice" i LEFT JOIN (SELECT "invoiceId", SUM(amount) AS received FROM "Payment" WHERE status = 'CONFIRMED' GROUP BY "invoiceId") p ON p."invoiceId" = i.id WHERE i.status <> 'CANCELLED' GROUP BY i.currency`,
    db.$queryRaw`SELECT date_trunc('day', "createdAt")::date AS day, count(*)::int AS count FROM "Tenant" WHERE "createdAt" >= ${period.start} AND "createdAt" < ${period.endExclusive} GROUP BY 1 ORDER BY 1`,
    db.$queryRaw`SELECT date_trunc('day', "createdAt")::date AS day, count(*)::int AS count FROM "User" WHERE "createdAt" >= ${period.start} AND "createdAt" < ${period.endExclusive} GROUP BY 1 ORDER BY 1`,
    db.$queryRaw`SELECT date_trunc('day', "issuedAt")::date AS day, count(*)::int AS count FROM "Invoice" WHERE "issuedAt" >= ${period.start} AND "issuedAt" < ${period.endExclusive} AND status <> 'CANCELLED' GROUP BY 1 ORDER BY 1`,
    db.invoice.findMany({ where: { issuedAt: dateWhere, status: { not: 'CANCELLED' } }, orderBy: { issuedAt: 'desc' }, take: 5, select: { id: true, number: true, total: true, currency: true, issuedAt: true, tenant: { select: { name: true } } } }),
  ]);
  const invoiced = invoiceGroups.map((v: any) => ({ currency: v.currency, amount: Number(v._sum.total ?? 0), count: v._count }));
  const received = payments.map((v: any) => ({ currency: v.currency, amount: Number(v._sum.amount ?? 0) }));
  const outstanding = debtGroups.map((v: any) => ({ currency: v.currency, amount: Number(v.amount ?? 0) }));
  return {
    period,
    counts: { tenants: { total: tenants[0], active: tenants[1], suspended: tenants[2] }, users: { total: users[0], active: users[1] }, invoices: { period: invoiced.reduce((sum: number, v: any) => sum + v.count, 0) } },
    moneyByCurrency: { invoiced, received, outstanding },
    trends: { tenants: tenantTrend, users: userTrend, invoices: invoiceTrend },
    recentInvoices: recent,
  };
}

export async function getAdminPlatformConfig() {
  await requirePlatformPermission('settings.read');
  return (await db.platformConfig.findUnique({ where: { id: 'global' }, select: { platformName: true, supportEmail: true, supportPhone: true, supportWebsite: true, platformDescription: true, responsibleEntity: true } })) ?? { platformName: 'Machine Facturas', supportEmail: null, supportPhone: null, supportWebsite: null, platformDescription: null, responsibleEntity: null };
}

export async function getAdminConfigHistory() {
  await requirePlatformPermission('settings.read');
  return db.adminAuditLog.findMany({ where: { action: 'PLATFORM_CONFIG_UPDATED' }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, reason: true, metadata: true, createdAt: true, actorUser: { select: { name: true, email: true } } } });
}

export async function getAdminSystemStatus() {
  await requirePlatformPermission('system.read');
  let database = 'unavailable';
  try { await db.$queryRaw`SELECT 1`; database = 'available'; } catch { /* Keep details in server logs only. */ }
  return { database, version: process.env.npm_package_version ?? null, uptimeSeconds: Math.floor(process.uptime()), errorTelemetry: 'not_configured', fileStorage: 'not_configured' };
}

export async function getAdminTenantDetail(id: string) {
  await requirePlatformPermission('companies.read');
  return db.tenant.findUnique({ where: { id }, select: { id: true, name: true, nif: true, email: true, phone: true, status: true, plan: true, suspendedAt: true, suspensionReason: true, createdAt: true, _count: { select: { users: true, invoices: true, customers: true, products: true } } } });
}

export async function getAdminUserDetail(id: string) {
  const actor = await requirePlatformPermission('users.read');
  const user = await db.user.findUnique({ where: { id }, select: { ...userSelect, suspendedAt: true } });
  if (actor.platformRole === 'USER_MANAGER' && user?.tenantId !== actor.tenantId) return null;
  return user;
}

// Fila de comprovativos de pagamento de planos (Multicaixa Express)
export async function getAdminPlanPayments(status?: string) {
  await requirePlatformPermission('companies.read');
  return db.planPayment.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, amountKz: true, months: true, status: true, adminNote: true, createdAt: true, reviewedAt: true, payerName: true, payerPhone: true, tenant: { select: { name: true } } },
  });
}
