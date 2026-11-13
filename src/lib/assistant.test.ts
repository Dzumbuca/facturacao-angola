import { describe, expect, it } from 'vitest';
import { offlineAnswer, moduleForPath, suggestionsForPath, detectDocumentIntent, parseModelReply } from './assistant';

describe('assistant knowledge', () => {
  it('resolve o módulo pela página actual', () => {
    expect(moduleForPath('/invoices/new')?.title).toBe('Facturas');
    expect(moduleForPath('/rh/funcionarios')?.path).toBe('/rh/dashboard');
    expect(moduleForPath('/produtos')?.title).toBe('Produtos e serviços');
  });

  it('devolve sugestões adequadas à página', () => {
    expect(suggestionsForPath('/invoices').length).toBeGreaterThan(0);
    expect(suggestionsForPath('/rh/funcionarios')[0].prompt).toContain('funcionário');
  });

  it('responde em modo offline a perguntas frequentes', () => {
    expect(offlineAnswer('Como emitir uma factura?', '/')?.href).toBe('/invoices/new');
    expect(offlineAnswer('Como cadastrar um funcionário?', '/rh/funcionarios')?.href).toBe('/rh/funcionarios');
    expect(offlineAnswer('Como registar um pagamento?', '/invoices')?.href).toBe('/invoices');
  });
});

describe('assistant document intent and parsing', () => {
  it('detecta pedido de documento', () => {
    expect(detectDocumentIntent('Cria uma carta comercial para o cliente')).toBe(true);
    expect(detectDocumentIntent('Quero um memorando sobre a reunião')).toBe(true);
    expect(detectDocumentIntent('Como emitir uma factura?')).toBe(false);
  });

  it('interpreta resposta estruturada do modelo', () => {
    const raw = '{"reply":"Use Facturas.","actions":[{"label":"Abrir Facturas","href":"/invoices"}],"document":null}';
    const parsed = parseModelReply(raw);
    expect(parsed.text).toBe('Use Facturas.');
    expect(parsed.actions[0]).toEqual({ label: 'Abrir Facturas', href: '/invoices' });
  });

  it('aceita documento estruturado', () => {
    const raw = '{"reply":"Documento pronto.","actions":[],"document":{"title":"Carta","body":"Exmo. Senhor..."}}';
    const parsed = parseModelReply(raw);
    expect(parsed.document?.title).toBe('Carta');
    expect(parsed.document?.body).toContain('Exmo.');
  });

  it('degrada para texto simples se o modelo ignorar o formato', () => {
    const parsed = parseModelReply('Para emitir uma factura vá a /invoices e clique em Emitir.');
    expect(parsed.text).toContain('factura');
    expect(parsed.document).toBeNull();
  });
});
