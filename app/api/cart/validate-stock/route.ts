import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  const body = await request.json();
  const { productId, variantId } = body;

  if (!productId) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
  }

  // Fetch product with variants
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      stock: true,
      variants: {
        select: {
          id: true,
          name: true,
          stock: true
        }
      }
    }
  });

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // If variantId is provided, check variant stock
  if (variantId) {
    const variant = product.variants.find((v: { id: string }) => v.id === variantId);
    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    }
    return NextResponse.json({ id: variant.id, name: `${product.name} - ${variant.name}`, stock: variant.stock });
  }

  // Otherwise, return product stock
  return NextResponse.json({ id: product.id, name: product.name, stock: product.stock });
} 