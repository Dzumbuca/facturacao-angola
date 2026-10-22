import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getSessionTenantId } from "@/lib/session";
import { CustomerManagement } from "./customer-management";

export default async function CustomersPage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;
  const customers = await prisma.customer.findMany({ where: { tenantId } });

  return <CustomerManagement initialCustomers={customers.map((customer: { id: string; name: string; nif: string | null; email: string | null; address: string | null }) => ({ id: customer.id, name: customer.name, nif: customer.nif, email: customer.email, address: customer.address }))} />;
}
