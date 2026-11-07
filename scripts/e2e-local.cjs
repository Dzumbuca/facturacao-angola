#!/usr/bin/env node
/*
 * E2E local num só comando:
 *   node scripts/e2e-local.cjs            # build + migrations + seed + servidor + suites
 *   node scripts/e2e-local.cjs --skip-build
 *
 * Requer: Docker com a BD descartável de `.env.e2e.local` (wms_e2e_disposable em 5441).
 * NUNCA usar com DATABASE_URL de staging/produção.
 */
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.E2E_PORT || '3002';
const APP_URL = process.env.E2E_APP_URL || `http://localhost:${PORT}`;
const skipBuild = process.argv.includes('--skip-build');

function readEnvFile() {
  const file = path.join(ROOT, '.env.e2e.local');
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^"|"$/g, '');
  }
  return env;
}

function assertDisposable(url) {
  if (!/\/wms_e2e_disposable(\?|$)/.test(url) || !/:5441\//.test(url)) {
    throw new Error('DATABASE_URL não aponta para a BD descartável wms_e2e_disposable:5441. Abortado.');
  }
}

function run(cmd, args, extraEnv = {}) {
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (res.status !== 0) throw new Error(`Comando falhou (${res.status}): ${cmd} ${args.join(' ')}`);
}

async function waitForServer(url, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/auth/csrf`);
      if (res.ok) return;
    } catch { /* servidor ainda a arrancar */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Servidor não ficou pronto em ${APP_URL}`);
}

function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  } catch { /* melhor esforço */ }
}

(async () => {
  const env = readEnvFile();
  const databaseUrl = process.env.DATABASE_URL || env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL ausente.');
  assertDisposable(databaseUrl);

  console.log(`\n[1/5] Build${skipBuild ? ' (ignorado)' : ''}`);
  if (!skipBuild) run('npm', ['run', 'build'], { DATABASE_URL: databaseUrl });
  else if (!fs.existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) {
    throw new Error('Sem build de produção (.next/BUILD_ID). Corre sem --skip-build.');
  }

  console.log('\n[2/5] Migrations + Prisma Client');
  run('npx', ['prisma', 'generate'], { DATABASE_URL: databaseUrl });
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: databaseUrl });

  console.log('\n[3/5] Seed sintético');
  run('node', ['tests/e2e/wms/seed.mjs'], { DATABASE_URL: databaseUrl });

  console.log('\n[4/5] Servidor de produção em ' + APP_URL);
  const server = spawn('npx', ['next', 'start', '-p', PORT], {
    cwd: ROOT,
    shell: true,
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: databaseUrl, NEXTAUTH_URL: APP_URL },
  });

  let exitCode = 0;
  try {
    await waitForServer(APP_URL);
    console.log('Servidor pronto.');

    console.log('\n[5/5] Suites E2E');
    run('npx', ['vitest', 'run', '--config', 'vitest.e2e.config.ts'], { APP_URL, DATABASE_URL: databaseUrl });
    run('npx', ['playwright', 'test'], { APP_URL, DATABASE_URL: databaseUrl });
  } catch (err) {
    exitCode = 1;
    console.error('\nE2E falhou:', err.message);
  } finally {
    stopServer(server);
  }
  process.exit(exitCode);
})().catch((err) => {
  console.error('\nE2E local falhou:', err.message);
  process.exit(1);
});
