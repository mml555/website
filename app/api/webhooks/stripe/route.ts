import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { handleWebhookEvent } from "@/lib/stripe-server"
import { env } from "@/lib/env"
import { prisma } from "@/lib/db"
import { sendAdminEmail } from '@/lib/email'
import Stripe from 'stripe'
import { logError } from '@/lib/errors'
import type { OrderStatus } from '@prisma/client'

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
        status: status as OrderStatus,
        updatedAt: new Date(),
      },
    })
  } catch (error) {
    logError('Failed to update order status: ' + (error instanceof Error ? error.message : String(error)))
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
    logError('[WEBHOOK] Failed to send user cancellation email: ' + (err instanceof Error ? err.message : String(err)));
  }
}

export async function POST(req: Request) {
  try {
    logError("[WEBHOOK] Received webhook request")
    const body = await req.text()
    const signature = req.headers.get("stripe-signature")

    if (!signature) {
      logError("[WEBHOOK] No signature found")
      return NextResponse.json(
        { error: "No signature found" },
        { status: 400 }
      )
    }

    if (!env.STRIPE_WEBHOOK_SECRET) {
      logError("[WEBHOOK] Webhook secret not configured")
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      )
    }

    const event = await handleWebhookWithRetry(body, signature)

    // Log the event for debugging
    logError('[WEBHOOK] Event received: ' + event.type + ' ' + JSON.stringify(event.data.object, null, 2));
    // Add pre-switch event type log
    logError('[WEBHOOK] Event type received (pre-switch): ' + event.type);

    // Add detailed debug logging
    logError('[WEBHOOK][DEBUG] Event type: ' + event.type);
    let paymentIntentId = null;
    if (event.type === 'charge.succeeded') {
      paymentIntentId = event.data.object.payment_intent;
      logError('[WEBHOOK][DEBUG] charge.succeeded PaymentIntent ID: ' + String(paymentIntentId));
    } else if (event.type === 'payment_intent.succeeded') {
      paymentIntentId = event.data.object.id;
      logError('[WEBHOOK][DEBUG] payment_intent.succeeded PaymentIntent ID: ' + String(paymentIntentId));
    } else if (event.type === 'checkout.session.completed') {
      paymentIntentId = event.data.object.id;
      logError('[WEBHOOK][DEBUG] checkout.session.completed Session ID: ' + String(paymentIntentId));
    }
    // Log order lookup
    if (paymentIntentId) {
      const order = await prisma.order.findUnique({ where: { stripeSessionId: paymentIntentId } });
      if (order) {
        logError('[WEBHOOK][DEBUG] Found order: ' + order.id + ' status: ' + order.status);
      } else {
        logError('[WEBHOOK][DEBUG] No order found for stripeSessionId: ' + String(paymentIntentId));
      }
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const updateData: any = {
          status: 'PAID' as OrderStatus,
          customerEmail: session.customer_details?.email,
        };
        logError('[WEBHOOK] Updating order with: ' + JSON.stringify(updateData));
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
          status: 'PAID' as OrderStatus,
        };
        logError('[WEBHOOK] Updating order with: ' + JSON.stringify(updateData));
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
        logError('[WEBHOOK] charge.succeeded for paymentIntent: ' + String(paymentIntentId));
        const updatedOrders = await prisma.order.updateMany({
          where: { stripeSessionId: paymentIntentId },
          data: {
            status: 'PAID' as OrderStatus,
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
        logError('[WEBHOOK] Order(s) updated: ' + String(updatedOrders.count));
        break;
      }
      default:
        logError('[WEBHOOK] Unhandled event type: ' + event.type)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logError("Error processing webhook: " + (error instanceof Error ? error.message : String(error)))
    // Log detailed error information
    if (error instanceof Error) {
      logError({
        name: error.name,
        message: error.message,
        stack: error.stack,
      })
    }
    return NextResponse.json(
      {
        error: "Webhook handler failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    )
  }
} 