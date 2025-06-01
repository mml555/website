import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory store for development
// In production, this should be replaced with a proper KV store
const store = new Map<string, { value: any; expiresAt: number }>()

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  prefix?: string
}

export class Cache {
  private prefix: string
  private ttl: number

  constructor(options: CacheOptions = {}) {
    this.prefix = options.prefix || 'cache:'
    this.ttl = options.ttl || 3600 // Default 1 hour
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`
  }

  async get<T>(key: string): Promise<T | null> {
    const record = store.get(this.getKey(key))
    if (!record) return null
    
    if (Date.now() > record.expiresAt) {
      store.delete(this.getKey(key))
      return null
    }
    
    return record.value
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expiresAt = Date.now() + (ttl || this.ttl) * 1000
    store.set(this.getKey(key), { value, expiresAt })
  }

  async delete(key: string): Promise<void> {
    store.delete(this.getKey(key))
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = Array.from(store.keys()).filter(key => 
      key.startsWith(this.prefix) && key.includes(pattern)
    )
    keys.forEach(key => store.delete(key))
  }
}

// Create cache instances for different purposes
export const productCache = new Cache({ prefix: 'product:', ttl: 3600 }) // 1 hour
export const categoryCache = new Cache({ prefix: 'category:', ttl: 86400 }) // 24 hours
export const orderCache = new Cache({ prefix: 'order:', ttl: 1800 }) // 30 minutes

// Cache decorator for API routes
export function withCache(cache: Cache, keyFn: (req: Request) => string) {
  return function (handler: Function) {
    return async function (req: Request, ...args: any[]) {
      const cacheKey = keyFn(req)
      const cached = await cache.get(cacheKey)

      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const result = await handler(req, ...args)
      const data = await result.json()
      await cache.set(cacheKey, data)
      return result
    }
  }
} 