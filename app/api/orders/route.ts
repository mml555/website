import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import Stripe from "stripe"
import { z } from "zod"
import { Redis } from '@upstash/redis'
import { generateOrderNumber } from '@/lib/order-utils'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import redis, { getJsonFromRedis } from '@/lib/redis'

// Initialize Redis client
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

// Cache TTL in seconds
const CACHE_TTL = 300 // 5 minutes

// Initialize Stripe with proper error handling
let stripe: Stripe | null = null;
try {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Stripe secret key is missing');
  } else {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      maxNetworkRetries: 3,
      timeout: 20000, // 20 seconds
    });
    console.log('Stripe initialized successfully');
  }
} catch (error) {
  console.error('Failed to initialize Stripe:', error);
}

// --- Zod Schemas ---
const querySchema = z.object({
  page: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  status: z.string().optional(),
})

// --- Type Definitions ---
interface Order {
  id: string
  userId: string
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  total: number
  createdAt: Date
  updatedAt: Date
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
  }>
  shippingAddress: {
    id: string
    name: string
    email: string
    address: string
    city: string
    state: string
    zipCode: string
    country: string
  } | null
  billingAddress: {
    id: string
    name: string
    email: string
    address: string
    city: string
    state: string
    zipCode: string
    country: string
  } | null
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
    console.error('Audit log error:', err)
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams
    const payment_intent = searchParams.get('payment_intent')
    if (payment_intent) {
      // Try to fetch the order by stripeSessionId
      const order = await prisma.order.findFirst({
        where: { stripeSessionId: payment_intent },
        include: {
          user: true,
          items: {
            include: {
              product: true,
            },
          },
          shippingAddress: true,
          billingAddress: true,
        },
      })
      console.log('[Order API][DEBUG] payment_intent:', payment_intent, 'order:', order, 'user:', order?.user);
      if (!order) {
        return NextResponse.json(
          { message: 'Order not found' },
          { status: 404, headers: getResponseHeaders() }
        )
      }
      // If order is a guest order (user.isGuest === true), allow access
      if (order.user && order.user.isGuest === true) {
        // Convert prices to numbers for consistency
        const processedOrder = {
          ...order,
          total: typeof order.total === 'object' && order.total !== null && typeof order.total.toNumber === 'function' ? order.total.toNumber() : order.total,
          items: order.items.map((item: any) => ({
            ...item,
            price: typeof item.price === 'object' && item.price !== null && typeof item.price.toNumber === 'function' ? item.price.toNumber() : item.price,
            product: {
              ...item.product,
              price: typeof item.product.price === 'object' && item.product.price !== null && typeof item.product.price.toNumber === 'function' ? item.product.price.toNumber() : item.product.price,
            },
          })),
          createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
          orderNumber: order.orderNumber,
        }
        return NextResponse.json(processedOrder, { headers: getResponseHeaders() })
      }
      // If order is for a registered user, require authentication
      const session = await getServerSession(authOptions)
      if (!session?.user?.id || order.userId !== session.user.id) {
        return NextResponse.json(
          { message: 'Unauthorized' },
          { status: 401, headers: getResponseHeaders() }
        )
      }
      // User is authenticated and owns the order
      const processedOrder = {
        ...order,
        total: typeof order.total === 'object' && order.total !== null && typeof order.total.toNumber === 'function' ? order.total.toNumber() : order.total,
        items: order.items.map((item: any) => ({
          ...item,
          price: typeof item.price === 'object' && item.price !== null && typeof item.price.toNumber === 'function' ? item.price.toNumber() : item.price,
          product: {
            ...item.product,
            price: typeof item.product.price === 'object' && item.product.price !== null && typeof item.product.price.toNumber === 'function' ? item.product.price.toNumber() : item.product.price,
          },
        })),
        createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
        orderNumber: order.orderNumber,
      }
      return NextResponse.json(processedOrder, { headers: getResponseHeaders() })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401, headers: getResponseHeaders() }
      )
    }

    const query = Object.fromEntries(searchParams.entries())
    const parsed = querySchema.safeParse(query)
    
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid query parameters', errors: parsed.error.flatten() },
        { status: 400, headers: getResponseHeaders() }
      )
    }

    const {
      page = '1',
      search = '',
      sortBy = 'createdAt_desc',
      status,
    } = parsed.data

    const pageNum = parseInt(page)
    const pageSize = 20

    if (pageNum < 1) {
      return NextResponse.json(
        { message: 'Page number must be greater than 0' },
        { status: 400, headers: getResponseHeaders() }
      )
    }

    // Check cache
    const cacheKey = generateCacheKey(parsed.data, session.user.id)
    const cachedData = await getJsonFromRedis<any>(cacheKey)
    if (cachedData) {
      return NextResponse.json(cachedData, { headers: getResponseHeaders() })
    }

    // Build where clause
    let where: any = {};
    if (session.user.role !== "ADMIN") {
      where.userId = session.user.id;
    }
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status) {
      where.status = status;
    }

    // Build order by clause
    const orderBy: any = {
      createdAt_asc: { createdAt: 'asc' },
      total_desc: { total: 'desc' },
      total_asc: { total: 'asc' },
      createdAt_desc: { createdAt: 'desc' },
    }[sortBy] || { createdAt: 'desc' }

    // Get total count and orders in parallel
    const [totalItems, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy,
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        include: {
          user: true,
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                },
              },
            },
          },
          shippingAddress: true,
          billingAddress: true,
        },
      }),
    ])

    // Log orders before filtering
    console.log('Orders before filtering:', orders);
    // Filter out orders with missing users
    const filteredOrders = orders.filter((order: any) => order.user);

    const totalPages = Math.ceil(totalItems / pageSize)
    
    if (pageNum > totalPages && totalPages > 0) {
      return NextResponse.json(
        { message: 'Page number exceeds total pages' },
        { status: 400, headers: getResponseHeaders() }
      )
    }

    const response = {
      orders: filteredOrders,
      totalPages,
      currentPage: pageNum,
      totalItems,
    }

    // Cache the response
    await redisClient.set(cacheKey, JSON.stringify(response), { ex: CACHE_TTL })

    return NextResponse.json(response, { headers: getResponseHeaders() })
  } catch (error) {
    console.error("Error fetching orders:", error)
    return NextResponse.json(
      { 
        message: "Failed to fetch orders",
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: getResponseHeaders() }
    )
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
      status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
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
      data: { status },
    })

    // Log audit
    await logAudit('BULK_UPDATE_ORDER_STATUS', session.user.id, { orderIds, status })

    // Invalidate cache for all users
    await redisClient.del('orders:*')

    return NextResponse.json(
      { updated: updated.count },
      { headers: getResponseHeaders() }
    )
  } catch (error) {
    console.error("[ORDERS_PATCH]", error)
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
    // Log environment variables (without sensitive values)
    console.log('Environment check:', {
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      hasStripeWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      hasPublishableKey: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    });

    const session = await getServerSession(authOptions);
    let userId = session?.user?.id || null;
    const data = await request.json();
    console.log('Creating order with data:', {
      userId,
      isGuest: !userId,
      total: data.total,
      itemCount: data.items?.length || 0,
      hasShippingAddress: !!data.shippingAddress,
      hasBillingAddress: !!data.billingAddress,
      items: data.items,
      shippingAddress: data.shippingAddress,
      billingAddress: data.billingAddress,
    });

    // If not logged in, require email and auto-create user if needed
    if (!userId) {
      const email = data.shippingAddress?.email || data.billingAddress?.email;
      if (!email) {
        return NextResponse.json(
          { message: "Email is required for guest checkout" },
          { status: 400, headers: getResponseHeaders() }
        );
      }
      let user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        // If user exists and is not a guest, require login
        if (!user.isGuest) {
          return NextResponse.json(
            { message: "An account with this email already exists. Please log in to continue your order.", code: 'ACCOUNT_EXISTS' },
            { status: 409, headers: getResponseHeaders() }
          );
        }
        // If user is a guest, proceed
      } else {
        user = await prisma.user.create({
          data: {
            email,
            name: data.shippingAddress?.name || "Guest",
            role: "USER",
            isGuest: true,
            // Optionally: generate a random password or leave null
          },
        });
        // Send welcome email with password setup link
        await sendWelcomeEmail({
          email,
          name: data.shippingAddress?.name || undefined,
          id: user.id
        });
      }
      userId = user.id;
    }

    // Validate total amount
    if (!data.total || data.total <= 0) {
      console.error('Invalid total amount:', data.total);
      return NextResponse.json(
        { message: "Invalid total amount" },
        { status: 400, headers: getResponseHeaders() }
      );
    }

    // Validate items
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      console.error('Invalid items:', data.items);
      return NextResponse.json(
        { message: "Invalid items" },
        { status: 400, headers: getResponseHeaders() }
      );
    }

    // Validate shipping address
    if (!data.shippingAddress) {
      console.error('Missing shipping address');
      return NextResponse.json(
        { message: "Shipping address is required" },
        { status: 400, headers: getResponseHeaders() }
      );
    }

    // Validate stock for each item
    for (const item of data.items) {
      // Check product stock
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { stock: true, variants: true, name: true }
      });
      if (!product) {
        return NextResponse.json(
          { message: `Sorry, a product in your cart was not found and may have been removed. Please refresh your cart and try again.`, code: 'PRODUCT_NOT_FOUND', productId: item.productId },
          { status: 400, headers: getResponseHeaders() }
        );
      }
      if (item.variantId) {
        // Check variant stock
        const variant = product.variants.find((v: any) => v.id === item.variantId);
        if (!variant || variant.stock < item.quantity) {
          return NextResponse.json(
            { message: `Sorry, there is not enough stock for "${product.name}" (selected variant). Please adjust your cart.`, code: 'OUT_OF_STOCK', productId: item.productId, variantId: item.variantId },
            { status: 400, headers: getResponseHeaders() }
          );
        }
      } else if (product.stock < item.quantity) {
        return NextResponse.json(
          { message: `Sorry, there is not enough stock for "${product.name}". Please adjust your cart.`, code: 'OUT_OF_STOCK', productId: item.productId },
          { status: 400, headers: getResponseHeaders() }
        );
      }
    }

    // Create Stripe PaymentIntent FIRST
    let paymentIntent;
    try {
      const amount = Math.round(data.total * 100); // Convert to cents
      console.log('Creating payment intent with amount:', {
        originalTotal: data.total,
        amountInCents: amount,
        items: data.items.length
      });

      if (!stripe) {
        console.error('Stripe is not initialized');
        return NextResponse.json(
          { message: "Stripe is not initialized" },
          { status: 500, headers: getResponseHeaders() }
        );
      }

      paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        metadata: {
          // You can add orderNumber or other info here if needed
        },
        automatic_payment_methods: {
          enabled: true,
        },
        receipt_email: data.shippingAddress?.email || data.billingAddress?.email,
      });

      console.log('Payment intent created successfully:', paymentIntent.id);
    } catch (stripeError: any) {
      console.error('Failed to create payment intent:', {
        error: stripeError.message,
        code: stripeError.code,
        type: stripeError.type,
      });
      return NextResponse.json(
        {
          message: "Failed to create payment intent",
          error: stripeError.message
        },
        { status: 500, headers: getResponseHeaders() }
      );
    }

    // Create order in database, using paymentIntent.id as stripeSessionId
    let order = null;
    try {
      const orderNumber = generateOrderNumber();
      order = await prisma.order.create({
        data: {
          orderNumber,
          userId,
          status: "PENDING",
          total: data.total,
          customerEmail: data.shippingAddress?.email || data.billingAddress?.email,
          stripeSessionId: paymentIntent.id,
          items: {
            create: data.items.map((item: any) => {
              if (!item.productId) {
                throw new Error('Order item missing productId');
              }
              return {
                productId: item.productId,
                variantId: item.variantId || undefined,
                quantity: item.quantity,
                price: item.price,
              };
            }),
          },
          shippingAddress: {
            create: {
              street: data.shippingAddress.address,
              city: data.shippingAddress.city,
              state: data.shippingAddress.state,
              postalCode: data.shippingAddress.zipCode,
              country: data.shippingAddress.country,
            },
          },
          ...(data.billingAddress && {
            billingAddress: {
              create: {
                name: data.billingAddress.name || data.shippingAddress.name,
                email: data.billingAddress.email || data.shippingAddress.email,
                phone: data.billingAddress.phone || data.shippingAddress.phone,
                address: data.billingAddress.address,
                city: data.billingAddress.city,
                state: data.billingAddress.state,
                zipCode: data.billingAddress.zipCode,
                country: data.billingAddress.country || "United States",
              },
            },
          }),
        },
        include: {
          items: true,
          shippingAddress: true,
          billingAddress: true,
        },
      });
      console.log('Order created successfully:', order.id, order.orderNumber);
    } catch (orderError) {
      console.error('Order creation failed:', orderError);
      // Optionally: cancel the PaymentIntent if order creation fails
      if (paymentIntent?.id) {
        try {
          await stripe.paymentIntents.cancel(paymentIntent.id);
        } catch (cancelError) {
          console.error('Failed to cancel payment intent after order creation error:', cancelError);
        }
      }
      return NextResponse.json(
        { message: "Failed to create order", error: orderError instanceof Error ? orderError.message : orderError },
        { status: 500, headers: getResponseHeaders() }
      );
    }

    return NextResponse.json({
      id: order.id,
      orderNumber: order.orderNumber,
      clientSecret: paymentIntent.client_secret,
    }, { headers: getResponseHeaders() });
  } catch (err) {
    console.error('Order creation error:', err);
    return new Response(JSON.stringify({ error: 'Failed to create order', details: err instanceof Error ? err.message : err }), { status: 500 });
  }
} 