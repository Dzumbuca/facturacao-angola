'use client';

import { useEffect, useState } from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { Card, Table, TableRow, TableCell, TableHead, TableBody, Badge } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, Search, Plus } from 'lucide-react';

type Warehouse = {
  id: string;
  name: string;
  location?: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  productCount: number;
  totalStock: number;
};

type StockMovement = {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason?: string;
  reference?: string;
  product: { name: string; codigo?: string };
  createdBy?: string;
  createdAt: Date;
};

export default function WarehousesPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; stock: number; minStock: number; categoria: string }>>([]);
  const [showNewWarehouse, setShowNewWarehouse] = useState(false);
  const [showNewMovement, setShowNewMovement] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [newWarehouseLocation, setNewWarehouseLocation] = useState('');
  const [newMovementType, setNewMovementType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('OUT');
  const [newMovementQuantity, setNewMovementQuantity] = useState(0);
  const [newMovementProductId, setNewMovementProductId] = useState<string | null>(null);
  const [newMovementReason, setNewMovementReason] = useState('');
  const [newMovementReference, setNewMovementReference] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  // Get tenant ID from auth
  useEffect(() => {
    const user = auth();
    // ... get tenant ID
  }, []);

  // Load warehouses
  useEffect(() => {
    const loadData = async () => {
      try {
        const user = await auth();
        const sessionUser = user?.user as any;
        const tid = typeof sessionUser?.tenantId === 'string' ? sessionUser.tenantId : null;
        setTenantId(tid);

        if (tid) {
          const [warehouseData, productData, movementData] = await Promise.all([
            prisma.warehouse.findMany({
              where: { tenantId: tid },
              include: { _count: { select: { products: true } } },
              orderBy: { name: 'asc' },
            }),
            prisma.product.findMany({
              where: { tenantId: tid },
              include: { stockMovements: { take: 5, orderBy: { createdAt: 'desc' } } },
              orderBy: { name: 'asc' },
            }),
            prisma.stockMovement.findMany({
              where: { tenantId: tid },
              include: { product: { select: { name: true } } },
              orderBy: { createdAt: 'desc' },
              take: 20,
            }),
          ]);

          setWarehouses(
            warehouseData.map((w: any) => ({
              id: w.id,
              name: w.name,
              location: w.location,
              isActive: w.isActive,
              isDefault: w.isDefault,
              createdAt: w.createdAt,
              productCount: w._count.products,
              totalStock: w.products?.reduce((sum: number, p: any) => sum + (p.stock || 0), 0) || 0,
            }))
          );

          setProducts(
            productData.map((p: any) => ({
              id: p.id,
              name: p.name,
              stock: p.stock || 0,
              minStock: p.minStock || 0,
              categoria: p.categoria || 'GERAL',
            }))
          );

          setMovements(movementData.map((m: any) => ({
            id: m.id,
            type: m.type,
            quantity: m.quantity,
            reason: m.reason,
            reference: m.reference,
            product: { name: m.product.name, codigo: m.product.codigo },
            createdBy: m.createdByUserId,
            createdAt: m.createdAt,
          })));
        }
      } catch (error) {
        console.error('Error loading warehouse data:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os dados do armazém',
          variant: 'destructive',
        });
      }
    };

    loadData();
  }, [router]);

  // ... rest of component
  
  return null;
}
const router = useRouter();
  const { toast } = useToast();

  // Get tenant ID from auth
  useEffect(() => {
    const loadTenantId = async () => {
      try {
        const session = await auth();
        const sessionUser = session?.user as any;
        const tid = typeof sessionUser?.tenantId === 'string' ? sessionUser.tenantId : null;
        setTenantId(tid);
      } catch (error) {
        console.error('Error getting tenant ID:', error);
      }
    };
    loadTenantId();
  }, [router]);

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      if (!tenantId) return;

      try {
        const [warehouseData, productData, movementData] = await Promise.all([
          prisma.warehouse.findMany({
            where: { tenantId },
            include: { _count: { select: { products: true } } },
            orderBy: { name: 'asc' },
          }),
          prisma.product.findMany({
            where: { tenantId },
            include: { stockMovements: { take: 1, orderBy: { createdAt: 'desc' } } },
            orderBy: { name: 'asc' },
          }),
          prisma.stockMovement.findMany({
            where: { tenantId },
            include: { product: { select: { name: true, codigo: true } } },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
        ]);

        // Format warehouses
        setWarehouses(
          warehouseData.map((w: any) => {
            const productsWithStock = productData.filter((p: any) => p.tenantId === tenantId);
            const totalStock = productsWithStock.reduce(
              (sum: number, p: any) => sum + (p.stock || 0), 
              0
            );
            
            return {
              id: w.id,
              name: w.name,
              location: w.location,
              isActive: w.isActive,
              isDefault: w.isDefault,
              createdAt: w.createdAt,
              productCount: w._count.products,
              totalStock,
            };
          })
        );

        // Format products with stock status
        const formattedProducts = productData.map((p: any) => {
          const lowStock = p.stock <= (p.minStock || 0);
          const outOfStock = (p.stock || 0) <= 0;
          const stockValue = (p.stock || 0) * (p.price || 0);
          
          return {
            id: p.id,
            name: p.name,
            codigo: p.codigo,
            categoria: p.categoria || 'GERAL',
            stock: p.stock || 0,
            minStock: p.minStock || 0,
            price: p.price || 0,
            stockValue,
            lowStock,
            outOfStock,
          };
        });

        setProducts(formattedProducts);

        // Format movements
        const formattedMovements = movementData.map((m: any) => ({
          id: m.id,
          type: m.type,
          quantity: m.quantity,
          reason: m.reason,
          reference: m.reference,
          product: { name: m.product.name, codigo: m.product.codigo },
          createdBy: m.createdByUserId,
          createdAt: m.createdAt,
        }));

        setMovements(formattedMovements);
      } catch (error) {
        console.error('Error loading warehouse data:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os dados do armazém',
          variant: 'destructive',
        });
      }
    };

    loadData();
  }, [tenantId, router]);

  // Calculate indicators
  const totalProducts = products.length;
  const totalStock = products.reduce((sum: number, p: any) => sum + p.stock, 0);
  const lowStockProducts = products.filter((p: any) => p.stock <= (p.minStock || 0)).length;
  const outOfStockProducts = products.filter((p: any) => (p.stock || 0) <= 0).length;
  const totalValue = products.reduce((sum: number, p: any) => sum + ((p.stock || 0) * (p.price || 0)), 0);

  // Format date helper
  const formatDate = (date: Date | string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-PT');
  };

  const formatTime = (date: Date | string) => {
    if (!date) return '-';
    return new Date(date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  };
return (
  <div className="p-6 space-y-6">
    <h1 className="text-2xl font-bold">Armazéns</h1>
<h2 className="text-lg font-medium mb-4">Registar Movimentação de Stock</h2>
<div className="space-y-4">
          <Dialog open={showNewMovement} onOpenChange=(open: boolean) => setShowNewMovement(open)>
            <DialogContent className="p-4">
              <DialogHeader>
                <DialogTitle>Nova Movimentação de Stock</DialogTitle>
              </DialogHeader>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
<div className="mt-6">
<div className="mt-6">
<div className="mt-6">
<h2 className="text-lg font-medium mb-4">Registar Movimentação de Stock</h2>
<br />
        <h2 className="text-xl font-medium mb-4">Histórico de Movimentações</h2>
        
        {movements.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhum movimento de stock registado.</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell className="text-left p-2">Data</TableCell>
                <TableCell className="text-left p-2">Produto</TableCell>
                <TableCell className="text-left p-2">Tipo</TableCell>
                <TableCell className="text-right p-2">Quantidade</TableCell>
                <TableCell className="text-left p-2">Motivo</TableCell>
                <TableCell className="text-left p-2">Referência</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movements.map((m: any) => (
                <TableRow key={m.id} className="border-t">
                  <TableCell className="text-sm">{formatDate(m.createdAt)}</TableCell>
                  <TableCell className="text-sm">{m.product.name}</TableCell>
                  <TableCell className="text-sm">
                    {m.type === 'IN' ? (
                      <Badge variant="default">Entrada</Badge>
                    ) : m.type === 'OUT' ? (
                      <Badge variant="destructive">Saída</Badge>
                    ) : (
                      <Badge variant="secondary">Ajuste</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">{m.quantity}</TableCell>
                  <TableCell className="text-sm">{m.reason || '-'}</TableCell>
                  <TableCell className="text-sm">{m.reference || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
        <h2 className="text-xl font-medium mb-4">Produtos e Stock</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((p: any) => (
            <Card key={p.id} className="p-3 h-full">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium truncate line-clamp-1">{p.name}</h3>
                  <p className="text-xs text-gray-500">{p.categoria}</p>
                </div>
                <div className="text-right">
                  <Badge 
                    variant={p.outOfStock ? 'destructive' : p.lowStock ? 'secondary' : 'default'}
                    className="text-xs"
                  >
                    {p.outOfStock ? 'Esgotado' : p.lowStock ? 'Baixo' : 'OK'}
                  </Badge>
                </div>
              </div>
              
              <div className="mt-2">
                <p className="text-2xl font-bold">{p.stock}</p>
                <p className="text-sm text-gray-500">un</p>
              </div>
              
              <div className="mt-2">
                <p className="text-xs text-gray-400">Mínimo: {p.minStock}</p>
                {p.price && <p className="text-xs text-gray-400">Preço: {p.price.toLocaleString('pt-AO')} Kz</p>}
              </div>
              
              {p.outOfStock && (
                <p className="mt-2 text-xs text-red-500">⚠️ Sem stock</p>
              )}
              {p.lowStock && !p.outOfStock && (
                <p className="mt-2 text-xs text-amber-500">⚠️ Stock baixo</p>
              )}
            </Card>
          ))}
        </div>
      </div>
        <h2 className="text-xl font-medium mb-4">Armazéns Registados</h2>
        
        {warehouses.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhum armazém registado. Crie o primeiro armazém usando o formulário acima.</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell className="w-24">Nome</TableCell>
                <TableCell>Localização</TableCell>
                <TableCell>Produtos</TableCell>
                <TableCell className="text-right">Stock Total</TableCell>
                <TableCell className="text-center">Default</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {warehouses.map((w: any) => (
                <TableRow key={w.id} className="border-b">
                  <TableCell>{w.name}</TableCell>
                  <TableCell>{w.location || '-'}</TableCell>
                  <TableCell>{w.productCount} produtos</TableCell>
                  <TableCell className="text-right font-medium">{w.totalStock}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={w.isDefault ? 'default' : 'outline'}>{w.isDefault ? 'Sim' : 'Não'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      className="text-muted-foreground"
                      aria-label="Ver detalhes do armazém"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total Produtos</p>
            <p className="text-2xl font-bold">{totalProducts}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Stock Total</p>
            <p className="text-2xl font-bold text-primary">{totalStock}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Stock Baixo</p>
            <p className="text-2xl font-bold text-amber-600">{lowStockProducts}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Sem Stock</p>
            <p className="text-2xl font-bold text-red-600">{outOfStockProducts}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Valor Estimado</p>
            <p className="text-2xl font-bold text-green-600">{totalValue.toLocaleString('pt-AO')} Kz</p>
          </div>
        </Card>
      </div>

);
}

