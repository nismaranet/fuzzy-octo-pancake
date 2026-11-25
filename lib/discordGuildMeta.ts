import { redis } from "@/lib/redis";

export interface DiscordCategoryItem {
  id: string;
  name: string;
  position: number;
}

export interface DiscordTextChannelItem {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
  parentName: string | null;
  position: number;
}

export interface DiscordRoleItem {
  id: string;
  name: string;
  colorHex: string | null;
  position: number;
  managed: boolean;
}

export interface DiscordGuildMeta {
  ok: boolean;
  error?: string;
  guildId: string;
  categories: DiscordCategoryItem[];
  textChannels: DiscordTextChannelItem[];
  roles: DiscordRoleItem[];
  fetchedAt: string | null;
}

const REDIS_TTL_SECONDS = 300; // 5 menit

function getCacheKey(guildId: string) {
  return `discord:guild-meta:v1:${guildId}`;
}

export async function getDiscordGuildMeta(forceRefresh = false): Promise<DiscordGuildMeta> {
  const guildId = (process.env.DISCORD_GUILD_ID || "863959415702028318").trim();
  const botToken = process.env.DISCORD_BOT_TOKEN?.trim();

  if (!botToken || !guildId) {
    return {
      ok: false,
      error: "DISCORD_BOT_TOKEN atau DISCORD_GUILD_ID belum terkonfigurasi.",
      guildId,
      categories: [],
      textChannels: [],
      roles: [],
      fetchedAt: null,
    };
  }

  const cacheKey = getCacheKey(guildId);

  if (!forceRefresh) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as DiscordGuildMeta;
        if (parsed && parsed.ok) return parsed;
      }
    } catch {
      // Fallback ke Discord API langsung jika Redis bermasalah
    }
  }

  try {
    const headers = {
      Authorization: `Bot ${botToken}`,
    };

    const [channelsRes, rolesRes] = await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        headers,
        cache: "no-store",
      }),
      fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
        headers,
        cache: "no-store",
      }),
    ]);

    if (!channelsRes.ok || !rolesRes.ok) {
      const errDetail = `channels:${channelsRes.status}, roles:${rolesRes.status}`;
      return {
        ok: false,
        error: `Gagal mengambil data dari Discord API (${errDetail}). Input manual ID tetap bisa digunakan.`,
        guildId,
        categories: [],
        textChannels: [],
        roles: [],
        fetchedAt: null,
      };
    }

    const [rawChannels, rawRoles] = await Promise.all([
      channelsRes.json(),
      rolesRes.json(),
    ]);

    const channelsArr = Array.isArray(rawChannels) ? rawChannels : [];
    const rolesArr = Array.isArray(rawRoles) ? rawRoles : [];

    // Category channels: type === 4
    const categories: DiscordCategoryItem[] = channelsArr
      .filter((c: any) => c && c.type === 4 && c.id)
      .map((c: any) => ({
        id: String(c.id),
        name: String(c.name || "Tanpa Nama"),
        position: Number(c.position || 0),
      }))
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

    const categoryMap = new Map<string, DiscordCategoryItem>(
      categories.map((cat) => [cat.id, cat])
    );

    // Text (0) & Announcement (5) channels
    const textChannels: DiscordTextChannelItem[] = channelsArr
      .filter((c: any) => c && (c.type === 0 || c.type === 5) && c.id)
      .map((c: any) => {
        const parentId = c.parent_id ? String(c.parent_id) : null;
        return {
          id: String(c.id),
          name: String(c.name || "tanpa-nama"),
          type: Number(c.type),
          parentId,
          parentName: parentId ? categoryMap.get(parentId)?.name || null : null,
          position: Number(c.position || 0),
        };
      })
      .sort((a, b) => {
        const parentPosA = a.parentId ? (categoryMap.get(a.parentId)?.position ?? 9999) : -1;
        const parentPosB = b.parentId ? (categoryMap.get(b.parentId)?.position ?? 9999) : -1;
        if (parentPosA !== parentPosB) return parentPosA - parentPosB;
        return a.position - b.position || a.name.localeCompare(b.name);
      });

    // Guild roles (exclude @everyone where id === guildId)
    const roles: DiscordRoleItem[] = rolesArr
      .filter((r: any) => r && r.id && String(r.id) !== guildId)
      .map((r: any) => ({
        id: String(r.id),
        name: String(r.name || "Tanpa Nama"),
        colorHex:
          typeof r.color === "number" && r.color > 0
            ? `#${r.color.toString(16).padStart(6, "0")}`
            : null,
        position: Number(r.position || 0),
        managed: Boolean(r.managed),
      }))
      .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));

    const result: DiscordGuildMeta = {
      ok: true,
      guildId,
      categories,
      textChannels,
      roles,
      fetchedAt: new Date().toISOString(),
    };

    await redis.set(cacheKey, JSON.stringify(result), "EX", REDIS_TTL_SECONDS).catch(() => null);
    return result;
  } catch (err: any) {
    console.error("[getDiscordGuildMeta] Error:", err);
    return {
      ok: false,
      error: "Koneksi ke Discord API gagal. Input manual ID tetap bisa digunakan.",
      guildId,
      categories: [],
      textChannels: [],
      roles: [],
      fetchedAt: null,
    };
  }
}
