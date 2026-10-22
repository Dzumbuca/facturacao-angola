const { Client } = require('pg');
const { encode } = require('next-auth/jwt');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query('SELECT id, name, email FROM "User" WHERE email = $1', ['joaquimzumbuca@gmail.com']);
  await c.end();
  const u = r.rows[0];
  if (!u) { console.error('user not found'); process.exit(1); }
  const token = {
    name: u.name,
    email: u.email,
    sub: u.id,
    sessionVersion: 0,
    tenantId: null,
    jti: require('crypto').randomUUID(),
  };
  const jwt = await encode({
    token,
    secret: process.env.AUTH_SECRET_TEST,
    salt: '__Secure-authjs.session-token',
  });
  console.log(jwt);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
