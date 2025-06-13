import { NextRequest, NextResponse } from 'next/server';
import { getStripeInstance } from '@/lib/stripe-server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
});

async function findOrderWithRetry(paymentIntentId: string, maxRetries = 3): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    const order = await prisma.order.findFirst({
      where: { paymentIntentId },
      include: {
        items: {
          include: {
            product: true,
            variant: true
          }
        },
        shippingAddress: true,
        billingAddress: true
      }
    });

    if (order) {
      return order;
    }

    // Wait before retrying (exponential backoff)
    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
  }

  return null;
}

async function isWebhookProcessed(eventId: string): Promise<boolean> {
  const processed = await prisma.webhookEvent.findUnique({
    where: { id: eventId }
  });
  return !!processed;
}

async function markWebhookAsProcessed(eventId: string): Promise<void> {
  await prisma.webhookEvent.create({
    data: { id: eventId }
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Missing stripe signature or webhook secret' },
        { status: 400 }
      );
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Log the event type for debugging
    logger.info(`[WEBHOOK] Event type received (pre-switch): ${event.type}`);

    // Check if webhook was already processed
    const processed = await isWebhookProcessed(event.id);
    if (processed) {
      logger.info(`[WEBHOOK] Event already processed: ${event.id}`);
      return NextResponse.json({ received: true });
    }

    switch (event.type) {
      case 'payment_intent.created': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.info(`[WEBHOOK] Processing payment_intent.created: ${paymentIntent.id}`);
        
        // Find order with retry
        const order = await findOrderWithRetry(paymentIntent.id);

        if (!order) {
          logger.error(`Order not found for payment intent after retries: ${paymentIntent.id}`);
          return NextResponse.json(
            { error: 'Order not found after retries' },
            { status: 404 }
          );
        }

        // Update order with payment intent ID if not already set
        if (!order.paymentIntentId) {
          await prisma.order.update({
            where: { id: order.id },
            data: { 
              paymentIntentId: paymentIntent.id,
              updatedAt: new Date()
            }
          });
          logger.info(`Order updated with payment intent ID: ${order.id}`);
        }

        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.info(`[WEBHOOK] Processing payment_intent.succeeded: ${paymentIntent.id}`);
        
        // Find order with retry
        const order = await findOrderWithRetry(paymentIntent.id);

        if (!order) {
          logger.error(`Order not found for payment intent after retries: ${paymentIntent.id}`);
          return NextResponse.json(
            { error: 'Order not found after retries' },
            { status: 404 }
          );
        }

        // Update order status to PROCESSING
        await prisma.order.update({
          where: { id: order.id },
          data: { 
            status: 'PROCESSING',
            paymentIntentId: paymentIntent.id,
            updatedAt: new Date()
          }
        });

        logger.info(`Order status updated to PROCESSING: ${order.id}`);

        // Clear cart for authenticated users
        if (order.userId) {
          await prisma.cartItem.deleteMany({
            where: {
              cart: {
                userId: order.userId
              }
            }
          });
        }

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.info(`[WEBHOOK] Processing payment_intent.payment_failed: ${paymentIntent.id}`);
        
        // Find order with retry
        const order = await findOrderWithRetry(paymentIntent.id);

        if (!order) {
          logger.error('Order not found for failed payment intent after retries', {
            paymentIntentId: paymentIntent.id
          });
          return NextResponse.json(
            { error: 'Order not found after retries' },
            { status: 404 }
          );
        }

        // Update order status to CANCELLED
        await prisma.order.update({
          where: { id: order.id },
          data: { 
            status: 'CANCELLED',
            updatedAt: new Date()
          }
        });

        logger.info('Order status updated to CANCELLED', {
          orderId: order.id,
          paymentIntentId: paymentIntent.id
        });

        break;
      }

      case 'charge.succeeded': {
        const charge = event.data.object as Stripe.Charge;
        logger.info(`[WEBHOOK] Processing charge.succeeded: ${charge.id}`);
        
        if (typeof charge.payment_intent !== 'string') {
          logger.error(`Invalid payment intent ID in charge: ${charge.id}`);
          return NextResponse.json(
            { error: 'Invalid charge data' },
            { status: 400 }
          );
        }
        
        // Find order with retry
        const order = await findOrderWithRetry(charge.payment_intent);

        if (!order) {
          logger.error(`Order not found for charge after retries: ${charge.payment_intent}`);
          return NextResponse.json(
            { error: 'Order not found after retries' },
            { status: 404 }
          );
        }

        // Update order status to PAID
        await prisma.order.update({
          where: { id: order.id },
          data: { 
            status: 'PAID',
            paymentIntentId: charge.payment_intent,
            updatedAt: new Date()
          }
        });

        logger.info(`Order status updated to PAID: ${order.id}`);

        break;
      }

      default:
        logger.info(`[WEBHOOK] Unhandled event type: ${event.type}`);
    }

    // Mark webhook as processed
    await markWebhookAsProcessed(event.id);
    
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(`Error processing webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
} 
