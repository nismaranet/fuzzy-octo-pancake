import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    // Gunakan lazyConnect saat build time agar `next build` tidak mencoba membuka koneksi Redis ke localhost
    return new Redis({ lazyConnect: true, maxRetriesPerRequest: null });
  }

  return new Redis(redisUrl);
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

