import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { getPlatformMember, AuthorizationError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let operator;
  try { operator = await getPlatformMember(); } catch (error) {
    if (error instanceof AuthorizationError) redirect('/');
    throw error;
  }
  const config = await (prisma as any).platformConfig.findUnique({ where: { id: 'global' }, select: { platformName: true } });
  return <AdminShell operator={operator} platformName={config?.platformName || 'Machine Facturas'}>{children}</AdminShell>;
}
