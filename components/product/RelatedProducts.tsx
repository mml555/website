"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Product } from '@/types/product'
import { formatPrice } from '@/lib/utils'
import ProductImage from '../ProductImage'

interface RelatedProductsProps {
  productId: string
  type?: 'similar' | 'complementary' | 'upgrade'
  limit?: number
}

export default function RelatedProducts({
  productId,
  type = 'similar',
  limit = 4,
}: RelatedProductsProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRelatedProducts = async () => {
      try {
        const response = await fetch(`/api/products/${productId}/related?type=${type}&limit=${limit}`)
        if (!response.ok) throw new Error('Failed to fetch related products')
        const data = await response.json()
        setProducts(data)
      } catch (error) {
        console.error('Error fetching related products:', error)
        setError(error instanceof Error ? error.message : 'Failed to fetch related products')
      } finally {
        setLoading(false)
      }
    }

    fetchRelatedProducts()
  }, [productId, type, limit])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(limit)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-h-1 aspect-w-1 w-full overflow-hidden rounded-lg bg-gray-200" />
            <div className="mt-4 h-4 w-3/4 rounded bg-gray-200" />
            <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (products.length === 0) {
    return null
  }

  // Defensive deduplication by product ID
  const dedupedProducts = Array.from(new Map(products.map(p => [p.id, p])).values());

  if (dedupedProducts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">
        {type === 'similar' && 'Similar Products'}
        {type === 'complementary' && 'Complementary Products'}
        {type === 'upgrade' && 'Upgrade Options'}
      </h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {dedupedProducts.map((product, index) => {
          const imageUrl = product.images?.[0] || "https://picsum.photos/seed/default/400/400"
          return (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="group"
            >
              <div className="mb-4">
                <ProductImage
                  src={imageUrl}
                  alt={product.name}
                  priority={index < 4}
                />
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-900">
                  {product.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {typeof product.category === 'string'
                    ? product.category
                    : product.category?.name || 'Uncategorized'}
                </p>
                <p className="mt-1 text-sm font-medium text-primary dark:text-primary">
                  {formatPrice(product.price)}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
} 