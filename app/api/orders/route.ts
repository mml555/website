import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"
import { z } from "zod"
import { Redis } from '@upstash/redis'
import { generateOrderNumber } from '@/lib/order-utils'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { getJsonFromRedis } from '@/lib/redis'
import { logError } from '@/lib/errors'
import { Session } from "next-auth"
import { OrderStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

// Initialize Redis client
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

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
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  street: z.string(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string()
})

const CheckoutSchema = z.object({
  items: z.array(ItemSchema).nonempty(),
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema,
  shippingRate: z.object({
    name: z.string(),
    rate: z.number().positive()
  }),
  total: z.number().positive()
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams
    const payment_intent = searchParams.get('payment_intent')
    const email = searchParams.get('email')
    const orderNumber = searchParams.get('orderNumber')
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
      logError(`[Order API][DEBUG] payment_intent: ${payment_intent} order: ${JSON.stringify(order)} user: ${JSON.stringify(order?.user)}`);
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

    if (email || orderNumber) {
      // Only allow admin or guest search
      let session = null
      try {
        session = await getServerSession(authOptions)
      } catch {}
      let where: any = {}
      if (email) {
        where = {
          ...where,
          user: {
            email: email,
          },
        }
      }
      if (orderNumber) {
        where = {
          ...where,
          orderNumber: orderNumber,
        }
      }
      // If not admin, only allow guest orders
      if (!session?.user || session.user.role !== 'ADMIN') {
        where = {
          ...where,
          user: {
            ...where.user,
            isGuest: true,
          },
        }
      }
      const orders = await prisma.order.findMany({
        where,
        include: {
          user: true,
          items: { include: { product: true } },
          shippingAddress: true,
          billingAddress: true,
        },
      })
      return NextResponse.json(orders)
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
    logError('Orders before filtering: ' + JSON.stringify(orders));
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
    logError("Error fetching orders:", error instanceof Error ? error.message : String(error))
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
      data: { status: OrderStatus[status as keyof typeof OrderStatus] },
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
    // Log environment check
    logError('Environment check: ' + JSON.stringify({
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      hasStripeWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      hasPublishableKey: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    }))

    const session = await getServerSession(authOptions)
    let userId = session?.user?.id || null

    // Parse and validate request body
    const body = await request.json()
    console.log('Received request body:', JSON.stringify(body, null, 2));
    
    const parsed = CheckoutSchema.safeParse(body)
    if (!parsed.success) {
      console.error('Validation errors:', JSON.stringify(parsed.error.format(), null, 2));
      logError('Invalid checkout data:', parsed.error.flatten())
      return NextResponse.json(
        { 
          message: 'Invalid checkout data', 
          details: parsed.error.format(),
          issues: parsed.error.issues 
        },
        { status: 400, headers: getResponseHeaders() }
      )
    }
    const { items, shippingAddress, billingAddress, shippingRate, total } = parsed.data
    const sameAsShipping = !billingAddress

    // Generate order number
    const orderNumber = generateOrderNumber()
    logError('[ORDER] Generated order number:', orderNumber)

    // Handle guest user creation
    if (!userId) {
      const email = shippingAddress.email
      let user = await prisma.user.findUnique({ where: { email } })
      if (user) {
        if (!user.isGuest) {
          const guestEmail = `guest.${Date.now()}@example.com`
          user = await prisma.user.create({
            data: {
              email: guestEmail,
              name: shippingAddress.name || "Guest",
              role: "USER",
              isGuest: true,
            },
          })
        }
      } else {
        const guestEmail = `guest.${Date.now()}@example.com`
        user = await prisma.user.create({
          data: {
            email: guestEmail,
            name: shippingAddress.name || "Guest",
            role: "USER",
            isGuest: true,
          },
        })
      }
      userId = user.id
    }

    // Batch fetch all products
    const productIds = items.map(i => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { 
        id: true, 
        stock: true, 
        name: true, 
        price: true,
        variants: {
          select: {
            id: true,
            stock: true,
            price: true
          }
        }
      }
    })

    const productMap = Object.fromEntries(products.map(p => [p.id, p]))

    // Validate stock and calculate total
    let calculatedTotal = 0
    for (const item of items) {
      const product = productMap[item.productId]
      if (!product) {
        return NextResponse.json(
          { message: `Product not found: ${item.productId}`, code: 'PRODUCT_NOT_FOUND' },
          { status: 400, headers: getResponseHeaders() }
        )
      }

      if (item.variantId) {
        const variant = product.variants.find(v => v.id === item.variantId)
        if (!variant) {
          return NextResponse.json(
            { message: `Variant not found: ${item.variantId}`, code: 'VARIANT_NOT_FOUND' },
            { status: 400, headers: getResponseHeaders() }
          )
        }
        if (variant.stock < item.quantity) {
          return NextResponse.json(
            { message: `Insufficient stock for variant: ${item.variantId}`, code: 'OUT_OF_STOCK' },
            { status: 400, headers: getResponseHeaders() }
          )
        }
        calculatedTotal += Number(variant.price || product.price) * item.quantity
      } else {
        if (product.stock < item.quantity) {
          return NextResponse.json(
            { message: `Insufficient stock for product: ${item.productId}`, code: 'OUT_OF_STOCK' },
            { status: 400, headers: getResponseHeaders() }
          )
        }
        calculatedTotal += Number(product.price) * item.quantity
      }
    }

    // Add shipping rate to total
    calculatedTotal += shippingRate.rate

    // Validate total matches
    if (calculatedTotal !== total) {
      logError('Total mismatch:', JSON.stringify({ calculated: calculatedTotal, received: total }))
      return NextResponse.json(
        { message: "Total amount mismatch" },
        { status: 400, headers: getResponseHeaders() }
      )
    }

    // Create the order with the original email
    const order = await prisma.order.create({
      data: {
        orderNumber,
        user: userId ? { connect: { id: userId } } : undefined,
        status: OrderStatus.PENDING,
        items: {
          create: items.map(item => ({
            product: { connect: { id: item.productId } },
            quantity: item.quantity,
            price: new Decimal(item.price),
            ...(item.variantId ? { variant: { connect: { id: item.variantId } } } : {})
          }))
        },
        total: new Decimal(calculatedTotal),
        customerEmail: shippingAddress.email,
        shippingRate: new Decimal(shippingRate.rate),
        shippingAddress: {
          create: {
            name: shippingAddress.name,
            email: shippingAddress.email,
            phone: shippingAddress.phone || '',
            street: shippingAddress.street,
            city: shippingAddress.city,
            state: shippingAddress.state,
            postalCode: shippingAddress.postalCode,
            country: shippingAddress.country,
          }
        },
        ...(billingAddress && !sameAsShipping ? {
          billingAddress: {
            create: {
              name: billingAddress.name,
              email: billingAddress.email,
              phone: billingAddress.phone || '',
              street: billingAddress.street,
              city: billingAddress.city,
              state: billingAddress.state,
              postalCode: billingAddress.postalCode,
              country: billingAddress.country,
            }
          }
        } : {})
      },
    })

    logError('[Order] Created successfully:', JSON.stringify({ id: order.id, number: orderNumber }))

    // Create Stripe PaymentIntent with order ID
    const stripe = getStripe()
    let paymentIntent;
    try {
      logError(`[Stripe] Creating intent: $${calculatedTotal.toFixed(2)} for ${items.length} items`)
      
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(calculatedTotal * 100), // Convert to cents
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          orderId: order.id,
          orderNumber,
          cartSize: items.length.toString(),
          total: calculatedTotal.toFixed(2),
          items: JSON.stringify(items.map(i => ({ id: i.productId, quantity: i.quantity, price: i.price }))),
        },
      })
      logError('[Stripe] Payment intent created:', paymentIntent.id)

      // Update order with payment intent ID
      await prisma.order.update({
        where: { id: order.id },
        data: {
          stripeSessionId: paymentIntent.id,
        }
      })
    } catch (error) {
      logError('[Stripe] Failed to create payment intent:', error)
      // Delete the order if payment intent creation fails
      await prisma.order.delete({
        where: { id: order.id }
      })
      return NextResponse.json(
        { message: 'Failed to create payment intent', error: error instanceof Error ? error.message : String(error) },
        { status: 500, headers: getResponseHeaders() }
      )
    }

    if (!paymentIntent || !paymentIntent.client_secret) {
      logError('[Stripe] Payment intent missing client secret')
      // Delete the order if payment intent is invalid
      await prisma.order.delete({
        where: { id: order.id }
      })
      return NextResponse.json(
        { message: 'Payment intent created but missing client secret' },
        { status: 500, headers: getResponseHeaders() }
      )
    }

    // Return the client secret and order ID
    return NextResponse.json(
      {
        clientSecret: paymentIntent.client_secret,
        orderId: order.id,
        status: 'success'
      },
      { status: 200, headers: getResponseHeaders() }
    )
  } catch (error: any) {
    logError('[Order] Unexpected error:', error)
    return NextResponse.json(
      {
        message: 'An unexpected error occurred',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500, headers: getResponseHeaders() }
    )
  }
} 