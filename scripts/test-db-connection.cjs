const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw`SELECT current_database() AS db, current_user AS username`;
  console.log("SUCESSO:", result);
}

main()
  .catch(error => console.error("ERRO:", error.message))
  .finally(() => prisma.$disconnect());
