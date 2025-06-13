"use client"

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'
import CheckoutForm from '@/components/checkout-form'
import { useSession } from 'next-auth/react'
import { safeSessionStorage } from '@/lib/session-storage'
import { Session } from 'next-auth'
import { Appearance, StripeElementsOptions } from '@stripe/stripe-js'
import { BillingAddress } from '@/types/address'
import { useCheckout } from '../../../hooks/useCheckout'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber } from '@/lib/order-utils'

// Define shipping rate interface
interface ShippingRate {
  id: string;
  name: string;
  rate: number;
  description?: string;
  estimatedDays: number;
}

interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  stock?: number;
  stockAtAdd?: number;
  metadata?: Record<string, any>;
  weight?: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItemInput, quantity?: number) => Promise<void>;
  removeItem: (id: string, variantId?: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number, variantId?: string) => Promise<void>;
  clearCart: () => void;
  total: number;
  itemCount: number;
  error: string | null;
  clearError: () => void;
  isLoading: boolean;
  retrySync: () => Promise<void>;
  pendingChanges: CartItem[];
  cartExpiryWarning: string | null;
  generateShareableCartLink: () => Promise<string | null>;
  loadSharedCart: (shareId: string) => Promise<boolean>;
  savedForLater: CartItem[];
  moveToSaveForLater: (id: string, variantId?: string) => void;
  moveToCartFromSaveForLater: (id: string, variantId?: string) => void;
}

interface CartItemInput {
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  image: string;
  stock?: number;
}

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, {
  stripeAccount: process.env.NEXT_PUBLIC_STRIPE_ACCOUNT_ID,
});

const appearance: Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#0F172A',
    colorBackground: '#ffffff',
    colorText: '#0F172A',
    colorDanger: '#ef4444',
    fontFamily: 'system-ui, sans-serif',
    spacingUnit: '4px',
    borderRadius: '4px',
  },
}

// Payment Form Component
const PaymentForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { items } = useCart();
  const { shippingAddress, billingAddress, shippingRate, taxAmount, total } = useCheckout();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      setError('Payment system not ready');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Validate required data
      if (!items?.length) {
        throw new Error('No items in cart');
      }

      if (!shippingAddress) {
        throw new Error('Shipping address is required');
      }

      if (!billingAddress) {
        throw new Error('Billing address is required');
      }

      if (!shippingRate) {
        throw new Error('Shipping rate is required');
      }

      if (!total || total <= 0) {
        throw new Error('Invalid total amount');
      }

      // Ensure all required fields are present
      const paymentData = {
        amount: total,
        items: items.map(item => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          variantId: item.variantId || null
        })),
        shippingAddress: {
          name: shippingAddress.name,
          email: shippingAddress.email,
          phone: shippingAddress.phone || '',
          street: shippingAddress.street,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country
        },
        billingAddress: {
          name: billingAddress.name,
          email: billingAddress.email,
          phone: billingAddress.phone || shippingAddress.phone || '',
          street: billingAddress.street,
          city: billingAddress.city,
          state: billingAddress.state,
          postalCode: billingAddress.postalCode,
          country: billingAddress.country
        },
        shippingRate: {
          id: shippingRate.id || 'free',
          name: shippingRate.name || 'Free Shipping',
          rate: shippingRate.rate || 0,
          description: shippingRate.description || 'Standard shipping',
          estimatedDays: shippingRate.estimatedDays || 7
        },
        taxAmount: taxAmount || 0
      };

      // Log payment data for debugging
      console.log('Payment data validation:', {
        hasItems: items.length > 0,
        itemsCount: items.length,
        total,
        hasShippingAddress: !!shippingAddress,
        hasBillingAddress: !!billingAddress,
        hasShippingRate: !!shippingRate,
        shippingRateDetails: shippingRate,
        taxAmount,
        fullPaymentData: paymentData
      });

      // Create payment intent
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Payment intent creation failed:', {
          status: response.status,
          error: errorData,
          requestData: paymentData
        });
        throw new Error(errorData.error || 'Failed to create payment intent');
      }

      const data = await response.json();

      // Confirm the payment
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order-confirmation/${data.orderId}`,
          payment_method_data: {
            billing_details: {
              name: billingAddress.name,
              email: billingAddress.email,
              phone: billingAddress.phone || shippingAddress.phone || '',
              address: {
                line1: billingAddress.street,
                city: billingAddress.city,
                state: billingAddress.state,
                postal_code: billingAddress.postalCode,
                country: billingAddress.country,
              },
            },
          },
        },
      });

      if (confirmError) {
        throw confirmError;
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Pay $${total.toFixed(2)}`
        )}
      </Button>
    </form>
  );
};

// Main Payment Page Component
export default function PaymentPage() {
  const router = useRouter()
  const { items, isLoading: cartLoading, clearCart } = useCart()
  const { data: session } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [shippingAddress, setShippingAddress] = useState<BillingAddress | null>(null)
  const [billingAddress, setBillingAddress] = useState<BillingAddress | null>(null)
  const [shippingRate, setShippingRate] = useState<ShippingRate | null>(null)
  const [taxAmount, setTaxAmount] = useState<number>(0)
  const [calculatedTotal, setCalculatedTotal] = useState<number>(0)
  const [paying, setPaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creatingPaymentIntent, setCreatingPaymentIntent] = useState(false)
  const [paymentIntentCreated, setPaymentIntentCreated] = useState(false)
  const [total, setTotal] = useState(0)
  const failedRef = useRef(false)
  const [stripe, setStripe] = useState<any>(null)
  const [elements, setElements] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isStripeLoading, setIsStripeLoading] = useState(true)

  // Load stored data from session storage
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const storedShippingAddress = safeSessionStorage.get('checkout.shippingAddress');
        const storedBillingAddress = safeSessionStorage.get('checkout.billingAddress');
        const storedShippingRate = safeSessionStorage.get('checkout.shippingRate');
        const storedTaxAmount = safeSessionStorage.get('checkout.taxAmount');
        const storedTotal = safeSessionStorage.get('checkout.calculatedTotal');

        if (!storedShippingAddress || !storedBillingAddress || !storedShippingRate) {
          console.error('Missing required checkout data:', {
            hasShippingAddress: !!storedShippingAddress,
            hasBillingAddress: !!storedBillingAddress,
            hasShippingRate: !!storedShippingRate,
            hasTaxAmount: !!storedTaxAmount,
            hasTotal: !!storedTotal
          });
          router.push('/checkout/shipping');
          return;
        }

        setShippingAddress(storedShippingAddress);
        setBillingAddress(storedBillingAddress);
        setShippingRate(storedShippingRate);
        setTaxAmount(storedTaxAmount || 0);
        setTotal(storedTotal || 0);
        setLoading(false);
      } catch (err) {
        console.error('Error loading stored data:', err);
        setError('Failed to load checkout data. Please try again.');
        setLoading(false);
      }
    };

    loadStoredData();
  }, [router]);

  // Initialize Stripe
  useEffect(() => {
    const initializeStripe = async () => {
      try {
        if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
          throw new Error('Stripe publishable key is not configured');
        }

        const stripeInstance = await stripePromise;
        if (!stripeInstance) {
          throw new Error('Failed to initialize Stripe');
        }

        setStripe(stripeInstance);
        setIsStripeLoading(false);
      } catch (err) {
        console.error('Error initializing Stripe:', err);
        setError('Failed to initialize payment system. Please try again.');
        setIsStripeLoading(false);
      }
    };

    initializeStripe();
  }, []);

  // Initialize payment
  useEffect(() => {
    const initializePayment = async () => {
      if (loading || isStripeLoading || !stripe || !total || total <= 0) {
        return;
      }

      try {
        setCreatingPaymentIntent(true);
        setError(null);

        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: total,
            items: items.map(item => ({
              id: item.id,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              variantId: item.variantId || null
            })),
            shippingAddress,
            billingAddress,
            shippingRate,
            taxAmount
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create payment intent');
        }

        const data = await response.json();
        setClientSecret(data.clientSecret);
        setOrderId(data.orderId);
        setPaymentIntentCreated(true);
      } catch (err) {
        console.error('Payment initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize payment');
        failedRef.current = true;
      } finally {
        setCreatingPaymentIntent(false);
      }
    };

    initializePayment();
  }, [loading, isStripeLoading, stripe, total, items, shippingAddress, billingAddress, shippingRate, taxAmount]);

  if (loading || isStripeLoading || creatingPaymentIntent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          onClick={() => router.push('/checkout/shipping')}
          className="mt-4"
        >
          Return to Shipping
        </Button>
      </div>
    );
  }

  if (!clientSecret || !stripe) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Payment System Not Ready</AlertTitle>
          <AlertDescription>
            Please wait while we initialize the payment system...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Elements stripe={stripe} options={options}>
            <PaymentForm />
          </Elements>
        </CardContent>
      </Card>
    </div>
  );
} 