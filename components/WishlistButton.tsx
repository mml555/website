'use client'

import { useState, useCallback } from 'react'
import { HeartIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { useSession } from 'next-auth/react'
import { toast } from 'react-hot-toast'

interface WishlistButtonProps {
  productId: string
  initialIsWishlisted?: boolean
}

export default function WishlistButton({ productId, initialIsWishlisted = false }: WishlistButtonProps) {
  const [isWishlisted, setIsWishlisted] = useState(initialIsWishlisted)
  const [isLoading, setIsLoading] = useState(false)
  const { data: session } = useSession()

  const handleWishlistToggle = useCallback(async () => {
    if (!session) {
      toast.error('Please sign in to add items to your wishlist')
      return
    }

    setIsLoading(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    try {
      const response = await fetch('/api/wishlist', {
        method: isWishlisted ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error('Failed to update wishlist')
      }

      setIsWishlisted(!isWishlisted)
      toast.success(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist')
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          toast.error('Request timed out. Please try again.')
        } else {
          toast.error(error.message || 'Failed to update wishlist')
        }
      } else {
        toast.error('Failed to update wishlist')
      }
    } finally {
      clearTimeout(timeoutId)
      setIsLoading(false)
    }
  }, [session, isWishlisted, productId])

  return (
    <button
      onClick={handleWishlistToggle}
      disabled={isLoading}
      className={`p-2 rounded-full transition-all duration-200 ${
        isWishlisted
          ? 'text-red-500 hover:text-red-600'
          : 'text-gray-400 hover:text-red-500'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      {isWishlisted ? (
        <HeartSolidIcon className="w-6 h-6" />
      ) : (
        <HeartIcon className="w-6 h-6" />
      )}
    </button>
  )
} 