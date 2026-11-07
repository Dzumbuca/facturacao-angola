const {Client}=require('pg');
(async()=>{
 const c=new Client({connectionString:'postgresql://postgres:testpass@127.0.0.1:5437/mf_rls_staging'});
 await c.connect();
 // InvoiceItem has no tenantId? check
 const ii=await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='InvoiceItem' ORDER BY ordinal_position").catch(()=>({rows:[]}));
 const au=await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='AdUnlock' ORDER BY ordinal_position").catch(()=>({rows:[]}));
 console.log(JSON.stringify({InvoiceItem:ii.rows.map(r=>r.column_name), AdUnlock:au.rows.map(r=>r.column_name)},null,2));
 await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
