import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { runReconciliation } from '@/lib/reconciliation-service';
import { isApplicationEnabled } from '@/lib/platform-apps';

export async function POST() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  // Soft capability gate — reconciliation available to all plans, but we keep the pattern conservative
  try {
    const r = await runReconciliation(tenantId, null);
    return NextResponse.json({ ok: true, runId: r.runId, issuesFound: r.issuesFound, rulesClaimed: r.rulesClaimed });
  } catch (e: any) {
    console.error('RECONCILIATION_ERROR', e);
    return NextResponse.json({ error: e?.message ?? 'Falha ao reconciliar.' }, { status: 500 });
  }
}
