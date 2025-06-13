'use client'

import { useState } from 'react'
import { Prisma } from '@prisma/client'
import type { Order as OrderType } from '@/types/order'
import { logger } from '@/lib/logger'
import Image from 'next/image'

type OrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

interface OrderItem {
  id: string
  product: {
    name: string
    price: number
    images: string[]
  }
  quantity: number
  price: number
}

interface Address {
  name: string
  email: string
  phone?: string
  street: string
  city: string
  state: string
  postalCode: string
  country: string
}

// Helper function to safely format price
const formatPrice = (price: number | undefined | null): string => {
  if (typeof price !== 'number' || isNaN(price)) {
    return 'Price unavailable'
  }
  return `$${price.toFixed(2)}`
}

// Order Status Component
const OrderStatusDisplay = ({ order, onStatusChange, saving }: { 
  order: OrderType, 
  onStatusChange: (status: OrderStatus) => void,
  saving: boolean
}) => {
  const isPaid = order.paymentIntentId && ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status);
  
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Order Status</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Order Status</label>
          <select
            value={order.status}
            onChange={(e) => onStatusChange(e.target.value as OrderStatus)}
            disabled={saving}
            className="rounded-md border-gray-300 text-sm text-gray-900 bg-white focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="PROCESSING">Processing</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
          <div className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
            isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {isPaid ? 'Paid' : 'Pending'}
          </div>
          {order.paymentIntentId && (
            <p className="mt-1 text-xs text-gray-500">
              Payment ID: {order.paymentIntentId}
            </p>
          )}
        </div>
        {saving && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
        )}
      </div>
    </div>
  )
}

// Customer Info Component
const CustomerInfo = ({ customerEmail }: { customerEmail?: string | null }) => {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h2>
      <div>
        <p className="text-sm text-gray-600">Email: {customerEmail || 'Guest Customer'}</p>
      </div>
    </div>
  )
}

// Address Info Component
const AddressInfo = ({ address, title }: { address: Address, title: string }) => {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">{title}</h2>
      <div className="text-sm text-gray-600">
        <p>{address.name}</p>
        <p>{address.street}</p>
        <p>{address.city}, {address.state} {address.postalCode}</p>
        <p>{address.country}</p>
        {address.phone && <p>Phone: {address.phone}</p>}
        <p>Email: {address.email}</p>
      </div>
    </div>
  )
}

// Order Items Component
const OrderItems = ({ items, total, shippingRate = 0, tax = 0 }: { 
  items: OrderItem[], 
  total: number,
  shippingRate?: number,
  tax?: number
}) => {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Order Items</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
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
                        src={item.product.images && item.product.images.length > 0 ? item.product.images[0] : 'https://picsum.photos/400'}
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
                Subtotal
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                {formatPrice(subtotal)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="text-right py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                Shipping
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                {formatPrice(shippingRate)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="text-right py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                Tax
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                {formatPrice(tax)}
              </td>
            </tr>
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
}

export function OrderDetailsClient({ order }: { order: OrderType }) {
  const [saving, setSaving] = useState(false)

  const handleStatusChange = async (newStatus: OrderStatus) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update order status')
      }

      // Refresh the page to show updated status
      window.location.reload()
    } catch (error) {
      logger.error('Error updating order status:', {
        orderId: order.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <OrderStatusDisplay order={order} onStatusChange={handleStatusChange} saving={saving} />
      <CustomerInfo customerEmail={order.customerEmail} />
      {order.shippingAddress && (
        <AddressInfo address={order.shippingAddress} title="Shipping Address" />
      )}
      {order.billingAddress && (
        <AddressInfo address={order.billingAddress} title="Billing Address" />
      )}
      <OrderItems 
        items={order.items} 
        total={order.total} 
        shippingRate={order.shippingRate} 
        tax={order.tax || 0} 
      />
    </div>
  )
} 