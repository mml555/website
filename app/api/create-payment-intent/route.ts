import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'
import { generateOrderNumber } from '@/lib/order-utils'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import { createPaymentIntent } from '@/lib/stripe-server'

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
})

// Validation schemas
const addressSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(1, 'Phone is required'),
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
})

const shippingRateSchema = z.object({
  id: z.string(),
  name: z.string(),
  rate: z.number().min(0),
  estimatedDays: z.number().positive(),
  description: z.string().optional(),
})

const requestSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  items: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    price: z.number().positive(),
    quantity: z.number().int().positive(),
    variantId: z.string().optional().nullable(),
  })),
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  shippingRate: shippingRateSchema,
  taxAmount: z.number().min(0),
})

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json()

    // Log request data for debugging
    logger.info('Creating payment intent with data:', {
      hasSession: !!session,
      amount: body.amount,
      itemsCount: body.items?.length,
      hasShippingAddress: !!body.shippingAddress,
      hasBillingAddress: !!body.billingAddress,
      hasShippingRate: !!body.shippingRate,
      taxAmount: body.taxAmount
    })

    // Validate request body
    const validatedData = requestSchema.safeParse(body)
    if (!validatedData.success) {
      logger.error('Validation error:', validatedData.error.errors)
      return NextResponse.json(
        { error: 'Invalid request data', details: validatedData.error.errors },
        { status: 400 }
      )
    }

    const {
      amount,
      items,
      shippingAddress,
      billingAddress,
      shippingRate,
      taxAmount,
    } = validatedData.data

    // Calculate total amount in cents
    const totalAmount = Math.round((amount + taxAmount + (shippingRate?.rate || 0)) * 100)

    // Generate order number
    const orderNumber = generateOrderNumber()

    // Create order first
    const order = await prisma.order.create({
      data: {
        status: "PENDING",
        total: amount,
        tax: taxAmount,
        orderNumber,
        userId: session?.user?.id || null,
        shippingRate: shippingRate?.rate || 0,
        customerEmail: shippingAddress.email,
        items: {
          create: items.map((item) => ({
            productId: item.id,
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

    // Create payment intent with order ID in metadata
    const paymentIntent = await createPaymentIntent(totalAmount / 100, 'usd', {
      orderId: order.id,
      orderNumber,
      items: JSON.stringify(items),
      userId: session?.user?.id || 'guest',
      shippingRate: shippingRate?.rate || 0,
      taxAmount,
    })

    // Update order with payment intent ID
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentIntentId: paymentIntent.id }
    });

    logger.info('Created payment intent:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      orderId: order.id,
      orderNumber,
      totalAmount,
      shippingRate: shippingRate?.rate,
      taxAmount
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderId: order.id,
      orderNumber,
      amount: totalAmount / 100
    })
  } catch (error: any) {
    logger.error('Payment intent creation error:', {
      error: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack
    })
    
    // Handle specific error types
    if (error.type === 'StripeCardError') {
      return NextResponse.json(
        { error: 'Your card was declined. Please try a different card.' },
        { status: 400 }
      )
    } else if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: 'Invalid payment request. Please check your payment details.' },
        { status: 400 }
      )
    } else if (error.type === 'StripeAPIError') {
      return NextResponse.json(
        { error: 'Payment service is temporarily unavailable. Please try again later.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create payment intent' },
      { status: error.statusCode || 500 }
    )
  }
} 