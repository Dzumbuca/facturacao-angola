'use client';

import { Card, CardContent } from '@/components/ui/card';

type Warehouse = {
  id: string;
  name: string;
  location: string | null;
  isDefault: boolean;
  isActive: boolean;
  productCount?: number;
};

export function WarehouseCards({ warehouses, onEdit, onToggle, onDelete, deletingId }: {
  warehouses: Warehouse[];
  onEdit?: (w: Warehouse) => void;
  onToggle?: (w: Warehouse) => void;
  onDelete?: (w: Warehouse) => void;
  deletingId?: string | null;
}) {
  if (warehouses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#d7e1eb] bg-[#f8fafc] px-5 py-12 text-center">
        <p className="font-semibold text-[#344a60]">Nenhum armazém registado.</p>
        <p className="mt-1 text-sm text-[#708195]">Crie o primeiro armazém para começar a gerir o inventário.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {warehouses.map((w) => (
        <Card key={w.id} className="p-4 transition hover:border-[#2878d0]/40">
          <CardContent className="p-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-[#1c2d3f]">{w.name}</h3>
                <p className="mt-0.5 text-sm text-[#607286]">{w.location || 'Sem localização'}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${w.isActive ? 'bg-[#eff9f4] text-[#267256]' : 'bg-[#fdf3f3] text-[#a83939]'}`}>
                {w.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {w.isDefault && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eff4f8] px-2 py-0.5 text-[10px] font-semibold text-[#2878d0]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#2878d0]" /> Padrão
                </span>
              )}
              <span className="text-xs text-[#708195]">
                {w.productCount ?? 0} produto{w.productCount === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-3 flex gap-1.5 border-t border-[#e7edf3] pt-2.5">
              {onToggle && (
                <button type="button" onClick={() => onToggle(w)} className="rounded-lg border border-[#cdddeb] px-2.5 py-1 text-xs font-semibold text-[#64768a] hover:bg-[#f0f4f8]">
                  {w.isActive ? 'Desactivar' : 'Activar'}
                </button>
              )}
              {onEdit && (
                <button type="button" onClick={() => onEdit(w)} className="rounded-lg border border-[#cdddeb] px-2.5 py-1 text-xs font-semibold text-[#2878d0] hover:bg-[#f0f6fc]">
                  Editar
                </button>
              )}
              {onDelete && (
                <button type="button" disabled={deletingId === w.id} onClick={() => onDelete(w)} className="ml-auto rounded-lg border border-[#f0d3d3] px-2.5 py-1 text-xs font-semibold text-[#a83939] hover:bg-[#fdf3f3] disabled:opacity-50">
                  Apagar
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}