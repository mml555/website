import { NextResponse } from "next/server"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { logError } from '@/lib/errors'
import redis from '@/lib/redis'
import { OrderStatus } from '@prisma/client'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing stripe signature or webhook secret' }, { status: 400 });
  }

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log('[WEBHOOK] Received event:', event.type);

    if (event.type === 'charge.succeeded') {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : undefined;
      console.log('[WEBHOOK] charge.succeeded for paymentIntent:', paymentIntentId);

      if (!paymentIntentId) {
        console.error('[WEBHOOK] No payment intent ID found in charge');
        return NextResponse.json({ error: 'No payment intent ID found' }, { status: 400 });
      }

      // Find the order by stripeSessionId
      const order = await prisma.order.findFirst({
        where: { stripeSessionId: paymentIntentId },
        include: {
          billingAddress: true
        }
      });

      if (!order) {
        console.log('[WEBHOOK] No order found for stripeSessionId:', paymentIntentId);
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }

      // Update the order status and billing address
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          customerEmail: charge.billing_details.email || undefined,
          updatedAt: new Date(),
          billingAddress: {
            upsert: {
              create: {
                name: charge.billing_details.name || '',
                email: charge.billing_details.email || '',
                phone: charge.billing_details.phone || '',
                street: charge.billing_details.address?.line1 || '',
                city: charge.billing_details.address?.city || '',
                state: charge.billing_details.address?.state || '',
                postalCode: charge.billing_details.address?.postal_code || '',
                country: charge.billing_details.address?.country || 'US'
              },
              update: {
                name: charge.billing_details.name || '',
                email: charge.billing_details.email || '',
                phone: charge.billing_details.phone || '',
                street: charge.billing_details.address?.line1 || '',
                city: charge.billing_details.address?.city || '',
                state: charge.billing_details.address?.state || '',
                postalCode: charge.billing_details.address?.postal_code || '',
                country: charge.billing_details.address?.country || 'US'
              }
            }
          }
        },
        include: {
          billingAddress: true
        }
      });

      console.log('[WEBHOOK] Order updated successfully:', {
        orderId: updatedOrder.id,
        status: updatedOrder.status,
        paymentIntentId,
        hasBillingAddress: !!updatedOrder.billingAddress
      });

      return NextResponse.json({ 
        success: true,
        orderId: updatedOrder.id,
        status: updatedOrder.status
      });
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('[WEBHOOK][DEBUG] Processing payment_intent.succeeded:', paymentIntent.id);

      try {
        // Try to find the order using multiple methods
        let order = null;
        
        // First try by stripeSessionId
        order = await prisma.order.findFirst({
          where: { stripeSessionId: paymentIntent.id }
        });
        
        // If not found, try by orderNumber from metadata
        if (!order && paymentIntent.metadata?.orderNumber) {
          order = await prisma.order.findFirst({
            where: { orderNumber: paymentIntent.metadata.orderNumber }
          });
        }

        // If still not found, try by orderId from metadata
        if (!order && paymentIntent.metadata?.orderId) {
          order = await prisma.order.findFirst({
            where: { id: paymentIntent.metadata.orderId }
          });
        }

        if (!order) {
          console.log('[WEBHOOK] No order found for payment intent:', {
            paymentIntentId: paymentIntent.id,
            metadata: paymentIntent.metadata
          });
          return NextResponse.json({ 
            error: 'Order not found',
            details: 'Unable to match payment with an existing order'
          }, { status: 404 });
        }

        // Update the order status
        const updatedOrder = await prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.PAID,
            customerEmail: paymentIntent.receipt_email || undefined,
            stripeSessionId: paymentIntent.id,
            updatedAt: new Date()
          }
        });

        console.log('[WEBHOOK] Order updated successfully:', {
          orderId: updatedOrder.id,
          status: updatedOrder.status,
          paymentIntentId: paymentIntent.id
        });

        return NextResponse.json({ 
          success: true,
          orderId: updatedOrder.id,
          status: updatedOrder.status
        });
      } catch (error) {
        console.error('[WEBHOOK] Error processing payment_intent.succeeded:', error);
        return NextResponse.json({ 
          error: 'Failed to process payment intent',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook error' },
      { status: 400 }
    );
  }
} 