import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from 'zod'
import { decimalToNumber } from '@/lib/utils'

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
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zipCode: z.string(),
  country: z.string().optional(),
  phone: z.string().optional(),
})

// Define the schema for the order
const orderSchema = z.object({
  id: z.string(),
  total: z.number().positive(),
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  createdAt: z.string().datetime(),
  user: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  items: z.array(orderItemSchema),
  shippingAddress: addressSchema.optional(),
  billingAddress: addressSchema.optional(),
})

// Helper function to convert price to number
function convertPriceToNumber(price: any): number {
  if (typeof price === 'number') return price
  if (typeof price === 'string') return parseFloat(price)
  if (price && typeof price === 'object') {
    if (typeof price.toNumber === 'function') return price.toNumber()
    if (typeof price.toString === 'function') return parseFloat(price.toString())
    if (price.amount) return price.amount
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
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!orderId) {
      return NextResponse.json(
        { message: "Order ID is required" },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
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
    })

    if (!order) {
      return NextResponse.json(
        { message: "Order not found" },
        { status: 404 }
      )
    }

    // Check if user is authorized to view this order
    if (session.user.role !== "ADMIN" && order.userId !== session.user.id) {
      return NextResponse.json(
        { message: "Forbidden: You can only view your own orders" },
        { status: 403 }
      )
    }

    // Convert prices to numbers and prepare response
    const processedOrder = {
      ...order,
      total: convertPriceToNumber(order.total),
      items: order.items.map((item: any) => ({
        ...item,
        price: convertPriceToNumber(item.price),
        product: {
          ...item.product,
          price: convertPriceToNumber(item.product.price),
        },
      })),
      createdAt: order.createdAt.toISOString(),
      orderNumber: order.orderNumber,
    }

    // Validate the order data against the schema
    const validatedOrder = orderSchema.safeParse(processedOrder)

    if (!validatedOrder.success) {
      console.error("Order validation failed:", validatedOrder.error)
      return NextResponse.json(
        { 
          message: "Invalid order data",
          errors: validatedOrder.error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 422 }
      )
    }

    return NextResponse.json(validatedOrder.data)
  } catch (error) {
    console.error("Error fetching order:", error)
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
      { message: "Failed to fetch order" },
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
      status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
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

    const order = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status,
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
    })

    // Convert prices to numbers and prepare response
    const processedOrder = {
      ...order,
      total: convertPriceToNumber(order.total),
      items: order.items.map((item: any) => ({
        ...item,
        price: convertPriceToNumber(item.price),
        product: {
          ...item.product,
          price: convertPriceToNumber(item.product.price),
        },
      })),
      createdAt: order.createdAt.toISOString(),
      orderNumber: order.orderNumber,
    }

    // Validate the updated order data
    const validatedOrder = orderSchema.safeParse(processedOrder)

    if (!validatedOrder.success) {
      console.error("Order validation failed:", validatedOrder.error)
      return NextResponse.json(
        { 
          message: "Invalid order data",
          errors: validatedOrder.error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 422 }
      )
    }

    return NextResponse.json(validatedOrder.data)
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