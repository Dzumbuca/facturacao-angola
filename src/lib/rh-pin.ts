import { createHash } from 'node:crypto';

/**
 * Lookup determinístico do PIN: SHA-256(pin + pepper).
 * O pepper nunca é armazenado nem exposto; sem ele o lookup é inútil fora do sistema.
 * Proposital não ser inversível e permitir unicidade por tenant em O(log n).
 */
const PEPPER = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'rh-pin-pepper-dev';

export function pinLookup(pin: string): string {
  return createHash('sha256').update(`${pin}:${PEPPER}`).digest('hex');
}

/** PIN de 6 dígitos. */
export function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Validação de formato estrita (apenas 6 dígitos). */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}
