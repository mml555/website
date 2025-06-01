import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { withRedis, getJsonFromRedis } from "@/lib/redis"
import { rateLimit } from "@/lib/rate-limit"
import * as Sentry from '@sentry/nextjs'
import redis from '@/lib/redis'

// --- Zod Schemas ---
const querySchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(['name_asc', 'name_desc', 'product_count']).optional(),
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10)
})
const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be less than 50 characters"),
  description: z.string().optional(),
})

// --- Type Definitions ---
interface CategoryWithCount {
  id: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
  _count: {
    products: number
  }
}

// Cache configuration
const CACHE_DURATION = 5 * 60; // 5 minutes in seconds

function getCacheKey(url: string): string {
  return `categories:${url}`;
}

async function getCachedData(key: string) {
  const cached = await getJsonFromRedis<{ data: any; timestamp: number }>(key);
  if (cached && cached.data && cached.timestamp) {
    if (Date.now() - cached.timestamp < CACHE_DURATION * 1000) {
      return cached.data;
    }
  }
  return null;
}

async function setCachedData(key: string, data: any) {
  return withRedis(
    async (redis) => {
      try {
        const cacheData = {
          data,
          timestamp: Date.now()
        };
        await redis.set(key, JSON.stringify(cacheData));
      } catch (error) {
        console.warn('Failed to cache data:', error);
      }
    },
    undefined
  );
}

async function invalidateProductAndCategoryCache() {
  if (!redis) return;
  await withRedis(async (r) => {
    const productKeys = await r.keys('products:*');
    const categoryKeys = await r.keys('categories:*');
    const keys = [...productKeys, ...categoryKeys];
    if (keys.length > 0) {
      await r.del(...keys);
    }
  }, undefined);
}

export async function GET(request: Request) {
  try {
    console.log('[API_CATEGORIES] Starting GET request');
    
    // Rate limiting
    const limiter = rateLimit({
      interval: 60 * 1000, // 1 minute
      uniqueTokenPerInterval: 500
    });
    
    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    await limiter.check(10, ip); // 10 requests per minute

    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams.entries())
    console.log('[API_CATEGORIES] Query params:', params);
    
    // Validate and parse query parameters
    const validatedParams = querySchema.safeParse(params)
    if (!validatedParams.success) {
      console.log('[API_CATEGORIES] Invalid query params:', validatedParams.error);
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validatedParams.error },
        { status: 400 }
      )
    }

    const {
      search,
      sortBy = 'name_asc',
      page = 1,
      limit = 10
    } = validatedParams.data

    // Check cache first
    const cacheKey = getCacheKey(request.url);
    console.log('[API_CATEGORIES] Checking cache with key:', cacheKey);
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      console.log('[API_CATEGORIES] Cache hit');
      return NextResponse.json(cachedData);
    }
    console.log('[API_CATEGORIES] Cache miss, fetching from database');

    // Build where clause
    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {}

    // Build order by clause
    let orderBy: any = { name: "asc" };
    if (sortBy === "name_desc") {
      orderBy = { name: "desc" };
    } else if (sortBy === "product_count") {
      orderBy = { products: { _count: "desc" } };
    }

    console.log('[API_CATEGORIES] Fetching categories with:', { where, orderBy, page, limit });

    // Get total count for pagination
    const total = await prisma.category.count({ where })
    console.log('[API_CATEGORIES] Total categories:', total);

    // Fetch categories with pagination
    const categories = await prisma.category.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: {
          select: { products: true }
        }
      }
    }) as CategoryWithCount[]
    console.log('[API_CATEGORIES] Fetched categories:', categories);

    // Transform the response to match the expected schema
    const transformedCategories = categories.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description || undefined,
      _count: {
        products: category._count.products
      }
    }))

    const response = {
      categories: transformedCategories,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        limit
      }
    }

    // Cache the response
    console.log('[API_CATEGORIES] Caching response');
    await setCachedData(cacheKey, response)

    console.log('[API_CATEGORIES] Returning response');
    return NextResponse.json(response)
  } catch (error) {
    Sentry.captureException(error)
    if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
      console.log('[API_CATEGORIES] Rate limit exceeded');
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    console.error('[API_CATEGORIES_ERROR]', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate category data
    const validationResult = categorySchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid category data', details: validationResult.error.format() },
        { status: 400 }
      )
    }

    // Check for duplicate category name
    const existingCategory = await prisma.category.findUnique({
      where: { name: validationResult.data.name }
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      )
    }

    // Create category in database
    const newCategory = await prisma.category.create({
      data: {
        name: validationResult.data.name,
        description: validationResult.data.description || null
      }
    })

    // Transform the response to match the expected schema
    const transformedCategory = {
      id: newCategory.id,
      name: newCategory.name,
      description: newCategory.description || undefined
    }

    // Invalidate categories cache
    await invalidateProductAndCategoryCache();

    return NextResponse.json(transformedCategory)
  } catch (error) {
    Sentry.captureException(error)
    console.error('[API_CATEGORIES_POST_ERROR]', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    )
  }
} 