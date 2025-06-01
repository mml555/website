import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface ReviewStats {
  total: number;
  average: number;
}

interface Review {
  rating: number;
}

const VALID_SORT_FIELDS = ['createdAt', 'rating', 'helpful'] as const
type SortField = typeof VALID_SORT_FIELDS[number]

const VALID_SORT_ORDERS = ['asc', 'desc'] as const
type SortOrder = typeof VALID_SORT_ORDERS[number]

/**
 * @param {Request} request
 * @param {{ params: { id: string } }} context
 */
// @ts-ignore
export async function GET(
  request: Request,
  context: any
) {
  const { id } = context.params;
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const sortBy = searchParams.get('sortBy') || 'newest'

    const skip = (page - 1) * limit

    // Get total count for pagination
    const total = await prisma.review.count({
      where: { productId: id }
    })

    // Get reviews with pagination and sorting
    const reviews = await prisma.review.findMany({
      where: { productId: id },
      orderBy: {
        createdAt: sortBy === 'oldest' ? 'asc' : 'desc'
      },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json({
      reviews,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error("Error fetching reviews:", error)
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    )
  }
}

/**
 * @param {Request} request
 * @param {{ params: { id: string } }} context
 */
export async function POST(request: NextRequest, context: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { rating, comment } = await request.json()
    const { id } = context.params

    // Validate input
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Invalid rating. Must be a number between 1 and 5' },
        { status: 400 }
      )
    }

    if (comment && typeof comment !== 'string') {
      return NextResponse.json(
        { error: 'Comment must be a string' },
        { status: 400 }
      )
    }

    // Extract title from comment (first 50 characters)
    const title = comment ? comment.substring(0, 50) : 'Untitled Review'

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check if user has already reviewed this product
    const existingReview = await prisma.review.findFirst({
      where: {
        productId: id,
        userId: session.user.id,
      },
    })

    if (existingReview) {
      return NextResponse.json(
        { error: 'You have already reviewed this product' },
        { status: 400 }
      )
    }

    const review = await prisma.review.create({
      data: {
        rating,
        title,
        content: comment,
        productId: id,
        userId: session.user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(review)
  } catch (error) {
    console.error('Error creating review:', error)
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    )
  }
} 