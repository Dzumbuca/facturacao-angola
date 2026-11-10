'use client';

import { TrashIcon, EditIcon } from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Warehouse = {
  id: string;
  name: string;
  location: string | null;
  isDefault: boolean;
  isActive: boolean;
};

type Props = {
  warehouses: Warehouse[];
  onEdit?: (warehouse: Warehouse) => void;
  onToggle?: (warehouse: Warehouse) => void;
  onDelete?: (warehouse: Warehouse) => void;
  deletingId?: string | null;
};

export function WarehouseList({
  warehouses,
  onEdit,
  onToggle,
  onDelete,
  deletingId,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Armazéns</CardTitle>
      </CardHeader>
      <CardContent>
        {warehouses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d7e1eb] bg-[#f8fafc] px-5 py-12 text-center">
            <p className="font-semibold text-[#344a60]">Nenhum armazém registado.</p>
            <p className="mt-1 text-sm text-[#708195]">Crie o primeiro armazém para começar a gerir o inventário.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Localização</th>
                  <th>Estado</th>
                  <th>Predefinido</th>
                  <th className="text-center">Acções</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((warehouse) => {
                  const statusBadge = warehouse.isActive
                    ? 'bg-[#eff9f4] text-[#267256] border border-[#cbe8dc]'
                    : 'bg-[#fdf3f3] text-[#a83939] border border-red-100';
                  const defaultBadge = warehouse.isDefault
                    ? 'bg-[#eff4f8] text-[#2878d0] border border-[#cdddeb]'
                    : 'bg-[#f0f4f8] text-[#64768a] border border-[#e7edf3]';
                  return (
                    <tr key={warehouse.id} className="transition hover:bg-[#f8fafc]">
                      <td data-mobile-primary className="font-semibold text-[#263c52]">{warehouse.name}</td>
                      <td className="text-[#607286]">{warehouse.location || '-'}</td>
                      <td>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent ${statusBadge}`}>
                          {warehouse.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent ${defaultBadge}`}>
                          {warehouse.isDefault ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td data-mobile-actions className="text-center">
                        <div className="flex gap-2 justify-center">
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(warehouse)}
                              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#cdddeb] px-3 py-1.5 text-sm font-semibold text-[#2878d0] transition hover:bg-[#f0f6fc]"
                            >
                              <EditIcon className="h-3.5 w-3.5 mr-1" /> Editar
                            </button>
                          )}
                          {onToggle && (
                            <button
                              type="button"
                              onClick={() => onToggle(warehouse)}
                              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#cdddeb] px-3 py-1.5 text-sm font-semibold text-[#64768a] transition hover:bg-[#f0f4f8]"
                            >
                              {warehouse.isActive ? 'Desactivar' : 'Activar'}
                            </button>
                          )}
                          {onDelete && (
                            <button
                              type="button"
                              onClick={() => onDelete(warehouse)}
                              disabled={deletingId === warehouse.id}
                              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#f0d3d3] px-3 py-1.5 text-sm font-semibold text-[#a83939] transition hover:bg-[#fdf3f3] disabled:opacity-50"
                            >
                              <TrashIcon className="h-3.5 w-3.5 mr-1" /> Apagar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
