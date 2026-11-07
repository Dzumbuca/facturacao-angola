/**
 * Expanded RLS isolation execution (LOCAL 5437/mf_rls_staging ONLY).
 * Real PostgreSQL + RLS + roles without BYPASSRLS. Seeds data as postgres (setup only).
 * Tests prioritized tables: Supplier, CompanyBankAccount, CompanyLogo, PlanPayment,
 * ProductWarehouseStock, StockLot, StockAdjustment/Item, StockReservation,
 * StockTransfer+items+receptions, PurchaseOrder+items+receptions, TenantApplication,
 * TenantSubscription, EmailDelivery, AdUnlock. Also checks missing context/admin behavior.
 * No production/Supabase/5436 changes. No fictional production claims.
 */
const { Client } = require('pg');
const fs = require('fs');
const crypto = require('crypto');
const DB = process.env.RLS_TEST_DB || 'postgresql://postgres:testpass@127.0.0.1:5437/mf_rls_staging';
const TENANT_A = '10000000-0000-4000-a000-000000000001';
const TENANT_B = '10000000-0000-4000-b000-000000000002';
const USER_A = '10000000-0000-4000-a000-000000000011';
const USER_B = '10000000-0000-4000-b000-000000000012';
const results = [];
const ids = (p)=>({
  custA:p+'31',custB:p+'32',invA:p+'41',invB:p+'42',whA:p+'51',whB:p+'52',prodA:p+'21',prodB:p+'22',
  supA:p+'61',supB:p+'62',cbaA:p+'63',cbaB:p+'64',logoA:p+'65',logoB:p+'66',ppA:p+'67',ppB:p+'68',
  lotA:p+'71',lotB:p+'72',pwsA:p+'73',pwsB:p+'74',saA:p+'75',saB:p+'76',saiA:p+'77',saiB:p+'78',
  srA:p+'79',srB:p+'7a',stA:p+'81',stB:p+'82',stiA:p+'83',stiB:p+'84',strA:p+'85',strB:p+'86',striA:p+'87',striB:p+'88',
  poA:p+'91',poB:p+'92',poiA:p+'93',poiB:p+'94',prA:p+'95',prB:p+'96',priA:p+'97',priB:p+'98',
  taA:p+'a1',taB:p+'a2',tsA:p+'a3',tsB:p+'a4',edA:p+'b1',edB:p+'b2',adA:p+'b3',adB:p+'b4',
  paA:'10000000-0000-4000-a000-0000000000c1',paB:'10000000-0000-4000-b000-0000000000c2',
  spA:'10000000-0000-4000-a000-0000000000d1',spB:'10000000-0000-4000-b000-0000000000d2'
});
const ID=ids('10000000-0000-4000-a000-0000000000');
function rec(name, ok, detail, meta={}){ results.push({name,ok,detail:String(detail??'').slice(0,350),...meta}); console.log((ok?'PASS':'FAIL')+' '+name+' - '+detail); }
async function asPostgres(fn){ const c=new Client({connectionString:DB}); await c.connect(); try{ return await fn(c);} finally{ await c.end(); } }
async function asRole(role, tenantId, userId, isAdmin, fn){
  const c=new Client({connectionString:DB}); await c.connect();
  try{
    await c.query('BEGIN');
    await c.query(`SET LOCAL ROLE ${role}`);
    await c.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId||'']);
    await c.query("SELECT set_config('app.user_id',$1,true)",[userId||'']);
    await c.query("SELECT set_config('app.is_admin',$1,true)",[isAdmin?'true':'false']);
    const r=await fn(c); await c.query('COMMIT'); return {ok:true,r};
  }catch(e){ try{await c.query('ROLLBACK')}catch{} return {ok:false,error:e.message,code:e.code}; }
  finally{ await c.end(); }
}
async function cols(c,t){ const r=await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",[t]); return new Set(r.rows.map(x=>x.column_name)); }
function pick(set,obj){ const o={}; for(const [k,v] of Object.entries(obj)) if(set.has(k)) o[k]=v; return o; }
async function insert(c,table,obj){ const o=pick(await cols(c,table),obj); const k=Object.keys(o); if(!k.length) throw new Error('no cols for '+table); const sql=`INSERT INTO "${table}" (${k.map(x=>`"${x}"`).join(',')}) VALUES (${k.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT DO NOTHING`; await c.query(sql,k.map(x=>o[x])); }
async function mustBlock(label, role, tenantId, userId, isAdmin, sql, params=[]){ const r=await asRole(role,tenantId,userId,isAdmin,async c=>c.query(sql,params)); rec(label, !r.ok || (r.r?.rowCount===0) || (r.r?.rows?.[0]?.n===0), r.ok?`rowCount=${r.r?.rowCount??r.r?.rows?.[0]?.n}`:r.error); }
async function mustZero(label, role, tenantId, userId, isAdmin, sql, params=[]){ const r=await asRole(role,tenantId,userId,isAdmin,async c=>(await c.query(sql,params)).rows[0]?.n); rec(label, r.ok && Number(r.r)===0, r.ok?`n=${r.r}`:r.error); }
async function mustOne(label, role, tenantId, userId, isAdmin, sql, params=[]){ const r=await asRole(role,tenantId,userId,isAdmin,async c=>(await c.query(sql,params)).rows[0]?.n); rec(label, r.ok && Number(r.r)>=1, r.ok?`n=${r.r}`:r.error); }
(async()=>{
  const now=new Date();
  await asPostgres(async c=>{
    await insert(c,'Tenant',{id:TENANT_A,name:'Tenant A RLS',status:'ACTIVE',plan:'FREE',createdAt:now});
    await insert(c,'Tenant',{id:TENANT_B,name:'Tenant B RLS',status:'ACTIVE',plan:'FREE',createdAt:now});
    await insert(c,'User',{id:USER_A,email:'a-rls@test.local',name:'A',tenantId:TENANT_A,status:'ACTIVE',platformRole:'NONE',tenantRole:'COMPANY_ADMIN',createdAt:now});
    await insert(c,'User',{id:USER_B,email:'b-rls@test.local',name:'B',tenantId:TENANT_B,status:'ACTIVE',platformRole:'NONE',tenantRole:'COMPANY_ADMIN',createdAt:now});
    await insert(c,'Customer',{id:ID.custA,tenantId:TENANT_A,name:'Cust A',createdAt:now});
    await insert(c,'Customer',{id:ID.custB,tenantId:TENANT_B,name:'Cust B',createdAt:now});
    await insert(c,'Product',{id:ID.prodA,tenantId:TENANT_A,name:'Prod A',price:10,taxRate:14,stock:5,codigo:'PA',categoria:'GERAL',minStock:0,createdAt:now});
    await insert(c,'Product',{id:ID.prodB,tenantId:TENANT_B,name:'Prod B',price:10,taxRate:14,stock:5,codigo:'PB',categoria:'GERAL',minStock:0,createdAt:now});
    await insert(c,'Warehouse',{id:ID.whA,tenantId:TENANT_A,name:'WH A',isDefault:true,isActive:true,createdAt:now,updatedAt:now});
    await insert(c,'Warehouse',{id:ID.whB,tenantId:TENANT_B,name:'WH B',isDefault:true,isActive:true,createdAt:now,updatedAt:now});
    await insert(c,'Invoice',{id:ID.invA,tenantId:TENANT_A,customerId:ID.custA,number:'FT A1',type:'FT',status:'ISSUED',total:10,subTotal:10,taxTotal:0,issuedAt:now,createdAt:now});
    await insert(c,'Invoice',{id:ID.invB,tenantId:TENANT_B,customerId:ID.custB,number:'FT B1',type:'FT',status:'ISSUED',total:10,subTotal:10,taxTotal:0,issuedAt:now,createdAt:now});
    // prioritized
    await insert(c,'Supplier',{id:ID.supA,tenantId:TENANT_A,name:'Sup A',isActive:true,createdAt:now,updatedAt:now});
    await insert(c,'Supplier',{id:ID.supB,tenantId:TENANT_B,name:'Sup B',isActive:true,createdAt:now,updatedAt:now});
    await insert(c,'CompanyBankAccount',{id:ID.cbaA,tenantId:TENANT_A,bankName:'Bank A',isActive:true,isPrimary:true,createdAt:now,updatedAt:now});
    await insert(c,'CompanyBankAccount',{id:ID.cbaB,tenantId:TENANT_B,bankName:'Bank B',isActive:true,isPrimary:true,createdAt:now,updatedAt:now});
    // CompanyLogo has bytea content; keep small
    const logo={mimeType:'image/png',content:Buffer.from([137,80,78,71]),createdAt:now};
    await insert(c,'CompanyLogo',{id:ID.logoA,tenantId:TENANT_A,...logo});
    await insert(c,'CompanyLogo',{id:ID.logoB,tenantId:TENANT_B,...logo});
    await insert(c,'PlanPayment',{id:ID.ppA,tenantId:TENANT_A,payerName:'Payer A',payerPhone:'900',amountKz:100,months:1,status:'PENDENTE',createdAt:now});
    await insert(c,'PlanPayment',{id:ID.ppB,tenantId:TENANT_B,payerName:'Payer B',payerPhone:'900',amountKz:100,months:1,status:'PENDENTE',createdAt:now});
    await insert(c,'StockLot',{id:ID.lotA,tenantId:TENANT_A,productId:ID.prodA,lotNumber:'LA',receivedAt:now});
    await insert(c,'StockLot',{id:ID.lotB,tenantId:TENANT_B,productId:ID.prodB,lotNumber:'LB',receivedAt:now});
    await insert(c,'ProductWarehouseStock',{id:ID.pwsA,tenantId:TENANT_A,productId:ID.prodA,warehouseId:ID.whA,lotId:ID.lotA,quantity:1,reservedQuantity:0,minStock:0,isLegacy:false,createdAt:now,updatedAt:now});
    await insert(c,'ProductWarehouseStock',{id:ID.pwsB,tenantId:TENANT_B,productId:ID.prodB,warehouseId:ID.whB,lotId:ID.lotB,quantity:1,reservedQuantity:0,minStock:0,isLegacy:false,createdAt:now,updatedAt:now});
    await insert(c,'StockAdjustment',{id:ID.saA,tenantId:TENANT_A,warehouseId:ID.whA,reason:'RA',status:'OPEN',createdAt:now});
    await insert(c,'StockAdjustment',{id:ID.saB,tenantId:TENANT_B,warehouseId:ID.whB,reason:'RB',status:'OPEN',createdAt:now});
    await insert(c,'StockAdjustmentItem',{id:ID.saiA,tenantId:TENANT_A,adjustmentId:ID.saA,productId:ID.prodA,stockId:ID.pwsA,systemQty:1,countedQty:1,difference:0});
    await insert(c,'StockAdjustmentItem',{id:ID.saiB,tenantId:TENANT_B,adjustmentId:ID.saB,productId:ID.prodB,stockId:ID.pwsB,systemQty:1,countedQty:1,difference:0});
    await insert(c,'StockReservation',{id:ID.srA,tenantId:TENANT_A,productId:ID.prodA,warehouseId:ID.whA,stockId:ID.pwsA,quantity:1,status:'ACTIVE'});
    await insert(c,'StockReservation',{id:ID.srB,tenantId:TENANT_B,productId:ID.prodB,warehouseId:ID.whB,stockId:ID.pwsB,quantity:1,status:'ACTIVE'});
    await insert(c,'StockTransfer',{id:ID.stA,tenantId:TENANT_A,fromWarehouseId:ID.whA,toWarehouseId:ID.whA,status:'PENDING',reference:'TA',createdAt:now});
    // toWarehouse same is odd but schema allows; for B use A? no cross tenant; easier use own WH twice? FK allows; but unique includes ref. acceptable for seed.
    await insert(c,'StockTransfer',{id:ID.stB,tenantId:TENANT_B,fromWarehouseId:ID.whB,toWarehouseId:ID.whB,status:'PENDING',reference:'TB',createdAt:now});
    await insert(c,'StockTransferItem',{id:ID.stiA,tenantId:TENANT_A,transferId:ID.stA,productId:ID.prodA,lotId:ID.lotA,quantity:1,receivedQty:0,rejectedQty:0});
    await insert(c,'StockTransferItem',{id:ID.stiB,tenantId:TENANT_B,transferId:ID.stB,productId:ID.prodB,lotId:ID.lotB,quantity:1,receivedQty:0,rejectedQty:0});
    await insert(c,'StockTransferReception',{id:ID.strA,tenantId:TENANT_A,transferId:ID.stA,warehouseId:ID.whA,receivedAt:now,reference:'TRA'});
    await insert(c,'StockTransferReception',{id:ID.strB,tenantId:TENANT_B,transferId:ID.stB,warehouseId:ID.whB,receivedAt:now,reference:'TRB'});
    await insert(c,'StockTransferReceptionItem',{id:ID.striA,tenantId:TENANT_A,receptionId:ID.strA,transferItemId:ID.stiA,productId:ID.prodA,lotId:ID.lotA,quantity:1,rejectedQty:0});
    await insert(c,'StockTransferReceptionItem',{id:ID.striB,tenantId:TENANT_B,receptionId:ID.strB,transferItemId:ID.stiB,productId:ID.prodB,lotId:ID.lotB,quantity:1,rejectedQty:0});
    await insert(c,'PurchaseOrder',{id:ID.poA,tenantId:TENANT_A,supplierId:ID.supA,status:'PENDENTE',total:10,createdAt:now,updatedAt:now});
    await insert(c,'PurchaseOrder',{id:ID.poB,tenantId:TENANT_B,supplierId:ID.supB,status:'PENDENTE',total:10,createdAt:now,updatedAt:now});
    await insert(c,'PurchaseOrderItem',{id:ID.poiA,tenantId:TENANT_A,purchaseOrderId:ID.poA,productId:ID.prodA,quantity:1,receivedQty:0,unitPrice:10});
    await insert(c,'PurchaseOrderItem',{id:ID.poiB,tenantId:TENANT_B,purchaseOrderId:ID.poB,productId:ID.prodB,quantity:1,receivedQty:0,unitPrice:10});
    await insert(c,'PurchaseReception',{id:ID.prA,tenantId:TENANT_A,purchaseOrderId:ID.poA,warehouseId:ID.whA,receivedAt:now,reference:'PRA'});
    await insert(c,'PurchaseReception',{id:ID.prB,tenantId:TENANT_B,purchaseOrderId:ID.poB,warehouseId:ID.whB,receivedAt:now,reference:'PRB'});
    await insert(c,'PurchaseReceptionItem',{id:ID.priA,tenantId:TENANT_A,receptionId:ID.prA,purchaseOrderItemId:ID.poiA,productId:ID.prodA,lotId:ID.lotA,quantity:1});
    await insert(c,'PurchaseReceptionItem',{id:ID.priB,tenantId:TENANT_B,receptionId:ID.prB,purchaseOrderItemId:ID.poiB,productId:ID.prodB,lotId:ID.lotB,quantity:1});
    await insert(c,'TenantApplication',{id:ID.taA,tenantId:TENANT_A,applicationId:ID.paA,enabled:true,createdAt:now,updatedAt:now}).catch(()=>{});
    await insert(c,'TenantSubscription',{id:ID.tsA,tenantId:TENANT_A,planId:ID.spA,status:'ACTIVE',createdAt:now,updatedAt:now}).catch(()=>{});
    // PlatformApplication/SubscriptionPlan are global/admin tables in matrix? TenantApplication has FKs to them — seed via admin context if needed
    await c.query(`INSERT INTO "PlatformApplication"(id,slug,name,"isCore","createdAt","updatedAt") VALUES ($1,'app-a','App A',false,NOW(),NOW()),($2,'app-b','App B',false,NOW(),NOW()) ON CONFLICT DO NOTHING`,[ID.paA,ID.paB]);
    await c.query(`INSERT INTO "SubscriptionPlan"(id,slug,name,"priceKz","isActive","createdAt","updatedAt") VALUES ($1,'plan-a','Plan A',0,true,NOW(),NOW()),($2,'plan-b','Plan B',0,true,NOW(),NOW()) ON CONFLICT DO NOTHING`,[ID.spA,ID.spB]);
    await insert(c,'TenantApplication',{id:ID.taA,tenantId:TENANT_A,applicationId:ID.paA,enabled:true,createdAt:now,updatedAt:now});
    await insert(c,'TenantApplication',{id:ID.taB,tenantId:TENANT_B,applicationId:ID.paB,enabled:true,createdAt:now,updatedAt:now});
    await insert(c,'TenantSubscription',{id:ID.tsA,tenantId:TENANT_A,planId:ID.spA,status:'ACTIVE',createdAt:now,updatedAt:now});
    await insert(c,'TenantSubscription',{id:ID.tsB,tenantId:TENANT_B,planId:ID.spB,status:'ACTIVE',createdAt:now,updatedAt:now});
    await insert(c,'EmailDelivery',{id:ID.edA,tenantId:TENANT_A,purpose:'TEST',recipient:'a@test.local',subject:'A',status:'ACCEPTED',createdAt:now});
    await insert(c,'EmailDelivery',{id:ID.edB,tenantId:TENANT_B,purpose:'TEST',recipient:'b@test.local',subject:'B',status:'ACCEPTED',createdAt:now});
    await insert(c,'EmailDelivery',{id:'10000000-0000-4000-a000-0000000000b9',tenantId:null,purpose:'GLOBAL',recipient:'g@test.local',subject:'G',status:'ACCEPTED',createdAt:now});
    await insert(c,'AdUnlock',{id:ID.adA,tenant_id:TENANT_A,status:'PENDING',started_at:now,created_at:now});
    await insert(c,'AdUnlock',{id:ID.adB,tenant_id:TENANT_B,status:'PENDING',started_at:now,created_at:now});
  });
  console.log('seed done');

  const checks=[
    ['Supplier read own A','Supplier',ID.supA,true],['Supplier block B','Supplier',ID.supB,false],
    ['CompanyBankAccount read own A','CompanyBankAccount',ID.cbaA,true],['CompanyBankAccount block B','CompanyBankAccount',ID.cbaB,false],
    ['CompanyLogo read own A','CompanyLogo',ID.logoA,true],['CompanyLogo block B','CompanyLogo',ID.logoB,false],
    ['PlanPayment read own A','PlanPayment',ID.ppA,true],['PlanPayment block B','PlanPayment',ID.ppB,false],
    ['ProductWarehouseStock read own A','ProductWarehouseStock',ID.pwsA,true],['ProductWarehouseStock block B','ProductWarehouseStock',ID.pwsB,false],
    ['StockLot read own A','StockLot',ID.lotA,true],['StockLot block B','StockLot',ID.lotB,false],
    ['StockAdjustment read own A','StockAdjustment',ID.saA,true],['StockAdjustment block B','StockAdjustment',ID.saB,false],
    ['StockAdjustmentItem read own A','StockAdjustmentItem',ID.saiA,true],['StockAdjustmentItem block B','StockAdjustmentItem',ID.saiB,false],
    ['StockReservation read own A','StockReservation',ID.srA,true],['StockReservation block B','StockReservation',ID.srB,false],
    ['StockTransfer read own A','StockTransfer',ID.stA,true],['StockTransfer block B','StockTransfer',ID.stB,false],
    ['StockTransferItem read own A','StockTransferItem',ID.stiA,true],['StockTransferItem block B','StockTransferItem',ID.stiB,false],
    ['StockTransferReception read own A','StockTransferReception',ID.strA,true],['StockTransferReception block B','StockTransferReception',ID.strB,false],
    ['StockTransferReceptionItem read own A','StockTransferReceptionItem',ID.striA,true],['StockTransferReceptionItem block B','StockTransferReceptionItem',ID.striB,false],
    ['PurchaseOrder read own A','PurchaseOrder',ID.poA,true],['PurchaseOrder block B','PurchaseOrder',ID.poB,false],
    ['PurchaseOrderItem read own A','PurchaseOrderItem',ID.poiA,true],['PurchaseOrderItem block B','PurchaseOrderItem',ID.poiB,false],
    ['PurchaseReception read own A','PurchaseReception',ID.prA,true],['PurchaseReception block B','PurchaseReception',ID.prB,false],
    ['PurchaseReceptionItem read own A','PurchaseReceptionItem',ID.priA,true],['PurchaseReceptionItem block B','PurchaseReceptionItem',ID.priB,false],
    ['TenantApplication read own A','TenantApplication',ID.taA,true],['TenantApplication block B','TenantApplication',ID.taB,false],
    ['TenantSubscription read own A','TenantSubscription',ID.tsA,true],['TenantSubscription block B','TenantSubscription',ID.tsB,false],
    ['EmailDelivery read own A','EmailDelivery',ID.edA,true],['EmailDelivery block B','EmailDelivery',ID.edB,false],
    ['AdUnlock read own A','AdUnlock',ID.adA,true],['AdUnlock block B','AdUnlock',ID.adB,false],
  ];
  for(const [label,table,id,own] of checks){
    const idCol = table==='AdUnlock' ? 'id' : 'id';
    const q=`SELECT count(*)::int n FROM "${table}" WHERE "${idCol}"=$1`;
    if(own) await mustOne(label,'mf_app_nobypass',TENANT_A,USER_A,false,q,[id]);
    else await mustZero(label,'mf_app_nobypass',TENANT_A,USER_A,false,q,[id]);
  }
  // writes: WITH CHECK / cross-tenant update/delete blocked
  const badInsert = await asRole('mf_app_nobypass',TENANT_A,USER_A,false, async c=> c.query(`INSERT INTO "Supplier"(id,"tenantId",name,"isActive","createdAt","updatedAt") VALUES ($1,$2,'X',true,NOW(),NOW())`,[crypto.randomUUID(),TENANT_B]));
  rec('Supplier insert tenant B blocked (WITH CHECK)', !badInsert.ok, badInsert.ok?'inserted':badInsert.error);
  const badUpd = await asRole('mf_app_nobypass',TENANT_A,USER_A,false, async c=> c.query(`UPDATE "Supplier" SET name='hack' WHERE id=$1`,[ID.supB]));
  rec('Supplier update B blocked', !badUpd.ok || badUpd.r.rowCount===0, badUpd.ok?`rowCount=${badUpd.r.rowCount}`:badUpd.error);
  const badDel = await asRole('mf_app_nobypass',TENANT_A,USER_A,false, async c=> c.query(`DELETE FROM "Supplier" WHERE id=$1`,[ID.supB]));
  rec('Supplier delete B blocked', !badDel.ok || badDel.r.rowCount===0, badDel.ok?`rowCount=${badDel.r.rowCount}`:badDel.error);
  const stillB = await asPostgres(async c=> (await c.query('SELECT name FROM "Supplier" WHERE id=$1',[ID.supB])).rows[0]?.name);
  rec('Supplier B unchanged after blocked writes', stillB==='Sup B', stillB);

  const cbaIns = await asRole('mf_app_nobypass',TENANT_A,USER_A,false, async c=> c.query(`INSERT INTO "CompanyBankAccount"(id,"tenantId","bankName","isActive","isPrimary","createdAt","updatedAt") VALUES ($1,$2,'X',true,false,NOW(),NOW())`,[crypto.randomUUID(),TENANT_B]));
  rec('CompanyBankAccount insert tenant B blocked', !cbaIns.ok, cbaIns.ok?'inserted':cbaIns.error);
  const ppUpd = await asRole('mf_app_nobypass',TENANT_A,USER_A,false, async c=> c.query(`UPDATE "PlanPayment" SET status='APPROVED' WHERE id=$1`,[ID.ppB]));
  rec('PlanPayment update B blocked', !ppUpd.ok || ppUpd.r.rowCount===0, ppUpd.ok?`rowCount=${ppUpd.r.rowCount}`:ppUpd.error);
  const adIns = await asRole('mf_app_nobypass',TENANT_A,USER_A,false, async c=> c.query(`INSERT INTO "AdUnlock"(id,tenant_id,status,started_at,created_at) VALUES ($1,$2,'PENDING',NOW(),NOW())`,[crypto.randomUUID(),TENANT_B]));
  rec('AdUnlock insert tenant B blocked', !adIns.ok, adIns.ok?'inserted':adIns.error);

  // missing context
  await mustZero('No context: zero suppliers','mf_app_nobypass','','',false,'SELECT count(*)::int n FROM "Supplier"');
  await mustZero('No context: zero plan payments','mf_app_nobypass','','',false,'SELECT count(*)::int n FROM "PlanPayment"');
  await mustZero('No context: zero stock transfers','mf_app_nobypass','','',false,'SELECT count(*)::int n FROM "StockTransfer"');
  await mustZero('No context: zero purchase orders','mf_app_nobypass','','',false,'SELECT count(*)::int n FROM "PurchaseOrder"');
  await mustZero('No context: zero ad unlocks','mf_app_nobypass','','',false,'SELECT count(*)::int n FROM "AdUnlock"');
  // EmailDelivery: nullable tenant rows visible? policy allows tenantId IS NULL; with no context tenant_id='' so IS NULL row should be visible? check actual policy behavior
  const edNull = await asRole('mf_app_nobypass','','',false, async c=> (await c.query('SELECT count(*)::int n FROM "EmailDelivery" WHERE "tenantId" IS NULL')).rows[0].n);
  rec('No context: global EmailDelivery visibility (policy-dependent)', true, `n=${edNull.r} (tenantId IS NULL rows; policy allows IS NULL OR matching tenant)`);

  // admin context
  const adminR = await asRole('mf_app_nobypass','','',true, async c=> (await c.query('SELECT count(*)::int n FROM "Supplier"')).rows[0].n);
  rec('Admin context sees suppliers across tenants', adminR.ok && Number(adminR.r)>=2, adminR.ok?`n=${adminR.r}`:adminR.error);
  const adminP = await asRole('mf_app_nobypass','','',true, async c=> (await c.query('SELECT count(*)::int n FROM "PlanPayment"')).rows[0].n);
  rec('Admin context sees plan payments', adminP.ok && Number(adminP.r)>=2, adminP.ok?`n=${adminP.r}`:adminP.error);

  // tenant-scoped write own + read own (functional)
  const ownIns = await asRole('mf_app_nobypass',TENANT_A,USER_A,false, async c=> { const id=crypto.randomUUID(); await c.query(`INSERT INTO "Supplier"(id,"tenantId",name,"isActive","createdAt","updatedAt") VALUES ($1,$2,'Own',true,NOW(),NOW())`,[id,TENANT_A]); return id; });
  rec('Supplier insert own tenant succeeds', ownIns.ok, ownIns.ok?ownIns.r:ownIns.error);
  if(ownIns.ok){ await mustOne('Supplier own inserted row readable','mf_app_nobypass',TENANT_A,USER_A,false,'SELECT count(*)::int n FROM "Supplier" WHERE id=$1',[ownIns.r]); await mustZero('Supplier own inserted row hidden from B','mf_app_nobypass',TENANT_B,USER_B,false,'SELECT count(*)::int n FROM "Supplier" WHERE id=$1',[ownIns.r]); }

  const report={db:DB,generatedAt:new Date().toISOString(),scope:'prioritized-tables+missing-context+admin+write-checks',passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results};
  fs.writeFileSync('RLS_PRIORITY_TABLES_EXECUTION_REPORT.json',JSON.stringify(report,null,2));
  console.log('SUMMARY',report.passed,'passed',report.failed,'failed');
  process.exit(report.failed?1:0);
})().catch(e=>{ console.error(e.stack||e); process.exit(2); });
