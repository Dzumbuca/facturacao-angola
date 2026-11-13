import { it, expect } from 'vitest';
import { renderAssistantDocx } from './assistant-docx';
import { renderAssistantPdf } from './assistant-pdf';
import { writeFileSync } from 'fs';
import path from 'path';

const identity = {
  legalName: 'Marstore Comercial e Serviços, Lda',
  name: 'Marstore',
  nif: '500000001',
  address: 'Luanda, Município da Ingombota, Rua dos Conselheiros, 123',
  phone: '+244 923 000 000',
  email: 'geral@marstore.co.ao',
};

const body = `# Carta de Apresentação

Exmo. Senhor,

**Marstore Comercial e Serviços, Lda.**, com sede em Luanda, vem por este meio apresentar a proposta comercial para fornecimento de soluções de gestão empresarial às organizações angolanas.

## Âmbito dos serviços

- Auditoria inicial dos processos administrativos
- Implementação do sistema Machine Facturas
- Formação da equipa de facturação e stock
- Suporte e manutenção contínua durante 12 meses

## Proposta comercial

| Item | Prazo | Valor |
|---|---|---|
| Implementação | 30 dias | 150.000,00 Kz |
| Formação | 5 dias | 30.000,00 Kz |
| Suporte mensal | 12 meses | 25.000,00 Kz |

## Próximos passos

Solicitamos a vossa confirmação por escrito para agendarmos a reunião de validação.

Assinatura

Juntos no crescimento,

Joaquim Zumbuca, Administrador`;

it('writes preview artifacts to docs/ia-documents-preview', async () => {
  const dir = path.join(process.cwd(), 'docs', 'ia-documents-preview');
  const docx = await renderAssistantDocx({ title: 'Carta de Apresentação à Empresa XYZ', body, identity });
  writeFileSync(path.join(dir, 'carta-apresentacao.docx'), docx);
  const pdf = await renderAssistantPdf({ title: 'Carta de Apresentação à Empresa XYZ', body, identity });
  writeFileSync(path.join(dir, 'carta-apresentacao.pdf'), pdf);
  expect(docx.subarray(0, 2).toString()).toBe('PK');
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
});
