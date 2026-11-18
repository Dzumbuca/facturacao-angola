const tenantId = process.argv[2];
const count = Number(process.argv[3]);
const url = process.env.DATABASE_URL;
const { issueInvoice } = await import('./src/lib/invoice-service.ts');

if (!url) {
  console.error('DATABASE_URL required');
  process.exit(2);
}

let ok = 0, fail = 0;
const started = Date.now();
for (let i = 0; i < count; i++) {
  try {
    const r = await issueInvoice({
      customerName: 'Multi' + process.pid, customerNif: '5000000001',
      items: [{ productId: tenantId + '-p', desc: 'i', qty: 1, rate: 200 + i }],
      applyVat: true, discountType: 'amount', discountValue: 0,
      observations: null, includeCompanyProfile: false, dueAt: null,
    }, tenantId);
    ok++;
    if (i % 5 === 0) console.log(`[${process.pid}] ${i}: ${ok} ok`);
  } catch (e) {
    fail++;
    const msg = String((e && e.message) || e);
    console.log(`[${process.pid}] FAIL ${i}: ${msg.slice(0, 80)}`);
  }
}
const elapsed = Date.now() - started;
console.log(`PROCESS ${process.pid}: done ok=${ok}/${count} fail=${fail} elapsed=${elapsed}ms`);
process.exit(0);
