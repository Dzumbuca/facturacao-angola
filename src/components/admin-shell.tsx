import Link from 'next/link';
import { adminSignOut } from '@/lib/admin-signout';
import { ThemeToggle } from '@/components/theme-toggle';
import { AdminMobileNav } from '@/components/admin-mobile-nav';
import { ResponsiveTables } from '@/components/responsive-tables';
import { Assistant } from '@/components/assistant/assistant';
import { ShellAside, ShellTopbar, ShellMain } from '@/components/system/shell';

const links = [
  ['/admin', 'Visão geral', 'dashboard.read'], ['/admin/empresas', 'Empresas', 'companies.read'], ['/admin/planos', 'Planos comerciais', 'companies.update'],
  ['/admin/pagamentos', 'Pagamentos de planos', 'companies.read'], ['/admin/utilizadores', 'Utilizadores', 'users.read'],
  ['/admin/equipa', 'Equipa de gestão', 'team.read'], ['/admin/documentos', 'Documentos', 'documents.read'], ['/admin/emails', 'Emails', 'emails.read'], ['/admin/auditoria', 'Auditoria', 'audit.read'], ['/admin/sistema', 'Sistema', 'system.read'], ['/admin/configuracoes', 'Configurações', 'settings.read'],
];

export function AdminShell({ children, operator, platformName }: { children: React.ReactNode; operator: { name: string | null; email: string | null; platformRole: string; permissions: string[] }; platformName: string }) {
  return <div className="admin-shell min-h-screen bg-[#f5f6f8] text-[#18273c] md:flex">
    <ShellAside tone="navy" width="md:w-64" className="md:sticky md:top-0 md:h-screen md:shrink-0 md:border-b md:border-slate-200 md:overflow-y-auto">
      <div className="px-2 py-1"><Link href="/admin" className="text-lg font-bold">{platformName}</Link><p className="mt-1 text-xs text-slate-300">Administração da plataforma</p></div>
      <nav aria-label="Navegação administrativa" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {links.filter(([, , permission]) => operator.permissions.includes(permission)).map(([href, label]) => <Link key={href} href={href} className="block rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10 hover:text-white focus-visible:outline-white">{label}</Link>)}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 text-xs text-slate-300"><p className="font-semibold text-white">{operator.name || 'Administrador'}</p><p className="mt-1 truncate">{operator.email}</p><p className="mt-1">{operator.platformRole === 'ADMIN' ? 'SUPERADMIN' : operator.platformRole}</p><form action={adminSignOut} className="mt-3"><button className="rounded-md border border-white/25 px-3 py-2 text-sm text-white hover:bg-white/10">Terminar sessão</button></form></div>
    </ShellAside>

    <main className="min-w-0 flex-1 pb-28 md:pb-0">
      <ShellTopbar
        tone="navy"
        eyebrow="Plataforma"
        title={platformName}
        right={<><span className="hidden rounded-full border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] sm:inline-flex">{platformName}</span><ThemeToggle compact /></>}
      />
      <ShellMain maxWidth="max-w-7xl" className="py-6">{children}</ShellMain>
    </main>

    <AdminMobileNav
      permissions={operator.permissions}
      operatorName={operator.name || operator.email || 'Administrador'}
      footer={<form action={adminSignOut}><button className="w-full rounded-xl border border-[#f0c9c9] bg-red-50 px-4 py-3 text-sm font-semibold text-[#a83939] transition active:bg-red-100">Terminar sessão</button></form>}
    />
    <ResponsiveTables />
        <Assistant />
    </div>;
}