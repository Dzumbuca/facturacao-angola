const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  const backup = {
    createdAt: new Date().toISOString(),
    database: "erp_db",
    tables: {}
  };

  for (const item of tables) {
    const table = item.table_name;
    const safeTable = table.replace(/"/g, '""');

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM public."${safeTable}"`
    );

    backup.tables[table] = rows;
    console.log(`Exportada: ${table} (${rows.length} registos)`);
  }

  const directory = path.join(process.cwd(), "backups");
  fs.mkdirSync(directory, { recursive: true });

  const filename = `erp_db-backup-${Date.now()}.json`;
  const output = path.join(directory, filename);

  fs.writeFileSync(
    output,
    JSON.stringify(backup, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
      2
    ),
    "utf8"
  );

  console.log("\nCópia de segurança criada:");
  console.log(output);
  console.log(`Tabelas exportadas: ${tables.length}`);
}

main()
  .catch(error => {
    console.error("Falha na cópia de segurança:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
