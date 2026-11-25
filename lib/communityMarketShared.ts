export type CommunityMarketItemType = "VOUCHER" | "PENALTY_TICKET";

export type VoucherCategoryKey =
  | "FLEET_BUY"
  | "FLEET_MAINTENANCE"
  | "GARAGE_RENT"
  | "MARKET_MOD"
  | "NC_BOOSTER";

export function normalizeVoucherCategoryKey(cat?: string | null): VoucherCategoryKey {
  if (cat === "GARAGE_UPGRADE" || cat === "GARAGE_RENT") return "GARAGE_RENT";
  if (
    cat === "FLEET_BUY" ||
    cat === "FLEET_MAINTENANCE" ||
    cat === "MARKET_MOD" ||
    cat === "NC_BOOSTER"
  ) {
    return cat;
  }
  return "FLEET_MAINTENANCE";
}

export const VOUCHER_CATEGORY_LABELS: Record<VoucherCategoryKey, string> = {
  FLEET_BUY: "Dealer Armada (Fleet Buy)",
  FLEET_MAINTENANCE: "Servis Armada (Maintenance)",
  GARAGE_RENT: "Operasional Garasi (Sewa Bulanan)",
  MARKET_MOD: "Mod Workshop",
  NC_BOOSTER: "NC Booster",
};

export const VOUCHER_CATEGORY_SHORT_LABELS: Record<VoucherCategoryKey, string> = {
  FLEET_BUY: "Dealer Armada",
  FLEET_MAINTENANCE: "Servis Armada",
  GARAGE_RENT: "Operasional Garasi",
  MARKET_MOD: "Mod Workshop",
  NC_BOOSTER: "NC Booster",
};

export const COMMUNITY_MARKET_REVIEW_TAGS_LIST = [
  "Harga Bersahabat",
  "Flash Deal Mantap",
  "Penjual Rekomendasi",
  "Item Sesuai Deskripsi",
  "Transaksi Lancar",
] as const;

export interface PercentageCategoryPricing {
  baseMin: number;
  baseMax: number;
  perPercentMax: number;
  maxCap: number;
  minRatioOfMax: number;
}

export interface BoosterCategoryPricing {
  baseMin: number;
  maxPerUnit: number; // 1 unit = +50% selama 2 jam
  maxCap: number;
  minRatioOfMax: number;
}

export interface DurationFeesConfig {
  7: number;
  14: number;
  30: number;
}

export interface CommunityMarketConfig {
  enabled: boolean;
  transactionFeePercent: number;
  minVoucherRemainingHours: number;
  flashDealThresholdHours: number;
  freeListingForNismaraPlus: boolean;
  freeListingForBooster: boolean;
  sellListingDurations: DurationFeesConfig;
  buyOrderDurations: DurationFeesConfig;
  penaltyTicket: {
    minPrice: number;
    maxPrice: number;
  };
  voucherCategories: {
    FLEET_BUY: PercentageCategoryPricing;
    FLEET_MAINTENANCE: PercentageCategoryPricing;
    GARAGE_RENT: PercentageCategoryPricing;
    MARKET_MOD: PercentageCategoryPricing;
    NC_BOOSTER: BoosterCategoryPricing;
  };
}

export const DEFAULT_COMMUNITY_MARKET_CONFIG: CommunityMarketConfig = {
  enabled: true,
  transactionFeePercent: 11,
  minVoucherRemainingHours: 24,
  flashDealThresholdHours: 72,
  freeListingForNismaraPlus: true,
  freeListingForBooster: true,
  sellListingDurations: {
    7: 0,
    14: 500,
    30: 1000,
  },
  buyOrderDurations: {
    7: 0,
    14: 500,
    30: 1000,
  },
  penaltyTicket: {
    minPrice: 1000,
    maxPrice: 6000,
  },
  voucherCategories: {
    FLEET_BUY: {
      baseMin: 2000,
      baseMax: 10000,
      perPercentMax: 1200,
      maxCap: 100000,
      minRatioOfMax: 0.15,
    },
    FLEET_MAINTENANCE: {
      baseMin: 500,
      baseMax: 1000,
      perPercentMax: 240,
      maxCap: 25000,
      minRatioOfMax: 0.15,
    },
    GARAGE_RENT: {
      baseMin: 500,
      baseMax: 1500,
      perPercentMax: 285,
      maxCap: 30000,
      minRatioOfMax: 0.15,
    },
    MARKET_MOD: {
      baseMin: 500,
      baseMax: 500,
      perPercentMax: 195,
      maxCap: 20000,
      minRatioOfMax: 0.15,
    },
    NC_BOOSTER: {
      baseMin: 500,
      maxPerUnit: 5000,
      maxCap: 30000,
      minRatioOfMax: 0.15,
    },
  },
};

export function calculateSafeboxCapacity(safeboxLevel?: number | null): number {
  const lvl = Math.max(1, Number(safeboxLevel) || 1);
  return 10 + (lvl - 1) * 5;
}

export function isVoucherTradableClient(voucher: {
  tradable?: boolean;
  source?: string | null;
} | null | undefined): boolean {
  if (!voucher) return false;
  if (voucher.tradable === false) return false;
  if (typeof voucher.source === "string" && /^MANAGER_SALARY/i.test(voucher.source)) {
    return false;
  }
  return true;
}

export function sanitizeCommunityMarketConfig(raw: any): CommunityMarketConfig {
  const d = DEFAULT_COMMUNITY_MARKET_CONFIG;
  const num = (v: any, fallback: number, min = 0, max = 10_000_000) => {
    const parsed = Number(v);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
  };
  const ratio = (v: any, fallback: number) => {
    const parsed = Number(v);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(0.8, Math.max(0.05, Number(parsed.toFixed(2))));
  };

  const pctCat = (
    src: any,
    def: PercentageCategoryPricing
  ): PercentageCategoryPricing => {
    const baseMin = num(src?.baseMin, def.baseMin, 100);
    const maxCap = Math.max(baseMin + 100, num(src?.maxCap, def.maxCap, 500));
    const baseMax = Math.min(maxCap, num(src?.baseMax, def.baseMax, 0));
    const perPercentMax = num(src?.perPercentMax, def.perPercentMax, 10);
    return {
      baseMin,
      baseMax,
      perPercentMax,
      maxCap,
      minRatioOfMax: ratio(src?.minRatioOfMax, def.minRatioOfMax),
    };
  };

  const bSrc = raw?.voucherCategories?.NC_BOOSTER;
  const bDef = d.voucherCategories.NC_BOOSTER;
  const bMin = num(bSrc?.baseMin, bDef.baseMin, 100);
  const bCap = Math.max(bMin + 100, num(bSrc?.maxCap, bDef.maxCap, 500));

  const ptMin = num(raw?.penaltyTicket?.minPrice, d.penaltyTicket.minPrice, 100);
  const ptMax = Math.max(
    ptMin + 100,
    num(raw?.penaltyTicket?.maxPrice, d.penaltyTicket.maxPrice, 500)
  );

  return {
    enabled: typeof raw?.enabled === "boolean" ? raw.enabled : d.enabled,
    transactionFeePercent: num(raw?.transactionFeePercent, d.transactionFeePercent, 0, 50),
    minVoucherRemainingHours: num(
      raw?.minVoucherRemainingHours,
      d.minVoucherRemainingHours,
      1,
      168
    ),
    flashDealThresholdHours: num(
      raw?.flashDealThresholdHours,
      d.flashDealThresholdHours,
      6,
      336
    ),
    freeListingForNismaraPlus:
      typeof raw?.freeListingForNismaraPlus === "boolean"
        ? raw.freeListingForNismaraPlus
        : d.freeListingForNismaraPlus,
    freeListingForBooster:
      typeof raw?.freeListingForBooster === "boolean"
        ? raw.freeListingForBooster
        : d.freeListingForBooster,
    sellListingDurations: {
      7: num(raw?.sellListingDurations?.[7], d.sellListingDurations[7], 0, 100000),
      14: num(raw?.sellListingDurations?.[14], d.sellListingDurations[14], 0, 100000),
      30: num(raw?.sellListingDurations?.[30], d.sellListingDurations[30], 0, 100000),
    },
    buyOrderDurations: {
      7: num(raw?.buyOrderDurations?.[7], d.buyOrderDurations[7], 0, 100000),
      14: num(raw?.buyOrderDurations?.[14], d.buyOrderDurations[14], 0, 100000),
      30: num(raw?.buyOrderDurations?.[30], d.buyOrderDurations[30], 0, 100000),
    },
    penaltyTicket: {
      minPrice: ptMin,
      maxPrice: ptMax,
    },
    voucherCategories: {
      FLEET_BUY: pctCat(raw?.voucherCategories?.FLEET_BUY, d.voucherCategories.FLEET_BUY),
      FLEET_MAINTENANCE: pctCat(
        raw?.voucherCategories?.FLEET_MAINTENANCE,
        d.voucherCategories.FLEET_MAINTENANCE
      ),
      GARAGE_RENT: pctCat(
        raw?.voucherCategories?.GARAGE_RENT ?? raw?.voucherCategories?.GARAGE_UPGRADE,
        d.voucherCategories.GARAGE_RENT
      ),
      MARKET_MOD: pctCat(raw?.voucherCategories?.MARKET_MOD, d.voucherCategories.MARKET_MOD),
      NC_BOOSTER: {
        baseMin: bMin,
        maxPerUnit: num(bSrc?.maxPerUnit, bDef.maxPerUnit, 100),
        maxCap: bCap,
        minRatioOfMax: ratio(bSrc?.minRatioOfMax, bDef.minRatioOfMax),
      },
    },
  };
}

export interface FairPriceRangeInput {
  itemType: CommunityMarketItemType;
  category?: string;
  discountType?: "percentage" | "fixed" | "any" | null;
  discountValue?: number;
  durationHours?: number;
  maxDiscount?: number;
}

export interface FairPriceRangeResult {
  minPrice: number;
  maxPrice: number;
  cappedByMaxDiscount: boolean;
}

export function calculateFairPriceRange(
  config: CommunityMarketConfig,
  input: FairPriceRangeInput
): FairPriceRangeResult {
  if (input.itemType === "PENALTY_TICKET") {
    return {
      minPrice: config.penaltyTicket.minPrice,
      maxPrice: config.penaltyTicket.maxPrice,
      cappedByMaxDiscount: false,
    };
  }

  const category = normalizeVoucherCategoryKey(input.category);
  const discountType = input.discountType || "percentage";
  const discountValue = Math.max(1, Number(input.discountValue) || 1);
  const maxDiscount = Math.max(0, Number(input.maxDiscount) || 0);

  if (category === "NC_BOOSTER") {
    const bCfg = config.voucherCategories.NC_BOOSTER;
    const durationHours = Math.max(1, Number(input.durationHours) || 2);
    const units = Math.max(0.5, (discountValue / 50) * (durationHours / 2));
    const rawMax = Math.round(bCfg.maxPerUnit * units);
    const maxPrice = Math.min(bCfg.maxCap, Math.max(bCfg.baseMin + 100, rawMax));
    const minPrice = Math.min(
      maxPrice - 100,
      Math.max(bCfg.baseMin, Math.round(maxPrice * bCfg.minRatioOfMax))
    );
    return {
      minPrice: Math.max(100, minPrice),
      maxPrice,
      cappedByMaxDiscount: false,
    };
  }

  const cCfg =
    config.voucherCategories[category] || config.voucherCategories.FLEET_MAINTENANCE;

  if (discountType === "fixed") {
    const rawMax = Math.round(discountValue * 0.9);
    const maxPrice = Math.min(cCfg.maxCap, Math.max(cCfg.baseMin, rawMax));
    const minPrice = Math.min(
      maxPrice,
      Math.max(100, Math.min(cCfg.baseMin, Math.round(maxPrice * cCfg.minRatioOfMax)))
    );
    return {
      minPrice,
      maxPrice,
      cappedByMaxDiscount: false,
    };
  }

  const clampedPct = Math.min(100, Math.max(1, discountValue));
  const rawMax = Math.round(cCfg.baseMax + clampedPct * cCfg.perPercentMax);
  let maxPrice = Math.min(cCfg.maxCap, Math.max(cCfg.baseMin + 100, rawMax));
  let cappedByMaxDiscount = false;

  if (maxDiscount > 0) {
    const benefitCap = Math.max(100, Math.round(maxDiscount * 0.9));
    if (benefitCap < maxPrice) {
      maxPrice = benefitCap;
      cappedByMaxDiscount = true;
    }
  }

  const computedMin = Math.max(cCfg.baseMin, Math.round(maxPrice * cCfg.minRatioOfMax));
  const minPrice = Math.min(
    maxPrice,
    Math.max(
      100,
      cappedByMaxDiscount ? Math.min(computedMin, Math.round(maxPrice * 0.25)) : computedMin
    )
  );

  return {
    minPrice,
    maxPrice,
    cappedByMaxDiscount,
  };
}

export function isUserFreeListingEligible(
  config: CommunityMarketConfig,
  user: {
    isBooster?: boolean;
    nismaraplus?: { status?: boolean; expiredAt?: Date | string | null };
  } | null | undefined
): { eligible: boolean; reason: "NISMARA_PLUS" | "SERVER_BOOSTER" | "BOTH" | null } {
  if (!user) return { eligible: false, reason: null };

  const now = Date.now();
  const hasNplus = Boolean(
    config.freeListingForNismaraPlus &&
      user.nismaraplus?.status === true &&
      (!user.nismaraplus?.expiredAt || new Date(user.nismaraplus.expiredAt).getTime() > now)
  );
  const hasBooster = Boolean(config.freeListingForBooster && user.isBooster === true);

  if (hasNplus && hasBooster) return { eligible: true, reason: "BOTH" };
  if (hasNplus) return { eligible: true, reason: "NISMARA_PLUS" };
  if (hasBooster) return { eligible: true, reason: "SERVER_BOOSTER" };
  return { eligible: false, reason: null };
}

export function resolveListingDurationFee(
  config: CommunityMarketConfig,
  kind: "SELL_LISTING" | "BUY_ORDER",
  durationDays: 7 | 14 | 30,
  isFreeEligible: boolean
): number {
  if (isFreeEligible) return 0;
  const table =
    kind === "SELL_LISTING" ? config.sellListingDurations : config.buyOrderDurations;
  return table[durationDays] ?? 0;
}

export function getMaxAllowedVoucherListingDuration(
  voucherExpiresAt: Date | string | null | undefined,
  minVoucherRemainingHours: number,
  nowMs = Date.now()
): { maxListingMs: number | null; availableDurations: Array<7 | 14 | 30>; canList: boolean } {
  if (!voucherExpiresAt) {
    return { maxListingMs: null, availableDurations: [7, 14, 30], canList: true };
  }
  const expMs = new Date(voucherExpiresAt).getTime();
  const cutoffMs = expMs - minVoucherRemainingHours * 3600 * 1000;
  const usableMs = cutoffMs - nowMs;

  if (usableMs <= 0) {
    return { maxListingMs: 0, availableDurations: [], canList: false };
  }

  const dayMs = 24 * 3600 * 1000;
  const availableDurations: Array<7 | 14 | 30> = [7];
  if (usableMs >= 14 * dayMs) availableDurations.push(14);
  if (usableMs >= 30 * dayMs) availableDurations.push(30);

  return { maxListingMs: usableMs, availableDurations, canList: true };
}

export function formatNC(amount: number): string {
  return `${Number(amount || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} NC`;
}

export function formatNCWhole(amount: number): string {
  return `${Math.round(Number(amount || 0)).toLocaleString("id-ID")} NC`;
}

export function buildAutoVoucherTitle(params: {
  category: string;
  discountValue?: number;
  durationHours?: number;
  maxDiscount?: number;
}): string {
  const cat = normalizeVoucherCategoryKey(params.category);
  const val = Math.max(1, Math.round(Number(params.discountValue) || 25));
  const hrs = Math.max(1, Math.round(Number(params.durationHours) || 2));
  const maxD = Math.max(0, Math.round(Number(params.maxDiscount) || 0));
  const capSuffix = maxD > 0 ? ` (Maks. ${maxD.toLocaleString("id-ID")} NC)` : "";

  if (cat === "NC_BOOSTER") {
    return `Booster NC +${val}% (${hrs} Jam)`;
  }
  if (cat === "FLEET_MAINTENANCE") {
    return val >= 100 && maxD === 0
      ? "Bebas Servis Armada (100%)"
      : `Diskon Servis Armada ${val}%${capSuffix}`;
  }
  if (cat === "FLEET_BUY") {
    return `Diskon Beli Armada ${val}%${capSuffix}`;
  }
  if (cat === "GARAGE_RENT") {
    return val >= 100 && maxD === 0
      ? "Bebas Operasional Garasi (100%)"
      : `Diskon Operasional Garasi ${val}%${capSuffix}`;
  }
  return `Diskon Mod Workshop ${val}%${capSuffix}`;
}

export function formatWIBShort(dateInput?: Date | string | null): string {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} WIB`;
}

export function formatVoucherBenefitSummary(snap: {
  category?: string;
  discountType?: "percentage" | "fixed" | null;
  discountValue?: number;
  durationHours?: number;
  maxDiscount?: number;
  minSpend?: number;
}): {
  headline: string;
  capBadge: string;
  isUnlimitedCap: boolean;
  minSpendLabel: string | null;
} {
  if (snap.category === "NC_BOOSTER") {
    const pct = Number(snap.discountValue) || 50;
    const hrs = Number(snap.durationHours) || 2;
    return {
      headline: `+${pct}% NC Booster (${hrs} Jam)`,
      capBadge: `Durasi Aktif ${hrs} Jam`,
      isUnlimitedCap: false,
      minSpendLabel: null,
    };
  }

  if (snap.discountType === "fixed") {
    const val = Number(snap.discountValue) || 0;
    return {
      headline: `Potongan ${formatNCWhole(val)}`,
      capBadge: `Potongan Tetap ${formatNCWhole(val)}`,
      isUnlimitedCap: false,
      minSpendLabel:
        snap.minSpend && snap.minSpend > 0
          ? `Min. Belanja ${formatNCWhole(snap.minSpend)}`
          : null,
    };
  }

  const pct = Number(snap.discountValue) || 0;
  const maxD = Number(snap.maxDiscount) || 0;
  const isUnlimitedCap = maxD <= 0;
  return {
    headline: `Diskon ${pct}%`,
    capBadge: isUnlimitedCap
      ? "Tanpa Batas Potongan (Unlimited)"
      : `Maks. Potongan ${formatNCWhole(maxD)}`,
    isUnlimitedCap,
    minSpendLabel:
      snap.minSpend && snap.minSpend > 0
        ? `Min. Belanja ${formatNCWhole(snap.minSpend)}`
        : null,
  };
}
