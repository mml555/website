import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Redis } from '@upstash/redis'
import { Decimal } from '@prisma/client/runtime/library'
import { logger } from '@/lib/logger'
import type { Prisma } from '@prisma/client'

// Initialize Redis client with error handling
let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } else {
    console.warn('Redis credentials not found. Dashboard stats caching will be disabled.');
  }
} catch (error) {
  console.error('Failed to initialize Redis client:', error);
  // Continue without Redis - stats will be fetched directly from database
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== 'ADMIN') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Get total orders
    const totalOrders = await prisma.order.count();

    // Get total revenue
    const orders = await prisma.order.findMany({
      where: { status: 'PAID' }
    });
    const totalRevenue = orders.reduce((sum: number, order) => sum + Number(order.total), 0);

    // Get orders by status
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: true
    });

    // Get recent orders
    const recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    const result = {
      totalOrders,
      totalRevenue,
      ordersByStatus,
      recentOrders
    };

    // Cache result in Redis for 60s
    if (redis) {
      try {
        const cacheKey = 'admin:dashboard:stats' as const;
        await redis.setex(cacheKey, 60, JSON.stringify(result));
      } catch (redisError) {
        console.warn('Failed to cache dashboard stats:', redisError);
        // Continue without caching
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 