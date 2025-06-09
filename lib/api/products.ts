import { prisma } from '@/lib/prisma'
import type { Product } from '@/types/product'
import { decimalToNumber } from '@/lib/AppUtils'

interface DbProduct {
  id: string
  name: string
  description: string
  price: number
  images?: string[]
  stock: number
  categoryId: string | null
  sku: string | null
  featured: boolean
  isActive: boolean
  weight?: number
  category?: {
    id: string
    name: string
  }
  variants: Array<{
    id: string
    name: string
    price: number
    image: string | null
    stock: number
    sku: string | null
    specs: any
    type: string
    productId: string
    createdAt: Date
    updatedAt: Date
  }>
  createdAt: Date
  updatedAt: Date
}

export async function getProduct(id: string): Promise<Product | null> {
  const dbProduct = await prisma.product.findUnique({
    where: { id },
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      variants: true,
    },
  }) as DbProduct | null

  if (!dbProduct) return null

  // Ensure we have valid image data
  const images = Array.isArray(dbProduct.images)
    ? dbProduct.images.filter((img: string) => typeof img === 'string' && img.length > 0)
    : [];

  return {
    ...dbProduct,
    price: Number(dbProduct.price),
    images,
    stock: dbProduct.stock,
    categoryId: dbProduct.categoryId,
    sku: dbProduct.sku || null,
    featured: dbProduct.featured || false,
    isActive: dbProduct.isActive || true,
    weight: dbProduct.weight ? decimalToNumber(dbProduct.weight) : undefined,
    dimensions: undefined,
    variants: dbProduct.variants.map((variant) => ({
      ...variant,
      price: decimalToNumber(variant.price),
    })),
    createdAt: dbProduct.createdAt instanceof Date ? dbProduct.createdAt.toISOString() : dbProduct.createdAt,
    updatedAt: dbProduct.updatedAt instanceof Date ? dbProduct.updatedAt.toISOString() : dbProduct.updatedAt,
  } as Product
} 