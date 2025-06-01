"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { prisma } from "@/lib/prisma"
import { useCart } from '@/lib/cart'

interface OrderDetails {
  id: string
  status: string
  total: number
  items: {
    product: {
      name: string
      price: number
    }
    quantity: number
  }[]
  shippingAddress: {
    name: string
    address: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  createdAt: string
}

export default function OrderConfirmationPage() {
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { clearCart } = useCart();

  useEffect(() => {
    const paymentIntentId = searchParams.get("payment_intent")
    if (!paymentIntentId) {
      setError("No payment information found")
      setLoading(false)
      return
    }

    const fetchOrderDetails = async () => {
      try {
        const response = await fetch(`/api/orders?payment_intent=${paymentIntentId}`)
        if (!response.ok) {
          throw new Error("Failed to fetch order details")
        }
        const data = await response.json()
        setOrder(data)
        if (data && data.status && ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(data.status)) {
          clearCart();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load order details")
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [searchParams, clearCart])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900">Order Not Found</h2>
          <p className="mt-2 text-gray-600">
            We couldn&apos;t find the order details. Please contact support if you believe this is an error.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Order Status */}
          <div className="px-4 py-5 sm:px-6 bg-indigo-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Order #{order.id}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Placed on {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    order.status === "PAID"
                      ? "bg-green-100 text-green-800"
                      : order.status === "DELIVERED"
                      ? "bg-green-100 text-green-800"
                      : order.status === "CANCELLED"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {order.status}
                </span>
              </div>
            </div>
          </div>

          {/* Order Details */}
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Order Items</h4>
                <div className="space-y-4">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 border-b border-gray-100"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.product.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          Quantity: {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        ${(item.product.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  Shipping Address
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-900">{order.shippingAddress.name}</p>
                  <p className="text-sm text-gray-900">{order.shippingAddress.address}</p>
                  <p className="text-sm text-gray-900">
                    {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                    {order.shippingAddress.zipCode}
                  </p>
                  <p className="text-sm text-gray-900">{order.shippingAddress.country}</p>
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                  <h4 className="text-lg font-medium text-gray-900">Total</h4>
                  <p className="text-xl font-bold text-gray-900">
                    ${order.total.toFixed(2)}
                  </p>
                </div>
              </div>
            </dl>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-center space-x-4">
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
          >
            Continue Shopping
          </a>
          {session?.user?.role === "ADMIN" && (
            <a
              href="/dashboard/orders"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              View in Dashboard
            </a>
          )}
        </div>
      </div>
    </div>
  )
} 