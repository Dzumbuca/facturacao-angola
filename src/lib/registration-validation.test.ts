import { describe, expect, it } from 'vitest';
import { validateRegistration } from './registration-validation';

const validInput = {
  name: 'Ana Silva',
  tenantName: 'Empresa de Teste',
  email: 'ana@example.com',
  password: 'palavra123',
};

describe('validateRegistration', () => {
  it('accepts complete registration details', () => {
    expect(validateRegistration(validInput)).toBeNull();
  });

  it.each([
    [{ ...validInput, name: '  ' }, 'O nome é obrigatório'],
    [{ ...validInput, tenantName: '' }, 'O nome da empresa é obrigatório'],
    [{ ...validInput, email: 'invalido' }, 'Introduza um endereço de email válido'],
    [{ ...validInput, password: 'curta' }, 'A palavra-passe deve ter pelo menos 8 caracteres'],
    [{ ...validInput, password: 'x'.repeat(129) }, 'A palavra-passe deve ter no máximo 128 caracteres'],
    [{ ...validInput, email: `${'x'.repeat(250)}@test.com` }, 'O email deve ter no máximo 254 caracteres'],
  ])('rejects invalid fields', (input, message) => {
    expect(validateRegistration(input)).toBe(message);
  });
});
