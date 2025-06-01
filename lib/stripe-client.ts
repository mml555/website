// NOTE: This file is client-safe. Only uses NEXT_PUBLIC_* env vars. Safe to import in client components.
import { loadStripe, Stripe as StripeClient } from '@stripe/stripe-js';

// Client-side Stripe initialization
let stripePromise: Promise<StripeClient | null> | null = null;

export const getStripe = () => {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Missing Stripe publishable key');
  if (!stripePromise) {
    stripePromise = loadStripe(key);
  }
  return stripePromise;
};

// Helper function to check if Stripe is properly configured
export const isStripeConfigured = () => {
  return Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}; 