const dotenv = require("dotenv");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

dotenv.config({ path: ".env", quiet: true });

function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL não encontrada.");

  const url = new URL(raw);

  if (
    url.hostname !== "aws-0-eu-west-1.pooler.supabase.com" ||
    url.port !== "6543" ||
    decodeURIComponent(url.username) !== "postgres.dodoplzkmazdlrwqdmpp"
  ) {
    throw new Error("Ligação inesperada. Backup cancelado.");
  }

  if (!url.password) throw new Error("Palavra-passe não configurada.");

  const pgDump = "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe";
  if (!fs.existsSync(pgDump)) throw new Error("pg_dump não encontrado.");

  const dir = "C:\\Users\\Administrador\\Desktop\\machine-facturas-backups";
  fs.mkdirSync(dir, { recursive: true });

  const file = path.join(
    dir,
    `machine-facturas-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`
  );

  const env = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(url.password)
  };

  const args = [
    "--host=" + url.hostname,
    "--port=" + url.port,
    "--username=" + decodeURIComponent(url.username),
    "--dbname=" + decodeURIComponent(url.pathname.slice(1)),
    "--no-password",
    "--format=custom",
    "--compress=6",
    "--file=" + file
  ];

  console.log("A criar backup do Machine Facturas...");

  const child = spawn(pgDump, args, {
    env,
    stdio: ["ignore", "ignore", "pipe"]
  });

  let errors = "";
  child.stderr.on("data", data => {
    errors += data.toString();
  });

  child.on("error", error => {
    console.error("Erro ao iniciar pg_dump:", error.message);
    process.exitCode = 1;
  });

  child.on("close", code => {
    if (code !== 0) {
      console.error("Backup falhou. Código:", code);
      if (errors) console.error(errors);
      process.exitCode = 1;
      return;
    }

    const stat = fs.statSync(file);
    if (stat.size === 0) {
      console.error("O ficheiro está vazio.");
      process.exitCode = 1;
      return;
    }

    console.log("Backup criado:", file);
    console.log("Tamanho:", (stat.size / 1024 / 1024).toFixed(2), "MB");
  });
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
