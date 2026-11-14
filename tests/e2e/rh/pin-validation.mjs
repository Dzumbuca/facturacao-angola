// Validação sintética de Machine RH — credenciais PIN na base de dados local de staging.
// Uso (staging LOCAL apenas, nunca produção/Supabase):
//   DATABASE_URL=postgresql://machine_facturas_staging:... node tests/e2e/rh/pin-validation.mjs
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHmac, randomInt } from 'node:crypto';

const prisma = new PrismaClient();
const PEPPER = process.env.PIN_PEPPER ?? 'rh-pin-pepper-development-only';
const pinLookup = (pin) => createHmac('sha256', PEPPER).update(pin).digest('hex');
const generatePin = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

const TENANT_A = 'e2e00000-0000-0000-0000-000000000001';
const TENANT_B = 'e2e00000-0000-0000-0000-000000000002';
const results = [];
const ok = (name, passed) => results.push({ name, passed });

// Limpeza de execuções anteriores (staging sintético)
await prisma.rhEmployee.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] }, employeeNumber: { startsWith: 'E2E-TEST-' } } });

for (const tenantId of [TENANT_A, TENANT_B]) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  ok(`tenant ${tenantId} existe`, Boolean(t));
}

// Teste 1: geração CSPRNG
const pin1 = generatePin();
ok('generatePin devolve 6 dígitos', /^\d{6}$/.test(pin1));

// Teste 2: criação
const pinHash1 = await bcrypt.hash(pin1, 10);
const lookup1 = pinLookup(pin1);
const firstEmp = await prisma.rhEmployee.create({
  data: {
    tenantId: TENANT_A,
    employeeNumber: 'E2E-TEST-001',
    firstName: 'Teste',
    lastName: 'Pin Um',
    baseSalary: 150000,
    hireDate: new Date('2026-01-05'),
    pinHash: pinHash1,
    pinLookup: lookup1,
    pinChangedAt: new Date(),
  },
});
ok('funcionário criado com pinLookup', Boolean(firstEmp.pinLookup) && Boolean(firstEmp.pinHash));

// Teste 3: quiosque — bcrypt compare correcto
ok('quiosque: comparação bcrypt do PIN correcto', await bcrypt.compare(pin1, firstEmp.pinHash));

// Teste 4: quiosque — PIN incorrecto rejeitado
ok('quiosque: PIN incorrecto rejeitado', !(await bcrypt.compare('000000', firstEmp.pinHash)));

// Teste 5: isolamento multi-tenant — mesmo PIN guardável noutro tenant (regras por tenant)
const pinHash5 = await bcrypt.hash(pin1, 10);
const lookup5 = pinLookup(pin1);
try {
  const empB = await prisma.rhEmployee.create({
    data: {
      tenantId: TENANT_B,
      employeeNumber: 'E2E-TEST-002',
      firstName: 'Teste',
      lastName: 'Pin Outro',
      baseSalary: 150000,
      hireDate: new Date('2026-01-05'),
      pinHash: pinHash5,
      pinLookup: lookup5,
      pinChangedAt: new Date(),
    },
  });
  ok('isolamento multi-tenant: mesmo PIN permitido noutro tenant', Boolean(empB.pinLookup));
} catch (e) {
  ok(`isolamento multi-tenant falhou: ${e.message}`, false);
}

// Teste 6: unicidade por tenant — segundo funcionário com o mesmo PIN rejeitado
try {
  await prisma.rhEmployee.create({
    data: {
      tenantId: TENANT_A,
      employeeNumber: 'E2E-TEST-003',
      firstName: 'Teste',
      lastName: 'Pin Dup',
      baseSalary: 150000,
      hireDate: new Date('2026-01-05'),
      pinHash: pinHash1,
      pinLookup: lookup1,
      pinChangedAt: new Date(),
    },
  });
  ok('unicidade por tenant aplicada', false);
} catch (e) {
  ok('unicidade por tenant rejeita segundo funcionário com o mesmo PIN', e.code === 'P2002');
}

// Teste 7: desactivar
await prisma.rhEmployee.update({
  where: { id: firstEmp.id },
  data: { pinHash: null, pinLookup: null, pinChangedAt: null },
});
const cleared = await prisma.rhEmployee.findUnique({ where: { id: firstEmp.id } });
ok('desactivar PIN limpa hash, lookup e data', cleared?.pinHash === null && cleared?.pinLookup === null && cleared?.pinChangedAt === null);

// Teste 8: reactivar com novo PIN
const pin8 = generatePin();
await prisma.rhEmployee.update({
  where: { id: firstEmp.id },
  data: { pinHash: await bcrypt.hash(pin8, 10), pinLookup: pinLookup(pin8), pinChangedAt: new Date() },
});
const reactivated = await prisma.rhEmployee.findUnique({ where: { id: firstEmp.id } });
ok('reactivar com novo PIN funciona no kiosk', await bcrypt.compare(pin8, reactivated.pinHash));

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed);
console.log(JSON.stringify({ passed, total: results.length, failed }, null, 2));
await prisma.$disconnect();
process.exit(failed.length ? 1 : 0);
