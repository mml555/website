"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useCart } from '@/lib/cart'
import { Session } from 'next-auth'
import { logger } from '@/lib/logger'

interface Order {
  id: string
  userId: string
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'PAID'
  total: number
  tax: number
  shippingRate: number
  createdAt: string
  updatedAt: string
  orderNumber: string
  customerEmail: string | null
  stripeSessionId: string | null
  paymentIntentId: string
  user: {
    id: string
    name: string
    email: string
  }
  items: Array<{
    id: string
    orderId: string
    productId: string
    quantity: number
    price: number
    variantId: string | null
    product: {
      id: string
      name: string
      description: string
      price: number
      categoryId: string
      createdAt: string
      updatedAt: string
      sku: string | null
      stock: number
      weight: number | null
      images: string[]
      featured: boolean
      isActive: boolean
      cost: number | null
      salePrice: number | null
    }
    variant: {
      id: string
      name: string
      type: string
    } | null
  }>
  shippingAddress: {
    id: string
    orderId: string
    name: string
    email: string
    phone: string
    street: string
    city: string
    state: string
    postalCode: string
    country: string
    createdAt: string
    updatedAt: string
  }
  billingAddress: {
    id: string
    orderId: string
    phone: string
    street: string
    city: string
    state: string
    postalCode: string
    country: string
    createdAt: string
    updatedAt: string | null
  }
}

export default function OrderConfirmationPage() {
  const searchParams = useSearchParams()
  const { data: session } = useSession() as { data: Session | null }
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { clearCart } = useCart()
  const [cartCleared, setCartCleared] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setLoading(true)
        setError(null)

        const paymentIntentId = searchParams.get('payment_intent')
        const orderId = searchParams.get('orderId')

        if (!paymentIntentId && !orderId) {
          throw new Error('No order identifier provided')
        }

        // Prepare headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }

        // Add guest session if available
        const guestSession = sessionStorage.getItem('guestSession')
        if (guestSession) {
          headers['X-Guest-Session'] = guestSession
        }

        logger.info('Fetching order details:', {
          paymentIntentId,
          orderId,
          hasSession: !!session,
          hasGuestSession: !!guestSession
        })

        const response = await fetch(
          `/api/orders?${orderId ? `orderId=${orderId}` : `payment_intent=${paymentIntentId}`}`,
          {
            method: 'GET',
            headers,
            credentials: 'include',
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to fetch order details')
        }

        const data = await response.json()

        if (!data.orders || !Array.isArray(data.orders) || data.orders.length === 0) {
          throw new Error('No order found')
        }

        const order = data.orders[0]
        setOrder(order)

        // If we're using payment_intent in the URL, redirect to the cleaner URL
        if (paymentIntentId && !orderId) {
          router.replace(`/order-confirmation/${order.orderNumber}`)
        }

        // Clear cart if not already cleared
        if (!cartCleared) {
          try {
            // Clear cart state
            clearCart()
            
            // Clear guest session if it exists
            if (guestSession) {
              sessionStorage.removeItem('guestSession')
            }
            
            // Clear cart from localStorage
            localStorage.removeItem('cart')
            localStorage.removeItem('guestCart')
            localStorage.removeItem('cartState')
            
            setCartCleared(true)
            logger.info('Cart cleared successfully')
          } catch (err) {
            logger.error('Error clearing cart:', err)
          }
        }
      } catch (err) {
        logger.error('Error fetching order:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch order details')
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [searchParams, clearCart, cartCleared, router, session])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Error Loading Order</h1>
          <p className="text-muted-foreground mb-8">{error}</p>
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Return to Home
          </a>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Order Not Found</h1>
          <p className="text-muted-foreground mb-8">
            We couldn't find the order you're looking for. It may have been cancelled or doesn't exist.
          </p>
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Return to Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
          <p className="text-muted-foreground">
            Thank you for your purchase. Your order has been received.
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Order Details</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Order Number:</span>
              <span className="font-medium">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${
                order.status === "PAID" || order.status === "PROCESSING" ? "text-green-600" :
                order.status === "SHIPPED" ? "text-purple-600" :
                order.status === "DELIVERED" ? "text-green-600" :
                "text-yellow-600"
              }`}>
                {order.status}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Items</h3>
            <div className="space-y-4">
              {order.items?.map((item) => (
                <div key={item.id} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                    {item.variant && (
                      <p className="text-sm text-gray-500">Variant: {item.variant.name}</p>
                    )}
                  </div>
                  <p className="font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${(order.total - order.tax - order.shippingRate).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>${order.shippingRate.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>${order.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Continue Shopping
          </a>
        </div>
      </div>
    </div>
  )
} 