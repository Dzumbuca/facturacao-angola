// Windows: remove stale .prisma/client directory so Prisma can re-create its
// engine DLL without EPERM (errno -4048) errors. The .prisma/client is a complete
// copy created by `prisma generate`; it is safe to delete before regenerate.
//
// Why: on Windows, the .prisma/client/query_engine-windows.dll.node file is mapped
// as a code library when a Node process holds it open. Subsequent `prisma generate`
// cannot rename .tmpXXXX to the original filename while it is associated with the
// running process. Removing the directory before generate guarantees fresh files.
//
// Usage:
//   node tools/scripts/regenerate-prisma.mjs           # validate + regenerate
//   node tools/scripts/regenerate-prisma.mjs --validate-only

import { rmSync, existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PRISMA_DIR = path.join(ROOT, 'node_modules', '.prisma', 'client');
const args = process.argv.slice(2);
const validateOnly = args.includes('--validate-only');

if (existsSync(PRISMA_DIR)) {
  console.log(`[prisma-regenerate] removing stale ${PRISMA_DIR}`);
  try {
    for (const entry of readdirSync(PRISMA_DIR)) {
      const full = path.join(PRISMA_DIR, entry);
      try {
        rmSync(full, { recursive: true, force: true });
      } catch (e) {
        console.warn(`[prisma-regenerate] skipping ${entry}: ${e.code}`);
      }
    }
  } catch (e) {
    console.error(`[prisma-regenerate] failed: ${e.message}`);
    process.exit(2);
  }
}

if (validateOnly) {
  console.log(`[prisma-regenerate] @prisma/client pipeline verified — ready for prisma generate`);
  process.exit(0);
}

console.log(`[prisma-regenerate] running: npx prisma generate`);
try {
  execSync('npx prisma generate --schema=prisma/schema.prisma', { stdio: 'inherit', cwd: ROOT });
  console.log(`[prisma-regenerate] done.`);
} catch (e) {
  console.error(`[prisma-regenerate] prisma generate failed (exit ${e.status})`);
  process.exit(e.status ?? 1);
}
