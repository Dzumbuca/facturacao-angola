import Link from 'next/link';
import { adminSignOut } from '@/lib/admin-signout';

const links = [
  ['/admin', 'Visão geral', 'dashboard.read'], ['/admin/empresas', 'Empresas', 'companies.read'], ['/admin/utilizadores', 'Utilizadores', 'users.read'],
  ['/admin/equipa', 'Equipa de gestão', 'team.read'], ['/admin/documentos', 'Documentos', 'documents.read'], ['/admin/emails', 'Emails', 'emails.read'], ['/admin/auditoria', 'Auditoria', 'audit.read'], ['/admin/sistema', 'Sistema', 'system.read'], ['/admin/configuracoes', 'Configurações', 'settings.read'],
];

export function AdminShell({ children, operator, platformName }: { children: React.ReactNode; operator: { name: string | null; email: string | null; platformRole: string; permissions: string[] }; platformName: string }) {
  return <div className="min-h-screen bg-[#f5f6f8] text-[#18273c] md:flex">
    <aside className="border-b border-slate-200 bg-[#071936] text-white md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:overflow-y-auto">
      <div className="px-5 py-6"><Link href="/admin" className="text-lg font-bold">{platformName}</Link><p className="mt-1 text-xs text-slate-300">Administração da plataforma</p></div>
      <nav aria-label="Navegação administrativa" className="flex gap-1 overflow-x-auto px-3 pb-4 md:block md:space-y-1">
        {links.filter(([, , permission]) => operator.permissions.includes(permission)).map(([href, label]) => <Link key={href} href={href} className="block shrink-0 rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10 hover:text-white focus-visible:outline-white">{label}</Link>)}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 text-xs text-slate-300"><p className="font-semibold text-white">{operator.name || 'Administrador'}</p><p className="mt-1 truncate">{operator.email}</p><p className="mt-1">{operator.platformRole === 'ADMIN' ? 'SUPERADMIN' : operator.platformRole}</p><form action={adminSignOut} className="mt-3"><button className="rounded-md border border-white/25 px-3 py-2 text-sm text-white hover:bg-white/10">Terminar sessão</button></form></div>
    </aside>
    <main className="min-w-0 flex-1"><div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">{children}</div></main>
  </div>;
}
