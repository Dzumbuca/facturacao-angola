'use client';

import type { ReactNode } from 'react';
import { MobileNavBase, type MobileNavGroup, type MobileNavPrimary } from '@/components/mobile-nav-base';

type AdminLink = { href: string; label: string; icon: string; permission: string };

const primaryCatalog: AdminLink[] = [
  { href: '/admin', label: 'Visão geral', icon: 'grid', permission: 'dashboard.read' },
  { href: '/admin/empresas', label: 'Empresas', icon: 'building', permission: 'companies.read' },
  { href: '/admin/utilizadores', label: 'Utilizadores', icon: 'users', permission: 'users.read' },
  { href: '/admin/pagamentos', label: 'Pagamentos', icon: 'wallet', permission: 'companies.read' },
];

const moreCatalog: { title: string; links: AdminLink[] }[] = [
  {
    title: 'Gestão',
    links: [
      { href: '/admin/equipa', label: 'Equipa de gestão', icon: 'users', permission: 'team.read' },
      { href: '/admin/documentos', label: 'Documentos', icon: 'file', permission: 'documents.read' },
      { href: '/admin/emails', label: 'Emails', icon: 'file', permission: 'emails.read' },
    ],
  },
  {
    title: 'Controlo',
    links: [
      { href: '/admin/auditoria', label: 'Auditoria', icon: 'receipt', permission: 'audit.read' },
      { href: '/admin/sistema', label: 'Sistema', icon: 'settings', permission: 'system.read' },
      { href: '/admin/configuracoes', label: 'Configurações', icon: 'settings', permission: 'settings.read' },
    ],
  },
  {
    title: 'Aplicação',
    links: [{ href: '/', label: 'Voltar à aplicação', icon: 'home', permission: '' }],
  },
];

export function AdminMobileNav({ permissions, operatorName, footer }: { permissions: string[]; operatorName: string; footer?: ReactNode }) {
  const can = (permission: string) => !permission || permissions.includes(permission);
  const primary: MobileNavPrimary[] = primaryCatalog.filter((item) => can(item.permission)).map((item) => ({ href: item.href, label: item.label, icon: item.icon }));
  const groups: MobileNavGroup[] = moreCatalog
    .map((group) => ({ title: group.title, links: group.links.filter((item) => can(item.permission)).map((item) => ({ href: item.href, label: item.label, icon: item.icon })) }))
    .filter((group) => group.links.length > 0);

  return (
    <MobileNavBase
      ariaLabel="Navegação administrativa móvel"
      primary={primary}
      groups={groups}
      header={<p className="max-w-[220px] truncate text-xs text-[#708195]">{operatorName} · Administração</p>}
      footer={footer}
    />
  );
}
