'use client';

import { useEffect, useState } from 'react';

/**
 * Stock disponível de um produto num armazém específico (linha sem lote).
 * O backend usa a mesma regra; aqui serve para avisar antes de submeter.
 */
export function useWarehouseStock(productId: string, warehouseId: string, enabled: boolean) {
  const [available, setAvailable] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!enabled || !productId || !warehouseId) {
      setAvailable(null);
      setChecking(false);
      return;
    }
    const controller = new AbortController();
    setChecking(true);
    const params = new URLSearchParams({ productId, warehouseId });
    fetch(`/api/stock/balances?${params.toString()}`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((rows: unknown) => {
        if (!Array.isArray(rows)) { setAvailable(null); return; }
        const total = rows
          .filter((row: any) => row && row.lotId == null)
          .reduce((sum: number, row: any) => sum + Number(row.quantity ?? 0), 0);
        setAvailable(total);
      })
      .catch(() => { if (!controller.signal.aborted) setAvailable(null); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [productId, warehouseId, enabled]);

  return { available, checking };
}
