/**
 * A10 — Excel export of accounting reports (Diário, Razão, Balancete)
 *
 * Real .xlsx generated with exceljs. Tenant-isolated at the route layer.
 */

import ExcelJS from 'exceljs';
import { prisma } from './prisma';

export type AccountingExportKind = 'diario' | 'razao' | 'balancete';

const esc = (v: unknown): string => String(v ?? '');

async function buildDiario(tenantId: string, tenantName: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = tenantName;
  wb.created = new Date();
  const sh = wb.addWorksheet('Diário', { views: [{ state: 'frozen', ySplit: 6 }] });
  sh.addRow([tenantName]);
  sh.addRow(['Diário contabilístico']);
  sh.addRow([`Gerado em: ${new Date().toLocaleString('pt-AO')}`]);
  sh.addRow([]);
  const hdr = sh.addRow(['Data', 'Lançamento', 'Descrição', 'Débito', 'Crédito', 'Origem']);
  hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021F87' } };
  const entries = await prisma.journalEntry.findMany({
    where: { tenantId },
    orderBy: [{ postedOnDate: 'desc' }, { number: 'desc' }],
    take: 1000,
    include: { lines: true },
  });
  for (const e of entries) {
    const debit = e.lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
    const credit = e.lines.reduce((s: number, l: any) => s + Number(l.credit), 0);
    sh.addRow([e.postedOnDate.toISOString().slice(0, 10), e.number, e.description, debit, credit, esc(e.source)]);
  }
  sh.columns = [
    { key: 'd', width: 12 }, { key: 'n', width: 16 }, { key: 'desc', width: 60 },
    { key: 'dr', width: 16, style: { numFmt: '#,##0.00' } }, { key: 'cr', width: 16, style: { numFmt: '#,##0.00' } }, { key: 'src', width: 14 },
  ];
  sh.autoFilter = { from: { row: 6, column: 1 }, to: { row: 5 + entries.length, column: 6 } };
  return wb.xlsx.writeBuffer();
}

async function buildRazao(tenantId: string, tenantName: string, accountCode: string | null) {
  const wb = new ExcelJS.Workbook();
  wb.creator = tenantName;
  const sh = wb.addWorksheet('Razão', { views: [{ state: 'frozen', ySplit: 6 }] });
  sh.addRow([tenantName]);
  sh.addRow(['Razão por conta']);
  sh.addRow([`Gerado em: ${new Date().toLocaleString('pt-AO')}`]);
  sh.addRow([]);
  const hdr = sh.addRow(['Conta', 'Nome', 'Data', 'Lançamento', 'Descrição', 'Débito', 'Crédito', 'Saldo']);
  hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021F87' } };
  const accounts = accountCode
    ? await prisma.glAccount.findMany({ where: { tenantId, code: accountCode }, select: { id: true, code: true, name: true } })
    : await prisma.glAccount.findMany({ where: { tenantId, isActive: true }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } });
  let rowTotal = 6;
  for (const acc of accounts) {
    const lines = await prisma.journalEntryLine.findMany({
      where: { tenantId, accountId: acc.id },
      orderBy: { entry: { postedOnDate: 'asc' } },
      include: { entry: { select: { number: true, postedOnDate: true, description: true } } },
    });
    let running = 0;
    for (const l of lines) {
      running = Math.round((running + Number(l.debit) - Number(l.credit)) * 100) / 100;
      sh.addRow([acc.code, acc.name, (l as any).entry.postedOnDate.toISOString().slice(0, 10), (l as any).entry.number, (l as any).entry.description, Number(l.debit), Number(l.credit), running]);
      rowTotal++;
    }
  }
  sh.columns = [
    { key: 'c', width: 8 }, { key: 'n', width: 40 }, { key: 'd', width: 12 }, { key: 'num', width: 16 }, { key: 'desc', width: 46 },
    { key: 'dr', width: 16, style: { numFmt: '#,##0.00' } }, { key: 'cr', width: 16, style: { numFmt: '#,##0.00' } }, { key: 's', width: 16, style: { numFmt: '#,##0.00' } },
  ];
  sh.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(6, rowTotal - 1), column: 8 } };
  return wb.xlsx.writeBuffer();
}

async function buildBalancete(tenantId: string, tenantName: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = tenantName;
  const sh = wb.addWorksheet('Balancete', { views: [{ state: 'frozen', ySplit: 6 }] });
  sh.addRow([tenantName]);
  sh.addRow(['Balancete']);
  sh.addRow([`Gerado em: ${new Date().toLocaleString('pt-AO')}`]);
  sh.addRow([]);
  const hdr = sh.addRow(['Conta', 'Nome', 'Débito', 'Crédito', 'Saldo']);
  hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021F87' } };
  const accounts = await prisma.glAccount.findMany({ where: { tenantId, isActive: true }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } });
  const grouped = await prisma.journalEntryLine.groupBy({ by: ['accountId'], where: { tenantId }, _sum: { debit: true, credit: true } });
  const idMap = new Map(grouped.map((g: any) => [g.accountId, { debit: Number(g._sum.debit ?? 0), credit: Number(g._sum.credit ?? 0) }]));
  for (const a of accounts) {
    const sum = (idMap.get(a.id) ?? { debit: 0, credit: 0 }) as { debit: number; credit: number };
    sh.addRow([a.code, a.name, sum.debit, sum.credit, sum.debit - sum.credit]);
  }
  sh.columns = [
    { key: 'c', width: 8 }, { key: 'n', width: 50 },
    { key: 'dr', width: 18, style: { numFmt: '#,##0.00' } }, { key: 'cr', width: 18, style: { numFmt: '#,##0.00' } }, { key: 's', width: 18, style: { numFmt: '#,##0.00' } },
  ];
  sh.autoFilter = { from: { row: 6, column: 1 }, to: { row: 5 + accounts.length, column: 5 } };
  return wb.xlsx.writeBuffer();
}

export async function generateAccountingExport(kind: AccountingExportKind, tenantId: string, tenantName: string, accountCode: string | null): Promise<Buffer> {
  let buffer: any;
  if (kind === 'diario') buffer = await buildDiario(tenantId, tenantName);
  else if (kind === 'razao') buffer = await buildRazao(tenantId, tenantName, accountCode);
  else if (kind === 'balancete') buffer = await buildBalancete(tenantId, tenantName);
  else throw new Error('unknown_kind');
  return Buffer.from(buffer as ArrayBuffer);
}
