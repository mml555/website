"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import CheckoutForm from '@/components/checkout-form'
import { useSession } from 'next-auth/react'

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function PaymentPage() {
  const router = useRouter()
  const { items, total: cartTotal, isLoading: cartLoading } = useCart()
  const { status } = useSession();
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [shippingAddress, setShippingAddress] = useState<any>(null)
  const [billingAddress, setBillingAddress] = useState<any>(null)
  const [shippingRate, setShippingRate] = useState<any>(null)
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const paymentTimeout = useRef<NodeJS.Timeout | null>(null);

  // 1. Set addresses/rate from sessionStorage ONCE
  useEffect(() => {
    const storedShippingAddress = sessionStorage.getItem('shippingAddress')
    const storedBillingAddress = sessionStorage.getItem('billingAddress')
    const storedShippingRate = sessionStorage.getItem('shippingRate')

    if (!storedShippingAddress || !storedBillingAddress || !storedShippingRate) {
      router.push('/checkout/shipping')
      return
    }

    setShippingAddress(JSON.parse(storedShippingAddress))
    setBillingAddress(JSON.parse(storedBillingAddress))
    setShippingRate(JSON.parse(storedShippingRate))
  }, [])

  // 2. Create payment intent when all required data is present
  useEffect(() => {
    if (
      status === 'loading' ||
      cartLoading ||
      !items.length ||
      !cartTotal || cartTotal <= 0 ||
      !shippingAddress || !billingAddress || !shippingRate
    ) return;

    const createPaymentIntent = async () => {
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            shippingAddress,
            billingAddress,
            shippingRate,
            total: cartTotal
          }),
        })

        if (!response.ok) throw new Error('Failed to create payment intent')
        const data = await response.json()
        if (!data.clientSecret || !data.orderId) {
          setError('No payment intent or order ID returned from server.')
          return
        }
        setClientSecret(data.clientSecret)
        setOrderId(data.orderId)
      } catch (err) {
        setError('Failed to initialize payment. Please try again.')
      }
    }

    createPaymentIntent()
  }, [items, cartTotal, status, cartLoading, shippingAddress, billingAddress, shippingRate])

  // Defensive guard: if any required address/rate is missing, redirect
  if (!shippingAddress || !billingAddress || !shippingRate) {
    if (typeof window !== 'undefined') {
      router.push('/checkout/shipping');
    }
    return null;
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert variant="destructive" className="mb-6" role="alert" tabIndex={-1} aria-live="assertive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()} variant="default" aria-label="Try payment again">Try Again</Button>
          <Button onClick={() => router.push('/cart')} variant="outline" aria-label="Back to Cart">Back to Cart</Button>
        </div>
      </div>
    )
  }

  if (
    status === 'loading' ||
    cartLoading ||
    !items.length ||
    !cartTotal || cartTotal <= 0
  ) {
    return (
      <div className="max-w-4xl mx-auto p-6 flex flex-col items-center justify-center" role="status" aria-live="polite" aria-busy="true" tabIndex={-1}>
        <Loader2 className="animate-spin h-8 w-8 text-gray-500 mb-4" />
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Loading payment information...</h2>
          <p className="text-gray-600">Please wait while we prepare your payment details.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-8">Payment Information</h1>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Payment Form */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Elements stripe={stripePromise} options={{ clientSecret: clientSecret || undefined }}>
              <CheckoutForm
                clientSecret={clientSecret || undefined}
                items={items}
                orderId={orderId || undefined}
                onPaying={setPaying}
                onSuccess={() => {
                  setPaymentSuccess(true);
                  paymentTimeout.current = setTimeout(() => setPaymentSuccess(false), 2000);
                }}
              />
              {paying && (
                <div className="flex items-center mt-4 text-indigo-600"><Loader2 className="animate-spin h-5 w-5 mr-2" />Processing payment...</div>
              )}
              {paymentSuccess && (
                <div className="flex items-center mt-4 text-green-600" role="status" aria-live="polite" aria-busy="true" tabIndex={-1}>
                  <CheckCircle2 className="h-5 w-5 mr-2" />Payment successful! Redirecting...
                </div>
              )}
            </Elements>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Shipping Address</h3>
                <p className="text-sm text-gray-600">
                  {shippingAddress.street}<br />
                  {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}<br />
                  {shippingAddress.country}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Billing Address</h3>
                <p className="text-sm text-gray-600">
                  {billingAddress.name}<br />
                  {billingAddress.street}<br />
                  {billingAddress.city}, {billingAddress.state} {billingAddress.postalCode}<br />
                  {billingAddress.country}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Shipping Method</h3>
                <p className="text-sm text-gray-600">
                  {shippingRate.name} - ${shippingRate.rate.toFixed(2)}
                </p>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between mb-2">
                  <span>Subtotal:</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Shipping:</span>
                  <span>${shippingRate.rate.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t">
                  <span>Total:</span>
                  <span>${(cartTotal + shippingRate.rate).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 