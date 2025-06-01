import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// --- Zod Schemas ---
const querySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  maxPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  stockFilter: z.enum(['all', 'in_stock', 'out_of_stock']).optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'name_asc', 'name_desc', 'newest', 'stock_desc']).optional(),
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10)
})

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.number().min(0, "Price must be positive"),
  stock: z.number().int().min(0, "Stock must be a positive integer"),
  categoryId: z.string().min(1, "Category is required"),
  images: z.array(z.string().url("Image must be a valid URL")).min(1, "At least one image is required"),
  sku: z.string().optional(),
  featured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  weight: z.number().optional(),
})

// --- Type Definitions ---
interface ProductWithCategory {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  image: string | null
  images: string[]
  categoryId: string
  sku: string | null
  featured: boolean
  isActive: boolean
  weight: number | null
  category: {
    id: string
    name: string
  }
  variants: Array<{
    id: string
    name: string
    price: number
    stock: number
    type: string
  }>
  tags: string[]
  rating: number
  reviews: number
  brand: string | null
  dimensions: {
    length: number
    width: number
    height: number
  } | null
  shipping: {
    weight: number
    dimensions: {
      length: number
      width: number
      height: number
    }
    freeShipping: boolean
  } | null
  metadata: Record<string, string> | null
  createdAt: Date
  updatedAt: Date
}

// Cache configuration
const CACHE_DURATION = 5 * 60; // 5 minutes in seconds
const cache = new Map<string, { data: any; timestamp: number }>();

function getCacheKey(url: string): string {
  return `products:${url}`;
}

function getCachedData(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION * 1000) {
    return cached.data;
  }
  return null;
}

function setCachedData(key: string, data: any) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams.entries())
    
    // Validate and parse query parameters
    const validatedParams = querySchema.safeParse(params)
    if (!validatedParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validatedParams.error },
        { status: 400 }
      )
    }

    const {
      search,
      category,
      minPrice,
      maxPrice,
      stockFilter = 'all',
      sortBy = 'newest',
      page = 1,
      limit = 10
    } = validatedParams.data

    // Check cache first
    const cacheKey = getCacheKey(request.url);
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Build where clause
    const where = {
      AND: [
        // Search condition
        search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } }
          ]
        } : {},
        // Category filter
        category ? { categoryId: category } : {},
        // Price range
        {
          AND: [
            minPrice ? { price: { gte: minPrice } } : {},
            maxPrice ? { price: { lte: maxPrice } } : {}
          ]
        },
        // Stock filter
        stockFilter === 'in_stock' ? { stock: { gt: 0 } } : 
        stockFilter === 'out_of_stock' ? { stock: { equals: 0 } } : {}
      ]
    }

    // Build order by clause
    let orderBy: any = { createdAt: "desc" };
    if (sortBy === "price_asc") {
      orderBy = { price: "asc" };
    } else if (sortBy === "price_desc") {
      orderBy = { price: "desc" };
    } else if (sortBy === "name_asc") {
      orderBy = { name: "asc" };
    } else if (sortBy === "name_desc") {
      orderBy = { name: "desc" };
    } else if (sortBy === "stock_desc") {
      orderBy = { stock: "desc" };
    }

    // Get total count for pagination
    const total = await prisma.product.count({ where })

    // Fetch products with pagination
    const products = await prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        variants: {
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            type: true
          }
        }
      }
    })

    // Transform the response to match the expected schema
    const transformedProducts = products.map((product: any) => ({
      id: product.id,
      name: product.name,
      description: product.description || "",
      price: typeof product.price === "string" ? parseFloat(product.price) : Number(product.price),
      stock: Number(product.stock),
      images: Array.isArray(product.images) ? product.images : [],
      categoryId: product.categoryId,
      sku: product.sku || null,
      featured: product.featured || false,
      isActive: product.isActive ?? true,
      category: product.category ? {
        id: product.category.id,
        name: product.category.name
      } : null,
      weight: product.weight ? Number(product.weight) : null,
      variants: product.variants?.map((variant: any) => ({
        id: variant.id,
        name: variant.name,
        price: typeof variant.price === "string" ? parseFloat(variant.price) : Number(variant.price),
        stock: Number(variant.stock),
        type: variant.type || ""
      })) || [],
      tags: [],
      rating: 0,
      reviews: 0,
      brand: undefined,
      dimensions: undefined,
      shipping: undefined,
      metadata: undefined,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString()
    }))

    const response = {
      products: transformedProducts,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        limit
      }
    };

    // Cache the response
    setCachedData(cacheKey, response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API_PRODUCTS_ERROR]', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate product data
    const validationResult = productSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid product data', details: validationResult.error.format() },
        { status: 400 }
      )
    }

    // Check for duplicate product name
    const existingProduct = await prisma.product.findFirst({
      where: { name: validationResult.data.name },
      select: { id: true }
    })
    if (existingProduct) {
      return NextResponse.json(
        { error: 'A product with this name already exists.' },
        { status: 409 }
      )
    }

    // Create product in database (support images array)
    const newProduct = await prisma.product.create({
      data: {
        name: validationResult.data.name,
        description: validationResult.data.description || null,
        price: validationResult.data.price,
        stock: validationResult.data.stock,
        images: validationResult.data.images || [],
        categoryId: validationResult.data.categoryId,
        sku: validationResult.data.sku || null,
        featured: validationResult.data.featured ?? false,
        isActive: validationResult.data.isActive ?? true,
        weight: validationResult.data.weight ?? null,
        // Add more fields as needed
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        variants: true
      }
    })

    // Transform the response to match the expected Product type
    const transformedProduct = {
      id: newProduct.id,
      name: newProduct.name,
      description: newProduct.description,
      price: Number(newProduct.price),
      stock: newProduct.stock,
      images: Array.isArray(newProduct.images) ? newProduct.images : [],
      categoryId: newProduct.categoryId,
      sku: newProduct.sku || null,
      featured: newProduct.featured || false,
      isActive: newProduct.isActive ?? true,
      weight: newProduct.weight ? Number(newProduct.weight) : null,
      category: newProduct.category ? {
        id: newProduct.category.id,
        name: newProduct.category.name
      } : null,
      variants: newProduct.variants?.map((variant: any) => ({
        id: variant.id,
        name: variant.name,
        price: variant.price ? Number(variant.price) : null,
        stock: variant.stock,
        type: variant.type || ""
      })) || [],
      tags: [],
      rating: 0,
      reviews: 0,
      brand: undefined,
      dimensions: undefined,
      shipping: undefined,
      metadata: undefined,
      createdAt: newProduct.createdAt instanceof Date ? newProduct.createdAt.toISOString() : newProduct.createdAt,
      updatedAt: newProduct.updatedAt instanceof Date ? newProduct.updatedAt.toISOString() : newProduct.updatedAt
    }

    return NextResponse.json(transformedProduct)
  } catch (error) {
    console.error('[API_PRODUCTS_POST_ERROR]', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
} 