import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { NewSupplierInvoiceForm } from './new-form';

export default async function NewSupplierInvoicePage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const [suppliers, eligibleOrders] = await Promise.all([
    prisma.supplier.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, nif: true },
      orderBy: { name: 'asc' },
    }),
    prisma.purchaseOrder.findMany({
      where: { tenantId, status: { in: ['PENDENTE', 'PARTIAL', 'RECEIVED'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, total: true, status: true, expectedAt: true, supplier: { select: { id: true, name: true } } },
    }),
  ]);

  return <div className="space-y-6 pb-10">
    <div>
      <p className="text-sm text-[#708195]">Compras</p>
      <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Registar factura de fornecedor</h2>
      <p className="mt-2 text-sm text-[#708195]">Vincula, se aplicável, a um ordem de compra recebido ou regista a factura independente.</p>
    </div>
    <NewSupplierInvoiceForm suppliers={suppliers} eligibleOrders={eligibleOrders.map((po: any) => ({ ...po, total: Number(po.total) }))} />
  </div>;
}
