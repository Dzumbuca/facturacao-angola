import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';
import { notifyRhUsers } from '@/lib/rh-notify';

const CANDIDATE_STATUSES = ['RECEBIDA', 'TRIAGEM', 'ENTREVISTA', 'AVALIACAO', 'APROVADO', 'REJEITADO', 'ADMITIDO'] as const;
type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export async function GET(req: Request) {
  try {
    const access = await requireRhAccess();
    const url = new URL(req.url);
    const openingId = url.searchParams.get('openingId');
    const status = url.searchParams.get('status');
    const candidates = (await runWithTenant(access.tenantId, (tx) => tx.rhCandidate.findMany({
      where: {
        tenantId: access.tenantId,
        ...(openingId ? { jobOpeningId: openingId } : {}),
        ...(status && CANDIDATE_STATUSES.includes(status as any) ? { status: status as any } : {}),
      },
      include: {
        jobOpening: { select: { id: true, title: true } },
        events: { orderBy: { createdAt: 'desc' }, take: 5, select: { toStatus: true, fromStatus: true, note: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }), { userId: access.userId })) as any[];
    return NextResponse.json(candidates);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess('employees:write');
    const body = await req.json().catch(() => ({}));
    const openingId = typeof body.jobOpeningId === 'string' ? body.jobOpeningId : '';
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;
    const cvUrl = typeof body.cvUrl === 'string' && body.cvUrl.trim() ? body.cvUrl.trim().slice(0, 500) : null;
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null;
    if (!openingId) return NextResponse.json({ error: 'Vaga obrigatória.' }, { status: 400 });
    if (!firstName || !lastName) return NextResponse.json({ error: 'Nome e apelido obrigatórios.' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const opening = await tx.rhJobOpening.findFirst({ where: { id: openingId, tenantId: access.tenantId }, select: { id: true, status: true, title: true } });
      if (!opening) return { code: 'NOT_FOUND' as const };
      if (opening.status !== 'ABERTA') return { code: 'CLOSED' as const };
      const candidate = await tx.rhCandidate.create({
        data: {
          tenantId: access.tenantId, jobOpeningId: openingId,
          firstName, lastName, email, phone, cvUrl, notes,
          status: 'RECEBIDA',
          events: { create: { tenantId: access.tenantId, toStatus: 'RECEBIDA', note: 'Candidatura recebida.', createdByUserId: access.userId } },
        },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_CANDIDATE_CREATED', entity: 'RhCandidate', entityId: candidate.id, metadata: { openingId, email } });
      await notifyRhUsers(tx, {
        tenantId: access.tenantId,
        roles: ['MANAGER', 'ADMIN'],
        title: 'Nova candidatura',
        body: `${firstName} ${lastName} · ${opening.title}`,
        entityType: 'RhCandidate',
        entityId: candidate.id,
      });
      return { code: 'OK' as const, candidate };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Vaga não encontrada.' }, { status: 404 });
    if (result.code === 'CLOSED') return NextResponse.json({ error: 'A vaga não está aberta a candidaturas.' }, { status: 409 });
    return NextResponse.json(result.candidate, { status: 201 });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}