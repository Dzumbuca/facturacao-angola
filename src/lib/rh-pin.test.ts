import { describe, it, expect } from 'vitest';
import { pinLookup, generatePin, isValidPinFormat } from './rh-pin';

describe('rh-pin', () => {
  it('generatePin devolve exactamente 6 dígitos', () => {
    for (let i = 0; i < 200; i += 1) {
      const pin = generatePin();
      expect(pin).toMatch(/^\d{6}$/);
      expect(Number(pin)).toBeGreaterThanOrEqual(0);
      expect(Number(pin)).toBeLessThanOrEqual(999999);
    }
  });

  it('generatePin produz PINs diferentes', () => {
    const pins = new Set<string>();
    for (let i = 0; i < 100; i += 1) pins.add(generatePin());
    expect(pins.size).toBeGreaterThan(50);
  });

  it('isValidPinFormat aceita 6 dígitos e rejeita o resto', () => {
    expect(isValidPinFormat('123456')).toBe(true);
    expect(isValidPinFormat('000000')).toBe(true);
    expect(isValidPinFormat('12345')).toBe(false);
    expect(isValidPinFormat('1234567')).toBe(false);
    expect(isValidPinFormat('abcdef')).toBe(false);
    expect(isValidPinFormat('')).toBe(false);
    expect(isValidPinFormat('12 34')).toBe(false);
  });

  it('pinLookup é determinístico para o mesmo PIN', () => {
    expect(pinLookup('123456')).toBe(pinLookup('123456'));
    expect(pinLookup('123456')).not.toBe(pinLookup('654321'));
  });

  it('pinLookup nunca devolve o PIN em texto', () => {
    expect(pinLookup('123456')).not.toContain('123456');
  });

  it('pinLookup é hex SHA-256 (64 chars)', () => {
    expect(pinLookup('123456')).toMatch(/^[a-f0-9]{64}$/);
  });
});
