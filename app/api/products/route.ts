import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
// import { captureException } from '@sentry/nextjs'
import { validateCsrfToken } from '@/lib/csrf'
import { withRedis, getJsonFromRedis, setCacheWithExpiry, clearCache } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { monitoring } from '@/lib/monitoring'

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

function getCacheKey(url: string): string {
  return `products:${url}`;
}

async function getCachedData(key: string) {
  return monitoring.measureAsync('get_cached_products', async () => {
    try {
      const cached = await getJsonFromRedis<{ data: any; timestamp: number }>(key);
      if (cached && cached.data && cached.timestamp) {
        if (Date.now() - cached.timestamp < CACHE_DURATION * 1000) {
          logger.debug('Cache hit for products', { key });
          return cached.data;
        }
        logger.debug('Cache expired for products', { key });
      }
      return null;
    } catch (error) {
      logger.warn('Cache read error:', error);
      return null;
    }
  }, { operation: 'cache_read' });
}

async function setCachedData(key: string, data: any) {
  return monitoring.measureAsync('set_cached_products', async () => {
    try {
      await setCacheWithExpiry(key, {
        data,
        timestamp: Date.now()
      }, CACHE_DURATION);
      logger.debug('Cache set for products', { key });
    } catch (error) {
      logger.warn('Failed to cache data:', error);
    }
  }, { operation: 'cache_write' });
}

async function invalidateProductAndCategoryCache() {
  return monitoring.measureAsync('invalidate_cache', async () => {
    try {
      await clearCache('products:*');
      await clearCache('categories:*');
      logger.info('Product and category cache cleared');
    } catch (error) {
      logger.error('Failed to clear cache:', error);
    }
  }, { operation: 'cache_invalidation' });
}

export async function GET(request: Request) {
  return monitoring.measureAsync('get_products', async () => {
    try {
      const { searchParams } = new URL(request.url);
      const query = Object.fromEntries(searchParams.entries());
      const parsed = querySchema.safeParse(query);
      
      if (!parsed.success) {
        logger.warn('Invalid query parameters', { error: parsed.error.format() });
        return new Response(JSON.stringify({ error: 'Invalid query parameters', details: parsed.error.format() }), { status: 400 });
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
      } = parsed.data;

      // Try to get from cache first
      const cacheKey = getCacheKey(request.url);
      const cachedData = await getCachedData(cacheKey);
      if (cachedData) {
        return new Response(JSON.stringify(cachedData), { status: 200 });
      }

      // Build price filter
      let priceFilter: any = {};
      if (typeof minPrice === 'number') priceFilter.gte = minPrice;
      if (typeof maxPrice === 'number') priceFilter.lte = maxPrice;

      const where: any = {
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
        ...(category && { categoryId: category }),
        ...(Object.keys(priceFilter).length > 0 && { price: priceFilter }),
        ...(stockFilter === 'in_stock' && { stock: { gt: 0 } }),
        ...(stockFilter === 'out_of_stock' && { stock: 0 }),
      };

      let orderBy: any = { createdAt: 'desc' };
      switch (sortBy) {
        case 'price_asc':
          orderBy = { price: 'asc' };
          break;
        case 'price_desc':
          orderBy = { price: 'desc' };
          break;
        case 'name_asc':
          orderBy = { name: 'asc' };
          break;
        case 'name_desc':
          orderBy = { name: 'desc' };
          break;
        case 'stock_desc':
          orderBy = { stock: 'desc' };
          break;
        case 'newest':
        default:
          orderBy = { createdAt: 'desc' };
          break;
      }

      const skip = (page - 1) * limit;
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            category: { select: { id: true, name: true } },
            variants: true,
          },
        }),
        prisma.product.count({ where }),
      ]);

      // Transform price fields to numbers
      const productsWithNumberFields = products.map((p: any) => ({
        ...p,
        price: typeof p.price === 'object' && 'toNumber' in p.price ? p.price.toNumber() : Number(p.price),
        cost: p.cost ? (typeof p.cost === 'object' && 'toNumber' in p.cost ? p.cost.toNumber() : Number(p.cost)) : null,
        salePrice: p.salePrice ? (typeof p.salePrice === 'object' && 'toNumber' in p.salePrice ? p.salePrice.toNumber() : Number(p.salePrice)) : null,
      }));

      const pages = Math.ceil(total / limit);
      const pagination = { total, page, limit, pages };
      const response = { products: productsWithNumberFields, pagination };

      // Cache the result
      await setCachedData(cacheKey, response);

      logger.info('Products fetched successfully', { count: products.length, total, page, limit });
      return new Response(JSON.stringify(response), { status: 200 });
    } catch (error) {
      logger.error('Error fetching products:', error);
      monitoring.trackError(error as Error, { endpoint: '/api/products' });
      return new Response(JSON.stringify({ error: 'Failed to fetch products' }), { status: 500 });
    }
  }, { endpoint: '/api/products' });
}

export async function POST(request: Request) {
  try {
    // CSRF protection: expect token in header 'x-csrf-token'.
    // (Cookie support can be added if using NextRequest)
    const csrfToken = request.headers.get('x-csrf-token')
    if (!validateCsrfToken(csrfToken)) {
      return NextResponse.json(
        { error: 'Invalid or missing CSRF token' },
        { status: 403 }
      )
    }

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

    // Invalidate product and category cache after mutation
    await invalidateProductAndCategoryCache();

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
    // captureException(error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
} 