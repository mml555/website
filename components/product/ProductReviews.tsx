"use client"

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { StarIcon } from '@heroicons/react/20/solid'
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'

interface Review {
  id: string
  rating: number
  title: string
  content: string
  images: string[]
  createdAt: string
  user: {
    id: string
    name: string
  }
  helpful: number
}

interface ProductReviewsProps {
  productId: string
  averageRating?: number
  reviewCount?: number
}

export default function ProductReviews({
  productId,
  averageRating = 0,
  reviewCount = 0,
}: ProductReviewsProps) {
  const { data: session } = useSession()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sortBy, setSortBy] = useState('newest')
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [newReview, setNewReview] = useState({
    rating: 0,
    title: '',
    content: '',
    images: [] as string[],
  })

  const fetchReviews = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        sortBy,
        ...(selectedRating && { rating: selectedRating.toString() }),
      })

      const response = await fetch(`/api/products/${productId}/reviews?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch reviews')
      }

      const data = await response.json()
      setReviews(data.reviews)
      setTotalPages(data.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reviews')
    } finally {
      setLoading(false)
    }
  }, [productId, page, sortBy, selectedRating])

  useEffect(() => {
    fetchReviews()
  }, [productId, page, sortBy, selectedRating, fetchReviews])

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return

    try {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newReview),
      })

      if (!response.ok) {
        throw new Error('Failed to submit review')
      }

      setShowReviewForm(false)
      setNewReview({
        rating: 0,
        title: '',
        content: '',
        images: [],
      })
      fetchReviews()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review')
    }
  }

  const handleHelpful = async (reviewId: string) => {
    try {
      const response = await fetch(`/api/products/${productId}/reviews/${reviewId}/helpful`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to mark review as helpful')
      }

      fetchReviews()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark review as helpful')
    }
  }

  if (loading) {
    return <div className="animate-pulse">Loading reviews...</div>
  }

  return (
    <div className="space-y-8">
      {/* Review Summary */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          {[1, 2, 3, 4, 5].map((rating) => (
            <StarIcon
              key={rating}
              className={`h-5 w-5 ${
                rating <= averageRating
                  ? 'text-yellow-400'
                  : 'text-gray-200'
              }`}
            />
          ))}
          <span className="ml-2 text-sm text-gray-600">
            {averageRating.toFixed(1)} ({reviewCount} reviews)
          </span>
        </div>
      </div>

      {/* Review Filters */}
      <div className="flex flex-wrap gap-4">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:ring-offset-2"
        >
          <option value="newest">Most Recent</option>
          <option value="helpful">Most Helpful</option>
          <option value="rating">Highest Rated</option>
          <option value="oldest">Oldest</option>
        </select>

        <div className="flex items-center space-x-2">
          {[5, 4, 3, 2, 1].map((rating) => (
            <button
              key={rating}
              onClick={() => setSelectedRating(selectedRating === rating ? null : rating)}
              className={`flex items-center space-x-1 px-3 py-2 rounded-md border ${
                selectedRating === rating
                  ? 'border-[#1e40af] bg-[#1e40af] text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{rating}</span>
              <StarIcon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Review Form */}
      {session && !showReviewForm && (
        <button
          onClick={() => setShowReviewForm(true)}
          className="text-[#1e40af] hover:text-[#1e3a8a] font-medium"
        >
          Write a Review
        </button>
      )}

      {showReviewForm && (
        <form onSubmit={handleSubmitReview} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900">
              Rating
            </label>
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setNewReview({ ...newReview, rating })}
                  className="focus:outline-none"
                >
                  {rating <= newReview.rating ? (
                    <StarIcon className="h-6 w-6 text-yellow-400" />
                  ) : (
                    <StarOutlineIcon className="h-6 w-6 text-gray-300" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">
              Title
            </label>
            <input
              type="text"
              value={newReview.title}
              onChange={(e) => setNewReview({ ...newReview, title: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:ring-offset-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">
              Review
            </label>
            <textarea
              value={newReview.content}
              onChange={(e) => setNewReview({ ...newReview, content: e.target.value })}
              rows={4}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:ring-offset-2"
              required
            />
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => setShowReviewForm(false)}
              className="text-gray-700 hover:text-gray-900 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#1e40af] px-4 py-2 text-white hover:bg-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:ring-offset-2"
            >
              Submit Review
            </button>
          </div>
        </form>
      )}

      {/* Reviews List */}
      <div className="space-y-6">
        {reviews.map((review) => (
          <div key={review.id} className="border-b border-gray-200 pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <StarIcon
                      key={rating}
                      className={`h-4 w-4 ${
                        rating <= review.rating
                          ? 'text-yellow-400'
                          : 'text-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {review.user.name}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {new Date(review.createdAt).toLocaleDateString()}
              </span>
            </div>

            <h3 className="mt-2 text-lg font-medium text-gray-900">
              {review.title}
            </h3>

            <p className="mt-2 text-gray-600">{review.content}</p>

            {review.images.length > 0 && (
              <div className="mt-4 flex space-x-4">
                {review.images.map((image, index) => (
                  <Image
                    key={index}
                    src={image}
                    alt={`Review image ${index + 1}`}
                    width={200}
                    height={200}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                ))}
              </div>
            )}

            <div className="mt-4">
              <button
                onClick={() => handleHelpful(review.id)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Helpful ({review.helpful})
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
} 