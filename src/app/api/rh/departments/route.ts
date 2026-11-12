import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

export async function GET() {
  try {
    const access = await requireRhAccess();
    const rows = await runWithTenant(access.tenantId, (tx) => tx.rhDepartment.findMany({
      where: { tenantId: access.tenantId },
      include: { _count: { select: { employees: true, positions: true, children: true } } },
      orderBy: { name: 'asc' },
    }), { userId: access.userId });
    return NextResponse.json(rows);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess();
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 100) return NextResponse.json({ error: 'Nome do departamento inválido.' }, { status: 400 });
    const created = await runWithTenant(access.tenantId, async (tx) => {
      if (body.parentId) {
        const parentId = String(body.parentId);
        const parent = await tx.rhDepartment.findFirst({ where: { id: parentId, tenantId: access.tenantId }, select: { id: true } });
        if (!parent) throw new Error('PARENT_NOT_FOUND');

        // Detecção de ciclo: sobe a cadeia de ancestrais do pai; se exceder 12 níveis ou repetir nó, é ciclo.
        let cursor: string | null = parentId;
        const seen = new Set<string>();
        for (let depth = 0; depth < 12 && cursor; depth++) {
          if (seen.has(cursor)) throw new Error('CICLO_DETETADO');
          seen.add(cursor);
          const next: { parentId: string | null } | null = await tx.rhDepartment.findFirst({ where: { id: cursor, tenantId: access.tenantId }, select: { parentId: true } });
          cursor = next?.parentId ?? null;
        }
        if (cursor) throw new Error('CICLO_DETETADO');
      }
      const row = await tx.rhDepartment.create({
        data: {
          tenantId: access.tenantId,
          name,
          code: body.code?.trim() || null,
          parentId: body.parentId || null,
          managerName: body.managerName?.trim() || null,
          description: body.description?.trim() || null,
        },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_DEPARTMENT_CREATED', entity: 'RhDepartment', entityId: row.id, metadata: { name } });
      return row;
    }, { userId: access.userId });
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Já existe um departamento com esse nome.' }, { status: 409 });
    if (error?.message === 'PARENT_NOT_FOUND') return NextResponse.json({ error: 'Departamento pai inválido.' }, { status: 400 });
    if (error?.message === 'CICLO_DETETADO') return NextResponse.json({ error: 'Hierarquia inválida (ciclo detectado). Não podes tornar um departamento pai de um dos seus descendentes.' }, { status: 400 });
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
