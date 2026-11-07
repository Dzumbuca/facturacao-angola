const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:testpass@localhost:5437/machine_stock_test',
  max: 2,
});

async function runTx(tenantId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET ROLE app_user');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const res = await fn(client);
    await client.query('COMMIT');
    return res;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.query('RESET ROLE');
    client.release();
  }
}

async function main() {
  // setup
  await pool.query("INSERT INTO \"Tenant\" (id,name,plan,\"createdAt\") VALUES ('ta','TA','FREE',NOW()),('tb','TB','FREE',NOW()) ON CONFLICT (id) DO NOTHING");
  await pool.query("INSERT INTO \"Product\" (id,\"tenantId\",name,price,\"taxRate\",codigo,stock,categoria,\"createdAt\",\"minStock\") VALUES ('pa','ta','PA',10,0,'PA',10,'cat',NOW(),0) ON CONFLICT (id) DO NOTHING");

  // Test A: two concurrent OUT 7
  const tasks = [7, 7].map((q) =>
    runTx('ta', async (c) => {
      const r = await c.query("UPDATE \"Product\" SET stock = stock - $1 WHERE id='pa' AND \"tenantId\"='ta' AND stock >= $1", [q]);
      if (r.rowCount === 0) throw new Error('INSUFFICIENT');
      return q;
    }).catch((e) => e.message)
  );
  const results = await Promise.all(tasks);
  console.log('Concurrent OUT results:', results);

  const stock = await pool.query("SELECT stock FROM \"Product\" WHERE id='pa'");
  console.log('Final stock:', stock.rows[0].stock);

  // Pool context test
  await runTx('ta', async (c) => {
    const r = await c.query("SELECT current_setting('app.tenant_id', true) AS t");
    console.log('Context in tx A:', r.rows[0].t);
  });
  await runTx('tb', async (c) => {
    const r = await c.query("SELECT current_setting('app.tenant_id', true) AS t");
    console.log('Context in tx B:', r.rows[0].t);
  });

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
