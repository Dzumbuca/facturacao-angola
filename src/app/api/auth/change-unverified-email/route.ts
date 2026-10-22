import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { allowEmailRequest, sendEmailActionToken } from '@/lib/email-actions';

const response = { success: true, message: 'Se os dados corresponderem a uma conta pendente, enviaremos instruções para o novo endereço.' };
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const currentEmail = typeof body?.currentEmail === 'string' ? body.currentEmail.trim().toLowerCase() : '';
    const newEmail = typeof body?.newEmail === 'string' ? body.newEmail.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (![currentEmail, newEmail].every((email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || password.length > 128) return NextResponse.json(response);
    if (!await allowEmailRequest('email-change', currentEmail, 3)) return NextResponse.json(response);
    const db = prisma as any;
    const user = await db.user.findUnique({ where: { email: currentEmail }, select: { id: true, name: true, email: true, password: true, emailVerified: true, emailVerificationRequired: true } });
    if (!user?.password || !user.emailVerificationRequired || user.emailVerified || !await bcrypt.compare(password, user.password)) return NextResponse.json(response);
    const changed = await db.$transaction(async (tx: any) => {
      const result = await tx.user.updateMany({ where: { id: user.id, email: currentEmail, emailVerificationRequired: true, emailVerified: null }, data: { email: newEmail, sessionVersion: { increment: 1 } } });
      if (result.count !== 1) return false;
      await tx.marketingPreference.updateMany({ where: { userId: user.id }, data: { email: newEmail, subscribed: false, unsubscribedAt: new Date() } });
      await tx.adminAuditLog.create({ data: { actorUserId: user.id, actorType: 'USER', action: 'UNVERIFIED_EMAIL_CHANGED', resourceType: 'USER', resourceId: user.id } });
      return true;
    });
    if (!changed) return NextResponse.json(response);
    await sendEmailActionToken({ ...user, email: newEmail }, 'VERIFY_EMAIL');
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(response);
  }
}
