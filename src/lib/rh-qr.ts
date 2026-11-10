import 'server-only';
import crypto from 'crypto';

type QrPayload = { tenantId: string; employeeId: string; exp: number };

function secret(): string {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error('NEXTAUTH_SECRET ausente');
  return value;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** Token de QR do ponto: curto, assinado e vinculado à empresa/funcionário. */
export function createQrToken(tenantId: string, employeeId: string, ttlSeconds = 300): { token: string; expiresAt: Date } {
  const exp = Math.floor(Date.now() / 1000) + Math.max(30, Math.min(900, ttlSeconds));
  const payload = base64url(JSON.stringify({ tenantId, employeeId, exp } satisfies QrPayload));
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(exp * 1000) };
}

export function verifyQrToken(token: string): QrPayload | null {
  const [payload, signature] = (token ?? '').trim().split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as QrPayload;
    if (!parsed?.tenantId || !parsed?.employeeId || !Number.isFinite(parsed.exp)) return null;
    if (parsed.exp * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
