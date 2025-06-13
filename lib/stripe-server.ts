// NOTE: This file is server-only. Do NOT import in client components.
import Stripe from 'stripe';
import { AppError } from './app-errors';
import { logError } from './errors';
import { logger } from './logger';

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

export async function createPaymentIntent(amount: number, currency: string = 'usd', metadata?: Record<string, any>) {
  const stripe = await getStripeInstance();
  if (!stripe) {
    throw new AppError('Stripe is not configured. Please check your environment variables.', 500);
  }

  if (!amount || amount <= 0) {
    throw new AppError('Invalid amount for payment intent', 400);
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata,
      capture_method: 'automatic',
      confirm: false,
      setup_future_usage: 'off_session',
    });

    return paymentIntent;
  } catch (error: any) {
    logError('Failed to create payment intent', error?.message || 'Unknown error');
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      throw new AppError(
        'Your card was declined. Please try a different card.',
        400,
        'CARD_DECLINED'
      );
    } else if (error.type === 'StripeInvalidRequestError') {
      throw new AppError(
        'Invalid payment request. Please check your payment details.',
        400,
        'INVALID_REQUEST'
      );
    } else if (error.type === 'StripeAPIError') {
      throw new AppError(
        'Payment service is temporarily unavailable. Please try again later.',
        503,
        'SERVICE_UNAVAILABLE'
      );
    }

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

  if (!paymentIntentId) {
    throw new AppError('Payment intent ID is required', 400);
  }

  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
    
    if (paymentIntent.status === 'requires_action') {
      return {
        requiresAction: true,
        paymentIntent,
      };
    }

    return {
      requiresAction: false,
      paymentIntent,
    };
  } catch (error: any) {
    logError('Failed to confirm payment', error?.message || 'Unknown error');
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      throw new AppError(
        'Your card was declined. Please try a different card.',
        400,
        'CARD_DECLINED'
      );
    } else if (error.type === 'StripeInvalidRequestError') {
      throw new AppError(
        'Invalid payment request. Please check your payment details.',
        400,
        'INVALID_REQUEST'
      );
    }

    throw new AppError(
      `Failed to confirm payment: ${error?.message || 'Unknown error'}`,
      500,
      'PAYMENT_CONFIRMATION_FAILED'
    );
  }
}

export async function handleWebhookEvent(
  body: string,
  signature: string,
  webhookSecret: string
): Promise<Stripe.Event | null> {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
      typescript: true,
    });

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    return event;
  } catch (err) {
    logger.error('Error verifying webhook signature:', {
      error: err instanceof Error ? err.message : 'Unknown error'
    });
    return null;
  }
}

// Helper to check if Stripe is in test mode
export function isStripeTestMode() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  // Stripe test keys start with 'sk_test_'
  return key.startsWith('sk_test_');
}

// Helper to get Stripe environment status
export function getStripeEnvStatus() {
  return {
    isConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    isTestMode: isStripeTestMode(),
    secretKeyPresent: Boolean(process.env.STRIPE_SECRET_KEY),
    publishableKeyPresent: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    webhookSecretPresent: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    secretKey: process.env.STRIPE_SECRET_KEY ? (process.env.STRIPE_SECRET_KEY.startsWith('sk_') ? process.env.STRIPE_SECRET_KEY.slice(0, 8) + '...' : 'invalid') : 'missing',
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith('pk_') ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.slice(0, 8) + '...' : 'invalid') : 'missing',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ? process.env.STRIPE_WEBHOOK_SECRET.slice(0, 8) + '...' : 'missing',
  };
}

// TODO: Prevent double payment submissions in UI and API
// TODO: Add more robust error handling for payment failures 