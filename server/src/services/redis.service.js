import Redis from "ioredis";

let redisClient;

export const getRedisClient = () => redisClient;

export const initRedis = async () => {
  if (!process.env.REDIS_URL) {
    console.warn("REDIS_URL missing. Presence tracking disabled."); // NOSONAR
    return null;
  }

  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false
  });

  redisClient.on("connect", () => console.log("Redis connected")); // NOSONAR
  redisClient.on("error", (err) => console.error("Redis error:", err.message)); // NOSONAR

  return redisClient;
};
