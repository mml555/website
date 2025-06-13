import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validatePrice } from '@/lib/AppUtils';

export async function POST(request: Request) {
  try {
    const { items } = await request.json();

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Invalid request: items must be an array' },
        { status: 400 }
      );
    }

    const validationResults = await Promise.all(
      items.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            variants: {
              where: { id: item.variantId },
              select: {
                id: true,
                stock: true,
                price: true,
              },
            },
          },
        });

        if (!product) {
          return {
            productId: item.productId,
            isValid: false,
            error: 'Product not found',
          };
        }

        const variant = item.variantId
          ? product.variants.find((v) => v.id === item.variantId)
          : null;

        const currentStock = variant ? variant.stock : product.stock;
        const currentPrice = validatePrice(variant ? variant.price : product.price);

        return {
          productId: item.productId,
          variantId: item.variantId,
          isValid: currentStock >= item.quantity,
          currentStock,
          currentPrice,
          requestedQuantity: item.quantity,
        };
      })
    );

    return NextResponse.json({ results: validationResults });
  } catch (error) {
    console.error('Error validating stock:', error);
    return NextResponse.json(
      { error: 'Failed to validate stock' },
      { status: 500 }
    );
  }
} 