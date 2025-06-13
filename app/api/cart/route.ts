import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/AppUtils';
import { getJsonFromRedis, withRedis } from '@/lib/redis';
import type { DbCartItem } from '@/types/product';

// Cache TTL in seconds
const CACHE_TTL = 300; // 5 minutes

// Response headers helper
function getResponseHeaders() {
  return {
    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    'Content-Type': 'application/json',
  };
}

interface ProductWithVariants {
  id: string;
  name: string;
  price: number;
  images: string[];
  stock: number;
  sku: string | null;
  variants?: {
    id: string;
    name: string;
    price: number | null;
    stock: number;
    image: string | null;
    type: string;
    specs: any;
  }[];
}

interface CartItemWithProduct extends DbCartItem {
  product: ProductWithVariants;
  variantId?: string | null;
}

export async function GET(request: Request) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    
    // Get or create session ID for anonymous users
    let sessionId = request.headers.get('x-session-id');
    if (!sessionId && !userId) {
      sessionId = crypto.randomUUID();
    }

    // Check cache
    const cacheKey = userId ? `cart:${userId}` : `cart:${sessionId}`;
    const cachedCart = await getJsonFromRedis<any>(cacheKey);
    
    if (cachedCart) {
      return NextResponse.json(cachedCart, { 
        headers: {
          ...getResponseHeaders(),
          'x-session-id': sessionId || ''
        }
      });
    }

    // Get cart from database
    let cart = await prisma.cart.findFirst({
      where: userId ? { userId } : { sessionId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                images: true,
                stock: true,
                sku: true,
                variants: true
              }
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    // Auto-create cart if it doesn't exist
    if (!cart) {
      cart = await prisma.cart.create({
        data: userId ? { userId } : { sessionId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  images: true,
                  stock: true,
                  sku: true,
                  variants: true
                }
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });
    }

    // Convert Decimal to number for each product price
    const cartWithNumberPrices = {
      ...cart,
      items: cart.items.map((item: any) => {
        const variant = item.variantId && item.product.variants
          ? item.product.variants.find((v: any) => v.id === item.variantId)
          : null;

        const price = variant?.price ? decimalToNumber(variant.price) : decimalToNumber(item.product.price);

        return {
          ...item,
          name: item.product.name,
          price: price,
          originalPrice: price, // Set original price to initial price
          image: variant?.image || item.product.images[0] || '',
          stock: variant?.stock ?? item.product.stock,
          product: {
            ...item.product,
            price: decimalToNumber(item.product.price),
            images: item.product.images || [],
            variants: item.product.variants?.map((v: any) => ({
              ...v,
              price: v.price ? decimalToNumber(v.price) : null
            })) || []
          }
        };
      }),
    };

    // Cache the cart with proper JSON serialization
    await withRedis(
      (r) => r.set(cacheKey, JSON.stringify(cartWithNumberPrices), 'EX', CACHE_TTL),
      undefined
    );

    return NextResponse.json(cartWithNumberPrices, { headers: getResponseHeaders() });
  } catch (error) {
    console.error('Error fetching cart:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch cart',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: getResponseHeaders() }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: getResponseHeaders() }
      );
    }

    const body = await request.json();
    const { productId, quantity } = body;

    if (!productId || typeof quantity !== 'number' || quantity < 1) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400, headers: getResponseHeaders() }
      );
    }

    // Get or create cart
    let cart = await prisma.cart.findFirst({
      where: { userId: session.user.id },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId: session.user.id },
      });
    }

    // Check if product exists and has enough stock
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, stock: true, price: true },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404, headers: getResponseHeaders() }
      );
    }

    if (product.stock < quantity) {
      return NextResponse.json(
        { error: 'Not enough stock available' },
        { status: 400, headers: getResponseHeaders() }
      );
    }

    // Add or update cart item
    const cartItem = await prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: product.id,
        },
      },
      update: {
        quantity: {
          increment: quantity,
        },
      },
      create: {
        cartId: cart.id,
        productId: product.id,
        quantity,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            images: true,
            stock: true,
            sku: true,
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            image: true,
          },
        },
      },
    });

    // Invalidate cache
    await withRedis(
      (r) => r.del(`cart:${session.user.id}`),
      undefined
    );

    return NextResponse.json(
      {
        ...cartItem,
        product: {
          ...cartItem.product,
          price: decimalToNumber(cartItem.product.price),
          images: cartItem.product.images || [],
        },
        variant: cartItem.variant ? {
          ...cartItem.variant,
          price: cartItem.variant.price ? decimalToNumber(cartItem.variant.price) : null,
        } : null,
      },
      { status: 200, headers: getResponseHeaders() }
    );
  } catch (error) {
    console.error('Error updating cart:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update cart',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: getResponseHeaders() }
    );
  }
} 