"use client"

import { useState, useEffect, useMemo } from 'react'
import type { ProductVariant } from '@/types/product'

interface ProductVariantsProps {
  productId: string
  onVariantSelect: (variant: ProductVariant) => void
  selectedVariant?: ProductVariant
}

// Type guard to validate API response
function isValidVariant(data: unknown): data is ProductVariant {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data &&
    'price' in data &&
    typeof (data as ProductVariant).id === 'string' &&
    typeof (data as ProductVariant).name === 'string' &&
    typeof (data as ProductVariant).price === 'number' &&
    typeof (data as ProductVariant).stock === 'number'
  )
}

export default function ProductVariants({
  productId,
  onVariantSelect,
  selectedVariant,
}: ProductVariantsProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const fetchVariants = async () => {
      try {
        const response = await fetch(`/api/products/${productId}/variants`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? 'Product variants not found'
              : `Failed to fetch variants (${response.status})`
          )
        }

        const data = await response.json()
        
        if (!Array.isArray(data)) {
          throw new Error('Invalid response format')
        }

        const validVariants = data.filter(isValidVariant)
        if (validVariants.length === 0) {
          throw new Error('No valid variants found')
        }

        setVariants(validVariants)
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            setError('Request timed out')
          } else {
            setError(err.message)
          }
        } else {
          setError('An unexpected error occurred')
        }
      } finally {
        clearTimeout(timeoutId)
        setLoading(false)
      }
    }

    fetchVariants()

    return () => {
      controller.abort()
      clearTimeout(timeoutId)
    }
  }, [productId])

  // Memoize grouped variants calculation
  const groupedVariants = useMemo(() => 
    variants.reduce<Record<string, ProductVariant[]>>((acc, variant) => {
      if (!acc[variant.type]) {
        acc[variant.type] = []
      }
      acc[variant.type].push(variant)
      return acc
    }, {}),
    [variants]
  )

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 rounded"></div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="h-8 w-20 bg-gray-200 rounded"
                ></div>
              ))}
            </div>
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

  if (variants.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedVariants).map(([type, typeVariants]) => (
        <div key={type} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </label>
          <div className="flex flex-wrap gap-2">
            {typeVariants.map((variant) => (
              <button
                key={variant.id}
                onClick={() => onVariantSelect(variant)}
                className={`px-4 py-2 text-sm font-medium rounded-md border transition-all duration-150 transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  selectedVariant?.id === variant.id
                    ? 'border-primary bg-primary/10 text-primary focus:ring-primary'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-500'
                }`}
                aria-label={`Select ${variant.name} variant`}
              >
                {variant.name}
                {variant.price && (
                  <span className="ml-2 text-xs">
                    (+${variant.price.toFixed(2)})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
} 