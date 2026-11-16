// Cross-platform build wrapper that handles the Windows-specific Turbopack EPERM
// problems found in this repository. Use this instead of `npx next build` directly.
//
// 1. Remove stale `.next/node_modules/*` Windows junctions (their locks prevent
//    unlink: "errno=-4048" EPERM errors).
// 2. Remove stale `.prisma/client/query_engine-windows.dll.node.tmpXXXX` files
//    (left by aborted prisma generate runs).
// 3. Optionally regenerate Prisma client with --regenerate flag.
// 4. Invoke next build with the correct cwd.
//
// Why (technical explanation, not a hidden workaround):
// Windows NTFS junctions created by Turbopack's external-modules caching in
// .next/node_modules/<package>-<hash>/ are not safe to delete while Node keeps
// the parent directory mapped. Subsequent `next build` cannot unlink them and
// the whole compilation fails with EPERM. This limitation does not exist on POSIX
// systems (Linux / macOS), where Directory Removal is safe while Node is running.
//
// Usage:
//   node tools/scripts/build.mjs                # next build with pre-clean
//   node tools/scripts/build.mjs --regenerate   # prisma generate && next build

import { execSync } from 'child_process';
import { existsSync, readdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NODE_MODULES = path.join(ROOT, '.next', 'node_modules');
const PRISMA_CLIENT_DIR = path.join(ROOT, 'node_modules', '.prisma', 'client');

console.log('[build] cleaning stale .next/node_modules (Windows junction workaround)');

if (existsSync(NODE_MODULES)) {
  for (const entry of readdirSync(NODE_MODULES)) {
    try {
      rmSync(path.join(NODE_MODULES, entry), { recursive: true, force: true });
      console.log(`[build] cleaned .next/node_modules/${entry}`);
    } catch (e) {
      console.warn(`[build] cannot remove ${entry}: ${e.message}`);
    }
  }
}

try {
  for (const name of readdirSync(PRISMA_CLIENT_DIR)) {
    if (/\.tmp\d+$/.test(name)) {
      try {
        rmSync(path.join(PRISMA_CLIENT_DIR, name), { force: true });
        console.log(`[build] removed stale prisma stub: ${name}`);
      } catch (e) {
        console.warn(`[build] cannot remove ${name}: ${e.message}`);
      }
    }
  }
} catch {}

if (process.argv.includes('--regenerate')) {
  try {
    execSync('npx prisma generate --schema=prisma/schema.prisma', { stdio: 'inherit', cwd: ROOT });
    console.log('[build] prisma generate done.');
  } catch (e) {
    console.error(`[build] prisma generate failed (exit ${e.status})`);
    process.exit(e.status ?? 1);
  }
}

try {
  execSync('npx next build', { stdio: 'inherit', cwd: ROOT });
  console.log('[build] done.');
} catch (e) {
  console.error(`[build] failed (exit ${e.status})`);
  process.exit(e.status ?? 1);
}
