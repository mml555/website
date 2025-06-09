"use client"

import { useState } from 'react'
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
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);
    if (onPaying) onPaying(true);

    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order-confirmation`,
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
      });

      if (submitError) {
        setError(submitError.message || 'An error occurred while processing your payment.');
      } else {
        setRedirecting(true);
        if (onSuccess) onSuccess();
        if (orderId) {
          router.push(`/order-confirmation/${orderId}`);
        } else {
          router.push(`/order-confirmation?payment_intent=${result.paymentIntent.id}`);
        }
        return;
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred during payment.');
      console.error('Payment error:', err);
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
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
                      postal_code: billingAddress?.postalCode || '',
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
                      postal_code: 'auto',
                      country: 'auto',
                    },
                  },
                },
              } as any}
            />
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full"
      >
        {loading ? 'Processing...' : 'Pay Now'}
      </Button>
    </form>
  );
} 