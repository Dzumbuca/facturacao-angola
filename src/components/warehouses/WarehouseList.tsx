'use client';

type Warehouse = {
  id: string;
  name: string;
  location: string | null;
  isDefault: boolean;
  isActive: boolean;
};

type Props = {
  warehouses: Warehouse[];
};

export function WarehouseList({ warehouses }: Props) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col space-y-1.5 p-6">
        <h3 className="text-lg font-semibold leading-none tracking-tight">Armazéns</h3>
      </div>
      <div className="p-6 pt-0">
        {warehouses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum armazém registado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Nome</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Localização</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Estado</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Predefinido</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((warehouse) => (
                  <tr key={warehouse.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle font-medium">{warehouse.name}</td>
                    <td className="p-4 align-middle">{warehouse.location || '-'}</td>
                    <td className="p-4 align-middle">
                      {warehouse.isActive ? (
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-primary text-primary-foreground">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="p-4 align-middle">
                      {warehouse.isDefault ? (
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors">
                          Predefinido
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
