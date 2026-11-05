const {Client}=require('pg');
(async()=>{
 const c=new Client({connectionString:'postgresql://postgres:testpass@127.0.0.1:5437/mf_rls_staging'});
 await c.connect();
 const t=await c.query("SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenantId' ORDER BY 1");
 const noT=await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name NOT IN (SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenantId') AND table_name NOT LIKE '_prisma%' ORDER BY 1");
 console.log(JSON.stringify({withTenantId:t.rows.map(r=>r.table_name), withoutTenantId:noT.rows.map(r=>r.table_name)},null,2));
 await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
