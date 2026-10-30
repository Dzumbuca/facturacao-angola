'use client';
import { useRouter } from 'next/navigation';
import { StockMovementForm } from './movement-form';

export function StockClient({ products }: { products: { id: string; name: string; stock: number }[] }) {
  const router = useRouter();
  return (
    <StockMovementForm
      products={products}
      onSuccess={() => router.refresh()}
    />
  );
}
