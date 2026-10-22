'use server';

import { requirePlatformPermission } from '@/lib/admin-auth';
import { createPublicEmailUrl, escapeEmailHtml, verifySmtpConnection } from '@/lib/email-core';
import { createUnsubscribeToken, hashEmailToken, sendAndRecordEmail } from '@/lib/email-actions';
import { prisma } from '@/lib/prisma';

const db = prisma as any;

export async function checkSmtpAction() {
  try {
    await requirePlatformPermission('emails.manage');
    const result = await verifySmtpConnection();
    return result.ok ? { ok: true, message: 'Ligação SMTP autenticada e pronta. Nenhum email foi enviado.' } : {
      ok: false,
      message: result.code === 'SMTP_CONFIGURATION'
        ? `Configuração inválida. Verifique: ${[...(result.missing ?? []), ...(result.invalid ?? [])].join(', ') || 'APP_URL HTTPS em produção'}.`
        : result.code === 'SMTP_AUTH' ? 'O servidor rejeitou a autenticação SMTP. Confirme a conta e a palavra-passe de aplicação.'
        : result.code === 'SMTP_CONNECTION' ? 'Não foi possível ligar ao servidor SMTP. Verifique a rede, host e porta.'
        : 'A ligação SMTP falhou. Consulte a configuração sem partilhar credenciais.',
    };
  } catch {
    return { ok: false, message: 'Não foi possível executar o diagnóstico SMTP.' };
  }
}

export async function sendTestEmailAction(rawRecipient: string) {
  try {
    const actor = await requirePlatformPermission('emails.manage');
    const recipient = typeof rawRecipient === 'string' ? rawRecipient.trim() : '';
    if (recipient.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return { ok: false, message: 'Introduza um email de teste válido.' };
    const result = await sendAndRecordEmail({ purpose: 'SMTP_TEST', to: recipient, subject: 'Teste de email — Machine Facturas', sentByUserId: actor.id, text: 'Este é um teste de configuração do serviço de email Machine Facturas. Nenhuma factura ou campanha foi enviada.', html: '<p>Este é um teste de configuração do serviço de email Machine Facturas.</p><p>Nenhuma factura ou campanha foi enviada.</p>' });
    await db.adminAuditLog.create({ data: { actorUserId: actor.id, action: 'SMTP_TEST_SENT', resourceType: 'EMAIL_SERVICE', metadata: { accepted: result.ok && result.accepted } } });
    return result.ok && result.accepted ? { ok: true, message: 'O servidor SMTP aceitou o email de teste. Verifique a caixa de entrada e o spam; a aceitação não garante entrega.' } : { ok: false, message: 'O email de teste falhou ou não foi aceite. O resultado ficou registado sem detalhes secretos.' };
  } catch { return { ok: false, message: 'Não foi possível enviar o email de teste.' }; }
}

export async function createCampaignAction(form: FormData) {
  try {
    const actor = await requirePlatformPermission('emails.manage');
    const name = String(form.get('name') ?? '').trim();
    const subject = String(form.get('subject') ?? '').trim();
    const textContent = String(form.get('textContent') ?? '').trim();
    if (name.length < 2 || name.length > 120 || !subject || subject.length > 180 || /[\r\n]/.test(subject) || !textContent || textContent.length > 12000) {
      return { ok: false, message: 'Preencha nome, assunto e conteúdo dentro dos limites indicados.' };
    }
    const htmlContent = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#1c2d3f"><h1>Machine Facturas</h1><div>${escapeEmailHtml(textContent).replace(/\r\n|\r|\n/g, '<br>')}</div></div>`;
    const campaign = await db.emailCampaign.create({ data: { name, subject, htmlContent, textContent, createdById: actor.id } });
    await db.adminAuditLog.create({ data: { actorUserId: actor.id, action: 'EMAIL_CAMPAIGN_CREATED', resourceType: 'EMAIL_CAMPAIGN', resourceId: campaign.id } });
    return { ok: true, message: 'Rascunho guardado. Nenhum email foi enviado.' };
  } catch {
    return { ok: false, message: 'Não foi possível guardar o rascunho.' };
  }
}

export async function startCampaignAction(campaignId: string) {
  try {
    const actor = await requirePlatformPermission('emails.manage');
    if (!/^[\w-]{20,40}$/.test(campaignId)) return { ok: false, message: 'Campanha inválida.' };
    const campaign = await db.emailCampaign.findUnique({ where: { id: campaignId }, select: { status: true, scheduledAt: true } });
    if (!campaign || campaign.status !== 'DRAFT' || (campaign.scheduledAt && campaign.scheduledAt > new Date())) return { ok: false, message: 'A campanha não está pronta para iniciar.' };
    const preferences = await db.marketingPreference.findMany({ where: { subscribed: true, unsubscribedAt: null, unsubscribeTokenHash: { not: null } }, select: { id: true, email: true } });
    await db.$transaction(async (tx: any) => {
      await tx.emailCampaignRecipient.createMany({ data: preferences.map((p: any) => ({ campaignId, preferenceId: p.id, email: p.email })), skipDuplicates: true });
      await tx.emailCampaign.update({ where: { id: campaignId }, data: { status: 'SENDING', scheduledAt: null } });
      await tx.adminAuditLog.create({ data: { actorUserId: actor.id, action: 'EMAIL_CAMPAIGN_STARTED', resourceType: 'EMAIL_CAMPAIGN', resourceId: campaignId, metadata: { eligibleRecipients: preferences.length } } });
    });
    return { ok: true, message: `Campanha iniciada com ${preferences.length} destinatário(s) que têm consentimento activo. O envio é feito em lotes de 20.` };
  } catch {
    return { ok: false, message: 'Não foi possível iniciar a campanha.' };
  }
}

export async function runCampaignBatchAction(campaignId: string) {
  try {
    const actor = await requirePlatformPermission('emails.manage');
    if (!/^[\w-]{20,40}$/.test(campaignId)) return { ok: false, message: 'Campanha inválida.' };
    const campaign = await db.emailCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.status !== 'SENDING') return { ok: false, message: 'A campanha não está em execução.' };
    const candidates = await db.emailCampaignRecipient.findMany({ where: { campaignId, status: { in: ['QUEUED', 'FAILED'] }, attempts: { lt: 3 } }, orderBy: { createdAt: 'asc' }, take: 20, include: { preference: { select: { id: true, subscribed: true, unsubscribedAt: true, unsubscribeTokenHash: true } } } });
    let accepted = 0; let failed = 0; let suppressed = 0;
    for (const recipient of candidates) {
      if (!recipient.preference.subscribed || recipient.preference.unsubscribedAt || !recipient.preference.unsubscribeTokenHash) {
        await db.emailCampaignRecipient.updateMany({ where: { id: recipient.id, status: { in: ['QUEUED', 'FAILED'] } }, data: { status: 'SUPPRESSED' } }); suppressed++; continue;
      }
      const claim = await db.emailCampaignRecipient.updateMany({ where: { id: recipient.id, status: { in: ['QUEUED', 'FAILED'] }, attempts: recipient.attempts }, data: { status: 'SENDING', attempts: { increment: 1 }, lastAttemptAt: new Date() } });
      if (!claim.count) continue;
      const currentPreference = await db.marketingPreference.findUnique({ where: { id: recipient.preference.id }, select: { subscribed: true, unsubscribedAt: true, unsubscribeTokenHash: true } });
      if (!currentPreference?.subscribed || currentPreference.unsubscribedAt || !currentPreference.unsubscribeTokenHash) {
        await db.emailCampaignRecipient.update({ where: { id: recipient.id }, data: { status: 'SUPPRESSED' } }); suppressed++; continue;
      }
      const rawToken = createUnsubscribeToken(recipient.preference.id);
      if (hashEmailToken(rawToken) !== currentPreference.unsubscribeTokenHash) {
        await db.emailCampaignRecipient.update({ where: { id: recipient.id }, data: { status: 'FAILED', errorCode: 'UNSUBSCRIBE_TOKEN_MISMATCH' } }); failed++; continue;
      }
      const unsubscribeUrl = createPublicEmailUrl(`/unsubscribe?token=${encodeURIComponent(rawToken)}`);
      const message = await sendAndRecordEmail({
        purpose: 'MARKETING', to: recipient.email, subject: campaign.subject, text: `${campaign.textContent}\n\nCancelar subscrição: ${unsubscribeUrl}`,
        html: `${campaign.htmlContent}<p style="font-size:12px;color:#647184">Não quer receber estas comunicações? <a href="${unsubscribeUrl}">Cancelar subscrição</a>.</p>`,
        sentByUserId: actor.id,
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
      if (message.ok && message.accepted) { await db.emailCampaignRecipient.update({ where: { id: recipient.id }, data: { status: 'ACCEPTED', acceptedAt: new Date(), errorCode: null } }); accepted++; }
      else { await db.emailCampaignRecipient.update({ where: { id: recipient.id }, data: { status: 'FAILED', errorCode: message.ok ? 'SMTP_NOT_ACCEPTED' : message.code } }); failed++; }
    }
    const remaining = await db.emailCampaignRecipient.count({ where: { campaignId, OR: [{ status: 'QUEUED' }, { status: 'FAILED', attempts: { lt: 3 } }, { status: 'SENDING' }] } });
    if (!remaining) await db.emailCampaign.update({ where: { id: campaignId, status: 'SENDING' }, data: { status: 'COMPLETED' } });
    await db.adminAuditLog.create({ data: { actorUserId: actor.id, action: 'EMAIL_CAMPAIGN_BATCH_PROCESSED', resourceType: 'EMAIL_CAMPAIGN', resourceId: campaignId, metadata: { accepted, failed, suppressed, remaining } } });
    return { ok: true, message: `Lote concluído: ${accepted} aceite(s), ${failed} falha(s), ${suppressed} excluído(s) por cancelamento. ${remaining} por processar.` };
  } catch {
    return { ok: false, message: 'Não foi possível processar o lote da campanha.' };
  }
}
