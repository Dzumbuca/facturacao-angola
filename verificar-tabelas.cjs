require("dotenv").config();
const { Client } = require("pg");

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log("LIGACAO: estabelecida");
    console.log("TABELAS EXISTENTES:");
    console.table(result.rows);
  } catch (error) {
    console.error("ERRO:", error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
