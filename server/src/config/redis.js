import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let redisClient = null;
let redisMockMode = false;

// Memory fallback for Redis if it's down
const memoryStore = new Map();
const mockRedis = {
  get: async (key) => memoryStore.get(key) || null,
  set: async (key, val, ex, ttlSec) => {
    memoryStore.set(key, val);
    if (ex === 'EX' && typeof ttlSec === 'number') {
      setTimeout(() => memoryStore.delete(key), ttlSec * 1000);
    }
    return 'OK';
  },
  del: async (key) => {
    const deleted = memoryStore.delete(key);
    return deleted ? 1 : 0;
  },
  keys: async (pattern) => {
    const regexStr = pattern.replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexStr}$`);
    return Array.from(memoryStore.keys()).filter(k => regex.test(k));
  },
  status: 'ready',
  on: (event, callback) => {
    if (event === 'connect' || event === 'ready') {
      setTimeout(callback, 50);
    }
    return mockRedis;
  }
};

export function connectRedis() {
  if (redisClient) return redisClient;

  try {
    const client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      connectTimeout: 1000,
      retryStrategy: () => null,
      showFriendlyErrorStack: true
    });

    client.on('error', (err) => {
      if (!redisMockMode) {
        console.error('❌ Redis Connection Error:', err.message);
        console.log('⚠️ Falling back to Redis Mock Mode (In-memory cache) for smooth run!');
        redisMockMode = true;
        redisClient = mockRedis;
      }
    });

    client.on('connect', () => {
      console.log('✔ Redis connected successfully to', REDIS_URL);
    });

    redisClient = client;
  } catch (error) {
    console.error('❌ Redis initialization failed:', error.message);
    redisMockMode = true;
    redisClient = mockRedis;
  }

  return redisClient;
}

export function getRedisClient() {
  if (!redisClient) {
    return connectRedis();
  }
  return redisClient;
}
