import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = context.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });
  }
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  // Convert price from Decimal to number
  const productWithNumberPrice = {
    ...product,
    price: typeof product.price === 'object' && 'toNumber' in product.price ? product.price.toNumber() : Number(product.price),
  };
  return NextResponse.json(productWithNumberPrice);
}

export async function PATCH(req: Request, context: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = context.params;
  const body = await req.json();
  const { name, price, stock, isActive } = body;
  if (!name || typeof price !== 'number' || typeof stock !== 'number') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  try {
    const product = await prisma.product.update({
      where: { id },
      data: { name, price, stock, isActive },
    });
    // Convert price from Decimal to number
    const productWithNumberPrice = {
      ...product,
      price: typeof product.price === 'object' && 'toNumber' in product.price ? product.price.toNumber() : Number(product.price),
    };
    return NextResponse.json(productWithNumberPrice);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = context.params;
  try {
    await prisma.product.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
} 