import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { handleWebhookEvent } from "@/lib/stripe-server"
import { env } from "@/lib/env"
import { prisma } from "@/lib/db"
import { sendAdminEmail } from '@/lib/email'
import Stripe from 'stripe'

// Retry configuration
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second

// Helper function to handle webhook retries
async function handleWebhookWithRetry(
  body: string,
  signature: string,
  retryCount: number = 0
): Promise<any> {
  try {
    return await handleWebhookEvent(body, signature)
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      return handleWebhookWithRetry(body, signature, retryCount + 1)
    }
    throw error
  }
}

// Helper function to update order status by stripeSessionId
async function updateOrderStatusByStripeSession(stripeSessionId: string, status: string) {
  try {
    await prisma.order.update({
      where: { stripeSessionId },
      data: {
        status: status as any,
        updatedAt: new Date(),
      },
    })
  } catch (error) {
    console.error('Failed to update order status:', error)
    throw error
  }
}

// Add user notification email for order cancellation/refund
async function sendOrderCancelledEmail(email: string, orderId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  try {
    await sendAdminEmail(
      'Your order was cancelled and refunded',
      `Dear customer,<br><br>Your order (ID: ${orderId}) was cancelled due to an inventory issue after payment. You will be refunded.<br><br>If you have any questions, please contact support.<br><br>Thank you.<br><a href="${appUrl}/orders/${orderId}">View your order</a>`
    );
  } catch (err) {
    console.error('[WEBHOOK] Failed to send user cancellation email:', err);
  }
}

export async function POST(req: Request) {
  try {
    console.log("[WEBHOOK] Received webhook request")
    const body = await req.text()
    const signature = req.headers.get("stripe-signature")

    if (!signature) {
      console.log("[WEBHOOK] No signature found")
      return NextResponse.json(
        { error: "No signature found" },
        { status: 400 }
      )
    }

    if (!env.STRIPE_WEBHOOK_SECRET) {
      console.log("[WEBHOOK] Webhook secret not configured")
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      )
    }

    const event = await handleWebhookWithRetry(body, signature)

    // Log the event for debugging
    console.log("[WEBHOOK] Event received:", event.type, JSON.stringify(event.data.object, null, 2));
    // Add pre-switch event type log
    console.log("[WEBHOOK] Event type received (pre-switch):", event.type);

    // Add detailed debug logging
    console.log('[WEBHOOK][DEBUG] Event type:', event.type);
    let paymentIntentId = null;
    if (event.type === 'charge.succeeded') {
      paymentIntentId = event.data.object.payment_intent;
      console.log('[WEBHOOK][DEBUG] charge.succeeded PaymentIntent ID:', paymentIntentId);
    } else if (event.type === 'payment_intent.succeeded') {
      paymentIntentId = event.data.object.id;
      console.log('[WEBHOOK][DEBUG] payment_intent.succeeded PaymentIntent ID:', paymentIntentId);
    } else if (event.type === 'checkout.session.completed') {
      paymentIntentId = event.data.object.id;
      console.log('[WEBHOOK][DEBUG] checkout.session.completed Session ID:', paymentIntentId);
    }
    // Log order lookup
    if (paymentIntentId) {
      const order = await prisma.order.findUnique({ where: { stripeSessionId: paymentIntentId } });
      if (order) {
        console.log('[WEBHOOK][DEBUG] Found order:', order.id, 'status:', order.status);
      } else {
        console.log('[WEBHOOK][DEBUG] No order found for stripeSessionId:', paymentIntentId);
      }
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const updateData: any = {
          status: 'PROCESSING',
          customerEmail: session.customer_details?.email,
        };
        console.log('[WEBHOOK] Updating order with:', updateData);
        const order = await prisma.order.update({
          where: { stripeSessionId: session.id },
          data: updateData,
        });
        // Upsert billing address if present
        if (session.customer_details?.address) {
          await prisma.billingAddress.upsert({
            where: { orderId: order.id },
            update: {
              name: session.customer_details.name || '',
              email: session.customer_details.email || '',
              phone: session.customer_details.phone || '',
              address: session.customer_details.address.line1 || '',
              city: session.customer_details.address.city || '',
              state: session.customer_details.address.state || '',
              zipCode: session.customer_details.address.postal_code || '',
              country: session.customer_details.address.country || '',
            },
            create: {
              orderId: order.id,
              name: session.customer_details.name || '',
              email: session.customer_details.email || '',
              phone: session.customer_details.phone || '',
              address: session.customer_details.address.line1 || '',
              city: session.customer_details.address.city || '',
              state: session.customer_details.address.state || '',
              zipCode: session.customer_details.address.postal_code || '',
              country: session.customer_details.address.country || '',
            },
          });
        }
        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const charge = paymentIntent.charges?.data?.[0];
        const updateData: any = {
          status: 'PROCESSING',
        };
        console.log('[WEBHOOK] Updating order with:', updateData);
        const order = await prisma.order.update({
          where: { stripeSessionId: paymentIntent.id },
          data: updateData,
        });
        // Upsert billing address if present
        if (charge?.billing_details?.address) {
          await prisma.billingAddress.upsert({
            where: { orderId: order.id },
            update: {
              name: charge.billing_details.name || '',
              email: charge.billing_details.email || '',
              phone: charge.billing_details.phone || '',
              address: charge.billing_details.address.line1 || '',
              city: charge.billing_details.address.city || '',
              state: charge.billing_details.address.state || '',
              zipCode: charge.billing_details.address.postal_code || '',
              country: charge.billing_details.address.country || '',
            },
            create: {
              orderId: order.id,
              name: charge.billing_details.name || '',
              email: charge.billing_details.email || '',
              phone: charge.billing_details.phone || '',
              address: charge.billing_details.address.line1 || '',
              city: charge.billing_details.address.city || '',
              state: charge.billing_details.address.state || '',
              zipCode: charge.billing_details.address.postal_code || '',
              country: charge.billing_details.address.country || '',
            },
          });
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const failedPayment = event.data.object
        await updateOrderStatusByStripeSession(failedPayment.id, 'CANCELLED')
        break
      }
      case "payment_intent.canceled": {
        const canceledPayment = event.data.object
        await updateOrderStatusByStripeSession(canceledPayment.id, 'CANCELLED')
        break
      }
      case "charge.succeeded": {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;
        console.log('[WEBHOOK] charge.succeeded for paymentIntent:', paymentIntentId);
        const updatedOrders = await prisma.order.updateMany({
          where: { stripeSessionId: paymentIntentId },
          data: {
            status: 'PROCESSING',
            customerEmail: charge.billing_details?.email || null,
          },
        });
        // Upsert billing address for all matching orders
        if (charge.billing_details?.address && updatedOrders.count > 0) {
          const orders = await prisma.order.findMany({ where: { stripeSessionId: paymentIntentId } });
          for (const order of orders) {
            await prisma.billingAddress.upsert({
              where: { orderId: order.id },
              update: {
                name: charge.billing_details.name || '',
                email: charge.billing_details.email || '',
                phone: charge.billing_details.phone || '',
                address: charge.billing_details.address.line1 || '',
                city: charge.billing_details.address.city || '',
                state: charge.billing_details.address.state || '',
                zipCode: charge.billing_details.address.postal_code || '',
                country: charge.billing_details.address.country || '',
              },
              create: {
                orderId: order.id,
                name: charge.billing_details.name || '',
                email: charge.billing_details.email || '',
                phone: charge.billing_details.phone || '',
                address: charge.billing_details.address.line1 || '',
                city: charge.billing_details.address.city || '',
                state: charge.billing_details.address.state || '',
                zipCode: charge.billing_details.address.postal_code || '',
                country: charge.billing_details.address.country || '',
              },
            });
          }
        }
        console.log('[WEBHOOK] Order(s) updated:', updatedOrders.count);
        break;
      }
      default:
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Error processing webhook:", error)
    
    // Log detailed error information
    if (error instanceof Error) {
      console.error({
        name: error.name,
        message: error.message,
        stack: error.stack,
      })
    }

    return NextResponse.json(
      { 
        error: "Webhook handler failed",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 400 }
    )
  }
} 