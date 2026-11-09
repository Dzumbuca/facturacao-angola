import Link from 'next/link';
import { adminSignOut } from '@/lib/admin-signout';
import { ThemeToggle } from '@/components/theme-toggle';
import { AdminMobileNav } from '@/components/admin-mobile-nav';
import { ResponsiveTables } from '@/components/responsive-tables';

const links = [
  ['/admin', 'Visão geral', 'dashboard.read'], ['/admin/empresas', 'Empresas', 'companies.read'], ['/admin/pagamentos', 'Pagamentos de planos', 'companies.read'], ['/admin/utilizadores', 'Utilizadores', 'users.read'],
  ['/admin/equipa', 'Equipa de gestão', 'team.read'], ['/admin/documentos', 'Documentos', 'documents.read'], ['/admin/emails', 'Emails', 'emails.read'], ['/admin/auditoria', 'Auditoria', 'audit.read'], ['/admin/sistema', 'Sistema', 'system.read'], ['/admin/configuracoes', 'Configurações', 'settings.read'],
];

export function AdminShell({ children, operator, platformName }: { children: React.ReactNode; operator: { name: string | null; email: string | null; platformRole: string; permissions: string[] }; platformName: string }) {
  return <div className="admin-shell min-h-screen bg-[#f5f6f8] text-[#18273c] md:flex">
    <aside className="hidden border-b border-slate-200 bg-[#071936] text-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:overflow-y-auto">
      <div className="px-5 py-6"><Link href="/admin" className="text-lg font-bold">{platformName}</Link><p className="mt-1 text-xs text-slate-300">Administração da plataforma</p></div>
      <nav aria-label="Navegação administrativa" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {links.filter(([, , permission]) => operator.permissions.includes(permission)).map(([href, label]) => <Link key={href} href={href} className="block rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10 hover:text-white focus-visible:outline-white">{label}</Link>)}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 text-xs text-slate-300"><p className="font-semibold text-white">{operator.name || 'Administrador'}</p><p className="mt-1 truncate">{operator.email}</p><p className="mt-1">{operator.platformRole === 'ADMIN' ? 'SUPERADMIN' : operator.platformRole}</p><form action={adminSignOut} className="mt-3"><button className="rounded-md border border-white/25 px-3 py-2 text-sm text-white hover:bg-white/10">Terminar sessão</button></form></div>
    </aside>

    <main className="min-w-0 flex-1 pb-28 md:pb-0">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="min-w-0 md:hidden"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#708195]">Plataforma</p><h1 className="truncate text-[15px] font-bold text-[#1c2d3f]">Administração</h1></div>
        <div className="ml-auto flex items-center gap-2"><span className="hidden rounded-full border border-[#e1e8f0] bg-[#f7f9fc] px-3 py-1.5 text-xs font-medium text-[#607286] sm:inline-flex">{platformName}</span><ThemeToggle compact /></div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
    </main>

    <AdminMobileNav
      permissions={operator.permissions}
      operatorName={operator.name || operator.email || 'Administrador'}
      footer={<form action={adminSignOut}><button className="w-full rounded-xl border border-[#f0c9c9] bg-red-50 px-4 py-3 text-sm font-semibold text-[#a83939] transition active:bg-red-100">Terminar sessão</button></form>}
    />
    <ResponsiveTables />
  </div>;
}
