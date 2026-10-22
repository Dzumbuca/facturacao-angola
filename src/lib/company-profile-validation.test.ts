import { describe, expect, it } from 'vitest';
import { validateCompanyProfileInput } from './company-profile-validation';

const form = (values: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };

describe('validateCompanyProfileInput', () => {
  it('keeps legacy fields and supplies supported profile preference defaults', async () => {
    const result = await validateCompanyProfileInput(form({ name: 'Empresa', bankName: 'Banco antigo' }));
    expect(result.isValid).toBe(true);
    expect(result.value).toMatchObject({ name: 'Empresa', bankName: 'Banco antigo', defaultCurrency: 'AOA', documentLanguage: 'pt-AO', defaultPaymentDays: null });
  });
  it('validates visual identity and payment preferences', async () => {
    expect((await validateCompanyProfileInput(form({ name: 'Empresa', brandColor: '#126abc', defaultPaymentDays: '30', defaultPaymentMethod: 'CASH' }))).isValid).toBe(true);
    expect((await validateCompanyProfileInput(form({ name: 'Empresa', brandColor: 'blue' }))).isValid).toBe(false);
    expect((await validateCompanyProfileInput(form({ name: 'Empresa', defaultCurrency: 'USD' }))).isValid).toBe(false);
    expect((await validateCompanyProfileInput(form({ name: 'Empresa', defaultPaymentDays: '-2' }))).isValid).toBe(false);
  });
});
