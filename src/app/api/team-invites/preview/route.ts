import { NextResponse } from 'next/server';
import { previewTeamInvite } from '@/lib/team-invite-actions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const invite = await previewTeamInvite(typeof body?.token === 'string' ? body.token : '');
    return invite ? NextResponse.json({ invite }) : NextResponse.json({ error: 'Convite inválido ou expirado.' }, { status: 400 });
  } catch { return NextResponse.json({ error: 'Não foi possível validar o convite.' }, { status: 500 }); }
}
