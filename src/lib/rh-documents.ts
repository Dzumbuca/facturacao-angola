import 'server-only';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';

export const DOCUMENT_TYPES = ['CONTRATO', 'DECLARACAO_TRABALHO', 'DECLARACAO_RENDIMENTOS', 'DECLARACAO_FERIAS', 'OUTRO'] as const;
export type RhDocumentTypeValue = (typeof DOCUMENT_TYPES)[number];

export function renderTemplate(body: string, variables: Record<string, string>): string {
  let output = body;
  for (const [key, value] of Object.entries(variables)) {
    output = output.split(key).join(value);
  }
  return output;
}

export function documentVariables(
  tenant: { name: string; nif: string | null },
  employee: {
    firstName: string; lastName: string; bi: string | null; hireDate: Date; baseSalary: unknown;
    position?: { title: string } | null; department?: { name: string } | null;
  } | null,
): Record<string, string> {
  const salary = employee ? Number(employee.baseSalary) : 0;
  return {
    '{{empresa_nome}}': tenant.name,
    '{{empresa_nif}}': tenant.nif ?? '',
    '{{funcionario_nome}}': employee ? `${employee.firstName} ${employee.lastName}` : '',
    '{{funcionario_bi}}': employee?.bi ?? '',
    '{{cargo}}': employee?.position?.title ?? '',
    '{{departamento}}': employee?.department?.name ?? '',
    '{{salario_base}}': new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(salary),
    '{{data_inicio}}': employee ? new Date(employee.hireDate).toLocaleDateString('pt-AO') : '',
    '{{data_fim}}': '',
  };
}

export function contentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function renderPdf(input: { title: string; content: string; status: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text(input.title, { align: 'center' });
      doc.moveDown(1.5);
      doc.fontSize(10).fillColor('#1c2d3f').text(input.content, { align: 'justify', lineGap: 3 });
      if (input.status !== 'EMITIDO') {
        doc.moveDown(1.5);
        doc.fontSize(10).fillColor('#b45309').text('RASCUNHO — documento não emitido. Requer validação humana antes da emissão.', { align: 'center' });
      }
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
