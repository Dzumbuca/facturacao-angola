const {Client}=require('pg'); const fs=require('fs');
(async()=>{
 const c=new Client({connectionString:'postgresql://postgres:testpass@127.0.0.1:5437/mf_rls_staging'});
 await c.connect();
 let sql=fs.readFileSync('RLS_POLICIES_STAGING.sql','utf8').replace(/^\uFEFF/,'');
 await c.query(sql);
 const r=await c.query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('Customer','Product','Invoice','InvoiceItem','Payment','Supplier','Warehouse','StockMovement','BusinessDocument','User','Tenant','AdUnlock','AdminAuditLog','Account','Session') ORDER BY tablename");
 console.log(JSON.stringify(r.rows,null,2));
 await c.end();
})().catch(e=>{console.error(e.message||e);process.exit(1)});
