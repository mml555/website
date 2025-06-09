"use client"

import { useState } from 'react'
import type { Product, ProductVariant } from '@/types/product'
import type { Session } from 'next-auth'
import AddToCartButton from './AddToCartButton'
import ProductReviews from './ProductReviews'
import RelatedProducts from './RelatedProducts'
import { decimalToNumber, formatPrice, validateProductData } from '@/lib/AppUtils'
import { useCart } from '@/lib/cart'
import ProductImage from '../ProductImage'

interface ProductDetailsProps {
  product: Product
  session: Session | null
  onError?: (error: string) => void
}

function getDefaultImage() {
  return '/images/placeholder.svg';
}

export default function ProductDetails({ product, session, onError }: ProductDetailsProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mainImage, setMainImage] = useState<string>(
    Array.isArray(product.images) && product.images.length > 0
      ? product.images[0]
      : getDefaultImage()
  )
  const { addItem } = useCart()

  const handleVariantSelect = (variant: ProductVariant) => {
    setSelectedVariant(variant)
  }

  const handleError = (message: string) => {
    setError(message)
    // Auto-dismiss error after 5 seconds
    setTimeout(() => setError(null), 5000)
  }

  const displayPrice = selectedVariant?.price || product.price
  const priceNumber = decimalToNumber(displayPrice)

  const validation = validateProductData(product)
  if (!validation.isValid) {
    onError?.(String(validation.error))
    return null
  }

  return (
    <div className="bg-white">
      {error && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            {/* Main product image */}
            <ProductImage
              src={mainImage}
              alt={product.name}
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover rounded-lg border border-gray-200 shadow-sm w-full h-auto"
            />
            {/* Thumbnails */}
            {Array.isArray(product.images) && product.images.length > 1 && (
              <div className="flex gap-2 mt-4">
                {product.images.map((img, idx) => (
                  <button
                    key={img + idx}
                    type="button"
                    onClick={() => setMainImage(img)}
                    className={`border rounded-md p-1 focus:outline-none focus:ring-2 focus:ring-primary ${mainImage === img ? 'ring-2 ring-primary border-primary' : 'border-gray-200'}`}
                    aria-label={`Show image ${idx + 1}`}
                  >
                    <ProductImage
                      src={img}
                      alt={`${product.name} thumbnail ${idx + 1}`}
                      sizes="64px"
                      className="object-cover rounded-md w-16 h-16"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
            
            <p className="text-2xl font-semibold text-primary dark:text-primary">
              {formatPrice(priceNumber)}
            </p>
            
            <div className="prose max-w-none text-gray-700">
              <p>{product.description}</p>
            </div>
            
            <div className="flex flex-col gap-4">
              <AddToCartButton
                productId={product.id}
                name={product.name}
                price={priceNumber}
                image={mainImage}
                stock={product.stock}
                variantId={selectedVariant?.id}
              />
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-16">
          <ProductReviews productId={product.id}/>
        </div>

        {/* Related Products */}
        <div className="mt-16">
          <RelatedProducts productId={product.id}/>
        </div>
      </div>
    </div>
  )
} 