import { NextResponse } from 'next/server'
// @ts-ignore
// const { Resend } = require('resend')
import redis from '@/lib/redis'
import { headers } from 'next/headers'
import { z } from 'zod'

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

// const resend = new Resend(apiKey)

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
  if (!redis) return false;
  const key = `rate_limit:${ip}`
  const requests = await redis.incr(key)
  
  if (requests === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW)
  }
  
  return requests <= MAX_REQUESTS_PER_WINDOW
}

// export async function POST(request: Request) { ... }

export async function POST() {
  return new Response(JSON.stringify({ message: 'Test OK' }), { status: 200 })
} 