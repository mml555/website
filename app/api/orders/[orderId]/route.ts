import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from 'zod'
import { OrderStatus } from '@prisma/client'

// Define the schema for order items
const orderItemSchema = z.object({
  id: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
  product: z.object({
    id: z.string(),
    name: z.string(),
    price: z.number().positive(),
    image: z.string().url().optional().nullable(),
  }),
})

// Define the schema for addresses
const addressSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  street: z.string(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string()
})

// Define the schema for the order
const orderSchema = z.object({
  id: z.string(),
  total: z.number().positive(),
  status: z.enum(['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  createdAt: z.string().datetime(),
  user: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
  }).optional(),
  items: z.array(orderItemSchema),
  shippingAddress: addressSchema.optional(),
  billingAddress: addressSchema.optional(),
  orderNumber: z.string().optional(),
})

// Helper function to convert price to number
function convertPriceToNumber(price: any): number {
  if (typeof price === 'number') return Math.max(0, price)
  if (typeof price === 'string') {
    const parsed = parseFloat(price)
    return isNaN(parsed) ? 0 : Math.max(0, parsed)
  }
  if (price && typeof price === 'object') {
    if (typeof price.toNumber === 'function') return Math.max(0, price.toNumber())
    if (typeof price.toString === 'function') {
      const parsed = parseFloat(price.toString())
      return isNaN(parsed) ? 0 : Math.max(0, parsed)
    }
    if (price.amount) return Math.max(0, price.amount)
  }
  return 0
}

/**
 * @param {Request} request
 * @param {{ params: { orderId: string } }} context
 */
export async function GET(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  try {
    if (!orderId) {
      console.error('[OrderAPI] Missing orderId', { orderId })
      return NextResponse.json(
        { message: "Order ID is required" },
        { status: 400 }
      )
    }

    // Fetch the order first
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                images: true,
              },
            },
          },
        },
        shippingAddress: true,
        billingAddress: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isGuest: true,
          },
        },
      },
    }) as any;

    if (!order) {
      console.error('[OrderAPI] Order not found', { orderId })
      return NextResponse.json(
        { message: "Order not found" },
        { status: 404 }
      )
    }

    // Process and validate the order data
    const processedOrder = {
      ...order,
      total: convertPriceToNumber(order.total) || 0,
      status: order.status || 'PENDING',
      createdAt: order.createdAt ? order.createdAt.toISOString() : new Date().toISOString(),
      user: order.user ? {
        name: order.user.name || '',
        email: order.user.email || '',
      } : undefined,
      items: order.items.map((item: any) => ({
        ...item,
        price: convertPriceToNumber(item.price) || 0,
        product: {
          ...item.product,
          price: convertPriceToNumber(item.product.price) || 0,
          image: (item.product.images && item.product.images[0]) || 'https://picsum.photos/400',
        },
      })),
      shippingAddress: order.shippingAddress
        ? {
            ...order.shippingAddress,
            street: order.shippingAddress.street,
            postalCode: order.shippingAddress.postalCode
          }
        : undefined,
      billingAddress: order.billingAddress
        ? {
            ...order.billingAddress,
            street: order.billingAddress.street,
            postalCode: order.billingAddress.postalCode
          }
        : undefined,
      orderNumber: order.orderNumber || '',
      stripeSessionId: order.stripeSessionId || '',
      customerEmail: order.customerEmail || order.user?.email || order.shippingAddress?.email || '',
    }

    // Validate the order data against the schema
    const validatedOrder = orderSchema.safeParse(processedOrder)
    if (!validatedOrder.success) {
      console.error('[OrderAPI] Order validation failed', {
        orderId,
        processedOrder,
        zodError: validatedOrder.error
      })
      return NextResponse.json(
        { 
          message: "Invalid order data",
          errors: validatedOrder.error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          })),
        },
        { status: 422 }
      )
    }

    return NextResponse.json(validatedOrder.data)
  } catch (error) {
    console.error('[OrderAPI] Error fetching order', {
      orderId,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    })
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          message: "Invalid order data",
          errors: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 422 }
      )
    }
    return NextResponse.json(
      { message: "Failed to fetch order", error: error instanceof Error ? error.message : error },
      { status: 500 }
    )
  }
}

/**
 * @param {Request} request
 * @param {{ params: { orderId: string } }} context
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    // Only admins can update order status
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { message: "Forbidden: Admin access required" },
        { status: 403 }
      )
    }

    if (!orderId) {
      return NextResponse.json(
        { message: "Order ID is required" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { status } = z.object({
      status: z.enum(['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
    }).parse(body)

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!existingOrder) {
      return NextResponse.json(
        { message: "Order not found" },
        { status: 404 }
      )
    }

    // Use the enum value for status
    const order = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: OrderStatus[status as keyof typeof OrderStatus],
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                images: true,
              },
            },
          },
        },
        shippingAddress: true,
        billingAddress: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }) as any;

    // Future-proof: fallback for required fields
    const processedOrder = {
      ...order,
      total: convertPriceToNumber(order.total) || 0,
      status: order.status || 'PENDING',
      createdAt: order.createdAt ? order.createdAt.toISOString() : new Date().toISOString(),
      user: order.user ? {
        name: order.user.name || '',
        email: order.user.email || '',
      } : undefined,
      items: order.items.map((item: any) => ({
        ...item,
        price: convertPriceToNumber(item.price) || 0,
        product: {
          ...item.product,
          price: convertPriceToNumber(item.product.price) || 0,
          image: item.product.image || 'https://picsum.photos/400',
        },
      })),
      shippingAddress: order.shippingAddress
        ? {
            ...order.shippingAddress,
            street: order.shippingAddress.street,
            postalCode: order.shippingAddress.postalCode
          }
        : undefined,
      billingAddress: order.billingAddress
        ? {
            ...order.billingAddress,
            street: order.billingAddress.street,
            postalCode: order.billingAddress.postalCode
          }
        : undefined,
      orderNumber: order.orderNumber || '',
    }

    // Validate the updated order data
    const validatedOrder = orderSchema.safeParse(processedOrder)

    if (!validatedOrder.success) {
      console.error("Order validation failed:", validatedOrder.error)
      return NextResponse.json(
        { 
          message: "Invalid order data",
          errors: validatedOrder.error.errors,
          zodError: validatedOrder.error,
        },
        { status: 422 }
      )
    }

    return new Response(JSON.stringify(validatedOrder.data), {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error("Error updating order:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          message: "Invalid order data",
          errors: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 422 }
      )
    }
    return NextResponse.json(
      { message: "Failed to update order" },
      { status: 500 }
    )
  }
} 