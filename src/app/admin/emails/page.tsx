import { prisma } from '@/lib/prisma';
import { getEmailConfiguration } from '@/lib/email-core';
import { requirePlatformPermission } from '@/lib/admin-auth';
import { SmtpCheck } from './smtp-check';
import { CampaignConsole } from './campaign-console';

function Metric({ label, value, note }: { label: string; value: number; note?: string }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{value.toLocaleString('pt-AO')}</p>{note && <p className="mt-1 text-xs text-slate-500">{note}</p>}</article>;
}

export default async function AdminEmailsPage() {
  await requirePlatformPermission('emails.read');
  const db = prisma as any;
  const config = getEmailConfiguration();
  const [accepted, failed, queued, unverified, invites, subscribers, sending, scheduled, recentCampaigns] = await Promise.all([
    db.emailDelivery.count({ where: { status: 'ACCEPTED' } }),
    db.emailDelivery.count({ where: { status: 'FAILED' } }),
    db.emailCampaignRecipient.count({ where: { status: 'QUEUED' } }),
    db.user.count({ where: { emailVerificationRequired: true, emailVerified: null } }),
    db.platformTeamInvite.count({ where: { status: 'PENDING', expiresAt: { gt: new Date() } } }),
    db.marketingPreference.count({ where: { subscribed: true, unsubscribedAt: null } }),
    db.emailCampaign.count({ where: { status: 'SENDING' } }),
    db.emailCampaign.count({ where: { status: 'DRAFT', scheduledAt: { gt: new Date() } } }),
    db.emailCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 20, include: { _count: { select: { recipients: true } } } }),
  ]);
  const keyNames = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM_NAME', 'EMAIL_FROM', 'APP_URL'];
  const configured = config.ok ? 'Completa' : 'Incompleta';
  return <div><p className="text-sm font-semibold uppercase tracking-wider text-[#248468]">Plataforma</p><h1 className="mt-1 text-3xl font-bold">Emails</h1><p className="mt-2 text-slate-600">Estado do serviço, histórico e fluxos de conta. “Aceite” significa aceite pelo SMTP, não entrega na caixa de entrada.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Metric label="Aceites pelo SMTP" value={accepted}/><Metric label="Falhas registadas" value={failed}/><Metric label="Emails comerciais na fila" value={queued} note="Pendentes em campanhas iniciadas"/><Metric label="Contas por verificar" value={unverified}/><Metric label="Convites pendentes" value={invites}/><Metric label="Subscritores activos" value={subscribers}/><Metric label="Campanhas em execução" value={sending} note={`${scheduled} agendadas (rascunhos)`}/></div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2"><section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Variáveis de ambiente</h2><p className="mt-2 text-sm">Estado: <strong>{configured}</strong></p><ul className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">{keyNames.map((key) => <li key={key}>{key}: {config.ok || !(config.missing ?? []).includes(key) ? 'presente' : 'em falta'}</li>)}</ul><p className="mt-3 text-xs text-slate-500">Os valores e credenciais não são apresentados.</p></section><SmtpCheck/></div>
    <CampaignConsole campaigns={recentCampaigns.map((campaign: any) => ({ id: campaign.id, name: campaign.name, subject: campaign.subject, status: campaign.status, createdAt: campaign.createdAt.toISOString(), total: campaign._count.recipients }))}/>
  </div>;
}
