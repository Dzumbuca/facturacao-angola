// Teste HTTP end-to-end da Etapa A contra a staging local.
// Execução: node tests/e2e/rh/etapa-a-protection.mjs
// Requer: `npx next start -p 3002` com .env.local apontando para staging.
import { PrismaClient } from '@prisma/client';

const BASE_URL = process.env.APP_URL || 'http://localhost:3002';
const TENANT_A_ID = 'e2e00000-0000-0000-0000-000000000001';
const TENANT_B_ID = 'e2e00000-0000-0000-0000-000000000002';
const EMAIL_A = 'e2e-test@machinefacturas.test';
const EMAIL_B = 'e2e-other@machinefacturas.test';
const PASSWORD = 'TestPass123!';

const prisma = new PrismaClient();
const results = [];
const ok = (name, passed, detail) => { results.push({ name, passed, detail }); console.log(`${passed ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

function extractCookies(setCookieHeader) {
  if (!setCookieHeader) return [];
  return setCookieHeader.split(/,(?=\s*[A-Za-z_][A-Za-z0-9_.-]*=)/).map(p => p.split(';')[0].trim()).filter(Boolean);
}

async function login(email, password) {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfSetCookie = csrfRes.headers.get('set-cookie') || '';
  const csrfPairs = extractCookies(csrfSetCookie);
  const body = new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE_URL}/`, json: 'true' });
  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: csrfPairs.join('; ') }, body: body.toString(), redirect: 'manual',
  });
  const loginSetCookie = loginRes.headers.get('set-cookie') || '';
  const sessionPairs = extractCookies(loginSetCookie);
  const map = new Map();
  for (const pair of [...csrfPairs, ...sessionPairs]) { const name = pair.split('=')[0].trim(); map.set(name, pair); }
  return { cookies: Array.from(map.values()).join('; '), csrfToken };
}

async function authFetch(path, session, init) {
  return fetch(`${BASE_URL}${path}`, { ...init, headers: { ...(init?.headers || {}), Cookie: session.cookies } });
}

async function countWrites() {
  const [runs, payslips] = await Promise.all([prisma.rhPayrollRun.count(), prisma.rhPayslip.count()]);
  return { runs, payslips };
}

(async () => {
  // Limpeza controlada para teste reprodutível
  await prisma.rhPayrollRun.deleteMany({ where: { period: { in: ['2026-10', '2026-09', '2026-08'] } } });
  await prisma.rhEmployeeDeduction.updateMany({ where: { description: 'ITEST adiantamento' }, data: { remainingInstallments: 2, active: true } });

  // ===== Tenant A =====
  const sessA = await login(EMAIL_A, PASSWORD);
  console.log('— Tenant A (e2e-test) autenticado');

  // 1. Ruleset PENDENTE + OFICIAL → 403
  const rulesetPendingA = await prisma.rhPayrollRuleSet.findFirst({ where: { tenantId: TENANT_A_ID, name: 'ITEST-PENDENTE-01' } });
  const beforeRuns = await prisma.rhPayrollRun.count();
  const res403 = await authFetch('/api/rh/payroll/runs', sessA, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period: '2026-10', rulesetId: rulesetPendingA.id, mode: 'OFICIAL' }),
  });
  const body403 = await res403.json().catch(() => ({}));
  ok('A.1-OFICIAL PENDENTE → 403', res403.status === 403, `got ${res403.status}`);
  ok('A.1-código REGRAS_SALARIAIS_NAO_VALIDADAS', body403?.code === 'REGRAS_SALARIAIS_NAO_VALIDADAS', `got ${body403?.code ?? body403?.error}`);
  ok('A.1-sem escrita de RhPayrollRun', await prisma.rhPayrollRun.count() === beforeRuns, 'runs criados indevidamente');

  // 2. SIMULACAO com PENDENTE → 200, nada persiste
  const beforeSim = await countWrites();
  const deducAntes = await prisma.rhEmployeeDeduction.findMany({ where: { description: 'ITEST adiantamento' }, select: { id: true, remainingInstallments: true } });
  const resSim = await authFetch('/api/rh/payroll/runs', sessA, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period: '2026-10', rulesetId: rulesetPendingA.id, mode: 'SIMULACAO' }),
  });
  const bodySim = await resSim.json().catch(() => ({}));
  ok('A.4-SIMULACAO PENDENTE → 200', resSim.status === 200, `got ${resSim.status} ${JSON.stringify(bodySim).slice(0, 200)}`);
  ok('A.4-SIMULACAO: simulation=true', bodySim?.simulation === true, `got ${JSON.stringify(bodySim).slice(0, 120)}`);
  const afterSim = await countWrites();
  ok('A.4-SIMULACAO não cria RhPayrollRun', afterSim.runs === beforeSim.runs, `before=${beforeSim.runs} after=${afterSim.runs}`);
  ok('A.4-SIMULACAO não cria RhPayslip', afterSim.payslips === beforeSim.payslips, `before=${beforeSim.payslips} after=${afterSim.payslips}`);
  const deducDepois = await prisma.rhEmployeeDeduction.findMany({ where: { description: 'ITEST adiantamento' }, select: { id: true, remainingInstallments: true } });
  const sameR = deducAntes.length === deducDepois.length && deducAntes.every((a, i) => a.remainingInstallments === deducDepois[i]?.remainingInstallments);
  ok('A.4-SIMULACAO não altera remainingInstallments', sameR, JSON.stringify(deducDepois));

  // 3. VALIDADO + OFICIAL → 201, snapshot guardado
  const rulesetValidadoA = await prisma.rhPayrollRuleSet.findFirst({ where: { tenantId: TENANT_A_ID, name: 'ITEST-VALIDADO-01' } });
  const beforeOf = await countWrites();
  const res201 = await authFetch('/api/rh/payroll/runs', sessA, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period: '2026-10', rulesetId: rulesetValidadoA.id, mode: 'OFICIAL' }),
  });
  const body201 = await res201.json().catch(() => ({}));
  ok('A.5-OFICIAL VALIDADO → 201', res201.status === 201, `got ${res201.status} ${JSON.stringify(body201).slice(0, 200)}`);
  const afterOf = await countWrites();
  ok('A.5-OFICIAL cria 1 RhPayrollRun', afterOf.runs === beforeOf.runs + 1, `before=${beforeOf.runs} after=${afterOf.runs}`);
  const runCriado = await prisma.rhPayrollRun.findFirst({ where: { tenantId: TENANT_A_ID, period: '2026-10' }, include: { payslips: true } });
  const lines = runCriado?.payslips?.[0]?.lines ?? null;
  ok('A.5-snapshot guardado nas linhas', !!lines, JSON.stringify(lines).slice(0, 250));
  ok('A.5-snapshot: legalStatusAtProcessing=VALIDADO', lines?.legalStatusAtProcessing === 'VALIDADO', JSON.stringify(lines?.legalStatusAtProcessing));
  ok('A.5-snapshot: rulesetName=ITEST-VALIDADO-01', lines?.rulesetName === 'ITEST-VALIDADO-01', JSON.stringify(lines?.rulesetName));
  ok('A.5-snapshot: irtBracketCount e taxas presentes', typeof lines?.irtBracketCount === 'number' && typeof lines?.inssEmployeeRate === 'number', JSON.stringify({ irt: lines?.irtBracketCount, inss: lines?.inssEmployeeRate }));

  // 4. PATCH APROVADO com ruleset PENDENTE → 403
  // Buscar ruleset PENDENTE e criar run manual apontando para ele
  const runManual = await prisma.rhPayrollRun.create({
    data: { tenantId: TENANT_A_ID, period: '2026-09', status: 'CALCULADO', rulesetId: rulesetPendingA.id, totalGross: 1, totalNet: 1, totalInss: 0, totalIrt: 0, createdByUserId: (await prisma.user.findFirstOrThrow({ where: { email: EMAIL_A }, select: { id: true } })).id },
  });
  const resAprova = await authFetch(`/api/rh/payroll/runs/${runManual.id}`, sessA, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'APROVADO' }),
  });
  const bodyAprova = await resAprova.json().catch(() => ({}));
  ok('A.2-PATCH APROVADO PENDENTE → 403', resAprova.status === 403, `got ${resAprova.status}`);
  ok('A.2-código REGRAS_SALARIAIS_NAO_VALIDADAS', bodyAprova?.code === 'REGRAS_SALARIAIS_NAO_VALIDADAS', `got ${bodyAprova?.code ?? bodyAprova?.error}`);
  await prisma.rhPayrollRun.delete({ where: { id: runManual.id } });

  // 5. Multitenant
  const sessB = await login(EMAIL_B, PASSWORD);
  console.log('— Tenant B (e2e-other) autenticado');
  if (runCriado) {
    const resBGet = await authFetch('/api/rh/payroll/runs', sessB);
    const bodyBGet = await resBGet.json().catch(() => []);
    const ids = Array.isArray(bodyBGet) ? bodyBGet.map(r => r.id) : [];
    ok('A.5-isolamento: tenant B não vê runs de tenant A', !ids.includes(runCriado.id), `tenant B vê ${ids.length} run(s)`);
    const resBCreate = await authFetch('/api/rh/payroll/runs', sessB, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: '2026-08', rulesetId: rulesetValidadoA.id, mode: 'SIMULACAO' }),
    });
    ok('A.5-isolamento: tenant B não usa ruleset do tenant A', [403, 404].includes(resBCreate.status), `got ${resBCreate.status}`);
    const resBPatch = await authFetch(`/api/rh/payroll/runs/${runCriado.id}`, sessB, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APROVADO' }),
    });
    ok('A.5-isolamento: tenant B não aprova run do tenant A', [403, 404].includes(resBPatch.status), `got ${resBPatch.status}`);
  }

  // 6. Auditar legal-validate
  const resNoDoc = await authFetch('/api/rh/payroll/legal-validate', sessA, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rulesetId: rulesetPendingA.id }),
  });
  ok('A.6-legal-validate sem URL → 400', resNoDoc.status === 400, `got ${resNoDoc.status}`);
  const resNoName = await authFetch('/api/rh/payroll/legal-validate', sessA, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rulesetId: rulesetPendingA.id, documentUrl: 'https://example.com/ev.pdf' }),
  });
  ok('A.6-legal-validate sem nome do validador → 400', resNoName.status === 400, `got ${resNoName.status}`);
  // Responder 200 e reverter: confirmar que impede bypass de bloqueio por falta de evidência mesmo com VALIDADO a funcionar
  const resWithDoc = await authFetch('/api/rh/payroll/legal-validate', sessA, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rulesetId: rulesetPendingA.id, documentUrl: 'https://example.com/ev.pdf', validatedByName: 'Auditor Staging' }),
  });
  ok('A.6-legal-validate com documentação → 200', resWithDoc.status === 200, `got ${resWithDoc.status}`);
  // Agora pendente → restauramos
  await prisma.rhPayrollRuleSet.update({ where: { id: rulesetPendingA.id }, data: { legalStatus: 'PENDENTE', legalDocumentUrl: null, legalValidatedBy: null, legalValidatedAt: null } });

  // 7. Sucesso de bloqueio correcto com mode inválido → por default é OFICIAL (não deve cair em bypass)
  const resBadMode = await authFetch('/api/rh/payroll/runs', sessA, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period: '2026-10', rulesetId: rulesetPendingA.id, mode: 'INVALID' }),
  });
  ok('A.6-mode inválido cai em OFICIAL e bloqueia PENDENTE', resBadMode.status === 403, `got ${resBadMode.status}`);
  const resNoMode = await authFetch('/api/rh/payroll/runs', sessA, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period: '2026-10', rulesetId: rulesetPendingA.id }),
  });
  ok('A.6-sem modo explícito cai em OFICIAL e bloqueia PENDENTE', resNoMode.status === 403, `got ${resNoMode.status}`);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed);
  console.log('='.repeat(60));
  console.log(`RESULTADO: ${passed}/${results.length} passaram`);
  if (failed.length) console.log('FALHOU:\n' + failed.map(f => `  ${f.name}${f.detail ? ' — ' + f.detail : ''}`).join('\n'));
  await prisma.$disconnect();
  process.exit(failed.length ? 1 : 0);
})().catch(async e => { console.error('ERRO FATAL:', e); await prisma.$disconnect(); process.exit(1); });
