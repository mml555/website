// import { NextResponse } from "next/server"
// import { getServerSession } from "next-auth"
// import { authOptions } from "@/lib/auth"
import { prisma } from '@/lib/prisma'
// import { z } from "zod"
// import type { Prisma } from "@prisma/client"
// import { withRedis, getJsonFromRedis } from "@/lib/redis"
// import { rateLimit } from "@/lib/rate-limit"
// import * as Sentry from '@sentry/nextjs'
// import redis from '@/lib/redis'

// --- Zod Schemas ---
// const querySchema = z.object({
//   search: z.string().optional(),
//   sortBy: z.enum(['name_asc', 'name_desc', 'product_count']).optional(),
//   page: z.string().optional().transform(val => val ? parseInt(val) : 1),
//   limit: z.string().optional().transform(val => val ? parseInt(val) : 10)
// })
// const categorySchema = z.object({
//   name: z.string().min(1, "Name is required").max(50, "Name must be less than 50 characters"),
//   description: z.string().optional(),
// })

// --- Type Definitions ---
// interface CategoryWithCount {
//   id: string
//   name: string
//   description: string | null
//   createdAt: Date
//   updatedAt: Date
//   _count: {
//     products: number
//   }
// }

// Cache configuration
// const CACHE_DURATION = 5 * 60; // 5 minutes in seconds

// function getCacheKey(url: string): string {
//   return `categories:${url}`;
// }

// async function getCachedData(key: string) {
//   const cached = await getJsonFromRedis<{ data: any; timestamp: number }>(key);
//   if (cached && cached.data && cached.timestamp) {
//     if (Date.now() - cached.timestamp < CACHE_DURATION * 1000) {
//       return cached.data;
//     }
//   }
//   return null;
// }

// async function setCachedData(key: string, data: any) {
//   return withRedis(
//     async (redis) => {
//       try {
//         const cacheData = {
//           data,
//           timestamp: Date.now()
//         };
//         await redis.set(key, JSON.stringify(cacheData));
//       } catch (error) {
//         console.warn('Failed to cache data:', error);
//       }
//     },
//     undefined
//   );
// }

// async function invalidateProductAndCategoryCache() {
//   if (!redis) return;
//   await withRedis(async (r) => {
//     const productKeys = await r.keys('products:*');
//     const categoryKeys = await r.keys('categories:*');
//     const keys = [...productKeys, ...categoryKeys];
//     if (keys.length > 0) {
//       await r.del(...keys);
//     }
//   }, undefined);
// }

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    })
    return new Response(JSON.stringify({ categories }), { status: 200 })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch categories' }), { status: 500 })
  }
}

// export async function GET(request: Request) { ... }

// export async function POST(request: Request) { ... } 