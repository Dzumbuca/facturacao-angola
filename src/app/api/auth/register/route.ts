import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { validateRegistration } from '@/lib/registration-validation';
import { sendEmailActionToken } from '@/lib/email-actions';
import { createUnsubscribeToken, hashEmailToken } from '@/lib/email-actions';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validationError = validateRegistration(body ?? {});
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const name = (body.name as string).trim();
    const email = (body.email as string).trim().toLowerCase();
    const password = body.password as string;
    const tenantName = (body.tenantName as string).trim();

    const existingUser = await (prisma.user as any).findUnique({ where: { email }, select: { id: true } });
    if (existingUser) return NextResponse.json({ success: true, message: 'Se o registo puder ser concluído, receberá instruções no email indicado.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await (prisma as any).$transaction(async (tx: any) => {
      const tenant = await tx.tenant.create({ data: { name: tenantName, nif: null } });
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          tenantId: tenant.id,
          tenantRole: 'COMPANY_ADMIN',
          platformRole: 'NONE',
          emailVerificationRequired: true,
        },
        select: { id: true, name: true, email: true },
      });
      if (body.marketingConsent === true) {
        const preference = await tx.marketingPreference.create({ data: {
          userId: user.id, email, subscribed: true, consentAt: new Date(), consentSource: 'registration', consentVersion: '2026-01',
        }, select: { id: true } });
        await tx.marketingPreference.update({ where: { id: preference.id }, data: { unsubscribeTokenHash: hashEmailToken(createUnsubscribeToken(preference.id)) } });
      }
      return user;
    });

    await sendEmailActionToken(newUser, 'VERIFY_EMAIL');
    return NextResponse.json({ success: true, message: 'Se o registo puder ser concluído, receberá instruções no email indicado.' });
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') return NextResponse.json({ success: true, message: 'Se o registo puder ser concluído, receberá instruções no email indicado.' });
    console.error('Erro ao registar utilizador.');
    return NextResponse.json({ error: 'Não foi possível concluir o registo. Tente novamente.' }, { status: 500 });
  }
}
