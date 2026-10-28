import { describe, expect, it } from 'vitest';
import { isValidNif, normalizeNif } from './nif';

describe('NIF angolano', () => {
  it('aceita o formato de 10 dígitos', () => {
    expect(isValidNif('5417089312')).toBe(true);
  });

  it('aceita o formato 9 dígitos + 2 letras + 3 dígitos', () => {
    expect(isValidNif('541708931LA123')).toBe(true);
  });

  it('rejeita formatos incompletos, letras mal colocadas e valores vazios', () => {
    expect(isValidNif('541708931')).toBe(false);
    expect(isValidNif('5417089312L')).toBe(false);
    expect(isValidNif('abcdefghij')).toBe(false);
    expect(isValidNif('')).toBe(false);
  });

  it('normaliza espaços e maiúsculas', () => {
    expect(normalizeNif(' 541708931la123 ')).toBe('541708931LA123');
    expect(normalizeNif(undefined)).toBe('');
    expect(normalizeNif(123)).toBe('');
  });
});
