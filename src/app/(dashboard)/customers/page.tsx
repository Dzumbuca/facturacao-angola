import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getSessionTenantId } from "@/lib/session";
import { aggregateOutstandingByCustomer } from '@/lib/outstanding';
import { CustomerManagement } from "./customer-management";

export default async function CustomersPage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;
  const [customers, balances] = await Promise.all([
    prisma.customer.findMany({ where: { tenantId } }),
    prisma.invoice.findMany({
      where: { tenantId, type: 'FT', status: 'ISSUED' },
      select: { customerId: true, total: true, payments: { select: { amount: true, status: true } } },
    }),
  ]);
  const balanceByCustomer = aggregateOutstandingByCustomer(balances);
  const initialCustomers = customers.map((customer: { id: string; name: string; nif: string | null; email: string | null; address: string | null }) => ({ id: customer.id, name: customer.name, nif: customer.nif, email: customer.email, address: customer.address, outstanding: balanceByCustomer.get(customer.id) ?? 0 }));

  return <CustomerManagement initialCustomers={initialCustomers} />;
}
