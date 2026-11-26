export type AvatarDecorationAccess =
  | "free"
  | "nismara_plus"
  | "event"
  | "staff"
  | "top_manager";

export type AvatarDecorationRarity =
  | "common"
  | "exclusive"
  | "epic"
  | "legendary"
  | "seasonal";

export type AvatarDecorationCategory =
  | "signature"
  | "automotive"
  | "aesthetic"
  | "cosmic"
  | "event"
  | "staff";

export interface AvatarDecorationDef {
  id: string; // slug unik
  _id?: string;
  name: string;
  description: string;
  category: AvatarDecorationCategory;
  rarity: AvatarDecorationRarity;
  access: AvatarDecorationAccess;
  renderType: "svg" | "image";
  svgPresetKey?: string | null;
  assetUrl?: string | null;
  scale: number;
  accentColor: string;
  isActive: boolean;
  sortOrder: number;
  availableFrom?: string | null; // ISO string
  availableUntil?: string | null; // ISO string
}

export const AVATAR_DECORATION_ACCESS_OPTIONS: Array<{
  id: AvatarDecorationAccess;
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
}> = [
  {
    id: "free",
    label: "Gratis (Semua Driver)",
    shortLabel: "Gratis",
    description: "Bisa dipakai semua driver, opsional dengan batas waktu (misal Anniversary).",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  {
    id: "nismara_plus",
    label: "Khusus Nismara+",
    shortLabel: "Nismara+",
    description: "Hanya untuk driver dengan langganan Nismara+ aktif.",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  {
    id: "event",
    label: "Event / Perayaan",
    shortLabel: "Event",
    description: "Dekorasi khusus event komunitas atau perayaan berbatas waktu.",
    badgeClass: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  },
  {
    id: "staff",
    label: "Khusus Staff",
    shortLabel: "Staff",
    description: "Hanya dapat dipakai oleh Manager & Admin Nismara Transport.",
    badgeClass: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  },
  {
    id: "top_manager",
    label: "Khusus Top Manager",
    shortLabel: "Top Manager",
    description: "Eksklusif untuk pemegang titel Top Manager aktif.",
    badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  },
];

export const AVATAR_DECORATION_ACCESS_MAP: Record<
  AvatarDecorationAccess,
  (typeof AVATAR_DECORATION_ACCESS_OPTIONS)[number]
> = AVATAR_DECORATION_ACCESS_OPTIONS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<
    AvatarDecorationAccess,
    (typeof AVATAR_DECORATION_ACCESS_OPTIONS)[number]
  >,
);

export const AVATAR_DECORATION_CATEGORIES: Array<{
  id: "all" | AvatarDecorationCategory;
  label: string;
}> = [
  { id: "all", label: "Semua" },
  { id: "signature", label: "Signature" },
  { id: "automotive", label: "Otomotif" },
  { id: "aesthetic", label: "Estetik" },
  { id: "cosmic", label: "Kosmik" },
  { id: "event", label: "Event" },
  { id: "staff", label: "Staff" },
];

export const AVATAR_DECORATION_RARITY_STYLES: Record<
  AvatarDecorationRarity,
  { label: string; badgeClass: string }
> = {
  common: {
    label: "Standard",
    badgeClass: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  },
  exclusive: {
    label: "Exclusive",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  epic: {
    label: "Epic",
    badgeClass: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  },
  legendary: {
    label: "Legendary",
    badgeClass: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  },
  seasonal: {
    label: "Limited",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
};

export const SVG_DECORATION_PRESETS: Array<{ key: string; label: string }> = [
  { key: "nismara-aurora", label: "Nismara Aurora (Orbital Violet-Sky)" },
  { key: "golden-laurel", label: "Mahkota Emas (Laurel & Crown)" },
  { key: "highway-tachometer", label: "RPM Redline (Takometer Otomotif)" },
  { key: "sakura-breeze", label: "Angin Sakura (Bunga & Kelopak)" },
  { key: "cyber-prism", label: "Prisma HUD (Ring Futuristik)" },
  { key: "solar-eclipse", label: "Gerhana Surya (Korona Api Emas)" },
];

/**
 * 6 Dekorasi Bawaan (Starter Seed untuk CMS MongoDB dan fallback jika DB masih kosong).
 */
export const STARTER_AVATAR_DECORATIONS: AvatarDecorationDef[] = [
  {
    id: "nismara-aurora",
    name: "Nismara Aurora",
    description:
      "Pita cahaya violet dan biru langit yang mengorbit halus di sekeliling avatar.",
    category: "signature",
    rarity: "exclusive",
    access: "nismara_plus",
    renderType: "svg",
    svgPresetKey: "nismara-aurora",
    assetUrl: null,
    scale: 1.28,
    accentColor: "#8b5cf6",
    isActive: true,
    sortOrder: 1,
    availableFrom: null,
    availableUntil: null,
  },
  {
    id: "golden-laurel",
    name: "Mahkota Emas",
    description:
      "Rangkaian daun laurel emas sampanye dengan emblem mahkota minimalis di puncak.",
    category: "staff",
    rarity: "legendary",
    access: "top_manager",
    renderType: "svg",
    svgPresetKey: "golden-laurel",
    assetUrl: null,
    scale: 1.3,
    accentColor: "#f59e0b",
    isActive: true,
    sortOrder: 2,
    availableFrom: null,
    availableUntil: null,
  },
  {
    id: "highway-tachometer",
    name: "RPM Redline",
    description:
      "Ring takometer kabin dengan skala RPM presisi dan zona redline menyala.",
    category: "automotive",
    rarity: "epic",
    access: "nismara_plus",
    renderType: "svg",
    svgPresetKey: "highway-tachometer",
    assetUrl: null,
    scale: 1.28,
    accentColor: "#ef4444",
    isActive: true,
    sortOrder: 3,
    availableFrom: null,
    availableUntil: null,
  },
  {
    id: "sakura-breeze",
    name: "Angin Sakura",
    description:
      "Bingkai merah muda lembut dengan kelopak bunga sakura yang melayang tenang.",
    category: "aesthetic",
    rarity: "epic",
    access: "nismara_plus",
    renderType: "svg",
    svgPresetKey: "sakura-breeze",
    assetUrl: null,
    scale: 1.3,
    accentColor: "#f472b6",
    isActive: true,
    sortOrder: 4,
    availableFrom: null,
    availableUntil: null,
  },
  {
    id: "cyber-prism",
    name: "Prisma HUD",
    description:
      "Bingkai instrumen futuristik berputar ganda dengan aksen cyan dan magenta.",
    category: "cosmic",
    rarity: "epic",
    access: "staff",
    renderType: "svg",
    svgPresetKey: "cyber-prism",
    assetUrl: null,
    scale: 1.28,
    accentColor: "#06b6d4",
    isActive: true,
    sortOrder: 5,
    availableFrom: null,
    availableUntil: null,
  },
  {
    id: "solar-eclipse",
    name: "Gerhana Surya",
    description:
      "Lingkaran korona gelap dengan pijar api keemasan dan percikan bintang.",
    category: "cosmic",
    rarity: "legendary",
    access: "nismara_plus",
    renderType: "svg",
    svgPresetKey: "solar-eclipse",
    assetUrl: null,
    scale: 1.3,
    accentColor: "#fb923c",
    isActive: true,
    sortOrder: 6,
    availableFrom: null,
    availableUntil: null,
  },
];

// Alias backward-compatible
export const AVATAR_DECORATIONS = STARTER_AVATAR_DECORATIONS;

const STARTER_MAP = new Map<string, AvatarDecorationDef>(
  STARTER_AVATAR_DECORATIONS.map((d) => [d.id, d]),
);

export function getStarterDecorationById(
  id?: string | null,
): AvatarDecorationDef | null {
  if (!id || typeof id !== "string") return null;
  return STARTER_MAP.get(id.trim()) || null;
}

export interface DecorationEligibilityContext {
  isNismaraPlus?: boolean;
  isStaff?: boolean;
  isTopManager?: boolean;
  ownedDecorationIds?: string[];
}

export interface DecorationScheduleStatus {
  state: "permanent" | "scheduled" | "active" | "expired";
  withinWindow: boolean;
}

export function getDecorationScheduleStatus(
  def: Pick<AvatarDecorationDef, "availableFrom" | "availableUntil">,
  now: Date = new Date(),
): DecorationScheduleStatus {
  const from = def.availableFrom ? new Date(def.availableFrom) : null;
  const until = def.availableUntil ? new Date(def.availableUntil) : null;

  const validFrom = from && !isNaN(from.getTime()) ? from : null;
  const validUntil = until && !isNaN(until.getTime()) ? until : null;

  if (!validFrom && !validUntil) {
    return { state: "permanent", withinWindow: true };
  }
  if (validFrom && now < validFrom) {
    return { state: "scheduled", withinWindow: false };
  }
  if (validUntil && now > validUntil) {
    return { state: "expired", withinWindow: false };
  }
  return { state: "active", withinWindow: true };
}

export function isUserTopManagerActive(
  topManager?: { status?: boolean; expiredAt?: string | Date | null } | null,
  now: Date = new Date(),
): boolean {
  if (!topManager || topManager.status !== true) return false;
  if (!topManager.expiredAt) return true;
  const exp = new Date(topManager.expiredAt);
  return !isNaN(exp.getTime()) && exp > now;
}

export function isUserStaffRole(role?: string | null): boolean {
  const r = String(role || "").toLowerCase();
  return r === "manager" || r === "admin";
}

export interface DecorationEligibilityResult {
  allowed: boolean;
  reason?: string;
}

export function checkDecorationEligibility(
  def: AvatarDecorationDef | null | undefined,
  ctx: DecorationEligibilityContext,
  now: Date = new Date(),
): DecorationEligibilityResult {
  if (!def) {
    return { allowed: false, reason: "Dekorasi tidak ditemukan." };
  }
  if (!def.isActive) {
    return { allowed: false, reason: "Dekorasi sedang dinonaktifkan." };
  }

  const schedule = getDecorationScheduleStatus(def, now);
  if (!schedule.withinWindow) {
    return {
      allowed: false,
      reason:
        schedule.state === "scheduled"
          ? "Periode dekorasi ini belum dimulai."
          : "Periode waktu dekorasi ini telah berakhir.",
    };
  }

  if (Array.isArray(ctx.ownedDecorationIds) && ctx.ownedDecorationIds.includes(def.id)) {
    return { allowed: true };
  }

  switch (def.access) {
    case "free":
    case "event":
      return { allowed: true };
    case "nismara_plus":
      return ctx.isNismaraPlus
        ? { allowed: true }
        : { allowed: false, reason: "Khusus member Nismara+ aktif." };
    case "staff":
      return ctx.isStaff
        ? { allowed: true }
        : { allowed: false, reason: "Khusus Staff Manajemen (Manager/Admin)." };
    case "top_manager":
      return ctx.isTopManager
        ? { allowed: true }
        : { allowed: false, reason: "Eksklusif untuk pemegang titel Top Manager aktif." };
    default:
      return { allowed: false, reason: "Akses tidak dikenali." };
  }
}

export function resolveActiveDecorationDef(
  def: AvatarDecorationDef | null | undefined,
  ctx: DecorationEligibilityContext,
  now: Date = new Date(),
): AvatarDecorationDef | null {
  if (!def) return null;
  const res = checkDecorationEligibility(def, ctx, now);
  return res.allowed ? def : null;
}
