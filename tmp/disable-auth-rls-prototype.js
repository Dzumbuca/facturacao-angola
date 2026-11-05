const {Client}=require('pg');
(async()=>{
 const c=new Client({connectionString:'postgresql://postgres:testpass@127.0.0.1:5437/mf_rls_staging'});
 await c.connect();
 // Disable RLS on auth/NextAuth-sensitive tables (prototype phase) — local test DB only
 for (const t of ['Account','Session','VerificationToken','EmailActionToken']) {
   try { await c.query(`ALTER TABLE "${t}" DISABLE ROW LEVEL SECURITY`); console.log('disabled',t); } catch(e){ console.log('skip',t,e.message); }
 }
 const r=await c.query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('Account','Session','VerificationToken','EmailActionToken','User') ORDER BY 1");
 console.log(JSON.stringify(r.rows,null,2));
 await c.end();
})().catch(e=>{console.error(e.message||e);process.exit(1)});
