import { createHmac, randomInt } from 'node:crypto';

/**
 * Credencial de PIN do ponto.
 *
 * - pinLookup: HMAC-SHA256(pin, PIN_PEPPER) — determinístico, permite unicidade
 *   por tenant em O(log n) sem guardar nem expor o PIN.
 * - O pepper NUNCA é exposto no front-end, logs ou respostas HTTP.
 * - Em produção, a ausência de PIN_PEPPER impede a criação/edição de PINs
 *   (fail-fast no momento da operação, não ao carregar o módulo — o build do Next
 *   precisa importar o ficheiro sem a env disponível).
 * - ROTAÇÃO: mudar PIN_PEPPER invalida todos os pinLookup existentes.
 *   Após rotação é obrigatório redefinir todos os PINs.
 */

const isProduction = process.env.NODE_ENV === 'production';
const getPepper = (): string => {
  const pepper = process.env.PIN_PEPPER;
  if (!pepper && isProduction) {
    throw new Error('PIN_PEPPER não configurado. Defina-o antes de processar credenciais de PIN.');
  }
  // Em dev/teste usa um pepper de desenvolvimento explicitamente marcado como inseguro.
  return pepper ?? 'rh-pin-pepper-development-only';
};

export function pinLookup(pin: string): string {
  return createHmac('sha256', getPepper()).update(pin).digest('hex');
}

/** PIN de 6 dígitos, gerado com CSPRNG. */
export function generatePin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Validação de formato estrita (apenas 6 dígitos). */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}
