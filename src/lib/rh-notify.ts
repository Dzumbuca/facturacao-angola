import 'server-only';

type Tx = any;
type RhMemberRole = 'ADMIN' | 'MANAGER' | 'FINANCE';

type NotifyInput = {
  tenantId: string;
  roles?: RhMemberRole[];
  userIds?: string[];
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
};

/**
 * Cria notificações para utilizadores da empresa.
 * - roles: membros RH com essas funções (+ administradores da empresa quando ADMIN/MANAGER).
 * - userIds: destinatários explícitos (ex.: funcionário ligado por email).
 * Nunca inclui PINs, tokens ou dados bancários no corpo.
 */
export async function notifyRhUsers(tx: Tx, input: NotifyInput): Promise<number> {
  const targets = new Set<string>(input.userIds ?? []);

  for (const role of input.roles ?? []) {
    const members = await tx.rhMember.findMany({ where: { tenantId: input.tenantId, role }, select: { userId: true } });
    members.forEach((member: { userId: string }) => targets.add(member.userId));
    if (role === 'ADMIN' || role === 'MANAGER') {
      const admins = await tx.user.findMany({ where: { tenantId: input.tenantId, tenantRole: 'COMPANY_ADMIN', status: 'ACTIVE' }, select: { id: true } });
      admins.forEach((admin: { id: string }) => targets.add(admin.id));
    }
  }

  const ids = [...targets].slice(0, 500);
  if (ids.length === 0) return 0;

  await tx.rhNotification.createMany({
    data: ids.map((userId) => ({
      tenantId: input.tenantId,
      userId,
      title: input.title.slice(0, 160),
      body: input.body.slice(0, 500),
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    })),
  });
  return ids.length;
}

/** Utilizador ligado a um funcionário (mesmo email, dentro da empresa). */
export async function findUserForEmployee(tx: Tx, tenantId: string, email: string | null): Promise<string | null> {
  if (!email) return null;
  const user = await tx.user.findFirst({
    where: { tenantId, email: { equals: email, mode: 'insensitive' }, status: 'ACTIVE' },
    select: { id: true },
  });
  return user?.id ?? null;
}
