import { Redis } from '@upstash/redis'

let redis: Redis | null = null

try {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!redisUrl || !redisToken) {
    console.warn('Redis configuration missing. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your .env file')
  } else {
    redis = new Redis({
      url: redisUrl,
      token: redisToken,
    })
  }
} catch (error) {
  console.warn('Failed to initialize Redis:', error)
}

// Helper function to handle Redis operations with fallback
export async function withRedis<T>(
  operation: (redis: Redis) => Promise<T>,
  fallbackValue: T
): Promise<T> {
  if (!redis) {
    console.warn('Redis not initialized, using fallback value')
    return fallbackValue
  }

  try {
    return await operation(redis)
  } catch (error) {
    console.warn('Redis operation failed:', error)
    return fallbackValue
  }
}

// Initialize Redis with default data if empty
export async function initializeRedis() {
  if (!redis) {
    console.warn('Redis not initialized, skipping initialization')
    return
  }

  try {
    const products = await redis.get('products')
    if (!products) {
      await redis.set('products', JSON.stringify([]))
    }
  } catch (error) {
    console.warn('Failed to initialize Redis with default data:', error)
  }
}

// Initialize Redis on server start
initializeRedis()

// Defensive helper for reading JSON from Redis
export async function getJsonFromRedis<T = any>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const value = await redis.get(key);
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch (err) {
        console.warn('Failed to parse cached data, deleting bad cache key:', err);
        await redis.del(key);
        return null;
      }
    }
    return null;
  } catch (err) {
    console.warn('Redis getJsonFromRedis error:', err);
    return null;
  }
}

export default redis 