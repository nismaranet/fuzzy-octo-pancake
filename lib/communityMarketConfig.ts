import dbConnect from "@/lib/mongoose";
import SystemSetting from "@/lib/models/SystemSetting";
import { redis } from "@/lib/redis";
import {
  type CommunityMarketConfig,
  sanitizeCommunityMarketConfig,
} from "@/lib/communityMarketShared";

export * from "@/lib/communityMarketShared";

export const COMMUNITY_MARKET_CONFIG_KEY = "community_market_config";
const CONFIG_REDIS_KEY = "cm:config:v1";
const CONFIG_REDIS_TTL = 60;

export async function getCommunityMarketConfig(bypassCache = false): Promise<CommunityMarketConfig> {
  if (!bypassCache) {
    try {
      const cached = await redis.get(CONFIG_REDIS_KEY);
      if (cached) {
        return sanitizeCommunityMarketConfig(JSON.parse(cached));
      }
    } catch {
      // Fallback to MongoDB
    }
  }

  await dbConnect();
  const doc = await SystemSetting.findOne({ key: COMMUNITY_MARKET_CONFIG_KEY }).lean();
  const config = sanitizeCommunityMarketConfig(doc?.value);

  try {
    await redis.set(CONFIG_REDIS_KEY, JSON.stringify(config), "EX", CONFIG_REDIS_TTL);
  } catch {
    // Non-fatal
  }

  return config;
}

export async function saveCommunityMarketConfig(
  input: any,
  updatedBy: string
): Promise<CommunityMarketConfig> {
  await dbConnect();
  const sanitized = sanitizeCommunityMarketConfig(input);

  await SystemSetting.findOneAndUpdate(
    { key: COMMUNITY_MARKET_CONFIG_KEY },
    {
      $set: {
        value: sanitized,
        description: "Konfigurasi ekonomi, pajak, durasi iklan, dan rentang harga Community Market",
        updatedBy,
      },
    },
    { upsert: true, new: true }
  );

  try {
    await redis.del(CONFIG_REDIS_KEY);
  } catch {
    // Non-fatal
  }

  return sanitized;
}
