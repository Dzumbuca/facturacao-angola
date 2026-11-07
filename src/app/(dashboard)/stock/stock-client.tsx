'use client';
import { useRouter } from 'next/navigation';
import { StockMovementForm } from './movement-form';

export function StockClient({
  products,
  warehouses,
}: {
  products: { id: string; name: string; stock: number }[];
  warehouses: { id: string; name: string }[];
}) {
  const router = useRouter();
  return (
    <StockMovementForm
      products={products}
      warehouses={warehouses}
      onSuccess={() => router.refresh()}
    />
  );
}
