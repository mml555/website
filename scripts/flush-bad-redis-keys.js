const { Redis } = require('@upstash/redis');
require('dotenv').config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function flushBadCategoryKeys() {
  try {
    const keys = await redis.keys('categories:*');
    if (!keys.length) {
      console.log('No bad category cache keys found.');
      return;
    }
    await redis.del(...keys);
    console.log(`Deleted ${keys.length} bad category cache keys.`);
  } catch (error) {
    console.error('Error flushing bad category cache keys:', error);
  }
}

flushBadCategoryKeys(); 