import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { formatCurrency } from '@/lib/utils'
import type { Order, OrderItem, Product, ProductVariant, Address, BillingAddress } from '@prisma/client'

type OrderWithDetails = Order & {
  items: (OrderItem & {
    product: Product
    variant: ProductVariant | null
  })[]
  address: Address | null
  billingAddress: BillingAddress | null
  user: {
    id: string
    name: string | null
    email: string
  } | null
}

async function getOrder(orderId: string): Promise<OrderWithDetails> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: true,
          variant: true
        }
      },
      address: true,
      billingAddress: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  })

  if (!order) {
    notFound()
  }

  return order
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { orderId: string }
}) {
  const { orderId } = searchParams

  if (!orderId) {
    notFound()
  }

  const order = await getOrder(orderId)

  // Calculate totals using decimal arithmetic
  const subtotal = Number(order.total)
  const tax = order.tax ? Number(order.tax) : 0
  const shipping = order.shippingRate ? Number(order.shippingRate) : 0
  const total = subtotal + tax + shipping

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="max-w-xl">
          <h1 className="text-base font-medium text-indigo-600">Thank you!</h1>
          <p className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Order confirmed</p>
          <p className="mt-2 text-base text-gray-500">
            Your order #{order.orderNumber} has been placed and will be with you soon.
          </p>

          <dl className="mt-12 text-sm font-medium">
            <dt className="text-gray-900">Order number</dt>
            <dd className="mt-2 text-indigo-600">{order.orderNumber}</dd>
          </dl>

          <ul role="list" className="mt-6 divide-y divide-gray-200 border-t border-gray-200 text-sm font-medium">
            {order.items.map((item: OrderItem & { product: Product; variant: ProductVariant | null }) => (
              <li key={item.id} className="flex space-x-6 py-6">
                <div className="flex-auto space-y-1">
                  <h3 className="text-gray-900">{item.product.name}</h3>
                  {item.variant && (
                    <p className="text-gray-500">{item.variant.name}</p>
                  )}
                  <p className="text-gray-500">Qty {item.quantity}</p>
                </div>
                <p className="flex-none font-medium text-gray-900">
                  {formatCurrency(Number(item.price) * item.quantity)}
                </p>
              </li>
            ))}
          </ul>

          <dl className="space-y-6 border-t border-gray-200 pt-6 text-sm font-medium">
            <div className="flex justify-between">
              <dt className="text-gray-900">Subtotal</dt>
              <dd className="text-gray-900">{formatCurrency(subtotal)}</dd>
            </div>
            {order.tax && (
              <div className="flex justify-between">
                <dt className="text-gray-900">Tax</dt>
                <dd className="text-gray-900">{formatCurrency(tax)}</dd>
              </div>
            )}
            {order.shippingRate && (
              <div className="flex justify-between">
                <dt className="text-gray-900">Shipping</dt>
                <dd className="text-gray-900">{formatCurrency(shipping)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-6">
              <dt className="text-base font-medium text-gray-900">Total</dt>
              <dd className="text-base font-medium text-gray-900">
                {formatCurrency(total)}
              </dd>
            </div>
          </dl>

          <dl className="mt-16 grid grid-cols-2 gap-x-4 text-sm">
            <div>
              <dt className="font-medium text-gray-900">Shipping address</dt>
              <dd className="mt-2 text-gray-500">
                {order.address ? (
                  <address className="not-italic">
                    {order.address.name}<br />
                    {order.address.street}<br />
                    {order.address.city}, {order.address.state} {order.address.postalCode}<br />
                    {order.address.country}
                  </address>
                ) : (
                  <p>No shipping address provided</p>
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900">Billing address</dt>
              <dd className="mt-2 text-gray-500">
                {order.billingAddress ? (
                  <address className="not-italic">
                    {order.billingAddress.name}<br />
                    {order.billingAddress.street}<br />
                    {order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.postalCode}<br />
                    {order.billingAddress.country}
                  </address>
                ) : (
                  <p>No billing address provided</p>
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-16 border-t border-gray-200 py-6 text-right">
            <a
              href="/"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Continue shopping
              <span aria-hidden="true"> &rarr;</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
} 