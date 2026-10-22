import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getSessionTenantId } from "@/lib/session";
import { ProductManagement } from "./product-management";

export default async function ProdutosPage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;
  const produtos: any[] = await prisma.product.findMany({ where: { tenantId } });

  const initialProducts = produtos.map((product) => ({
    id: product.id,
    codigo: product.codigo,
    name: product.name,
    price: Number(product.price),
    stock: product.stock,
    categoria: product.categoria,
  }));
  return <ProductManagement initialProducts={initialProducts} />;
}
