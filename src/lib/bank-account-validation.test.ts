import { describe, expect, it } from 'vitest';
import { validateBankAccountInput } from './bank-account-validation';

describe('validateBankAccountInput', () => {
  it('normalizes an account and enforces AOA', () => {
    expect(validateBankAccountInput({ bankName: ' BFA ', currency: 'AOA', isPrimary: true })).toMatchObject({ ok: true, value: { bankName: 'BFA', currency: 'AOA', isActive: true, isPrimary: true } });
  });
  it('rejects empty bank name, unsupported currencies and invalid flags', () => {
    expect(validateBankAccountInput({ bankName: '' }).ok).toBe(false);
    expect(validateBankAccountInput({ bankName: 'BFA', currency: 'USD' }).ok).toBe(false);
    expect(validateBankAccountInput({ bankName: 'BFA', isActive: 'true' }).ok).toBe(false);
  });
});
