// app/page.tsx
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import HeroSlider from "@/components/HeroSlider";
import HeroAnniversary from "@/components/HeroAnniversary";
import { ScrollReveal } from "@/components/ScrollReveal";
import Link from "next/link";
import { NismaraIcon } from "@/components/icons/SocialMedia";
import NismaraPlusBadge from "@/components/icons/NismaraPlusBadge";
import { getMonthlyStats, getCompanyDetails } from "@/lib/trucky";
import { redis } from "@/lib/redis";
import UserBadges from "@/components/icons/UserBadges";
import HomeEventsWrapper from "@/components/HomeEventsWrapper";
import RewindPromoBanner from "@/components/rewind/RewindPromoBanner";
import { getWebConfig, isRewind2026PubliclyLive } from "@/lib/webConfig";
import {
  ShieldCheck,
  Trophy,
  Truck,
  Bus,
  Users,
  Coins,
  Weight,
  Route,
  Package,
  Zap,
  Calendar,
  Star,
  Activity,
  ArrowRight,
  Radio,
  CheckCircle,
  Map,
  Plane,
  CarFront,
  BarChart3,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const getGameInfo = (id: string) => {
  return id === "2"
    ? { name: "American Truck Simulator" }
    : { name: "Euro Truck Simulator 2" };
};

export default async function Home() {
  const session = await getServerSession(authOptions);
  const isDriver = session?.user?.isDriver || false;
  const webConfig = await getWebConfig();
  const showRewind2026Banner = isRewind2026PubliclyLive(webConfig);

  const client = await clientPromise;
  const db = client.db();
  const guildId = process.env.DISCORD_GUILD_ID;
  const now = new Date();
  const NISMARA_COMPANY_ID = process.env.TRUCKY_COMPANY_ID || "35643";

  // 1. Fetch Real Data Secara Paralel
  const [
    totalDrivers,
    telemetryBreakdown,
    ncStats,
    activeEvents,
    activeContracts,
    monthlyStats,
    companyDetails,
    supporters,
    allDrivers,
    top3Drivers,
  ] = await Promise.all([
    // All-time Stats
    db.collection("driverlinks").countDocuments({ guildId }),
    (async () => {
      const cacheKey = "homepage:telemetry_breakdown_v1";
      const cached = await redis.get(cacheKey).catch(() => null);
      if (cached) return JSON.parse(cached);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

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

      const rows = await db
        .collection("jobhistories")
        .aggregate([
          {
            $match: {
              ...(guildId ? { guildId } : {}),
              jobStatus: "COMPLETED",
            },
          },
          {
            $group: {
              _id: {
                cat: {
                  $cond: [{ $eq: ["$jobCategory", "coach"] }, "coach", "truck"],
                },
                game: {
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
              },
              allJobs: { $sum: 1 },
              allKm: { $sum: { $ifNull: ["$distanceKm", 0] } },
              allMass: { $sum: { $ifNull: ["$cargoMass", 0] } },
              allPax: { $sum: { $ifNull: ["$totalPassengers", 0] } },
              allNc: { $sum: netNcExpr },
              monthJobs: {
                $sum: {
                  $cond: [{ $gte: ["$completedAt", startOfMonth] }, 1, 0],
                },
              },
              monthKm: {
                $sum: {
                  $cond: [
                    { $gte: ["$completedAt", startOfMonth] },
                    { $ifNull: ["$distanceKm", 0] },
                    0,
                  ],
                },
              },
              monthMass: {
                $sum: {
                  $cond: [
                    { $gte: ["$completedAt", startOfMonth] },
                    { $ifNull: ["$cargoMass", 0] },
                    0,
                  ],
                },
              },
              monthPax: {
                $sum: {
                  $cond: [
                    { $gte: ["$completedAt", startOfMonth] },
                    { $ifNull: ["$totalPassengers", 0] },
                    0,
                  ],
                },
              },
              monthNc: {
                $sum: {
                  $cond: [
                    { $gte: ["$completedAt", startOfMonth] },
                    netNcExpr,
                    0,
                  ],
                },
              },
            },
          },
        ])
        .toArray();

      await redis
        .setex(cacheKey, 600, JSON.stringify(rows))
        .catch(() => null);
      return rows;
    })(),
    db
      .collection("currencies")
      .aggregate([
        { $match: { guildId } },
        { $group: { _id: null, total: { $sum: "$totalNC" } } },
      ])
      .toArray(),
    // Live Ops
    db
      .collection("ncevents")
      .find({ guildId, startDate: { $lte: now }, endDate: { $gte: now } })
      .toArray(),
    db
      .collection("contracts")
      .find({ guildId, setAt: { $lte: now }, endAt: { $gte: now } })
      .toArray(),
    // This Month Stats from Trucky
    getMonthlyStats(NISMARA_COMPANY_ID),
    // Company Info (Total Official Members Count)
    getCompanyDetails(NISMARA_COMPANY_ID),
    // Supporters Nismara+
    (async () => {
      const cached = await redis.get("nismaraplus:supporters");
      if (cached) return JSON.parse(cached);

      const supportersData = await db
        .collection("users")
        .find(
          { "nismaraplus.status": true },
          {
            projection: {
              discordId: 1,
              name: 1,
              image: 1,
              avatarUrl: 1,
              truckyId: 1,
              "nismaraplus.startedAt": 1,
            },
          },
        )
        .toArray();

      const mapped = supportersData
        .map((s) => ({
          discordId: s.discordId,
          name: s.name || "Unknown Driver",
          avatarUrl:
            s.image ||
            s.avatarUrl ||
            "https://ui-avatars.com/api/?name=Driver&background=random",
          truckyId: s.truckyId,
          startedAt: s.nismaraplus?.startedAt || null,
        }))
        .sort((a, b) => {
          const dateA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
          const dateB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
          return dateA - dateB;
        });
      await redis.setex("nismaraplus:supporters", 3600, JSON.stringify(mapped));
      return mapped;
    })(),
    // All Drivers for Marquee
    (async () => {
      const cached = await redis.get("homepage:alldrivers");
      if (cached) return JSON.parse(cached);

      // Fetch users with images
      const driversData = await db
        .collection("users")
        .find(
          {},
          {
            projection: {
              discordId: 1,
              name: 1,
              image: 1,
              avatarUrl: 1,
              truckyId: 1,
            },
          },
        )
        .sort({ _id: -1 })
        .limit(60)
        .toArray(); // Get latest 60 registered users

      const mapped = driversData.map((s) => ({
        discordId: s.discordId,
        name: s.name || "Unknown Driver",
        avatarUrl:
          s.image ||
          s.avatarUrl ||
          "https://ui-avatars.com/api/?name=Driver&background=random",
        truckyId: s.truckyId,
      }));

      // Shuffle for dynamic look
      mapped.sort(() => Math.random() - 0.5);

      await redis.setex("homepage:alldrivers", 3600, JSON.stringify(mapped));
      return mapped;
    })(),
    // Top 3 Drivers This Month
    (async () => {
      const cached = await redis.get("homepage:top3drivers_v2");
      if (cached) return JSON.parse(cached);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const topDriversAgg = await db
        .collection("jobhistories")
        .aggregate([
          {
            $match: {
              guildId,
              jobStatus: "COMPLETED",
              completedAt: { $gte: startOfMonth },
            },
          },
          {
            $group: {
              _id: "$driverId",
              totalKm: { $sum: "$distanceKm" },
            },
          },
          { $sort: { totalKm: -1 } },
          { $limit: 3 },
        ])
        .toArray();

      if (!topDriversAgg.length) return [];

      const driverIds = topDriversAgg.map((d: any) => d._id);
      const usersData = await db
        .collection("users")
        .find(
          { discordId: { $in: driverIds } },
          {
            projection: {
              discordId: 1,
              name: 1,
              image: 1,
              avatarUrl: 1,
              truckyId: 1,
              discordRole: 1,
              isBooster: 1,
              nismaraplus: 1,
              truckyRank: 1,
              topManager: 1,
            },
          },
        )
        .toArray();

      const mappedTop3 = topDriversAgg.map((agg: any) => {
        const user = usersData.find((u: any) => u.discordId === agg._id);
        return {
          discordId: agg._id,
          totalKm: agg.totalKm,
          name: user?.name || "Unknown Driver",
          avatarUrl:
            user?.image ||
            user?.avatarUrl ||
            "https://ui-avatars.com/api/?name=Driver&background=random",
          truckyId: user?.truckyId,
          role: user?.discordRole,
          isBooster: user?.isBooster,
          isNismaraPlus: user?.nismaraplus?.status,
          nismaraPlusStartedAt: user?.nismaraplus?.startedAt,
          truckyRank: user?.truckyRank,
          topManager: user?.topManager,
        };
      });

      await redis.setex(
        "homepage:top3drivers_v2",
        3600,
        JSON.stringify(mappedTop3),
      );
      return mappedTop3;
    })(),
  ]);

  // Kalkulasi agregat Game (ETS2 vs ATS) & Divisi (Truck Logistics vs Bus/Coach)
  const gameTelemetry = {
    ets2: { allJobs: 0, allKm: 0, monthJobs: 0, monthKm: 0 },
    ats: { allJobs: 0, allKm: 0, monthJobs: 0, monthKm: 0 },
  };
  const divisionTelemetry = {
    truck: {
      allJobs: 0,
      allKm: 0,
      allMass: 0,
      allNc: 0,
      monthJobs: 0,
      monthKm: 0,
      monthMass: 0,
      monthNc: 0,
    },
    coach: {
      allJobs: 0,
      allKm: 0,
      allPax: 0,
      allNc: 0,
      monthJobs: 0,
      monthKm: 0,
      monthPax: 0,
      monthNc: 0,
    },
  };

  for (const row of telemetryBreakdown || []) {
    const g = row._id?.game === "ats" ? "ats" : "ets2";
    const c = row._id?.cat === "coach" ? "coach" : "truck";

    gameTelemetry[g].allJobs += row.allJobs || 0;
    gameTelemetry[g].allKm += Math.round(row.allKm || 0);
    gameTelemetry[g].monthJobs += row.monthJobs || 0;
    gameTelemetry[g].monthKm += Math.round(row.monthKm || 0);

    if (c === "coach") {
      divisionTelemetry.coach.allJobs += row.allJobs || 0;
      divisionTelemetry.coach.allKm += Math.round(row.allKm || 0);
      divisionTelemetry.coach.allPax += Math.round(row.allPax || 0);
      divisionTelemetry.coach.allNc += Math.round(row.allNc || 0);
      divisionTelemetry.coach.monthJobs += row.monthJobs || 0;
      divisionTelemetry.coach.monthKm += Math.round(row.monthKm || 0);
      divisionTelemetry.coach.monthPax += Math.round(row.monthPax || 0);
      divisionTelemetry.coach.monthNc += Math.round(row.monthNc || 0);
    } else {
      divisionTelemetry.truck.allJobs += row.allJobs || 0;
      divisionTelemetry.truck.allKm += Math.round(row.allKm || 0);
      divisionTelemetry.truck.allMass += Math.round(row.allMass || 0);
      divisionTelemetry.truck.allNc += Math.round(row.allNc || 0);
      divisionTelemetry.truck.monthJobs += row.monthJobs || 0;
      divisionTelemetry.truck.monthKm += Math.round(row.monthKm || 0);
      divisionTelemetry.truck.monthMass += Math.round(row.monthMass || 0);
      divisionTelemetry.truck.monthNc += Math.round(row.monthNc || 0);
    }
  }

  const completedJobs =
    divisionTelemetry.truck.allJobs + divisionTelemetry.coach.allJobs;
  const totalKm =
    divisionTelemetry.truck.allKm + divisionTelemetry.coach.allKm;
  const totalNC = Math.round(ncStats[0]?.total || 0);
  const finalTotalDrivers = companyDetails?.members_count ?? totalDrivers;

  // Bulan ini per game (gunakan Trucky API jika tersedia, fallback ke agregasi DB lokal)
  const ets2MonthJobs =
    monthlyStats?.ets2?.jobs_completed ?? gameTelemetry.ets2.monthJobs;
  const ets2MonthKm =
    (monthlyStats?.ets2?.real_km || 0) + (monthlyStats?.ets2?.race_km || 0) ||
    gameTelemetry.ets2.monthKm;
  const atsMonthJobs =
    monthlyStats?.ats?.jobs_completed ?? gameTelemetry.ats.monthJobs;
  const atsMonthKm =
    (monthlyStats?.ats?.real_km || 0) + (monthlyStats?.ats?.race_km || 0) ||
    gameTelemetry.ats.monthKm;

  const hasLiveOps = activeEvents.length > 0 || activeContracts.length > 0;
  const slugify = (text: string) => text.toLowerCase().replace(/\s+/g, "-");

  return (
    <main className="flex flex-col w-full bg-background overflow-hidden">
      {/* 1. HERO SECTION */}
      <HeroSlider isDriver={isDriver} />
      {/* <HeroAnniversary isDriver={isDriver} /> */}

      {/* Banner Promo Rewind 2026 (otomatis muncul mulai 28 Desember 2026 00:00 WIB) */}
      {showRewind2026Banner && <RewindPromoBanner variant="home" />}

      {/* 2. ABOUT NISMARA SECTION */}
      <section className="relative pt-28 pb-12 overflow-hidden z-10">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <ScrollReveal direction="up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
              <ShieldCheck size={14} /> Tentang Kami
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight leading-tight">
              Lebih dari sekadar <br className="hidden md:block" />{" "}
              <span className="text-primary">Komunitas Virtual.</span>
            </h2>
            <p className="text-lg md:text-xl text-foreground/60 leading-relaxed font-medium mt-6">
              Nismara Transport didirikan dengan visi untuk menciptakan
              ekosistem simulasi logistik paling profesional, tertata, dan
              imersif di Indonesia. Kami menggabungkan keseruan bermain Euro
              Truck Simulator 2 dan American Truck Simulator dengan sistem
              manajemen Virtual Trucking Company (VTC) berskala nyata.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* 3. FEATURES SECTION */}
      <section className="relative py-24 overflow-hidden border-t border-border/5">
        {/* Nismara Watermark & Spinning Text */}
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="relative flex items-center justify-center opacity-[0.03]">
            <NismaraIcon className="w-[400px] h-[400px] md:w-[600px] md:h-[600px] text-primary" />
            <svg
              className="absolute w-[800px] h-[800px] md:w-[1200px] md:h-[1200px] animate-[spin_40s_linear_infinite]"
              viewBox="0 0 1000 1000"
            >
              <defs>
                <path
                  id="textCircle"
                  d="M 500, 500 m -350, 0 a 350,350 0 1,1 700,0 a 350,350 0 1,1 -700,0"
                />
              </defs>
              <text className="text-[42px] font-black fill-current uppercase tracking-[0.3em] text-foreground">
                <textPath href="#textCircle" startOffset="0%" textLength="2199">
                  NISMARA TRANSPORT • NISMARA COMMUNITY • NISMARA AIRLINES •
                  NISMARA RACING •
                </textPath>
              </text>
            </svg>
          </div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-32">
          {/* Fitur 1 */}
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <ScrollReveal direction="right" className="w-full lg:w-1/2">
              <div className="relative rounded-[3rem] overflow-hidden shadow-2xl border border-primary/20 group">
                <div className="absolute inset-0 bg-primary/10 group-hover:bg-transparent transition-colors z-10" />
                <img
                  src="https://images.nismara.my.id/227300_188.jpg"
                  alt="Trucking Operation"
                  className="w-full h-[450px] object-cover group-hover:scale-105 transition-transform duration-1000"
                />
              </div>
            </ScrollReveal>
            <ScrollReveal
              direction="left"
              className="w-full lg:w-1/2 space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold border border-primary/20">
                <Radio className="w-4 h-4 animate-pulse" /> Telemetri Real-Time
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-foreground leading-tight tracking-tight">
                Sistem pencatatan <br />
                otomatis tanpa ribet.
              </h2>
              <p className="text-lg text-gray-400 leading-relaxed font-medium">
                Fokus pada jalanan, biarkan sistem kami yang mencatat
                pekerjaanmu. Terintegrasi penuh dengan Trucky API, setiap
                kilometer, konsumsi bahan bakar, dan kargo yang Anda bawa akan
                tersinkronisasi langsung ke dalam profil logbook Anda begitu
                mesin dimatikan.
              </p>
              <ul className="space-y-4 pt-4">
                <li className="flex items-center gap-3 text-gray-300 font-medium">
                  <CheckCircle className="w-5 h-5 text-green-400" />{" "}
                  Sinkronisasi Otomatis ETS2 & ATS
                </li>
                <li className="flex items-center gap-3 text-gray-300 font-medium">
                  <CheckCircle className="w-5 h-5 text-green-400" /> Kalkulasi
                  Nismara Coins (NC) Instan
                </li>
              </ul>
            </ScrollReveal>
          </div>

          {/* Fitur 2 */}
          <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
            <ScrollReveal direction="left" className="w-full lg:w-1/2">
              <div className="relative rounded-[3rem] overflow-hidden shadow-2xl border border-accent-sky/20 group">
                <div className="absolute inset-0 bg-accent-sky/10 group-hover:bg-transparent transition-colors z-10" />
                <img
                  src="https://images.nismara.my.id/eut2_hq_68a9a9fe.webp"
                  alt="Global Logistics"
                  className="w-full h-[500px] object-cover group-hover:scale-105 transition-transform duration-1000"
                />
              </div>
            </ScrollReveal>
            <ScrollReveal
              direction="right"
              className="w-full lg:w-1/2 space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-sky/10 text-accent-sky text-sm font-bold border border-accent-sky/20">
                <Map className="w-4 h-4" /> Global Assignment
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-foreground leading-tight tracking-tight">
                Special Contracts & <br />
                Papan Peringkat Adil.
              </h2>
              <p className="text-lg text-gray-400 leading-relaxed font-medium">
                Bergabunglah dengan ratusan pengemudi lain untuk menyelesaikan
                misi komunitas global. Kami menerapkan aturan ketat yang
                memisahkan statistik Ranked (Real Miles) dan Unranked,
                memastikan kompetisi yang adil bagi seluruh member Nismara.
              </p>
              <div className="flex items-center gap-4 pt-4">
                <Link
                  href="/special-contracts"
                  className="flex items-center gap-2 text-foreground font-bold hover:text-accent-sky transition-colors group"
                >
                  Lihat Kontrak Aktif{" "}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* 4. STATISTICS SECTION (ALL TIME & THIS MONTH) */}
      <section className="border-y border-border/20 bg-card/40 backdrop-blur-md relative z-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 py-24 space-y-16">
          <ScrollReveal direction="up" className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
              <BarChart3 size={14} /> Data Telemetri
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
              Pencapaian Komunitas
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto text-sm md:text-base">
              Rekapitulasi performa pengiriman kargo logistik dan layanan bus penumpang di seluruh jaringan operasional Nismara Transport.
            </p>
          </ScrollReveal>

          {/* TIER 1: STATISTIK PER GAME (ETS2 & ATS — BULAN INI VS SEPANJANG WAKTU) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Bulan Ini (Per Game) */}
            <div className="glass-panel p-8 rounded-3xl border border-border/50 bg-card/60 space-y-8">
              <div className="flex items-center justify-between border-b border-border/20 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary block">
                    Periode Berjalan
                  </span>
                  <h3 className="text-xl font-black text-foreground uppercase tracking-wider">
                    Statistik Game — Bulan Ini{" "}
                    {monthlyStats?.month
                      ? `(${monthlyStats.month}/${monthlyStats.year})`
                      : ""}
                  </h3>
                </div>
                <Calendar className="w-5 h-5 text-primary" />
              </div>

              <div className="grid grid-cols-2 gap-6 text-center divide-x divide-border/20">
                {/* ETS2 Bulan Ini */}
                <ScrollReveal delay={0.1} className="space-y-5 pr-2">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-black border border-blue-500/20">
                    ETS2
                  </div>
                  <div>
                    <p className="text-3xl md:text-4xl font-black text-gradient mb-1">
                      {ets2MonthJobs.toLocaleString("id-ID")}
                    </p>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                      Pengiriman Selesai
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl md:text-3xl font-black text-foreground mb-1">
                      {ets2MonthKm.toLocaleString("id-ID")}
                    </p>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                      KM Tempuh
                    </p>
                  </div>
                </ScrollReveal>

                {/* ATS Bulan Ini */}
                <ScrollReveal delay={0.2} className="space-y-5 pl-2">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-black border border-red-500/20">
                    ATS
                  </div>
                  <div>
                    <p className="text-3xl md:text-4xl font-black text-gradient mb-1">
                      {atsMonthJobs.toLocaleString("id-ID")}
                    </p>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                      Pengiriman Selesai
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl md:text-3xl font-black text-foreground mb-1">
                      {atsMonthKm.toLocaleString("id-ID")}
                    </p>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                      KM Tempuh
                    </p>
                  </div>
                </ScrollReveal>
              </div>
            </div>

            {/* Sepanjang Waktu / All-Time (Per Game) */}
            <div className="glass-panel p-8 rounded-3xl border border-border/50 bg-card/60 space-y-8">
              <div className="flex items-center justify-between border-b border-border/20 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-accent-sky block">
                    Akumulasi Historis
                  </span>
                  <h3 className="text-xl font-black text-foreground uppercase tracking-wider">
                    Statistik Game — All-Time
                  </h3>
                </div>
                <Trophy className="w-5 h-5 text-accent-sky" />
              </div>

              <div className="grid grid-cols-2 gap-6 text-center divide-x divide-border/20">
                {/* ETS2 All-Time */}
                <ScrollReveal delay={0.15} className="space-y-5 pr-2">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-black border border-blue-500/20">
                    ETS2
                  </div>
                  <div>
                    <p className="text-3xl md:text-4xl font-black text-gradient mb-1">
                      {gameTelemetry.ets2.allJobs.toLocaleString("id-ID")}
                    </p>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                      Total Pengiriman
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl md:text-3xl font-black text-foreground mb-1">
                      {gameTelemetry.ets2.allKm.toLocaleString("id-ID")}
                    </p>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                      Total KM Tempuh
                    </p>
                  </div>
                </ScrollReveal>

                {/* ATS All-Time */}
                <ScrollReveal delay={0.25} className="space-y-5 pl-2">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-black border border-red-500/20">
                    ATS
                  </div>
                  <div>
                    <p className="text-3xl md:text-4xl font-black text-gradient mb-1">
                      {gameTelemetry.ats.allJobs.toLocaleString("id-ID")}
                    </p>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                      Total Pengiriman
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl md:text-3xl font-black text-foreground mb-1">
                      {gameTelemetry.ats.allKm.toLocaleString("id-ID")}
                    </p>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                      Total KM Tempuh
                    </p>
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </div>

          {/* TIER 2: DIVISI LOGISTICS (TRUCK) VS COACH (BUS) — BULAN INI & ALL-TIME */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Divisi Logistics & Kargo (Truck) */}
            <ScrollReveal
              delay={0.1}
              className="glass-panel p-8 rounded-3xl border border-orange-500/30 bg-gradient-to-br from-orange-500/5 via-card/60 to-card/60 flex flex-col justify-between space-y-6"
            >
              <div className="flex items-center justify-between border-b border-border/20 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                      Kargo & Kontainer • ETS2 & ATS
                    </span>
                    <h3 className="text-xl font-black text-foreground uppercase tracking-tight">
                      Divisi Truck Logistics
                    </h3>
                  </div>
                </div>
                <Link
                  href="/cargo-market"
                  className="text-xs font-bold text-orange-400 hover:underline flex items-center gap-1"
                >
                  Cargo Market <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pengiriman Selesai */}
                <div className="p-4 rounded-2xl bg-background/50 border border-border/40">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    <Package className="w-4 h-4 text-orange-400" /> Pengiriman Selesai
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Bulan Ini
                      </span>
                      <span className="text-xl font-black text-orange-400">
                        {divisionTelemetry.truck.monthJobs.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        All-Time
                      </span>
                      <span className="text-2xl font-black text-foreground">
                        {divisionTelemetry.truck.allJobs.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Jarak Tempuh */}
                <div className="p-4 rounded-2xl bg-background/50 border border-border/40">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    <Route className="w-4 h-4 text-orange-400" /> Jarak Tempuh (KM)
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Bulan Ini
                      </span>
                      <span className="text-xl font-black text-orange-400">
                        {divisionTelemetry.truck.monthKm.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        All-Time
                      </span>
                      <span className="text-2xl font-black text-foreground">
                        {divisionTelemetry.truck.allKm.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tonase Kargo */}
                <div className="p-4 rounded-2xl bg-background/50 border border-border/40">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    <Weight className="w-4 h-4 text-orange-400" /> Total Tonase (Ton)
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Bulan Ini
                      </span>
                      <span className="text-xl font-black text-orange-400">
                        {divisionTelemetry.truck.monthMass.toLocaleString("id-ID")}{" "}
                        <span className="text-xs font-bold">T</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        All-Time
                      </span>
                      <span className="text-2xl font-black text-foreground">
                        {divisionTelemetry.truck.allMass.toLocaleString("id-ID")}{" "}
                        <span className="text-xs font-bold text-muted-foreground">
                          T
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Penghasilan NC */}
                <div className="p-4 rounded-2xl bg-background/50 border border-border/40">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    <Coins className="w-4 h-4 text-orange-400" /> Penghasilan (NC)
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Bulan Ini
                      </span>
                      <span className="text-xl font-black text-orange-400">
                        {divisionTelemetry.truck.monthNc.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        All-Time
                      </span>
                      <span className="text-2xl font-black text-foreground">
                        {divisionTelemetry.truck.allNc.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Divisi Coach / Bus (Penumpang) */}
            <ScrollReveal
              delay={0.2}
              className="glass-panel p-8 rounded-3xl border border-sky-500/30 bg-gradient-to-br from-sky-500/5 via-card/60 to-card/60 flex flex-col justify-between space-y-6"
            >
              <div className="flex items-center justify-between border-b border-border/20 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                    <Bus className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">
                      Intercity Transit & Tourist • ETS2 Coaches
                    </span>
                    <h3 className="text-xl font-black text-foreground uppercase tracking-tight">
                      Divisi Coach & Bus
                    </h3>
                  </div>
                </div>
                <Link
                  href="/coach-terminal"
                  className="text-xs font-bold text-sky-400 hover:underline flex items-center gap-1"
                >
                  Coach Terminal <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Perjalanan Selesai */}
                <div className="p-4 rounded-2xl bg-background/50 border border-border/40">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    <Bus className="w-4 h-4 text-sky-400" /> Perjalanan Selesai
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Bulan Ini
                      </span>
                      <span className="text-xl font-black text-sky-400">
                        {divisionTelemetry.coach.monthJobs.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        All-Time
                      </span>
                      <span className="text-2xl font-black text-foreground">
                        {divisionTelemetry.coach.allJobs.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Jarak Tempuh */}
                <div className="p-4 rounded-2xl bg-background/50 border border-border/40">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    <Route className="w-4 h-4 text-sky-400" /> Jarak Tempuh (KM)
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Bulan Ini
                      </span>
                      <span className="text-xl font-black text-sky-400">
                        {divisionTelemetry.coach.monthKm.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        All-Time
                      </span>
                      <span className="text-2xl font-black text-foreground">
                        {divisionTelemetry.coach.allKm.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Total Penumpang (Pax) — menggantikan Tonase */}
                <div className="p-4 rounded-2xl bg-background/50 border border-border/40">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    <Users className="w-4 h-4 text-emerald-400" /> Penumpang (Pax)
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Bulan Ini
                      </span>
                      <span className="text-xl font-black text-emerald-400">
                        {divisionTelemetry.coach.monthPax.toLocaleString("id-ID")}{" "}
                        <span className="text-xs font-bold">Pax</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        All-Time
                      </span>
                      <span className="text-2xl font-black text-foreground">
                        {divisionTelemetry.coach.allPax.toLocaleString("id-ID")}{" "}
                        <span className="text-xs font-bold text-muted-foreground">
                          Pax
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Penghasilan NC */}
                <div className="p-4 rounded-2xl bg-background/50 border border-border/40">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    <Coins className="w-4 h-4 text-sky-400" /> Penghasilan (NC)
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Bulan Ini
                      </span>
                      <span className="text-xl font-black text-sky-400">
                        {divisionTelemetry.coach.monthNc.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        All-Time
                      </span>
                      <span className="text-2xl font-black text-foreground">
                        {divisionTelemetry.coach.allNc.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* TIER 3: SIRKULASI EKONOMI NISMARA COINS (NC BEREDAR) & TOTAL KOMUNITAS */}
          <ScrollReveal
            direction="up"
            className="glass-panel p-8 md:p-10 rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card/80 to-accent-sky/10 shadow-xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-center text-center md:text-left divide-y md:divide-y-0 md:divide-x divide-border/30">
              <div className="md:col-span-2 flex flex-col sm:flex-row items-center gap-5 md:pr-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0 shadow-lg shadow-primary/20">
                  <Coins className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary block mb-1">
                    Sirkulasi Ekonomi Komunitas
                  </span>
                  <p className="text-3xl md:text-5xl font-black text-gradient tracking-tight">
                    {totalNC.toLocaleString("id-ID")}{" "}
                    <span className="text-lg font-bold text-foreground/70">
                      NC
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground font-medium mt-1">
                    Total Nismara Coins yang saat ini beredar di seluruh dompet pengemudi aktif
                  </p>
                </div>
              </div>

              <div className="pt-6 md:pt-0 md:px-6 text-center">
                <p className="text-3xl font-black text-foreground mb-1">
                  {completedJobs.toLocaleString("id-ID")}
                </p>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                  Total Perjalanan Gabungan
                </p>
                <p className="text-[11px] text-primary font-semibold mt-1">
                  {totalKm.toLocaleString("id-ID")} KM Ditempuh
                </p>
              </div>

              <div className="pt-6 md:pt-0 md:pl-6 text-center">
                <p className="text-3xl font-black text-foreground mb-1">
                  {finalTotalDrivers.toLocaleString("id-ID")}
                </p>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                  Total Anggota Resmi
                </p>
                <p className="text-[11px] text-accent-sky font-semibold mt-1">
                  Driver Terdaftar VTC
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* Top 3 Drivers This Month */}
          {top3Drivers && top3Drivers.length > 0 && (
            <div className="pt-16 border-t border-border/20 mt-16">
              <ScrollReveal direction="up" className="text-center mb-16">
                <h3 className="text-3xl font-extrabold text-foreground tracking-tight">
                  Driver Terjauh Bulan Ini
                </h3>
                <p className="text-muted-foreground mt-2">
                  Pengemudi dengan total jarak tempuh tertinggi gabungan (ETS2 &
                  ATS)
                </p>
              </ScrollReveal>

              <div className="grid grid-cols-1 md:flex md:flex-row md:justify-center md:items-end gap-6 md:gap-8 max-w-4xl mx-auto pb-8 pt-6">
                {[1, 0, 2].map((idx) => {
                  const driver = top3Drivers[idx];
                  if (!driver) return null;

                  const rank = idx + 1;
                  const isFirst = rank === 1;

                  const medals = [
                    "bg-yellow-500/20 text-yellow-500 border-yellow-500/50 shadow-yellow-500/20",
                    "bg-gray-300/20 text-gray-300 border-gray-300/50 shadow-gray-300/20",
                    "bg-amber-700/20 text-amber-700 border-amber-700/50 shadow-amber-700/20",
                  ];
                  const medalColors =
                    medals[idx] ||
                    "bg-primary/20 text-primary border-primary/50 shadow-primary/20";

                  // Mengatur urutan DOM dan ketinggian podium (di layar desktop md:)
                  const orderClass =
                    rank === 1
                      ? "order-1 md:order-2"
                      : rank === 2
                        ? "order-2 md:order-1"
                        : "order-3 md:order-3";
                  const heightClass =
                    rank === 1
                      ? "md:h-[340px] md:-translate-y-8"
                      : "md:h-[300px]";

                  return (
                    <ScrollReveal
                      key={driver.discordId}
                      delay={idx * 0.1}
                      className={`w-full md:w-1/3 flex relative z-10 hover:z-50 ${orderClass}`}
                    >
                      <div
                        className={`relative group w-full bg-card/60 backdrop-blur-md border border-border/50 rounded-3xl p-6 transition-all duration-300 hover:shadow-2xl hover:border-primary/50 flex flex-col items-center text-center ${heightClass} ${isFirst ? "hover:shadow-yellow-500/10" : ""}`}
                      >
                        <div
                          className={`absolute -top-6 w-12 h-12 rounded-full border-2 flex items-center justify-center font-black text-xl shadow-xl backdrop-blur-sm z-20 ${medalColors}`}
                        >
                          {rank}
                        </div>

                        <img
                          src={driver.avatarUrl}
                          alt={driver.name}
                          className={`relative z-10 rounded-full object-cover ring-4 ring-background shadow-xl mb-4 transition-transform group-hover:scale-105 ${isFirst ? "w-24 h-24 mt-2" : "w-20 h-20"}`}
                        />

                        {/* Nama & Link Publik (Standar UI) */}
                        <Link
                          href={`/profile/${driver.truckyId}`}
                          className="font-bold text-lg mb-1 line-clamp-1 group-hover:text-primary transition-colors hover:underline decoration-primary/50"
                        >
                          {driver.name}
                        </Link>

                        {/* User Badges (Standar UI) */}
                        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-auto mt-1 z-10">
                          <UserBadges
                            role={driver.role}
                            isBooster={driver.isBooster}
                            isNismaraPlus={driver.isNismaraPlus}
                            nismaraPlusStartedAt={driver.nismaraPlusStartedAt}
                            truckyRank={driver.truckyRank}
                            topManager={driver.topManager}
                          />
                        </div>

                        {/* Skor Jarak Tempuh */}
                        <div className="flex items-baseline gap-1 mt-4 pt-4 border-t border-border/30 w-full justify-center">
                          <span className="text-3xl font-black text-gradient">
                            {driver.totalKm.toLocaleString("id-ID")}
                          </span>
                          <span className="text-xs font-bold text-muted-foreground">
                            KM
                          </span>
                        </div>
                      </div>
                    </ScrollReveal>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 5. EKOSISTEM SECTION */}
      <section
        className="pt-48 pb-48 bg-card/40 relative overflow-hidden -mt-[100px] mb-10 z-10"
        style={{
          WebkitMaskImage: `
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 200' preserveAspectRatio='none'%3E%3Cpath fill='black' d='M0,200 L0,100 C150,200 250,0 400,100 C550,200 650,0 800,100 C950,200 1050,0 1200,100 L1200,200 Z'/%3E%3C/svg%3E"),
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 200' preserveAspectRatio='none'%3E%3Cpath fill='black' d='M0,0 L0,100 C150,0 250,200 400,100 C550,0 650,200 800,100 C950,0 1050,200 1200,100 L1200,0 Z'/%3E%3C/svg%3E"),
            linear-gradient(black, black)
          `,
          WebkitMaskSize: `100% 150px, 100% 150px, 100% calc(100% - 298px)`,
          WebkitMaskPosition: `top left, bottom left, center`,
          WebkitMaskRepeat: `no-repeat, no-repeat, no-repeat`,
          maskImage: `
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 200' preserveAspectRatio='none'%3E%3Cpath fill='black' d='M0,200 L0,100 C150,200 250,0 400,100 C550,200 650,0 800,100 C950,200 1050,0 1200,100 L1200,200 Z'/%3E%3C/svg%3E"),
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 200' preserveAspectRatio='none'%3E%3Cpath fill='black' d='M0,0 L0,100 C150,0 250,200 400,100 C550,0 650,200 800,100 C950,0 1050,200 1200,100 L1200,0 Z'/%3E%3C/svg%3E"),
            linear-gradient(black, black)
          `,
          maskSize: `100% 150px, 100% 150px, 100% calc(100% - 298px)`,
          maskPosition: `top left, bottom left, center`,
          maskRepeat: `no-repeat, no-repeat, no-repeat`,
        }}
      >
        {/* Animated Marquee Background */}
        <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none flex flex-col justify-center -rotate-12 scale-150">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="flex whitespace-nowrap animate-marquee"
              style={{
                animationDirection: i % 2 === 0 ? "normal" : "reverse",
                animationDuration: `${40 + (i % 3) * 10}s`,
              }}
            >
              {[...Array(15)].map((_, j) => (
                <span
                  key={j}
                  className="text-7xl md:text-9xl font-black text-foreground uppercase px-8"
                >
                  NISMARA
                </span>
              ))}
            </div>
          ))}
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <ScrollReveal
            direction="up"
            className="text-center max-w-3xl mx-auto mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-extrabold text-foreground mb-6 tracking-tight">
              Satu Identitas. <br />
              Membuka Seluruh <span className="text-primary">Ekosistem</span>.
            </h2>
            <p className="text-xl text-gray-400 font-medium">
              Cukup menggunakan satu akun Discord, kredensial Nismara Transport
              Anda berlaku untuk seluruh divisi simulasi kami.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ScrollReveal delay={0.1}>
              <div className="glass-panel p-10 rounded-[2.5rem] border-primary/20 hover:border-primary/50 transition-colors text-center group">
                <div className="w-20 h-20 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-8 group-hover:-translate-y-2 transition-transform">
                  <img
                    src="/nismara.svg"
                    alt="Nismara Transport Logo"
                    className="w-10 h-10 object-contain"
                  />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Nismara Transport
                </h3>
                <p className="text-gray-400 font-medium">
                  Divisi logistik darat utama kami untuk Euro Truck Simulator 2
                  dan American Truck Simulator.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <div className="glass-panel p-10 rounded-[2.5rem] border-accent-sky/20 hover:border-accent-sky/50 transition-colors text-center group">
                <div className="w-20 h-20 mx-auto bg-accent-sky/10 rounded-2xl flex items-center justify-center mb-8 group-hover:-translate-y-2 transition-transform">
                  <NismaraIcon className="w-10 h-10 text-accent-sky"></NismaraIcon>
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Nismara Airlines
                </h3>
                <p className="text-gray-400 font-medium">
                  Menguasai ruang udara virtual melalui Microsoft Flight
                  Simulator dengan rute komersial global.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.3}>
              <Link href={`https://racing.nismara.web.id`}>
                <div className="glass-panel p-10 rounded-[2.5rem] border-accent-lilac/20 hover:border-accent-lilac/50 transition-colors text-center group">
                  <div className="w-20 h-20 mx-auto bg-accent-lilac/10 rounded-2xl flex items-center justify-center mb-8 group-hover:-translate-y-2 transition-transform">
                    <img
                      src="/nismara-racing.svg"
                      alt="Nismara Racing Logo"
                      className="w-15 h-15 object-contain"
                    />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4">
                    Nismara Racing
                  </h3>
                  <p className="text-gray-400 font-medium">
                    Divisi motorsport kompetitif. Berpacu di sirkuit kelas dunia
                    melalui Assetto Corsa.
                  </p>
                </div>
              </Link>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* 6. LIVE OPERATIONS (CONDITIONAL RENDER) */}
      {hasLiveOps && (
        <section className="py-24 relative bg-gradient-to-b from-transparent via-primary/5 to-transparent">
          <div className="max-w-7xl mx-auto px-4">
            <ScrollReveal className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
                <Activity size={14} className="animate-pulse" /> Live Status
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-foreground uppercase tracking-tight">
                Current <span className="text-primary">Operations</span>
              </h2>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Event Aktif */}
              {activeEvents.map((event: any) => (
                <div
                  key={event._id}
                  className="group relative glass-panel p-1 rounded-[2.5rem] overflow-hidden border border-white/5 bg-gradient-to-br from-primary/20 to-transparent"
                >
                  <div className="bg-card/90 backdrop-blur-xl p-8 rounded-[2.4rem] h-full flex flex-col sm:flex-row items-center gap-8">
                    <img
                      src={event.imageUrl}
                      alt=""
                      className="w-24 h-24 rounded-3xl object-cover border border-white/10 shadow-2xl group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="flex-1 text-center sm:text-left">
                      <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] flex items-center justify-center sm:justify-start gap-2">
                        <Zap size={12} className="fill-current" /> Special Event
                      </span>
                      <h3 className="text-2xl font-black text-foreground uppercase mt-1 tracking-tight">
                        {event.nameEvent}
                      </h3>
                      <div className="flex items-center justify-center sm:justify-start gap-4 mt-3 text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} />
                          <span className="text-[10px] font-bold uppercase">
                            {new Date(event.endDate).toLocaleDateString(
                              "id-ID",
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-yellow-500">
                          <Star size={14} className="fill-current" />
                          <span className="text-[10px] font-black uppercase">
                            x{event.multiplier} Multiplier
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Contract Aktif */}
              {activeContracts.map((contract: any) => {
                const game = getGameInfo(contract.gameId);
                return (
                  <div
                    key={contract._id}
                    className="group relative glass-panel p-1 rounded-[2.5rem] overflow-hidden border border-white/5 bg-gradient-to-br from-accent-sky/20 to-transparent"
                  >
                    <div className="bg-card/90 backdrop-blur-xl p-8 rounded-[2.4rem] h-full flex flex-col sm:flex-row items-center gap-8">
                      <img
                        src={contract.imageUrl}
                        alt=""
                        className="w-24 h-24 rounded-3xl object-cover border border-white/10 shadow-2xl group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="flex-1 text-center sm:text-left">
                        <span className="text-[10px] font-black text-accent-sky uppercase tracking-[0.4em] flex items-center justify-center sm:justify-start gap-2">
                          <Truck size={12} /> Live Contract
                        </span>
                        <h3 className="text-2xl font-black text-foreground uppercase mt-1 tracking-tight">
                          {contract.contractName}
                        </h3>
                        <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">
                          {contract.companyName} - {game.name}
                        </p>
                        <div className="mt-4 flex justify-center sm:justify-start">
                          <Link
                            href={`/special-contracts/${slugify(contract.contractName)}`}
                            className="text-[10px] font-black text-white bg-accent-sky px-4 py-2 rounded-xl uppercase tracking-widest hover:scale-105 transition-transform"
                          >
                            Lihat Detail
                          </Link>
                        </div>
                        <div className="flex items-center justify-center sm:justify-start gap-4 mt-3 text-gray-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={14} />
                            <span className="font-bold uppercase">
                              {new Date(contract.setAt).toLocaleDateString(
                                "id-ID",
                              )}{" "}
                              -{" "}
                              {new Date(contract.endAt).toLocaleDateString(
                                "id-ID",
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 7. ALL DRIVERS MARQUEE */}
      {allDrivers && allDrivers.length > 0 && (
        <section className="relative pt-24 pb-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent-sky/5 to-transparent pointer-events-none" />
          <div className="max-w-6xl mx-auto px-4 relative z-10 text-center mb-12">
            <ScrollReveal direction="up">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-sky/10 border border-accent-sky/20 text-[10px] font-black uppercase tracking-[0.3em] text-accent-sky mb-4">
                <Truck size={14} className="text-accent-sky" /> Ratusan
                Pengemudi Aktif
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight leading-tight">
                Bertemu dengan{" "}
                <span className="text-accent-sky">Komunitas Kami</span>
              </h2>
              <div className="mt-8">
                <Link
                  href="/drivers"
                  className="inline-flex items-center justify-center rounded-xl bg-accent-sky/10 text-accent-sky border border-accent-sky/20 px-6 py-2.5 font-bold hover:bg-accent-sky hover:text-white transition-all gap-2 group"
                >
                  Lihat Semua Driver
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal
            direction="up"
            delay={0.2}
            className="w-[100vw] relative left-1/2 -translate-x-1/2 overflow-hidden py-8 flex flex-col gap-6"
          >
            {[
              {
                id: "row1",
                items: allDrivers.filter((_: any, i: number) => i % 3 === 0),
                dir: "animate-marquee-left",
              },
              {
                id: "row2",
                items: allDrivers.filter((_: any, i: number) => i % 3 === 1),
                dir: "animate-marquee-right",
              },
              {
                id: "row3",
                items: allDrivers.filter((_: any, i: number) => i % 3 === 2),
                dir: "animate-marquee-left",
              },
            ].map((row) => {
              if (row.items.length === 0) return null;

              // Duplicate items so the flex container is wide enough for a seamless loop
              const duplicated = Array(4).fill(row.items).flat();

              return (
                <div
                  key={row.id}
                  className={`flex w-max shrink-0 gap-8 px-4 ${row.dir}`}
                >
                  {duplicated.map((driver: any, idx: number) => (
                    <Link
                      href={`/profile/${driver.truckyId}`}
                      key={`${driver.discordId}-${idx}`}
                      className="group relative flex flex-col items-center gap-3 transition-transform hover:scale-105 shrink-0"
                    >
                      <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-full p-1 bg-gradient-to-b from-accent-sky/50 to-transparent">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={driver.avatarUrl}
                          alt={driver.name}
                          className="w-full h-full rounded-full object-cover border-[4px] border-background"
                        />
                      </div>
                      <span className="text-sm font-bold text-foreground group-hover:text-accent-sky transition-colors w-24 md:w-28 truncate text-center block">
                        {driver.name}
                      </span>
                    </Link>
                  ))}
                </div>
              );
            })}
          </ScrollReveal>
        </section>
      )}

      {/* 8. SUPPORTER SECTION */}
      {supporters && supporters.length > 0 && (
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent pointer-events-none" />
          <div className="max-w-6xl mx-auto px-4 relative z-10 text-center">
            <ScrollReveal direction="up" className="mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-4">
                <Star size={14} className="fill-amber-500" /> Nismara+
                Supporters
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight leading-tight">
                Terima Kasih Kepada{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-600">
                  Supporter Kami
                </span>
              </h2>
              <p className="text-lg text-foreground/60 leading-relaxed font-medium mt-4 max-w-2xl mx-auto">
                Mereka yang telah berkontribusi lebih untuk mendukung
                infrastruktur dan perkembangan Nismara Transport.
              </p>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={0.2}>
              <div className="max-h-[400px] overflow-y-auto pr-2 pt-4 pb-4 rounded-xl [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-amber-500/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                <div className="flex flex-wrap justify-center gap-6">
                  {supporters.map((supporter: any) => (
                    <Link
                      href={`/profile/${supporter.truckyId}`}
                      key={supporter.discordId}
                      className="group relative flex flex-col items-center gap-3 transition-transform hover:scale-105"
                    >
                      <div className="relative w-28 h-28 rounded-3xl p-1 bg-gradient-to-b from-amber-400/50 to-transparent shadow-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={supporter.avatarUrl}
                          alt={supporter.name}
                          className="w-full h-full rounded-3xl object-cover border-[4px] border-background"
                        />
                      </div>
                      <span className="text-sm font-bold text-foreground group-hover:text-amber-400 transition-colors w-28 truncate text-center block">
                        {supporter.name}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}

      <HomeEventsWrapper />

      {/* 9. CALL TO ACTION (REGISTER) */}
      <section className="py-32 relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-200 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

        <ScrollReveal
          direction="up"
          className="max-w-4xl mx-auto px-4 text-center relative z-10"
        >
          <NismaraIcon className="w-20 h-20 text-primary mx-auto mb-8 animate-pulse" />
          <h2 className="text-5xl md:text-6xl font-extrabold text-foreground mb-8 tracking-tight leading-tight">
            Siap Menghidupkan <br />{" "}
            <span className="text-primary">Mesin Anda?</span>
          </h2>
          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto font-medium">
            Bergabunglah dengan komunitas logistik virtual paling terorganisir.
            Hubungkan akun Trucky Anda dan mulai kumpulkan Nismara Coin hari
            ini.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            {isDriver ? (
              <Link
                href="/dashboard"
                className="px-10 py-5 bg-primary text-white font-black text-sm uppercase tracking-[0.2em] rounded-2xl hover:bg-primary/80 transition-all shadow-[0_0_40px_rgba(126,87,194,0.3)] flex items-center justify-center gap-3"
              >
                Buka Dashboard Utama <ArrowRight size={18} />
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-10 py-5 bg-primary text-white font-black text-sm uppercase tracking-[0.2em] rounded-2xl hover:bg-primary/80 transition-all shadow-[0_0_40px_rgba(126,87,194,0.3)] flex items-center justify-center gap-3"
              >
                Daftar Sekarang <ArrowRight size={18} />
              </Link>
            )}
          </div>
        </ScrollReveal>
      </section>
    </main>
  );
}
