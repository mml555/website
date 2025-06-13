import { getOrder } from '@/lib/orders'
import { logger } from '@/lib/logger'
import Link from 'next/link'
import Image from 'next/image'
import { OrderStatus as PrismaOrderStatus } from '@prisma/client'
import type { Order as OrderType } from '@/types/order'
import { OrderDetailsClient } from './OrderDetailsClient'

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
const OrderStatus = ({ order, onStatusChange, saving }: { 
  order: OrderType, 
  onStatusChange: (status: PrismaOrderStatus) => void,
  saving: boolean
}) => {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Order Status</h2>
      <div className="flex items-center space-x-4">
        <select
          value={order.status}
          onChange={(e) => onStatusChange(e.target.value as PrismaOrderStatus)}
          disabled={saving}
          className="rounded-md border-gray-300 text-sm text-gray-900 bg-white focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
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

export default async function OrderDetailsPage({
  params,
}: {
  params: { orderId: string }
}) {
  const { orderId } = await Promise.resolve(params)
  logger.info('Processing order details:', { orderId })

  try {
    const order = await getOrder(orderId)
    
    if (!order) {
      logger.warn('Order not found:', { orderId })
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Order Not Found</h1>
            <p className="text-muted-foreground mb-8">
              We couldn't find the order you're looking for. It may have been cancelled or doesn't exist.
            </p>
            <a
              href="/dashboard/orders"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Return to Orders
            </a>
          </div>
        </div>
      )
    }

    logger.info('Found order:', {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      tax: order.tax,
      itemsCount: order.items.length
    })

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold">Order Details</h1>
            <Link
              href="/dashboard/orders"
              className="text-sm text-indigo-600 hover:text-indigo-900"
            >
              ← Back to Orders
            </Link>
          </div>

          <OrderDetailsClient order={order} />
        </div>
      </div>
    )
  } catch (error) {
    logger.error('Error in order details:', {
      orderId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Error Loading Order</h1>
          <p className="text-muted-foreground mb-8">
            There was an error loading the order details. Please try again or contact support.
          </p>
          <a
            href="/dashboard/orders"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Return to Orders
          </a>
        </div>
      </div>
    )
  }
} 