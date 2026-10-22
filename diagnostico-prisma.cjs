const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findFirst({
      select: {
        id: true,
        emailVerified: true,
        emailVerificationRequired: true,
        sessionVersion: true,
      },
    });

    console.log(
      "CONSULTA OK:",
      user
        ? "Os campos são reconhecidos e a consulta foi executada."
        : "A consulta foi executada, mas não existem utilizadores."
    );
  } catch (error) {
    console.error("ERRO:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
