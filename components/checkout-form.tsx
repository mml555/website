"use client"

import { useState, useEffect } from 'react'
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, CreditCard } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { BillingAddress } from '@/types/address'

interface CheckoutFormProps {
  orderId?: string | null;
  clientSecret?: string;
  items?: any[];
  onPaying?: (paying: boolean) => void;
  onSuccess?: () => void;
  billingAddress: BillingAddress | null;
}

export default function CheckoutForm({ orderId, clientSecret, onPaying, onSuccess, billingAddress }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || loading || paymentSubmitted) return;

    setLoading(true);
    setError(null);
    if (onPaying) onPaying(true);

    try {
      // Get the payment intent ID from the client secret
      const paymentIntentId = clientSecret?.split('_secret_')[0];
      
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order-confirmation/${orderId}?payment_intent=${paymentIntentId}`,
          payment_method_data: {
            billing_details: {
              name: billingAddress?.name || '',
              email: billingAddress?.email || '',
              phone: billingAddress?.phone || '',
              address: {
                line1: billingAddress?.street || '',
                line2: '',
                city: billingAddress?.city || '',
                state: billingAddress?.state || '',
                postal_code: billingAddress?.postalCode || '',
                country: billingAddress?.country === 'USA' ? 'US' : billingAddress?.country || '',
              },
            },
          },
        },
        redirect: 'always',
      });

      if (submitError) {
        setError(submitError.message || 'An error occurred while processing your payment.');
      } else {
        setPaymentSubmitted(true);
        setRedirecting(true);
        if (onSuccess) onSuccess();
        // Let Stripe handle the redirect
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while processing your payment.');
    } finally {
      setLoading(false);
      if (onPaying) onPaying(false);
    }
  };

  if (redirecting) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-2"></div>
        <div>Redirecting to order confirmation...</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div id="payment-element">
            <PaymentElement
              options={{
                defaultValues: {
                  billingDetails: {
                    name: billingAddress?.name || '',
                    email: billingAddress?.email || '',
                    phone: billingAddress?.phone || '',
                    address: {
                      line1: billingAddress?.street || '',
                      line2: '',
                      city: billingAddress?.city || '',
                      state: billingAddress?.state || '',
                      postalCode: billingAddress?.postalCode || '',
                      country: billingAddress?.country === 'USA' ? 'US' : billingAddress?.country || '',
                    },
                  },
                },
                fields: {
                  billingDetails: {
                    name: 'auto',
                    email: 'auto',
                    phone: 'auto',
                    address: {
                      line1: 'auto',
                      line2: 'auto',
                      city: 'auto',
                      state: 'auto',
                      postalCode: 'auto',
                      country: 'auto',
                    },
                  },
                },
                layout: 'tabs',
              } as any}
            />
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={!stripe || loading || paymentSubmitted}
        className="w-full"
      >
        {loading ? 'Processing...' : paymentSubmitted ? 'Payment Submitted' : 'Pay Now'}
      </Button>
    </form>
  );
} 