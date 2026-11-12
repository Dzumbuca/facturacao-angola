import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

const PRIORITIES = ['BAIXA', 'NORMAL', 'ALTA'] as const;

export async function GET(_req: Request) {
  try {
    const access = await requireRhAccess();
    const now = new Date();
    const rows = (await runWithTenant(access.tenantId, (tx) => tx.rhAnnouncement.findMany({
      where: { tenantId: access.tenantId, publishedAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: [{ priority: 'asc' }, { publishedAt: 'desc' }],
      take: 50,
    }), { userId: access.userId })) as any[];
    return NextResponse.json(rows);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess('employees:write');
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.body === 'string' ? body.body.trim() : '';
    const priority = PRIORITIES.includes(body.priority) ? body.priority : 'NORMAL';
    const expiresAt = typeof body.expiresAt === 'string' && body.expiresAt ? new Date(`${body.expiresAt}T23:59:59.999Z`) : null;
    if (!title || title.length > 200) return NextResponse.json({ error: 'Título obrigatório (até 200 caracteres).' }, { status: 400 });
    if (!content || content.length > 4000) return NextResponse.json({ error: 'Conteúdo obrigatório (até 4000 caracteres).' }, { status: 400 });
    if (expiresAt && Number.isNaN(expiresAt.getTime())) return NextResponse.json({ error: 'Data de validade inválida.' }, { status: 400 });

    const row = await runWithTenant(access.tenantId, async (tx) => {
      const created = await tx.rhAnnouncement.create({
        data: { tenantId: access.tenantId, title, body: content, priority, expiresAt, createdByUserId: access.userId },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_ANNOUNCEMENT_CREATED', entity: 'RhAnnouncement', entityId: created.id, metadata: { title, priority } });
      return created;
    }, { userId: access.userId });

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}