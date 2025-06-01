"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ErrorBoundary } from '@/components/ErrorBoundary'
import Image from 'next/image'

interface OrderItem {
  id: string
  quantity: number
  price: number
  product: {
    name: string
    price: number
    images: string[]
  }
}

interface Address {
  name: string
  email: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
  phone: string
}

interface Order {
  id: string
  total: number
  status: string
  createdAt: string
  user: {
    name: string
    email: string
  }
  items: OrderItem[]
  shippingAddress?: Address
  billingAddress?: Address
}

// Helper function to safely format price
const formatPrice = (price: number | undefined | null): string => {
  if (typeof price !== 'number' || isNaN(price)) {
    return 'Price unavailable'
  }
  return `$${price.toFixed(2)}`
}

// Order Status Component
const OrderStatus = ({ order, onStatusChange, saving }: { 
  order: Order, 
  onStatusChange: (status: string) => void,
  saving: boolean 
}) => (
  <div className="bg-white shadow rounded-lg p-6">
    <h2 className="text-lg font-medium text-gray-900 mb-4">Order Status</h2>
    <div className="space-y-4">
      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700">
          Status
        </label>
        <select
          id="status"
          value={order.status}
          onChange={(e) => onStatusChange(e.target.value)}
          disabled={saving}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900 bg-white"
        >
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>
      <div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium mt-2 inline-block ${
            order.status === "DELIVERED"
              ? "bg-green-100 text-green-800"
              : order.status === "CANCELLED"
              ? "bg-red-100 text-red-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {order.status}
        </span>
      </div>
      <div>
        <p className="text-sm text-gray-500">
          Order Date: {new Date(order.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  </div>
)

// Customer Information Component
const CustomerInfo = ({ user }: { user: Order['user'] }) => (
  <div className="bg-white shadow rounded-lg p-6">
    <h2 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h2>
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-500">Name</p>
        <p className="mt-1 text-sm text-gray-900">{user.name}</p>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">Email</p>
        <p className="mt-1 text-sm text-gray-900">{user.email}</p>
      </div>
    </div>
  </div>
)

// Address Component
const AddressInfo = ({ address, title }: { address: Address, title: string }) => (
  <div className="bg-white shadow rounded-lg p-6">
    <h2 className="text-lg font-medium text-gray-900 mb-4">{title}</h2>
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-500">Name</p>
        <p className="mt-1 text-sm text-gray-900">{address.name}</p>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">Address</p>
        <p className="mt-1 text-sm text-gray-900">
          {address.address}
          <br />
          {address.city}, {address.state} {address.zipCode}
          <br />
          {address.country}
        </p>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">Phone</p>
        <p className="mt-1 text-sm text-gray-900">{address.phone}</p>
      </div>
    </div>
  </div>
)

// Order Items Component
const OrderItems = ({ items, total }: { items: OrderItem[], total: number }) => (
  <div className="bg-white shadow rounded-lg p-6 lg:col-span-2">
    <h2 className="text-lg font-medium text-gray-900 mb-4">Order Items</h2>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-300">
        <thead>
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
              Product
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Price
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Quantity
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                <div className="flex items-center">
                  <div className="h-10 w-10 flex-shrink-0">
                    <Image
                      src={item.product.images && item.product.images.length > 0 ? item.product.images[0] : 'https://via.placeholder.com/400'}
                      alt={item.product.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  </div>
                  <div className="ml-4">
                    <div className="font-medium text-gray-900">{item.product.name}</div>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {formatPrice(item.price)}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {item.quantity}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {formatPrice(item.price * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="text-right py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
              Total
            </td>
            <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
              {formatPrice(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
)

export default function OrderDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/orders/${params.orderId}`)
        if (!response.ok) {
          const errorData = await response.json()
          if (response.status === 422) {
            const validationErrors = errorData.errors
              ?.map((err: any) => `${err.path}: ${err.message}`)
              .join(', ')
            throw new Error(`Validation error: ${validationErrors || errorData.message}`)
          }
          throw new Error(errorData.message || "Failed to fetch order details")
        }
        const data = await response.json()
        setOrder(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    if (params.orderId) {
      fetchOrder()
    }
  }, [params.orderId])

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return

    setSaving(true)
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 422) {
          throw new Error(`Validation error: ${errorData.errors?.map((err: any) => err.message).join(', ')}`)
        }
        throw new Error(errorData.message || "Failed to update order status")
      }

      const updatedOrder = await response.json()
      setOrder(updatedOrder)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Error loading order details</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <div className="space-x-4">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Try Again
          </button>
          <Link
            href="/dashboard/orders"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Orders
          </Link>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Order not found</h2>
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Back to Orders
        </Link>
      </div>
    )
  }

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Order details error:', error, errorInfo)
      }}
    >
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-xl font-semibold text-gray-900">Order Details</h1>
            <p className="mt-2 text-sm text-gray-700">
              Order #{order?.id}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <Link
              href="/dashboard/orders"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Orders
            </Link>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {order && (
            <>
              <OrderStatus order={order} onStatusChange={handleStatusChange} saving={saving} />
              <CustomerInfo user={order.user} />
              {order.shippingAddress && (
                <AddressInfo address={order.shippingAddress} title="Shipping Address" />
              )}
              {order.billingAddress && (
                <AddressInfo address={order.billingAddress} title="Billing Address" />
              )}
              <OrderItems items={order.items} total={order.total} />
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
} 