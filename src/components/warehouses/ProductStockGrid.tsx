'use client';

type Product = {
  id: string;
  name: string;
  codigo: string | null;
  price: number | string;
  stock: number;
  minStock: number;
  categoria: string;
};

type Props = {
  products: Product[];
};

function formatCurrency(value: number | string) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(num || 0);
}

function getStockStatus(stock: number, minStock: number) {
  if (stock <= 0) return { label: 'Sem stock', className: 'bg-destructive text-destructive-foreground' };
  if (stock <= minStock) return { label: 'Stock baixo', className: 'bg-secondary text-secondary-foreground' };
  return { label: 'OK', className: 'bg-primary text-primary-foreground' };
}

export function ProductStockGrid({ products }: Props) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col space-y-1.5 p-6">
        <h3 className="text-lg font-semibold leading-none tracking-tight">Produtos em stock</h3>
      </div>
      <div className="p-6 pt-0">
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto registado.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const status = getStockStatus(Number(product.stock), Number(product.minStock));
              return (
                <div key={product.id} className="rounded-lg border bg-card text-card-foreground shadow-sm">
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-medium leading-none">{product.name}</p>
                        {product.codigo && <p className="text-xs text-muted-foreground">{product.codigo}</p>}
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-4 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Preço</span>
                        <span>{formatCurrency(product.price)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stock</span>
                        <span className="font-medium">{product.stock}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stock mínimo</span>
                        <span>{product.minStock}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Categoria</span>
                        <span>{product.categoria}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
