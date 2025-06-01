import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Redis } from '@upstash/redis';
import { decimalToNumber } from '@/lib/utils';
import { getJsonFromRedis } from '@/lib/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

function mergeCarts(guestItems: any[], userItems: any[]) {
  const merged = new Map();
  userItems.forEach(item => merged.set(item.id + (item.variantId || ''), item));
  guestItems.forEach(item => {
    const key = item.id + (item.variantId || '');
    if (merged.has(key)) {
      const userItem = merged.get(key);
      merged.set(key, {
        ...userItem,
        quantity: Math.max(userItem.quantity, item.quantity)
      });
    } else {
      merged.set(key, item);
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
    const guestCart = (await getJsonFromRedis<{ items: any[] }>(`cart:guest:${guestId}`)) || { items: [] };
    const guestItems = Array.isArray(guestCart.items) ? guestCart.items : [];
    // Load user cart from DB
    const userCart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: true,
      },
    });
    const userItems = userCart?.items?.map((item: any) => ({
      id: item.productId,
      quantity: item.quantity,
      variantId: item.variantId
    })) || [];
    // Merge
    const merged = mergeCarts(guestItems, userItems);
    // Save merged cart to DB
    await prisma.cart.upsert({
      where: { userId },
      create: {
        userId,
        items: {
          create: merged.map((item: any) => ({
            productId: item.id,
            quantity: item.quantity,
            variantId: item.variantId
          })),
        },
      },
      update: {
        items: {
          deleteMany: {},
          create: merged.map((item: any) => ({
            productId: item.id,
            quantity: item.quantity,
            variantId: item.variantId
          })),
        },
      },
      include: {
        items: true,
      },
    });
    // Delete guest cart from Redis
    await redis.del(`cart:guest:${guestId}`);
    return NextResponse.json({ success: true, items: merged });
  } catch (error) {
    console.error('[API_CART_MERGE_ERROR]', error);
    return NextResponse.json({ success: false, error: 'Failed to merge carts' }, { status: 500 });
  }
} 