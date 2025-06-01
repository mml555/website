import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

async function flushCategoriesCache() {
  try {
    const keys = await redis.keys('categories:*')
    if (keys.length === 0) {
      console.log('No category cache keys found.')
      return
    }
    await redis.del(...keys)
    console.log(`Deleted ${keys.length} category cache keys.`)
  } catch (error) {
    console.error('Error flushing category cache keys:', error)
  }
}

flushCategoriesCache() 