import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { ImportForm } from './import-form';

export default async function ImportPlanoContasPage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');
  const existing = await prisma.glAccount.count({ where: { tenantId, isActive: true } });
  return (
    <div className="space-y-6 pb-10">
      <div>
        <p className="text-sm text-[#708195]">Contabilidade</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Importar plano de contas</h2>
        <p className="mt-2 text-sm text-[#708195]">Cole o conteúdo CSV no campo abaixo. Formato: <code className="font-mono bg-[#f3f5f7] p-0.5 rounded">code;designation;kind;nature;parentCode;synthetic(true|false)</code>. Aspas em volta de campos com ponto e vírgula.</p>
        <p className="mt-1 text-xs text-amber-700">Nota: Machine Facturas não certifica o plano como oficialmente aprovado. A escolha dos códigos é responsabilidade da empresa.</p>
      </div>
      <ImportForm existingCount={existing} />
    </div>
  );
}
