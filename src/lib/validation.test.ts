import { describe, it, expect } from 'vitest';
import { validateAngolanNIF } from './validation';

describe('Validation Logic', () => {
  it('should validate correct Angolan NIF format', () => {
    // Regex in validation.ts is /^[0-9]{9}[A-Z]{2}[0-9]{3}$/
    // Example matching: 123456789LA000
    const validNIF = '123456789LA000';
    expect(validateAngolanNIF(validNIF)).toBe(true);
  });

  it('should reject incorrect Angolan NIF format', () => {
    const invalidNIF = '123456';
    expect(validateAngolanNIF(invalidNIF)).toBe(false);
  });
});