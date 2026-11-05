const { Client } = require("pg");
const cfg = { host:"127.0.0.1", port:5437, database:"mf_rls_staging", user:"mf_app_login", password:"mf_rls_test_only_5437" };
async function main(){
  const c=new Client(cfg); await c.connect();
  const r=[];
  const run=async(name,fn)=>{try{await fn();r.push(["PASS",name])}catch(e){r.push(["FAIL",name,e.message.split("\n")[0]])}};
  await run("app non-admin cannot read EmailRequestLimit", async()=>{ await c.query("BEGIN"); await c.query("SELECT set_config('app.is_admin','false',true)"); const x=await c.query('SELECT count(*)::int n FROM "EmailRequestLimit"'); await c.query("ROLLBACK"); if(x.rows[0].n!==0) throw new Error("expected 0 got "+x.rows[0].n);});
  await run("app admin context can read EmailRequestLimit", async()=>{ await c.query("BEGIN"); await c.query("SELECT set_config('app.is_admin','true',true)"); await c.query('SELECT count(*)::int n FROM "EmailRequestLimit"'); await c.query("ROLLBACK"); });
  await run("user self lookup by id works with app.user_id", async()=>{ const id=(await c.query('SELECT id FROM "User" LIMIT 1')).rows[0]?.id; if(!id) return; await c.query("BEGIN"); await c.query("SELECT set_config('app.user_id',$1,true), set_config('app.is_admin','false',true)",[id]); const x=await c.query('SELECT count(*)::int n FROM "User" WHERE id=$1',[id]); await c.query("ROLLBACK"); if(x.rows[0].n!==1) throw new Error("expected 1 got "+x.rows[0].n);});
  await run("user email lookup blocked without admin context (RLS policy has no email path)", async()=>{ const email=(await c.query('SELECT email FROM "User" WHERE email IS NOT NULL LIMIT 1')).rows[0]?.email; if(!email) return; await c.query("BEGIN"); await c.query("SELECT set_config('app.is_admin','false',true), set_config('app.user_id','',true)"); const x=await c.query('SELECT count(*)::int n FROM "User" WHERE email=$1',[email]); await c.query("ROLLBACK"); if(x.rows[0].n!==0) throw new Error("expected 0 under RLS got "+x.rows[0].n);});
  await run("missing tenant context sees zero invoices (executor sanity)", async()=>{ await c.query("BEGIN"); await c.query("SELECT set_config('app.tenant_id','',true), set_config('app.is_admin','false',true)"); const x=await c.query('SELECT count(*)::int n FROM "Invoice"'); await c.query("ROLLBACK"); if(x.rows[0].n!==0) throw new Error("expected 0 got "+x.rows[0].n);});
  await c.end();
  const pass=r.filter(x=>x[0]==="PASS").length; const fail=r.filter(x=>x[0]==="FAIL").length;
  for(const x of r) console.log(x.join(" | "));
  console.log("SUMMARY",pass,"passed",fail,"failed");
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1)});