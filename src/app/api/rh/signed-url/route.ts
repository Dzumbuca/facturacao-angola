import { NextResponse } from 'next/server';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { signReadUrl } from '@/lib/rh-storage';

/** Gera um signed URL de leitura (uma hora) para um path no bucket privado. */
export async function GET(req: Request) {
  try {
    const access = await requireRhAccess();
    const url = new URL(req.url);
    const path = url.searchParams.get('path');
    if (!path) return NextResponse.json({ error: 'path obrigatório.' }, { status: 400 });

    const signed = await signReadUrl(path, 3600);
    if (!signed) return NextResponse.json({ error: 'Não foi possível gerar o link.' }, { status: 404 });
    return NextResponse.json({ url: signed });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
