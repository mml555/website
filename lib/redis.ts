import { createClient } from 'redis';
import { logger } from './logger'

// Redis client type
type RedisClient = ReturnType<typeof createClient>;

// Create Redis client with error handling
let redis: RedisClient | null = null;

try {
    redis = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    // Connect to Redis
    redis.connect().catch((error) => {
        logger.error('Redis connection error:', error);
    });

    // Handle Redis connection errors
    redis.on('error', (error) => {
        logger.error('Redis client error:', error);
    });

    // Log successful connection
    redis.on('connect', () => {
        logger.info('Redis client connected successfully');
    });

    // Log when client is ready
    redis.on('ready', () => {
        logger.info('Redis client ready');
    });

    // Log reconnection attempts
    redis.on('reconnecting', () => {
        logger.info('Redis client reconnecting');
    });
} catch (error) {
    logger.error('Failed to initialize Redis client:', error);
    throw new Error('Redis initialization failed');
}

// Enhanced Redis wrapper with retry logic
export async function withRedis<T>(
  fn: (r: Redis) => Promise<T>,
  fallback: T,
  retryCount = 0
): Promise<T> {
  if (!redis) {
    logger.error('Redis client not initialized')
    return fallback
  }

  try {
    return await fn(redis)
  } catch (error) {
    logger.error('Redis operation failed:', error)
    
    if (retryCount < 3) {
      logger.info(`Retrying Redis operation (${retryCount + 1}/3)`)
      await new Promise(resolve => setTimeout(resolve, 1000))
      return withRedis(fn, fallback, retryCount + 1)
    }
    
    return fallback
  }
}

// Get Redis instance directly
export function getRedis(): Redis {
  if (!redis) {
    throw new Error('Redis client not initialized')
  }
  return redis
}

export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    await redis.quit()
  }
}

// Enhanced JSON handling with type safety
export async function getJsonFromRedis<T>(key: string): Promise<T | null> {
  const result = await withRedis(async (redis) => {
    try {
      const value = await redis.get(key)
      if (!value) return null
      
      // Handle both string and object values
      if (typeof value === 'string') {
        try {
          return JSON.parse(value) as T
        } catch (e) {
          // If parsing fails, return the string value
          return value as unknown as T
        }
      }
      
      // If value is already an object, return it directly
      return value as T
    } catch (error) {
      logger.error(`Failed to parse Redis value for key ${key}:`, error)
      return null
    }
  }, null)
  
  return result ?? null
}

// Cache management utilities
export async function setCacheWithExpiry(
  key: string,
  value: any,
  expirySeconds: number
): Promise<void> {
  await withRedis(async (redis) => {
    try {
      const serialized = JSON.stringify(value)
      await redis.set(key, serialized, 'EX', expirySeconds)
      logger.debug(`Cache set for key: ${key}`)
    } catch (error) {
      logger.error(`Failed to set cache for key ${key}:`, error)
    }
  }, undefined)
}

export async function deleteCache(key: string): Promise<void> {
  await withRedis(async (redis) => {
    try {
      await redis.del(key)
      logger.debug(`Cache deleted for key: ${key}`)
    } catch (error) {
      logger.error(`Failed to delete cache for key ${key}:`, error)
    }
  }, undefined)
}

export async function clearCache(pattern: string): Promise<void> {
  await withRedis(async (redis) => {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
        logger.info(`Cleared ${keys.length} cache entries matching pattern: ${pattern}`)
      }
    } catch (error) {
      logger.error(`Failed to clear cache for pattern ${pattern}:`, error)
    }
  }, undefined)
}

interface CartSyncRequest {
    items: any[];
    guestId: string;
}

interface CartSyncResponse {
    items: any[];
    total: number;
    error?: string;
}

// Function to get guest cart from Redis
export const getGuestCart = async (): Promise<CartSyncResponse | null> => {
    try {
        const guestId = localStorage.getItem('guestId') || '';
        const response = await fetch('/api/cart/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                items: [], 
                guestId 
            } as CartSyncRequest),
        });
        if (response.ok) {
            return await response.json() as CartSyncResponse;
        }
        return null;
    } catch (error) {
        logger.error('Error getting guest cart:', error);
        return null;
    }
};

// Function to sync cart with server
export const syncCartWithServer = async (changes: any[]): Promise<CartSyncResponse | null> => {
    try {
        const guestId = localStorage.getItem('guestId') || '';
        const response = await fetch('/api/cart/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                items: changes,
                guestId
            } as CartSyncRequest),
        });
        if (response.ok) {
            return await response.json() as CartSyncResponse;
        }
        return null;
    } catch (error) {
        logger.error('Error syncing cart:', error);
        return null;
    }
};

export default redis 