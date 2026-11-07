const {Client}=require('pg');
(async()=>{
 const c=new Client({connectionString:'postgresql://postgres:testpass@127.0.0.1:5437/mf_rls_staging'});
 await c.connect();
 for (const t of ['StockMovement','BusinessDocument','Payment','Invoice','Warehouse']) {
   const r=await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",[t]);
   console.log(t, r.rows.map(x=>x.column_name).join(','));
 }
 await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
