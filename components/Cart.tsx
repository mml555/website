'use client'

import { useCart } from '@/lib/cart'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import type { CartItem as CartItemType } from '@/types/cart'
import type { CartItem as ProductCartItem } from '@/types/product'
import Skeleton from './ui/Skeleton'

// Mini-Cart / Drawer / Header Cart UI
// This component is for use in a cart drawer, sidebar, or header. Do NOT use as the main cart page.
// For the full cart page UI, use app/cart/CartPage.tsx instead.

export default function Cart() {
  const { items, isLoading, error } = useCart();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  const totalItems = items.reduce((sum: number, item: CartItemType | ProductCartItem) => {
    const quantity = typeof item.quantity === 'string' ? parseInt(item.quantity) : item.quantity;
    return sum + (isNaN(quantity) ? 0 : quantity);
  }, 0);

  const totalPrice = items.reduce((sum: number, item: CartItemType | ProductCartItem) => {
    const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
    const quantity = typeof item.quantity === 'string' ? parseInt(item.quantity) : item.quantity;
    if (!price || !quantity || isNaN(price) || isNaN(quantity) || quantity <= 0) {
      return sum;
    }
    const itemTotal = price * quantity;
    return sum + (isNaN(itemTotal) ? 0 : itemTotal);
  }, 0);

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-16 sm:px-6 lg:max-w-7xl lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Shopping Cart</h1>
        <div className="mt-12 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-12 xl:gap-x-16">
          <div className="lg:col-span-7">
            {items.length === 0 ? (
              <p className="text-gray-500">Your cart is empty</p>
            ) : (
              <ul className="divide-y divide-gray-200 border-b border-t border-gray-200">
                {items.map((item: CartItemType | ProductCartItem) => {
                  const itemName = 'product' in item ? item.product?.name : item.name;
                  const itemImage = 'product' in item ? item.product?.images?.[0] : item.image;
                  const itemPrice = 'product' in item ? item.product?.price : item.price;
                  const variantName = 'variant' in item ? item.variant?.name : undefined;
                  
                  return (
                    <li key={`${item.productId}-${item.variantId || ''}`} className="flex py-6 sm:py-10">
                      <div className="flex-shrink-0">
                        <img
                          src={itemImage || 'https://placehold.co/400x400?text=No+Image'}
                          alt={itemName || 'Product'}
                          className="h-24 w-24 rounded-md object-cover object-center sm:h-48 sm:w-48"
                        />
                      </div>
                      <div className="ml-4 flex flex-1 flex-col justify-between sm:ml-6">
                        <div className="relative pr-9 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:pr-0">
                          <div>
                            <div className="flex justify-between">
                              <h3 className="text-sm">
                                <a href={`/products/${item.productId}`} className="font-medium text-gray-700 hover:text-gray-800">
                                  {itemName || 'Product'}
                                </a>
                              </h3>
                            </div>
                            {variantName && (
                              <p className="mt-1 text-sm text-gray-500">{variantName}</p>
                            )}
                            <p className="mt-1 text-sm font-medium text-gray-900">${itemPrice?.toFixed(2) || '0.00'}</p>
                          </div>
                          <div className="mt-4 sm:mt-0 sm:pr-9">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-gray-500">Qty {item.quantity}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="mt-16 rounded-lg bg-gray-50 px-4 py-6 sm:p-6 lg:col-span-5 lg:mt-0 lg:p-8">
            <h2 className="text-lg font-medium text-gray-900">Order summary</h2>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Subtotal</p>
                <p className="text-sm font-medium text-gray-900">${totalPrice.toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <p className="text-base font-medium text-gray-900">Order total</p>
                <p className="text-base font-medium text-gray-900">${totalPrice.toFixed(2)}</p>
              </div>
            </div>
            <div className="mt-6">
              <button
                type="button"
                className="w-full rounded-md border border-transparent bg-indigo-600 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-50"
              >
                Checkout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Shared cart items list for both mini-cart and main cart page
interface CartItemsListProps {
  items: (CartItemType | ProductCartItem)[];
  onQuantityChange: (item: CartItemType | ProductCartItem, newQuantity: number) => void;
  onRemove: (id: string) => void;
  isUpdating: { [key: string]: boolean };
  getItemPrice: (item: CartItemType | ProductCartItem) => number;
  showImage?: boolean;
  renderRemoveButton?: ({ item, onRemove, isUpdating }: { item: CartItemType | ProductCartItem; onRemove: (id: string) => void; isUpdating: { [key: string]: boolean } }) => React.ReactNode;
}

// Helper function to validate and format price
const validatePrice = (price: any): number => {
  const numPrice = typeof price === 'number' ? price :
                  typeof price === 'string' ? parseFloat(price) : 0;
  return isNaN(numPrice) || numPrice < 0 ? 0 : numPrice;
};

// Helper function to get item price with validation
const getItemPrice = (item: CartItemType | ProductCartItem): number => {
  if ('product' in item && item.product) {
    return validatePrice(item.product.price);
  }
  return validatePrice(item.price);
};

// Helper function to get original price with validation
const getOriginalPrice = (item: CartItemType | ProductCartItem): number => {
  if ('product' in item && item.product) {
    return validatePrice(item.product.price); // Use product price as original if no originalPrice
  }
  return validatePrice(item.originalPrice || item.price);
};

export function CartItemsList({ items, onQuantityChange, onRemove, isUpdating, getItemPrice, showImage = false, renderRemoveButton }: CartItemsListProps) {
  return (
    <ul className="-my-6 divide-y divide-gray-200" data-testid="cart-items">
      {items.map((item: CartItemType | ProductCartItem) => {
        const itemName = 'product' in item ? item.product?.name : item.name;
        const itemImage = 'product' in item ? item.product?.images?.[0] : item.image;
        const currentPrice = getItemPrice(item);
        const originalPrice = getOriginalPrice(item);
        const variantName = 'variant' in item ? item.variant?.name : undefined;
        const hasDiscount = originalPrice > currentPrice;
        
        return (
          <li key={`${item.productId}-${item.variantId || ''}`} className="flex py-6">
            {showImage && (
              <div className="flex-shrink-0 w-24 h-24 border border-gray-200 rounded-md overflow-hidden">
                <Image
                  src={itemImage || 'https://placehold.co/400x400?text=No+Image'}
                  alt={itemName || 'Product'}
                  width={96}
                  height={96}
                  className="w-full h-full object-center object-cover"
                />
              </div>
            )}
            <div className={showImage ? "ml-4 flex flex-1 flex-col" : "flex-1 flex flex-col"}>
              <div>
                <div className="flex justify-between text-base font-medium text-gray-900">
                  <h3>{itemName || 'Product'}</h3>
                  <div className="ml-4">
                    {hasDiscount ? (
                      <div className="flex flex-col items-end">
                        <span className="text-sm line-through text-gray-500">
                          ${originalPrice.toFixed(2)}
                        </span>
                        <span className="text-red-600">
                          ${currentPrice.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span>${currentPrice.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                {variantName && (
                  <p className="mt-1 text-sm text-gray-500">{variantName}</p>
                )}
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
                    aria-label={`Quantity for ${itemName || 'Product'}`}
                    disabled={isUpdating[item.id]}
                  >
                    {[...Array(Math.min(('product' in item ? item.product?.stock : item.stock) ?? 10, 100)).keys()].map(i => (
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
                    aria-label={`Remove ${itemName || 'Product'} from cart`}
                    disabled={isUpdating[item.id]}
                  >
                    {isUpdating[item.id] ? <LoadingSpinner size="sm" /> : 'Remove'}
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
} 