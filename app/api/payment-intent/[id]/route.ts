import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

// Initialize Stripe with proper error handling
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Helper function to validate guest session
function validateGuestSession(guestSession: string | null): { email: string | null; error?: string } {
  if (!guestSession) {
    return { email: null };
  }

  try {
    const parsed = JSON.parse(guestSession);
    const email = parsed?.email;
    
    if (!email || typeof email !== 'string') {
      return { email: null, error: 'Invalid guest session format' };
    }
    
    return { email };
  } catch (error) {
    console.error('Failed to parse guest session:', error);
    return { email: null, error: 'Invalid guest session' };
  }
}

// Helper function to check order authorization
async function isAuthorizedToViewOrder(
  orderId: string,
  userId: string | undefined,
  guestEmail: string | null
): Promise<{ authorized: boolean; order: any | null; error?: string }> {
  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId },
      include: {
        billingAddress: true,
      },
    });

    if (!order) {
      return { authorized: false, order: null, error: 'Unauthorized' };
    }

    // Authenticated user check
    if (userId) {
      if (order.userId !== userId) {
        return { authorized: false, order: null, error: 'Unauthorized' };
      }
      return { authorized: true, order };
    }

    // Guest user check
    if (guestEmail) {
      if (order.billingAddress?.email !== guestEmail) {
        return { authorized: false, order: null, error: 'Unauthorized' };
      }
      return { authorized: true, order };
    }

    // For guest users without a session, only allow access to pending orders
    if (order.status === 'PENDING') {
      return { authorized: true, order };
    }

    return { authorized: false, order: null, error: 'Unauthorized' };
  } catch (error) {
    console.error('Error checking order authorization:', error);
    return { authorized: false, order: null, error: 'Internal server error' };
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const guestSession = request.headers.get('X-Guest-Session');
    
    // Validate guest session
    const { email: guestEmail, error: guestError } = validateGuestSession(guestSession);
    if (guestError) {
      return NextResponse.json({ error: guestError }, { status: 400 });
    }

    // Get the payment intent from Stripe
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(params.id);
    } catch (error) {
      console.error('Error retrieving payment intent from Stripe:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve payment intent' },
        { status: 500 }
      );
    }

    // Check authorization and get order
    const { authorized, order, error: authError } = await isAuthorizedToViewOrder(
      params.id,
      session?.user?.id,
      guestEmail
    );

    if (!authorized || !order) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Log successful access (sanitized)
    console.info('Payment intent accessed:', {
      orderId: order.id,
      status: paymentIntent.status,
      userId: session?.user?.id || 'guest',
      timestamp: new Date().toISOString()
    });

    // Return minimal required data
    return NextResponse.json({
      id: paymentIntent.id,
      status: paymentIntent.status,
      // Only include email for pending orders
      ...(order.status === 'PENDING' && { email: order.billingAddress?.email })
    });
  } catch (error) {
    console.error('Error in payment intent retrieval:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 