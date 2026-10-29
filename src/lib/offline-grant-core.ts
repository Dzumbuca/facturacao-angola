import { sign, verify, type KeyLike } from 'node:crypto';

export const MAX_OFFLINE_GRANT_SECONDS = 12 * 60 * 60;
const ROLES = new Set(['USER', 'COMPANY_ADMIN', 'BILLING']);

export type OfflineGrantClaims = {
  userId: string;
  tenantId: string;
  tenantRole: 'USER' | 'COMPANY_ADMIN' | 'BILLING';
  sessionVersion: number;
  canCreateInvoiceDrafts: boolean;
  issuedAt: number;
  expiresAt: number;
};

function isClaims(value: unknown): value is OfflineGrantClaims {
  if (!value || typeof value !== 'object') return false;
  const claims = value as Record<string, unknown>;
  return typeof claims.userId === 'string' && claims.userId.length > 0
    && typeof claims.tenantId === 'string' && claims.tenantId.length > 0
    && typeof claims.tenantRole === 'string' && ROLES.has(claims.tenantRole)
    && Number.isSafeInteger(claims.sessionVersion) && (claims.sessionVersion as number) >= 0
    && claims.canCreateInvoiceDrafts === true
    && Number.isSafeInteger(claims.issuedAt) && Number.isSafeInteger(claims.expiresAt)
    && (claims.expiresAt as number) > (claims.issuedAt as number)
    && (claims.expiresAt as number) - (claims.issuedAt as number) <= MAX_OFFLINE_GRANT_SECONDS;
}

export function signOfflineGrant(claims: OfflineGrantClaims, privateKey: KeyLike): string {
  if (!isClaims(claims)) throw new Error('Invalid offline grant claims');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = sign(null, Buffer.from(payload), privateKey).toString('base64url');
  return `${payload}.${signature}`;
}

export function verifyOfflineGrantSignature(token: string, publicKey: KeyLike): OfflineGrantClaims | null {
  if (typeof token !== 'string' || token.length > 8192) return null;
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length) return null;
  try {
    const validSignature = verify(null, Buffer.from(payload), publicKey, Buffer.from(signature, 'base64url'));
    if (!validSignature) return null;
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!isClaims(claims)) return null;
    return claims;
  } catch {
    return null;
  }
}

export function verifyOfflineGrant(token: string, publicKey: KeyLike, now = Math.floor(Date.now() / 1000)): OfflineGrantClaims | null {
  const claims = verifyOfflineGrantSignature(token, publicKey);
  return claims && claims.issuedAt <= now && claims.expiresAt > now ? claims : null;
}

export function isOfflineGrantForAccess(
  token: string,
  publicKey: KeyLike,
  expected: Pick<OfflineGrantClaims, 'userId' | 'tenantId' | 'tenantRole' | 'sessionVersion'>,
  now = Math.floor(Date.now() / 1000),
): boolean {
  const claims = verifyOfflineGrant(token, publicKey, now);
  return Boolean(claims && claims.canCreateInvoiceDrafts && claims.userId === expected.userId
    && claims.tenantId === expected.tenantId && claims.tenantRole === expected.tenantRole
    && claims.sessionVersion === expected.sessionVersion);
}
