'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export function ErrorBoundary({ children, fallback, onError }: Props) {
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
      setHasError(true)
      setError(error)
      console.error('Error caught by boundary:', error, errorInfo)
      
      if (onError) {
        onError(error, errorInfo)
      }
    }

    window.addEventListener('error', (event) => {
      handleError(event.error, { componentStack: event.error?.stack || '' })
    })

    return () => {
      window.removeEventListener('error', (event) => {
        handleError(event.error, { componentStack: event.error?.stack || '' })
      })
    }
  }, [onError])

  if (hasError) {
    if (fallback) {
      return fallback
    }

    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Something went wrong
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error?.message || 'An unexpected error occurred'}</p>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return children
}

function ErrorFallback({ error }: { error: Error | null }) {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4" role="alert">
            Something went wrong
          </h1>
          <p className="text-gray-600 mb-8">
            {error?.message || 'An unexpected error occurred. Please try again.'}
          </p>
        </div>
        <div className="space-y-4">
          <button
            onClick={() => window.location.reload()}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            aria-label="Reload page"
          >
            Reload page
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            aria-label="Go to home page"
          >
            Go to home page
          </button>
        </div>
      </div>
    </div>
  )
} 