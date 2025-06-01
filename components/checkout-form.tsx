"use client"

import { useState } from 'react'
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface CheckoutFormProps {
  orderId?: string | null;
  clientSecret?: string;
  items?: any[];
}

export default function CheckoutForm({ orderId }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (!stripe || !elements) {
      setError('Stripe has not loaded yet.');
      setLoading(false);
      return;
    }
    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // Do not use return_url, handle redirect manually
        },
        redirect: 'if_required',
      });
      if (!result || typeof result !== 'object') {
        setError('Unexpected error: No response from payment processor.');
        setLoading(false);
        return;
      }
      if (result.error) {
        setError(result.error.message || 'Payment failed.');
      } else if (result.paymentIntent) {
        setRedirecting(true);
        // Redirect to confirmation page with payment_intent
        router.push(`/order-confirmation?payment_intent=${result.paymentIntent.id}`);
        return;
      } else {
        setError('Payment succeeded but no payment intent returned.');
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred during payment.');
    }
    setLoading(false);
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
          <PaymentElement />
        </CardContent>
      </Card>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={!stripe || loading}>
        {loading ? 'Processing...' : 'Pay'}
      </Button>
    </form>
  );
} 