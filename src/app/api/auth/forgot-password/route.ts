import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { allowEmailRequest, sendEmailActionToken } from '@/lib/email-actions';

const response = { success: true, message: 'Se existir uma conta associada, receberá instruções de recuperação.' };
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json(response);
    if (!await allowEmailRequest('reset', email, 3)) return NextResponse.json(response);
    const user = await (prisma.user as any).findFirst({ where: { email, status: 'ACTIVE' }, select: { id: true, name: true, email: true } });
    if (user?.email) await sendEmailActionToken(user, 'PASSWORD_RESET');
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(response);
  }
}
