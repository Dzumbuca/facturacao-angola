import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OfflineWorkspace } from './offline-workspace';

describe('offline workspace', () => {
  it('renders a draft-only workspace without invoice issuance controls', () => {
    const html = renderToStaticMarkup(<OfflineWorkspace />);
    expect(html).toContain('Área offline');
    expect(html).toContain('Guardar rascunho');
    expect(html).toContain('Dados disponíveis offline');
    expect(html).toContain('não são facturas fiscais emitidas');
    expect(html.toLowerCase()).not.toContain('emitir factura');
    expect(html.toLowerCase()).not.toContain('emitir agora');
  });
});
