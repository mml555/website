"use client"

import { useCart } from "@/lib/cart"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import type { CartItem as CartItemType, BaseCartItem, ProductCartItem } from '@/types/cart'
import { isProductCartItem, getVariantId } from '@/types/cart'
import type { CartItem as ProductCartItemType } from '@/types/product'
import { toast } from "react-hot-toast"
import LoadingSpinner from "@/components/LoadingSpinner"
import { TrashIcon } from "@heroicons/react/24/outline"
import { CartItemsList } from "@/components/Cart"
import Skeleton from '@/components/ui/Skeleton';
import { CartError, CartErrorCodes } from '@/lib/cart-error';
import { memoizeCartCalculation } from '@/lib/cart-performance';

// Main Cart Page UI
// This is the full cart page for /cart. Do NOT use this as a mini-cart or in a drawer/sidebar.
// For mini-cart/drawer/header cart, use components/Cart.tsx instead.

export const dynamic = 'force-dynamic'

// Helper function to validate and format price
const validatePrice = (price: any): number => {
  const numPrice = typeof price === 'number' ? price :
                  typeof price === 'string' ? parseFloat(price) : 0;
  return isNaN(numPrice) || numPrice < 0 ? 0 : numPrice;
};

// Helper function to get original price with validation
const getOriginalPrice = (item: CartItemType | ProductCartItemType): number => {
  if (isProductCartItem(item)) {
    return validatePrice(item.originalPrice);
  }
  return validatePrice(item.price);
};

// Memoized price calculation
const getItemPrice = memoizeCartCalculation(
  'item-price',
  () => {
    return (item: CartItemType | ProductCartItemType) => {
      if (isProductCartItem(item)) {
        return validatePrice(item.product?.price || item.price);
      }
      const price = validatePrice(item.price);
      const originalPrice = getOriginalPrice(item);
      return originalPrice > price ? originalPrice : price;
    };
  },
  5000 // 5 second TTL
);

// Custom type guard for checking variantId
const hasVariantId = (item: CartItemType | ProductCartItemType): item is ProductCartItem & { variantId: string } => {
  const productItem = item as ProductCartItem;
  return isProductCartItem(item) && typeof productItem.variantId === 'string';
};

// Inline function to get variantId safely
const getVariantId = (item: CartItemType | ProductCartItemType): string | undefined => {
  const productItem = item as ProductCartItem;
  if (hasVariantId(item)) {
    return productItem.variantId;
  }
  return undefined;
};

export default function CartPage() {
  const { items, updateQuantity, removeItem, isLoading, error, total: cartTotal, cartExpiryWarning } = useCart()
  const safeItems = useMemo(() => Array.isArray(items) ? items : [], [items]);
  const [isUpdating, setIsUpdating] = useState<{ [key: string]: boolean }>({})
  const router = useRouter()

  const handleQuantityChange = async (item: CartItemType | ProductCartItemType, newQuantity: number) => {
    if (newQuantity < 1 || (typeof item.stock === 'number' && newQuantity > item.stock)) return

    try {
      setIsUpdating(prev => ({ ...prev, [item.id]: true }))
      const variantId = getVariantId(item);
      await updateQuantity(item.id, newQuantity, variantId)
      toast.success('Cart updated')
    } catch (err) {
      if (err instanceof CartError) {
        switch (err.code) {
          case CartErrorCodes.INVALID_ITEM:
            toast.error('Invalid item quantity')
            break;
          case CartErrorCodes.SYNC_FAILED:
            toast.error('Failed to sync with server. Please try again.')
            break;
          default:
            toast.error(err.message || 'Failed to update cart')
        }
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to update cart')
      }
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
      if (err instanceof CartError) {
        switch (err.code) {
          case CartErrorCodes.INVALID_ITEM:
            toast.error('Invalid item')
            break;
          case CartErrorCodes.SYNC_FAILED:
            toast.error('Failed to sync with server. Please try again.')
            break;
          default:
            toast.error(err.message || 'Failed to remove item')
        }
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to remove item')
      }
    } finally {
      setIsUpdating(prev => ({ ...prev, [itemId]: false }))
    }
  }

  useEffect(() => {
    console.log('Cart items:', safeItems.map(i => ({
      id: i.id,
      name: i.name,
      variantId: i.variantId,
      price: getItemPrice(i),
      originalPrice: getOriginalPrice(i)
    })));
  }, [safeItems]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mt-12">
            <div className="flow-root">
              <ul className="-my-6 divide-y divide-gray-200">
                {[...Array(4)].map((_, i) => (
                  <li key={i} className="flex py-6 animate-pulse">
                    <Skeleton className="flex-shrink-0 w-24 h-24 rounded-md bg-gray-200" />
                    <div className="ml-4 flex flex-1 flex-col space-y-2">
                      <Skeleton className="h-6 w-1/2 bg-gray-200 rounded" />
                      <Skeleton className="h-4 w-1/3 bg-gray-200 rounded" />
                      <Skeleton className="h-4 w-1/4 bg-gray-200 rounded" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
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
            <p className="mt-2 text-sm text-gray-500" data-testid="error-message">{error}</p>
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
        {cartExpiryWarning && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-yellow-500 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" /></svg>
              <span>{cartExpiryWarning}</span>
            </div>
          </div>
        )}
        <div className="lg:grid lg:grid-cols-12 lg:gap-x-12 lg:items-start">
          <div className="lg:col-span-7">
            <h1 id="cart-heading" className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Shopping Cart
            </h1>

            <div className="mt-12">
              <div className="flow-root" role="region" aria-labelledby="cart-heading">
                <CartItemsList
                  items={safeItems}
                  onQuantityChange={handleQuantityChange}
                  onRemove={handleRemoveItem}
                  isUpdating={isUpdating}
                  getItemPrice={getItemPrice}
                  showImage={true}
                  renderRemoveButton={({ item, onRemove, isUpdating }) => (
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className="font-medium text-indigo-600 hover:text-indigo-500 flex items-center"
                      aria-label={`Remove ${item.name} from cart`}
                      disabled={isUpdating[item.id]}
                    >
                      {isUpdating[item.id] ? <LoadingSpinner size="sm" /> : <TrashIcon className="h-5 w-5" aria-hidden="true" />}
                    </button>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 lg:mt-0 lg:col-span-5">
            <div className="rounded-lg bg-gray-50 px-4 py-6 sm:p-6 lg:p-8">
              <h2 className="text-lg font-medium text-gray-900">Order summary</h2>
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-base font-medium text-gray-900">Subtotal</div>
                  <div className="text-base font-medium text-gray-900">${Number(cartTotal || 0).toFixed(2)}</div>
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