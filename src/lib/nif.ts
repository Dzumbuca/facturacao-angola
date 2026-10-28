// Formato do NIF angolano: 10 dígitos (pessoa singular/empresa antiga) ou
// 9 dígitos + 2 letras + 3 dígitos (formato actual da AGT). Partilhado por
// facturas, perfil da empresa e onboarding para evitar duplicação de regras.
export const isValidNif = (nif: string) => /^\d{10}$/.test(nif) || /^\d{9}[A-Z]{2}\d{3}$/.test(nif);

// Normaliza entrada de utilizador para comparação/armazenamento.
export const normalizeNif = (value: unknown) =>
  typeof value === 'string' ? value.trim().toUpperCase() : '';
