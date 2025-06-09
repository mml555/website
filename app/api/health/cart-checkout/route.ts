import { NextResponse } from 'next/server';
import { getStripeInstance, getStripeConfig } from '@/lib/stripe-server';

type HealthStatus = {
  stripe: boolean;
  stripeConfig: boolean;
  stripePaymentIntent: boolean;
  stripeWebhook: boolean;
  environment: boolean;
  details: {
    hasSecretKey: boolean;
    hasPublishableKey: boolean;
    hasWebhookSecret: boolean;
  };
};

export async function GET() {
  const status: HealthStatus = {
    stripe: false,
    stripeConfig: false,
    stripePaymentIntent: false,
    stripeWebhook: false,
    environment: false,
    details: {
      hasSecretKey: false,
      hasPublishableKey: false,
      hasWebhookSecret: false,
    }
  };

  // Check environment variables first
  try {
    status.details.hasSecretKey = Boolean(process.env.STRIPE_SECRET_KEY);
    status.details.hasPublishableKey = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
    status.details.hasWebhookSecret = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
    
    status.environment = status.details.hasSecretKey && 
                        status.details.hasPublishableKey && 
                        status.details.hasWebhookSecret;
  } catch (err) {
    // Silent fail for environment checks
  }

  // Only proceed with Stripe checks if we have the required environment variables
  if (status.environment) {
    // Check Stripe configuration
    try {
      const stripeConfig = getStripeConfig();
      status.stripeConfig = stripeConfig.isConfigured;
    } catch (err) {
      // Silent fail for config check
    }

    // Check Stripe instance
    try {
      const stripe = await getStripeInstance();
      if (stripe) {
        const products = await stripe.products.list({ limit: 1 });
        status.stripe = products.data.length > 0;
      }
    } catch (err) {
      // Silent fail for instance check
    }

    // Check Stripe Payment Intent creation
    try {
      const stripe = await getStripeInstance();
      if (stripe) {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: 100, // $1.00
          currency: 'usd',
          automatic_payment_methods: {
            enabled: true,
          },
        });
        status.stripePaymentIntent = !!paymentIntent.client_secret;
      }
    } catch (err) {
      // Silent fail for payment intent check
    }

    // Check Stripe Webhook configuration
    try {
      status.stripeWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      // Silent fail for webhook check
    }
  }

  const isHealthy = Object.values(status).every(Boolean);

  return NextResponse.json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: status,
  }, {
    status: isHealthy ? 200 : 500
  });
} 