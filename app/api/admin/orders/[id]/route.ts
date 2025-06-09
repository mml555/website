import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client'

const ALLOWED_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

// @ts-expect-error Next.js provides context dynamically
export async function GET(req: Request, context) {
  const id = context.params.id;
  const session = await getServerSession(authOptions as any);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!id) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
  }
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: true,
      items: { include: { product: true, variant: true } },
      billingAddress: true,
      shippingAddress: true,
    },
  });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  return NextResponse.json(order);
}

// @ts-expect-error Next.js provides context dynamically
export async function PATCH(req: Request, context) {
  const id = context.params.id;
  const session = await getServerSession(authOptions as any);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!id) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
  }
  const body = await req.json();
  const { status } = body;
  if (!status || typeof status !== 'string' || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Missing or invalid status' }, { status: 400 });
  }
  try {
    const order = await prisma.order.update({
      where: { id },
      data: { status: OrderStatus[status as keyof typeof OrderStatus] },
    });
    return NextResponse.json(order);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
} 