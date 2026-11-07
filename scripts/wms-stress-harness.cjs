/**
 * WMS concurrency stress harness (safe-by-default, schema-tolerant).
 */
const { Pool } = require('pg');
const { URL } = require('url');
const crypto = require('crypto');

function arg(name, def) { const i = process.argv.indexOf('--' + name); if (i === -1) return def; const v = process.argv[i + 1]; return (!v || v.startsWith('--')) ? true : v; }
function has(name) { return process.argv.includes('--' + name); }
const conn = arg('url', process.env.STRESS_DATABASE_URL || process.env.DATABASE_URL);
const levels = String(arg('levels', '20,50,100,200')).split(',').map(n => parseInt(n.trim(), 10)).filter(Boolean);
const confirm = has('confirm-stress'); const dryRun = has('dry-run'); const allowRemote = has('allow-remote');
const allowHosts = String(arg('allow-hosts', 'localhost,127.0.0.1')).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const scenario = String(arg('scenario', 'mixed'));
const suffix = Date.now().toString(36);
const TENANT = String(arg('tenant', 'stress-' + suffix));
const PRODUCT = String(arg('product', 'stress-prod-' + suffix));
const WAREHOUSE = String(arg('warehouse', 'stress-wh-' + suffix));
function isBlockedHost(host){ const h=(host||'').toLowerCase(); return h.includes('supabase.co')||h.includes('supabase.com')||h.includes('neon.tech')||h.includes('prod'); }
async function cols(pool, table){ const r=await pool.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1",[table]); return new Set(r.rows.map(x=>x.column_name)); }
function pick(set,obj){ const out={}; for(const [k,v] of Object.entries(obj)) if(set.has(k)) out[k]=v; return out; }
async function upsert(pool, table, conflictCols, obj, whereFallback){
  const keys=Object.keys(obj); const vals=keys.map(k=>obj[k]); const params=keys.map((_,i)=>'$'+(i+1));
  const updates=keys.filter(k=>!conflictCols.includes(k)).map(k=>`"${k}"=EXCLUDED."${k}"`);
  const sql=`INSERT INTO "${table}" (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${params.join(',')}) ON CONFLICT (${conflictCols.map(k=>`"${k}"`).join(',')}) DO ${updates.length?('UPDATE SET '+updates.join(',')):'NOTHING'} RETURNING *`;
  try { const r=await pool.query(sql, vals); return r.rows[0]; }
  catch(e){
    if(!String(e.message||'').includes('no unique') || !whereFallback) throw e;
    const wf=whereFallback(obj); const ex=await pool.query(wf.sql,wf.params);
    if(ex.rowCount){ const upk=updates.length?keys.filter(k=>!conflictCols.includes(k)):[]; if(!upk.length) return ex.rows[0]; await pool.query(`UPDATE "${table}" SET ${upk.map((k,i)=>`"${k}"=$${i+1}`).join(',')} WHERE id=$${upk.length+1}`, [...upk.map(k=>obj[k]), ex.rows[0].id]); return ex.rows[0]; }
    const r=await pool.query(`INSERT INTO "${table}" (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${params.join(',')}) RETURNING *`, vals); return r.rows[0];
  }
}
async function runTx(pool, tenantId, fn){ const c=await pool.connect(); try{ await c.query('BEGIN'); try{ await c.query("SELECT set_config('app.tenant_id', $1, true)",[tenantId]); await c.query("SELECT set_config('app.is_admin','false',true)"); }catch{} const r=await fn(c); await c.query('COMMIT'); return {ok:true,r}; }catch(e){ try{await c.query('ROLLBACK')}catch{} return {ok:false,error:e&&e.message?e.message:String(e),code:e&&e.code}; }finally{ c.release(); } }
async function ensureFixtures(pool){
  const ct=await cols(pool,'Tenant'), cw=await cols(pool,'Warehouse'), cp=await cols(pool,'Product'), cps=await cols(pool,'ProductWarehouseStock');
  if(!ct.size||!cp.size||!cps.size) throw new Error('Missing required tables (Tenant/Product/ProductWarehouseStock)');
  await upsert(pool,'Tenant',['id'], pick(ct,{id:TENANT,name:'STRESS',plan:'FREE',createdAt:new Date(),updatedAt:new Date()}), (o)=>({sql:'SELECT id FROM "Tenant" WHERE id=$1', params:[o.id]}));
  if(cw.size) await upsert(pool,'Warehouse',['id'], pick(cw,{id:WAREHOUSE,tenantId:TENANT,name:'Stress WH',code:'STRESS',isActive:true,createdAt:new Date(),updatedAt:new Date()}), (o)=>({sql:'SELECT id FROM "Warehouse" WHERE id=$1', params:[o.id]}));
  await upsert(pool,'Product',['id'], pick(cp,{id:PRODUCT,tenantId:TENANT,name:'Stress Product',price:1,taxRate:0,codigo:'STRESS',stock:1000000,categoria:'STRESS',minStock:0,createdAt:new Date(),updatedAt:new Date()}), (o)=>({sql:'SELECT id FROM "Product" WHERE id=$1', params:[o.id]}));
  const pwsObj=pick(cps,{id:'pws-'+TENANT,tenantId:TENANT,productId:PRODUCT,warehouseId:WAREHOUSE,lotId:null,quantity:1000000,reservedQuantity:0,minStock:0,isLegacy:false,createdAt:new Date(),updatedAt:new Date()});
  const conflict=cps.has('lotId')?['tenantId','productId','warehouseId','lotId']:['tenantId','productId','warehouseId'];
  await upsert(pool,'ProductWarehouseStock', conflict, pwsObj, (o)=>{
    if(o.lotId==null && cps.has('lotId')) return {sql:'SELECT id FROM "ProductWarehouseStock" WHERE "tenantId"=$1 AND "productId"=$2 AND "warehouseId"=$3 AND "lotId" IS NULL', params:[o.tenantId,o.productId,o.warehouseId]};
    return {sql:'SELECT id FROM "ProductWarehouseStock" WHERE "tenantId"=$1 AND "productId"=$2 AND "warehouseId"=$3', params:[o.tenantId,o.productId,o.warehouseId]};
  });
  return {cp,cps,cm:await cols(pool,'StockMovement')};
}
async function cleanup(pool){ for(const t of ['StockMovement','ProductWarehouseStock','StockAdjustmentItem','StockAdjustment','StockTransferItem','StockTransferReceptionItem','StockTransferReception','StockTransfer','Product','Warehouse']){ try{ await pool.query(`DELETE FROM "${t}" WHERE "tenantId"=$1`,[TENANT]); }catch{} } try{ await pool.query('DELETE FROM "Tenant" WHERE id=$1',[TENANT]); }catch{} }
function summarize(results, ms){ const ok=results.filter(r=>r.ok).length, fail=results.length-ok, errors={}; for(const r of results) if(!r.ok){ const k=(r.error||'unknown').slice(0,120); errors[k]=(errors[k]||0)+1; } return {total:results.length,ok,fail,ms,errors}; }
async function opOut(pool,i,meta){ return runTx(pool,TENANT,async(c)=>{
  const qty=1; let pws;
  if(meta.cps.has('lotId')) pws=await c.query('SELECT id, quantity FROM "ProductWarehouseStock" WHERE "tenantId"=$1 AND "productId"=$2 AND "warehouseId"=$3 AND "lotId" IS NULL FOR UPDATE',[TENANT,PRODUCT,WAREHOUSE]);
  else pws=await c.query('SELECT id, quantity FROM "ProductWarehouseStock" WHERE "tenantId"=$1 AND "productId"=$2 AND "warehouseId"=$3 FOR UPDATE',[TENANT,PRODUCT,WAREHOUSE]);
  if(!pws.rowCount||Number(pws.rows[0].quantity)<qty) throw new Error('INSUFFICIENT');
  await c.query(`UPDATE "ProductWarehouseStock" SET quantity=quantity-$1${meta.cps.has('updatedAt')?',"updatedAt"=NOW()':''} WHERE id=$2`,[qty,pws.rows[0].id]);
  const up=await c.query(`UPDATE "Product" SET stock=stock-$1${meta.cp.has('updatedAt')?',"updatedAt"=NOW()':''} WHERE id=$2 AND "tenantId"=$3 AND stock>=$1`,[qty,PRODUCT,TENANT]);
  if(!up.rowCount) throw new Error('INSUFFICIENT_PRODUCT');
  if(meta.cm.size){ const idem='stress-out-'+TENANT+'-'+i+'-'+crypto.randomUUID(); const m={id:crypto.randomUUID(),tenantId:TENANT,productId:PRODUCT,warehouseId:WAREHOUSE,type:'OUT',quantity:qty,quantitySigned:-qty,reason:'stress',reference:'STRESS',idempotencyKey:idem,createdAt:new Date()}; const obj=pick(meta.cm,m); if(Object.keys(obj).length>3){ const ks=Object.keys(obj); await c.query(`INSERT INTO "StockMovement" (${ks.map(k=>`"${k}"`).join(',')}) VALUES (${ks.map((_,j)=>'$'+(j+1)).join(',')})`, ks.map(k=>obj[k])); } }
  return 1; }); }
async function opAdjust(pool,i,meta){ return runTx(pool,TENANT,async(c)=>{
  const qty=1; let pws;
  if(meta.cps.has('lotId')) pws=await c.query('SELECT id, quantity FROM "ProductWarehouseStock" WHERE "tenantId"=$1 AND "productId"=$2 AND "warehouseId"=$3 AND "lotId" IS NULL FOR UPDATE',[TENANT,PRODUCT,WAREHOUSE]);
  else pws=await c.query('SELECT id, quantity FROM "ProductWarehouseStock" WHERE "tenantId"=$1 AND "productId"=$2 AND "warehouseId"=$3 FOR UPDATE',[TENANT,PRODUCT,WAREHOUSE]);
  if(pws.rowCount) await c.query(`UPDATE "ProductWarehouseStock" SET quantity=quantity+$1${meta.cps.has('updatedAt')?',"updatedAt"=NOW()':''} WHERE id=$2`,[qty,pws.rows[0].id]);
  await c.query(`UPDATE "Product" SET stock=stock+$1${meta.cp.has('updatedAt')?',"updatedAt"=NOW()':''} WHERE id=$2 AND "tenantId"=$3`,[qty,PRODUCT,TENANT]);
  if(meta.cm.size){ const idem='stress-adj-'+TENANT+'-'+i+'-'+crypto.randomUUID(); const m={id:crypto.randomUUID(),tenantId:TENANT,productId:PRODUCT,warehouseId:WAREHOUSE,type:'ADJUSTMENT',quantity:qty,quantitySigned:qty,reason:'stress-adj',reference:'STRESS',idempotencyKey:idem,createdAt:new Date()}; const obj=pick(meta.cm,m); if(Object.keys(obj).length>3){ const ks=Object.keys(obj); await c.query(`INSERT INTO "StockMovement" (${ks.map(k=>`"${k}"`).join(',')}) VALUES (${ks.map((_,j)=>'$'+(j+1)).join(',')})`, ks.map(k=>obj[k])); } }
  return 1; }); }
async function runLevel(pool,n,meta){ const start=Date.now(); const tasks=[]; for(let i=0;i<n;i++){ if(scenario==='out')tasks.push(opOut(pool,i,meta)); else if(scenario==='adjust')tasks.push(opAdjust(pool,i,meta)); else tasks.push(i%3===0?opAdjust(pool,i,meta):opOut(pool,i,meta)); } return summarize(await Promise.all(tasks), Date.now()-start); }
async function main(){
  if(!conn) throw new Error('Missing --url or STRESS_DATABASE_URL/DATABASE_URL');
  const u=new URL(conn); const host=(u.hostname||'').toLowerCase();
  if(!allowHosts.includes(host)){ if(!(allowRemote && process.env.ALLOW_REMOTE_STRESS==='1' && !isBlockedHost(host))) throw new Error(`Blocked host "${host}".`); }
  if(isBlockedHost(host) && !(allowRemote && process.env.ALLOW_REMOTE_STRESS==='1' && process.env.I_UNDERSTAND_PROD_RISK==='YES')) throw new Error(`Refusing suspected production host "${host}".`);
  const plan={host,db:u.pathname,levels,scenario,tenant:TENANT,dryRun};
  console.log('WMS_STRESS_PLAN', JSON.stringify(plan,null,2));
  if(!confirm) throw new Error('Safety stop: pass --confirm-stress (or --dry-run).');
  if(dryRun){ console.log('DRY_RUN_OK'); return; }
  const pool=new Pool({connectionString:conn, max: Math.min(50, Math.max(10, Math.max(...levels)))});
  try{
    const meta=await ensureFixtures(pool);
    const reports=[];
    for(const n of levels){
      await pool.query(`UPDATE "Product" SET stock=1000000${meta.cp.has('updatedAt')?',"updatedAt"=NOW()':''} WHERE id=$1 AND "tenantId"=$2`,[PRODUCT,TENANT]);
      const setP=[`quantity=1000000`]; if(meta.cps.has('reservedQuantity')) setP.push(`"reservedQuantity"=0`); if(meta.cps.has('updatedAt')) setP.push(`"updatedAt"=NOW()`); await pool.query(`UPDATE "ProductWarehouseStock" SET ${setP.join(',')} WHERE "tenantId"=$1 AND "productId"=$2 AND "warehouseId"=$3`,[TENANT,PRODUCT,WAREHOUSE]);
      const rep=await runLevel(pool,n,meta); rep.level=n;
      const lot = meta.cps.has('lotId') ? ' AND pws."lotId" IS NULL' : '';
      const final=await pool.query(`SELECT p.stock AS pstock, pws.quantity AS whqty FROM "Product" p LEFT JOIN "ProductWarehouseStock" pws ON pws."tenantId"=p."tenantId" AND pws."productId"=p.id AND pws."warehouseId"=$3${lot} WHERE p.id=$1 AND p."tenantId"=$2`,[PRODUCT,TENANT,WAREHOUSE]);
      rep.final=final.rows[0]||{};
      reports.push(rep); console.log('LEVEL_RESULT', JSON.stringify(rep));
    }
    console.log('WMS_STRESS_FINAL', JSON.stringify({ok:true,scenario,tenant:TENANT,reports},null,2));
  } finally { if(String(arg('keep-data','false'))!=='true') await cleanup(pool); await pool.end(); }
}
main().catch(e=>{ console.error('WMS_STRESS_ERROR', e&&e.stack?e.stack:e); process.exit(1); });
