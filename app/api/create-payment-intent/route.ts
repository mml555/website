import { NextResponse } from 'next/server'
import { getStripeConfig } from '@/lib/stripe-server'
import Stripe from 'stripe'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const stripeConfig = getStripeConfig()
    
    if (!stripeConfig.isConfigured) {
      return NextResponse.json(
        { error: 'Stripe is not properly configured' },
        { status: 500 }
      )
    }

    if (!stripeConfig.secretKey) {
      return NextResponse.json(
        { error: 'Stripe secret key is missing' },
        { status: 500 }
      )
    }

    const stripe = new Stripe(stripeConfig.secretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    })

    const { items, total } = await req.json()

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'No items provided' },
        { status: 400 }
      )
    }

    if (!total || typeof total !== 'number' || total <= 0) {
      return NextResponse.json(
        { error: 'Invalid total amount' },
        { status: 400 }
      )
    }

    // Validate stock for each item before creating payment intent
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { stock: true, variants: true, name: true }
      });
      if (!product) {
        return NextResponse.json(
          { error: `Sorry, a product in your cart was not found and may have been removed. Please refresh your cart and try again.`, code: 'PRODUCT_NOT_FOUND', productId: item.productId },
          { status: 400 }
        );
      }
      if (item.variantId) {
        const variant = product.variants.find((v: any) => v.id === item.variantId);
        if (!variant || variant.stock < item.quantity) {
          return NextResponse.json(
            { error: `Sorry, there is not enough stock for "${product.name}" (selected variant). Please adjust your cart.`, code: 'OUT_OF_STOCK', productId: item.productId, variantId: item.variantId },
            { status: 400 }
          );
        }
      } else if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Sorry, there is not enough stock for "${product.name}". Please adjust your cart.`, code: 'OUT_OF_STOCK', productId: item.productId },
          { status: 400 }
        );
      }
    }

    // Convert total to cents and ensure it's an integer
    const amountInCents = Math.round(total * 100)

    console.log('Creating payment intent with amount:', {
      originalTotal: total,
      amountInCents,
      items: items.length
    })

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        // Store only essential item information
        items: JSON.stringify(items.map(item => ({
          id: item.id,
          quantity: item.quantity,
          price: item.price
        }))),
      },
    })

    if (!paymentIntent.client_secret) {
      throw new Error('No client secret received from Stripe')
    }

    return NextResponse.json({ clientSecret: paymentIntent.client_secret })
  } catch (error) {
    console.error('Payment intent creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payment intent' },
      { status: 500 }
    )
  }
} 