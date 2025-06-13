import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Redis } from '@upstash/redis';
import { getJsonFromRedis, withRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { validatePrice } from '@/lib/AppUtils';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

function mergeCarts(guestItems: any[], userItems: any[]) {
  // Deduplicate by productId + variantId
  const merged = new Map();
  [...userItems, ...guestItems].forEach(item => {
    const key = item.id + '::' + (item.variantId || '');
    if (merged.has(key)) {
      // If already exists, sum the quantities
      const existing = merged.get(key);
      merged.set(key, {
        ...existing,
        quantity: existing.quantity + item.quantity
      });
    } else {
      merged.set(key, { ...item });
    }
  });
  return Array.from(merged.values());
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const { guestId } = await request.json();
    if (!guestId) {
      return NextResponse.json({ success: false, error: 'Missing guestId' }, { status: 400 });
    }

    // Load guest cart from Redis
    let guestItems: any[] = [];
    try {
      const guestCart = await withRedis(
        async (redis) => {
          const data = await redis.get(`cart:guest:${guestId}`);
          return data ? JSON.parse(data) : null;
        },
        null
      );
      guestItems = Array.isArray(guestCart?.items) ? guestCart.items : [];
    } catch (error) {
      logger.error(error, 'Failed to load guest cart from Redis');
      // Continue with empty guest cart
    }

    // Load user cart from DB
    const userCart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    const userItems = userCart?.items?.map((item) => ({
      id: item.productId,
      quantity: item.quantity,
      variantId: item.variantId,
      product: item.product,
      variant: item.variant,
    })) || [];

    // Merge carts
    const merged = mergeCarts(guestItems, userItems);

    // Save merged cart to DB
    const updatedCart = await prisma.cart.upsert({
      where: { userId },
      create: {
        userId,
        items: {
          create: merged.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            variantId: item.variantId,
          })),
        },
      },
      update: {
        items: {
          deleteMany: {},
          create: merged.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            variantId: item.variantId,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    // Delete guest cart from Redis
    try {
      await withRedis(
        async (redis) => redis.del(`cart:guest:${guestId}`),
        undefined
      );
    } catch (error) {
      logger.error(error, 'Failed to delete guest cart from Redis');
      // Continue even if Redis deletion fails
    }

    // Transform items for response
    const transformedItems = updatedCart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      variantId: item.variantId,
      price: validatePrice(Number(item.product.price)),
      originalPrice: validatePrice(Number(item.product.price)),
      name: item.product.name,
      image: item.product.images?.[0] || '',
      stock: item.product.stock,
      product: {
        id: item.product.id,
        name: item.product.name,
        price: validatePrice(Number(item.product.price)),
        images: item.product.images || [],
        stock: item.product.stock
      },
      variant: item.variant ? {
        id: item.variant.id,
        name: item.variant.name,
        price: item.variant.price ? validatePrice(Number(item.variant.price)) : null,
        stock: item.variant.stock
      } : null
    }));

    return NextResponse.json({ success: true, items: transformedItems });
  } catch (error) {
    logger.error(error, 'Failed to merge carts');
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to merge carts',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 