const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

const DATABASE_URL = 'postgresql://a1_test@127.0.0.1:5432/a1_validation_test';
const WORKER_PATH = path.join(__dirname, 'distributed-worker.cjs');

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

const runId = () => `t-idem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

async function seedFreshTenant() {
  const id = runId();
  await prisma.tenant.create({ data: { id, name: `Idem ${id}`, plan: 'PRO', status: 'ACTIVE' } });
  await prisma.customer.create({ data: { id: `${id}-c`, tenantId: id, name: 'Idem Customer', nif: '5000000001' } });
  return { tenantId: id, customerId: `${id}-c` };
}

function runWorker(tenantId, count, startIndex, operation, idempotencyKey) {
  return new Promise((resolve, reject) => {
    const args = [WORKER_PATH, tenantId, String(count), String(startIndex), operation];
    if (idempotencyKey) args.push(idempotencyKey);
    const child = spawn('node', args, {
      env: { ...process.env, DATABASE_URL },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300000,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}: ${stderr}`));
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(new Error(`Failed to parse worker output: ${stdout} stderr: ${stderr}`));
        }
      }
    });
    child.on('error', reject);
  });
}

async function verifySQL(tenantId, expectedCount, testName, expectedActiveLeases = 0, expectIdempotencyRecord = false) {
  const totalInvoices = await prisma.invoice.count({ where: { tenantId } });
  const ftCount = await prisma.invoice.count({ where: { tenantId, type: 'FT' } });
  const ncCount = await prisma.invoice.count({ where: { tenantId, type: 'NC' } });

  const dupNumbers = await prisma.$queryRaw`SELECT number, COUNT(*) as cnt FROM "Invoice" WHERE "tenantId" = ${tenantId} GROUP BY number HAVING COUNT(*) > 1`;
  const dupSequences = await prisma.$queryRaw`SELECT "chainSequence", COUNT(*) as cnt FROM "Invoice" WHERE "tenantId" = ${tenantId} AND "chainSequence" IS NOT NULL GROUP BY "chainSequence" HAVING COUNT(*) > 1`;
  const dupHashes = await prisma.$queryRaw`SELECT hash, COUNT(*) as cnt FROM "Invoice" WHERE hash IS NOT NULL GROUP BY hash HAVING COUNT(*) > 1`;

  const chain = await prisma.invoiceChainState.findUnique({ where: { tenantId } });
  const maxSeqResult = await prisma.invoice.aggregate({
    where: { tenantId },
    _max: { chainSequence: true },
  });
  const chainLastSequence = chain ? chain.lastSequence : null;
  const dbMaxSeq = maxSeqResult._max.chainSequence ?? 0;

  const activeLeases = await prisma.emissionLease.count({ where: { tenantId, state: 'ACTIVE' } });

  const idemCount = await prisma.idempotentRequest.count({ where: { tenantId } });
  const idemWithoutResultRaw = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM "IdempotentRequest" WHERE "tenantId" = ${tenantId} AND "resultId" IS NULL`;
  const idemWithoutResult = idemWithoutResultRaw[0] ? Number(idemWithoutResultRaw[0].cnt.toString()) : 0;

  const result = {
    testName,
    tenantId,
    totalInvoices,
    ftCount,
    ncCount,
    expectedCount,
    duplicateNumbers: dupNumbers.length,
    duplicateSequences: dupSequences.length,
    duplicateHashes: dupHashes.length,
    chainLastSequence,
    dbMaxSeq,
    chainConsistent: chainLastSequence === dbMaxSeq,
    activeLeases,
    idemCount,
    idemWithoutResult,
    passed: totalInvoices === expectedCount &&
      dupNumbers.length === 0 &&
      dupSequences.length === 0 &&
      dupHashes.length === 0 &&
      chainLastSequence === dbMaxSeq &&
      activeLeases === expectedActiveLeases &&
      (!expectIdempotencyRecord || idemCount >= 1) &&
      idemWithoutResult === 0,
  };
  console.log(`  SQL Verify [${testName}]: total=${totalInvoices} expected=${expectedCount} dupNum=${dupNumbers.length} dupSeq=${dupSequences.length} dupHash=${dupHashes.length} chainLastSeq=${chainLastSequence} dbMaxSeq=${dbMaxSeq} chainConsistent=${chainLastSequence === dbMaxSeq} activeLeases=${activeLeases} idemCount=${idemCount} idemWithoutResult=${idemWithoutResult} ${result.passed ? 'PASS' : 'FAIL'}`);
  return result;
}

async function cleanupTenant(tenantId) {
  try {
    await prisma.invoice.deleteMany({ where: { tenantId } });
    await prisma.invoiceChainState.delete({ where: { tenantId } });
    await prisma.invoiceSeries.deleteMany({ where: { tenantId } });
    await prisma.emissionLease.deleteMany({ where: { tenantId } });
    await prisma.idempotentRequest.deleteMany({ where: { tenantId } });
    await prisma.customer.delete({ where: { id: `${tenantId}-c` } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  } catch {}
}

async function runTest1() {
  console.log(`\n=== TEST 1: Race condition regression — same key + same payload, 2 processes ===`);
  let allPassed = true;

  for (let rep = 1; rep <= 3; rep++) {
    const { tenantId } = await seedFreshTenant();
    const sharedKey = `idem-race-${Date.now()}-${rep}`;

    const [resA, resB] = await Promise.all([
      runWorker(tenantId, 1, 0, 'FT', sharedKey),
      runWorker(tenantId, 1, 0, 'FT', sharedKey),
    ]);

    const allErrors = [...resA.errors, ...resB.errors];
    const allResults = [...resA.results, ...resB.results];
    const distinctInvoiceIds = new Set(allResults.map(r => r.id).filter(Boolean));

    console.log(`  Rep ${rep}: Process A (PID ${resA.pid}) ${resA.results.length} results / ${resA.errors.length} errors`);
    console.log(`  Rep ${rep}: Process B (PID ${resB.pid}) ${resB.results.length} results / ${resB.errors.length} errors`);
    console.log(`  Rep ${rep}: Total results=${allResults.length} errors=${allErrors.length} distinctInvoiceIds=${distinctInvoiceIds.size}`);

    const idemCount = await prisma.idempotentRequest.count({ where: { tenantId } });
    const idemResultIds = await prisma.idempotentRequest.findMany({
      where: { tenantId },
      select: { resultId: true },
    });
    const distinctResultIds = new Set(idemResultIds.map(r => r.resultId));

    // With advisory lock: both workers get a result, but both reference the SAME invoice
    const repPassed = allResults.length === 2 &&
      allErrors.length === 0 &&
      distinctInvoiceIds.size === 1 &&
      idemCount === 1 &&
      distinctResultIds.size === 1;

    console.log(`  Rep ${rep}: invoices=${allResults.length} distinctIds=${distinctInvoiceIds.size} idemRecords=${idemCount} distinctResultIds=${distinctResultIds.size} ${repPassed ? 'PASS' : 'FAIL'}`);

    const sql = await verifySQL(tenantId, 1, `Test1-Rep${rep}`, 0, true);
    const repPassed2 = repPassed && sql.passed;

    console.log(`  Rep ${rep}: FINAL ${repPassed2 ? 'PASS' : 'FAIL'}`);

    allPassed = allPassed && repPassed2;
    await cleanupTenant(tenantId);
  }

  return { passed: allPassed };
}

async function runTest2() {
  console.log(`\n=== TEST 2: Replay sequential — same key + same payload, multiple times ===`);
  const { tenantId } = await seedFreshTenant();
  const sharedKey = `idem-replay-${Date.now()}`;

  const results = [];
  const errors = [];

  for (let i = 0; i < 5; i++) {
    try {
      const inv = await runWorker(tenantId, 1, 0, 'FT', sharedKey);
      results.push(...inv.results);
      errors.push(...inv.errors);
    } catch (e) {
      errors.push({ index: i, message: e.message });
    }
  }

  const idemCount = await prisma.idempotentRequest.count({ where: { tenantId } });
  const distinctResultIds = new Set(
    (await prisma.idempotentRequest.findMany({ where: { tenantId }, select: { resultId: true } })).map(r => r.resultId)
  );
  const distinctInvoiceIds = new Set(results.map(r => r.id).filter(Boolean));

  console.log(`  Results=${results.length} errors=${errors.length} idemRecords=${idemCount} distinctResultIds=${distinctResultIds.size} distinctInvoiceIds=${distinctInvoiceIds.size}`);

  const sql = await verifySQL(tenantId, 1, `Test2-Replay`, 0, true);
  const passed = results.length === 5 && errors.length === 0 && distinctInvoiceIds.size === 1 && idemCount === 1 && distinctResultIds.size === 1 && sql.passed;

  console.log(`  Test 2 Replay: ${passed ? 'PASS' : 'FAIL'}`);
  await cleanupTenant(tenantId);
  return { passed };
}

async function runTest3() {
  console.log(`\n=== TEST 3: 100 concurrent same-key requests, 2 processes ===`);
  const { tenantId } = await seedFreshTenant();
  const sharedKey = `idem-100-${Date.now()}`;

  // 50 from process A, 50 from process B, same key, same payload (startIndex=0 for both)
  const [resA, resB] = await Promise.all([
    runWorker(tenantId, 50, 0, 'FT', sharedKey),
    runWorker(tenantId, 50, 0, 'FT', sharedKey),
  ]);

  const allErrors = [...resA.errors, ...resB.errors];
  const allResults = [...resA.results, ...resB.results];
  const distinctInvoiceIds = new Set(allResults.map(r => r.id).filter(Boolean));

  const idemCount = await prisma.idempotentRequest.count({ where: { tenantId } });
  const distinctResultIds = new Set(
    (await prisma.idempotentRequest.findMany({ where: { tenantId }, select: { resultId: true } })).map(r => r.resultId)
  );

  console.log(`  Process A (PID ${resA.pid}): ${resA.results.length} results / ${resA.errors.length} errors`);
  console.log(`  Process B (PID ${resB.pid}): ${resB.results.length} results / ${resB.errors.length} errors`);
  console.log(`  Total results=${allResults.length} errors=${allErrors.length} distinctInvoiceIds=${distinctInvoiceIds.size} idemRecords=${idemCount} distinctResultIds=${distinctResultIds.size}`);

  const sql = await verifySQL(tenantId, 1, `Test3-100SameKey`, 0, true);
  const passed = allResults.length >= 1 && distinctInvoiceIds.size === 1 && idemCount === 1 && distinctResultIds.size === 1 && sql.passed;

  console.log(`  Test 3 100-same-key: ${passed ? 'PASS' : 'FAIL'}`);
  await cleanupTenant(tenantId);
  return { passed };
}

async function runTest4() {
  console.log(`\n=== TEST 4: Same key, diff payload → IDEMPOTENCY_CONFLICT ===`);
  const { tenantId } = await seedFreshTenant();
  const sharedKey = `idem-conflict-${Date.now()}`;

  // Worker A: startIndex=0 → rate=100, Worker B: startIndex=1 → rate=200 (different payloads)
  const [resA, resB] = await Promise.all([
    runWorker(tenantId, 1, 0, 'FT', sharedKey),
    runWorker(tenantId, 1, 1, 'FT', sharedKey),
  ]);

  const allErrors = [...resA.errors, ...resB.errors];
  const allResults = [...resA.results, ...resB.results];

  const conflictErrors = allErrors.filter(e => e.code === 'IDEMPOTENCY_CONFLICT' || e.message === 'IdempotencyConflict');
  const idemCount = await prisma.idempotentRequest.count({ where: { tenantId } });
  const distinctResultIds = new Set(
    (await prisma.idempotentRequest.findMany({ where: { tenantId }, select: { resultId: true } })).map(r => r.resultId)
  );

  console.log(`  Process A: ${resA.results.length} results / ${resA.errors.length} errors`);
  console.log(`  Process B: ${resB.results.length} results / ${resB.errors.length} errors`);
  console.log(`  Total results=${allResults.length} errors=${allErrors.length} conflictErrors=${conflictErrors.length} idemRecords=${idemCount}`);

  const sql = await verifySQL(tenantId, 1, `Test4-Conflict`, 0, true);
  const passed = allResults.length === 1 && conflictErrors.length === 1 && idemCount === 1 && distinctResultIds.size === 1 && sql.passed;

  console.log(`  Test 4 Conflict: ${passed ? 'PASS' : 'FAIL'}`);
  await cleanupTenant(tenantId);
  return { passed };
}

async function runTest5() {
  console.log(`\n=== TEST 5: Different keys, 100 emissions, 2 processes ===`);
  const { tenantId } = await seedFreshTenant();

  const [resA, resB] = await Promise.all([
    runWorker(tenantId, 50, 0, 'FT'),
    runWorker(tenantId, 50, 50, 'FT'),
  ]);

  const allErrors = [...resA.errors, ...resB.errors];
  const allResults = [...resA.results, ...resB.results];
  const allNumbers = allResults.map(r => r.number);
  const allHashes = allResults.map(r => r.hash);
  const allSequences = allResults.map(r => r.chainSequence);

  const idemCount = await prisma.idempotentRequest.count({ where: { tenantId } });

  console.log(`  Process A (PID ${resA.pid}): ${resA.results.length} results / ${resA.errors.length} errors`);
  console.log(`  Process B (PID ${resB.pid}): ${resB.results.length} results / ${resB.errors.length} errors`);
  console.log(`  Total results=${allResults.length} errors=${allErrors.length} uniqueNumbers=${new Set(allNumbers).size} uniqueHashes=${new Set(allHashes).size} uniqueSeqs=${new Set(allSequences).size} idemRecords=${idemCount}`);

  const sql = await verifySQL(tenantId, 100, `Test5-DiffKeys`, 0, false);
  const passed = allResults.length === 100 && allErrors.length === 0 &&
    new Set(allNumbers).size === 100 && new Set(allHashes).size === 100 && new Set(allSequences).size === 100 && sql.passed;

  console.log(`  Test 5 Diff-keys: ${passed ? 'PASS' : 'FAIL'}`);
  await cleanupTenant(tenantId);
  return { passed };
}

async function runTest6() {
  console.log(`\n=== TEST 6: Multi-tenant — same key + same payload, 2 tenants ===`);
  const sharedKey = `idem-mt-${Date.now()}`;
  const { tenantId: tenantA } = await seedFreshTenant();
  const { tenantId: tenantB } = await seedFreshTenant();

  const [resA, resB] = await Promise.all([
    runWorker(tenantA, 1, 0, 'FT', sharedKey),
    runWorker(tenantB, 1, 0, 'FT', sharedKey),
  ]);

  const allErrors = [...resA.errors, ...resB.errors];
  const allResults = [...resA.results, ...resB.results];

  const idemA = await prisma.idempotentRequest.count({ where: { tenantId: tenantA } });
  const idemB = await prisma.idempotentRequest.count({ where: { tenantId: tenantB } });

  console.log(`  Tenant A: ${resA.results.length} results / ${resA.errors.length} errors idemRecords=${idemA}`);
  console.log(`  Tenant B: ${resB.results.length} results / ${resB.errors.length} errors idemRecords=${idemB}`);

  const sqlA = await verifySQL(tenantA, 1, `Test6-TenantA`, 0, true);
  const sqlB = await verifySQL(tenantB, 1, `Test6-TenantB`, 0, true);

  const passed = resA.results.length === 1 && resB.results.length === 1 &&
    allErrors.length === 0 && idemA === 1 && idemB === 1 && sqlA.passed && sqlB.passed;

  console.log(`  Test 6 Multi-tenant: ${passed ? 'PASS' : 'FAIL'}`);
  await cleanupTenant(tenantA);
  await cleanupTenant(tenantB);
  return { passed };
}

async function runTest7() {
  console.log(`\n=== TEST 7: Process failure during emission ===`);
  const { tenantId } = await seedFreshTenant();

  // Start a worker that will crash after lease acquire (A17 failpoint)
  process.env.A17_CRASH_AT = 'after_lease_acquire';
  let crashResult;
  try {
    crashResult = await runWorker(tenantId, 1, 0, 'FT');
  } catch (e) {
    crashResult = { error: e.message, crashed: true, results: [], errors: [] };
  } finally {
    delete process.env.A17_CRASH_AT;
  }

  const activeLeasesBefore = await prisma.emissionLease.count({ where: { tenantId, state: 'ACTIVE' } });
  console.log(`  Crash result: ${JSON.stringify(crashResult)}`);
  console.log(`  Active leases after crash: ${activeLeasesBefore}`);

  // Recovery: issue another invoice — should succeed
  const recoveryResult = await runWorker(tenantId, 1, 0, 'FT');
  const activeLeasesAfter = await prisma.emissionLease.count({ where: { tenantId, state: 'ACTIVE' } });
  console.log(`  Recovery: ${recoveryResult.results.length} results / ${recoveryResult.errors.length} errors`);
  console.log(`  Active leases after recovery: ${activeLeasesAfter}`);

  const sql = await verifySQL(tenantId, 1, `Test7-Recovery`, activeLeasesAfter, false);
  const passed = recoveryResult.results.length === 1 && recoveryResult.errors.length === 0 && sql.passed && activeLeasesBefore >= 1;

  console.log(`  Test 7 Recovery: ${passed ? 'PASS' : 'FAIL'} (staleLeaseAfterCrash=${activeLeasesBefore >= 1})`);
  await cleanupTenant(tenantId);
  return { passed };
}

async function main() {
  const results = [];

  results.push({ name: 'Test 1 Race Condition Regression', result: await runTest1() });
  results.push({ name: 'Test 2 Replay Sequential', result: await runTest2() });
  results.push({ name: 'Test 3 100 Same-Key Concurrent', result: await runTest3() });
  results.push({ name: 'Test 4 Same Key Diff Payload Conflict', result: await runTest4() });
  results.push({ name: 'Test 5 Different Keys 100 Emissions', result: await runTest5() });
  results.push({ name: 'Test 6 Multi-tenant Same Key', result: await runTest6() });
  results.push({ name: 'Test 7 Process Failure Recovery', result: await runTest7() });

  console.log('\n=== FINAL RESULTS ===');
  let allPassed = true;
  for (const r of results) {
    console.log(`  ${r.result.passed ? 'PASS' : 'FAIL'} — ${r.name}`);
    if (!r.result.passed) allPassed = false;
  }

  console.log(`\nOVERALL: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`);

  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
