import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Cache configuration
const CACHE_DURATION = 30; // 30 seconds in seconds
const cache = new Map<string, { data: any; timestamp: number }>();

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
const MAX_REQUESTS = 30; // 30 requests per minute
const requestCounts = new Map<string, { count: number; timestamp: number }>();

function getCacheKey(id: string, variantId?: string): string {
  return `stock:${id}:${variantId || 'main'}`;
}

function getCachedData(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION * 1000) {
    return cached.data;
  }
  return null;
}

function setCachedData(key: string, data: any) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
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

/**
 * @param {Request} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    
    // Check rate limit
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const { id } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const variantId = searchParams.get('variantId') || undefined;

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = getCacheKey(id, variantId);
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const product = await prisma.product.findUnique({
      where: { id },
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
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // If variantId is provided, check variant stock
    if (variantId) {
      const variant = product.variants.find((v: { id: string }) => v.id === variantId);
      if (!variant) {
        return NextResponse.json(
          { error: 'Variant not found' },
          { status: 404 }
        );
      }
      const response = {
        id: variant.id,
        name: `${product.name} - ${variant.name}`,
        stock: variant.stock
      };
      setCachedData(cacheKey, response);
      return NextResponse.json(response);
    }

    // Return main product stock
    const response = {
      id: product.id,
      name: product.name,
      stock: product.stock
    };
    setCachedData(cacheKey, response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[API_STOCK_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock' },
      { status: 500 }
    );
  }
}

// @ts-ignore
export async function POST(request: Request, { params }) {
  // ... existing code ...
} 