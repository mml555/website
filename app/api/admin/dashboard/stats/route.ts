import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [totalOrders, totalSales, totalProducts, topProducts] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true } }),
    prisma.product.count(),
    prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
  ]);
  // Add type annotation for topProducts
  const typedTopProducts = topProducts as Array<{ productId: string; _sum: { quantity: number } }>;

  // Get product names for top products
  const productIds = typedTopProducts.map((p) => p.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
  const topProductsWithNames = typedTopProducts.map((p) => ({
    ...p,
    name: products.find((prod: { id: string; name: string }) => prod.id === p.productId)?.name || 'Unknown',
  }));

  return NextResponse.json({
    totalOrders,
    totalSales: totalSales._sum.total || 0,
    totalProducts,
    topProducts: topProductsWithNames,
  });
} 