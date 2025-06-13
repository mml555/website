import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'
import { RateLimiter } from '@/lib/rate-limit'
import { Redis } from '@upstash/redis'
import { decimalToNumber, validatePrice } from '@/lib/AppUtils'
import { logger } from '@/lib/logger'
import type { Prisma } from '@prisma/client'
import type { CartItem } from '@/types/cart'

// Initialize Redis client with error handling
let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } else {
    console.warn('Redis credentials not found. Guest cart functionality will be limited.');
  }
} catch (error) {
  console.error('Failed to initialize Redis client:', error);
  // Continue without Redis - client will fall back to localStorage
}

// --- Zod Schemas ---
const cartItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  quantity: z.number().int().positive(),
  variantId: z.string().optional(),
  price: z.number().positive(),
  name: z.string(),
  image: z.string().optional(),
  stock: z.number().optional(),
  originalPrice: z.number().positive().optional(),
  product: z.object({
    id: z.string(),
    name: z.string(),
    price: z.number().positive(),
    images: z.array(z.string()).optional(),
    stock: z.number().optional()
  }).optional(),
  variant: z.object({
    id: z.string(),
    name: z.string(),
    type: z.string()
  }).optional().nullable()
})

const cartSyncSchema = z.object({
  items: z.array(cartItemSchema),
  guestId: z.string().optional()
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate request body
    const result = cartSyncSchema.safeParse(body)
    if (!result.success) {
      console.error('Invalid cart sync request:', result.error)
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.format() },
        { status: 400 }
      )
    }

    const { items, guestId } = result.data

    // Process each item to ensure consistent price handling
    const processedItems = await Promise.all(items.map(async (item) => {
      try {
        // Fetch latest product data if not provided
        let productData = item.product
        if (!productData) {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: {
              id: true,
              name: true,
              price: true,
              images: true,
              stock: true
            }
          })
          if (product) {
            productData = {
              id: product.id,
              name: product.name,
              price: decimalToNumber(product.price),
              images: product.images as string[],
              stock: product.stock
            }
          } else {
            logger.warn(`Product not found for ID: ${item.productId}`)
          }
        }

        // Process the item
        const processedItem: CartItem = {
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          price: validatePrice(item.price),
          originalPrice: validatePrice(item.originalPrice || item.price),
          name: item.name,
          image: item.image || '',
          variantId: item.variantId || undefined,
          product: productData ? {
            id: productData.id,
            name: productData.name,
            price: validatePrice(productData.price),
            images: Array.isArray(productData.images) ? productData.images : [],
            stock: productData.stock
          } : undefined,
          variant: item.variant ? {
            id: item.variant.id,
            name: item.variant.name,
            type: item.variant.type
          } : undefined
        }

        return processedItem
      } catch (error) {
        console.error('Error processing cart item:', error)
        return null
      }
    }))

    // Filter out any failed items
    const validItems = processedItems.filter((item): item is CartItem => item !== null)

    // Store in Redis if available
    if (redis && guestId) {
      try {
        await redis.set(`cart:${guestId}`, JSON.stringify(validItems))
      } catch (error) {
        console.error('Failed to store cart in Redis:', error)
      }
    }

    return NextResponse.json({ items: validItems })
  } catch (error) {
    console.error('Error syncing cart:', error)
    return NextResponse.json(
      { error: 'Failed to sync cart' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
} 
