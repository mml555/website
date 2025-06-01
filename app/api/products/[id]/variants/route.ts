import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * @param {Request} request
 * @param {{ params: { id: string } }} context
 */
// @ts-ignore
export async function GET(request: Request, { params }) {
  const { id } = params as { id: string }
  try {
    const variants = await prisma.productVariant.findMany({
      where: {
        productId: id,
      },
      orderBy: {
        type: 'asc',
      },
    })

    return NextResponse.json(variants)
  } catch (error) {
    console.error('Error fetching product variants:', error)
    return NextResponse.json(
      { message: 'Failed to fetch product variants' },
      { status: 500 }
    )
  }
}

/**
 * @param {Request} request
 * @param {{ params: { id: string } }} context
 */
// @ts-ignore
export async function POST(request: Request, { params }) {
  const { id } = params as { id: string }
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { name, type, price, stock, image, specs, sku } = await request.json()

    // Validate required fields
    if (!name || !type) {
      return NextResponse.json(
        { message: 'Name and type are required' },
        { status: 400 }
      )
    }

    // Validate product exists
    const product = await prisma.product.findUnique({
      where: { id },
    })

    if (!product) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 }
      )
    }

    // Validate SKU uniqueness if provided
    if (sku) {
      const existingVariant = await prisma.productVariant.findUnique({
        where: { sku },
      })

      if (existingVariant) {
        return NextResponse.json(
          { message: 'SKU already exists' },
          { status: 400 }
        )
      }
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId: id,
        name,
        type,
        price,
        stock,
        image,
        specs,
        sku,
      },
    })

    return NextResponse.json(variant)
  } catch (error) {
    console.error('Error creating product variant:', error)
    return NextResponse.json(
      { message: 'Failed to create product variant' },
      { status: 500 }
    )
  }
} 