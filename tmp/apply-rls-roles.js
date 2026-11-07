const {Client}=require('pg'); const fs=require('fs');
(async()=>{
 const c=new Client({connectionString:'postgresql://postgres:testpass@127.0.0.1:5437/mf_rls_staging'});
 await c.connect();
 let sql=fs.readFileSync('scripts/rls-staging-roles.sql','utf8').replace(/^\uFEFF/, '');
 await c.query(sql);
 const r=await c.query("SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit FROM pg_roles WHERE rolname IN ('mf_app_nobypass','mf_migration','mf_admin_executor','mf_auth_executor') ORDER BY 1");
 console.log(JSON.stringify(r.rows,null,2));
 await c.end();
})().catch(e=>{console.error(e.message||e);process.exit(1)});
