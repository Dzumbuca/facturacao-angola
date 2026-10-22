import { describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { generateInvoicePDF } from './pdf-generator';

const customer = { name: 'Cliente de Teste', nif: null, address: null, email: null };
const company = {
  name: 'BlackMachine Serviços, Lda.',
  legalName: null,
  nif: '5000000000',
  address: 'Luanda, Angola',
  municipality: 'Luanda',
  province: 'Luanda',
  country: 'Angola',
  phone: '+244 900 000 000',
  email: 'financeiro@example.test',
  website: null,
  bankName: 'Banco de Teste',
  bankAccountName: 'BlackMachine Serviços, Lda.',
  iban: 'AO06000000000000000000000',
  invoiceFooter: 'Obrigado pela preferência.',
  brandColor: '#021F87',
};

function pdfPageCount(pdf: Buffer) {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page(?=\s|\/|>)/g) ?? []).length;
}

async function savePreview(name: string, pdf: Buffer) {
  const directory = process.env.INVOICE_PDF_PREVIEW_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, name), pdf);
}

function makePng(width = 160, height = 60) {
  const crc32 = (buffer: Buffer) => {
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const name = Buffer.from(type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([length, name, data, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4);
    pixels[row] = 0;
    for (let x = 0; x < width; x++) {
      const offset = row + 1 + x * 4;
      pixels[offset] = 2;
      pixels[offset + 1] = 31;
      pixels[offset + 2] = 135;
      pixels[offset + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('generateInvoicePDF', () => {
  it('creates a one-page invoice with Portuguese text and optional customer fields omitted', async () => {
    const pdf = await generateInvoicePDF({
      type: 'FT', number: 'FT 2026/0001', issuedAt: new Date('2026-10-20T10:00:00Z'), dueAt: new Date('2026-10-30T10:00:00Z'),
      currency: 'AOA', includeCompanyProfile: true, companyProfileSnapshot: company, companyLogo: null,
      customer, items: [{ desc: 'Prestação de serviços de gestão financeira', qty: 1, rate: 100000, taxRate: 14, total: 100000 }],
      subTotal: 100000, discountAmount: 0, taxTotal: 14000, total: 114000, applyVat: true,
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdfPageCount(pdf)).toBe(1);
    expect(pdf.toString('latin1')).toContain('/ToUnicode');
    await savePreview('invoice-simple.pdf', pdf);
  });

  it('paginates many long item descriptions without losing pages', async () => {
    const pdf = await generateInvoicePDF({
      type: 'FT', number: 'FT 2026/0002', issuedAt: new Date('2026-10-20T10:00:00Z'), currency: 'AOA',
      includeCompanyProfile: false, customer, applyVat: false,
      items: Array.from({ length: 38 }, (_, index) => ({
        desc: `Serviço ${index + 1}: ${'Descrição detalhada para documentação financeira e prestação de serviços. '.repeat(3)}`,
        qty: 2, rate: 125000, taxRate: 0, total: 250000,
      })),
      subTotal: 9500000, discountAmount: 0, taxTotal: 0, total: 9500000,
    });

    expect(pdfPageCount(pdf)).toBeGreaterThan(1);
    expect(pdfPageCount(pdf)).toBeLessThanOrEqual(6);
    await savePreview('invoice-many-items.pdf', pdf);
  });

  it('includes discount, varied tax rates, confirmed and pending payments, bank details, a logo and long observations', async () => {
    const pdf = await generateInvoicePDF({
      type: 'FT', number: 'FT 2026/0003', issuedAt: new Date('2026-10-20T10:00:00Z'), dueAt: new Date('2026-10-30T10:00:00Z'),
      currency: 'AOA', includeCompanyProfile: true, companyProfileSnapshot: company,
      companyLogo: { mimeType: 'image/png', content: makePng() },
      customer: { name: 'Sociedade de Comércio e Distribuição de Angola, S.A.', nif: '5412345678', address: 'Rua da Liberdade, n.º 10, Luanda', email: null },
      items: [
        { desc: 'Equipamento informático - descrição com caracteres portugueses: acção, gestão, facturação e manutenção.', qty: 3, rate: 2500000, taxRate: 14, total: 7500000 },
        { desc: 'Serviço isento', qty: 1, rate: 1500000, taxRate: 0, total: 1500000 },
      ],
      subTotal: 9000000, discountAmount: 500000, taxTotal: 1050000, total: 9550000, applyVat: true,
      observations: `Observações extensas com acentuação portuguesa: á, é, í, ó, ú, â, ê, ô e ç. ${'Condições comerciais registadas no documento. '.repeat(35)}`,
      payments: [
        { amount: 1000000, method: 'BANK_TRANSFER', status: 'CONFIRMED', paymentDate: new Date('2026-10-21T10:00:00Z'), reference: 'TRF-001' },
        { amount: 250000, method: 'MULTICAIXA_EXPRESS', status: 'PENDING', paymentDate: new Date('2026-10-22T10:00:00Z'), reference: null },
      ],
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdfPageCount(pdf)).toBeGreaterThan(1);
    await savePreview('invoice-payment-observations.pdf', pdf);
  });

  it('renders a credit note with its original document and cancellation reason', async () => {
    const pdf = await generateInvoicePDF({
      type: 'NC', number: 'NC 2026/0001', refInvoiceNumber: 'FT 2026/0008',
      cancelReason: 'Devolução integral dos artigos facturados.', issuedAt: new Date('2026-10-20T10:00:00Z'),
      currency: 'AOA', includeCompanyProfile: false, customer,
      items: [{ desc: '[Estorno] Equipamento', qty: 1, rate: 50000, taxRate: 14, total: 50000 }],
      subTotal: 50000, discountAmount: 0, taxTotal: 7000, total: 57000, applyVat: true,
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdfPageCount(pdf)).toBe(1);
    await savePreview('credit-note.pdf', pdf);
  });
});
