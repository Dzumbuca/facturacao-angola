import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { runWithTenant } from '@/lib/tenant-db';

export async function GET(request: Request) {
  try {
    const session = await auth();
    const tenantId = getSessionTenantId(session);
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const type = searchParams.get('type');
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam) : 30;

    const movements = await runWithTenant(tenantId, async (tx) => {
      const where: any = {
        tenantId,
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

      return tx.stockMovement.findMany({
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