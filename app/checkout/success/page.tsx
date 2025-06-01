"use client"

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCart } from '@/lib/cart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'
import { formatOrderNumber } from '@/lib/order-utils'

export default function SuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { clearCart } = useCart()

  useEffect(() => {
    // Clear session storage (but do not clear cart here)
    sessionStorage.removeItem('shippingAddress')
    sessionStorage.removeItem('billingAddress')
    sessionStorage.removeItem('shippingRate')
  }, [])

  const paymentIntent = searchParams.get('payment_intent')
  const paymentIntentClientSecret = searchParams.get('payment_intent_client_secret')
  const redirectStatus = searchParams.get('redirect_status')
  const orderId = searchParams.get('order_id')
  const orderNumber = searchParams.get('order_number') || orderId

  if (redirectStatus !== 'succeeded') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Payment Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              We&apos;re sorry, but your payment could not be processed. Please try again or contact support if the problem persists.
            </p>
            <Button onClick={() => router.push('/checkout/payment')}>
              Return to Payment
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <CardTitle>Order Confirmed!</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-600">
              Thank you for your order! Your payment has been processed successfully.
            </p>
            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-600">
                Order Number: {orderNumber ? formatOrderNumber(orderNumber) : 'N/A'}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Payment Reference: {paymentIntent}
              </p>
            </div>
            <p className="text-gray-600">
              We&apos;ll send you an email confirmation with your order details and tracking information once your order ships.
            </p>
            <div className="flex space-x-4">
              <Button onClick={() => router.push('/')}>
                Continue Shopping
              </Button>
              <Button variant="outline" onClick={() => orderId ? router.push(`/orders/${orderId}`) : router.push('/orders')}>
                View Order
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 