import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { exportReport } from './report-export';
import type { ReportDataset } from './report-data';

const dataset: ReportDataset = {
  kind: 'invoices', title: 'Relatório de facturação', company: { name: 'Empresa A', nif: '123' },
  period: { key: 'thisMonth', start: new Date('2026-10-01T00:00:00Z'), endExclusive: new Date('2026-11-01T00:00:00Z'), timeZone: 'Africa/Luanda' },
  generatedAt: new Date('2026-10-19T12:00:00Z'), filters: { customerId: null, state: null },
  headers: ['Documento', 'Total (AOA)'], rows: [['=1+1', 100.5]], totals: ['TOTAL', 100.5],
};

describe('exportReport', () => {
  it('creates CSV with context, escaping and spreadsheet formula protection', async () => {
    const result = await exportReport(dataset, 'csv');
    expect(result.contentType).toContain('text/csv');
    expect(String(result.body)).toContain('\uFEFF');
    expect(String(result.body)).toContain("'=1+1");
    expect(String(result.body)).toContain('Empresa A');
  });
  it('creates a valid XLSX workbook with the same columns and data', async () => {
    const result = await exportReport(dataset, 'xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.body as any);
    const sheet = workbook.getWorksheet('Relatório');
    expect(sheet?.getCell('A3').value).toBe(dataset.title);
    expect(sheet?.getCell('A8').value).toBe('Documento');
    expect(sheet?.getCell('A9').value).toBe("'=1+1");
    expect(sheet?.getCell('B9').value).toBe(100.5);
    expect(sheet?.getCell('A10').value).toBe('TOTAL');
  });
  it('creates a readable PDF document', async () => {
    const result = await exportReport(dataset, 'pdf');
    expect(result.contentType).toBe('application/pdf');
    expect((result.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });
});
