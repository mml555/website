"use client"

import { useCart } from "@/lib/cart"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import type { CartItem } from '@/types/product'
import { toast } from "react-hot-toast"
import LoadingSpinner from "@/components/LoadingSpinner"
import { TrashIcon } from "@heroicons/react/24/outline"

export const dynamic = 'force-dynamic'

export default function CartPage() {
  const { items, updateQuantity, removeItem, isLoading, error, total: cartTotal } = useCart()
  const safeItems = Array.isArray(items) ? items : [];
  const [isUpdating, setIsUpdating] = useState<{ [key: string]: boolean }>({})
  const router = useRouter()

  const handleQuantityChange = async (item: CartItem, newQuantity: number) => {
    if (newQuantity < 1 || (typeof item.stock === 'number' && newQuantity > item.stock)) return

    try {
      setIsUpdating(prev => ({ ...prev, [item.id]: true }))
      await updateQuantity(item.id, newQuantity)
      toast.success('Cart updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update cart')
    } finally {
      setIsUpdating(prev => ({ ...prev, [item.id]: false }))
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    try {
      setIsUpdating(prev => ({ ...prev, [itemId]: true }))
      await removeItem(itemId)
      toast.success('Item removed from cart')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove item')
    } finally {
      setIsUpdating(prev => ({ ...prev, [itemId]: false }))
    }
  }

  const getItemPrice = (item: CartItem): number => {
    const price = Number(item.price)
    return isNaN(price) || price <= 0 ? 0 : price
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-lg font-medium text-red-600">Error</h2>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
            <button
              onClick={() => router.refresh()}
              className="mt-4 inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (safeItems.length === 0) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-lg font-medium text-gray-900">Your cart is empty</h2>
            <p className="mt-2 text-sm text-gray-500">
              Looks like you haven&apos;t added any items to your cart yet.
            </p>
            <div className="mt-6">
              <button
                onClick={() => router.push("/products")}
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-x-12 lg:items-start">
          <div className="lg:col-span-7">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Shopping Cart
            </h1>

            <div className="mt-12">
              <div className="flow-root">
                <ul className="-my-6 divide-y divide-gray-200">
                  {safeItems.map((item) => (
                    <li key={item.id} className="flex py-6">
                      <div className="flex-shrink-0 w-24 h-24 border border-gray-200 rounded-md overflow-hidden">
                        <Image
                          src={item.image}
                          alt={item.name}
                          width={96}
                          height={96}
                          className="w-full h-full object-center object-cover"
                        />
                      </div>

                      <div className="ml-4 flex flex-1 flex-col">
                        <div>
                          <div className="flex justify-between text-base font-medium text-gray-900">
                            <h3>{item.name}</h3>
                            <p className="ml-4">${(getItemPrice(item) * item.quantity).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="flex flex-1 items-end justify-between text-sm">
                          <div className="flex items-center">
                            <label htmlFor={`quantity-${item.id}`} className="sr-only">
                              Quantity
                            </label>
                            <select
                              id={`quantity-${item.id}`}
                              value={item.quantity}
                              onChange={(e) => handleQuantityChange(item, parseInt(e.target.value))}
                              className="rounded-md border-gray-300 py-1.5 text-base leading-5 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                              aria-label={`Quantity for ${item.name}`}
                            >
                              {[...Array(Math.min(item.stock ?? 10, 10)).keys()].map(i => (
                                <option key={i + 1} value={i + 1}>{i + 1}</option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="font-medium text-indigo-600 hover:text-indigo-500"
                            aria-label={`Remove ${item.name} from cart`}
                          >
                            <TrashIcon className="h-5 w-5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8 lg:mt-0 lg:col-span-5">
            <div className="rounded-lg bg-gray-50 px-4 py-6 sm:p-6 lg:p-8">
              <h2 className="text-lg font-medium text-gray-900">Order summary</h2>
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-base font-medium text-gray-900">Subtotal</div>
                  <div className="text-base font-medium text-gray-900">${cartTotal.toFixed(2)}</div>
                </div>
                <p className="text-sm text-gray-500">
                  Shipping and taxes calculated at checkout.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => router.push("/checkout")}
                    className="w-full rounded-md border border-transparent bg-indigo-600 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-50"
                  >
                    Checkout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 