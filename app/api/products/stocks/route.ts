import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import redis, { getJsonFromRedis } from '@/lib/redis'
import { Decimal } from '@prisma/client/runtime/library'

// Cache configuration
const CACHE_DURATION = 30; // 30 seconds

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60; // 1 minute
const MAX_REQUESTS = 30; // 30 requests per minute
const requestCounts = new Map<string, { count: number; timestamp: number }>();

// Schema for query parameters
const querySchema = z.object({
  ids: z.string().transform(val => val.split(',').filter(Boolean)),
  variantIds: z.string().optional().transform(val => val ? val.split(',').filter(Boolean) : [])
});

function getCacheKey(ids: string[], variantIds: string[]): string {
  return `stocks:${ids.join(',')}:${variantIds.join(',')}`;
}

// Cache helper functions
async function getCachedData(key: string) {
  return getJsonFromRedis<any>(key);
}

async function setCachedData(key: string, data: any, ttl: number = CACHE_DURATION) {
  try {
    if (!redis) {
      console.warn('Redis not initialized, skipping cache write')
      return
    }
    await redis.set(key, JSON.stringify(data), { ex: ttl })
  } catch (error) {
    console.warn('Cache write error:', error)
  }
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const userRequests = requestCounts.get(ip);
  
  if (!userRequests) {
    requestCounts.set(ip, { count: 1, timestamp: now });
    return false;
  }

  // Reset count if window has passed
  if (now - userRequests.timestamp > RATE_LIMIT_WINDOW * 1000) {
    requestCounts.set(ip, { count: 1, timestamp: now });
    return false;
  }

  // Increment count and check limit
  userRequests.count++;
  if (userRequests.count > MAX_REQUESTS) {
    return true;
  }

  return false;
}

// --- Type Definitions ---
interface ProductStock {
  id: string;
  name: string;
  stock: number;
  price: Decimal;
}

interface VariantStock {
  id: string;
  name: string;
  stock: number;
  price: Decimal | null;
  productId: string;
}

// Helper function to convert Decimal to number
function convertDecimalToNumber(value: Decimal | null): number {
  if (!value) return 0;
  return typeof value === 'number' ? value : Number(value.toString());
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const limiter = rateLimit({
      interval: 60 * 1000, // 1 minute
      uniqueTokenPerInterval: 500
    });
    
    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    await limiter.check(30, ip); // 30 requests per minute

    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams.entries())
    
    // Validate and parse query parameters
    const validatedParams = querySchema.safeParse(params)
    if (!validatedParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validatedParams.error },
        { status: 400 }
      )
    }

    const { ids, variantIds } = validatedParams.data

    // Check cache first
    const cacheKey = getCacheKey(ids, variantIds);
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Fetch products and variants
    const [products, variants] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          stock: true,
          price: true
        }
      }),
      variantIds.length > 0 ? prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          name: true,
          stock: true,
          price: true,
          productId: true
        }
      }) : []
    ]);

    // Combine product and variant stock information
    const stockInfo = [
      ...products.map((product: ProductStock) => ({
        id: product.id,
        name: product.name,
        stock: product.stock,
        price: convertDecimalToNumber(product.price)
      })),
      ...variants.map((variant: VariantStock) => ({
        id: variant.id,
        name: variant.name,
        stock: variant.stock,
        price: convertDecimalToNumber(variant.price),
        productId: variant.productId
      }))
    ];

    // Cache the response
    await setCachedData(cacheKey, stockInfo);

    return NextResponse.json(stockInfo)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    console.error('[API_STOCKS_ERROR]', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      { error: 'Failed to fetch stock information' },
      { status: 500 }
    )
  }
} 