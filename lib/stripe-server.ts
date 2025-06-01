// NOTE: This file is server-only. Do NOT import in client components.
import Stripe from 'stripe';
import { env } from '@/lib/env';
import { AppError } from './app-errors';
import { logError } from './errors';

// Helper function to get Stripe configuration status
export function getStripeConfig() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    isConfigured: Boolean(
      process.env.STRIPE_SECRET_KEY && 
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    )
  };
}

// Server-side Stripe initialization with retry logic
let stripeInstance: Stripe | null = null;
let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export const getStripeInstance = async (): Promise<Stripe | null> => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeInstance && secretKey) {
    try {
      stripeInstance = new Stripe(secretKey, {
        maxNetworkRetries: 3,
        timeout: 20000, // 20 seconds
        apiVersion: '2023-10-16', // Use latest stable version
      });
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return getStripeInstance();
      }
      throw new AppError('Failed to initialize Stripe after multiple retries. Please check your STRIPE_SECRET_KEY configuration.', 500);
    }
  }
  return stripeInstance;
};

export async function createPaymentIntent(amount: number, currency: string = 'usd') {
  const stripe = await getStripeInstance();
  if (!stripe) {
    throw new AppError('Stripe is not configured. Please check your environment variables.', 500);
  }

  try {
    return await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
    });
  } catch (error: any) {
    logError('Failed to create payment intent', error?.message || 'Unknown error');
    throw new AppError(
      `Failed to create payment intent: ${error?.message || 'Unknown error'}`,
      500,
      'PAYMENT_INTENT_CREATION_FAILED'
    );
  }
}

export async function confirmPayment(paymentIntentId: string) {
  const stripe = await getStripeInstance();
  if (!stripe) {
    throw new AppError('Stripe is not configured. Please check your environment variables.', 500);
  }

  try {
    return await stripe.paymentIntents.confirm(paymentIntentId);
  } catch (error: any) {
    logError('Failed to confirm payment', error?.message || 'Unknown error');
    throw new AppError(
      `Failed to confirm payment: ${error?.message || 'Unknown error'}`,
      500,
      'PAYMENT_CONFIRMATION_FAILED'
    );
  }
}

export async function handleWebhookEvent(payload: string, signature: string) {
  const stripe = await getStripeInstance();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!stripe || !webhookSecret) {
    throw new AppError(
      'Stripe webhook is not configured. Please check your STRIPE_WEBHOOK_SECRET environment variable.',
      500
    );
  }

  try {
    return await stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
  } catch (error: any) {
    logError('Failed to handle webhook event', error?.message || 'Unknown error');
    throw new AppError(
      `Failed to handle webhook event: ${error?.message || 'Unknown error'}`,
      400,
      'WEBHOOK_HANDLING_FAILED'
    );
  }
} 