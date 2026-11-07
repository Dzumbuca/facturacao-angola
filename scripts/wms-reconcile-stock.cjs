/**
 * Dry-run reconciliation: compares Product.stock with SUM(ProductWarehouseStock.quantity) per tenant/product.
 * SAFE: read-only by default. Use --apply only in an explicitly authorized staging/local environment.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const tenant = process.argv.find((a,i)=>process.argv[i-1]==='--tenant');
async function main(){
  const where = tenant ? { tenantId: tenant } : {};
  const products = await prisma.product.findMany({ where, select: { id:true, tenantId:true, name:true, codigo:true, stock:true } });
  let mismatches=0;
  for (const p of products){
    const agg = await prisma.productWarehouseStock.aggregate({ where: { tenantId: p.tenantId, productId: p.id }, _sum: { quantity: true } });
    const wh = Number(agg._sum.quantity || 0);
    const ps = Number(p.stock || 0);
    if (wh !== ps){ mismatches++; console.log(JSON.stringify({ tenantId:p.tenantId, productId:p.id, codigo:p.codigo, name:p.name, productStock:ps, warehouseSum:wh, delta:wh-ps })); }
  }
  console.log(JSON.stringify({ ok:true, apply:false, checked: products.length, mismatches, note: apply ? 'APPLY_NOT_IMPLEMENTED (safety) - run manual reviewed fix' : 'dry-run only' }));
}
main().catch(e=>{ console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());
