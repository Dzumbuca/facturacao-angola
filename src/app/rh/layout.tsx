import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { requireRhAccess, RhAccessError } from '@/lib/rh-access';
import { RhShell } from '@/components/rh/rh-shell';

export const metadata: Metadata = {
  title: { default: 'Machine RH', template: '%s · Machine RH' },
  description: 'Recursos Humanos: funcionários, contratos, assiduidade e salários.',
  manifest: '/rh-manifest.json',
  applicationName: 'Machine RH',
  appleWebApp: {
    capable: true,
    title: 'Machine RH',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [{ url: '/icons/rh-icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/rh-icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  themeColor: '#021f87',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RhLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let access;
  try {
    access = await requireRhAccess();
  } catch (error) {
    if (error instanceof RhAccessError) {
      if (error.code === 'UNAUTHENTICATED') redirect('/login?callbackUrl=/rh/dashboard');
      if (error.code === 'APP_NOT_ENABLED') redirect('/apps?rh=bloqueado');
      redirect('/apps?rh=sem-permissao');
    }
    throw error;
  }
  return <RhShell canManageMembers={access.permissions.includes('members:write')}>{children}</RhShell>;
}
