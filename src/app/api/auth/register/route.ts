import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { validateRegistration } from '@/lib/registration-validation';
import { sendEmailActionToken } from '@/lib/email-actions';
import { createUnsubscribeToken, hashEmailToken } from '@/lib/email-actions';
import { clientIp, rateLimit, tooManyRequestsResponse } from '@/lib/rate-limit';
import { runAsSystem, PRIVILEGED_RLS } from '@/lib/tenant-db';

export async function POST(req: Request) {
  const limiter = rateLimit(`register:${clientIp(req)}`, 5, 60_000);
  if (!limiter.ok) return tooManyRequestsResponse(limiter.retryAfterSeconds);
  try {
    const body = await req.json();
    const validationError = validateRegistration(body ?? {});
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const name = (body.name as string).trim();
    const email = (body.email as string).trim().toLowerCase();
    const password = body.password as string;
    const tenantName = (body.tenantName as string).trim();

    // RLS: pre-registration lookup/creation is server-controlled identity bootstrap (no authenticated tenant context yet).
    const existingUser = await runAsSystem((tx) => (tx.user as any).findUnique({ where: { email }, select: { id: true } }), PRIVILEGED_RLS);
    if (existingUser) return NextResponse.json({ success: true, message: 'Se o registo puder ser concluído, receberá instruções no email indicado.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await runAsSystem((tx) => tx.$transaction(async (inner: any) => {
      const tenant = await inner.tenant.create({ data: { name: tenantName, nif: null } });
      const user = await inner.user.create({
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
        const preference = await inner.marketingPreference.create({ data: {
          userId: user.id, email, subscribed: true, consentAt: new Date(), consentSource: 'registration', consentVersion: '2026-01',
        }, select: { id: true } });
        await inner.marketingPreference.update({ where: { id: preference.id }, data: { unsubscribeTokenHash: hashEmailToken(createUnsubscribeToken(preference.id)) } });
      }
      return user;
    }), PRIVILEGED_RLS) as any;

    await sendEmailActionToken(newUser, 'VERIFY_EMAIL');
    return NextResponse.json({ success: true, message: 'Se o registo puder ser concluído, receberá instruções no email indicado.' });
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') return NextResponse.json({ success: true, message: 'Se o registo puder ser concluído, receberá instruções no email indicado.' });
    console.error('Erro ao registar utilizador.');
    return NextResponse.json({ error: 'Não foi possível concluir o registo. Tente novamente.' }, { status: 500 });
  }
}