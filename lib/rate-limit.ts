import { LRUCache } from "lru-cache"

export class RateLimit {
  private cache: LRUCache<string, number[]>
  private interval: number

  constructor(options: { interval: number; uniqueTokenPerInterval: number }) {
    this.interval = options.interval
    this.cache = new LRUCache({
      max: options.uniqueTokenPerInterval,
      ttl: options.interval
    })
  }

  async check(limit: number, token: string): Promise<void> {
    const now = Date.now()
    const tokenCount = this.cache.get(token) || []
    const windowStart = now - this.interval

    // Remove old timestamps
    const validTokens = tokenCount.filter(timestamp => timestamp > windowStart)
    
    if (validTokens.length >= limit) {
      throw new Error('Rate limit exceeded')
    }

    validTokens.push(now)
    this.cache.set(token, validTokens)
  }
}

export const rateLimit = (options: { interval: number; uniqueTokenPerInterval: number }) => {
  return new RateLimit(options)
} 