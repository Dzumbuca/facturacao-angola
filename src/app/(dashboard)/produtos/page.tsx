import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getSessionTenantId } from "@/lib/session";
import { isApplicationEnabled } from "@/lib/platform-apps";
import { ProductManagement } from "./product-management";

export default async function ProdutosPage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;
  const [produtos, wmsEnabled] = await Promise.all([
    prisma.product.findMany({ where: { tenantId } }) as Promise<any[]>,
    isApplicationEnabled(tenantId, "wms"),
  ]);

  const initialProducts = produtos.map((product) => ({
    id: product.id,
    codigo: product.codigo,
    name: product.name,
    price: Number(product.price),
    stock: Number(product.stock),
    minStock: Number(product.minStock ?? 0),
    trackStock: Boolean(product.trackStock),
    categoria: product.categoria,
  }));
  return <ProductManagement initialProducts={initialProducts} wmsEnabled={wmsEnabled} />;
}
