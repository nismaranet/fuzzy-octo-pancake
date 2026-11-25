import clientPromise from "@/lib/mongodb";
import { redis } from "@/lib/redis";

const CACHE_KEY = "public:stats:360:v3";
const CACHE_TTL_SECONDS = 900; // 15 menit

const MONTH_NAMES_ID = [
  "",
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const MONTH_SHORT_ID = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export interface PeriodStats {
  key: string; // e.g. "2026-11", "2026-Q4", "2026"
  label: string; // e.g. "November 2026", "Q4 2026", "Tahun 2026"
  shortLabel: string; // e.g. "Nov 26", "Q4 26", "2026"
  logistics: {
    totalJobs: number;
    completedJobs: number;
    canceledJobs: number;
    completionRatePct: number;
    totalDistanceKm: number;
    totalDurationHours: number;
    totalRevenueNC: number;
    totalXp: number;
    hardcoreJobs: number;
    normalJobs: number;
    avgHardcoreRating: number;
    realMilesJobs: number;
    raceMilesJobs: number;
    realMilesKm: number;
    raceMilesKm: number;
    uniqueDrivers: number;
    ets2Jobs: number;
    atsJobs: number;
    spJobs: number;
    tmpJobs: number;
    avgDamageVehiclePct: number;
  };
  coaches: {
    totalJobs: number;
    completedJobs: number;
    canceledJobs: number;
    completionRatePct: number;
    totalDistanceKm: number;
    totalDurationHours: number;
    totalRevenueNC: number;
    totalXp: number;
    hardcoreJobs: number;
    normalJobs: number;
    avgHardcoreRating: number;
    realMilesJobs: number;
    raceMilesJobs: number;
    realMilesKm: number;
    raceMilesKm: number;
    totalPassengers: number;
    avgPassengersPerTrip: number;
    totalStops: number;
    uniqueDrivers: number;
    avgDamageVehiclePct: number;
  };
  community: {
    convoysCount: number;
    convoyParticipants: number;
    contractsCount: number;
    specialContractJobs: number;
    specialContractNC: number;
    ncBoostEventsCount: number;
    ncBoostParticipants: number;
    giveawaysCount: number;
    giveawayWinnersCount: number;
    giveawayTicketsCount: number;
    giveawayNcBurned: number;
    couponsCount: number;
    couponClaimsCount: number;
    couponNcClaimed: number;
    vouchersIssued: number;
    vouchersUsed: number;
    galleryPostsCount: number;
    galleryTotalLikes: number;
  };
  economyAndGames: {
    ncTransactionsCount: number;
    ncSpentTotal: number;
    ncVoucherDiscount: number;
    fuelTransactionsCount: number;
    fuelTotalLiters: number;
    fuelSystemLiters: number;
    fuelP2pLiters: number;
    fuelTotalVolumeNC: number;
    lottoPeriodsCount: number;
    lottoTicketsCount: number;
    lottoPrizeWonNC: number;
    scratchTicketsCount: number;
    scratchSpentNC: number;
    scratchPrizeWonNC: number;
    racingTicketsCount: number;
    racingBetNC: number;
    racingPrizeWonNC: number;
    quizAttemptsCount: number;
    quizPassedCount: number;
  };
}

export interface MetricDelta {
  periodA: number;
  periodB: number;
  delta: number;
  pctChange: number | null;
}

export interface PeriodComparison {
  periodA: { key: string; label: string };
  periodB: { key: string; label: string };
  logistics: {
    completedJobs: MetricDelta;
    totalDistanceKm: MetricDelta;
    totalRevenueNC: MetricDelta;
    completionRatePct: MetricDelta;
    hardcoreJobs: MetricDelta;
    normalJobs: MetricDelta;
    realMilesJobs: MetricDelta;
    raceMilesJobs: MetricDelta;
    realMilesKm: MetricDelta;
    raceMilesKm: MetricDelta;
    uniqueDrivers: MetricDelta;
  };
  coaches: {
    completedJobs: MetricDelta;
    totalPassengers: MetricDelta;
    totalStops: MetricDelta;
    totalDistanceKm: MetricDelta;
    totalRevenueNC: MetricDelta;
    hardcoreJobs: MetricDelta;
    realMilesJobs: MetricDelta;
    raceMilesJobs: MetricDelta;
  };
  community: {
    convoysCount: MetricDelta;
    convoyParticipants: MetricDelta;
    specialContractJobs: MetricDelta;
    giveawaysCount: MetricDelta;
    giveawayTicketsCount: MetricDelta;
    galleryPostsCount: MetricDelta;
  };
  economyAndGames: {
    ncSpentTotal: MetricDelta;
    fuelTotalLiters: MetricDelta;
    lottoTicketsCount: MetricDelta;
    scratchTicketsCount: MetricDelta;
    racingTicketsCount: MetricDelta;
  };
}

export interface PublicStatisticsPayload {
  generatedAt: string;
  generatedAtWIB: string;
  timezone: "Asia/Jakarta";
  currencyDisclaimer: string;
  overview: {
    totalRegisteredDrivers: number;
    activeTeamsCount: number;
    totalLogisticsJobs: number;
    totalLogisticsDistanceKm: number;
    totalCoachesTrips: number;
    totalCoachesPassengers: number;
    totalCoachesDistanceKm: number;
    totalCombinedDistanceKm: number;
    totalConvoys: number;
    totalSpecialContracts: number;
    totalGiveaways: number;
    totalFuelLitersTraded: number;
    totalGalleryPosts: number;
    dataRange: { firstMonth: string; latestMonth: string };
  };
  topHighlights: {
    topTruckCargosByNC: Array<{ cargoName: string; jobs: number; revenueNC: number }>;
    topCoachModels: Array<{ model: string; trips: number; passengers: number }>;
    topCoachRoutes: Array<{ route: string; trips: number; passengers: number }>;
  };
  monthly: PeriodStats[];
  quarterly: PeriodStats[];
  yearly: PeriodStats[];
  defaultComparisons: {
    mom: PeriodComparison | null;
    qoq: PeriodComparison | null;
    yoy: PeriodComparison | null;
  };
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function diffValue(a: number, b: number): MetricDelta {
  const va = round2(a);
  const vb = round2(b);
  const delta = round2(vb - va);
  const pctChange = va === 0 ? (vb === 0 ? 0 : null) : round2(((vb - va) / Math.abs(va)) * 100);
  return { periodA: va, periodB: vb, delta, pctChange };
}

export function comparePeriodStats(a: PeriodStats, b: PeriodStats): PeriodComparison {
  return {
    periodA: { key: a.key, label: a.label },
    periodB: { key: b.key, label: b.label },
    logistics: {
      completedJobs: diffValue(a.logistics.completedJobs, b.logistics.completedJobs),
      totalDistanceKm: diffValue(a.logistics.totalDistanceKm, b.logistics.totalDistanceKm),
      totalRevenueNC: diffValue(a.logistics.totalRevenueNC, b.logistics.totalRevenueNC),
      completionRatePct: diffValue(a.logistics.completionRatePct, b.logistics.completionRatePct),
      hardcoreJobs: diffValue(a.logistics.hardcoreJobs, b.logistics.hardcoreJobs),
      normalJobs: diffValue(a.logistics.normalJobs, b.logistics.normalJobs),
      realMilesJobs: diffValue(a.logistics.realMilesJobs, b.logistics.realMilesJobs),
      raceMilesJobs: diffValue(a.logistics.raceMilesJobs, b.logistics.raceMilesJobs),
      realMilesKm: diffValue(a.logistics.realMilesKm, b.logistics.realMilesKm),
      raceMilesKm: diffValue(a.logistics.raceMilesKm, b.logistics.raceMilesKm),
      uniqueDrivers: diffValue(a.logistics.uniqueDrivers, b.logistics.uniqueDrivers),
    },
    coaches: {
      completedJobs: diffValue(a.coaches.completedJobs, b.coaches.completedJobs),
      totalPassengers: diffValue(a.coaches.totalPassengers, b.coaches.totalPassengers),
      totalStops: diffValue(a.coaches.totalStops, b.coaches.totalStops),
      totalDistanceKm: diffValue(a.coaches.totalDistanceKm, b.coaches.totalDistanceKm),
      totalRevenueNC: diffValue(a.coaches.totalRevenueNC, b.coaches.totalRevenueNC),
      hardcoreJobs: diffValue(a.coaches.hardcoreJobs, b.coaches.hardcoreJobs),
      realMilesJobs: diffValue(a.coaches.realMilesJobs, b.coaches.realMilesJobs),
      raceMilesJobs: diffValue(a.coaches.raceMilesJobs, b.coaches.raceMilesJobs),
    },
    community: {
      convoysCount: diffValue(a.community.convoysCount, b.community.convoysCount),
      convoyParticipants: diffValue(a.community.convoyParticipants, b.community.convoyParticipants),
      specialContractJobs: diffValue(a.community.specialContractJobs, b.community.specialContractJobs),
      giveawaysCount: diffValue(a.community.giveawaysCount, b.community.giveawaysCount),
      giveawayTicketsCount: diffValue(a.community.giveawayTicketsCount, b.community.giveawayTicketsCount),
      galleryPostsCount: diffValue(a.community.galleryPostsCount, b.community.galleryPostsCount),
    },
    economyAndGames: {
      ncSpentTotal: diffValue(a.economyAndGames.ncSpentTotal, b.economyAndGames.ncSpentTotal),
      fuelTotalLiters: diffValue(a.economyAndGames.fuelTotalLiters, b.economyAndGames.fuelTotalLiters),
      lottoTicketsCount: diffValue(a.economyAndGames.lottoTicketsCount, b.economyAndGames.lottoTicketsCount),
      scratchTicketsCount: diffValue(a.economyAndGames.scratchTicketsCount, b.economyAndGames.scratchTicketsCount),
      racingTicketsCount: diffValue(a.economyAndGames.racingTicketsCount, b.economyAndGames.racingTicketsCount),
    },
  };
}

function createEmptyPeriod(key: string, label: string, shortLabel: string): PeriodStats {
  return {
    key,
    label,
    shortLabel,
    logistics: {
      totalJobs: 0,
      completedJobs: 0,
      canceledJobs: 0,
      completionRatePct: 0,
      totalDistanceKm: 0,
      totalDurationHours: 0,
      totalRevenueNC: 0,
      totalXp: 0,
      hardcoreJobs: 0,
      normalJobs: 0,
      avgHardcoreRating: 0,
      realMilesJobs: 0,
      raceMilesJobs: 0,
      realMilesKm: 0,
      raceMilesKm: 0,
      uniqueDrivers: 0,
      ets2Jobs: 0,
      atsJobs: 0,
      spJobs: 0,
      tmpJobs: 0,
      avgDamageVehiclePct: 0,
    },
    coaches: {
      totalJobs: 0,
      completedJobs: 0,
      canceledJobs: 0,
      completionRatePct: 0,
      totalDistanceKm: 0,
      totalDurationHours: 0,
      totalRevenueNC: 0,
      totalXp: 0,
      hardcoreJobs: 0,
      normalJobs: 0,
      avgHardcoreRating: 0,
      realMilesJobs: 0,
      raceMilesJobs: 0,
      realMilesKm: 0,
      raceMilesKm: 0,
      totalPassengers: 0,
      avgPassengersPerTrip: 0,
      totalStops: 0,
      uniqueDrivers: 0,
      avgDamageVehiclePct: 0,
    },
    community: {
      convoysCount: 0,
      convoyParticipants: 0,
      contractsCount: 0,
      specialContractJobs: 0,
      specialContractNC: 0,
      ncBoostEventsCount: 0,
      ncBoostParticipants: 0,
      giveawaysCount: 0,
      giveawayWinnersCount: 0,
      giveawayTicketsCount: 0,
      giveawayNcBurned: 0,
      couponsCount: 0,
      couponClaimsCount: 0,
      couponNcClaimed: 0,
      vouchersIssued: 0,
      vouchersUsed: 0,
      galleryPostsCount: 0,
      galleryTotalLikes: 0,
    },
    economyAndGames: {
      ncTransactionsCount: 0,
      ncSpentTotal: 0,
      ncVoucherDiscount: 0,
      fuelTransactionsCount: 0,
      fuelTotalLiters: 0,
      fuelSystemLiters: 0,
      fuelP2pLiters: 0,
      fuelTotalVolumeNC: 0,
      lottoPeriodsCount: 0,
      lottoTicketsCount: 0,
      lottoPrizeWonNC: 0,
      scratchTicketsCount: 0,
      scratchSpentNC: 0,
      scratchPrizeWonNC: 0,
      racingTicketsCount: 0,
      racingBetNC: 0,
      racingPrizeWonNC: 0,
      quizAttemptsCount: 0,
      quizPassedCount: 0,
    },
  };
}

function formatMonthLabels(ym: string): { label: string; shortLabel: string } {
  const [y, mStr] = ym.split("-");
  const m = Number(mStr);
  return {
    label: `${MONTH_NAMES_ID[m] || mStr} ${y}`,
    shortLabel: `${MONTH_SHORT_ID[m] || mStr} ${y.slice(-2)}`,
  };
}

function enumerateMonths(startYm: string, endYm: string): string[] {
  const [sy, sm] = startYm.split("-").map(Number);
  const [ey, em] = endYm.split("-").map(Number);
  const res: string[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    res.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return res;
}

function rollupPeriods(
  months: PeriodStats[],
  groupKeyFn: (ym: string) => { key: string; label: string; shortLabel: string }
): PeriodStats[] {
  const map = new Map<
    string,
    {
      stats: PeriodStats;
      logDmgSum: number;
      coachDmgSum: number;
      logHcRatingSum: number;
      coachHcRatingSum: number;
      maxLogDrivers: number;
      maxCoachDrivers: number;
    }
  >();

  for (const m of months) {
    const { key, label, shortLabel } = groupKeyFn(m.key);
    let entry = map.get(key);
    if (!entry) {
      entry = {
        stats: createEmptyPeriod(key, label, shortLabel),
        logDmgSum: 0,
        coachDmgSum: 0,
        logHcRatingSum: 0,
        coachHcRatingSum: 0,
        maxLogDrivers: 0,
        maxCoachDrivers: 0,
      };
      map.set(key, entry);
    }

    const s = entry.stats;
    // Logistics
    s.logistics.totalJobs += m.logistics.totalJobs;
    s.logistics.completedJobs += m.logistics.completedJobs;
    s.logistics.canceledJobs += m.logistics.canceledJobs;
    s.logistics.totalDistanceKm += m.logistics.totalDistanceKm;
    s.logistics.totalDurationHours += m.logistics.totalDurationHours;
    s.logistics.totalRevenueNC += m.logistics.totalRevenueNC;
    s.logistics.totalXp += m.logistics.totalXp;
    s.logistics.hardcoreJobs += m.logistics.hardcoreJobs;
    s.logistics.normalJobs += m.logistics.normalJobs;
    s.logistics.realMilesJobs += m.logistics.realMilesJobs;
    s.logistics.raceMilesJobs += m.logistics.raceMilesJobs;
    s.logistics.realMilesKm += m.logistics.realMilesKm;
    s.logistics.raceMilesKm += m.logistics.raceMilesKm;
    s.logistics.ets2Jobs += m.logistics.ets2Jobs;
    s.logistics.atsJobs += m.logistics.atsJobs;
    s.logistics.spJobs += m.logistics.spJobs;
    s.logistics.tmpJobs += m.logistics.tmpJobs;
    entry.logDmgSum += m.logistics.avgDamageVehiclePct * m.logistics.completedJobs;
    entry.logHcRatingSum += m.logistics.avgHardcoreRating * m.logistics.hardcoreJobs;
    entry.maxLogDrivers = Math.max(entry.maxLogDrivers, m.logistics.uniqueDrivers);

    // Coaches
    s.coaches.totalJobs += m.coaches.totalJobs;
    s.coaches.completedJobs += m.coaches.completedJobs;
    s.coaches.canceledJobs += m.coaches.canceledJobs;
    s.coaches.totalDistanceKm += m.coaches.totalDistanceKm;
    s.coaches.totalDurationHours += m.coaches.totalDurationHours;
    s.coaches.totalRevenueNC += m.coaches.totalRevenueNC;
    s.coaches.totalXp += m.coaches.totalXp;
    s.coaches.hardcoreJobs += m.coaches.hardcoreJobs;
    s.coaches.normalJobs += m.coaches.normalJobs;
    s.coaches.realMilesJobs += m.coaches.realMilesJobs;
    s.coaches.raceMilesJobs += m.coaches.raceMilesJobs;
    s.coaches.realMilesKm += m.coaches.realMilesKm;
    s.coaches.raceMilesKm += m.coaches.raceMilesKm;
    s.coaches.totalPassengers += m.coaches.totalPassengers;
    s.coaches.totalStops += m.coaches.totalStops;
    entry.coachDmgSum += m.coaches.avgDamageVehiclePct * m.coaches.completedJobs;
    entry.coachHcRatingSum += m.coaches.avgHardcoreRating * m.coaches.hardcoreJobs;
    entry.maxCoachDrivers = Math.max(entry.maxCoachDrivers, m.coaches.uniqueDrivers);

    // Community
    s.community.convoysCount += m.community.convoysCount;
    s.community.convoyParticipants += m.community.convoyParticipants;
    s.community.contractsCount += m.community.contractsCount;
    s.community.specialContractJobs += m.community.specialContractJobs;
    s.community.specialContractNC += m.community.specialContractNC;
    s.community.ncBoostEventsCount += m.community.ncBoostEventsCount;
    s.community.ncBoostParticipants += m.community.ncBoostParticipants;
    s.community.giveawaysCount += m.community.giveawaysCount;
    s.community.giveawayWinnersCount += m.community.giveawayWinnersCount;
    s.community.giveawayTicketsCount += m.community.giveawayTicketsCount;
    s.community.giveawayNcBurned += m.community.giveawayNcBurned;
    s.community.couponsCount += m.community.couponsCount;
    s.community.couponClaimsCount += m.community.couponClaimsCount;
    s.community.couponNcClaimed += m.community.couponNcClaimed;
    s.community.vouchersIssued += m.community.vouchersIssued;
    s.community.vouchersUsed += m.community.vouchersUsed;
    s.community.galleryPostsCount += m.community.galleryPostsCount;
    s.community.galleryTotalLikes += m.community.galleryTotalLikes;

    // Economy & Games
    s.economyAndGames.ncTransactionsCount += m.economyAndGames.ncTransactionsCount;
    s.economyAndGames.ncSpentTotal += m.economyAndGames.ncSpentTotal;
    s.economyAndGames.ncVoucherDiscount += m.economyAndGames.ncVoucherDiscount;
    s.economyAndGames.fuelTransactionsCount += m.economyAndGames.fuelTransactionsCount;
    s.economyAndGames.fuelTotalLiters += m.economyAndGames.fuelTotalLiters;
    s.economyAndGames.fuelSystemLiters += m.economyAndGames.fuelSystemLiters;
    s.economyAndGames.fuelP2pLiters += m.economyAndGames.fuelP2pLiters;
    s.economyAndGames.fuelTotalVolumeNC += m.economyAndGames.fuelTotalVolumeNC;
    s.economyAndGames.lottoPeriodsCount += m.economyAndGames.lottoPeriodsCount;
    s.economyAndGames.lottoTicketsCount += m.economyAndGames.lottoTicketsCount;
    s.economyAndGames.lottoPrizeWonNC += m.economyAndGames.lottoPrizeWonNC;
    s.economyAndGames.scratchTicketsCount += m.economyAndGames.scratchTicketsCount;
    s.economyAndGames.scratchSpentNC += m.economyAndGames.scratchSpentNC;
    s.economyAndGames.scratchPrizeWonNC += m.economyAndGames.scratchPrizeWonNC;
    s.economyAndGames.racingTicketsCount += m.economyAndGames.racingTicketsCount;
    s.economyAndGames.racingBetNC += m.economyAndGames.racingBetNC;
    s.economyAndGames.racingPrizeWonNC += m.economyAndGames.racingPrizeWonNC;
    s.economyAndGames.quizAttemptsCount += m.economyAndGames.quizAttemptsCount;
    s.economyAndGames.quizPassedCount += m.economyAndGames.quizPassedCount;
  }

  const out: PeriodStats[] = [];
  for (const entry of map.values()) {
    const s = entry.stats;
    s.logistics.completionRatePct =
      s.logistics.totalJobs > 0 ? round2((s.logistics.completedJobs / s.logistics.totalJobs) * 100) : 0;
    s.logistics.totalDistanceKm = round2(s.logistics.totalDistanceKm);
    s.logistics.totalDurationHours = round2(s.logistics.totalDurationHours);
    s.logistics.totalRevenueNC = round2(s.logistics.totalRevenueNC);
    s.logistics.totalXp = Math.round(s.logistics.totalXp);
    s.logistics.realMilesKm = round2(s.logistics.realMilesKm);
    s.logistics.raceMilesKm = round2(s.logistics.raceMilesKm);
    s.logistics.avgHardcoreRating =
      s.logistics.hardcoreJobs > 0 ? round2(entry.logHcRatingSum / s.logistics.hardcoreJobs) : 0;
    s.logistics.uniqueDrivers = entry.maxLogDrivers;
    s.logistics.avgDamageVehiclePct =
      s.logistics.completedJobs > 0 ? round2(entry.logDmgSum / s.logistics.completedJobs) : 0;

    s.coaches.completionRatePct =
      s.coaches.totalJobs > 0 ? round2((s.coaches.completedJobs / s.coaches.totalJobs) * 100) : 0;
    s.coaches.totalDistanceKm = round2(s.coaches.totalDistanceKm);
    s.coaches.totalDurationHours = round2(s.coaches.totalDurationHours);
    s.coaches.totalRevenueNC = round2(s.coaches.totalRevenueNC);
    s.coaches.totalXp = Math.round(s.coaches.totalXp);
    s.coaches.realMilesKm = round2(s.coaches.realMilesKm);
    s.coaches.raceMilesKm = round2(s.coaches.raceMilesKm);
    s.coaches.avgHardcoreRating =
      s.coaches.hardcoreJobs > 0 ? round2(entry.coachHcRatingSum / s.coaches.hardcoreJobs) : 0;
    s.coaches.avgPassengersPerTrip =
      s.coaches.completedJobs > 0 ? round2(s.coaches.totalPassengers / s.coaches.completedJobs) : 0;
    s.coaches.uniqueDrivers = entry.maxCoachDrivers;
    s.coaches.avgDamageVehiclePct =
      s.coaches.completedJobs > 0 ? round2(entry.coachDmgSum / s.coaches.completedJobs) : 0;

    s.community.specialContractNC = round2(s.community.specialContractNC);
    s.community.giveawayNcBurned = round2(s.community.giveawayNcBurned);
    s.community.couponNcClaimed = round2(s.community.couponNcClaimed);

    s.economyAndGames.ncSpentTotal = round2(s.economyAndGames.ncSpentTotal);
    s.economyAndGames.ncVoucherDiscount = round2(s.economyAndGames.ncVoucherDiscount);
    s.economyAndGames.fuelTotalVolumeNC = round2(s.economyAndGames.fuelTotalVolumeNC);
    s.economyAndGames.lottoPrizeWonNC = round2(s.economyAndGames.lottoPrizeWonNC);
    s.economyAndGames.scratchSpentNC = round2(s.economyAndGames.scratchSpentNC);
    s.economyAndGames.scratchPrizeWonNC = round2(s.economyAndGames.scratchPrizeWonNC);
    s.economyAndGames.racingBetNC = round2(s.economyAndGames.racingBetNC);
    s.economyAndGames.racingPrizeWonNC = round2(s.economyAndGames.racingPrizeWonNC);

    out.push(s);
  }

  return out.sort((a, b) => a.key.localeCompare(b.key));
}

function getCurrentWibYm(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getPublicStatistics(forceRefresh = false): Promise<PublicStatisticsPayload> {
  if (!forceRefresh) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as PublicStatisticsPayload;
      }
    } catch {
      // Abaikan jika Redis sedang unavailable; fallback langsung ke MongoDB
    }
  }

  const client = await clientPromise;
  const db = client.db();

  const isCoachExpr = {
    $or: [
      { $eq: ["$jobCategory", "coach"] },
      { $in: ["$cargoId", ["Passengers", "bus_company_job", "bus_tourist_job"]] },
      { $regexMatch: { input: { $ifNull: ["$marketType", ""] }, regex: /^bus/i } },
      { $regexMatch: { input: { $ifNull: ["$statsType", ""] }, regex: /^coaches/i } },
    ],
  };

  const [
    totalRegisteredDrivers,
    activeTeamsCount,
    jobMonthlyAgg,
    topCargosAgg,
    topCoachModelsAgg,
    topCoachRoutesAgg,
    convoyAgg,
    contractAgg,
    ncEventAgg,
    giveawayAgg,
    giveawayTicketAgg,
    couponAgg,
    voucherAgg,
    galleryAgg,
    txNcAgg,
    fuelAgg,
    lottoPeriodAgg,
    lottoTicketAgg,
    scratchAgg,
    racingAgg,
    quizAgg,
  ] = await Promise.all([
    db.collection("users").countDocuments({ "accountHold.status": { $ne: true } }),
    db.collection("teams").countDocuments({}),

    // 1. JobHistories grouped by WIB month + division (truck vs coach)
    db
      .collection("jobhistories")
      .aggregate([
        { $match: { createdAt: { $type: "date" } } },
        {
          $project: {
            ym: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Jakarta" } },
            div: { $cond: [isCoachExpr, "coach", "truck"] },
            isCompleted: { $eq: ["$jobStatus", "COMPLETED"] },
            isCanceled: { $in: ["$jobStatus", ["CANCELED", "CANCELLED"]] },
            distanceKm: { $ifNull: ["$distanceKm", 0] },
            durationSeconds: { $ifNull: ["$durationSeconds", 0] },
            ncTotal: { $ifNull: ["$nc.total", 0] },
            xpTotal: { $ifNull: ["$xp.total", 0] },
            isHardcore: { $eq: ["$isHardcore", true] },
            hardcoreRating: { $ifNull: ["$hardcoreRating", 0] },
            statsType: { $ifNull: ["$statsType", ""] },
            driverId: "$driverId",
            game: { $ifNull: ["$game", ""] },
            gameId: { $toString: { $ifNull: ["$gameId", ""] } },
            gameMode: { $ifNull: ["$gameMode", ""] },
            dmgVeh: { $ifNull: ["$damage.vehicle", 0] },
            totalPassengers: { $ifNull: ["$totalPassengers", 0] },
            stopsCount: {
              $cond: [{ $isArray: "$stops" }, { $size: "$stops" }, 0],
            },
          },
        },
        {
          $group: {
            _id: { ym: "$ym", div: "$div" },
            totalJobs: { $sum: 1 },
            completedJobs: { $sum: { $cond: ["$isCompleted", 1, 0] } },
            canceledJobs: { $sum: { $cond: ["$isCanceled", 1, 0] } },
            totalDistanceKm: { $sum: { $cond: ["$isCompleted", "$distanceKm", 0] } },
            totalDurationSeconds: { $sum: { $cond: ["$isCompleted", "$durationSeconds", 0] } },
            totalRevenueNC: { $sum: { $cond: ["$isCompleted", "$ncTotal", 0] } },
            totalXp: { $sum: { $cond: ["$isCompleted", "$xpTotal", 0] } },
            hardcoreJobs: {
              $sum: { $cond: [{ $and: ["$isCompleted", "$isHardcore"] }, 1, 0] },
            },
            hardcoreRatingSum: {
              $sum: { $cond: [{ $and: ["$isCompleted", "$isHardcore"] }, "$hardcoreRating", 0] },
            },
            realMilesJobs: {
              $sum: {
                $cond: [
                  { $and: ["$isCompleted", { $regexMatch: { input: "$statsType", regex: /real\s*miles/i } }] },
                  1,
                  0,
                ],
              },
            },
            raceMilesJobs: {
              $sum: {
                $cond: [
                  { $and: ["$isCompleted", { $regexMatch: { input: "$statsType", regex: /race\s*miles/i } }] },
                  1,
                  0,
                ],
              },
            },
            realMilesKm: {
              $sum: {
                $cond: [
                  { $and: ["$isCompleted", { $regexMatch: { input: "$statsType", regex: /real\s*miles/i } }] },
                  "$distanceKm",
                  0,
                ],
              },
            },
            raceMilesKm: {
              $sum: {
                $cond: [
                  { $and: ["$isCompleted", { $regexMatch: { input: "$statsType", regex: /race\s*miles/i } }] },
                  "$distanceKm",
                  0,
                ],
              },
            },
            driversSet: { $addToSet: { $cond: ["$isCompleted", "$driverId", null] } },
            ets2Jobs: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      "$isCompleted",
                      {
                        $or: [
                          { $eq: ["$gameId", "1"] },
                          { $regexMatch: { input: "$game", regex: /euro\s*truck|ets/i } },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            atsJobs: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      "$isCompleted",
                      {
                        $or: [
                          { $eq: ["$gameId", "2"] },
                          { $regexMatch: { input: "$game", regex: /american\s*truck|ats/i } },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            spJobs: {
              $sum: {
                $cond: [
                  { $and: ["$isCompleted", { $regexMatch: { input: "$gameMode", regex: /sp|single/i } }] },
                  1,
                  0,
                ],
              },
            },
            tmpJobs: {
              $sum: {
                $cond: [
                  { $and: ["$isCompleted", { $regexMatch: { input: "$gameMode", regex: /tmp|truckersmp/i } }] },
                  1,
                  0,
                ],
              },
            },
            dmgVehSum: { $sum: { $cond: ["$isCompleted", "$dmgVeh", 0] } },
            totalPassengers: { $sum: { $cond: ["$isCompleted", "$totalPassengers", 0] } },
            totalStops: { $sum: { $cond: ["$isCompleted", "$stopsCount", 0] } },
          },
        },
      ])
      .toArray(),

    // 2. Top Truck Cargos
    db
      .collection("jobhistories")
      .aggregate([
        {
          $match: {
            jobStatus: "COMPLETED",
            jobCategory: { $ne: "coach" },
            cargoName: { $nin: [null, "", "Passengers"] },
          },
        },
        {
          $group: {
            _id: "$cargoName",
            jobs: { $sum: 1 },
            revenueNC: { $sum: { $ifNull: ["$nc.total", 0] } },
          },
        },
        { $sort: { revenueNC: -1 } },
        { $limit: 5 },
      ])
      .toArray(),

    // 3. Top Coach Bus Models
    db
      .collection("jobhistories")
      .aggregate([
        {
          $match: {
            jobStatus: "COMPLETED",
            $or: [{ jobCategory: "coach" }, { marketType: { $regex: /^bus/i } }],
          },
        },
        {
          $project: {
            model: {
              $trim: {
                input: {
                  $concat: [
                    { $ifNull: ["$vehicle.brand", ""] },
                    " ",
                    { $ifNull: ["$vehicle.model", ""] },
                  ],
                },
              },
            },
            totalPassengers: { $ifNull: ["$totalPassengers", 0] },
          },
        },
        { $match: { model: { $ne: "" } } },
        {
          $group: {
            _id: "$model",
            trips: { $sum: 1 },
            passengers: { $sum: "$totalPassengers" },
          },
        },
        { $sort: { trips: -1 } },
        { $limit: 5 },
      ])
      .toArray(),

    // 4. Top Coach Bus Routes
    db
      .collection("jobhistories")
      .aggregate([
        {
          $match: {
            jobStatus: "COMPLETED",
            $or: [{ jobCategory: "coach" }, { marketType: { $regex: /^bus/i } }],
            sourceCity: { $nin: [null, ""] },
            destinationCity: { $nin: [null, ""] },
          },
        },
        {
          $group: {
            _id: { $concat: ["$sourceCity", " → ", "$destinationCity"] },
            trips: { $sum: 1 },
            passengers: { $sum: { $ifNull: ["$totalPassengers", 0] } },
          },
        },
        { $sort: { trips: -1 } },
        { $limit: 5 },
      ])
      .toArray(),

    // 5. Convoy Lobby
    db
      .collection("convoylobby")
      .aggregate([
        { $match: { startDate: { $type: "date" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$startDate", timezone: "Asia/Jakarta" } },
            count: { $sum: 1 },
            participants: { $sum: { $cond: [{ $isArray: "$partisipan" }, { $size: "$partisipan" }, 0] } },
          },
        },
      ])
      .toArray(),

    // 6. Special Contracts (collection: contracts)
    db
      .collection("contracts")
      .aggregate([
        { $match: { startDate: { $type: "date" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$startDate", timezone: "Asia/Jakarta" } },
            count: { $sum: 1 },
            jobs: { $sum: { $ifNull: ["$completedContracts", 0] } },
            nc: { $sum: { $ifNull: ["$totalNCEarned", 0] } },
          },
        },
      ])
      .toArray(),

    // 7. NC Boost Events
    db
      .collection("ncevents")
      .aggregate([
        { $match: { createdAt: { $type: "date" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Jakarta" } },
            count: { $sum: 1 },
            participants: { $sum: { $cond: [{ $isArray: "$participants" }, { $size: "$participants" }, 0] } },
          },
        },
      ])
      .toArray(),

    // 8. Giveaways
    db
      .collection("giveaways")
      .aggregate([
        { $match: { startDate: { $type: "date" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$startDate", timezone: "Asia/Jakarta" } },
            count: { $sum: 1 },
            winners: { $sum: { $cond: [{ $isArray: "$winners" }, { $size: "$winners" }, 0] } },
            ncBurned: { $sum: { $ifNull: ["$stats.totalNcBurned", 0] } },
          },
        },
      ])
      .toArray(),

    // 9. Giveaway Tickets
    db
      .collection("giveawaytickets")
      .aggregate([
        { $match: { createdAt: { $type: "date" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Jakarta" } },
            count: { $sum: 1 },
            costNC: { $sum: { $ifNull: ["$costNC", 0] } },
          },
        },
      ])
      .toArray(),

    // 10. Coupons
    db
      .collection("coupons")
      .aggregate([
        { $match: { startDate: { $type: "date" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$startDate", timezone: "Asia/Jakarta" } },
            count: { $sum: 1 },
            claims: { $sum: { $cond: [{ $isArray: "$driverClaims" }, { $size: "$driverClaims" }, 0] } },
            ncClaimed: { $sum: { $ifNull: ["$totalNcClaimed", 0] } },
          },
        },
      ])
      .toArray(),

    // 11. User Vouchers
    db
      .collection("uservouchers")
      .aggregate([
        { $match: { createdAt: { $type: "date" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Jakarta" } },
            issued: { $sum: 1 },
            used: { $sum: { $cond: [{ $eq: ["$status", "USED"] }, 1, 0] } },
          },
        },
      ])
      .toArray(),

    // 12. Gallery Posts
    db
      .collection("gallery_posts")
      .aggregate([
        { $match: { createdAt: { $type: "date" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Jakarta" } },
            posts: { $sum: 1 },
            likes: { $sum: { $cond: [{ $isArray: "$likes" }, { $size: "$likes" }, 0] } },
          },
        },
      ])
      .toArray(),

    // 13. NC Transactions ONLY (STRICTLY exclude real-money IDR donations!)
    db
      .collection("transactions")
      .aggregate([
        {
          $match: {
            createdAt: { $type: "date" },
            currency: "NC",
            status: { $in: ["success", "completed", "paid"] },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Jakarta" } },
            count: { $sum: 1 },
            spentNC: { $sum: { $ifNull: ["$amount", 0] } },
            voucherDiscount: { $sum: { $ifNull: ["$metadata.voucherDiscount", 0] } },
          },
        },
      ])
      .toArray(),

    // 14. Fuel Market Transactions
    db
      .collection("fueltransactions")
      .aggregate([
        { $match: { createdAt: { $type: "date" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Jakarta" } },
            count: { $sum: 1 },
            liters: { $sum: { $ifNull: ["$amount", 0] } },
            sysLiters: { $sum: { $cond: [{ $eq: ["$type", "system"] }, { $ifNull: ["$amount", 0] }, 0] } },
            p2pLiters: { $sum: { $cond: [{ $eq: ["$type", "p2p"] }, { $ifNull: ["$amount", 0] }, 0] } },
            volumeNC: { $sum: { $ifNull: ["$totalPrice", 0] } },
          },
        },
      ])
      .toArray(),

    // 15. Lotto Periods
    db
      .collection("lottoperiods")
      .aggregate([
        { $match: { startDate: { $type: "date" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$startDate", timezone: "Asia/Jakarta" } },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),

    // 16. Lotto Tickets
    db
      .collection("lottotickets")
      .aggregate([
        { $match: { createdAt: { $type: "date" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Jakarta" } },
            count: { $sum: 1 },
            prizeWonNC: { $sum: { $ifNull: ["$prizeWon", 0] } },
          },
        },
      ])
      .toArray(),

    // 17. Scratchers
    db
      .collection("scratchtickets")
      .aggregate([
        { $match: { createdAt: { $type: "date" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Jakarta" } },
            count: { $sum: 1 },
            spentNC: { $sum: { $ifNull: ["$price", 0] } },
            prizeWonNC: { $sum: { $ifNull: ["$prizeWon", 0] } },
          },
        },
      ])
      .toArray(),

    // 18. Truck Racing
    db
      .collection("racingtickets")
      .aggregate([
        { $match: { createdAt: { $type: "date" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Jakarta" } },
            count: { $sum: 1 },
            betNC: { $sum: { $ifNull: ["$betAmount", 0] } },
            prizeWonNC: { $sum: { $ifNull: ["$prizeWon", 0] } },
          },
        },
      ])
      .toArray(),

    // 19. Quiz Attempts
    db
      .collection("quizattempts")
      .aggregate([
        { $match: { createdAt: { $type: "date" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Jakarta" } },
            count: { $sum: 1 },
            passed: { $sum: { $cond: [{ $eq: ["$passed", true] }, 1, 0] } },
          },
        },
      ])
      .toArray(),
  ]);

  // Determine month span from earliest jobhistories month to current WIB month
  const allJobYms = jobMonthlyAgg.map((r: any) => String(r._id?.ym || "")).filter(Boolean).sort();
  const currentYm = getCurrentWibYm();
  const firstYm = allJobYms[0] || currentYm;
  const lastYm = allJobYms[allJobYms.length - 1] && allJobYms[allJobYms.length - 1] > currentYm
    ? allJobYms[allJobYms.length - 1]
    : currentYm;

  const monthKeys = enumerateMonths(firstYm, lastYm);
  const monthMap = new Map<string, PeriodStats>();
  for (const ym of monthKeys) {
    const { label, shortLabel } = formatMonthLabels(ym);
    monthMap.set(ym, createEmptyPeriod(ym, label, shortLabel));
  }

  const getBucket = (ym: string) => {
    if (!ym || !monthMap.has(ym)) return null;
    return monthMap.get(ym)!;
  };

  for (const row of jobMonthlyAgg as any[]) {
    const b = getBucket(row._id?.ym);
    if (!b) continue;
    const uniqueDrivers = Array.isArray(row.driversSet)
      ? row.driversSet.filter((d: any) => d !== null && d !== undefined && d !== "").length
      : 0;
    const completed = Number(row.completedJobs || 0);
    const total = Number(row.totalJobs || 0);
    const hardcoreJobs = Number(row.hardcoreJobs || 0);
    const normalJobs = Math.max(0, completed - hardcoreJobs);
    const avgHardcoreRating =
      hardcoreJobs > 0 ? round2(Number(row.hardcoreRatingSum || 0) / hardcoreJobs) : 0;
    const realMilesJobs = Number(row.realMilesJobs || 0);
    const raceMilesJobs = Number(row.raceMilesJobs || 0);
    const realMilesKm = round2(row.realMilesKm || 0);
    const raceMilesKm = round2(row.raceMilesKm || 0);
    const avgDmg = completed > 0 ? round2(Number(row.dmgVehSum || 0) / completed) : 0;

    if (row._id?.div === "coach") {
      b.coaches = {
        totalJobs: total,
        completedJobs: completed,
        canceledJobs: Number(row.canceledJobs || 0),
        completionRatePct: total > 0 ? round2((completed / total) * 100) : 0,
        totalDistanceKm: round2(row.totalDistanceKm || 0),
        totalDurationHours: round2((row.totalDurationSeconds || 0) / 3600),
        totalRevenueNC: round2(row.totalRevenueNC || 0),
        totalXp: Math.round(row.totalXp || 0),
        hardcoreJobs,
        normalJobs,
        avgHardcoreRating,
        realMilesJobs,
        raceMilesJobs,
        realMilesKm,
        raceMilesKm,
        totalPassengers: Math.round(row.totalPassengers || 0),
        avgPassengersPerTrip: completed > 0 ? round2((row.totalPassengers || 0) / completed) : 0,
        totalStops: Math.round(row.totalStops || 0),
        uniqueDrivers,
        avgDamageVehiclePct: avgDmg,
      };
    } else {
      b.logistics = {
        totalJobs: total,
        completedJobs: completed,
        canceledJobs: Number(row.canceledJobs || 0),
        completionRatePct: total > 0 ? round2((completed / total) * 100) : 0,
        totalDistanceKm: round2(row.totalDistanceKm || 0),
        totalDurationHours: round2((row.totalDurationSeconds || 0) / 3600),
        totalRevenueNC: round2(row.totalRevenueNC || 0),
        totalXp: Math.round(row.totalXp || 0),
        hardcoreJobs,
        normalJobs,
        avgHardcoreRating,
        realMilesJobs,
        raceMilesJobs,
        realMilesKm,
        raceMilesKm,
        uniqueDrivers,
        ets2Jobs: Number(row.ets2Jobs || 0),
        atsJobs: Number(row.atsJobs || 0),
        spJobs: Number(row.spJobs || 0),
        tmpJobs: Number(row.tmpJobs || 0),
        avgDamageVehiclePct: avgDmg,
      };
    }
  }

  for (const r of convoyAgg as any[]) {
    const b = getBucket(r._id);
    if (!b) continue;
    b.community.convoysCount = Number(r.count || 0);
    b.community.convoyParticipants = Number(r.participants || 0);
  }
  for (const r of contractAgg as any[]) {
    const b = getBucket(r._id);
    if (!b) continue;
    b.community.contractsCount = Number(r.count || 0);
    b.community.specialContractJobs = Number(r.jobs || 0);
    b.community.specialContractNC = round2(r.nc || 0);
  }
  for (const r of ncEventAgg as any[]) {
    const b = getBucket(r._id);
    if (!b) continue;
    b.community.ncBoostEventsCount = Number(r.count || 0);
    b.community.ncBoostParticipants = Number(r.participants || 0);
  }
  for (const r of giveawayAgg as any[]) {
    const b = getBucket(r._id);
    if (!b) continue;
    b.community.giveawaysCount = Number(r.count || 0);
    b.community.giveawayWinnersCount = Number(r.winners || 0);
    b.community.giveawayNcBurned = round2(r.ncBurned || 0);
  }
  for (const r of giveawayTicketAgg as any[]) {
    const b = getBucket(r._id);
    if (!b) continue;
    b.community.giveawayTicketsCount = Number(r.count || 0);
    b.community.giveawayNcBurned = round2(Math.max(b.community.giveawayNcBurned, Number(r.costNC || 0)));
  }
  for (const r of couponAgg as any[]) {
    const b = getBucket(r._id);
    if (!b) continue;
    b.community.couponsCount = Number(r.count || 0);
    b.community.couponClaimsCount = Number(r.claims || 0);
    b.community.couponNcClaimed = round2(r.ncClaimed || 0);
  }
  for (const r of voucherAgg as any[]) {
    const b = getBucket(r._id);
    if (!b) continue;
    b.community.vouchersIssued = Number(r.issued || 0);
    b.community.vouchersUsed = Number(r.used || 0);
  }
  for (const r of galleryAgg as any[]) {
    const b = getBucket(r._id);
    if (!b) continue;
    b.community.galleryPostsCount = Number(r.posts || 0);
    b.community.galleryTotalLikes = Number(r.likes || 0);
  }
  for (const r of txNcAgg as any[]) {
    const b = getBucket(r._id);
    if (!b) continue;
    b.economyAndGames.ncTransactionsCount = Number(r.count || 0);
    b.economyAndGames.ncSpentTotal = round2(r.spentNC || 0);
    b.economyAndGames.ncVoucherDiscount = round2(r.voucherDiscount || 0);
  }
  for (const r of fuelAgg as any[]) {
    const b = getBucket(r._id);
    if (!b) continue;
    b.economyAndGames.fuelTransactionsCount = Number(r.count || 0);
    b.economyAndGames.fuelTotalLiters = Math.floor(Number(r.liters || 0));
    b.economyAndGames.fuelSystemLiters = Math.floor(Number(r.sysLiters || 0));
    b.economyAndGames.fuelP2pLiters = Math.floor(Number(r.p2pLiters || 0));
    b.economyAndGames.fuelTotalVolumeNC = round2(r.volumeNC || 0);
  }
  for (const r of lottoPeriodAgg as any[]) {
    const b = getBucket(r._id);
    if (!b) continue;
    b.economyAndGames.lottoPeriodsCount = Number(r.count || 0);
  }
  for (const r of lottoTicketAgg as any[]) {
    const b = getBucket(r._id);
    if (!b) continue;
    b.economyAndGames.lottoTicketsCount = Number(r.count || 0);
    b.economyAndGames.lottoPrizeWonNC = round2(r.prizeWonNC || 0);
  }
  for (const r of scratchAgg as any[]) {
    const b = getBucket(r._id);
    if (!b) continue;
    b.economyAndGames.scratchTicketsCount = Number(r.count || 0);
    b.economyAndGames.scratchSpentNC = round2(r.spentNC || 0);
    b.economyAndGames.scratchPrizeWonNC = round2(r.prizeWonNC || 0);
  }
  for (const r of racingAgg as any[]) {
    const b = getBucket(r._id);
    if (!b) continue;
    b.economyAndGames.racingTicketsCount = Number(r.count || 0);
    b.economyAndGames.racingBetNC = round2(r.betNC || 0);
    b.economyAndGames.racingPrizeWonNC = round2(r.prizeWonNC || 0);
  }
  for (const r of quizAgg as any[]) {
    const b = getBucket(r._id);
    if (!b) continue;
    b.economyAndGames.quizAttemptsCount = Number(r.count || 0);
    b.economyAndGames.quizPassedCount = Number(r.passed || 0);
  }

  const monthly = Array.from(monthMap.values());

  const quarterly = rollupPeriods(monthly, (ym) => {
    const [y, mStr] = ym.split("-");
    const q = Math.ceil(Number(mStr) / 3);
    return {
      key: `${y}-Q${q}`,
      label: `Kuartal ${q} ${y} (Q${q})`,
      shortLabel: `Q${q} ${y.slice(-2)}`,
    };
  });

  const yearly = rollupPeriods(monthly, (ym) => {
    const y = ym.split("-")[0];
    return {
      key: y,
      label: `Tahun ${y}`,
      shortLabel: y,
    };
  });

  // All-time overview sums
  const totalLogisticsJobs = monthly.reduce((s, m) => s + m.logistics.completedJobs, 0);
  const totalLogisticsDistanceKm = round2(monthly.reduce((s, m) => s + m.logistics.totalDistanceKm, 0));
  const totalCoachesTrips = monthly.reduce((s, m) => s + m.coaches.completedJobs, 0);
  const totalCoachesPassengers = monthly.reduce((s, m) => s + m.coaches.totalPassengers, 0);
  const totalCoachesDistanceKm = round2(monthly.reduce((s, m) => s + m.coaches.totalDistanceKm, 0));
  const totalConvoys = monthly.reduce((s, m) => s + m.community.convoysCount, 0);
  const totalSpecialContracts = monthly.reduce((s, m) => s + m.community.contractsCount, 0);
  const totalGiveaways = monthly.reduce((s, m) => s + m.community.giveawaysCount, 0);
  const totalFuelLitersTraded = monthly.reduce((s, m) => s + m.economyAndGames.fuelTotalLiters, 0);
  const totalGalleryPosts = monthly.reduce((s, m) => s + m.community.galleryPostsCount, 0);

  const defaultMom =
    monthly.length >= 2 ? comparePeriodStats(monthly[monthly.length - 2], monthly[monthly.length - 1]) : null;
  const defaultQoq =
    quarterly.length >= 2
      ? comparePeriodStats(quarterly[quarterly.length - 2], quarterly[quarterly.length - 1])
      : null;
  const defaultYoy =
    yearly.length >= 2 ? comparePeriodStats(yearly[yearly.length - 2], yearly[yearly.length - 1]) : null;

  const now = new Date();
  const payload: PublicStatisticsPayload = {
    generatedAt: now.toISOString(),
    generatedAtWIB:
      now.toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB",
    timezone: "Asia/Jakarta",
    currencyDisclaimer:
      "Nismara Coin (NC) adalah mata uang virtual in-game/komunitas khusus untuk fitur simulasi & hiburan (Fleet, Market, BBM, Lotto, Scratchers, Racing) dan tidak dapat ditukarkan dengan uang nyata (IDR).",
    overview: {
      totalRegisteredDrivers,
      activeTeamsCount,
      totalLogisticsJobs,
      totalLogisticsDistanceKm,
      totalCoachesTrips,
      totalCoachesPassengers,
      totalCoachesDistanceKm,
      totalCombinedDistanceKm: round2(totalLogisticsDistanceKm + totalCoachesDistanceKm),
      totalConvoys,
      totalSpecialContracts,
      totalGiveaways,
      totalFuelLitersTraded,
      totalGalleryPosts,
      dataRange: { firstMonth: firstYm, latestMonth: lastYm },
    },
    topHighlights: {
      topTruckCargosByNC: (topCargosAgg as any[]).map((c) => ({
        cargoName: String(c._id),
        jobs: Number(c.jobs || 0),
        revenueNC: round2(c.revenueNC || 0),
      })),
      topCoachModels: (topCoachModelsAgg as any[]).map((b) => ({
        model: String(b._id),
        trips: Number(b.trips || 0),
        passengers: Math.round(b.passengers || 0),
      })),
      topCoachRoutes: (topCoachRoutesAgg as any[]).map((r) => ({
        route: String(r._id),
        trips: Number(r.trips || 0),
        passengers: Math.round(r.passengers || 0),
      })),
    },
    monthly,
    quarterly,
    yearly,
    defaultComparisons: {
      mom: defaultMom,
      qoq: defaultQoq,
      yoy: defaultYoy,
    },
  };

  try {
    await redis.set(CACHE_KEY, JSON.stringify(payload), "EX", CACHE_TTL_SECONDS);
  } catch {
    // Abaikan error cache
  }

  return payload;
}
