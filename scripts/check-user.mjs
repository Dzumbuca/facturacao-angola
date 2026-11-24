import { Client } from 'pg';
const client = new Client({ connectionString: 'postgresql://postgres.wzeidypqpcjicwndyvxi:Wz7d05rEhHbZ4KXj@aws-1-eu-central-1.pooler.supabase.com:5432/postgres' });
await client.connect();
const res = await client.query('SELECT id, "sessionVersion" FROM "User" WHERE email = $1', ['test-preview-95961fb4@machinefaturas.test']);
console.log('User:', JSON.stringify(res.rows, null, 2));
await client.end();