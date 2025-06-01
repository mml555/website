'use client'

import React, { useState, useRef } from 'react'

export default function NewsletterSection() {
  const [email, setEmail] = useState('')
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Reset success message after 5 seconds
  React.useEffect(() => {
    if (subscriptionStatus === 'success') {
      setShowSuccess(true)
      const timer = setTimeout(() => {
        setShowSuccess(false)
        setSubscriptionStatus('idle')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [subscriptionStatus])

  // Focus input on mount
  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubscribing(true)
    setSubscriptionStatus('idle')
    setErrorMessage('')

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setErrorMessage('Please enter a valid email address')
      setIsSubscribing(false)
      return
    }

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Subscription failed')
      }

      setSubscriptionStatus('success')
      setEmail('')
      if (inputRef.current) {
        inputRef.current.blur()
      }
    } catch (error) {
      setSubscriptionStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to subscribe')
      if (inputRef.current) {
        inputRef.current.focus()
      }
    } finally {
      setIsSubscribing(false)
    }
  }

  return (
    <section className="py-20 bg-gray-50" aria-labelledby="newsletter-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 id="newsletter-heading" className="text-4xl font-bold text-gray-900 mb-8">
            Stay Updated
          </h2>
          <p className="text-lg text-gray-700 mb-8">
            Subscribe to our newsletter for exclusive deals and updates
          </p>
          <form 
            ref={formRef}
            onSubmit={handleSubscribe} 
            className="max-w-md mx-auto"
            aria-label="Newsletter subscription form"
          >
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label htmlFor="email" className="sr-only">Email address</label>
                <input
                  ref={inputRef}
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isFocused ? 'border-primary ring-2 ring-primary/20' : 'border-gray-300'
                  } focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all`}
                  placeholder="Enter your email"
                  aria-label="Email address"
                  aria-invalid={subscriptionStatus === 'error'}
                  aria-describedby={subscriptionStatus === 'error' ? 'error-message' : undefined}
                  disabled={isSubscribing}
                />
                {subscriptionStatus === 'error' && (
                  <p id="error-message" className="mt-2 text-sm text-red-600">
                    {errorMessage}
                  </p>
                )}
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubscribing}
                aria-label={isSubscribing ? 'Subscribing...' : 'Subscribe to newsletter'}
              >
                {isSubscribing ? 'Subscribing...' : 'Subscribe'}
              </button>
            </div>
            {showSuccess && (
              <div 
                className="mt-4 p-4 bg-green-50 text-green-700 rounded-lg"
                role="alert"
                aria-live="polite"
              >
                Thank you for subscribing!
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  )
} 