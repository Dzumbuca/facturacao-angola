export type RegistrationInput = {
  name?: unknown;
  tenantName?: unknown;
  email?: unknown;
  password?: unknown;
  marketingConsent?: unknown;
};

export function validateRegistration(input: RegistrationInput): string | null {
  if (typeof input.name !== 'string' || !input.name.trim()) return 'O nome é obrigatório';
  if (input.name.trim().length > 120) return 'O nome deve ter no máximo 120 caracteres';
  if (typeof input.tenantName !== 'string' || !input.tenantName.trim()) return 'O nome da empresa é obrigatório';
  if (input.tenantName.trim().length > 160) return 'O nome da empresa deve ter no máximo 160 caracteres';
  if (typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return 'Introduza um endereço de email válido';
  }
  if (input.email.trim().length > 254) return 'O email deve ter no máximo 254 caracteres';
  if (typeof input.password !== 'string' || input.password.length < 8) {
    return 'A palavra-passe deve ter pelo menos 8 caracteres';
  }
  if (input.password.length > 128) return 'A palavra-passe deve ter no máximo 128 caracteres';
  if (input.marketingConsent !== undefined && typeof input.marketingConsent !== 'boolean') return 'A preferência de comunicações é inválida';
  return null;
}
