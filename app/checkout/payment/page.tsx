"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'
import CheckoutForm from '@/components/checkout-form'
import { useSession } from 'next-auth/react'

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function PaymentPage() {
  const router = useRouter()
  const { items, total: cartTotal, isLoading: cartLoading } = useCart()
  const { status } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [shippingAddress, setShippingAddress] = useState<any>(null)
  const [billingAddress, setBillingAddress] = useState<any>(null)
  const [shippingRate, setShippingRate] = useState<any>(null)
  const [paying, setPaying] = useState(false)

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
    ) return

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
            total: cartTotal + shippingRate.rate
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to create payment intent')
        }

        const data = await response.json()
        if (!data.clientSecret || !data.orderId) {
          setError('No payment intent or order ID returned from server.')
          return
        }
        setClientSecret(data.clientSecret)
        setOrderId(data.orderId)
      } catch (err: any) {
        setError(err.message || 'Failed to initialize payment. Please try again.')
      }
    }

    createPaymentIntent()
  }, [items, cartTotal, status, cartLoading, shippingAddress, billingAddress, shippingRate])

  // Defensive guard: if any required address/rate is missing, redirect
  if (!shippingAddress || !billingAddress || !shippingRate) {
    if (typeof window !== 'undefined') {
      router.push('/checkout/shipping')
    }
    return null
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()}>Try Again</Button>
          <Button onClick={() => router.push('/cart')} variant="outline">Back to Cart</Button>
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
      <div className="max-w-4xl mx-auto p-6 flex flex-col items-center justify-center">
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
                  // Clear session storage after successful payment
                  sessionStorage.removeItem('shippingAddress')
                  sessionStorage.removeItem('billingAddress')
                  sessionStorage.removeItem('shippingRate')
                }}
              />
              {paying && (
                <div className="flex items-center mt-4 text-indigo-600">
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Processing payment...
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
              {items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                  </div>
                  <p className="font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
              <div className="border-t pt-4">
                <div className="flex justify-between mb-2">
                  <p>Subtotal</p>
                  <p>${cartTotal.toFixed(2)}</p>
                </div>
                <div className="flex justify-between mb-2">
                  <p>Shipping ({shippingRate.name})</p>
                  <p>${shippingRate.rate.toFixed(2)}</p>
                </div>
                <div className="flex justify-between font-bold">
                  <p>Total</p>
                  <p>${(cartTotal + shippingRate.rate).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 