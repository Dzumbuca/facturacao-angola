const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe(`
    SELECT to_regclass('public."_prisma_migrations"')::text AS migration_table
  `);

  console.log("\nTabela de migrações:");
  console.table(result);

  if (result[0].migration_table !== null) {
    const migrations = await prisma.$queryRawUnsafe(`
      SELECT
        migration_name,
        started_at,
        finished_at,
        rolled_back_at
      FROM public."_prisma_migrations"
      ORDER BY started_at
    `);

    console.log("\nHistórico de migrações:");
    console.table(migrations);
  } else {
    console.log("\nA tabela de histórico do Prisma não existe.");
  }
}

main()
  .catch(console.error)
  .finally(async () => await prisma.$disconnect());
