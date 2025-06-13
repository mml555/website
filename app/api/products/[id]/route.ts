import { z } from 'zod';
import redis, { withRedis } from '@/lib/redis'
import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server';
import { convertDecimalsToNumbers } from '@/lib/AppUtils';

const prisma = new PrismaClient()

// Define the schema for the product response
const productResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number().positive(),
  images: z.array(z.string().url()),
  category: z.object({
    id: z.string(),
    name: z.string(),
  }).nullable(),
  stock: z.number().int().min(0),
  weight: z.number().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Define the schema for updating a product
const updateProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().min(1, 'Description is required'),
  price: z.number().positive('Price must be positive'),
  images: z.array(z.string().url('Invalid image URL')).optional(),
  categoryId: z.string().min(1, 'Category is required'),
});

// Helper function to convert price to number
function convertPriceToNumber(price: any): number {
  if (typeof price === 'number') return price;
  if (typeof price === 'string') return parseFloat(price);
  if (price && typeof price === 'object') {
    if (typeof price.toNumber === 'function') return price.toNumber();
    if (typeof price.toString === 'function') return parseFloat(price.toString());
    if (price.amount) return price.amount;
  }
  return 0;
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

// export async function GET(request: Request, context: any) { ... }
// export async function PATCH(request: Request, context: any) { ... }
// export async function DELETE(request: Request, context: any) { ... }

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get the ID from the URL path
    const id = params.id;
    
    // Try to get from cache first
    const cached = await withRedis(async (redis) => {
      const cachedProduct = await redis.get(`product:${id}`);
      if (cachedProduct) {
        return JSON.parse(cachedProduct);
      }
      return null;
    }, null);

    if (cached) {
      return NextResponse.json(cached);
    }

    // If not in cache, get from database
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Convert Decimal fields to numbers
    const productData = convertDecimalsToNumbers(product);

    // Cache the result
    await withRedis(async (redis) => {
      await redis.set(`product:${id}`, JSON.stringify(productData), 'EX', 3600); // Cache for 1 hour
    }, undefined);

    return NextResponse.json(productData);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
} 