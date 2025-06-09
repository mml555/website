import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  let where: any = {};
  if (start || end) {
    where.createdAt = {};
    if (start) where.createdAt.gte = new Date(start);
    if (end) where.createdAt.lte = new Date(end);
  }
  const orders = await prisma.order.findMany({
    where,
    include: {
      user: { select: { email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const header = ['Order ID', 'User Email', 'Total', 'Status', 'Created At'];
  const rows = orders.map(order => [
    order.id,
    order.user?.email || '',
    order.total,
    order.status,
    order.createdAt.toISOString(),
  ]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="orders-report.csv"',
    },
  });
} 