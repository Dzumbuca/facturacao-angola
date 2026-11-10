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
