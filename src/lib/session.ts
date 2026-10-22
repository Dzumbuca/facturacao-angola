export const getSessionUserId = (session: unknown): string | null => {
  if (!session || typeof session !== 'object') return null;
  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== 'object') return null;
  const id = (user as { id?: unknown }).id;
  return typeof id === 'string' && id.trim() ? id : null;
};

export const getSessionTenantId = (session: unknown): string | null => {
  if (!session || typeof session !== 'object') return null;
  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== 'object') return null;
  const tenantId = (user as { tenantId?: unknown }).tenantId;
  return typeof tenantId === 'string' && tenantId.trim() ? tenantId : null;
};
