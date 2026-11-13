import { describe, it, expect } from 'vitest';
import { DOCUMENT_TYPES, CATEGORIES, documentTypeById, buildInstruction } from './rh-ai-studio';

describe('rh-ai-studio catalogue', () => {
  it('has unique ids and valid categories', () => {
    const ids = DOCUMENT_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const type of DOCUMENT_TYPES) {
      expect(CATEGORIES.some((c) => c.value === type.category)).toBe(true);
      expect(type.fields.length).toBeGreaterThan(0);
      expect(type.fields.every((f) => f.placeholder && f.label)).toBe(true);
    }
  });

  it('every category is covered by at least one type', () => {
    const used = new Set(DOCUMENT_TYPES.map((t) => t.category));
    for (const cat of CATEGORIES) {
      if (cat.value === 'ADMINISTRATIVOS') continue;
      expect(used.has(cat.value)).toBe(true);
    }
  });

  it('buildInstruction includes real values and marks missing', () => {
    const type = documentTypeById('DECLARACAO_TRABALHO')!;
    const text = buildInstruction(type, {
      funcionarioNome: 'João Kaluana',
      cargo: 'Técnico Contabilidade',
      dataAdmissao: '02/01/2026',
      empresa: 'Marstore Lda',
      finalidade: 'empréstimo bancário',
    });
    expect(text).toContain('João Kaluana');
    expect(text).toContain('Técnico Contabilidade');
    expect(text).toContain('02/01/2026');
    expect(text).toContain('Marstore Lda');
    expect(text).toContain('não inventes');
    expect(text).toContain('[A PREENCHER');
  });
});
