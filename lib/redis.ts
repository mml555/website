import { Redis } from '@upstash/redis'

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

export default redis

export async function withRedis<T>(fn: (r: Redis) => Promise<T>, fallback?: T): Promise<T | undefined> {
  if (!redis) return fallback
  try {
    return await fn(redis)
  } catch (e) {
    return fallback
  }
}

export async function getJsonFromRedis<T>(key: string): Promise<T | null> {
  if (!redis) return null
  try {
    const value = await redis.get(key)
    return value ? JSON.parse(value as string) : null
  } catch {
    return null
  }
}

// Initialize Redis with default data if empty
export async function initializeRedis() {
  if (!redis) {
    return
  }

  try {
    const products = await redis.get('products')
    if (!products) {
      await redis.set('products', JSON.stringify([]))
    }
  } catch (error) {
  }
}

// Initialize Redis on server start
initializeRedis() 