import { describe, it, expect } from 'vitest';
import { isRhReportKind, RH_REPORT_KINDS } from './rh-reports';
import { exportReport } from './report-export';
import type { ReportDataset } from './report-data';
import { parseReportPeriod } from './report-period';

describe('rh-reports isolation', () => {
  it('isRhReportKind aceita os 6 tipos correctos', () => {
    for (const kind of RH_REPORT_KINDS) {
      expect(isRhReportKind(kind)).toBe(true);
    }
    expect(isRhReportKind('stock_balances')).toBe(false);
    expect(isRhReportKind("'; DROP TABLE users; --")).toBe(false);
    expect(isRhReportKind('')).toBe(false);
  });

  it('RH_REPORT_KINDS tem exactamente os 6 relatórios aprovados', () => {
    expect(RH_REPORT_KINDS).toHaveLength(6);
    expect(new Set(RH_REPORT_KINDS).size).toBe(6);
  });
});

describe('rh export formats', () => {
  const period = parseReportPeriod({ period: 'thisMonth' });
  const dataset: ReportDataset = {
    kind: 'employees' as any,
    title: 'Relatório de Funcionários',
    company: { name: 'Empresa Teste Lda', nif: '500000001' },
    period,
    generatedAt: new Date(),
    filters: { customerId: null, state: null, warehouseId: null, productId: null },
    headers: ['Nº', 'Nome', 'Estado'],
    rows: [['001', 'Ana', 'ACTIVO'], ['002', 'Bruno', 'ACTIVO']],
    totals: ['Totais', '2 funcionários', ''],
  };

  it('exporta PDF não-vazio com Content-Type correcto', async () => {
    const file = await exportReport(dataset, 'pdf');
    expect(file.contentType).toBe('application/pdf');
    expect(file.filename.endsWith('.pdf')).toBe(true);
    expect(Buffer.isBuffer(file.body) || typeof file.body === 'string').toBe(true);
    expect((file.body as Buffer).length > 0).toBe(true);
  });

  it('exporta XLSX com magic number PK', async () => {
    const file = await exportReport(dataset, 'xlsx');
    expect(file.contentType).toContain('spreadsheet');
    expect(file.filename.endsWith('.xlsx')).toBe(true);
    const head = Buffer.isBuffer(file.body) ? (file.body as Buffer).subarray(0, 2) : Buffer.from(String(file.body), 'binary').subarray(0, 2);
    expect(head.toString('hex')).toBe('504b'); // PK
  });

  it('exporta CSV com BOM UTF-8 e cabeçalhos', async () => {
    const file = await exportReport(dataset, 'csv');
    expect(file.contentType).toContain('text/csv');
    const body = String(file.body);
    expect(body.charCodeAt(0)).toBe(0xfeff);
    expect(body).toContain('Nº;Nome;Estado');
    expect(body).toContain('Ana');
  });
});
