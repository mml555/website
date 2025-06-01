import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import redis from '@/lib/redis'
import { Decimal } from '@prisma/client/runtime/library'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    // Safe session user email extraction
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email },
      select: { role: true },
    })

    if (user?.role !== "ADMIN") {
      return NextResponse.json(
        { message: "Forbidden - Admin access required" },
        { status: 403 }
      )
    }

    // Optional: Try Redis cache first
    const cacheKey = 'admin:dashboard:stats';
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached && typeof cached === 'string') {
        try {
          return NextResponse.json(JSON.parse(cached));
        } catch {}
      }
    }

    // Run all queries in parallel
    const [totalOrders, totalProducts, recentOrders, totalRevenue] = await Promise.all([
      prisma.order.count(),
      prisma.product.count(),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          total: true,
          status: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.order.aggregate({ _sum: { total: true } }),
    ])

    // Convert Decimal to number if needed
    let totalRevenueValue = totalRevenue._sum.total || 0;
    if (typeof totalRevenueValue === 'object' && totalRevenueValue instanceof Decimal) {
      totalRevenueValue = totalRevenueValue.toNumber();
    }

    const result = {
      totalOrders,
      totalProducts,
      totalRevenue: totalRevenueValue,
      recentOrders,
    };

    // Cache result in Redis for 60s
    if (redis) {
      await redis.set(cacheKey, JSON.stringify(result), { ex: 60 });
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
} 