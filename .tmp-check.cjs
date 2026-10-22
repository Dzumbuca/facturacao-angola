const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const rows = await c.query(`
    SELECT u.id, u.email, u.status, u."emailVerified",
           a.provider, a."providerAccountId"
    FROM "User" u
    LEFT JOIN "Account" a ON a."userId" = u.id
    ORDER BY u."createdAt"
  `);
  rows.rows.forEach(r => console.log(
    r.email,
    '| status:', r.status,
    '| verificado:', r.emailVerified ? 'SIM' : 'null',
    '| google:', r.provider ? 'SIM (sub ' + String(r.providerAccountId).slice(0, 10) + '...)' : 'NAO'
  ));
  await c.end();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
