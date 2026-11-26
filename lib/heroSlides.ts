export interface HeroSlideItem {
  imageUrl: string;
  postId?: string | null;
  authorName?: string | null;
  likesCount?: number;
  isFallback?: boolean;
}

export const DEFAULT_HERO_SLIDES: HeroSlideItem[] = [
  {
    imageUrl: "https://images.nismara.my.id/ets2_20251223_205632_00.webp",
    isFallback: true,
  },
  {
    imageUrl: "https://images.nismara.my.id/eut2_hq_68a2aa1f.webp",
    isFallback: true,
  },
  {
    imageUrl: "https://images.nismara.my.id/ets2_20251223_213322_00.webp",
    isFallback: true,
  },
];

/**
 * Menghasilkan label fase musim otomatis berdasarkan kuartal WIB (Asia/Jakarta):
 * - Q1 (Jan-Mar): Awal musim ("Musim Logistik YYYY Telah Dimulai")
 * - Q2 & Q3 (Apr-Sep): Pertengahan musim ("Pertengahan Musim Logistik YYYY")
 * - Q4 (Okt-Des): Akhir musim ("Akhir Musim Logistik YYYY")
 */
export function getSeasonBadgeLabel(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);

  const year =
    Number(parts.find((p) => p.type === "year")?.value) ||
    date.getUTCFullYear();
  const month =
    Number(parts.find((p) => p.type === "month")?.value) ||
    date.getUTCMonth() + 1;

  if (month <= 3) {
    return `Musim Logistik ${year} Telah Dimulai`;
  }
  if (month <= 9) {
    return `Pertengahan Musim Logistik ${year}`;
  }
  return `Akhir Musim Logistik ${year}`;
}
