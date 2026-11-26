export type ProfileThemePresetId =
  | "default"
  | "midnight"
  | "cosmic"
  | "summer"
  | "steel"
  | "sakura"
  | "emerald"
  | "crimson"
  | "ocean"
  | "dark"
  | "custom";

export interface UserProfileThemeConfig {
  preset: ProfileThemePresetId;
  customBaseColor?: string | null;
  customAccentColor?: string | null;
}

export interface ProfileThemePresetMeta {
  id: Exclude<ProfileThemePresetId, "custom">;
  name: string;
  tagline: string;
  /** CSS gradient untuk lingkaran swatch ala Steam */
  swatchGradient: string;
  /** Warna ring aktif swatch */
  ringColor: string;
  /** HSL triplets (space-separated) sesuai format Tailwind v4 di app/globals.css */
  vars: Record<string, string> | null;
  /** Gradient overlay kaca pada kontainer utama profil publik */
  surfaceGradient?: string;
  /** Warna fade bawah banner agar menyatu mulus ke kontainer profil */
  bannerFadeColor?: string;
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/;

export const DEFAULT_CUSTOM_BASE_COLOR = "#6d28d9";
export const DEFAULT_CUSTOM_ACCENT_COLOR = "#c084fc";

export const PROFILE_THEME_PRESETS: ProfileThemePresetMeta[] = [
  {
    id: "default",
    name: "Default Theme",
    tagline: "Tema bawaan Nismara Transport",
    swatchGradient: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
    ringColor: "#a855f7",
    vars: null,
  },
  {
    id: "summer",
    name: "Summer",
    tagline: "Emas hangat & amber klasik",
    swatchGradient: "linear-gradient(135deg, #a16207 0%, #451a03 100%)",
    ringColor: "#f59e0b",
    vars: {
      "--background": "34 56% 11%",
      "--foreground": "45 40% 97%",
      "--card": "34 48% 16%",
      "--card-foreground": "45 40% 97%",
      "--popover": "34 48% 15%",
      "--popover-foreground": "45 40% 97%",
      "--primary": "40 92% 60%",
      "--primary-foreground": "30 60% 10%",
      "--secondary": "34 40% 21%",
      "--secondary-foreground": "45 40% 97%",
      "--muted": "34 36% 20%",
      "--muted-foreground": "38 30% 74%",
      "--accent": "34 42% 24%",
      "--accent-foreground": "45 40% 97%",
      "--border": "36 44% 31%",
      "--input": "36 40% 26%",
      "--ring": "40 92% 60%",
    },
    surfaceGradient:
      "linear-gradient(180deg, rgba(113, 63, 18, 0.86) 0%, rgba(56, 32, 10, 0.88) 45%, rgba(34, 20, 7, 0.92) 100%)",
    bannerFadeColor: "rgba(92, 51, 14, 0.92)",
  },
  {
    id: "midnight",
    name: "Midnight",
    tagline: "Biru malam pekat elegan",
    swatchGradient: "linear-gradient(135deg, #1e3a8a 0%, #060919 100%)",
    ringColor: "#60a5fa",
    vars: {
      "--background": "228 60% 9%",
      "--foreground": "214 40% 97%",
      "--card": "226 52% 14%",
      "--card-foreground": "214 40% 97%",
      "--popover": "226 52% 13%",
      "--popover-foreground": "214 40% 97%",
      "--primary": "217 91% 66%",
      "--primary-foreground": "228 60% 9%",
      "--secondary": "226 42% 19%",
      "--secondary-foreground": "214 40% 97%",
      "--muted": "226 38% 18%",
      "--muted-foreground": "218 28% 72%",
      "--accent": "226 44% 22%",
      "--accent-foreground": "214 40% 97%",
      "--border": "224 44% 29%",
      "--input": "224 40% 24%",
      "--ring": "217 91% 66%",
    },
    surfaceGradient:
      "linear-gradient(180deg, rgba(23, 37, 84, 0.86) 0%, rgba(12, 18, 44, 0.90) 48%, rgba(7, 10, 26, 0.94) 100%)",
    bannerFadeColor: "rgba(19, 30, 68, 0.92)",
  },
  {
    id: "steel",
    name: "Steel",
    tagline: "Abu-biru industrial bersih",
    swatchGradient: "linear-gradient(135deg, #475569 0%, #1e293b 100%)",
    ringColor: "#94a3b8",
    vars: {
      "--background": "215 24% 14%",
      "--foreground": "210 30% 97%",
      "--card": "215 22% 19%",
      "--card-foreground": "210 30% 97%",
      "--popover": "215 22% 18%",
      "--popover-foreground": "210 30% 97%",
      "--primary": "204 82% 66%",
      "--primary-foreground": "215 30% 11%",
      "--secondary": "215 20% 24%",
      "--secondary-foreground": "210 30% 97%",
      "--muted": "215 18% 23%",
      "--muted-foreground": "214 18% 74%",
      "--accent": "215 22% 27%",
      "--accent-foreground": "210 30% 97%",
      "--border": "215 20% 34%",
      "--input": "215 20% 29%",
      "--ring": "204 82% 66%",
    },
    surfaceGradient:
      "linear-gradient(180deg, rgba(51, 65, 85, 0.86) 0%, rgba(30, 41, 59, 0.90) 50%, rgba(20, 28, 42, 0.94) 100%)",
    bannerFadeColor: "rgba(44, 56, 74, 0.92)",
  },
  {
    id: "cosmic",
    name: "Cosmic",
    tagline: "Ungu-magenta galaksi ala Steam",
    swatchGradient: "linear-gradient(135deg, #7e22ce 0%, #86198f 55%, #2e1065 100%)",
    ringColor: "#e879f9",
    vars: {
      "--background": "284 52% 12%",
      "--foreground": "295 40% 98%",
      "--card": "284 46% 17%",
      "--card-foreground": "295 40% 98%",
      "--popover": "284 46% 16%",
      "--popover-foreground": "295 40% 98%",
      "--primary": "292 84% 70%",
      "--primary-foreground": "284 55% 10%",
      "--secondary": "286 38% 23%",
      "--secondary-foreground": "295 40% 98%",
      "--muted": "286 34% 21%",
      "--muted-foreground": "290 26% 76%",
      "--accent": "288 42% 26%",
      "--accent-foreground": "295 40% 98%",
      "--border": "288 42% 34%",
      "--input": "288 38% 28%",
      "--ring": "292 84% 70%",
    },
    surfaceGradient:
      "linear-gradient(180deg, rgba(112, 26, 117, 0.84) 0%, rgba(59, 17, 82, 0.89) 48%, rgba(30, 11, 46, 0.93) 100%)",
    bannerFadeColor: "rgba(92, 22, 98, 0.92)",
  },
  {
    id: "sakura",
    name: "Sakura",
    tagline: "Rose lembut & pastel gelap",
    swatchGradient: "linear-gradient(135deg, #db2777 0%, #831843 60%, #3b0a22 100%)",
    ringColor: "#f472b6",
    vars: {
      "--background": "334 48% 12%",
      "--foreground": "330 40% 98%",
      "--card": "334 42% 17%",
      "--card-foreground": "330 40% 98%",
      "--popover": "334 42% 16%",
      "--popover-foreground": "330 40% 98%",
      "--primary": "330 88% 72%",
      "--primary-foreground": "334 55% 10%",
      "--secondary": "334 36% 23%",
      "--secondary-foreground": "330 40% 98%",
      "--muted": "334 32% 21%",
      "--muted-foreground": "332 28% 77%",
      "--accent": "334 40% 26%",
      "--accent-foreground": "330 40% 98%",
      "--border": "334 42% 34%",
      "--input": "334 36% 28%",
      "--ring": "330 88% 72%",
    },
    surfaceGradient:
      "linear-gradient(180deg, rgba(131, 24, 67, 0.82) 0%, rgba(66, 16, 40, 0.88) 48%, rgba(36, 10, 24, 0.93) 100%)",
    bannerFadeColor: "rgba(108, 22, 57, 0.90)",
  },
  {
    id: "emerald",
    name: "Emerald",
    tagline: "Hijau zamrud & teal sejuk",
    swatchGradient: "linear-gradient(135deg, #059669 0%, #064e3b 65%, #022c22 100%)",
    ringColor: "#34d399",
    vars: {
      "--background": "164 52% 10%",
      "--foreground": "156 35% 97%",
      "--card": "164 46% 14%",
      "--card-foreground": "156 35% 97%",
      "--popover": "164 46% 13%",
      "--popover-foreground": "156 35% 97%",
      "--primary": "158 76% 56%",
      "--primary-foreground": "164 60% 8%",
      "--secondary": "164 38% 19%",
      "--secondary-foreground": "156 35% 97%",
      "--muted": "164 34% 18%",
      "--muted-foreground": "160 24% 73%",
      "--accent": "164 40% 22%",
      "--accent-foreground": "156 35% 97%",
      "--border": "164 42% 29%",
      "--input": "164 36% 24%",
      "--ring": "158 76% 56%",
    },
    surfaceGradient:
      "linear-gradient(180deg, rgba(6, 78, 59, 0.84) 0%, rgba(7, 45, 36, 0.89) 48%, rgba(4, 26, 21, 0.93) 100%)",
    bannerFadeColor: "rgba(6, 66, 50, 0.92)",
  },
  {
    id: "ocean",
    name: "Ocean",
    tagline: "Biru cyan laut dalam",
    swatchGradient: "linear-gradient(135deg, #0284c7 0%, #0c4a6e 65%, #082f49 100%)",
    ringColor: "#38bdf8",
    vars: {
      "--background": "202 58% 10%",
      "--foreground": "200 40% 97%",
      "--card": "202 50% 15%",
      "--card-foreground": "200 40% 97%",
      "--popover": "202 50% 14%",
      "--popover-foreground": "200 40% 97%",
      "--primary": "196 92% 62%",
      "--primary-foreground": "202 65% 8%",
      "--secondary": "202 42% 20%",
      "--secondary-foreground": "200 40% 97%",
      "--muted": "202 36% 19%",
      "--muted-foreground": "200 28% 74%",
      "--accent": "202 44% 23%",
      "--accent-foreground": "200 40% 97%",
      "--border": "202 46% 30%",
      "--input": "202 40% 25%",
      "--ring": "196 92% 62%",
    },
    surfaceGradient:
      "linear-gradient(180deg, rgba(12, 74, 110, 0.84) 0%, rgba(10, 44, 68, 0.89) 48%, rgba(6, 26, 42, 0.93) 100%)",
    bannerFadeColor: "rgba(11, 64, 96, 0.92)",
  },
  {
    id: "crimson",
    name: "Crimson",
    tagline: "Merah ruby berani & mewah",
    swatchGradient: "linear-gradient(135deg, #be123c 0%, #7f1d1d 60%, #3b0912 100%)",
    ringColor: "#fb7185",
    vars: {
      "--background": "352 52% 11%",
      "--foreground": "350 40% 98%",
      "--card": "352 46% 16%",
      "--card-foreground": "350 40% 98%",
      "--popover": "352 46% 15%",
      "--popover-foreground": "350 40% 98%",
      "--primary": "350 86% 68%",
      "--primary-foreground": "352 60% 9%",
      "--secondary": "352 38% 21%",
      "--secondary-foreground": "350 40% 98%",
      "--muted": "352 34% 20%",
      "--muted-foreground": "352 26% 75%",
      "--accent": "352 42% 25%",
      "--accent-foreground": "350 40% 98%",
      "--border": "352 44% 32%",
      "--input": "352 38% 27%",
      "--ring": "350 86% 68%",
    },
    surfaceGradient:
      "linear-gradient(180deg, rgba(127, 29, 29, 0.84) 0%, rgba(64, 16, 22, 0.89) 48%, rgba(34, 9, 13, 0.93) 100%)",
    bannerFadeColor: "rgba(105, 24, 26, 0.92)",
  },
  {
    id: "dark",
    name: "Dark Mode",
    tagline: "Hitam karbon minimalis",
    swatchGradient: "linear-gradient(135deg, #27272a 0%, #09090b 100%)",
    ringColor: "#a1a1aa",
    vars: {
      "--background": "240 6% 7%",
      "--foreground": "0 0% 98%",
      "--card": "240 5% 11%",
      "--card-foreground": "0 0% 98%",
      "--popover": "240 5% 10%",
      "--popover-foreground": "0 0% 98%",
      "--primary": "0 0% 90%",
      "--primary-foreground": "240 6% 7%",
      "--secondary": "240 4% 16%",
      "--secondary-foreground": "0 0% 98%",
      "--muted": "240 4% 15%",
      "--muted-foreground": "240 5% 68%",
      "--accent": "240 5% 19%",
      "--accent-foreground": "0 0% 98%",
      "--border": "240 5% 24%",
      "--input": "240 5% 20%",
      "--ring": "0 0% 85%",
    },
    surfaceGradient:
      "linear-gradient(180deg, rgba(24, 24, 27, 0.90) 0%, rgba(14, 14, 17, 0.92) 50%, rgba(9, 9, 11, 0.95) 100%)",
    bannerFadeColor: "rgba(20, 20, 23, 0.94)",
  },
];

const PRESET_MAP = new Map(PROFILE_THEME_PRESETS.map((p) => [p.id, p]));

export function isValidHexColor(val?: string | null): val is string {
  return typeof val === "string" && HEX_COLOR_RE.test(val.trim());
}

export function normalizeHexColor(val: string | null | undefined, fallback: string): string {
  if (typeof val === "string" && HEX_COLOR_RE.test(val.trim())) {
    return val.trim().toLowerCase();
  }
  return fallback;
}

export function sanitizeProfileTheme(input: any): UserProfileThemeConfig {
  if (!input || typeof input !== "object") {
    return { preset: "default" };
  }
  const rawPreset = typeof input.preset === "string" ? input.preset.trim().toLowerCase() : "default";
  const isKnownPreset = rawPreset === "custom" || PRESET_MAP.has(rawPreset as any);
  const preset: ProfileThemePresetId = isKnownPreset
    ? (rawPreset as ProfileThemePresetId)
    : "default";

  return {
    preset,
    customBaseColor: isValidHexColor(input.customBaseColor)
      ? input.customBaseColor.trim().toLowerCase()
      : null,
    customAccentColor: isValidHexColor(input.customAccentColor)
      ? input.customAccentColor.trim().toLowerCase()
      : null,
  };
}

export function canUseCustomProfileTheme(opts: {
  isNismaraPlus?: boolean;
  isBooster?: boolean;
}): boolean {
  return Boolean(opts.isNismaraPlus || opts.isBooster);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function buildCustomThemeResolved(baseHex: string, accentHex: string) {
  const base = hexToHsl(baseHex);
  const accent = hexToHsl(accentHex);

  // Kalibrasi gelap ala Steam agar teks putih/terang selalu kontras & mudah dibaca
  const bgSat = base.s < 8 ? base.s : clamp(Math.round(base.s * 0.62), 20, 66);
  const bgL = clamp(Math.round(8 + base.l * 0.12), 9, 17);
  const cardSat = base.s < 8 ? base.s : clamp(Math.round(base.s * 0.56), 18, 60);
  const cardL = bgL + 5;
  const mutedL = bgL + 9;
  const borderL = clamp(bgL + 19, 26, 38);
  const mutedFgSat = Math.min(28, Math.round(bgSat * 0.45));

  const accSat = accent.s < 10 ? accent.s : clamp(accent.s, 48, 92);
  const accL = clamp(accent.l, 56, 74);

  const vars: Record<string, string> = {
    "--background": `${base.h} ${bgSat}% ${bgL}%`,
    "--foreground": `${base.h} 25% 98%`,
    "--card": `${base.h} ${cardSat}% ${cardL}%`,
    "--card-foreground": `${base.h} 25% 98%`,
    "--popover": `${base.h} ${cardSat}% ${Math.max(8, cardL - 1)}%`,
    "--popover-foreground": `${base.h} 25% 98%`,
    "--primary": `${accent.h} ${accSat}% ${accL}%`,
    "--primary-foreground": accL >= 62 ? `${base.h} 50% 9%` : "0 0% 98%",
    "--secondary": `${base.h} ${Math.max(8, cardSat - 6)}% ${mutedL}%`,
    "--secondary-foreground": `${base.h} 25% 98%`,
    "--muted": `${base.h} ${Math.max(8, cardSat - 8)}% ${mutedL - 1}%`,
    "--muted-foreground": `${base.h} ${mutedFgSat}% 76%`,
    "--accent": `${base.h} ${cardSat}% ${mutedL + 3}%`,
    "--accent-foreground": `${base.h} 25% 98%`,
    "--border": `${base.h} ${cardSat}% ${borderL}%`,
    "--input": `${base.h} ${Math.max(8, cardSat - 6)}% ${Math.max(18, borderL - 6)}%`,
    "--ring": `${accent.h} ${accSat}% ${accL}%`,
  };

  const topL = clamp(bgL + 12, 18, 28);
  const midL = clamp(bgL + 3, 11, 20);
  const botL = clamp(bgL - 2, 7, 15);

  return {
    vars,
    surfaceGradient: `linear-gradient(180deg, hsla(${base.h}, ${bgSat}%, ${topL}%, 0.86) 0%, hsla(${base.h}, ${bgSat}%, ${midL}%, 0.90) 48%, hsla(${base.h}, ${bgSat}%, ${botL}%, 0.94) 100%)`,
    bannerFadeColor: `hsla(${base.h}, ${bgSat}%, ${topL}%, 0.92)`,
  };
}

export interface ResolvedProfileTheme {
  isDefault: boolean;
  presetId: ProfileThemePresetId;
  vars: Record<string, string> | null;
  surfaceGradient: string | null;
  bannerFadeColor: string | null;
}

export function resolveProfileTheme(
  rawTheme: any,
  eligibility: { isNismaraPlus?: boolean; isBooster?: boolean }
): ResolvedProfileTheme {
  const safe = sanitizeProfileTheme(rawTheme);

  if (safe.preset === "custom") {
    if (!canUseCustomProfileTheme(eligibility)) {
      return {
        isDefault: true,
        presetId: "default",
        vars: null,
        surfaceGradient: null,
        bannerFadeColor: null,
      };
    }

    const baseHex = normalizeHexColor(safe.customBaseColor, DEFAULT_CUSTOM_BASE_COLOR);
    const accentHex = normalizeHexColor(
      safe.customAccentColor,
      safe.customBaseColor ? baseHex : DEFAULT_CUSTOM_ACCENT_COLOR
    );
    const built = buildCustomThemeResolved(baseHex, accentHex);
    return {
      isDefault: false,
      presetId: "custom",
      vars: built.vars,
      surfaceGradient: built.surfaceGradient,
      bannerFadeColor: built.bannerFadeColor,
    };
  }

  const presetMeta = PRESET_MAP.get(safe.preset);
  if (!presetMeta || !presetMeta.vars) {
    return {
      isDefault: true,
      presetId: "default",
      vars: null,
      surfaceGradient: null,
      bannerFadeColor: null,
    };
  }

  return {
    isDefault: false,
    presetId: presetMeta.id,
    vars: presetMeta.vars,
    surfaceGradient: presetMeta.surfaceGradient || null,
    bannerFadeColor: presetMeta.bannerFadeColor || null,
  };
}
