export type BankAccountInput = { bankName: string; accountHolder: string | null; iban: string | null; currency: 'AOA'; label: string | null; isActive: boolean; isPrimary: boolean };

export function validateBankAccountInput(input: unknown): { ok: true; value: BankAccountInput } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Dados inválidos.' };
  const data = input as Record<string, unknown>;
  const bankName = typeof data.bankName === 'string' ? data.bankName.trim() : '';
  const accountHolder = typeof data.accountHolder === 'string' ? data.accountHolder.trim() || null : null;
  const iban = typeof data.iban === 'string' ? data.iban.replace(/\s+/g, '').toUpperCase() || null : null;
  const label = typeof data.label === 'string' ? data.label.trim() || null : null;
  if (!bankName || bankName.length > 120 || (accountHolder?.length ?? 0) > 160 || (iban?.length ?? 0) > 34 || (label?.length ?? 0) > 80) return { ok: false, error: 'Verifica o banco, titular, IBAN e nome da conta.' };
  if (data.currency !== undefined && data.currency !== 'AOA') return { ok: false, error: 'A moeda suportada é AOA.' };
  if (data.isActive !== undefined && typeof data.isActive !== 'boolean') return { ok: false, error: 'O estado activo é inválido.' };
  if (data.isPrimary !== undefined && typeof data.isPrimary !== 'boolean') return { ok: false, error: 'A conta principal é inválida.' };
  const isActive = data.isActive !== false;
  return { ok: true, value: { bankName, accountHolder, iban, currency: 'AOA', label, isActive, isPrimary: isActive && data.isPrimary === true } };
}
