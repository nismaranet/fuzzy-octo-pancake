import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    // Saat build time (Docker/CI) tanpa REDIS_URL: cegah koneksi TCP ke localhost & reject instan tanpa hang
    const client = new Redis({
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    client.on("error", () => {});
    return client;
  }

  const client = new Redis(redisUrl);
  client.on("error", (err) => {
    console.warn("[Redis] Connection error:", err?.message || err);
  });
  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

