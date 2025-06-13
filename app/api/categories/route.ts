import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from '@/lib/prisma'
import { z } from "zod"
import { withRedis, getJsonFromRedis, setCacheWithExpiry } from "@/lib/redis"
import { logger } from '@/lib/logger'
import { monitoring } from '@/lib/monitoring'

// --- Zod Schemas ---
const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be less than 50 characters"),
  description: z.string().optional(),
})

// Cache configuration
const CACHE_DURATION = 5 * 60; // 5 minutes in seconds

function getCacheKey(url: string): string {
  return `categories:${url}`;
}

async function getCachedData(key: string) {
  return monitoring.measureAsync('get_cached_categories', async () => {
    try {
      const cached = await getJsonFromRedis<{ data: any; timestamp: number }>(key);
      if (cached && cached.data && cached.timestamp) {
        if (Date.now() - cached.timestamp < CACHE_DURATION * 1000) {
          logger.debug(`Cache hit for categories: ${key}`);
          return cached.data;
        }
        logger.debug(`Cache expired for categories: ${key}`);
      }
      return null;
    } catch (error) {
      logger.warn('Cache read error: ' + (error instanceof Error ? error.message : String(error)));
      return null;
    }
  }, { operation: 'cache_read' });
}

async function setCachedData(key: string, data: any) {
  return monitoring.measureAsync('set_cached_categories', async () => {
    try {
      await setCacheWithExpiry(key, {
        data,
        timestamp: Date.now()
      }, CACHE_DURATION);
      logger.debug(`Cache set for categories: ${key}`);
    } catch (error) {
      logger.warn('Failed to cache data: ' + (error instanceof Error ? error.message : String(error)));
    }
  }, { operation: 'cache_write' });
}

async function invalidateCategoryCache() {
  await withRedis(async (redis) => {
    const keys = await redis.keys('categories:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }, undefined);
}

export async function GET(request: Request) {
  return monitoring.measureAsync('get_categories', async () => {
    try {
      const url = new URL(request.url);
      const cacheKey = getCacheKey(url.toString());
      
      // Try to get from cache first
      const cachedData = await getCachedData(cacheKey);
      if (cachedData) {
        return new Response(JSON.stringify({ categories: cachedData }), { status: 200 });
      }

      // If not in cache, fetch from database
      const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { products: true }
          }
        }
      });

      logger.info(`Fetched ${categories.length} categories from database`);

      // Cache the result
      await setCachedData(cacheKey, categories);

      return new Response(JSON.stringify({ categories }), { status: 200 });
    } catch (error) {
      logger.error('Error fetching categories: ' + (error instanceof Error ? error.message : String(error)));
      monitoring.trackError(error as Error, { endpoint: '/api/categories' });
      return new Response(JSON.stringify({ error: 'Failed to fetch categories' }), { status: 500 });
    }
  }, { endpoint: '/api/categories' });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validationResult = categorySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid category data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const category = await prisma.category.create({
      data: {
        name: validationResult.data.name,
        description: validationResult.data.description || null,
      },
    });

    // Invalidate category cache
    await invalidateCategoryCache();

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error creating category: ' + errorMessage);
    monitoring.trackError(error as Error, { endpoint: '/api/categories' });
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
} 