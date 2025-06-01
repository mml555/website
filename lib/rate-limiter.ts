import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory store for development
// In production, this should be replaced with a proper KV store
const store = new Map<string, { count: number; resetAt: number }>()

export async function rateLimit(
  request: NextRequest,
  limit: number = 100,
  window: number = 60
): Promise<boolean> {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous'
  const key = `rate-limit:${ip}`
  const now = Date.now()
  
  const record = store.get(key)
  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + window * 1000 })
    return true
  }
  
  if (record.count >= limit) {
    return false
  }
  
  record.count++
  return true
}

export async function rateLimitMiddleware(
  request: NextRequest,
  limit: number = 100,
  window: number = 60
) {
  const isAllowed = await rateLimit(request, limit, window)
  
  if (!isAllowed) {
    return new NextResponse(
      JSON.stringify({ 
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED'
      }),
      { 
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': window.toString()
        }
      }
    )
  }
  
  return null
} 