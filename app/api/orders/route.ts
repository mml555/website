import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"
import { z } from "zod"
import { generateOrderNumber } from '@/lib/order-utils'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { getJsonFromRedis } from '@/lib/redis'
import { logError } from '@/lib/errors'
import { Session } from "next-auth"
import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { NextRequest } from 'next/server'
import redis from '@/lib/redis'

// Cache TTL in seconds
const CACHE_TTL = 300 // 5 minutes

// Initialize Stripe with proper error handling
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    logError('Stripe secret key is missing');
    throw new Error('Stripe secret key is missing');
  }
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      maxNetworkRetries: 3,
      timeout: 20000, // 20 seconds
      apiVersion: '2023-10-16',
    });
    logError('Stripe initialized successfully');
    return stripe;
  } catch (error) {
    logError('Failed to initialize Stripe:', error instanceof Error ? error.stack : String(error));
    throw new Error('Failed to initialize Stripe');
  }
};

// --- Zod Schemas ---
const querySchema = z.object({
  page: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  status: z.string().optional(),
})

// Validation schemas
const ItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
  price: z.number().positive()
})

const AddressSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(1, 'Phone is required'),
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
  type: z.enum(['SHIPPING', 'BILLING'])
})

const CheckoutSchema = z.object({
  items: z.array(ItemSchema).nonempty(),
  shippingAddress: AddressSchema.extend({ type: z.literal('SHIPPING') }),
  billingAddress: AddressSchema.extend({ type: z.literal('BILLING') }),
  shippingRate: z.object({
    id: z.string(),
    name: z.string(),
    rate: z.number().min(0),
    estimatedDays: z.number().positive()
  }),
  total: z.number().positive()
})

// --- Type Definitions ---
interface Order {
  id: string
  userId: string
  status: 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  total: number
  createdAt: Date
  updatedAt: Date
  orderNumber: string
  customerEmail: string
  user: {
    id: string
    name: string
    email: string
    role: string
    isGuest: boolean
  }
  items: Array<{
    id: string
    productId: string
    quantity: number
    price: number
    product: {
      id: string
      name: string
      price: number
    }
    variant: {
      id: string
      name: string
      type: string
    } | null
  }>
  shippingAddress: {
    id: string
    name: string
    email: string
    street: string
    city: string
    state: string
    postalCode: string
    country: string
  } | null
  billingAddress: {
    id: string
    name: string
    email: string
    street: string
    city: string
    state: string
    postalCode: string
    country: string
  } | null
}

// Add type for order
interface OrderWithUser {
  userId: string | null;
  user?: {
    isGuest: boolean;
    email: string;
  } | null;
  shippingAddress?: {
    email: string;
  } | null;
  billingAddress?: {
    email: string;
  } | null;
}

// Add type for product
interface Product {
  id: string;
  stock: number;
  name: string;
  price: number;
  variants: Array<{
    id: string;
    stock: number;
    price: number | null;
  }>;
}

// Add type for order item
interface OrderItem {
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
}

// --- Response Headers Helper ---
function getResponseHeaders() {
  return {
    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    'Content-Type': 'application/json',
  }
}

// --- Cache Key Generator ---
function generateCacheKey(params: Record<string, string>, userId: string) {
  return `orders:${userId}:${Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(':')}`
}

// --- Audit Logging Helper ---
async function logAudit(action: string, userId: string, details: any) {
  try {
    const auditLogModel = (prisma as any).auditLog
    if (auditLogModel && typeof auditLogModel.create === 'function') {
      await auditLogModel.create({
        data: {
          action,
          userId,
          details: JSON.stringify(details),
        },
      })
    }
  } catch (err) {
    logError('Audit log error:', err instanceof Error ? err.message : String(err))
  }
}

// Helper to generate a verification token and send welcome email
async function sendWelcomeEmail(user: { email: string; name?: string; id: string }) {
  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');
  // Store the token in the VerificationToken table (Prisma default)
  await prisma.verificationToken.create({
    data: {
      identifier: user.email,
      token,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours
    },
  });
  // Build the password setup link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const link = `${appUrl}/set-password?token=${token}`;
  // Send the email
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@example.com',
    to: user.email,
    subject: 'Welcome! Set up your account',
    html: `<p>Hello${user.name ? ` ${user.name}` : ''},</p>
      <p>Thank you for your order! We've created an account for you. Please set your password to activate your account:</p>
      <p><a href="${link}">${link}</a></p>
      <p>If you did not request this, you can ignore this email.</p>`
  });
}

function errorToString(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const paymentIntentId = searchParams.get('payment_intent');
    const page = searchParams.get('page');
    const sortBy = searchParams.get('sortBy');
    const guestSession = request.headers.get('X-Guest-Session');

    // Parse guest session, handling both JSON and plain email formats
    let parsedGuestSession = null;
    if (guestSession) {
      try {
        parsedGuestSession = JSON.parse(guestSession);
      } catch (e) {
        // If parsing fails, assume it's a plain email
        parsedGuestSession = guestSession;
      }
    }

    console.log('GET /api/orders request:', {
      paymentIntentId,
      page,
      sortBy,
      hasSession: !!session,
      guestSession: parsedGuestSession
    });

    // Handle payment intent case
    if (paymentIntentId) {
      const order = await prisma.order.findFirst({
        where: {
          paymentIntentId: paymentIntentId,
          ...(session?.user?.id
            ? { userId: session.user.id }
            : parsedGuestSession
            ? {
                OR: [
                  { shippingAddress: { email: parsedGuestSession } },
                  { billingAddress: { email: parsedGuestSession } },
                  { customerEmail: parsedGuestSession }
                ]
              }
            : { status: 'PENDING' }) // Allow access to pending orders without session
        },
        include: {
          items: {
            include: {
              product: true,
              variant: true
            }
          },
          address: true,
          billingAddress: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      if (!order) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ orders: [order] });
    }

    // Handle pagination/sorting case
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    // Parse pagination and sorting
    const pageNumber = parseInt(page || '1');
    const pageSize = 10;
    const skip = (pageNumber - 1) * pageSize;

    // Parse sort parameters
    let orderBy: any = { createdAt: 'desc' };
    if (sortBy) {
      const [field, direction] = sortBy.split('_');
      if (field && direction) {
        orderBy = { [field]: direction.toLowerCase() };
      }
    }

    // Build where clause based on user role
    const where = user?.role === 'ADMIN' 
      ? {} 
      : { userId: session.user.id };

    // Fetch orders with pagination and sorting
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        skip,
        take: pageSize,
        where,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          items: {
            include: {
              product: true,
              variant: true
            }
          },
          shippingAddress: true,
          billingAddress: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.order.count({ where })
    ]);

    return NextResponse.json({
      orders,
      pagination: {
        total,
        page: pageNumber,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401, headers: getResponseHeaders() }
      )
    }

    // Only admin can bulk update
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== "ADMIN") {
      return NextResponse.json(
        { message: "Forbidden - Admin access required" },
        { status: 403, headers: getResponseHeaders() }
      )
    }

    const body = await req.json()
    
    // Zod validation for bulk update
    const bulkSchema = z.object({
      orderIds: z.array(z.string().min(1)),
      status: z.enum(['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
    })

    const parsed = bulkSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid bulk update data', errors: parsed.error.flatten() },
        { status: 400, headers: getResponseHeaders() }
      )
    }

    const { orderIds, status } = parsed.data

    const updated = await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status: status as 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' },
    })

    // Log audit
    await logAudit('BULK_UPDATE_ORDER_STATUS', session.user.id, { orderIds, status })

    // Invalidate cache for all users
    if (redis) {
      await redis.del('orders:*')
    }

    return NextResponse.json(
      { updated: updated.count },
      { headers: getResponseHeaders() }
    )
  } catch (error) {
    logError("[ORDERS_PATCH] " + (error instanceof Error ? error.message : String(error)))
    return NextResponse.json(
      { 
        message: "Failed to update orders",
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: getResponseHeaders() }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cartTotal, taxAmount, userId, paymentIntentId, shippingRate, items, shippingAddress, billingAddress } = body;

    // Check if an order with this paymentIntentId already exists
    if (paymentIntentId) {
      const existingOrder = await prisma.order.findFirst({
        where: { paymentIntentId }
      });

      if (existingOrder) {
        return NextResponse.json({ order: existingOrder });
      }
    }

    // Validate input data
    const validatedData = CheckoutSchema.parse({
      items,
      shippingAddress,
      billingAddress,
      shippingRate,
      total: cartTotal
    });

    // Create order with addresses in a single transaction
    const order = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Step 1: Create the order
      const newOrder = await tx.order.create({
        data: {
          status: "PENDING",
          total: cartTotal,
          tax: taxAmount,
          orderNumber: generateOrderNumber(),
          userId,
          paymentIntentId,
          shippingRate,
          customerEmail: shippingAddress.email,
          items: {
            create: items.map((item: { productId: string; quantity: number; price: number; variantId: string | null }) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              variantId: item.variantId,
            })),
          },
          shippingAddress: {
            create: {
              name: shippingAddress.name,
              email: shippingAddress.email,
              phone: shippingAddress.phone,
              street: shippingAddress.street,
              city: shippingAddress.city,
              state: shippingAddress.state,
              postalCode: shippingAddress.postalCode,
              country: shippingAddress.country,
            }
          },
          billingAddress: {
            create: {
              name: billingAddress.name,
              email: billingAddress.email,
              phone: billingAddress.phone,
              street: billingAddress.street,
              city: billingAddress.city,
              state: billingAddress.state,
              postalCode: billingAddress.postalCode,
              country: billingAddress.country,
            }
          }
        },
        include: {
          items: { 
            include: { 
              product: true, 
              variant: true 
            } 
          },
          shippingAddress: true,
          billingAddress: true,
        },
      });

      return newOrder;
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Order creation failed:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 