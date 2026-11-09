'use client';

import Link from 'next/link';
import { MobileNavBase, type MobileNavGroup, type MobileNavPrimary } from '@/components/mobile-nav-base';

const primary: MobileNavPrimary[] = [
  { href: '/', label: 'Início', icon: 'home', exact: true },
  { href: '/invoices', label: 'Operações', icon: 'receipt' },
  { href: '/customers', label: 'Clientes', icon: 'users' },
  { href: '/produtos', label: 'Produtos', icon: 'box' },
];

export function MobileBottomNav({ platformAdmin = false, plan = 'FREE', planExpired = false, wmsEnabled = false }: { platformAdmin?: boolean; plan?: string; planExpired?: boolean; wmsEnabled?: boolean }) {
  const groups: MobileNavGroup[] = [
    {
      title: 'Gestão',
      links: [
        { href: '/documentos', label: 'Documentos', icon: 'file' },
        { href: '/ferramentas', label: 'Ferramentas', icon: 'tools' },
      ],
    },
    ...(wmsEnabled ? [{
      title: 'Armazém',
      links: [
        { href: '/stock', label: 'Armazém e stock', icon: 'layers' },
        { href: '/warehouses', label: 'Armazéns', icon: 'building' },
      ],
    }] : []),
    {
      title: 'Análise e conta',
      links: [
        { href: '/reports', label: 'Relatórios', icon: 'chart' },
        { href: '/apps', label: 'Aplicações', icon: 'grid' },
        { href: '/empresa', label: 'Empresa', icon: 'building' },
        { href: '/pagamento', label: 'Plano e pagamento', icon: 'wallet' },
      ],
    },
    ...(platformAdmin ? [{
      title: 'Plataforma',
      links: [{ href: '/admin', label: 'Administração da plataforma', icon: 'settings' }],
    }] : []),
  ];

  const planLabel = planExpired ? 'Plano expirado' : plan === 'PRO' ? 'Plano Pro' : 'Plano Grátis';

  return (
    <MobileNavBase
      ariaLabel="Navegação móvel"
      primary={primary}
      groups={groups}
      header={<p className="text-xs text-[#708195]">{planLabel}</p>}
      footer={plan !== 'PRO' ? (
        <Link href="/pagamento" className="flex items-center justify-between gap-3 rounded-xl bg-[#021f87] px-4 py-3.5 text-sm font-semibold text-white transition active:bg-[#061965]">
          <span>{planExpired ? 'Renovar o plano' : 'Conhecer os pacotes pagos'}</span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    />
  );
}
