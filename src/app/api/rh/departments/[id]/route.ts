import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireRhAccess('employees:write');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const data: {
      name?: string;
      code?: string | null;
      managerName?: string | null;
      parentId?: string | null;
      description?: string | null;
    } = {};

    if (body.name !== undefined) {
      const name = String(body.name ?? '').trim();
      if (!name || name.length > 100) return NextResponse.json({ error: 'Nome do departamento inválido.' }, { status: 400 });
      data.name = name;
    }
    if (body.code !== undefined) data.code = body.code ? String(body.code).trim() : null;
    if (body.managerName !== undefined) data.managerName = body.managerName ? String(body.managerName).trim() : null;
    if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
    if (body.parentId !== undefined) data.parentId = body.parentId ? String(body.parentId) : null;

    const updated = await runWithTenant(access.tenantId, async (tx) => {
      const target = await tx.rhDepartment.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true, parentId: true } });
      if (!target) throw new Error('NOT_FOUND');

      if (data.parentId !== undefined && data.parentId !== null) {
        const parentId = data.parentId;
        if (parentId === id) throw new Error('CICLO_DETETADO');
        const parent = await tx.rhDepartment.findFirst({ where: { id: parentId, tenantId: access.tenantId }, select: { id: true } });
        if (!parent) throw new Error('PARENT_NOT_FOUND');

        // Sobe a partir do pai: detecta se algum ancestral contém o próprio nó atual → ciclo.
        let cursor: string | null = parentId;
        const seen = new Set<string>();
        for (let depth = 0; depth < 12 && cursor; depth++) {
          if (cursor === id) throw new Error('CICLO_DETETADO');
          if (seen.has(cursor)) throw new Error('CICLO_DETETADO');
          seen.add(cursor);
          const next: { parentId: string | null } | null = await tx.rhDepartment.findFirst({ where: { id: cursor, tenantId: access.tenantId }, select: { parentId: true } });
          cursor = next?.parentId ?? null;
        }
        if (cursor) throw new Error('CICLO_DETETADO');
      }

      const row = await tx.rhDepartment.update({ where: { id }, data });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_DEPARTMENT_UPDATED', entity: 'RhDepartment', entityId: row.id, metadata: data });
      return row;
    }, { userId: access.userId });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Departamento não encontrado.' }, { status: 404 });
    if (error?.message === 'PARENT_NOT_FOUND') return NextResponse.json({ error: 'Departamento pai inválido.' }, { status: 400 });
    if (error?.message === 'CICLO_DETETADO') return NextResponse.json({ error: 'Hierarquia inválida: um departamento não pode ser pai de si próprio nem dos seus descendentes.' }, { status: 400 });
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Já existe um departamento com esse nome.' }, { status: 409 });
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
