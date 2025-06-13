'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// Dynamically import HomePage with loading state
const HomePage = dynamic(() => import('../HomePage'), {
  loading: () => (
    <div className="min-h-screen bg-gray-50">
      <div className="h-96 bg-gray-100 animate-pulse" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="h-8 w-48 bg-gray-200 rounded mb-16 mx-auto" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-h-1 aspect-w-1 w-full overflow-hidden rounded-lg bg-gray-200" />
              <div className="mt-4 h-4 w-3/4 rounded bg-gray-200" />
              <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
  ssr: false
})

export default function HomePageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <div className="h-96 bg-gray-100 animate-pulse" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="h-8 w-48 bg-gray-200 rounded mb-16 mx-auto" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-h-1 aspect-w-1 w-full overflow-hidden rounded-lg bg-gray-200" />
                <div className="mt-4 h-4 w-3/4 rounded bg-gray-200" />
                <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <HomePage />
    </Suspense>
  )
} 