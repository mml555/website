import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { Redis } from '@upstash/redis'
import { headers } from 'next/headers'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

// Rate limiting constants
const RATE_LIMIT_WINDOW = 3600 // 1 hour in seconds
const MAX_REQUESTS_PER_WINDOW = 5

// Cache TTL in seconds
const CACHE_TTL = 86400 // 24 hours

// Verify API key is loaded
const apiKey = process.env.RESEND_API_KEY
if (!apiKey) {
  console.error('RESEND_API_KEY is not set in environment variables')
}

const resend = new Resend(apiKey)

// Email validation schema
const emailSchema = z.object({
  email: z.string().email('Invalid email format'),
})

// Response headers helper
function getResponseHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Content-Type': 'application/json',
  }
}

// Rate limiting helper
async function checkRateLimit(ip: string): Promise<boolean> {
  const key = `rate_limit:${ip}`
  const requests = await redis.incr(key)
  
  if (requests === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW)
  }
  
  return requests <= MAX_REQUESTS_PER_WINDOW
}

export async function POST(request: Request) {
  try {
    // Check if Resend API key is configured
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Newsletter service is not configured' },
        { status: 503, headers: getResponseHeaders() }
      )
    }

    // Get client IP for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for') || ''
    const ip = forwardedFor.split(',')[0] || 'unknown'

    // Check rate limit
    const isAllowed = await checkRateLimit(ip)
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: getResponseHeaders() }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const result = emailSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid email format', details: result.error.flatten() },
        { status: 400, headers: getResponseHeaders() }
      )
    }

    const { email } = result.data

    // Check if email is already subscribed
    const isSubscribed = await redis.get(`subscribed:${email}`)
    if (isSubscribed) {
      return NextResponse.json(
        { message: 'You are already subscribed to our newsletter' },
        { status: 200, headers: getResponseHeaders() }
      )
    }

    // Send welcome email
    const data = await resend.emails.send({
      from: 'E-commerce Store <onboarding@resend.dev>',
      to: email,
      subject: 'Welcome to Our Newsletter! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #4F46E5; text-align: center;">Welcome to Our Newsletter!</h1>
          <p style="font-size: 16px; line-height: 1.6; color: #374151;">
            Thank you for subscribing to our newsletter. We're excited to have you join our community!
          </p>
          <p style="font-size: 16px; line-height: 1.6; color: #374151;">
            You'll be the first to know about:
          </p>
          <ul style="font-size: 16px; line-height: 1.6; color: #374151;">
            <li>New product launches</li>
            <li>Exclusive deals and discounts</li>
            <li>Special promotions</li>
            <li>Store updates and news</li>
          </ul>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/products" 
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Start Shopping
            </a>
          </div>
          <p style="font-size: 14px; color: #6B7280; margin-top: 30px; text-align: center;">
            If you didn't subscribe to our newsletter, you can safely ignore this email.
          </p>
        </div>
      `,
    })

    // Cache the subscription
    await redis.set(`subscribed:${email}`, JSON.stringify(true), { ex: CACHE_TTL })

    // Log success (for debugging)
    console.log('Newsletter subscription email sent successfully:', data)

    return NextResponse.json(
      { message: 'Successfully subscribed to newsletter' },
      { status: 200, headers: getResponseHeaders() }
    )
  } catch (error) {
    Sentry.captureException(error)
    // Log detailed error (for debugging)
    console.error('Newsletter subscription error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    
    // Return appropriate error message based on error type
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Newsletter service is not configured' },
          { status: 503, headers: getResponseHeaders() }
        )
      }
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429, headers: getResponseHeaders() }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to subscribe to newsletter' },
      { status: 500, headers: getResponseHeaders() }
    )
  }
} 