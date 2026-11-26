import type {
  IPayrollTierItem,
  IPayrollVoucherItem,
  PayrollVoucherCategory,
} from "@/lib/models/PayrollRewardTemplate";

export interface PayrollTemplateSeed {
  slug: string;
  name: string;
  description: string;
  baseSalary: number;
  infiniteLoopStep: number;
  infiniteLoopBonusNc: number;
  infiniteLoopPenaltyTickets: number;
  isActive: boolean;
  rotationOrder: number;
  tiers: IPayrollTierItem[];
}

export interface SerializedPayrollTemplate {
  _id: string;
  slug: string;
  name: string;
  description: string;
  baseSalary: number;
  infiniteLoopStep: number;
  infiniteLoopBonusNc: number;
  infiniteLoopPenaltyTickets: number;
  tiers: IPayrollTierItem[];
  isActive: boolean;
  rotationOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateEconomySummary {
  baseSalary: number;
  totalBonusNc: number;
  maxTotalNc: number;
  totalPenaltyTickets: number;
  totalFuelLiters: number;
  totalVouchers: number;
  voucherCountsByCategory: Record<PayrollVoucherCategory, number>;
}

export const PAYROLL_VOUCHER_CATEGORIES: PayrollVoucherCategory[] = [
  "FLEET_MAINTENANCE",
  "FLEET_BUY",
  "MARKET_MOD",
  "GARAGE_RENT",
  "NC_BOOSTER",
];

export const PAYROLL_VOUCHER_CATEGORY_LABELS: Record<PayrollVoucherCategory, string> = {
  FLEET_MAINTENANCE: "Servis Armada",
  FLEET_BUY: "Beli Armada",
  GARAGE_RENT: "Operasional Garasi",
  MARKET_MOD: "Mod Workshop",
  NC_BOOSTER: "NC Booster",
};

export function buildTierLabel(tier: {
  tier: number;
  bonusNc?: number;
  penaltyTickets?: number;
  fuelLiters?: number;
  vouchers?: IPayrollVoucherItem[];
}): string {
  const parts: string[] = [];
  if (tier.bonusNc && tier.bonusNc > 0) {
    parts.push(`Bonus ${tier.bonusNc.toLocaleString("id-ID")} NC`);
  }
  if (tier.penaltyTickets && tier.penaltyTickets > 0) {
    parts.push(`${tier.penaltyTickets} Tiket Safebox`);
  }
  if (tier.fuelLiters && tier.fuelLiters > 0) {
    parts.push(`${Math.floor(tier.fuelLiters).toLocaleString("id-ID")} L Fuel`);
  }
  if (Array.isArray(tier.vouchers) && tier.vouchers.length > 0) {
    for (const v of tier.vouchers) {
      parts.push(v.title);
    }
  }
  if (tier.tier >= 100) {
    parts.push("Title Top Manager");
  }
  return parts.length > 0 ? parts.join(" + ") : `Reward Tier ${tier.tier}`;
}

export function computeTemplateEconomySummary(template: {
  baseSalary?: number;
  tiers?: IPayrollTierItem[];
}): TemplateEconomySummary {
  const baseSalary = Number(template.baseSalary ?? 10000);
  const tiers = Array.isArray(template.tiers) ? template.tiers : [];
  let totalBonusNc = 0;
  let totalPenaltyTickets = 0;
  let totalFuelLiters = 0;
  let totalVouchers = 0;

  const voucherCountsByCategory: Record<PayrollVoucherCategory, number> = {
    FLEET_MAINTENANCE: 0,
    FLEET_BUY: 0,
    GARAGE_RENT: 0,
    MARKET_MOD: 0,
    NC_BOOSTER: 0,
  };

  for (const t of tiers) {
    totalBonusNc += Number(t.bonusNc || 0);
    totalPenaltyTickets += Number(t.penaltyTickets || 0);
    totalFuelLiters += Math.floor(Number(t.fuelLiters || 0));
    if (Array.isArray(t.vouchers)) {
      for (const v of t.vouchers) {
        totalVouchers += 1;
        if (v.category in voucherCountsByCategory) {
          voucherCountsByCategory[v.category] += 1;
        }
      }
    }
  }

  return {
    baseSalary,
    totalBonusNc,
    maxTotalNc: baseSalary + totalBonusNc,
    totalPenaltyTickets,
    totalFuelLiters,
    totalVouchers,
    voucherCountsByCategory,
  };
}

/**
 * Mengonversi "YYYY-MM" menjadi indeks bulan monotonik untuk rotasi deterministik.
 */
export function monthStringToIndex(monthStr: string): number {
  const [yStr, mStr] = String(monthStr || "").split("-");
  const year = parseInt(yStr, 10) || 2026;
  const month = parseInt(mStr, 10) || 1;
  return year * 12 + (month - 1);
}

/**
 * Menghasilkan "YYYY-MM" untuk bulan berikutnya.
 */
export function getNextMonthString(monthStr: string): string {
  const [yStr, mStr] = String(monthStr || "").split("-");
  let year = parseInt(yStr, 10);
  let month = parseInt(mStr, 10);
  if (!year || !month) return monthStr;
  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Memilih template aktif untuk suatu periode bulan secara deterministik (A -> B -> C -> A).
 */
export function pickRotationTemplate<
  T extends { isActive?: boolean; rotationOrder?: number; slug?: string },
>(templates: T[], monthStr: string): T | null {
  const active = templates
    .filter((t) => t.isActive !== false)
    .sort((a, b) => {
      const diff = Number(a.rotationOrder ?? 999) - Number(b.rotationOrder ?? 999);
      if (diff !== 0) return diff;
      return String(a.slug || "").localeCompare(String(b.slug || ""));
    });

  if (active.length === 0) return null;
  const idx = Math.abs(monthStringToIndex(monthStr)) % active.length;
  return active[idx];
}

/**
 * 3 Preset Template Seimbang (Target Total NC = 100.000 NC, maxDiscount = 0 Unlimited non-tradable).
 * Setiap template menyeimbangkan Servis, Operasional Garasi, Beli Armada, Mod Workshop, Booster, Tiket Safebox & Fuel.
 */
export const STARTER_PAYROLL_TEMPLATES: PayrollTemplateSeed[] = [
  {
    slug: "balanced-a",
    name: "Seimbang A — Operasional & Mod",
    description:
      "Komposisi seimbang dengan kombinasi Servis Armada, Operasional Garasi, Beli Armada, Diskon Mod Workshop, Booster, Tiket Safebox, dan Fuel Garasi.",
    baseSalary: 10000,
    infiniteLoopStep: 10,
    infiniteLoopBonusNc: 5000,
    infiniteLoopPenaltyTickets: 1,
    isActive: true,
    rotationOrder: 1,
    tiers: [
      {
        tier: 10,
        label: "Voucher Diskon Servis 50%",
        bonusNc: 0,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Diskon Servis Armada 50% (Reward Manager)",
            category: "FLEET_MAINTENANCE",
            discountType: "percentage",
            discountValue: 50,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 20,
        label: "3 Tiket Penghapus Penalti (Safebox)",
        bonusNc: 0,
        penaltyTickets: 3,
        fuelLiters: 0,
        vouchers: [],
      },
      {
        tier: 30,
        label: "Bonus 15.000 NC",
        bonusNc: 15000,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [],
      },
      {
        tier: 40,
        label: "Voucher Diskon Operasional Garasi 50%",
        bonusNc: 0,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Diskon Operasional Garasi 50% (Reward Manager)",
            category: "GARAGE_RENT",
            discountType: "percentage",
            discountValue: 50,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 50,
        label: "Bonus 25.000 NC + Voucher Booster +100% (6 Jam)",
        bonusNc: 25000,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Voucher Booster +100% NC (6 Jam) (Reward Manager)",
            category: "NC_BOOSTER",
            discountType: "percentage",
            discountValue: 100,
            maxDiscount: 0,
            durationHours: 6,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 60,
        label: "Voucher Free 1x Servis Armada 100%",
        bonusNc: 0,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Free 1x Servis Armada (Reward Manager)",
            category: "FLEET_MAINTENANCE",
            discountType: "percentage",
            discountValue: 100,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 70,
        label: "Voucher Diskon Mod Workshop 50% + 3 Tiket Safebox",
        bonusNc: 0,
        penaltyTickets: 3,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Diskon Mod Workshop 50% (Reward Manager)",
            category: "MARKET_MOD",
            discountType: "percentage",
            discountValue: 50,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 80,
        label: "Voucher Diskon Beli Armada 50%",
        bonusNc: 0,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Diskon Beli Armada 50% (Reward Manager)",
            category: "FLEET_BUY",
            discountType: "percentage",
            discountValue: 50,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 90,
        label: "Voucher Bebas Sewa Garasi 100% + 2.000 L Fuel",
        bonusNc: 0,
        penaltyTickets: 0,
        fuelLiters: 2000,
        vouchers: [
          {
            title: "Bebas Biaya Sewa Garasi 100% (Reward Manager)",
            category: "GARAGE_RENT",
            discountType: "percentage",
            discountValue: 100,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 100,
        label: "Bonus 50.000 NC + Voucher Diskon Beli Armada 75% + Title Top Manager",
        bonusNc: 50000,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Diskon Beli Armada 75% (Master Manager Reward)",
            category: "FLEET_BUY",
            discountType: "percentage",
            discountValue: 75,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
    ],
  },
  {
    slug: "balanced-b",
    name: "Seimbang B — Perawatan & Logistik",
    description:
      "Komposisi seimbang dengan porsi bahan bakar garasi lebih awal, perawatan armada, sewa garasi, diskon mod, serta diskon pembelian armada.",
    baseSalary: 10000,
    infiniteLoopStep: 10,
    infiniteLoopBonusNc: 5000,
    infiniteLoopPenaltyTickets: 1,
    isActive: true,
    rotationOrder: 2,
    tiers: [
      {
        tier: 10,
        label: "Voucher Diskon Operasional Garasi 50%",
        bonusNc: 0,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Diskon Operasional Garasi 50% (Reward Manager)",
            category: "GARAGE_RENT",
            discountType: "percentage",
            discountValue: 50,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 20,
        label: "1.000 L Fuel Garasi + 2 Tiket Safebox",
        bonusNc: 0,
        penaltyTickets: 2,
        fuelLiters: 1000,
        vouchers: [],
      },
      {
        tier: 30,
        label: "Bonus 15.000 NC",
        bonusNc: 15000,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [],
      },
      {
        tier: 40,
        label: "Voucher Diskon Servis Armada 50%",
        bonusNc: 0,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Diskon Servis Armada 50% (Reward Manager)",
            category: "FLEET_MAINTENANCE",
            discountType: "percentage",
            discountValue: 50,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 50,
        label: "Bonus 25.000 NC + Voucher Booster +100% (6 Jam)",
        bonusNc: 25000,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Voucher Booster +100% NC (6 Jam) (Reward Manager)",
            category: "NC_BOOSTER",
            discountType: "percentage",
            discountValue: 100,
            maxDiscount: 0,
            durationHours: 6,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 60,
        label: "Voucher Diskon Beli Armada 35%",
        bonusNc: 0,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Diskon Beli Armada 35% (Reward Manager)",
            category: "FLEET_BUY",
            discountType: "percentage",
            discountValue: 35,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 70,
        label: "Voucher Free 1x Servis Armada 100%",
        bonusNc: 0,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Free 1x Servis Armada (Reward Manager)",
            category: "FLEET_MAINTENANCE",
            discountType: "percentage",
            discountValue: 100,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 80,
        label: "Voucher Diskon Mod Workshop 50% + 3 Tiket Safebox",
        bonusNc: 0,
        penaltyTickets: 3,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Diskon Mod Workshop 50% (Reward Manager)",
            category: "MARKET_MOD",
            discountType: "percentage",
            discountValue: 50,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 90,
        label: "Voucher Bebas Sewa Garasi 100% + 1.500 L Fuel",
        bonusNc: 0,
        penaltyTickets: 0,
        fuelLiters: 1500,
        vouchers: [
          {
            title: "Bebas Biaya Sewa Garasi 100% (Reward Manager)",
            category: "GARAGE_RENT",
            discountType: "percentage",
            discountValue: 100,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 100,
        label: "Bonus 50.000 NC + Voucher Diskon Beli Armada 75% + Title Top Manager",
        bonusNc: 50000,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Diskon Beli Armada 75% (Master Manager Reward)",
            category: "FLEET_BUY",
            discountType: "percentage",
            discountValue: 75,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
    ],
  },
  {
    slug: "balanced-c",
    name: "Seimbang C — Ekspansi & Efisiensi",
    description:
      "Komposisi seimbang dengan urutan hadiah segar untuk bahan bakar, mod workshop, sewa garasi, ekspansi armada, dan servis penuh.",
    baseSalary: 10000,
    infiniteLoopStep: 10,
    infiniteLoopBonusNc: 5000,
    infiniteLoopPenaltyTickets: 1,
    isActive: true,
    rotationOrder: 3,
    tiers: [
      {
        tier: 10,
        label: "1.000 L Fuel Garasi + Voucher Diskon Servis 35%",
        bonusNc: 0,
        penaltyTickets: 0,
        fuelLiters: 1000,
        vouchers: [
          {
            title: "Diskon Servis Armada 35% (Reward Manager)",
            category: "FLEET_MAINTENANCE",
            discountType: "percentage",
            discountValue: 35,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 20,
        label: "3 Tiket Penghapus Penalti (Safebox)",
        bonusNc: 0,
        penaltyTickets: 3,
        fuelLiters: 0,
        vouchers: [],
      },
      {
        tier: 30,
        label: "Bonus 15.000 NC",
        bonusNc: 15000,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [],
      },
      {
        tier: 40,
        label: "Voucher Diskon Mod Workshop 50%",
        bonusNc: 0,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Diskon Mod Workshop 50% (Reward Manager)",
            category: "MARKET_MOD",
            discountType: "percentage",
            discountValue: 50,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 50,
        label: "Bonus 25.000 NC + Voucher Booster +100% (6 Jam)",
        bonusNc: 25000,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Voucher Booster +100% NC (6 Jam) (Reward Manager)",
            category: "NC_BOOSTER",
            discountType: "percentage",
            discountValue: 100,
            maxDiscount: 0,
            durationHours: 6,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 60,
        label: "Voucher Diskon Operasional Garasi 75%",
        bonusNc: 0,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Diskon Operasional Garasi 75% (Reward Manager)",
            category: "GARAGE_RENT",
            discountType: "percentage",
            discountValue: 75,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 70,
        label: "Voucher Diskon Beli Armada 40% + 2 Tiket Safebox",
        bonusNc: 0,
        penaltyTickets: 2,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Diskon Beli Armada 40% (Reward Manager)",
            category: "FLEET_BUY",
            discountType: "percentage",
            discountValue: 40,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 80,
        label: "Voucher Free 1x Servis Armada 100%",
        bonusNc: 0,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Free 1x Servis Armada (Reward Manager)",
            category: "FLEET_MAINTENANCE",
            discountType: "percentage",
            discountValue: 100,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
      {
        tier: 90,
        label: "1.500 L Fuel Garasi + 3 Tiket Safebox",
        bonusNc: 0,
        penaltyTickets: 3,
        fuelLiters: 1500,
        vouchers: [],
      },
      {
        tier: 100,
        label: "Bonus 50.000 NC + Voucher Diskon Beli Armada 75% + Title Top Manager",
        bonusNc: 50000,
        penaltyTickets: 0,
        fuelLiters: 0,
        vouchers: [
          {
            title: "Diskon Beli Armada 75% (Master Manager Reward)",
            category: "FLEET_BUY",
            discountType: "percentage",
            discountValue: 75,
            maxDiscount: 0,
            durationHours: 0,
            expireDays: 60,
          },
        ],
      },
    ],
  },
];
