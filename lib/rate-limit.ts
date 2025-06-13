import { LRUCache } from "lru-cache"
import { logger } from './logger'
import { monitoring } from './monitoring'

interface RateLimitConfig {
  interval: number;
  uniqueTokenPerInterval: number;
}

interface TokenCount {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private cache: LRUCache<string, TokenCount>;
  private interval: number;

  constructor(config: RateLimitConfig) {
    this.interval = config.interval;
    this.cache = new LRUCache({
      max: config.uniqueTokenPerInterval,
      ttl: config.interval
    });
  }

  async check(limit: number, token: string): Promise<void> {
    return monitoring.measureAsync('rate_limit_check', async () => {
      const now = Date.now();
      const tokenCount = this.cache.get(token) || { count: 0, resetTime: now + this.interval };

      // Reset if interval has passed
      if (now > tokenCount.resetTime) {
        tokenCount.count = 0;
        tokenCount.resetTime = now + this.interval;
      }

      // Increment count
      tokenCount.count += 1;

      // Store the updated count
      this.cache.set(token, tokenCount);

      // Check if limit is exceeded
      if (tokenCount.count > limit) {
        logger.warn('Rate limit exceeded', { token, limit: limit.toString(), count: tokenCount.count.toString() });
        throw new Error('Rate limit exceeded');
      }

      logger.debug('Rate limit check passed', { token, limit: limit.toString(), count: tokenCount.count.toString() });
    }, { token, limit: limit.toString() });
  }

  async reset(token: string): Promise<void> {
    this.cache.delete(token);
    logger.debug('Rate limit reset', { token });
  }
}

// Create a singleton instance with default configuration
export const rateLimit = new RateLimiter({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
}); 