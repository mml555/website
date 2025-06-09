import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { adminProductUpdateSchema } from '@/lib/validations/schemas';
import { convertDecimalsToNumbers } from '@/lib/AppUtils';

// @ts-expect-error Next.js provides context dynamically
export async function GET(req: NextRequest, context) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = context.params.id;
  if (!id) {
    return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });
  }
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    const productWithNumberFields = convertDecimalsToNumbers(product);
    return NextResponse.json(productWithNumberFields);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

// @ts-expect-error Next.js provides context dynamically
export async function PATCH(req: Request, context) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = context.params.id;
  try {
    const body = await req.json();
    const parsed = adminProductUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const updateData = parsed.data;
    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });
    const productWithNumberFields = convertDecimalsToNumbers(product);
    await prisma.auditLog.create({
      data: {
        action: 'EDIT_PRODUCT',
        userId: session.user.id,
        details: JSON.stringify({ productId: id, updated: productWithNumberFields }),
      },
    });
    return NextResponse.json(productWithNumberFields);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

// @ts-expect-error Next.js provides context dynamically
export async function DELETE(req: Request, context) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = context.params.id;
  try {
    const product = await prisma.product.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        action: 'DELETE_PRODUCT',
        userId: session.user.id,
        details: JSON.stringify({ productId: id, deleted: convertDecimalsToNumbers(product) }),
      },
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
} 