import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

/** Marca um ruleset como VALIDADO com evidência documental. Não inventa evidência. */
export async function POST(req: Request) {
  try {
    const access = await requireRhAccess('settings:write');
    const body = await req.json().catch(() => ({}));
    const rulesetId = typeof body.rulesetId === 'string' ? body.rulesetId : '';
    const documentUrl = typeof body.documentUrl === 'string' && body.documentUrl.trim() ? body.documentUrl.trim().slice(0, 1000) : null;
    const validatedByName = typeof body.validatedByName === 'string' && body.validatedByName.trim() ? body.validatedByName.trim().slice(0, 160) : null;
    if (!rulesetId) return NextResponse.json({ error: 'Ruleset obrigatório.' }, { status: 400 });
    if (!documentUrl) return NextResponse.json({ error: 'É necessário anexar a evidência documental (URL).' }, { status: 400 });
    if (!validatedByName) return NextResponse.json({ error: 'Identificar quem valida (nome e função).' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const existing = await tx.rhPayrollRuleSet.findFirst({ where: { id: rulesetId, tenantId: access.tenantId }, select: { id: true, legalStatus: true } });
      if (!existing) return { code: 'NOT_FOUND' as const };
      const updated = await tx.rhPayrollRuleSet.update({
        where: { id: rulesetId },
        data: { legalStatus: 'VALIDADO', legalDocumentUrl: documentUrl, legalValidatedBy: validatedByName, legalValidatedAt: new Date() },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_PAYROLL_RULESET_LEGAL_VALIDATED', entity: 'RhPayrollRuleSet', entityId: rulesetId, metadata: { documentUrl, validatedByName } });
      return { code: 'OK' as const, updated };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Conjunto de regras não encontrado.' }, { status: 404 });
    return NextResponse.json(result.updated);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}