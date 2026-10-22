function assertBootstrapInput(userId, confirmation) {
  if (typeof userId !== 'string' || !userId || userId.trim() !== userId || userId.length > 100 || userId.includes('@')) {
    throw new Error('Provide the exact existing user ID, not an email address.');
  }
  if (confirmation !== `PROMOVER ${userId}`) {
    throw new Error('The confirmation phrase does not match. No changes were made.');
  }
}

async function bootstrapPlatformAdmin(userId, confirmation, repository) {
  assertBootstrapInput(userId, confirmation);
  return repository.transaction(async (tx) => {
    const user = await tx.findUserById(userId);
    if (!user || user.status !== 'ACTIVE') throw new Error('Target user is missing or not active.');
    if (await tx.hasAnyPlatformAdmin()) throw new Error('A platform administrator already exists.');
    await tx.promoteUser(userId);
    await tx.writeBootstrapAudit({
      actorType: 'BOOTSTRAP',
      action: 'PLATFORM_ADMIN_BOOTSTRAPPED',
      resourceType: 'USER',
      resourceId: userId,
      reason: 'First platform administrator provisioned through the controlled CLI bootstrap.',
      result: 'SUCCESS',
      metadata: { source: 'cli-bootstrap' },
    });
  });
}

async function runCli() {
  const userId = process.argv[2];
  if (!userId) throw new Error('Usage: npm run admin:bootstrap -- <exact-user-id>');
  const { createInterface } = require('node:readline/promises');
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  let confirmation;
  try {
    confirmation = await readline.question(`Type PROMOVER ${userId} to grant the first platform administrator role: `);
  } finally {
    readline.close();
  }

  const { PrismaClient, Prisma } = require('@prisma/client');
  const prisma = new PrismaClient();
  const repository = {
    transaction: (run) => prisma.$transaction((tx) => run({
      findUserById: (id) => tx.user.findUnique({ where: { id }, select: { id: true, status: true } }),
      hasAnyPlatformAdmin: () => tx.user.findFirst({ where: { platformRole: 'ADMIN' }, select: { id: true } }),
      promoteUser: (id) => tx.user.update({ where: { id }, data: { platformRole: 'ADMIN' }, select: { id: true } }),
      writeBootstrapAudit: (data) => tx.adminAuditLog.create({ data }),
    }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
  };
  try {
    await bootstrapPlatformAdmin(userId, confirmation, repository);
    process.stdout.write('Platform administrator provisioned and audited.\n');
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { bootstrapPlatformAdmin };

if (require.main === module) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
