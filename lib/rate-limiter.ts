import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Redis } from '@upstash/redis'

// Initialize Redis client with error handling
let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } else {
    console.warn('Redis credentials not found. Rate limiting will be disabled.');
  }
} catch (error) {
  console.error('Failed to initialize Redis client:', error);
}

export async function rateLimit(
  request: NextRequest,
  limit: number = 100,
  window: number = 60
): Promise<boolean> {
  // If Redis is not available, allow the request
  if (!redis) {
    console.warn('Rate limiting disabled - Redis not available');
    return true;
  }

  const ip = request.headers.get('x-forwarded-for') || 'anonymous'
  const key = `rate-limit:${ip}`
  
  try {
    const current = await redis.incr(key)
    if (current === 1) {
      await redis.expire(key, window)
    }
    
    return current <= limit
  } catch (error) {
    console.error('Rate limit error:', error)
    // On Redis error, allow the request
    return true
  }
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
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: window
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