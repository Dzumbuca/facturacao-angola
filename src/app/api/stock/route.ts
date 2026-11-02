import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const productId = searchParams.get('productId');
    const type = searchParams.get('type');
    const days = searchParams.get('days') ? parseInt(searchParams.get('days') as string) : 30;

    const where: any = {
      tenantId: tenantId || '',
    };

    if (productId) {
      where.productId = productId;
    }

    if (type) {
      where.type = type;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days || 30));

    where.createdAt = {
      gte: startDate,
    };

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: {
          select: {
            name: true,
            codigo: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return new Response(JSON.stringify(movements), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

/** GET stock summary */
export async function HEAD(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}