import Link from 'next/link';
import type { ReactNode } from 'react';
import { prisma } from '@/lib/prisma';
import { getTenantAccess } from '@/lib/admin-auth';
import { BUSINESS_DOCUMENT_CATEGORIES, BUSINESS_DOCUMENT_LABELS, BUSINESS_DOCUMENT_STATUS_LABELS, getBusinessDocumentStatusTone } from '@/lib/business-document-labels';
import { BUSINESS_DOCUMENT_STATUSES, BUSINESS_DOCUMENT_TYPES, type BusinessDocumentStatus, type BusinessDocumentType } from '@/lib/business-document-core';
import { EmptyState } from '@/components/ui/data-table';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
type Search = { q?: string; type?: string; status?: string; from?: string; to?: string; page?: string; tab?: string };


const categoryIcons: Record<string, ReactNode> = {
  Comerciais: (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
  ),
  Financeiros: (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h8"/><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M16 15l2 2"/></svg>
  ),
  Operacionais: (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/><path d="M5 17h-2v-4l2-6h10v10"/><path d="M15 12h4l2 5h-2"/></svg>
  ),
  Administrativos: (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
  ),
};
const categoryStyle: Record<string, string> = {
  Comerciais: 'border border-[#dbe2ff] bg-[#eef2ff] text-[#021f87] dark:border-[#1e2a44] dark:bg-[#0d1730] dark:text-[#8aa4ff]',
  Financeiros: 'border border-[#cbe8dc] bg-[#eff9f4] text-[#227958] dark:border-[#1f3a2a] dark:bg-[#0e241b] dark:text-[#34d399]',
  Operacionais: 'border border-[#fbe5a8] bg-[#fdf3d0] text-[#7a4b00] dark:border-[#3a2f10] dark:bg-[#2b2110] dark:text-[#facc15]',
  Administrativos: 'border border-[#d9dde4] bg-[#eef0f4] text-[#3d4654] dark:border-[#2a3140] dark:bg-[#161b25] dark:text-[#b4bac6]',
};

export default async function BusinessDocumentsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const access = await getTenantAccess();
  const params = await searchParams;
  const tab = params.tab === 'lista' ? 'lista' : 'categorias';
  const page = Math.max(1, Number(params.page) || 1);
  const type = BUSINESS_DOCUMENT_TYPES.includes(params.type as BusinessDocumentType) ? params.type as BusinessDocumentType : undefined;
  const status = BUSINESS_DOCUMENT_STATUSES.includes(params.status as BusinessDocumentStatus) ? params.status as BusinessDocumentStatus : undefined;
  const validDate = (value?: string) => { if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T00:00:00.000Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; };
  const from = validDate(params.from) ? new Date(`${params.from}T00:00:00.000Z`) : undefined;
  const to = validDate(params.to) ? new Date(`${params.to}T23:59:59.999Z`) : undefined;
  const where = { tenantId: access.tenantId, ...(type ? { type } : {}), ...(status ? { status } : {}), ...(from || to ? { issueDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}), ...(params.q?.trim() ? { OR: [{ number: { contains: params.q.trim(), mode: 'insensitive' as const } }, { title: { contains: params.q.trim(), mode: 'insensitive' as const } }, { customerSnapshot: { path: ['name'], string_contains: params.q.trim() } }] } : {}) };
  const [documents, total, receipts] = await Promise.all([
    prisma.businessDocument.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: { id: true, type: true, status: true, number: true, title: true, issueDate: true, total: true, customerSnapshot: true } }),
    prisma.businessDocument.count({ where }),
    prisma.paymentReceipt.findMany({ where: { tenantId: access.tenantId, payment: { status: 'CONFIRMED' } }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, number: true, createdAt: true, payment: { select: { amount: true, invoice: { select: { number: true, customer: { select: { name: true } } } } } } } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterHref = (nextTab: 'categorias' | 'lista', nextPage = 1) => `/documentos?tab=${nextTab}&q=${encodeURIComponent(params.q ?? '')}&type=${type ?? ''}&status=${status ?? ''}&from=${params.from ?? ''}&to=${params.to ?? ''}&page=${nextPage}`;

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text)]">Documentos Empresariais</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">Consulte, crie, filtre e exporte os documentos comerciais da sua empresa.</p>
        </div>
        <Link href="/documentos/novo" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[var(--blue)] px-5 text-sm font-bold text-white shadow-[var(--shadow-cta)] transition hover:-translate-y-0.5 hover:bg-[#0634b8]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          Novo documento
        </Link>
      </header>

      {/* Tabs */}
      <nav role="tablist" aria-label="Vistas" className="border-b border-[var(--line)]">
        <div className="flex gap-6">
          {(['categorias', 'lista'] as const).map((t) => (
            <Link key={t} href={filterHref(t, 1)} role="tab" aria-selected={tab === t} className={`-mb-px border-b-2 px-1 pb-3 text-sm font-semibold transition ${tab === t ? 'border-[var(--blue)] text-[var(--blue)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'}`}>
              {t === 'categorias' ? 'Por categoria' : 'Lista de documentos'}
              {t === 'lista' && total > 0 && <span className="ml-1.5 rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]">{total}</span>}
            </Link>
          ))}
        </div>
      </nav>

      {tab === 'categorias' && (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {BUSINESS_DOCUMENT_CATEGORIES.map((category) => (
              <article key={category.title} className="group flex h-full flex-col rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-[2px] hover:border-[var(--blue)]">
                <div className="flex items-center justify-between gap-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${categoryStyle[category.title] ?? ''}`}>{category.title}</span>
                  <span aria-hidden="true" className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ring-1 ring-[var(--line)] ${categoryStyle[category.title] ?? ""}`}>{categoryIcons[category.title] ?? categoryIcons.Comerciais}</span>
                </div>
                <p className="mt-3 text-[13px] leading-6 text-[var(--text-muted)]">{category.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {category.types.map((documentType) => (
                    <Link key={documentType} href={`/documentos/novo?type=${documentType}`} className="rounded-lg bg-[var(--surface-raised)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--blue)] hover:text-white">
                      + {BUSINESS_DOCUMENT_LABELS[documentType]}
                    </Link>
                  ))}
                  {category.title === 'Financeiros' && (
                    <Link href="/invoices" className="rounded-lg bg-[var(--surface-raised)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--blue)] hover:text-white">Ver facturas e recibos</Link>
                  )}
                  {category.title === 'Administrativos' && (
                    <Link href="/reports" className="rounded-lg bg-[var(--surface-raised)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--blue)] hover:text-white">Ver relatórios</Link>
                  )}
                </div>
              </article>
            ))}
          </section>

          <section className="rounded-[16px] border border-[#f0e0b8] bg-[#fef9ea] px-4 py-3 text-xs leading-6 text-[#6b4b00] dark:border-[#3a2f10] dark:bg-[#2b2110] dark:text-[#f9c75a]">
            <strong className="font-bold">Documentos fiscais:</strong> recibos de pagamentos confirmados e relatórios existem nas suas áreas próprias. Notas de crédito e débito fiscais são criadas pelo fluxo de correcção da factura. Este módulo não declara conformidade fiscal.
          </section>

          <section className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-extrabold text-[var(--text)]">Recibos de pagamento recentes</h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Registos confirmados associados a facturas.</p>
              </div>
              <Link href="/invoices" className="text-xs font-semibold text-[var(--blue)] hover:underline">Abrir facturas →</Link>
            </div>
            {receipts.length ? (
              <ul className="mt-4 divide-y divide-[var(--line)]">
                {(receipts as Array<{ id: string; number: string; payment: { amount: unknown; invoice: { number: string; customer: { name: string } } } }>).map((receipt) => (
                  <li key={receipt.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                    <span className="font-medium text-[var(--text)]">{receipt.number} · {receipt.payment.invoice.customer.name} · Factura {receipt.payment.invoice.number}</span>
                    <span className="tabular-nums text-[var(--text)]">{Number(receipt.payment.amount).toLocaleString('pt-AO')} AOA</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-sm text-[var(--text-muted)]">Ainda não existem recibos de pagamento.</p>}
          </section>
        </>
      )}

      {tab === 'lista' && (
        <>
          <form method="get" action="/documentos" className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] md:items-end">
            <input type="hidden" name="tab" value="lista" />
            <input name="q" defaultValue={params.q} placeholder="Pesquisar por número, título ou cliente" className="app-input min-h-12" aria-label="Pesquisar" />
            <select name="type" defaultValue={type ?? ''} className="app-input min-h-12" aria-label="Tipo de documento">
              <option value="">Todos os tipos</option>
              {BUSINESS_DOCUMENT_TYPES.map((value) => <option key={value} value={value}>{BUSINESS_DOCUMENT_LABELS[value]}</option>)}
            </select>
            <select name="status" defaultValue={status ?? ''} className="app-input min-h-12" aria-label="Estado">
              <option value="">Todos os estados</option>
              {BUSINESS_DOCUMENT_STATUSES.map((value) => <option key={value} value={value}>{BUSINESS_DOCUMENT_STATUS_LABELS[value]}</option>)}
            </select>
            <input aria-label="Desde" type="date" name="from" defaultValue={params.from} className="app-input min-h-12" />
            <input aria-label="Até" type="date" name="to" defaultValue={params.to} className="app-input min-h-12" />
            <div className="flex gap-2">
              <Link href="/documentos?tab=lista" className="inline-flex min-h-12 items-center rounded-[12px] border border-[var(--line)] px-4 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]">Limpar</Link>
              <button type="submit" className="inline-flex min-h-12 items-center rounded-[12px] bg-[var(--blue)] px-5 text-sm font-bold text-white shadow-[var(--shadow-cta)] transition hover:bg-[#0634b8]">Filtrar</button>
            </div>
          </form>

          {documents.length ? (
            <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)]">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Lista de documentos empresariais filtrados pelos critérios actuais.</caption>
                <thead>
                  <tr className="bg-[var(--surface-raised)] text-[10px] font-bold uppercase tracking-[.12em] text-[var(--text-muted)]">
                    <th className="px-5 py-3">Documento</th>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3">Data</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3 text-right">Acções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {(documents as Array<{ id: string; type: BusinessDocumentType; status: BusinessDocumentStatus; number: string; title: string; issueDate: Date; total: unknown; customerSnapshot: unknown }>).map((document) => {
                    const customer = document.customerSnapshot as { name?: string } | null;
                    return (
                      <tr key={document.id} className="transition-colors hover:bg-[var(--surface-raised)]">
                        <td className="px-5 py-4">
                          <Link href={`/documentos/${document.id}`} className="font-semibold text-[var(--text)] hover:text-[var(--blue)]">{document.number}</Link>
                          <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">{BUSINESS_DOCUMENT_LABELS[document.type]} · {document.title}</span>
                        </td>
                        <td className="px-5 py-4 text-[var(--text)]">{customer?.name ?? '—'}</td>
                        <td className="px-5 py-4 text-[var(--text-muted)]">{new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(document.issueDate)}</td>
                        <td className="px-5 py-4 text-right tabular-nums text-[var(--text)]">{Number(document.total).toLocaleString('pt-AO')} AOA</td>
                        <td className="px-5 py-4"><span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${getBusinessDocumentStatusTone(document.status)}`}>{BUSINESS_DOCUMENT_STATUS_LABELS[document.status]}</span></td>
                        <td className="px-5 py-4 text-right"><Link href={`/documentos/${document.id}`} className="text-xs font-semibold text-[var(--blue)] hover:underline">Abrir →</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pages > 1 && <div className="flex items-center justify-between border-t border-[var(--line)] p-4 text-xs text-[var(--text-muted)]"><span>Página {page} de {pages} · {total} documentos</span><div className="flex gap-2">{page > 1 && <Link className="rounded-[8px] border border-[var(--line)] px-3 py-2 font-semibold hover:text-[var(--text)]" href={filterHref('lista', page - 1)}>Anterior</Link>}{page < pages && <Link className="rounded-[8px] border border-[var(--line)] px-3 py-2 font-semibold hover:text-[var(--text)]" href={filterHref('lista', page + 1)}>Seguinte</Link>}</div></div>}
            </div>
          ) : (
            <EmptyState title="Ainda não existem documentos com estes filtros" description="Experimente alterar os filtros ou crie um novo documento empresarial." action={<Link href="/documentos/novo" className="inline-flex min-h-11 items-center rounded-[12px] bg-[var(--blue)] px-5 text-sm font-bold text-white">Criar documento</Link>} />
          )}
        </>
      )}
    </main>
  );
}
