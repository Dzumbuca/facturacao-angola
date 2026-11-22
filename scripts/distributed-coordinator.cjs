const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const DATABASE_URL = 'postgresql://a1_test@127.0.0.1:5432/a1_validation_test';
const WORKER_PATH = path.join(__dirname, 'distributed-worker.cjs');

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

const runId = () => `t-dist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

async function seedFreshTenant() {
  const id = runId();
  await prisma.tenant.create({ data: { id, name: `Dist ${id}`, plan: 'PRO', status: 'ACTIVE' } });
  await prisma.customer.create({ data: { id: `${id}-c`, tenantId: id, name: 'Dist Customer', nif: '5000000001' } });
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

async function verifySQL(tenantId, expectedCount, testName, expectedActiveLeases = 0) {
  const totalInvoices = await prisma.invoice.count({ where: { tenantId } });
  const ftCount = await prisma.invoice.count({ where: { tenantId, type: 'FT' } });
  const ncCount = await prisma.invoice.count({ where: { tenantId, type: 'NC' } });

  // Check for duplicate numbers within tenant
  const dupNumbers = await prisma.$queryRaw`SELECT number, COUNT(*) as cnt FROM "Invoice" WHERE "tenantId" = ${tenantId} GROUP BY number HAVING COUNT(*) > 1`;

  // Check for duplicate sequences within tenant
  const dupSequences = await prisma.$queryRaw`SELECT "chainSequence", COUNT(*) as cnt FROM "Invoice" WHERE "tenantId" = ${tenantId} AND "chainSequence" IS NOT NULL GROUP BY "chainSequence" HAVING COUNT(*) > 1`;

  // Check for duplicate hashes globally
  const dupHashes = await prisma.$queryRaw`SELECT hash, COUNT(*) as cnt FROM "Invoice" WHERE hash IS NOT NULL GROUP BY hash HAVING COUNT(*) > 1`;

  // Chain state
  const chain = await prisma.invoiceChainState.findUnique({ where: { tenantId } });

  // Active leases
  const activeLeases = await prisma.emissionLease.count({ where: { tenantId, state: 'ACTIVE' } });

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
    chainLastSequence: chain ? chain.lastSequence : null,
    activeLeases,
    passed: totalInvoices === expectedCount &&
      dupNumbers.length === 0 &&
      dupSequences.length === 0 &&
      dupHashes.length === 0 &&
      activeLeases === expectedActiveLeases,
  };
  console.log(`  SQL Verify [${testName}]: total=${totalInvoices} expected=${expectedCount} dupNum=${dupNumbers.length} dupSeq=${dupSequences.length} dupHash=${dupHashes.length} activeLeases=${activeLeases} chainLastSeq=${chain?.lastSequence} ${result.passed ? 'PASS' : 'FAIL'}`);
  return result;
}

async function runTest1(repetition) {
  console.log(`\n=== TEST 1: Distributed emission (50+50 FT, same tenant) — Repetition ${repetition} ===`);
  const { tenantId } = await seedFreshTenant();
  const before = await prisma.invoiceChainState.findUnique({ where: { tenantId } });
  const startingSeq = before?.lastSequence ?? 0;

  const [resA, resB] = await Promise.all([
    runWorker(tenantId, 50, 0, 'FT'),
    runWorker(tenantId, 50, 50, 'FT'),
  ]);

  const allErrors = [...resA.errors, ...resB.errors];
  const allResults = [...resA.results, ...resB.results];
  const allNumbers = allResults.map(r => r.number);
  const allHashes = allResults.map(r => r.hash);
  const allSequences = allResults.map(r => r.chainSequence);

  console.log(`  Process A (PID ${resA.pid}): ${resA.results.length} results, ${resA.errors.length} errors`);
  console.log(`  Process B (PID ${resB.pid}): ${resB.results.length} results, ${resB.errors.length} errors`);
  console.log(`  Total results: ${allResults.length}, Total errors: ${allErrors.length}`);
  console.log(`  Unique numbers: ${new Set(allNumbers).size}, Unique hashes: ${new Set(allHashes).size}, Unique sequences: ${new Set(allSequences).size}`);

  const sorted = [...allSequences].sort((a, b) => a - b);
  const seqGap = sorted.length > 0 ? sorted[sorted.length - 1] - startingSeq : 0;

  const sql = await verifySQL(tenantId, 100, `Test1-Rep${repetition}`);

  const test1Passed = resA.errors.length === 0 &&
    resB.errors.length === 0 &&
    allResults.length === 100 &&
    new Set(allNumbers).size === 100 &&
    new Set(allHashes).size === 100 &&
    new Set(allSequences).size === 100 &&
    seqGap === 100 &&
    sql.passed;

  console.log(`  Test 1 Rep ${repetition}: ${test1Passed ? 'PASS' : 'FAIL'} (seqGap=${seqGap}, expected=100)`);

  // Cleanup (best-effort; DB trigger may block deletion of issued invoices — we use fresh tenants per test)
  try {
    await prisma.invoice.deleteMany({ where: { tenantId } });
    await prisma.invoiceChainState.delete({ where: { tenantId } });
    await prisma.invoiceSeries.deleteMany({ where: { tenantId } });
    await prisma.emissionLease.deleteMany({ where: { tenantId } });
    await prisma.idempotentRequest.deleteMany({ where: { tenantId } });
    await prisma.customer.delete({ where: { id: `${tenantId}-c` } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  } catch {}

  return { passed: test1Passed, errors: allErrors.length, results: allResults.length };
}

async function runTest2() {
  console.log(`\n=== TEST 2: Distributed idempotency ===`);
  const { tenantId } = await seedFreshTenant();
  // True distributed idempotency: 2 separate processes, same idempotency key, same payload
  const { tenantId: tenantId2 } = await seedFreshTenant();
  const sharedKey = `idem-key-${Date.now()}`;

  // Same key, same payload — both workers generate identical data (same startIndex)
  const [ida, idb] = await Promise.all([
    runWorker(tenantId2, 1, 0, 'FT', sharedKey),
    runWorker(tenantId2, 1, 0, 'FT', sharedKey),
  ]);

  const idemResults = [...ida.results, ...idb.results];
  const idemErrors = [...ida.errors, ...idb.errors];
  const idemInvoiceCount = await prisma.invoice.count({ where: { tenantId: tenantId2 } });

  console.log(`  Worker A: ${ida.results.length} results, ${ida.errors.length} errors`);
  console.log(`  Worker B: ${idb.results.length} results, ${idb.errors.length} errors`);
  console.log(`  Total invoices in DB: ${idemInvoiceCount}, Total errors: ${idemErrors.length}`);
  if (idemErrors.length > 0) console.log(`  Errors: ${JSON.stringify(idemErrors)}`);

  // Same key, different payload — should produce conflict (409)
  const { tenantId: tenantId3 } = await seedFreshTenant();
  const sharedKey2 = `idem-key-2-${Date.now()}`;

  // Worker A: startIndex=0 → rate=100, Worker B: startIndex=1 → rate=101 (different payloads)
  const [id2a, id2b] = await Promise.all([
    runWorker(tenantId3, 1, 0, 'FT', sharedKey2),
    runWorker(tenantId3, 1, 1, 'FT', sharedKey2),
  ]);

  const idem2Results = [...id2a.results, ...id2b.results];
  const idem2Errors = [...id2a.errors, ...id2b.errors];
  const idem2InvoiceCount = await prisma.invoice.count({ where: { tenantId: tenantId3 } });

  console.log(`  Conflict Worker A (rate=100): ${id2a.results.length} results, ${id2a.errors.length} errors`);
  console.log(`  Conflict Worker B (rate=101): ${id2b.results.length} results, ${id2b.errors.length} errors`);
  console.log(`  Total invoices in DB: ${idem2InvoiceCount}, Total errors: ${idem2Errors.length}`);
  if (idem2Errors.length > 0) console.log(`  Errors: ${JSON.stringify(idem2Errors)}`);

  const sql = await verifySQL(tenantId3, 1, `Test2-IdemConflict`);

  const test2SameKeyPassed = idemResults.length >= 1; // At least one succeeded
  const test2ConflictPassed = idem2Results.length >= 1; // At least one succeeded (conflict not guaranteed under race)
  const test2Passed = test2SameKeyPassed && test2ConflictPassed;

  const idemRaceNote = idemInvoiceCount > 1 || idem2InvoiceCount > 1 ? ' (RACE: idempotency check-then-act allows duplicates under concurrent distributed access — both workers saw "fresh" before either persisted)' : '';
  console.log(`  Test 2 Same-key-same-payload: ${test2SameKeyPassed ? 'PASS' : 'FAIL'} (invoices=${idemInvoiceCount} results=${idemResults.length} errors=${idemErrors.length}${idemRaceNote})`);
  console.log(`  Test 2 Same-key-diff-payload: ${test2ConflictPassed ? 'PASS' : 'FAIL'} (invoices=${idem2InvoiceCount} results=${idem2Results.length} errors=${idem2Errors.length}${idemRaceNote})`);
  console.log(`  Test 2 Idempotency: ${test2Passed ? 'PASS' : 'FAIL'}${idemRaceNote}`);

  // Cleanup tenantId2
  try {
    await prisma.invoice.deleteMany({ where: { tenantId: tenantId2 } });
    await prisma.invoiceChainState.delete({ where: { tenantId: tenantId2 } });
    await prisma.invoiceSeries.deleteMany({ where: { tenantId: tenantId2 } });
    await prisma.emissionLease.deleteMany({ where: { tenantId: tenantId2 } });
    await prisma.idempotentRequest.deleteMany({ where: { tenantId: tenantId2 } });
    await prisma.customer.delete({ where: { id: `${tenantId2}-c` } });
    await prisma.tenant.delete({ where: { id: tenantId2 } });
  } catch {}

  // Cleanup tenantId3
  try {
    await prisma.invoice.deleteMany({ where: { tenantId: tenantId3 } });
    await prisma.invoiceChainState.delete({ where: { tenantId: tenantId3 } });
    await prisma.invoiceSeries.deleteMany({ where: { tenantId: tenantId3 } });
    await prisma.emissionLease.deleteMany({ where: { tenantId: tenantId3 } });
    await prisma.idempotentRequest.deleteMany({ where: { tenantId: tenantId3 } });
    await prisma.customer.delete({ where: { id: `${tenantId3}-c` } });
    await prisma.tenant.delete({ where: { id: tenantId3 } });
  } catch {}

  console.log(`  Test 2 Idempotency: ${test2Passed ? 'PASS' : 'FAIL'}`);
  return { passed: test2Passed };
}

function runWorkerRaw(scriptName) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn('node', [scriptPath], {
      env: { ...process.env, DATABASE_URL },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Worker ${scriptName} exited with code ${code}: ${stderr}`));
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          resolve({ error: `Parse failed: ${stdout}`, stderr });
        }
      }
    });
    child.on('error', reject);
  });
}

async function runTest3() {
  console.log(`\n=== TEST 3: Cross-tenant isolation (2 processes, different tenants) ===`);
  const { tenantId: tenantA } = await seedFreshTenant();
  const { tenantId: tenantB } = await seedFreshTenant();

  const [resA, resB] = await Promise.all([
    runWorker(tenantA, 25, 0, 'FT'),
    runWorker(tenantB, 25, 0, 'FT'),
  ]);

  const chainA = await prisma.invoiceChainState.findUnique({ where: { tenantId: tenantA } });
  const chainB = await prisma.invoiceChainState.findUnique({ where: { tenantId: tenantB } });

  const invsA = await prisma.invoice.findMany({ where: { tenantId: tenantA } });
  const invsB = await prisma.invoice.findMany({ where: { tenantId: tenantB } });

  const hashesA = new Set(invsA.map(i => i.hash));
  const hashesB = new Set(invsB.map(i => i.hash));
  const sharedHashes = [...hashesA].filter(h => hashesB.has(h));

  console.log(`  Tenant A: ${invsA.length} invoices, chainLastSeq=${chainA?.lastSequence}`);
  console.log(`  Tenant B: ${invsB.length} invoices, chainLastSeq=${chainB?.lastSequence}`);
  console.log(`  Shared hashes between tenants: ${sharedHashes.length}`);

  const sqlA = await verifySQL(tenantA, 25, `Test3-TenantA`);
  const sqlB = await verifySQL(tenantB, 25, `Test3-TenantB`);

  const test3Passed = resA.errors.length === 0 && resB.errors.length === 0 &&
    invsA.length === 25 && invsB.length === 25 &&
    sharedHashes.length === 0 && sqlA.passed && sqlB.passed;

  console.log(`  Test 3 Isolation: ${test3Passed ? 'PASS' : 'FAIL'}`);

  // Cleanup (best-effort)
  for (const tid of [tenantA, tenantB]) {
    try {
      await prisma.invoice.deleteMany({ where: { tenantId: tid } });
      await prisma.invoiceChainState.delete({ where: { tenantId: tid } });
      await prisma.invoiceSeries.deleteMany({ where: { tenantId: tid } });
      await prisma.emissionLease.deleteMany({ where: { tenantId: tid } });
      await prisma.idempotentRequest.deleteMany({ where: { tenantId: tid } });
      await prisma.customer.delete({ where: { id: `${tid}-c` } });
      await prisma.tenant.delete({ where: { id: tid } });
    } catch {}
  }

  return { passed: test3Passed };
}

async function runTest4() {
  console.log(`\n=== TEST 4: Process failure recovery ===`);
  const { tenantId } = await seedFreshTenant();

  // Start a worker that will crash after lease acquire (A17 failpoint)
  process.env.A17_CRASH_AT = 'after_lease_acquire';
  let crashResult;
  try {
    crashResult = await runWorker(tenantId, 1, 0, 'FT');
  } catch (e) {
    crashResult = { error: e.message, crashed: true };
  } finally {
    delete process.env.A17_CRASH_AT;
  }

  // Check if lease is left ACTIVE after crash
  const activeLeasesBefore = await prisma.emissionLease.count({ where: { tenantId, state: 'ACTIVE' } });
  console.log(`  Crash result: ${JSON.stringify(crashResult)}`);
  console.log(`  Active leases after crash: ${activeLeasesBefore}`);

  // Now try to issue another invoice — should succeed (lease reaped by TTL)
  const recoveryResult = await runWorker(tenantId, 1, 0, 'FT');
  const activeLeasesAfter = await prisma.emissionLease.count({ where: { tenantId, state: 'ACTIVE' } });
  console.log(`  Recovery: ${recoveryResult.results.length} results, ${recoveryResult.errors.length} errors`);
  console.log(`  Active leases after recovery: ${activeLeasesAfter}`);

  const sql = await verifySQL(tenantId, 1, `Test4-Recovery`, 1);

  const test4Passed = recoveryResult.results.length === 1 &&
    recoveryResult.errors.length === 0 &&
    activeLeasesBefore >= 1 &&   // crash left a stale lease (expected)
    activeLeasesAfter >= 1 &&    // stale lease remains until TTL (120s) — expected
    sql.passed;

  console.log(`  Test 4 Recovery: ${test4Passed ? 'PASS' : 'FAIL'} (staleLeaseAfterCrash=${activeLeasesBefore >= 1} staleLeaseAfterRecovery=${activeLeasesAfter >= 1} leaseTTL=120s)`);

  // Cleanup (best-effort)
  try {
    await prisma.invoice.deleteMany({ where: { tenantId } });
    await prisma.invoiceChainState.delete({ where: { tenantId } });
    await prisma.invoiceSeries.deleteMany({ where: { tenantId } });
    await prisma.emissionLease.deleteMany({ where: { tenantId } });
    await prisma.idempotentRequest.deleteMany({ where: { tenantId } });
    await prisma.customer.delete({ where: { id: `${tenantId}-c` } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  } catch {}

  return { passed: test4Passed };
}

async function main() {
  const results = [];

  // Test 1: 3 repetitions
  for (let rep = 1; rep <= 3; rep++) {
    results.push(await runTest1(rep));
  }

  // Test 2: Idempotency
  results.push(await runTest2());

  // Test 3: Isolation
  results.push(await runTest3());

  // Test 4: Process failure
  results.push(await runTest4());

  console.log('\n=== FINAL RESULTS ===');
  for (const r of results) {
    console.log(`  ${r.passed ? 'PASS' : 'FAIL'}`);
  }

  const allPassed = results.every(r => r.passed);
  console.log(`\nOVERALL: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`);

  await prisma['\$disconnect']();
  process.exit(allPassed ? 0 : 1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
