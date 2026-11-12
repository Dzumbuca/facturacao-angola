import { auth } from '@/lib/auth';
import { SuppliersClient } from './fornecedores-client';

export default async function FornecedoresPage() {
  const session = await auth();
  const tenantId = (session as { user?: { tenantId?: string | null } } | undefined)?.user?.tenantId;
  if (!tenantId) return <p>Sessão sem empresa associada.</p>;
  return <SuppliersClient />;
}
