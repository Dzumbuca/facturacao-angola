import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const routes: [string, string[]][] = [
  ['src/app/api/company-profile/route.ts', ['getTenantReadAccess', "getTenantWriteAccess('company_settings')"]],
  ['src/app/api/company-profile/bank-accounts/route.ts', ['getTenantReadAccess', "getTenantWriteAccess('company_settings')"]],
  ['src/app/api/company-profile/bank-accounts/[id]/route.ts', ["getTenantWriteAccess('company_settings')"]],
  ['src/app/api/customers/route.ts', ['getTenantReadAccess', 'getTenantWriteAccess()']],
  ['src/app/api/produtos/route.ts', ['getTenantReadAccess', 'getTenantWriteAccess()']],
  ['src/app/api/invoices/drafts/route.ts', ['getTenantReadAccess', 'getTenantWriteAccess()']],
  ['src/app/api/invoices/drafts/[id]/route.ts', ['getTenantReadAccess', 'getTenantWriteAccess()']],
  ['src/app/api/invoices/drafts/[id]/issue/route.ts', ['getTenantWriteAccess()']],
  ['src/app/api/invoices/generate-pdf/route.ts', ['getTenantWriteAccess()']],
  ['src/app/api/invoices/generate-saft/route.ts', ['getTenantReadAccess']],
  ['src/app/api/invoices/[id]/payments/route.ts', ['getTenantReadAccess', 'getTenantWriteAccess()']],
  ['src/app/api/invoices/[id]/pdf/route.ts', ['getTenantReadAccess']],
  ['src/app/api/payments/[id]/status/route.ts', ['getTenantWriteAccess()']],
  ['src/app/api/reports/export/route.ts', ['getTenantReadAccess']],
];

describe('tenant API route security coverage', () => {
  it.each(routes)('%s revalidates the current actor and applies read/write policy', (file, guards) => {
    const source = readFileSync(resolve(root, file), 'utf8');
    expect(source).not.toContain('getSessionTenantId');
    for (const guard of guards) expect(source).toContain(guard);
  });
});
