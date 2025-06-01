"use client"

import { useState, useCallback, useEffect } from 'react'
import { useCart } from '@/lib/cart'

interface AddToCartButtonProps {
  productId: string
  name: string
  price: number
  image: string
  stock?: number
  userId?: string
  variantId?: string
  simple?: boolean
}

export default function AddToCartButton({
  productId,
  name,
  price,
  image,
  stock,
  userId,
  variantId,
  simple = false,
}: AddToCartButtonProps) {
  const [quantity, setQuantity] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addItem } = useCart()

  // Determine if product is out of stock
  const isOutOfStock = stock === 0 || stock === undefined || stock === null

  // Reset quantity when stock changes
  useEffect(() => {
    if (isOutOfStock) {
      setQuantity(0)
    } else if (quantity === 0) {
      setQuantity(1)
    }
  }, [stock, isOutOfStock, quantity])

  const handleQuantityChange = useCallback((newQuantity: number) => {
    if (newQuantity < 1) return
    if (newQuantity > (stock ?? 0)) {
      setError(`Only ${stock} items available in stock`)
      return
    }
    setQuantity(newQuantity)
    setError(null)
  }, [stock])

  const handleAddToCart = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault() // Prevent form submission
    e.stopPropagation() // Prevent event bubbling
    
    if (!stock || stock <= 0) {
      setError('Product is out of stock')
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      await addItem({
        productId,
        name,
        price,
        image,
        variantId,
        stock
      }, quantity)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item to cart')
    } finally {
      setIsLoading(false)
    }
  }

  // Memoize handlers to prevent unnecessary re-renders
  const handleDecreaseQuantity = useCallback(() => {
    handleQuantityChange(quantity - 1)
  }, [quantity, handleQuantityChange])

  const handleIncreaseQuantity = useCallback(() => {
    handleQuantityChange(quantity + 1)
  }, [quantity, handleQuantityChange])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleQuantityChange(parseInt(e.target.value) || 1)
  }, [handleQuantityChange])

  const isButtonDisabled = isLoading || isOutOfStock || quantity > (stock ?? 0) || quantity < 1

  if (simple) {
    return (
      <div className="space-y-2">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-2">
            <p className="text-red-600 text-xs flex items-center">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isButtonDisabled}
          className={`w-full rounded-md px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isOutOfStock
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#1e40af] hover:bg-[#1e3a8a] active:bg-[#1e3a8a]/90 focus:ring-[#1e40af] disabled:bg-gray-400 disabled:cursor-not-allowed'
          }`}
          aria-label={isLoading ? "Adding to cart..." : isOutOfStock ? "Out of stock" : "Add to cart"}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Adding...
            </div>
          ) : isOutOfStock ? (
            "Sold Out"
          ) : (
            "Add to Cart"
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!isOutOfStock && (
        <div className="flex items-center space-x-6">
          <div className="flex items-center border-2 border-gray-300 rounded-lg bg-white shadow-sm">
            <button
              type="button"
              onClick={handleDecreaseQuantity}
              disabled={quantity <= 1 || isLoading}
              className="px-4 py-2 text-gray-900 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:ring-offset-2"
              aria-label="Decrease quantity"
            >
              -
            </button>
            <input
              type="number"
              min="1"
              max={stock}
              value={quantity}
              onChange={handleInputChange}
              disabled={isLoading}
              className="w-20 text-center border-x border-gray-300 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:ring-offset-2 disabled:bg-gray-100 disabled:text-gray-700 transition-all duration-150 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              aria-label="Quantity"
            />
            <button
              type="button"
              onClick={handleIncreaseQuantity}
              disabled={quantity >= (stock ?? 0) || isLoading}
              className="px-4 py-2 text-gray-900 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:ring-offset-2"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          {isLoading && (
            <div className="flex items-center">
              <svg className="animate-spin h-5 w-5 text-[#1e40af]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-2 text-sm text-gray-600">Adding...</span>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-red-600 text-sm flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={handleAddToCart}
        disabled={isButtonDisabled}
        className={`w-full rounded-lg px-6 py-3 text-base font-semibold text-white shadow-md transition-all duration-150 transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          isOutOfStock
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-[#1e40af] hover:bg-[#1e3a8a] active:bg-[#1e3a8a]/90 focus:ring-[#1e40af] disabled:bg-gray-400 disabled:cursor-not-allowed'
        }`}
        aria-label={isLoading ? "Adding to cart..." : isOutOfStock ? "Out of stock" : "Add to cart"}
      >
        {isLoading
          ? "Adding..."
          : isOutOfStock
          ? "Sold Out"
          : "Add to Cart"}
      </button>
    </div>
  )
} 