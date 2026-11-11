import 'server-only';
type Tx = any;

export function rhFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export async function nextEmployeeNumber(tx: Tx, tenantId: string): Promise<string> {
  // Serializa a geração por empresa e evita colisões após remoções.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rh-employee:${tenantId}`}))`;
  const existing = await tx.rhEmployee.findMany({
    where: { tenantId, employeeNumber: { startsWith: 'RH-' } },
    select: { employeeNumber: true },
  });
  let max = 0;
  for (const row of existing) {
    const n = Number.parseInt(row.employeeNumber.replace('RH-', ''), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `RH-${String(max + 1).padStart(4, '0')}`;
}

export async function rhAudit(
  tx: Tx,
  input: { tenantId: string; actorUserId: string; action: string; entity: string; entityId?: string | null; metadata?: any },
): Promise<void> {
  await tx.rhAuditLog.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function assertDepartmentInTenant(tx: Tx, tenantId: string, departmentId: string | null | undefined) {
  if (!departmentId) return null;
  const row = await tx.rhDepartment.findFirst({ where: { id: departmentId, tenantId }, select: { id: true } });
  if (!row) throw new Error('DEPARTMENT_NOT_FOUND');
  return row.id;
}

export async function assertPositionInTenant(tx: Tx, tenantId: string, positionId: string | null | undefined) {
  if (!positionId) return null;
  const row = await tx.rhPosition.findFirst({ where: { id: positionId, tenantId }, select: { id: true } });
  if (!row) throw new Error('POSITION_NOT_FOUND');
  return row.id;
}

export async function assertShiftInTenant(tx: any, tenantId: string, shiftId: string | null | undefined) {
  if (!shiftId) return null;
  const row = await tx.rhShift.findFirst({ where: { id: shiftId, tenantId, isActive: true }, select: { id: true } });
  if (!row) throw new Error('SHIFT_NOT_FOUND');
  return row.id;
}

/** Minutos de atraso da entrada face ao horário, no fuso de Angola (UTC+1, sem DST). */
export function lateMinutesFor(occurredAt: Date, shift: { startTime: string; toleranceMinutes: number } | null): number {
  if (!shift) return 0;
  const [sh, sm] = shift.startTime.split(':').map(Number);
  if (!Number.isFinite(sh) || !Number.isFinite(sm)) return 0;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Luanda', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(occurredAt);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return Math.max(0, hour * 60 + minute - (sh * 60 + sm) - Math.max(0, shift.toleranceMinutes || 0));
}

/** Mascara dados bancários: mostra apenas os últimos 3 caracteres. */
export function maskAccount(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = String(value).trim();
  if (!clean) return null;
  return clean.length <= 3 ? '••••' : `•••••${clean.slice(-3)}`;
}
