import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'
import { rateLimit } from '@/lib/rate-limit'
import type { CartItem, DbCartItem } from '@/types/product'
import { Redis } from '@upstash/redis'
import { decimalToNumber } from '@/lib/AppUtils'

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

// --- Zod Schemas ---
const cartItemSchema = z.object({
  id: z.string(),
  quantity: z.number().int().positive(),
  variantId: z.string().optional()
})

const cartSyncSchema = z.object({
  items: z.array(cartItemSchema)
})

type CartItemInput = z.infer<typeof cartItemSchema>

// --- Type Definitions ---
interface CartItemWithProduct {
  id: string
  productId: string
  quantity: number
  variantId: string | null
  product: {
    id: string
    name: string
    description: string | null
    price: Decimal
    images: string[]
    stock: number
    variants: {
      id: string
      name: string
      price: Decimal | null
      stock: number
      image: string | null
      type: string
      specs: any
    }[]
  }
}

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions as any)
    const userId = ((session as any)?.user as any)?.id
    let guestId: string | undefined = undefined;
    let isGuest = false;

    const body = await request.json();
    if (!userId) {
      guestId = body.guestId || undefined;
      if (!guestId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
      isGuest = true;
    }

    // Rate limiting (per user or guest)
    const rateLimitKey = userId || guestId;
    if (!rateLimitKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    try {
      console.log('[CartSync][RateLimit] Checking rate limit for key:', rateLimitKey);
      await limiter.check(10, rateLimitKey);
    } catch (err) {
      console.warn('[CartSync][RateLimit] Rate limit exceeded for key:', rateLimitKey, err);
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const validatedData = cartSyncSchema.safeParse(body)
    if (!validatedData.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid cart data', details: validatedData.error },
        { status: 400 }
      )
    }
    const { items } = validatedData.data

    // Verify all products exist
    const productIds = items.map(item => item.id)
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { variants: true }
    })
    if (existingProducts.length !== productIds.length) {
      const foundIds = existingProducts.map((p: { id: string }) => p.id)
      const missingIds = productIds.filter(id => !foundIds.includes(id))
      return NextResponse.json(
        {
          success: false,
          error: 'One or more products not found',
          missingProducts: missingIds
        },
        { status: 404 }
      )
    }

    // --- Server-side stock and variant validation ---
    const errors: Array<{ id: string; error: string; variantId?: string }> = [];
    const validItems: CartItemInput[] = [];
    for (const item of items) {
      const product = existingProducts.find((p) => p.id === item.id);
      if (!product) {
        errors.push({ id: item.id, error: 'Product not found' });
        continue;
      }
      let stock = product.stock;
      let variant = null;
      if (item.variantId) {
        variant = product.variants.find((v: any) => v.id === item.variantId);
        if (!variant) {
          errors.push({ id: item.id, variantId: item.variantId, error: 'Variant not found' });
          continue;
        }
        stock = variant.stock;
      }
      if (typeof item.quantity !== 'number' || item.quantity < 1) {
        errors.push({ id: item.id, variantId: item.variantId, error: 'Quantity must be at least 1' });
        continue;
      }
      if (typeof stock !== 'number' || item.quantity > stock) {
        errors.push({ id: item.id, variantId: item.variantId, error: `Only ${stock} items available in stock` });
        continue;
      }
      validItems.push(item);
    }
    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Some cart items are invalid',
        details: errors
      }, { status: 400 });
    }

    // For guests, store in Redis only
    if (isGuest && guestId) {
      // Transform items as for authenticated users (fetch product info)
      const productsById = Object.fromEntries(existingProducts.map((p: any) => [p.id, p]));
      const transformedItems = validItems.map((item: any) => {
        const product = productsById[item.id];
        const variant = item.variantId
          ? product.variants.find((v: any) => v.id === item.variantId)
          : null;
        return {
          id: item.id,
          quantity: item.quantity,
          variantId: item.variantId,
          name: product.name,
          price: variant?.price ? decimalToNumber(variant.price) : decimalToNumber(product.price),
          image: variant?.image || product.images[0] || '',
          stock: variant?.stock ?? product.stock,
          product: {
            ...product,
            price: decimalToNumber(product.price),
            images: product.images || [],
            variants: product.variants.map((variant: any) => ({
              ...variant,
              price: variant.price ? decimalToNumber(variant.price) : null
            }))
          }
        }
      });
      const cacheKey = `cart:guest:${guestId}`;
      await redis.set(cacheKey, JSON.stringify({ items: transformedItems }), { ex: 300 });
      return NextResponse.json({ items: transformedItems });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId || undefined }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Update cart in database (atomic delete then insert)
    let updatedCart;
    await prisma.$transaction(async (tx) => {
      // Find or create the cart
      let cart = await tx.cart.findUnique({ where: { userId: user.id } });
      if (!cart) {
        cart = await tx.cart.create({ data: { userId: user.id } });
      }
      // Delete all existing items
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      // Insert new items if any
      if (validItems.length > 0) {
        await tx.cartItem.createMany({
          data: validItems.map(item => ({
            cartId: cart.id,
            productId: item.id,
            quantity: item.quantity,
            variantId: item.variantId || null
          })),
          skipDuplicates: true
        });
      }
      // Fetch updated cart with items and product info
      updatedCart = await tx.cart.findUnique({
        where: { id: cart.id },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  images: true,
                  stock: true,
                  sku: true,
                  variants: true
                }
              }
            }
          }
        }
      });
    });

    // Transform cart items
    const transformedItems = updatedCart?.items?.map((item: any) => {
      const variant = item.variantId 
        ? item.product.variants.find((v: any) => v.id === item.variantId)
        : null;

      return {
        id: item.productId,
        quantity: item.quantity,
        variantId: item.variantId,
        name: item.product.name,
        price: variant?.price ? decimalToNumber(variant.price) : decimalToNumber(item.product.price),
        image: variant?.image || item.product.images[0] || '',
        stock: variant?.stock ?? item.product.stock,
        product: {
          ...item.product,
          price: decimalToNumber(item.product.price),
          images: item.product.images || [],
          variants: item.product.variants.map((variant: any) => ({
            ...variant,
            price: variant.price ? decimalToNumber(variant.price) : null
          }))
        }
      }
    })

    // Cache the synced cart with proper JSON serialization
    const cacheKey = `cart:${user.id}`;
    await redis.set(cacheKey, JSON.stringify({ items: transformedItems }), { ex: 300 });

    // Return items at the top level for frontend compatibility
    return NextResponse.json({ items: transformedItems });
  } catch (error) {
    console.error('[API_CART_SYNC_ERROR]', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      { success: false, error: 'Failed to sync cart' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
} 