import { NextResponse } from 'next/server';
import { getStripeEnvStatus } from '@/lib/stripe-server';

export async function GET() {
  const status = getStripeEnvStatus();
  return NextResponse.json({
    stripe: status,
    message: status.isTestMode
      ? 'Stripe is running in TEST mode. Safe for sandbox payments.'
      : 'Stripe is running in LIVE mode. Use caution!'
  });
} 