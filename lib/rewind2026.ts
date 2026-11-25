import clientPromise from "@/lib/mongodb";
import { redis } from "@/lib/redis";

const START_2026 = new Date("2026-01-01T00:00:00+07:00");
const END_2026 = new Date("2027-01-01T00:00:00+07:00");
const COLLECTIVE_CACHE_KEY = "rewind:2026:collective:v4";
const COLLECTIVE_TTL_SECONDS = 600;

const MONTH_NAMES = [
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

const MONTH_FULL_NAMES = [
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

export interface RewindGalleryPhoto {
  id: string;
  imageUrl: string;
  caption: string;
  likesCount: number;
  photographerName: string;
  photographerTruckyId: string | null;
}

export interface RewindTopDriver {
  discordId: string;
  name: string;
  avatarUrl: string | null;
  truckyId: string | null;
  totalKm: number;
  totalJobs: number;
  totalNetNc?: number;
  avgRating?: number;
}

export interface GameBreakdownStats {
  totalJobs: number;
  totalKm: number;
  totalNetNc: number;
  totalHours: number;
  topCargo: { name: string; count: number } | null;
}

export interface DrivingScoreTopDriver {
  discordId: string;
  name: string;
  avatarUrl: string | null;
  truckyId: string | null;
  score: number;
  grade: string;
}

export interface CollectiveRewind2026 {
  year: 2026;
  totalDrivers: number;
  activeDrivers2026: number;
  totalJobs: number;
  totalKm: number;
  earthLaps: number;
  totalMassTons: number;
  totalHours: number;
  totalNetNc: number;
  ets2Jobs: number;
  atsJobs: number;
  truckJobs: number;
  coachJobs: number;
  totalPassengers: number;
  gameBreakdown: {
    ets2: GameBreakdownStats;
    ats: GameBreakdownStats;
  };
  hardcore: {
    totalJobs: number;
    totalKm: number;
    avgRating: number;
    highRatingJobs: number;
    topDriver: RewindTopDriver | null;
  };
  topCities: { name: string; count: number }[];
  topCargos: { name: string; count: number }[];
  topVehicles: { name: string; count: number }[];
  topDriversByKm: RewindTopDriver[];
  topDriversByNc: RewindTopDriver[];
  topDriversByJobs: RewindTopDriver[];
  drivingScoreLeaderboard: {
    totalActiveRanked: number;
    avgScore: number;
    gradeSCount: number;
    gradeACount: number;
    topDrivers: DrivingScoreTopDriver[];
  };
  monthlyKm: { month: string; km: number; jobs: number }[];
  community: {
    totalConvoys: number;
    totalSpecialContracts: number;
    totalNcEvents: number;
    totalGiveaways: number;
    totalAchievements: number;
    totalFleets: number;
    totalMarketPurchases: number;
    totalScratchTickets: number;
    totalLottoTickets: number;
    galleryCount: number;
  };
  topPhotos: RewindGalleryPhoto[];
  backdropPhotos: RewindGalleryPhoto[];
}

export interface HardcoreTitleInfo {
  title: string;
  subtitle: string;
  tier: "grandmaster" | "legend" | "veteran" | "realist" | "challenger";
}

export interface DriverPersonaInfo {
  title: string;
  tagline: string;
  badgeColor: string;
}

export interface PersonalRewind2026 {
  driver: {
    discordId: string;
    truckyId: string | null;
    name: string;
    avatarUrl: string | null;
    truckyRank: string | null;
    isNismaraPlus: boolean;
    isBooster: boolean;
  };
  hasActivity: boolean;
  totalJobs: number;
  totalKm: number;
  totalMassTons: number;
  totalHours: number;
  totalDurationSeconds: number;
  truckDurationSeconds: number;
  coachDurationSeconds: number;
  truckKm: number;
  coachKm: number;
  totalNetNc: number;
  totalXp: number;
  ets2Jobs: number;
  atsJobs: number;
  truckJobs: number;
  coachJobs: number;
  totalPassengers: number;
  rankPosition: number | null;
  totalRankedDrivers: number;
  percentileTop: number | null;
  rankings: {
    totalRankedDrivers: number;
    km: { rank: number | null; percentileTop: number | null };
    nc: { rank: number | null; percentileTop: number | null };
    jobs: { rank: number | null; percentileTop: number | null };
    drivingScore: {
      rank: number | null;
      percentileTop: number | null;
      totalRanked: number;
    };
  };
  monthlyJobs: { month: string; jobs: number; km: number }[];
  busiestMonth: { name: string; jobs: number; km: number } | null;
  peakTimeOfDay: {
    label: string;
    subtitle: string;
    sharePct: number;
  };
  favoriteVehicle: { name: string; count: number } | null;
  favoriteSourceCity: { name: string; count: number } | null;
  favoriteCity: { name: string; count: number } | null;
  favoriteCargo: { name: string; count: number } | null;
  favoriteMode: string | null;
  longestJob: {
    sourceCity: string;
    destinationCity: string;
    cargoName: string;
    distanceKm: number;
    isCoach: boolean;
  } | null;
  hardcore: {
    totalJobs: number;
    totalKm: number;
    avgRating: number;
    highRatingJobs: number;
    sharePct: number;
    title: HardcoreTitleInfo | null;
  };
  safety: {
    drivingScore: number | null;
    drivingGrade: string;
    drivingStatus: string;
    realMilesRate: number;
    zeroDamageJobs: number;
    totalFines: number;
  };
  footprint: {
    specialContractJobs: number;
    ncBoostEarned: number;
    achievementsUnlocked: number;
    fleetsOwned: number;
    marketPurchases: number;
    scratchTickets: number;
    lottoTickets: number;
  };
  gallery: {
    postsCount: number;
    totalLikes: number;
    topPhoto: RewindGalleryPhoto | null;
  };
  persona: DriverPersonaInfo;
}

function computeHardcoreTitle(
  jobs: number,
  avgRating: number
): HardcoreTitleInfo | null {
  if (jobs <= 0) return null;
  if (jobs >= 25 && avgRating >= 4.5) {
    return {
      title: "Hardcore Grandmaster",
      subtitle:
        "Penguasa sejati simulasi realistis dengan konsistensi rating bintang hampir sempurna.",
      tier: "grandmaster",
    };
  }
  if (jobs >= 15 && avgRating >= 4.2) {
    return {
      title: "Legend of Realism",
      subtitle:
        "Tangan dingin di mode Hardcore dengan rating tinggi sepanjang 2026.",
      tier: "legend",
    };
  }
  if (jobs >= 10 && avgRating >= 3.8) {
    return {
      title: "Hardcore Veteran",
      subtitle:
        "Teruji melibas ribuan kilometer Hardcore dengan disiplin penuh.",
      tier: "veteran",
    };
  }
  if (jobs >= 5 && avgRating >= 4.0) {
    return {
      title: "Precision Realist",
      subtitle:
        "Ketepatan dan kehati-hatian tinggi di setiap pengiriman Hardcore.",
      tier: "realist",
    };
  }
  return {
    title: "Realism Challenger",
    subtitle:
      "Berani menjajal kerasnya jalanan mode Hardcore Simulation di 2026.",
    tier: "challenger",
  };
}

function computeDriverPersona(params: {
  hasActivity: boolean;
  totalJobs: number;
  totalKm: number;
  coachJobs: number;
  hardcoreJobs: number;
  hardcoreAvgRating: number;
  drivingGrade: string;
  drivingStatus: string;
  realMilesRate: number;
  specialContractJobs: number;
  peakBucket: string;
  galleryPostsCount: number;
  galleryTotalLikes: number;
}): DriverPersonaInfo {
  if (!params.hasActivity) {
    return {
      title: "Rising Star 2027",
      tagline: "Mesin sudah dipanaskan, rute besar menantimu di tahun baru.",
      badgeColor: "amber",
    };
  }

  const avgKmPerJob = params.totalJobs > 0 ? params.totalKm / params.totalJobs : 0;
  const hcRatio = params.totalJobs > 0 ? params.hardcoreJobs / params.totalJobs : 0;
  const coachRatio = params.totalJobs > 0 ? params.coachJobs / params.totalJobs : 0;

  if (params.hardcoreJobs >= 20 && params.hardcoreAvgRating >= 4.3) {
    return {
      title: "Hardcore Grandmaster",
      tagline: "Realisme tanpa kompromi, rating bintang tinggi jadi standar harianmu.",
      badgeColor: "orange",
    };
  }
  if (
    params.drivingStatus === "active" &&
    params.drivingGrade === "S" &&
    params.realMilesRate >= 92
  ) {
    return {
      title: "The Precision Master",
      tagline: "Halus, aman, dan presisi. Kamu panutan keselamatan di jalanan Nismara.",
      badgeColor: "emerald",
    };
  }
  if (params.coachJobs >= 12 || (params.coachJobs >= 5 && coachRatio >= 0.4)) {
    return {
      title: "The Bus Captain",
      tagline: "Dari terminal ke destinasi wisata, kenyamanan penumpang selalu nomor satu.",
      badgeColor: "teal",
    };
  }
  if (params.hardcoreJobs >= 10 && hcRatio >= 0.45 && params.hardcoreAvgRating >= 3.8) {
    return {
      title: "The Realism Specialist",
      tagline: "Semakin menantang aturan jalannya, semakin menikmati setiap kilometernya.",
      badgeColor: "orange",
    };
  }
  if (params.specialContractJobs >= 20) {
    return {
      title: "The Contract Hunter",
      tagline: "Misi spesial selalu tuntas. Kontributor andalan klien Nismara Transport.",
      badgeColor: "sky",
    };
  }
  if (avgKmPerJob >= 1200 && params.totalJobs >= 5) {
    return {
      title: "The Iron Long-Hauler",
      tagline: "Rute lintas negara ribuan kilometer bukan halangan, melainkan rumah keduamu.",
      badgeColor: "amber",
    };
  }
  if (params.peakBucket === "midnight" && params.totalJobs >= 10) {
    return {
      title: "The Night Owl",
      tagline: "Saat kota tertidur, lampu kabin dan mesin trukmu justru menyala paling terang.",
      badgeColor: "indigo",
    };
  }
  if (params.galleryPostsCount >= 3 && params.galleryTotalLikes >= 6) {
    return {
      title: "The Highway Photographer",
      tagline: "Bukan hanya menempuh jarak, kamu juga mengabadikan indahnya setiap sudut rute.",
      badgeColor: "rose",
    };
  }

  return {
    title: "The Dedicated Hauler",
    tagline: "Konsisten, tangguh, dan menjadi bagian penting dari tahun pertama Nismara.",
    badgeColor: "amber",
  };
}

function getPeakBucketMeta(bucket: string): { label: string; subtitle: string } {
  switch (bucket) {
    case "dawn":
      return {
        label: "Pejuang Subuh (04:00 - 09:00 WIB)",
        subtitle: "Suka memulai hari lebih awal saat jalanan masih lengang.",
      };
    case "day":
      return {
        label: "Penjelajah Siang (09:00 - 15:00 WIB)",
        subtitle: "Paling produktif melibas rute di bawah terik matahari.",
      };
    case "evening":
      return {
        label: "Pemburu Senja (15:00 - 19:00 WIB)",
        subtitle: "Waktu favorit mengaspal sambil menikmati langit sore.",
      };
    case "night":
      return {
        label: "Kru Malam (19:00 - 23:00 WIB)",
        subtitle: "Jam santai paling ramai untuk mabar dan kejar setoran.",
      };
    default:
      return {
        label: "Night Owl (23:00 - 04:00 WIB)",
        subtitle: "Penguasa tol tengah malam saat sebagian besar driver sudah terlelap.",
      };
  }
}

export async function getCollectiveRewind2026(
  forceRefresh = false
): Promise<CollectiveRewind2026> {
  if (!forceRefresh) {
    try {
      const cached = await redis.get(COLLECTIVE_CACHE_KEY);
      if (cached) return JSON.parse(cached) as CollectiveRewind2026;
    } catch {
      // Fallback ke MongoDB
    }
  }

  const client = await clientPromise;
  const db = client.db();
  const guildId = process.env.DISCORD_GUILD_ID;

  const baseJobMatch: Record<string, any> = {
    ...(guildId ? { guildId } : {}),
    jobStatus: "COMPLETED",
    completedAt: { $gte: START_2026, $lt: END_2026 },
  };

  const netNcExpr = {
    $cond: [
      { $gt: [{ $ifNull: ["$nc.total", 0] }, 0] },
      {
        $subtract: [
          { $ifNull: ["$nc.total", 0] },
          { $ifNull: ["$ncCost.total", 0] },
        ],
      },
      0,
    ],
  };

  const [
    jobFacets,
    totalDrivers,
    totalConvoys,
    totalSpecialContracts,
    totalNcEvents,
    totalGiveaways,
    totalAchievements,
    totalFleets,
    totalMarketPurchases,
    totalScratchTickets,
    totalLottoTickets,
    galleryDocs,
    activeDrivingScoreUsers,
  ] = await Promise.all([
    db
      .collection("jobhistories")
      .aggregate([
        { $match: baseJobMatch },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  totalJobs: { $sum: 1 },
                  totalKm: { $sum: { $ifNull: ["$distanceKm", 0] } },
                  totalMassTons: { $sum: { $ifNull: ["$cargoMass", 0] } },
                  totalDurationSec: { $sum: { $ifNull: ["$durationSeconds", 0] } },
                  totalNetNc: { $sum: netNcExpr },
                  ets2Jobs: {
                    $sum: {
                      $cond: [
                        {
                          $or: [
                            { $eq: ["$gameId", "2"] },
                            { $eq: ["$game", "American Truck Simulator"] },
                          ],
                        },
                        0,
                        1,
                      ],
                    },
                  },
                  atsJobs: {
                    $sum: {
                      $cond: [
                        {
                          $or: [
                            { $eq: ["$gameId", "2"] },
                            { $eq: ["$game", "American Truck Simulator"] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                  coachJobs: {
                    $sum: { $cond: [{ $eq: ["$jobCategory", "coach"] }, 1, 0] },
                  },
                  totalPassengers: { $sum: { $ifNull: ["$totalPassengers", 0] } },
                  activeDrivers: { $addToSet: "$driverId" },
                },
              },
            ],
            hardcore: [
              { $match: { isHardcore: true } },
              {
                $group: {
                  _id: null,
                  totalJobs: { $sum: 1 },
                  totalKm: { $sum: { $ifNull: ["$distanceKm", 0] } },
                  avgRating: { $avg: { $ifNull: ["$hardcoreRating", 0] } },
                  highRatingJobs: {
                    $sum: { $cond: [{ $gte: ["$hardcoreRating", 4] }, 1, 0] },
                  },
                },
              },
            ],
            topHardcoreDriver: [
              { $match: { isHardcore: true, driverId: { $ne: null } } },
              {
                $group: {
                  _id: "$driverId",
                  totalJobs: { $sum: 1 },
                  totalKm: { $sum: { $ifNull: ["$distanceKm", 0] } },
                  avgRating: { $avg: { $ifNull: ["$hardcoreRating", 0] } },
                },
              },
              { $match: { totalJobs: { $gte: 5 } } },
              { $sort: { avgRating: -1, totalJobs: -1 } },
              { $limit: 1 },
            ],
            topCities: [
              { $match: { destinationCity: { $nin: [null, ""] } } },
              { $group: { _id: "$destinationCity", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 3 },
            ],
            topCargos: [
              { $match: { cargoName: { $nin: [null, "", "Coach Job"] } } },
              { $group: { _id: "$cargoName", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 3 },
            ],
            topVehicles: [
              {
                $match: {
                  "vehicle.brand": { $nin: [null, ""] },
                  "vehicle.model": { $nin: [null, ""] },
                },
              },
              {
                $group: {
                  _id: { $concat: ["$vehicle.brand", " ", "$vehicle.model"] },
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1 } },
              { $limit: 3 },
            ],
            topDrivers: [
              { $match: { driverId: { $ne: null } } },
              {
                $group: {
                  _id: "$driverId",
                  totalKm: { $sum: { $ifNull: ["$distanceKm", 0] } },
                  totalJobs: { $sum: 1 },
                  totalNetNc: { $sum: netNcExpr },
                },
              },
              { $sort: { totalKm: -1 } },
              { $limit: 3 },
            ],
            topDriversByNc: [
              { $match: { driverId: { $ne: null } } },
              {
                $group: {
                  _id: "$driverId",
                  totalKm: { $sum: { $ifNull: ["$distanceKm", 0] } },
                  totalJobs: { $sum: 1 },
                  totalNetNc: { $sum: netNcExpr },
                },
              },
              { $sort: { totalNetNc: -1 } },
              { $limit: 3 },
            ],
            topDriversByJobs: [
              { $match: { driverId: { $ne: null } } },
              {
                $group: {
                  _id: "$driverId",
                  totalKm: { $sum: { $ifNull: ["$distanceKm", 0] } },
                  totalJobs: { $sum: 1 },
                  totalNetNc: { $sum: netNcExpr },
                },
              },
              { $sort: { totalJobs: -1, totalKm: -1 } },
              { $limit: 3 },
            ],
            byGame: [
              {
                $group: {
                  _id: {
                    $cond: [
                      {
                        $or: [
                          { $eq: ["$gameId", "2"] },
                          { $eq: ["$game", "American Truck Simulator"] },
                        ],
                      },
                      "ats",
                      "ets2",
                    ],
                  },
                  totalJobs: { $sum: 1 },
                  totalKm: { $sum: { $ifNull: ["$distanceKm", 0] } },
                  totalNetNc: { $sum: netNcExpr },
                  totalDurationSec: { $sum: { $ifNull: ["$durationSeconds", 0] } },
                },
              },
            ],
            topCargoEts2: [
              {
                $match: {
                  gameId: { $ne: "2" },
                  game: { $ne: "American Truck Simulator" },
                  cargoName: { $nin: [null, "", "Coach Job"] },
                },
              },
              { $group: { _id: "$cargoName", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 1 },
            ],
            topCargoAts: [
              {
                $match: {
                  $or: [
                    { gameId: "2" },
                    { game: "American Truck Simulator" },
                  ],
                  cargoName: { $nin: [null, "", "Coach Job"] },
                },
              },
              { $group: { _id: "$cargoName", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 1 },
            ],
            monthly: [
              {
                $group: {
                  _id: {
                    $month: { date: "$completedAt", timezone: "Asia/Jakarta" },
                  },
                  km: { $sum: { $ifNull: ["$distanceKm", 0] } },
                  jobs: { $sum: 1 },
                },
              },
            ],
          },
        },
      ])
      .toArray(),
    db.collection("users").countDocuments({ isDriver: true }),
    db
      .collection("convoylobby")
      .countDocuments({ meetupDate: { $gte: START_2026, $lt: END_2026 } }),
    db
      .collection("specialcontracthistories")
      .countDocuments({ completedAt: { $gte: START_2026, $lt: END_2026 } }),
    db.collection("ncevents").countDocuments({
      $or: [
        { startDate: { $gte: START_2026, $lt: END_2026 } },
        { endAt: { $gte: START_2026, $lt: END_2026 } },
      ],
    }),
    db
      .collection("giveaways")
      .countDocuments({ startDate: { $gte: START_2026, $lt: END_2026 } }),
    db
      .collection("userachievements")
      .countDocuments({ createdAt: { $gte: START_2026, $lt: END_2026 } }),
    db.collection("fleets").countDocuments({}),
    db
      .collection("marketpurchases")
      .countDocuments({ createdAt: { $gte: START_2026, $lt: END_2026 } }),
    db
      .collection("scratchtickets")
      .countDocuments({ createdAt: { $gte: START_2026, $lt: END_2026 } }),
    db
      .collection("lottotickets")
      .countDocuments({ createdAt: { $gte: START_2026, $lt: END_2026 } }),
    db
      .collection("gallery_posts")
      .find({ createdAt: { $gte: START_2026, $lt: END_2026 } })
      .project({ _id: 1, userId: 1, imageUrl: 1, caption: 1, likes: 1, createdAt: 1 })
      .toArray(),
    db
      .collection("users")
      .find(
        {
          "drivingScore.status": "active",
          "drivingScore.score": { $type: "number" },
        },
        {
          projection: {
            discordId: 1,
            name: 1,
            image: 1,
            avatarUrl: 1,
            truckyId: 1,
            "drivingScore.score": 1,
            "drivingScore.grade": 1,
            "drivingScore.recent30dJobs": 1,
            "drivingScore.sampleSize": 1,
          },
        }
      )
      .sort({
        "drivingScore.score": -1,
        "drivingScore.recent30dJobs": -1,
        "drivingScore.sampleSize": -1,
      })
      .toArray(),
  ]);

  const facet = jobFacets[0] || {};
  const sum = facet.summary?.[0] || {};
  const hc = facet.hardcore?.[0] || {};
  const rawTopDrivers = facet.topDrivers || [];
  const rawTopDriversByNc = facet.topDriversByNc || [];
  const rawTopDriversByJobs = facet.topDriversByJobs || [];
  const rawTopHc = facet.topHardcoreDriver?.[0] || null;

  // Enrich user names for top drivers, top hardcore driver, & gallery photographers
  const userIdsToLookup = new Set<string>();
  [...rawTopDrivers, ...rawTopDriversByNc, ...rawTopDriversByJobs].forEach(
    (d: any) => d._id && userIdsToLookup.add(String(d._id))
  );
  if (rawTopHc?._id) userIdsToLookup.add(String(rawTopHc._id));
  galleryDocs.forEach((g: any) => g.userId && userIdsToLookup.add(String(g.userId)));

  const usersArr =
    userIdsToLookup.size > 0
      ? await db
          .collection("users")
          .find(
            { discordId: { $in: Array.from(userIdsToLookup) } },
            { projection: { discordId: 1, name: 1, image: 1, avatarUrl: 1, truckyId: 1 } }
          )
          .toArray()
      : [];
  const userMap = new Map<string, any>();
  usersArr.forEach((u) => userMap.set(String(u.discordId), u));

  const mapTopDriver = (d: any): RewindTopDriver => {
    const u = userMap.get(String(d._id));
    return {
      discordId: String(d._id),
      name: u?.name || "Driver Nismara",
      avatarUrl: u?.image || u?.avatarUrl || null,
      truckyId: u?.truckyId ? String(u.truckyId) : null,
      totalKm: Math.round(Number(d.totalKm || 0)),
      totalJobs: Number(d.totalJobs || 0),
      totalNetNc:
        d.totalNetNc !== undefined
          ? Math.round(Number(d.totalNetNc || 0))
          : undefined,
      avgRating:
        d.avgRating !== undefined
          ? Math.round(Number(d.avgRating) * 100) / 100
          : undefined,
    };
  };

  const rawByGame = facet.byGame || [];
  const rawEts2 = rawByGame.find((g: any) => g._id === "ets2") || {};
  const rawAts = rawByGame.find((g: any) => g._id === "ats") || {};
  const topCargoEts2Doc = facet.topCargoEts2?.[0] || null;
  const topCargoAtsDoc = facet.topCargoAts?.[0] || null;

  const mappedGallery: RewindGalleryPhoto[] = galleryDocs
    .filter((g: any) => typeof g.imageUrl === "string" && g.imageUrl.startsWith("http"))
    .map((g: any) => {
      const u = userMap.get(String(g.userId));
      return {
        id: g._id.toString(),
        imageUrl: g.imageUrl,
        caption: typeof g.caption === "string" ? g.caption.trim() : "",
        likesCount: Array.isArray(g.likes) ? g.likes.length : 0,
        photographerName: u?.name || "Driver Nismara",
        photographerTruckyId: u?.truckyId ? String(u.truckyId) : null,
      };
    })
    .sort((a, b) => b.likesCount - a.likesCount);

  const topPhotos = mappedGallery.slice(0, 3);
  const backdropPhotos = mappedGallery.slice(0, 12);

  const monthlyMap = new Map<number, { km: number; jobs: number }>();
  (facet.monthly || []).forEach((m: any) => {
    monthlyMap.set(Number(m._id), {
      km: Math.round(Number(m.km || 0)),
      jobs: Number(m.jobs || 0),
    });
  });

  const monthlyKm = MONTH_NAMES.map((label, idx) => ({
    month: label,
    km: monthlyMap.get(idx + 1)?.km || 0,
    jobs: monthlyMap.get(idx + 1)?.jobs || 0,
  }));

  const totalKm = Math.round(Number(sum.totalKm || 0));
  const totalJobs = Number(sum.totalJobs || 0);
  const coachJobs = Number(sum.coachJobs || 0);

  // Deduplikasi berdasarkan discordId (mencegah duplikat dokumen user di koleksi users)
  const dedupedDsMap = new Map<string, any>();
  for (const u of activeDrivingScoreUsers) {
    if (!u.discordId) continue;
    const key = String(u.discordId);
    if (!dedupedDsMap.has(key)) {
      dedupedDsMap.set(key, u);
    }
  }
  const uniqueActiveDsUsers = Array.from(dedupedDsMap.values());

  const dsTotal = uniqueActiveDsUsers.length;
  const dsAvgScore =
    dsTotal > 0
      ? Math.round(
          (uniqueActiveDsUsers.reduce(
            (acc: number, u: any) => acc + Number(u.drivingScore?.score || 0),
            0
          ) /
            dsTotal) *
            10
        ) / 10
      : 0;
  const dsGradeSCount = uniqueActiveDsUsers.filter(
    (u: any) => String(u.drivingScore?.grade || "").toUpperCase() === "S"
  ).length;
  const dsGradeACount = uniqueActiveDsUsers.filter(
    (u: any) => String(u.drivingScore?.grade || "").toUpperCase() === "A"
  ).length;
  const dsTopDrivers: DrivingScoreTopDriver[] = uniqueActiveDsUsers
    .slice(0, 3)
    .map((u: any) => ({
      discordId: String(u.discordId),
      name: u.name || "Driver Nismara",
      avatarUrl: u.image || u.avatarUrl || null,
      truckyId: u.truckyId ? String(u.truckyId) : null,
      score: Math.round(Number(u.drivingScore?.score || 0) * 10) / 10,
      grade: String(u.drivingScore?.grade || "N/A").toUpperCase(),
    }));

  const result: CollectiveRewind2026 = {
    year: 2026,
    totalDrivers,
    activeDrivers2026: Array.isArray(sum.activeDrivers) ? sum.activeDrivers.length : 0,
    totalJobs,
    totalKm,
    earthLaps: Math.round((totalKm / 40075) * 10) / 10,
    totalMassTons: Math.round(Number(sum.totalMassTons || 0)),
    totalHours: Math.round(Number(sum.totalDurationSec || 0) / 3600),
    totalNetNc: Math.round(Number(sum.totalNetNc || 0)),
    ets2Jobs: Number(sum.ets2Jobs || 0),
    atsJobs: Number(sum.atsJobs || 0),
    truckJobs: Math.max(0, totalJobs - coachJobs),
    coachJobs,
    totalPassengers: Math.round(Number(sum.totalPassengers || 0)),
    gameBreakdown: {
      ets2: {
        totalJobs: Number(rawEts2.totalJobs || 0),
        totalKm: Math.round(Number(rawEts2.totalKm || 0)),
        totalNetNc: Math.round(Number(rawEts2.totalNetNc || 0)),
        totalHours: Math.round(Number(rawEts2.totalDurationSec || 0) / 3600),
        topCargo: topCargoEts2Doc
          ? { name: String(topCargoEts2Doc._id), count: Number(topCargoEts2Doc.count || 0) }
          : null,
      },
      ats: {
        totalJobs: Number(rawAts.totalJobs || 0),
        totalKm: Math.round(Number(rawAts.totalKm || 0)),
        totalNetNc: Math.round(Number(rawAts.totalNetNc || 0)),
        totalHours: Math.round(Number(rawAts.totalDurationSec || 0) / 3600),
        topCargo: topCargoAtsDoc
          ? { name: String(topCargoAtsDoc._id), count: Number(topCargoAtsDoc.count || 0) }
          : null,
      },
    },
    hardcore: {
      totalJobs: Number(hc.totalJobs || 0),
      totalKm: Math.round(Number(hc.totalKm || 0)),
      avgRating: Math.round(Number(hc.avgRating || 0) * 100) / 100,
      highRatingJobs: Number(hc.highRatingJobs || 0),
      topDriver: rawTopHc ? mapTopDriver(rawTopHc) : null,
    },
    topCities: (facet.topCities || []).map((c: any) => ({
      name: String(c._id),
      count: Number(c.count || 0),
    })),
    topCargos: (facet.topCargos || []).map((c: any) => ({
      name: String(c._id),
      count: Number(c.count || 0),
    })),
    topVehicles: (facet.topVehicles || []).map((v: any) => ({
      name: String(v._id),
      count: Number(v.count || 0),
    })),
    topDriversByKm: rawTopDrivers.map(mapTopDriver),
    topDriversByNc: rawTopDriversByNc.map(mapTopDriver),
    topDriversByJobs: rawTopDriversByJobs.map(mapTopDriver),
    drivingScoreLeaderboard: {
      totalActiveRanked: dsTotal,
      avgScore: dsAvgScore,
      gradeSCount: dsGradeSCount,
      gradeACount: dsGradeACount,
      topDrivers: dsTopDrivers,
    },
    monthlyKm,
    community: {
      totalConvoys,
      totalSpecialContracts,
      totalNcEvents,
      totalGiveaways,
      totalAchievements,
      totalFleets,
      totalMarketPurchases,
      totalScratchTickets,
      totalLottoTickets,
      galleryCount: mappedGallery.length,
    },
    topPhotos,
    backdropPhotos,
  };

  await redis
    .set(COLLECTIVE_CACHE_KEY, JSON.stringify(result), "EX", COLLECTIVE_TTL_SECONDS)
    .catch(() => null);

  return result;
}

export async function getPersonalRewind2026(identifier: {
  discordId?: string | null;
  truckyId?: string | null;
}): Promise<PersonalRewind2026 | null> {
  const client = await clientPromise;
  const db = client.db();
  const guildId = process.env.DISCORD_GUILD_ID;

  let user: any = null;
  if (identifier.discordId) {
    user = await db
      .collection("users")
      .findOne({ discordId: String(identifier.discordId) });
  } else if (identifier.truckyId) {
    const tid = String(identifier.truckyId).trim();
    const numericTid = /^\d+$/.test(tid) ? Number(tid) : null;
    user = await db.collection("users").findOne({
      $or: [
        { truckyId: tid },
        ...(numericTid !== null ? [{ truckyId: numericTid }] : []),
      ],
    });
  }

  if (!user || !user.discordId) return null;
  const discordId = String(user.discordId);

  const netNcExpr = {
    $cond: [
      { $gt: [{ $ifNull: ["$nc.total", 0] }, 0] },
      {
        $subtract: [
          { $ifNull: ["$nc.total", 0] },
          { $ifNull: ["$ncCost.total", 0] },
        ],
      },
      0,
    ],
  };

  const [
    userJobs,
    driverRankings,
    ncBoostEvents,
    achievementsUnlocked,
    fleetsOwned,
    marketPurchases,
    scratchTickets,
    lottoTickets,
    userGalleryPosts,
    dsRankings,
  ] = await Promise.all([
    db
      .collection("jobhistories")
      .find({
        ...(guildId ? { guildId } : {}),
        driverId: discordId,
        jobStatus: "COMPLETED",
        completedAt: { $gte: START_2026, $lt: END_2026 },
      })
      .project({
        game: 1,
        gameId: 1,
        gameMode: 1,
        jobCategory: 1,
        statsType: 1,
        sourceCity: 1,
        destinationCity: 1,
        cargoName: 1,
        cargoMass: 1,
        distanceKm: 1,
        durationSeconds: 1,
        totalPassengers: 1,
        vehicle: 1,
        isHardcore: 1,
        hardcoreRating: 1,
        isSpecialContract: 1,
        damage: 1,
        fines_events: 1,
        nc: 1,
        ncCost: 1,
        xp: 1,
        completedAt: 1,
      })
      .toArray(),
    db
      .collection("jobhistories")
      .aggregate([
        {
          $match: {
            ...(guildId ? { guildId } : {}),
            jobStatus: "COMPLETED",
            completedAt: { $gte: START_2026, $lt: END_2026 },
            driverId: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$driverId",
            totalKm: { $sum: { $ifNull: ["$distanceKm", 0] } },
            totalNetNc: { $sum: netNcExpr },
            totalJobs: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    db
      .collection("ncevents")
      .find({
        "participants.discordId": discordId,
        $or: [
          { startDate: { $gte: START_2026, $lt: END_2026 } },
          { endAt: { $gte: START_2026, $lt: END_2026 } },
        ],
      })
      .project({ participants: 1 })
      .toArray(),
    db.collection("userachievements").countDocuments({
      discordId,
      createdAt: { $gte: START_2026, $lt: END_2026 },
    }),
    db.collection("fleets").countDocuments({
      owner: { $in: [user._id, user._id.toString()] },
    }),
    db.collection("marketpurchases").countDocuments({
      buyerId: discordId,
      createdAt: { $gte: START_2026, $lt: END_2026 },
    }),
    db.collection("scratchtickets").countDocuments({
      discordId,
      createdAt: { $gte: START_2026, $lt: END_2026 },
    }),
    db.collection("lottotickets").countDocuments({
      discordId,
      createdAt: { $gte: START_2026, $lt: END_2026 },
    }),
    db
      .collection("gallery_posts")
      .find({
        userId: discordId,
        createdAt: { $gte: START_2026, $lt: END_2026 },
      })
      .project({ _id: 1, imageUrl: 1, caption: 1, likes: 1 })
      .toArray(),
    db
      .collection("users")
      .find(
        {
          "drivingScore.status": "active",
          "drivingScore.score": { $type: "number" },
        },
        {
          projection: {
            discordId: 1,
            "drivingScore.score": 1,
            "drivingScore.recent30dJobs": 1,
            "drivingScore.sampleSize": 1,
          },
        }
      )
      .sort({
        "drivingScore.score": -1,
        "drivingScore.recent30dJobs": -1,
        "drivingScore.sampleSize": -1,
      })
      .toArray(),
  ]);

  let totalKm = 0;
  let truckKm = 0;
  let coachKm = 0;
  let totalMassTons = 0;
  let totalDurationSec = 0;
  let truckDurationSec = 0;
  let coachDurationSec = 0;
  let totalNetNc = 0;
  let totalXp = 0;
  let ets2Jobs = 0;
  let atsJobs = 0;
  let coachJobs = 0;
  let totalPassengers = 0;
  let hardcoreJobs = 0;
  let hardcoreKm = 0;
  let hardcoreRatingSum = 0;
  let hardcoreHighRatingJobs = 0;
  let specialContractJobs = 0;
  let realMilesCount = 0;
  let zeroDamageJobs = 0;
  let totalFines = 0;

  const monthlyTotals = Array.from({ length: 12 }, () => ({ jobs: 0, km: 0 }));
  const bucketCounts: Record<string, number> = {
    dawn: 0,
    day: 0,
    evening: 0,
    night: 0,
    midnight: 0,
  };
  const vehicleCounts = new Map<string, number>();
  const sourceCityCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  const cargoCounts = new Map<string, number>();
  const modeCounts = new Map<string, number>();

  let longestJob: PersonalRewind2026["longestJob"] = null;

  for (const j of userJobs) {
    const km = Number(j.distanceKm || 0);
    const durSec = Math.max(0, Number(j.durationSeconds || 0));
    totalKm += km;
    totalMassTons += Number(j.cargoMass || 0);
    totalDurationSec += durSec;

    const grossNc = Number(j.nc?.total || 0);
    const costNc = Number(j.ncCost?.total || 0);
    totalNetNc += grossNc > 0 ? Math.max(0, grossNc - costNc) : 0;
    totalXp += Number(j.xp?.total || 0);

    const isAts = j.gameId === "2" || j.game === "American Truck Simulator";
    if (isAts) atsJobs++;
    else ets2Jobs++;

    const isCoach = j.jobCategory === "coach";
    if (isCoach) {
      coachJobs++;
      coachKm += km;
      coachDurationSec += durSec;
      totalPassengers += Number(j.totalPassengers || 0);
    } else {
      truckKm += km;
      truckDurationSec += durSec;
    }

    if (j.isHardcore) {
      hardcoreJobs++;
      hardcoreKm += km;
      const r = Number(j.hardcoreRating || 0);
      hardcoreRatingSum += r;
      if (r >= 4) hardcoreHighRatingJobs++;
    }

    if (j.isSpecialContract) specialContractJobs++;

    const st = String(j.statsType || "").toLowerCase();
    if (!st.includes("race") && !st.includes("invalid")) {
      realMilesCount++;
    }

    const dmgTotal =
      Number(j.damage?.vehicle || 0) +
      Number(j.damage?.trailer || 0) +
      Number(j.damage?.cargo || 0);
    if (dmgTotal === 0) zeroDamageJobs++;

    if (Array.isArray(j.fines_events)) {
      totalFines += j.fines_events.length;
    }

    if (j.completedAt) {
      const dt = new Date(j.completedAt);
      const wibParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        month: "numeric",
        hour: "numeric",
        hour12: false,
      }).formatToParts(dt);
      const monthNum =
        Number(wibParts.find((p) => p.type === "month")?.value || 1) - 1;
      const hourNum = Number(wibParts.find((p) => p.type === "hour")?.value || 0);

      if (monthNum >= 0 && monthNum < 12) {
        monthlyTotals[monthNum].jobs++;
        monthlyTotals[monthNum].km += km;
      }

      if (hourNum >= 4 && hourNum < 9) bucketCounts.dawn++;
      else if (hourNum >= 9 && hourNum < 15) bucketCounts.day++;
      else if (hourNum >= 15 && hourNum < 19) bucketCounts.evening++;
      else if (hourNum >= 19 && hourNum < 23) bucketCounts.night++;
      else bucketCounts.midnight++;
    }

    if (j.vehicle?.brand && j.vehicle?.model) {
      const vName = `${j.vehicle.brand} ${j.vehicle.model}`.trim();
      vehicleCounts.set(vName, (vehicleCounts.get(vName) || 0) + 1);
    }
    if (j.sourceCity) {
      const sName = String(j.sourceCity).trim();
      sourceCityCounts.set(sName, (sourceCityCounts.get(sName) || 0) + 1);
    }
    if (j.destinationCity) {
      const cName = String(j.destinationCity).trim();
      cityCounts.set(cName, (cityCounts.get(cName) || 0) + 1);
    }
    if (j.cargoName && j.cargoName !== "Coach Job") {
      const cg = String(j.cargoName).trim();
      cargoCounts.set(cg, (cargoCounts.get(cg) || 0) + 1);
    }
    if (j.gameMode) {
      const gmRaw = String(j.gameMode).toLowerCase();
      const gmLabel = gmRaw.includes("truckersmp")
        ? "TruckersMP"
        : gmRaw.includes("haulmp")
          ? "HaulMP"
          : "Singleplayer";
      modeCounts.set(gmLabel, (modeCounts.get(gmLabel) || 0) + 1);
    }

    if (!longestJob || km > longestJob.distanceKm) {
      longestJob = {
        sourceCity: String(j.sourceCity || "Unknown"),
        destinationCity: String(j.destinationCity || "Unknown"),
        cargoName: isCoach
          ? "Penumpang Coaches"
          : String(j.cargoName || "Kargo Logistik"),
        distanceKm: Math.round(km),
        isCoach,
      };
    }
  }

  const pickTop = (map: Map<string, number>) => {
    let best: { name: string; count: number } | null = null;
    for (const [name, count] of map.entries()) {
      if (!best || count > best.count) best = { name, count };
    }
    return best;
  };

  const totalJobs = userJobs.length;
  const hasActivity = totalJobs > 0;
  const hardcoreAvgRating =
    hardcoreJobs > 0
      ? Math.round((hardcoreRatingSum / hardcoreJobs) * 100) / 100
      : 0;

  let busiestMonthIdx = -1;
  for (let i = 0; i < 12; i++) {
    if (
      monthlyTotals[i].jobs > 0 &&
      (busiestMonthIdx === -1 ||
        monthlyTotals[i].km > monthlyTotals[busiestMonthIdx].km)
    ) {
      busiestMonthIdx = i;
    }
  }

  let peakBucket = "night";
  let peakBucketCount = -1;
  for (const [k, v] of Object.entries(bucketCounts)) {
    if (v > peakBucketCount) {
      peakBucketCount = v;
      peakBucket = k;
    }
  }
  const peakMeta = getPeakBucketMeta(peakBucket);

  // Rank & Percentile untuk KM, Net NC, dan Total Jobs
  const totalRankedDrivers = driverRankings.length;
  const computeRankFor = (
    comparator: (a: any, b: any) => number
  ): { rank: number | null; percentileTop: number | null } => {
    const sorted = [...driverRankings].sort(comparator);
    const idx = sorted.findIndex((r: any) => String(r._id) === discordId);
    if (idx < 0 || totalRankedDrivers <= 0) {
      return { rank: null, percentileTop: null };
    }
    const rank = idx + 1;
    const percentileTop = Math.max(1, Math.ceil((rank / totalRankedDrivers) * 100));
    return { rank, percentileTop };
  };

  const kmRank = computeRankFor((a, b) => Number(b.totalKm || 0) - Number(a.totalKm || 0));
  const ncRank = computeRankFor(
    (a, b) => Number(b.totalNetNc || 0) - Number(a.totalNetNc || 0)
  );
  const jobsRank = computeRankFor(
    (a, b) =>
      Number(b.totalJobs || 0) - Number(a.totalJobs || 0) ||
      Number(b.totalKm || 0) - Number(a.totalKm || 0)
  );
  const rankPosition = kmRank.rank;
  const percentileTop = kmRank.percentileTop;

  // Deduplikasi dsRankings berdasarkan discordId agar posisi & persentil akurat
  const uniqueDsRankingIds: string[] = [];
  const seenDsIds = new Set<string>();
  for (const u of dsRankings) {
    if (!u.discordId) continue;
    const id = String(u.discordId);
    if (!seenDsIds.has(id)) {
      seenDsIds.add(id);
      uniqueDsRankingIds.push(id);
    }
  }
  const dsTotalRanked = uniqueDsRankingIds.length;
  const dsIdx = uniqueDsRankingIds.findIndex((id) => id === discordId);
  const drivingScoreRank = {
    rank: dsIdx >= 0 ? dsIdx + 1 : null,
    percentileTop:
      dsIdx >= 0 && dsTotalRanked > 0
        ? Math.max(1, Math.ceil(((dsIdx + 1) / dsTotalRanked) * 100))
        : null,
    totalRanked: dsTotalRanked,
  };

  // NC Boost Earned
  let ncBoostEarned = 0;
  for (const ev of ncBoostEvents) {
    const p = (ev.participants || []).find(
      (x: any) => String(x.discordId) === discordId
    );
    if (p) ncBoostEarned += Number(p.totalEarned || 0);
  }

  // Personal Gallery
  const mappedUserPhotos: RewindGalleryPhoto[] = userGalleryPosts
    .filter((g: any) => typeof g.imageUrl === "string" && g.imageUrl.startsWith("http"))
    .map((g: any) => ({
      id: g._id.toString(),
      imageUrl: g.imageUrl,
      caption: typeof g.caption === "string" ? g.caption.trim() : "",
      likesCount: Array.isArray(g.likes) ? g.likes.length : 0,
      photographerName: user.name || "Driver Nismara",
      photographerTruckyId: user.truckyId ? String(user.truckyId) : null,
    }))
    .sort((a, b) => b.likesCount - a.likesCount);

  const userTotalLikes = mappedUserPhotos.reduce((s, p) => s + p.likesCount, 0);
  const realMilesRate =
    totalJobs > 0 ? Math.round((realMilesCount / totalJobs) * 100) : 0;

  const drivingScoreVal =
    user.drivingScore?.score !== undefined && user.drivingScore?.score !== null
      ? Number(user.drivingScore.score)
      : null;
  const drivingGrade = String(user.drivingScore?.grade || "UNRANKED");
  const drivingStatus = String(user.drivingScore?.status || "calibrating");

  const hardcoreTitle = computeHardcoreTitle(hardcoreJobs, hardcoreAvgRating);
  const persona = computeDriverPersona({
    hasActivity,
    totalJobs,
    totalKm,
    coachJobs,
    hardcoreJobs,
    hardcoreAvgRating,
    drivingGrade,
    drivingStatus,
    realMilesRate,
    specialContractJobs,
    peakBucket,
    galleryPostsCount: mappedUserPhotos.length,
    galleryTotalLikes: userTotalLikes,
  });

  return {
    driver: {
      discordId,
      truckyId: user.truckyId ? String(user.truckyId) : null,
      name: user.name || "Driver Nismara",
      avatarUrl: user.image || user.avatarUrl || null,
      truckyRank: user.truckyRank || null,
      isNismaraPlus: Boolean(user.nismaraplus?.status),
      isBooster: Boolean(user.isBooster),
    },
    hasActivity,
    totalJobs,
    totalKm: Math.round(totalKm),
    totalMassTons: Math.round(totalMassTons),
    totalHours: Math.round(totalDurationSec / 3600),
    totalDurationSeconds: Math.round(totalDurationSec),
    truckDurationSeconds: Math.round(truckDurationSec),
    coachDurationSeconds: Math.round(coachDurationSec),
    truckKm: Math.round(truckKm),
    coachKm: Math.round(coachKm),
    totalNetNc: Math.round(totalNetNc),
    totalXp: Math.round(totalXp),
    ets2Jobs,
    atsJobs,
    truckJobs: Math.max(0, totalJobs - coachJobs),
    coachJobs,
    totalPassengers: Math.round(totalPassengers),
    rankPosition,
    totalRankedDrivers,
    percentileTop,
    rankings: {
      totalRankedDrivers,
      km: kmRank,
      nc: ncRank,
      jobs: jobsRank,
      drivingScore: drivingScoreRank,
    },
    monthlyJobs: MONTH_NAMES.map((label, idx) => ({
      month: label,
      jobs: monthlyTotals[idx].jobs,
      km: Math.round(monthlyTotals[idx].km),
    })),
    busiestMonth:
      busiestMonthIdx >= 0
        ? {
            name: MONTH_FULL_NAMES[busiestMonthIdx],
            jobs: monthlyTotals[busiestMonthIdx].jobs,
            km: Math.round(monthlyTotals[busiestMonthIdx].km),
          }
        : null,
    peakTimeOfDay: {
      label: peakMeta.label,
      subtitle: peakMeta.subtitle,
      sharePct:
        totalJobs > 0 ? Math.round((peakBucketCount / totalJobs) * 100) : 0,
    },
    favoriteVehicle: pickTop(vehicleCounts),
    favoriteSourceCity: pickTop(sourceCityCounts),
    favoriteCity: pickTop(cityCounts),
    favoriteCargo: pickTop(cargoCounts),
    favoriteMode: pickTop(modeCounts)?.name || null,
    longestJob,
    hardcore: {
      totalJobs: hardcoreJobs,
      totalKm: Math.round(hardcoreKm),
      avgRating: hardcoreAvgRating,
      highRatingJobs: hardcoreHighRatingJobs,
      sharePct: totalJobs > 0 ? Math.round((hardcoreJobs / totalJobs) * 100) : 0,
      title: hardcoreTitle,
    },
    safety: {
      drivingScore: drivingScoreVal,
      drivingGrade,
      drivingStatus,
      realMilesRate,
      zeroDamageJobs,
      totalFines,
    },
    footprint: {
      specialContractJobs,
      ncBoostEarned: Math.round(ncBoostEarned),
      achievementsUnlocked,
      fleetsOwned,
      marketPurchases,
      scratchTickets,
      lottoTickets,
    },
    gallery: {
      postsCount: mappedUserPhotos.length,
      totalLikes: userTotalLikes,
      topPhoto: mappedUserPhotos[0] || null,
    },
    persona,
  };
}
