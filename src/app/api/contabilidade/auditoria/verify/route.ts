import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { verifyAuditChain } from '@/lib/audit-verifier';

export async function POST(_req: NextRequest) {
  const tenantId = await getSessionTenantId(await auth());
  if (!tenantId) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  try {
    const result = await verifyAuditChain(tenantId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'VERIFICATION_FAILED', message: String(err?.message ?? 'unknown') },
      { status: 500 },
    );
  }
}
