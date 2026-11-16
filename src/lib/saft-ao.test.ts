import { describe, it, expect } from 'vitest';

// Unit-level test: SAF-T query patterns (integration would require full DB)
describe('SAF-T integration — query shape', () => {
  it('exports only ISSUED and ANULADA documents', async () => {
    // Read saft-ao.ts to verify query restriction
    const fs = await import('fs');
    const path = await import('path');
    const saft = fs.readFileSync(path.join(process.cwd(), 'src/lib/saft-ao.ts'), 'utf8');
    expect(saft).toMatch(/status:\s*\{\s*in:\s*\['ISSUED',\s*'ANULADA'\]/);
  });

  it('orders items by position', async () => {
    const fs = await import('fs');
    const saft = fs.readFileSync('src/lib/saft-ao.ts', 'utf8');
    expect(saft).toMatch(/orderBy:\s*\{\s*position:\s*'asc'/);
  });

  it('contains SoftwareCertificateNumber placeholder', async () => {
    const fs = await import('fs');
    const saft = fs.readFileSync('src/lib/saft-ao.ts', 'utf8');
    expect(saft).toMatch(/SoftwareCertificateNumber/);
  });
});
