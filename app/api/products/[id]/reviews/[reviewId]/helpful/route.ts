import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * @param {Request} request
 * @param {{ params: { id: string; reviewId: string } }} context
 */
// @ts-ignore
export async function POST(request: Request, { params }) {
  const { reviewId } = params as { id: string; reviewId: string }
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has already marked this review as helpful
    const existingHelpful = await prisma.reviewHelpful.findFirst({
      where: {
        reviewId,
        userId: session.user.id,
      },
    })

    if (existingHelpful) {
      return NextResponse.json(
        { message: 'You have already marked this review as helpful' },
        { status: 400 }
      )
    }

    // Create helpful record and increment helpful count
    const [helpful] = await prisma.$transaction([
      prisma.reviewHelpful.create({
        data: {
          reviewId,
          userId: session.user.id,
        },
      }),
      prisma.review.update({
        where: { id: reviewId },
        data: {
          helpful: {
            increment: 1,
          },
        },
      }),
    ])

    return NextResponse.json(helpful)
  } catch (error) {
    console.error('Error marking review as helpful:', error)
    return NextResponse.json(
      { message: 'Failed to mark review as helpful' },
      { status: 500 }
    )
  }
} 