import { Client } from 'pg';
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const tenantId = process.argv[2];
await c.query(`INSERT INTO "Tenant" (id, name, plan, status, "createdAt") VALUES ($1, $2, 'PRO', 'ACTIVE', now()) ON CONFLICT (id) DO NOTHING`, [tenantId, `Multi-${tenantId}`]);
await c.query(`INSERT INTO "Product" (id, "tenantId", name, price, stock, "trackStock", "createdAt") VALUES ($1, $2, 'p', 100, 100000, false, now()) ON CONFLICT (id) DO NOTHING`, [tenantId + '-p', tenantId]);
console.log('seeded', tenantId);
await c.end();
