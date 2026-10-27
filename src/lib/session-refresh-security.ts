export function canRefreshAuthSession(token: unknown, user: unknown): boolean {
  if (!token || typeof token !== 'object' || !user || typeof user !== 'object') return false;
  const tokenVersion = (token as Record<string, unknown>).sessionVersion;
  const account = user as Record<string, unknown>;
  const userVersion = account.sessionVersion;
  return Boolean(
    typeof tokenVersion === 'number'
    && Number.isSafeInteger(tokenVersion)
    && account.status === 'ACTIVE'
    && typeof userVersion === 'number'
    && userVersion === tokenVersion
    && !(account.emailVerificationRequired === true && !account.emailVerified),
  );
}
