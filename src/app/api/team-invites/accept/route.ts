import { NextResponse } from 'next/server';
import { acceptTeamInvite } from '@/lib/team-invite-actions';

export async function POST(request: Request) {
  try {
    const result = await acceptTeamInvite(await request.json());
    return NextResponse.json({ success: result.ok, message: result.message }, { status: result.ok ? 200 : 400 });
  } catch { return NextResponse.json({ success: false, message: 'Não foi possível aceitar o convite.' }, { status: 500 }); }
}
