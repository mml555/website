import { NextRequest, NextResponse } from 'next/server'
import prisma from 'app/lib/prisma'
import { decimalToNumber } from '@/lib/utils'

interface ProductWithRelations {
  id: string;
  name: string;
  price: number;
  image: string;
  category: {
    id: string;
    name: string;
  };
  variants: Array<{
    id: string;
    name: string;
    price: number;
    stock: number;
  }>;
}

/**
 * @param {Request} request
 * @param {{ params: { id: string } }} context
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'similar'
    const limit = parseInt(searchParams.get('limit') || '4')
    const { id } = await context.params

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Initialize with empty array
    let relatedProducts: any[] = []

    if (type === 'similar') {
      // Find products in the same category
      relatedProducts = await prisma.product.findMany({
        where: {
          categoryId: product.categoryId,
          id: { not: id },
        },
        include: {
          category: true,
        },
        take: limit,
      })
    } else if (type === 'complementary') {
      // Find products that are often bought together
      // This is a simple implementation - you might want to enhance this logic
      relatedProducts = await prisma.product.findMany({
        where: {
          categoryId: product.categoryId,
          id: { not: id },
        },
        include: {
          category: true,
        },
        take: limit,
      })
    }

    // If we don't have enough related products, get some from other categories
    if (relatedProducts.length < limit) {
      const additionalProducts = await prisma.product.findMany({
        where: {
          categoryId: { not: product.categoryId },
          id: { not: id },
        },
        include: {
          category: true,
          variants: true,
        },
        take: limit - relatedProducts.length,
      })

      relatedProducts.push(...additionalProducts)
    }

    // Debug log: print raw related products before mapping
    console.log('RelatedProducts raw:', relatedProducts);

    // Deduplicate by product ID
    const uniqueProductsMap = new Map();
    for (const product of relatedProducts) {
      if (!uniqueProductsMap.has(product.id)) {
        uniqueProductsMap.set(product.id, product);
      }
    }
    const uniqueProducts = Array.from(uniqueProductsMap.values());

    const formattedProducts = uniqueProducts.map((product: any) => {
      const convertedPrice = decimalToNumber(product.price);
      return {
        id: product.id,
        name: product.name,
        price: convertedPrice,
        image: product.images[0] || null,
        images: Array.isArray(product.images) ? product.images : [],
        category: product.category ? {
          id: product.category.id,
          name: product.category.name
        } : null,
        variants: product.variants?.map((variant: any) => ({
          id: variant.id,
          name: variant.name,
          price: decimalToNumber(variant.price),
          stock: variant.stock,
        })) || [],
      };
    });

    return NextResponse.json(formattedProducts)
  } catch (error) {
    console.error('Error fetching related products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch related products' },
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
    const { toProductId, type } = await request.json()
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ message: 'Product ID is required' }, { status: 400 })
    }

    // Validate required fields
    if (!toProductId || !type) {
      return NextResponse.json(
        { message: 'Related product ID and type are required' },
        { status: 400 }
      )
    }

    // Validate product exists
    const [fromProduct, toProduct] = await Promise.all([
      prisma.product.findUnique({
        where: { id },
      }),
      prisma.product.findUnique({
        where: { id: toProductId },
      }),
    ])

    if (!fromProduct || !toProduct) {
      return NextResponse.json(
        { message: 'One or both products not found' },
        { status: 404 }
      )
    }

    // Check if relation already exists
    const existingRelation = await prisma.productRelation.findFirst({
      where: {
        fromProductId: id,
        toProductId,
      },
    })

    if (existingRelation) {
      return NextResponse.json(
        { message: 'Products are already related' },
        { status: 400 }
      )
    }

    // Create relation
    const relation = await prisma.productRelation.create({
      data: {
        fromProductId: id,
        toProductId,
        type,
      },
    })

    return NextResponse.json(relation)
  } catch (error) {
    console.error('Error creating product relation:', error)
    return NextResponse.json(
      { message: 'Failed to create product relation' },
      { status: 500 }
    )
  }
} 