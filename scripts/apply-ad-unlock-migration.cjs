// Aplica a migração idempotente do AdUnlock (tabela + índices) sem expor credenciais.
const fs = require('fs');
const path = require('path');

// Carrega DATABASE_URL do .env sem imprimir segredos.
const envPath = path.join(__dirname, '..', '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*DATABASE_URL\s*=\s*"?(.+?)"?\s*$/);
  if (match) process.env.DATABASE_URL = process.env.DATABASE_URL || match[1];
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não encontrada no .env');
  process.exit(1);
}
const { host } = new URL(process.env.DATABASE_URL);
console.log('A ligar a:', host.replace(/.+?(?=\.)/, '***'));

const { Client } = require('pg');
const sql = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'migrations', '20261029000000_ad_unlock', 'migration.sql'), 'utf8');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 20000 });
  await client.connect();
  await client.query(sql);
  const check = await client.query(`SELECT COUNT(*)::int AS n FROM pg_indexes WHERE tablename = 'AdUnlock'`);
  console.log('Migração aplicada. Índices na tabela AdUnlock:', check.rows[0].n);
  await client.end();
})().catch((error) => {
  console.error('Falhou:', error.message);
  process.exit(1);
});
