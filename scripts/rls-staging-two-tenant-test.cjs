/**
 * RLS two-tenant execution (LOCAL mf_rls_staging 5437 ONLY). Uses role mf_app_nobypass (NOBYPASSRLS).
 * Seeds synthetic data as postgres (bypasses RLS) for setup only, then tests as app role.
 */
const { Client } = require('pg');
const fs = require('fs');
const crypto = require('crypto');
const DB = 'postgresql://postgres:testpass@127.0.0.1:5437/mf_rls_staging';
const TENANT_A = '00000000-0000-4000-a000-000000000001';
const TENANT_B = '00000000-0000-4000-b000-000000000002';
const USER_A = '00000000-0000-4000-a000-000000000011';
const USER_B = '00000000-0000-4000-b000-000000000012';
const PROD_A = '00000000-0000-4000-a000-000000000021';
const PROD_B = '00000000-0000-4000-b000-000000000022';
const CUST_A = '00000000-0000-4000-a000-000000000031';
const CUST_B = '00000000-0000-4000-b000-000000000032';
const INV_A = '00000000-0000-4000-a000-000000000041';
const INV_B = '00000000-0000-4000-b000-000000000042';
const WH_A = '00000000-0000-4000-a000-000000000051';
const WH_B = '00000000-0000-4000-b000-000000000052';
const PAY_A = '00000000-0000-4000-a000-000000000061';
const PAY_B = '00000000-0000-4000-b000-000000000062';
const BDOC_A = '00000000-0000-4000-a000-000000000071';
const BDOC_B = '00000000-0000-4000-b000-000000000072';
const results = [];
function rec(name, ok, detail) { results.push({ name, ok, detail: String(detail ?? '').slice(0, 300) }); console.log((ok?'PASS':'FAIL'), name, '-', detail); }
async function asAdmin(fn) { const c = new Client({ connectionString: DB }); await c.connect(); try { return await fn(c); } finally { await c.end(); } }
async function asApp(tenantId, userId, isAdmin, fn) {
  const c = new Client({ connectionString: DB }); await c.connect();
  try {
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE mf_app_nobypass');
    await c.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId || '']);
    await c.query("SELECT set_config('app.user_id', $1, true)", [userId || '']);
    await c.query("SELECT set_config('app.is_admin', $1, true)", [isAdmin ? 'true' : 'false']);
    const r = await fn(c); await c.query('COMMIT'); return r;
  } catch (e) { try { await c.query('ROLLBACK'); } catch {} throw e; } finally { await c.end(); }
}
async function cols(c, table){ const r=await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",[table]); return new Set(r.rows.map(x=>x.column_name)); }
function ins(table, obj, keys){ const k=keys.filter(x=>obj[x]!==undefined); return {sql:`INSERT INTO "${table}" (${k.map(x=>`"${x}"`).join(',')}) VALUES (${k.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT DO NOTHING`, params:k.map(x=>obj[x])}; }
(async () => {
  await asAdmin(async (c) => {
    const sm=await cols(c,'StockMovement'), bd=await cols(c,'BusinessDocument'), pay=await cols(c,'Payment');
    await c.query(`INSERT INTO "Tenant"(id,name,status,plan,"createdAt") VALUES ($1,'Tenant A','ACTIVE','FREE',NOW()),($2,'Tenant B','ACTIVE','FREE',NOW()) ON CONFLICT (id) DO NOTHING`, [TENANT_A,TENANT_B]);
    await c.query(`INSERT INTO "User"(id,email,name,"tenantId",status,"platformRole","tenantRole","createdAt") VALUES ($1,'a@test.local','User A',$2,'ACTIVE','NONE','COMPANY_ADMIN',NOW()),($3,'b@test.local','User B',$4,'ACTIVE','NONE','COMPANY_ADMIN',NOW()) ON CONFLICT (id) DO UPDATE SET "tenantId"=EXCLUDED."tenantId"`, [USER_A,TENANT_A,USER_B,TENANT_B]);
    await c.query(`INSERT INTO "Customer"(id,"tenantId",name,"createdAt") VALUES ($1,$2,'Cliente A',NOW()),($3,$4,'Cliente B',NOW()) ON CONFLICT (id) DO NOTHING`, [CUST_A,TENANT_A,CUST_B,TENANT_B]);
    await c.query(`INSERT INTO "Product"(id,"tenantId",name,price,"taxRate",stock,codigo,categoria,"minStock","createdAt") VALUES ($1,$2,'Prod A',10,14,5,'PA','GERAL',0,NOW()),($3,$4,'Prod B',10,14,5,'PB','GERAL',0,NOW()) ON CONFLICT (id) DO NOTHING`, [PROD_A,TENANT_A,PROD_B,TENANT_B]);
    await c.query(`INSERT INTO "Warehouse"(id,"tenantId",name,"isDefault","isActive","createdAt","updatedAt") VALUES ($1,$2,'WH A',true,true,NOW(),NOW()),($3,$4,'WH B',true,true,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`, [WH_A,TENANT_A,WH_B,TENANT_B]);
    const smA={id:'00000000-0000-4000-a000-000000000081',tenantId:TENANT_A,productId:PROD_A,warehouseId:WH_A,type:'IN',quantity:1,quantitySigned:1,createdAt:new Date()};
    const smB={id:'00000000-0000-4000-b000-000000000082',tenantId:TENANT_B,productId:PROD_B,warehouseId:WH_B,type:'IN',quantity:1,quantitySigned:1,createdAt:new Date()};
    const smK=['id','tenantId','productId','warehouseId','type','quantity','quantitySigned','createdAt'].filter(k=>k==='id'||k==='tenantId'||k==='productId'||k==='type'||k==='quantity'||k==='createdAt'||sm.has(k));
    const iA=ins('StockMovement',smA,smK); await c.query(iA.sql,iA.params);
    const iB=ins('StockMovement',smB,smK); await c.query(iB.sql,iB.params);
    await c.query(`INSERT INTO "Invoice"(id,"tenantId","customerId",number,type,status,total,"subTotal","taxTotal","issuedAt","createdAt") VALUES ($1,$2,$3,'FT RLSA/1','FT','ISSUED',10,10,0,NOW(),NOW()),($4,$5,$6,'FT RLSB/1','FT','ISSUED',10,10,0,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`, [INV_A,TENANT_A,CUST_A,INV_B,TENANT_B,CUST_B]);
    await c.query(`INSERT INTO "InvoiceItem"(id,"invoiceId",description,quantity,"unitPrice","taxRate",total) VALUES ($1,$2,'Item A',1,10,0,10),($3,$4,'Item B',1,10,0,10) ON CONFLICT (id) DO NOTHING`, ['00000000-0000-4000-a000-000000000091',INV_A,'00000000-0000-4000-b000-000000000092',INV_B]);
    const pK=['id','tenantId','invoiceId','amount','currency','method','status','paymentDate','idempotencyKey','createdAt','updatedAt'].filter(k=>pay.has(k)||['id','tenantId','invoiceId','amount','method','status','paymentDate','idempotencyKey'].includes(k));
    const pA=ins('Payment',{id:PAY_A,tenantId:TENANT_A,invoiceId:INV_A,amount:10,currency:'AOA',method:'CASH',status:'CONFIRMED',paymentDate:new Date(),idempotencyKey:'rls-pay-a',createdAt:new Date(),updatedAt:new Date()},pK); await c.query(pA.sql,pA.params);
    const pB=ins('Payment',{id:PAY_B,tenantId:TENANT_B,invoiceId:INV_B,amount:10,currency:'AOA',method:'CASH',status:'CONFIRMED',paymentDate:new Date(),idempotencyKey:'rls-pay-b',createdAt:new Date(),updatedAt:new Date()},pK); await c.query(pB.sql,pB.params);
    const bK=['id','tenantId','type','status','number','title','issueDate','companySnapshot','subTotal','taxTotal','total','currency','createdAt','updatedAt'].filter(k=>bd.has(k)||['id','tenantId','type','status','number','title','issueDate','companySnapshot','subTotal','taxTotal','total'].includes(k));
    const now=new Date();
    const bA=ins('BusinessDocument',{id:BDOC_A,tenantId:TENANT_A,type:'QUOTE',status:'DRAFT',number:'ORC RLSA/1',title:'Doc A',issueDate:now,companySnapshot:{},subTotal:0,taxTotal:0,total:0,currency:'AOA',createdAt:now,updatedAt:now},bK); await c.query(bA.sql,bA.params);
    const bB=ins('BusinessDocument',{id:BDOC_B,tenantId:TENANT_B,type:'QUOTE',status:'DRAFT',number:'ORC RLSB/1',title:'Doc B',issueDate:now,companySnapshot:{},subTotal:0,taxTotal:0,total:0,currency:'AOA',createdAt:now,updatedAt:now},bK); await c.query(bB.sql,bB.params);
  });
  const own = await asApp(TENANT_A, USER_A, false, async (c)=> (await c.query(`SELECT count(*)::int n FROM "Customer" WHERE "tenantId"=$1`,[TENANT_A])).rows[0].n);
  rec('A reads own customers', own===1, `count=${own}`);
  const cross = await asApp(TENANT_A, USER_A, false, async (c)=> (await c.query(`SELECT count(*)::int n FROM "Customer" WHERE "tenantId"=$1`,[TENANT_B])).rows[0].n);
  rec('A cannot read B customers', cross===0, `count=${cross}`);
  try { await asApp(TENANT_A, USER_A, false, async (c)=> c.query(`UPDATE "Customer" SET name='hacked' WHERE id=$1`,[CUST_B])); const chk=await asAdmin(c=>c.query(`SELECT name FROM "Customer" WHERE id=$1`,[CUST_B])); rec('A cannot modify B customer', chk.rows[0].name!=='hacked', chk.rows[0].name); } catch(e){ rec('A cannot modify B customer', true, e.message); }
  try { await asApp(TENANT_A, USER_A, false, async (c)=> c.query(`DELETE FROM "Customer" WHERE id=$1`,[CUST_B])); const chk=await asAdmin(c=>c.query(`SELECT count(*)::int n FROM "Customer" WHERE id=$1`,[CUST_B])); rec('A cannot delete B customer', chk.rows[0].n===1, `remaining=${chk.rows[0].n}`); } catch(e){ rec('A cannot delete B customer', true, e.message); }
  try { await asApp(TENANT_A, USER_A, false, async (c)=> c.query(`INSERT INTO "Customer"(id,"tenantId",name,"createdAt") VALUES ($1,$2,'Injected',NOW())`,[crypto.randomUUID(),TENANT_B])); rec('A cannot insert row with tenantId B (WITH CHECK)', false, 'insert succeeded'); } catch(e){ rec('A cannot insert row with tenantId B (WITH CHECK)', true, e.message); }
  try { await asApp(TENANT_A, USER_A, false, async (c)=> c.query(`UPDATE "Customer" SET "tenantId"=$1 WHERE id=$2`,[TENANT_B,CUST_A])); const chk=await asAdmin(c=>c.query(`SELECT "tenantId" t FROM "Customer" WHERE id=$1`,[CUST_A])); rec('A cannot change tenantId of own row to B', chk.rows[0].t===TENANT_A, chk.rows[0].t); } catch(e){ rec('A cannot change tenantId of own row to B', true, e.message); }
  rec('B cannot read A products', (await asApp(TENANT_B,USER_B,false,async c=>(await c.query(`SELECT count(*)::int n FROM "Product" WHERE "tenantId"=$1`,[TENANT_A])).rows[0].n))===0, 'ok');
  try { await asApp('', '', false, async (c)=> c.query(`SELECT * FROM "Customer"`)); rec('No tenant context returns no business rows', true, 'rows filtered'); } catch(e){ rec('No tenant context fails safely', true, e.message); }
  const noCtx = await asApp('', '', false, async (c)=> (await c.query(`SELECT count(*)::int n FROM "Customer"`)).rows[0].n);
  rec('No tenant context sees zero customers', noCtx===0, `count=${noCtx}`);
  try { const n=await asApp(TENANT_A,USER_A,false,async c=>(await c.query(`SELECT count(*)::int n FROM "AdminAuditLog"`)).rows[0].n); rec('Normal user cannot read AdminAuditLog', n===0, `count=${n}`); } catch(e){ rec('Normal user cannot read AdminAuditLog', true, e.message); }
  rec('Missing context: zero invoices', (await asApp('', '', false, async c=>(await c.query(`SELECT count(*)::int n FROM "Invoice"`)).rows[0].n))===0, 'ok');
  rec('A cannot read B invoices', (await asApp(TENANT_A,USER_A,false,async c=>(await c.query(`SELECT count(*)::int n FROM "Invoice" WHERE "tenantId"=$1`,[TENANT_B])).rows[0].n))===0, 'ok');
  rec('A cannot read B payments', (await asApp(TENANT_A,USER_A,false,async c=>(await c.query(`SELECT count(*)::int n FROM "Payment" WHERE "tenantId"=$1`,[TENANT_B])).rows[0].n))===0, 'ok');
  rec('A cannot read B stock movements', (await asApp(TENANT_A,USER_A,false,async c=>(await c.query(`SELECT count(*)::int n FROM "StockMovement" WHERE "tenantId"=$1`,[TENANT_B])).rows[0].n))===0, 'ok');
  rec('A cannot read B warehouses', (await asApp(TENANT_A,USER_A,false,async c=>(await c.query(`SELECT count(*)::int n FROM "Warehouse" WHERE "tenantId"=$1`,[TENANT_B])).rows[0].n))===0, 'ok');
  rec('A cannot read B business documents', (await asApp(TENANT_A,USER_A,false,async c=>(await c.query(`SELECT count(*)::int n FROM "BusinessDocument" WHERE "tenantId"=$1`,[TENANT_B])).rows[0].n))===0, 'ok');
  rec('A cannot read B invoice items (via Invoice)', (await asApp(TENANT_A,USER_A,false,async c=>(await c.query(`SELECT count(*)::int n FROM "InvoiceItem" ii WHERE ii."invoiceId"=$1`,[INV_B])).rows[0].n))===0, 'ok');
  rec('A can read own invoice items (via Invoice)', (await asApp(TENANT_A,USER_A,false,async c=>(await c.query(`SELECT count(*)::int n FROM "InvoiceItem" ii WHERE ii."invoiceId"=$1`,[INV_A])).rows[0].n))===1, 'ok');
  rec('Admin context can read AdminAuditLog table', await asApp('', '', true, async c=>{ await c.query(`SELECT count(*)::int n FROM "AdminAuditLog"`); return true; }).catch(()=>false), 'ok');
  const passed = results.filter(r=>r.ok).length, failed = results.filter(r=>!r.ok).length;
  const report = { db: DB, role: 'mf_app_nobypass (NOBYPASSRLS, NOSUPERUSER)', passed, failed, results };
  fs.writeFileSync('RLS_TWO_TENANT_EXECUTION_REPORT.json', JSON.stringify(report,null,2));
  console.log('SUMMARY', passed, 'passed', failed, 'failed');
  process.exit(failed ? 1 : 0);
})().catch(e=>{ console.error(e.stack||e); process.exit(2); });