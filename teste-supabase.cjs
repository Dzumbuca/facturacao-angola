const { Client } = require("pg");
require("dotenv").config();

async function main() {
  const url = process.env.DATABASE_URL;

  if (!url || url.includes("[YOUR-PASSWORD]") || url.includes("USER:PASSWORD")) {
    console.error("ERRO: DATABASE_URL ausente ou contém valores de exemplo.");
    process.exitCode = 1;
    return;
  }

  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
    ssl: { rejectUnauthorized: false }
  });

  const timer = setTimeout(() => {
    console.error("ERRO: teste excedeu 15 segundos.");
    client.end().catch(() => {});
    process.exit(1);
  }, 15000);

  try {
    await client.connect();
    console.log("LIGACAO: estabelecida.");

    const result = await client.query("SELECT 1 AS teste");
    console.log("CONSULTA: concluída.");
    console.log("RESULTADO:", result.rows[0].teste);
  } catch (error) {
    console.error("TIPO:", error.code || "SEM_CODIGO");
    console.error("ERRO:", error.message);
  } finally {
    clearTimeout(timer);
    await client.end().catch(() => {});
  }
}

main().catch(error => {
  console.error("ERRO:", error.message);
  process.exitCode = 1;
});
