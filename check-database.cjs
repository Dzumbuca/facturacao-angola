const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  console.log("\n=== TABELAS EXISTENTES ===");
  console.table(tables);

  const counts = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*) FROM public."Invoice") AS invoices,
      (SELECT COUNT(*) FROM public."Tenant") AS tenants,
      (SELECT COUNT(*) FROM public."Customer") AS customers,
      (SELECT COUNT(*) FROM public."Product") AS products
  `);

  console.log("\n=== REGISTOS EXISTENTES ===");
  console.table(counts);
}

main()
  .catch(console.error)
  .finally(async () => await prisma.$disconnect());
