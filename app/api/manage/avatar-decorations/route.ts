import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import AvatarDecoration from "@/lib/models/AvatarDecoration";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import { parseWIBDate, slugify } from "@/lib/utils";
import {
  SVG_DECORATION_PRESETS,
  type AvatarDecorationAccess,
  type AvatarDecorationCategory,
  type AvatarDecorationRarity,
} from "@/lib/avatarDecorations";
import {
  getAvatarDecorationsCatalog,
  invalidateAvatarDecorationsCache,
  serializeAvatarDecoration,
} from "@/lib/avatarDecorationsServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const VALID_CATEGORIES = new Set<AvatarDecorationCategory>([
  "signature",
  "automotive",
  "aesthetic",
  "cosmic",
  "event",
  "staff",
]);
const VALID_RARITIES = new Set<AvatarDecorationRarity>([
  "common",
  "exclusive",
  "epic",
  "legendary",
  "seasonal",
]);
const VALID_ACCESS = new Set<AvatarDecorationAccess>([
  "free",
  "nismara_plus",
  "event",
  "staff",
  "top_manager",
]);
const VALID_PRESETS = new Set(SVG_DECORATION_PRESETS.map((p) => p.key));

export function parseDecorationPayload(body: any) {
  const name = String(body?.name || "").trim();
  if (!name || name.length > 100) {
    throw new Error("Nama dekorasi wajib diisi (maksimal 100 karakter).");
  }

  const rawSlug = String(body?.slug || body?.id || name).trim();
  const slug = slugify(rawSlug).slice(0, 80);
  if (!slug || slug.length < 2) {
    throw new Error("Slug dekorasi tidak valid (minimal 2 karakter huruf/angka).");
  }

  const description = String(body?.description || "").trim().slice(0, 300);
  const category = VALID_CATEGORIES.has(body?.category)
    ? (body.category as AvatarDecorationCategory)
    : "signature";
  const rarity = VALID_RARITIES.has(body?.rarity)
    ? (body.rarity as AvatarDecorationRarity)
    : "exclusive";
  const access = VALID_ACCESS.has(body?.access)
    ? (body.access as AvatarDecorationAccess)
    : "nismara_plus";

  const renderType: "svg" | "image" = body?.renderType === "svg" ? "svg" : "image";
  let svgPresetKey: string | null = null;
  let assetUrl: string | null = null;

  if (renderType === "svg") {
    const preset = String(body?.svgPresetKey || "").trim();
    if (!VALID_PRESETS.has(preset)) {
      throw new Error("Preset SVG bawaan tidak valid.");
    }
    svgPresetKey = preset;
  } else {
    const url = String(body?.assetUrl || "").trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new Error("URL gambar dekorasi (GIF / PNG / WebP) wajib diisi.");
    }
    assetUrl = url;
  }

  const rawScale = Number(body?.scale ?? 1.28);
  const scale = Number.isFinite(rawScale)
    ? Math.min(1.6, Math.max(1.0, Math.round(rawScale * 100) / 100))
    : 1.28;

  const accentColor = String(body?.accentColor || "#8b5cf6").trim().slice(0, 32);
  const isActive = body?.isActive !== false;
  const sortOrder = Math.max(0, Math.round(Number(body?.sortOrder ?? 100) || 0));

  let availableFrom: Date | null = null;
  let availableUntil: Date | null = null;

  if (body?.availableFrom && String(body.availableFrom).trim() !== "") {
    availableFrom = parseWIBDate(body.availableFrom, false);
  }
  if (body?.availableUntil && String(body.availableUntil).trim() !== "") {
    availableUntil = parseWIBDate(body.availableUntil, true);
  }
  if (availableFrom && availableUntil && availableUntil <= availableFrom) {
    throw new Error("Tanggal berakhir harus lebih besar dari tanggal mulai.");
  }

  return {
    slug,
    name,
    description,
    category,
    rarity,
    access,
    renderType,
    svgPresetKey,
    assetUrl,
    scale,
    accentColor,
    isActive,
    sortOrder,
    availableFrom,
    availableUntil,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const isManager =
      session?.user?.role === "manager" || session?.user?.role === "admin";
    if (!session?.user?.discordId || !isManager) {
      return jsonNoCache(
        { success: false, error: "Akses ditolak. Khusus Manager & Admin." },
        { status: 403 },
      );
    }

    const { items, isSeeded } = await getAvatarDecorationsCatalog({
      includeInactive: true,
      bypassCache: true,
    });

    return jsonNoCache({
      success: true,
      isSeeded,
      items: isSeeded ? items : [],
      starterCount: 6,
    });
  } catch (err: any) {
    console.error("[GET /api/manage/avatar-decorations] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memuat katalog dekorasi." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const isManager =
      session?.user?.role === "manager" || session?.user?.role === "admin";
    if (!session?.user?.discordId || !isManager) {
      return jsonNoCache(
        { success: false, error: "Akses ditolak. Khusus Manager & Admin." },
        { status: 403 },
      );
    }

    const discordId = String(session.user.discordId);
    if (!checkRateLimit(discordId, "manage-avatar-deco-create", 1500)) {
      return jsonNoCache(
        { success: false, error: "Terlalu banyak permintaan. Coba sebentar lagi." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = parseDecorationPayload(body);

    await dbConnect();
    const exists = await AvatarDecoration.findOne({ slug: parsed.slug }).lean();
    if (exists) {
      return jsonNoCache(
        {
          success: false,
          error: `Slug "${parsed.slug}" sudah dipakai. Gunakan nama atau slug lain.`,
        },
        { status: 409 },
      );
    }

    const created = await AvatarDecoration.create({
      ...parsed,
      authorDiscordId: discordId,
      updatedByDiscordId: discordId,
    });

    await invalidateAvatarDecorationsCache();
    try {
      revalidatePath("/dashboard/manage/data/avatar-decorations");
      revalidatePath("/dashboard/settings");
      revalidatePath("/profile/[truckyId]", "page");
      revalidatePath("/currency-boost/[slug]", "page");
    } catch {
      // non-fatal
    }

    return jsonNoCache(
      {
        success: true,
        item: serializeAvatarDecoration(created.toObject()),
        message: "Dekorasi avatar berhasil ditambahkan.",
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("[POST /api/manage/avatar-decorations] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal menyimpan dekorasi avatar." },
      { status: 400 },
    );
  }
}
