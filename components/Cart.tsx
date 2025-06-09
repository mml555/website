'use client'

import { useCart } from '@/lib/cart'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import type { CartItem } from '@/types/product'
import Skeleton from './ui/Skeleton'

// Mini-Cart / Drawer / Header Cart UI
// This component is for use in a cart drawer, sidebar, or header. Do NOT use as the main cart page.
// For the full cart page UI, use app/cart/CartPage.tsx instead.

export default function Cart() {
  const { items, removeItem, updateQuantity, total, error, clearError, isLoading } = useCart()
  const [updatingItem, setUpdatingItem] = useState<string | null>(null)

  const handleQuantityChange = async (id: string, quantity: number, variantId?: string) => {
    try {
      setUpdatingItem(id)
      await updateQuantity(id, quantity, variantId)
    } catch (err) {
      // Error is already handled by the cart context
    } finally {
      setUpdatingItem(null)
    }
  }

  const handleRemoveItem = async (id: string, variantId?: string) => {
    try {
      setUpdatingItem(id)
      await removeItem(id, variantId)
    } catch (err) {
      // Error is already handled by the cart context
    } finally {
      setUpdatingItem(null)
    }
  }

  // Wrapper for CartItemsList prop types
  const handleQuantityChangeWrapper = (item: CartItem, newQuantity: number) => {
    handleQuantityChange(item.id, newQuantity, item.variantId);
  };
  const handleRemoveItemWrapper = (id: string) => {
    handleRemoveItem(id);
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center">
        <ul className="-my-6 divide-y divide-gray-200 w-full max-w-md">
          {[...Array(2)].map((_, i) => (
            <li key={i} className="flex py-6 animate-pulse">
              <Skeleton className="flex-shrink-0 w-16 h-16 rounded-md bg-gray-200" />
              <div className="ml-4 flex flex-1 flex-col space-y-2">
                <Skeleton className="h-5 w-1/2 bg-gray-200 rounded" />
                <Skeleton className="h-4 w-1/3 bg-gray-200 rounded" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center text-center p-8">
        {error && (
          <div data-testid="error-message" className="bg-red-50 border-l-4 border-red-400 p-4 mb-4" role="alert">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={clearError}
                  className="inline-flex text-red-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  aria-label="Dismiss error message"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your cart is empty</h2>
        <p className="text-gray-900 mb-8">Add some items to your cart to continue shopping.</p>
        <div data-testid="cart-items">0</div>
        <div data-testid="total-items">0</div>
        <div data-testid="total-price">0</div>
        <Link
          href="/products"
          className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Browse products"
        >
          Browse Products
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white">
      {error && (
        <div data-testid="error-message" className="bg-red-50 border-l-4 border-red-400 p-4 mb-4" role="alert">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={clearError}
                className="inline-flex text-red-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                aria-label="Dismiss error message"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl mb-8">
          Shopping Cart
        </h1>

        <CartItemsList
          items={items}
          onQuantityChange={handleQuantityChangeWrapper}
          onRemove={handleRemoveItemWrapper}
          isUpdating={{}}
          getItemPrice={(item) => Number(item.price) || 0}
          showImage={false}
          renderRemoveButton={(props) => (
            <button
              type="button"
              onClick={() => props.onRemove(props.item.id)}
              className="font-medium text-indigo-600 hover:text-indigo-500 flex items-center"
              aria-label={`Remove ${props.item.name} from cart`}
              disabled={props.isUpdating[props.item.id]}
            >
              {props.isUpdating[props.item.id] ? <LoadingSpinner size="sm" /> : 'Remove'}
            </button>
          )}
        />

        <div className="border-t border-gray-200 py-6 px-4 sm:px-6">
          <div className="flex justify-between text-base font-medium text-gray-900">
            <p>Total Items</p>
            <p data-testid="total-items">{items.reduce((sum, item) => sum + item.quantity, 0)}</p>
          </div>
          <div className="flex justify-between text-base font-medium text-gray-900 mt-2">
            <p>Subtotal</p>
            <p data-testid="total-price">{total.toFixed(2)}</p>
          </div>
          <p className="mt-0.5 text-sm text-gray-900">Shipping and taxes calculated at checkout.</p>
          <div className="mt-6">
            <Link
              href="/checkout"
              className="flex justify-center items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              aria-label="Proceed to checkout"
            >
              Checkout
            </Link>
          </div>
          <div className="mt-6 flex justify-center text-sm text-center text-gray-900">
            <p>
              or{' '}
              <Link
                href="/products"
                className="text-primary font-medium hover:text-primary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                aria-label="Continue shopping"
              >
                Continue Shopping
                <span aria-hidden="true"> &rarr;</span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Shared cart items list for both mini-cart and main cart page
interface CartItemsListProps {
  items: CartItem[];
  onQuantityChange: (item: CartItem, newQuantity: number) => void;
  onRemove: (id: string) => void;
  isUpdating: { [key: string]: boolean };
  getItemPrice: (item: CartItem) => number;
  showImage?: boolean;
  renderRemoveButton?: ({ item, onRemove, isUpdating }: { item: CartItem; onRemove: (id: string) => void; isUpdating: { [key: string]: boolean } }) => React.ReactNode;
}

export function CartItemsList({ items, onQuantityChange, onRemove, isUpdating, getItemPrice, showImage = false, renderRemoveButton }: CartItemsListProps) {
  return (
    <ul className="-my-6 divide-y divide-gray-200" data-testid="cart-items">
      {items.map((item: CartItem) => (
        <li key={item.id} className="flex py-6">
          {showImage && (
            <div className="flex-shrink-0 w-24 h-24 border border-gray-200 rounded-md overflow-hidden">
              <Image
                src={item.image}
                alt={item.name}
                width={96}
                height={96}
                className="w-full h-full object-center object-cover"
              />
            </div>
          )}
          <div className={showImage ? "ml-4 flex flex-1 flex-col" : "flex-1 flex flex-col"}>
            <div>
              <div className="flex justify-between text-base font-medium text-gray-900">
                <h3>{item.name}</h3>
                <p className="ml-4">${getItemPrice(item) * item.quantity}</p>
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
                  onChange={(e) => onQuantityChange(item, parseInt(e.target.value))}
                  className="rounded-md border-gray-300 py-1.5 text-base leading-5 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  aria-label={`Quantity for ${item.name}`}
                  disabled={isUpdating[item.id]}
                >
                  {[...Array(Math.min(item.stock ?? 10, 100)).keys()].map(i => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>
              {renderRemoveButton ? (
                renderRemoveButton({ item, onRemove, isUpdating })
              ) : (
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="font-medium text-indigo-600 hover:text-indigo-500 flex items-center"
                  aria-label={`Remove ${item.name} from cart`}
                  disabled={isUpdating[item.id]}
                >
                  {isUpdating[item.id] ? <LoadingSpinner size="sm" /> : 'Remove'}
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
} 