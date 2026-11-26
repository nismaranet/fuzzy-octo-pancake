import clientPromise from "@/lib/mongodb";
import { redis } from "@/lib/redis";

export type SeasonThemeMode = "none" | "halloween" | "christmas_new_year";

export interface WebConfig {
  owners: {
    developerDiscordId: string;
    nismaraOwnerDiscordId: string;
  };
  discordChannels: {
    generalDriverChannelId: string;
    interviewChannelId: string;
    plusCategoryId: string;
    ticketCategoryId: string;
    registrationCategoryId: string;
    serviceFleetCategoryId: string;
    fleetOrderCategoryId: string;
    communityGoalsCategoryId: string;
    marketChannelId: string;
  };
  discordRoles: {
    driverRoleId: string;
    internRoleId: string;
    managerRoleId: string;
    nismaraPlusRoleId: string;
    lottoRoleId: string;
    marketPingRoleId: string;
    staffHrRoleId: string;
    staffOperationalRoleId: string;
    staffGeneralManagerRoleId: string;
    staffDeputyRoleId: string;
    staffDirectorRoleId: string;
  };
  features: {
    seasonTheme: SeasonThemeMode;
    halloweenTheme: boolean;
    rewind2026: {
      enabled: boolean;
      releaseAt: string;
      musicUrl: string;
    };
  };
}

export const DEFAULT_REWIND_2026_RELEASE_AT = "2026-12-28T00:00:00+07:00";

export const WEB_CONFIG_DB_KEY = "web_config";
const REDIS_KEY = "config:web:v1";
const REDIS_TTL_SECONDS = 300; // 5 menit
const MEM_TTL_MS = 15_000; // 15 detik in-process cache

let memCache: { value: WebConfig; expiresAt: number } | null = null;

function strEnv(key: string, fallback = ""): string {
  return (process.env[key] || fallback).trim();
}

export function getEnvWebConfigDefaults(): WebConfig {
  return {
    owners: {
      developerDiscordId: strEnv("OWNER_DISCORD_ID", "338418945620967434"),
      nismaraOwnerDiscordId: strEnv("NISMARA_OWNER_DISCORD_ID", "560419724249530369"),
    },
    discordChannels: {
      generalDriverChannelId: strEnv("DISCORD_GENERAL_DRIVER_ID_CHANNEL"),
      interviewChannelId: strEnv("DISCORD_INTERVIEW_CHANNEL_ID"),
      plusCategoryId: strEnv("DISCORD_PLUS_CATEGORY_ID"),
      ticketCategoryId: strEnv("DISCORD_TICKET_CATEGORY_ID"),
      registrationCategoryId: strEnv("DISCORD_REGISTRATION_CATEGORY_ID"),
      serviceFleetCategoryId: strEnv("DISCORD_SERVICE_FLEET_CATEGORY_ID"),
      fleetOrderCategoryId: strEnv("DISCORD_FLEET_ORDER_CATEGORY_ID"),
      communityGoalsCategoryId: strEnv("DISCORD_COMMUNITY_GOALS_CATEGORY_ID"),
      marketChannelId: strEnv("DISCORD_MARKET_CHANNEL_ID", "1575451186499289169"),
    },
    discordRoles: {
      driverRoleId: strEnv("DISCORD_DRIVER_ROLE_ID", "1405532668472590437"),
      internRoleId: strEnv("DISCORD_INTERN_ROLE_ID", "1405533443651272804"),
      managerRoleId: strEnv("DISCORD_MANAGER_ROLE_ID", "1406574228794507354"),
      nismaraPlusRoleId: strEnv("DISCORD_NISMARAPLUS_ROLE_ID"),
      lottoRoleId: strEnv("DISCORD_LOTTO_ROLE_ID"),
      marketPingRoleId: strEnv("DISCORD_MARKET_PING_ROLE_ID"),
      staffHrRoleId: strEnv("DISCORD_STAFF_HR_ROLE_ID"),
      staffOperationalRoleId: strEnv("DISCORD_STAFF_OPERATIONAL_ROLE_ID"),
      staffGeneralManagerRoleId: strEnv("DISCORD_STAFF_GENERAL_MANAGER_ROLE_ID"),
      staffDeputyRoleId: strEnv("DISCORD_STAFF_DEPUTY_ROLE_ID"),
      staffDirectorRoleId: strEnv("DISCORD_STAFF_DIRECTOR_ROLE_ID"),
    },
    features: {
      seasonTheme:
        process.env.NEXT_PUBLIC_HALLOWEEN_THEME === "true" ? "halloween" : "none",
      halloweenTheme: process.env.NEXT_PUBLIC_HALLOWEEN_THEME === "true",
      rewind2026: {
        enabled: true,
        releaseAt: DEFAULT_REWIND_2026_RELEASE_AT,
        musicUrl: "",
      },
    },
  };
}

function mergeConfig(stored: any): WebConfig {
  const def = getEnvWebConfigDefaults();
  if (!stored || typeof stored !== "object") return def;

  const pickStr = (val: any, fallback: string) =>
    typeof val === "string" && val.trim().length > 0 ? val.trim() : fallback;

  return {
    owners: {
      developerDiscordId: pickStr(stored.owners?.developerDiscordId, def.owners.developerDiscordId),
      nismaraOwnerDiscordId: pickStr(
        stored.owners?.nismaraOwnerDiscordId,
        def.owners.nismaraOwnerDiscordId
      ),
    },
    discordChannels: {
      generalDriverChannelId: pickStr(
        stored.discordChannels?.generalDriverChannelId,
        def.discordChannels.generalDriverChannelId
      ),
      interviewChannelId: pickStr(
        stored.discordChannels?.interviewChannelId,
        def.discordChannels.interviewChannelId
      ),
      plusCategoryId: pickStr(
        stored.discordChannels?.plusCategoryId,
        def.discordChannels.plusCategoryId
      ),
      ticketCategoryId: pickStr(
        stored.discordChannels?.ticketCategoryId,
        def.discordChannels.ticketCategoryId
      ),
      registrationCategoryId: pickStr(
        stored.discordChannels?.registrationCategoryId,
        def.discordChannels.registrationCategoryId
      ),
      serviceFleetCategoryId: pickStr(
        stored.discordChannels?.serviceFleetCategoryId,
        def.discordChannels.serviceFleetCategoryId
      ),
      fleetOrderCategoryId: pickStr(
        stored.discordChannels?.fleetOrderCategoryId,
        def.discordChannels.fleetOrderCategoryId
      ),
      communityGoalsCategoryId: pickStr(
        stored.discordChannels?.communityGoalsCategoryId,
        def.discordChannels.communityGoalsCategoryId
      ),
      marketChannelId: pickStr(
        stored.discordChannels?.marketChannelId,
        def.discordChannels.marketChannelId
      ),
    },
    discordRoles: {
      driverRoleId: pickStr(stored.discordRoles?.driverRoleId, def.discordRoles.driverRoleId),
      internRoleId: pickStr(stored.discordRoles?.internRoleId, def.discordRoles.internRoleId),
      managerRoleId: pickStr(stored.discordRoles?.managerRoleId, def.discordRoles.managerRoleId),
      nismaraPlusRoleId: pickStr(
        stored.discordRoles?.nismaraPlusRoleId,
        def.discordRoles.nismaraPlusRoleId
      ),
      lottoRoleId: pickStr(stored.discordRoles?.lottoRoleId, def.discordRoles.lottoRoleId),
      marketPingRoleId: pickStr(
        stored.discordRoles?.marketPingRoleId,
        def.discordRoles.marketPingRoleId
      ),
      staffHrRoleId: pickStr(stored.discordRoles?.staffHrRoleId, def.discordRoles.staffHrRoleId),
      staffOperationalRoleId: pickStr(
        stored.discordRoles?.staffOperationalRoleId,
        def.discordRoles.staffOperationalRoleId
      ),
      staffGeneralManagerRoleId: pickStr(
        stored.discordRoles?.staffGeneralManagerRoleId,
        def.discordRoles.staffGeneralManagerRoleId
      ),
      staffDeputyRoleId: pickStr(
        stored.discordRoles?.staffDeputyRoleId,
        def.discordRoles.staffDeputyRoleId
      ),
      staffDirectorRoleId: pickStr(
        stored.discordRoles?.staffDirectorRoleId,
        def.discordRoles.staffDirectorRoleId
      ),
    },
    features: (() => {
      const rawMode = stored.features?.seasonTheme;
      const validMode: SeasonThemeMode | null =
        rawMode === "none" || rawMode === "halloween" || rawMode === "christmas_new_year"
          ? rawMode
          : null;
      const legacyHalloween =
        typeof stored.features?.halloweenTheme === "boolean"
          ? stored.features.halloweenTheme
          : def.features.halloweenTheme;
      const seasonTheme: SeasonThemeMode =
        validMode ?? (legacyHalloween ? "halloween" : "none");
      const rawRewind = stored.features?.rewind2026;
      const rewindEnabled =
        typeof rawRewind?.enabled === "boolean"
          ? rawRewind.enabled
          : def.features.rewind2026.enabled;
      const rewindReleaseAt =
        typeof rawRewind?.releaseAt === "string" &&
        !Number.isNaN(new Date(rawRewind.releaseAt).getTime())
          ? rawRewind.releaseAt.trim()
          : def.features.rewind2026.releaseAt;
      const rewindMusicUrl =
        typeof rawRewind?.musicUrl === "string" ? rawRewind.musicUrl.trim() : "";

      return {
        seasonTheme,
        halloweenTheme: seasonTheme === "halloween",
        rewind2026: {
          enabled: rewindEnabled,
          releaseAt: rewindReleaseAt,
          musicUrl: rewindMusicUrl,
        },
      };
    })(),
  };
}

/**
 * Mengambil konfigurasi non-rahasia website (Channel ID, Role ID, Owner IDs, Feature Flags).
 * Urutan baca: In-memory (15d) -> Redis (5m) -> MongoDB `systemsettings` -> fallback `process.env`.
 */
export async function getWebConfig(forceRefresh = false): Promise<WebConfig> {
  const now = Date.now();
  if (!forceRefresh && memCache && memCache.expiresAt > now) {
    return memCache.value;
  }

  const hasRedis = Boolean(process.env.REDIS_URL?.trim());
  const hasMongo = Boolean(process.env.MONGODB_URI?.trim());

  // Build-time (Docker/CI) tanpa koneksi DB/Redis: langsung kembalikan default env dalam 0ms
  if (!hasRedis && !hasMongo) {
    return getEnvWebConfigDefaults();
  }

  if (!forceRefresh && hasRedis) {
    try {
      const cached = await redis.get(REDIS_KEY);
      if (cached) {
        const parsed = mergeConfig(JSON.parse(cached));
        memCache = { value: parsed, expiresAt: now + MEM_TTL_MS };
        return parsed;
      }
    } catch {
      // Fallback ke MongoDB jika Redis unavailable
    }
  }

  if (!hasMongo) {
    return getEnvWebConfigDefaults();
  }

  try {
    const client = await clientPromise;
    const doc = await client
      .db()
      .collection("systemsettings")
      .findOne({ key: WEB_CONFIG_DB_KEY });

    const merged = mergeConfig(doc?.value);
    memCache = { value: merged, expiresAt: now + MEM_TTL_MS };
    if (hasRedis) {
      await redis.set(REDIS_KEY, JSON.stringify(merged), "EX", REDIS_TTL_SECONDS).catch(() => null);
    }
    return merged;
  } catch {
    return getEnvWebConfigDefaults();
  }
}

export async function invalidateWebConfigCache(): Promise<void> {
  memCache = null;
  if (process.env.REDIS_URL?.trim()) {
    await redis.del(REDIS_KEY).catch(() => null);
  }
}

/**
 * Mengecek apakah Discord ID adalah Developer Owner ATAU Nismara Owner.
 * Selalu menyertakan fallback `.env` agar Owner tidak mungkin terkunci keluar jika salah ketik di UI.
 */
export async function isWebOwner(discordId?: string | number | null): Promise<boolean> {
  if (!discordId) return false;
  const id = String(discordId).trim();
  if (!id) return false;

  // Bootstrap fallback dari .env (anti-lockout)
  const envDev = process.env.OWNER_DISCORD_ID?.trim();
  const envOwner = process.env.NISMARA_OWNER_DISCORD_ID?.trim();
  if (id === envDev || id === envOwner) return true;

  const cfg = await getWebConfig();
  return id === cfg.owners.developerDiscordId || id === cfg.owners.nismaraOwnerDiscordId;
}

export async function getOwnerDiscordIds(): Promise<string[]> {
  const cfg = await getWebConfig();
  return Array.from(
    new Set(
      [cfg.owners.developerDiscordId, cfg.owners.nismaraOwnerDiscordId].filter(
        (id): id is string => Boolean(id && id.trim())
      )
    )
  );
}

/**
 * Mengecek apakah Miles of Memories (Rewind 2026) sudah resmi terbuka untuk publik (WIB).
 */
export function isRewind2026PubliclyLive(cfg: WebConfig, now = new Date()): boolean {
  if (!cfg.features.rewind2026?.enabled) return false;
  const releaseTime = new Date(
    cfg.features.rewind2026.releaseAt || DEFAULT_REWIND_2026_RELEASE_AT
  ).getTime();
  if (Number.isNaN(releaseTime)) return false;
  return now.getTime() >= releaseTime;
}
