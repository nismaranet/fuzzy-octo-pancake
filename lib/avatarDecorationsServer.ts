import dbConnect from "@/lib/mongoose";
import AvatarDecoration from "@/lib/models/AvatarDecoration";
import { redis } from "@/lib/redis";
import {
  STARTER_AVATAR_DECORATIONS,
  type AvatarDecorationDef,
} from "@/lib/avatarDecorations";

export const AVATAR_DECORATIONS_CACHE_KEY = "catalog:avatar_decorations_v1";
const CACHE_TTL_SECONDS = 600; // 10 menit (selalu di-invalidate saat mutasi CMS)

export function serializeAvatarDecoration(doc: any): AvatarDecorationDef {
  return {
    id: String(doc.slug || doc.id || ""),
    _id: doc._id ? String(doc._id) : undefined,
    name: String(doc.name || "Dekorasi"),
    description: String(doc.description || ""),
    category: doc.category || "signature",
    rarity: doc.rarity || "exclusive",
    access: doc.access || "nismara_plus",
    renderType: doc.renderType === "svg" ? "svg" : "image",
    svgPresetKey: doc.svgPresetKey || null,
    assetUrl: doc.assetUrl || null,
    scale:
      typeof doc.scale === "number" && Number.isFinite(doc.scale)
        ? Math.min(1.6, Math.max(1.0, doc.scale))
        : 1.28,
    accentColor: String(doc.accentColor || "#8b5cf6"),
    isActive: doc.isActive !== false,
    sortOrder: Number(doc.sortOrder ?? 100),
    availableFrom: doc.availableFrom
      ? new Date(doc.availableFrom).toISOString()
      : null,
    availableUntil: doc.availableUntil
      ? new Date(doc.availableUntil).toISOString()
      : null,
  };
}

export async function invalidateAvatarDecorationsCache(): Promise<void> {
  try {
    if (process.env.REDIS_URL?.trim()) {
      await redis.del(AVATAR_DECORATIONS_CACHE_KEY);
    }
  } catch (err) {
    console.error("[AvatarDecorations] Failed to invalidate Redis cache:", err);
  }
}

/**
 * Mengambil seluruh katalog dekorasi dari MongoDB (dengan Redis cache untuk tampilan publik).
 * Jika koleksi DB masih kosong, fallback ke 6 starter SVG bawaan agar fitur tetap langsung berjalan.
 */
export async function getAvatarDecorationsCatalog(options?: {
  includeInactive?: boolean;
  bypassCache?: boolean;
}): Promise<{ items: AvatarDecorationDef[]; isSeeded: boolean }> {
  const includeInactive = Boolean(options?.includeInactive);
  const bypassCache = Boolean(options?.bypassCache);

  if (!includeInactive && !bypassCache && process.env.REDIS_URL?.trim()) {
    try {
      const cached = await redis.get(AVATAR_DECORATIONS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.items)) {
          return parsed;
        }
      }
    } catch {
      // fallback to DB
    }
  }

  await dbConnect();
  const totalCount = await AvatarDecoration.countDocuments({});

  if (totalCount === 0) {
    const fallbackItems = includeInactive
      ? STARTER_AVATAR_DECORATIONS
      : STARTER_AVATAR_DECORATIONS.filter((d) => d.isActive);
    return { items: fallbackItems, isSeeded: false };
  }

  const filter = includeInactive ? {} : { isActive: true };
  const rawDocs = await AvatarDecoration.find(filter)
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  const items = rawDocs.map(serializeAvatarDecoration);
  const result = { items, isSeeded: true };

  if (!includeInactive && process.env.REDIS_URL?.trim()) {
    try {
      await redis.setex(
        AVATAR_DECORATIONS_CACHE_KEY,
        CACHE_TTL_SECONDS,
        JSON.stringify(result),
      );
    } catch {
      // non-fatal
    }
  }

  return result;
}

export async function getAvatarDecorationCatalogMap(): Promise<
  Map<string, AvatarDecorationDef>
> {
  const { items } = await getAvatarDecorationsCatalog({ includeInactive: false });
  return new Map(items.map((d) => [d.id, d]));
}
