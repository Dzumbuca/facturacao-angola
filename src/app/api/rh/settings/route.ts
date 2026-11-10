import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

export async function GET() {
  try {
    const access = await requireRhAccess();
    const settings = (await runWithTenant(access.tenantId, (tx) => tx.rhSettings.findUnique({ where: { tenantId: access.tenantId } }), { userId: access.userId })) as { vacationDaysPerYear: number | null } | null;
    return NextResponse.json({ vacationDaysPerYear: settings?.vacationDaysPerYear ?? null });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(req: Request) {
  try {
    const access = await requireRhAccess();
    const body = await req.json().catch(() => ({}));
    const raw = body.vacationDaysPerYear;
    if (raw !== null && raw !== undefined && raw !== '') {
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 0 || value > 365) {
        return NextResponse.json({ error: 'Direito anual inválido (0–365 dias).' }, { status: 400 });
      }
      await runWithTenant(access.tenantId, async (tx) => {
        await tx.rhSettings.upsert({
          where: { tenantId: access.tenantId },
          update: { vacationDaysPerYear: value },
          create: { tenantId: access.tenantId, vacationDaysPerYear: value },
        });
        await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_SETTINGS_UPDATED', entity: 'RhSettings', entityId: access.tenantId, metadata: { vacationDaysPerYear: value } });
      }, { userId: access.userId });
      return NextResponse.json({ vacationDaysPerYear: value });
    }

    await runWithTenant(access.tenantId, async (tx) => {
      await tx.rhSettings.upsert({
        where: { tenantId: access.tenantId },
        update: { vacationDaysPerYear: null },
        create: { tenantId: access.tenantId, vacationDaysPerYear: null },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_SETTINGS_UPDATED', entity: 'RhSettings', entityId: access.tenantId, metadata: { vacationDaysPerYear: null } });
    }, { userId: access.userId });
    return NextResponse.json({ vacationDaysPerYear: null });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
