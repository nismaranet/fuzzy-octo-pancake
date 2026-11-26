import { getServerSession } from "next-auth/next";
import clientPromise from "@/lib/mongodb";
import DriverAccessBlocker from "@/components/DriverAccessBlocker";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";
import DriverMonthlyJobAnalytics, {
  MonthlyJobStatItem,
} from "@/components/dashboard/DriverMonthlyJobAnalytics";
import DrivingScoreCard from "@/components/DrivingScoreCard";
import DecoratedAvatar from "@/components/profile/DecoratedAvatar";
import RewindPromoBanner from "@/components/rewind/RewindPromoBanner";
import { getWebConfig, isRewind2026PubliclyLive } from "@/lib/webConfig";
import {
  recalculateUserDrivingScore,
  type DrivingScoreData,
} from "@/lib/drivingScore";
import {
  Truck,
  Bus,
  Users,
  Package,
  MapPin,
  Gauge,
  Route,
  Shield,
  Trophy,
  Star,
  Coins,
  TriangleAlert,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export const metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";



function formatWIB(dateInput: string | Date | undefined) {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export default async function DashboardPage() {
  // 1. Cek Sesi User
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (!session.user?.isDriver || !session.user.driverData) {
    return <DriverAccessBlocker session={session} />;
  }

  const client = await clientPromise;
  const db = client.db();
  const webConfig = await getWebConfig();
  const showRewind2026Banner = isRewind2026PubliclyLive(webConfig);

  // 2. Ambil seluruh data dari Trucky API & MongoDB secara PARALEL (mengurangi waktu respon dari ~3.2s menjadi ~250ms)
  const truckyId = session.user.driverData.truckyId;
  const discordId = session.user.discordId;
  const GUILD_ID = process.env.DISCORD_GUILD_ID;

  const [
    userDoc,
    userPoint,
    userNC,
    ongoingJobs,
    completedJobs,
    canceledJobs,
    totalJobsCount,
    rawMonthlyJobStats,
    ncIncomes,
    initialDLink,
    pointPenalties,
  ] = await Promise.all([
    db.collection("users").findOne(
      { discordId: discordId },
      {
        projection: {
          drivingScore: 1,
          truckyRank: 1,
          truckyRankColor: 1,
          avatarDecoration: 1,
          nismaraplus: 1,
          discordRole: 1,
          role: 1,
          topManager: 1,
        },
      },
    ),
    db.collection("points").findOne({
      userId: discordId,
      guildId: GUILD_ID,
    }),
    db.collection("currencies").findOne({
      userId: discordId,
      guildId: GUILD_ID,
    }),
    db
      .collection("jobhistories")
      .find({ driverId: discordId, jobStatus: "ONGOING" })
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray(),
    db
      .collection("jobhistories")
      .find({ driverId: discordId, jobStatus: "COMPLETED" })
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray(),
    db
      .collection("jobhistories")
      .find({ driverId: discordId, jobStatus: "CANCELED" })
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray(),
    db
      .collection("jobhistories")
      .countDocuments({ driverId: discordId, guildId: GUILD_ID }),
    db
      .collection("jobhistories")
      .aggregate([
        {
          $match: {
            driverId: String(discordId),
            jobStatus: { $in: ["COMPLETED", "CANCELED"] },
          },
        },
        {
          $project: {
            month: {
              $dateToString: {
                date: { $ifNull: ["$completedAt", "$createdAt"] },
                timezone: "Asia/Jakarta",
                format: "%Y-%m",
              },
            },
            game: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$gameId", "2"] },
                    {
                      $regexMatch: {
                        input: { $ifNull: ["$game", ""] },
                        regex: /american/i,
                      },
                    },
                  ],
                },
                "ATS",
                "ETS2",
              ],
            },
            gameMode: {
              $cond: [
                {
                  $regexMatch: {
                    input: { $ifNull: ["$gameMode", ""] },
                    regex: /truckersmp/i,
                  },
                },
                "truckersmp",
                {
                  $cond: [
                    {
                      $regexMatch: {
                        input: { $ifNull: ["$gameMode", ""] },
                        regex: /haulmp/i,
                      },
                    },
                    "haulmp",
                    "sp",
                  ],
                },
              ],
            },
            jobCategory: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$jobCategory", "coach"] },
                    {
                      $in: [
                        "$marketType",
                        ["bus_company_job", "bus_tourist_job"],
                      ],
                    },
                  ],
                },
                "coach",
                "truck",
              ],
            },
            jobStatus: 1,
            distanceKm: { $ifNull: ["$distanceKm", 0] },
            cargoMass: { $ifNull: ["$cargoMass", 0] },
            totalPassengers: { $ifNull: ["$totalPassengers", 0] },
          },
        },
        {
          $group: {
            _id: {
              month: "$month",
              game: "$game",
              gameMode: "$gameMode",
              jobCategory: "$jobCategory",
            },
            totalCompleted: {
              $sum: { $cond: [{ $eq: ["$jobStatus", "COMPLETED"] }, 1, 0] },
            },
            totalCanceled: {
              $sum: { $cond: [{ $eq: ["$jobStatus", "CANCELED"] }, 1, 0] },
            },
            totalDistanceKm: {
              $sum: {
                $cond: [{ $eq: ["$jobStatus", "COMPLETED"] }, "$distanceKm", 0],
              },
            },
            totalCargoMass: {
              $sum: {
                $cond: [{ $eq: ["$jobStatus", "COMPLETED"] }, "$cargoMass", 0],
              },
            },
            totalPassengers: {
              $sum: {
                $cond: [
                  { $eq: ["$jobStatus", "COMPLETED"] },
                  "$totalPassengers",
                  0,
                ],
              },
            },
          },
        },
        {
          $sort: {
            "_id.month": -1,
            "_id.game": 1,
            "_id.gameMode": 1,
          },
        },
      ])
      .toArray(),
    db
      .collection("currencyhistories")
      .find({ userId: discordId, guildId: GUILD_ID })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
    db.collection("driverlinks").findOne({ userId: discordId, guildId: GUILD_ID }),
    db
      .collection("pointhistories")
      .find({
        userId: discordId,
        guildId: GUILD_ID,
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
  ]);

  let drivingScore: DrivingScoreData | null =
    (userDoc?.drivingScore as DrivingScoreData | undefined) || null;
  if (!drivingScore && discordId) {
    drivingScore = await recalculateUserDrivingScore(db, String(discordId));
  }

  let dLink = initialDLink;
  if (!dLink && truckyId) {
    dLink = await db.collection("driverlinks").findOne({
      $or: [{ truckyId: truckyId }, { truckyId: Number(truckyId) }],
      guildId: GUILD_ID,
    });
  }

  const monthlyJobStats: MonthlyJobStatItem[] = rawMonthlyJobStats.map(
    (item: any) => ({
      month: item._id.month,
      game: item._id.game,
      gameMode: item._id.gameMode,
      jobCategory: item._id.jobCategory || "truck",
      totalCompleted: item.totalCompleted || 0,
      totalCanceled: item.totalCanceled || 0,
      totalDistanceKm: item.totalDistanceKm || 0,
      totalCargoMass: item.totalCargoMass || 0,
      totalPassengers: item.totalPassengers || 0,
    })
  );

  // Ringkasan akumulasi divisi Truck vs Coach dari monthlyJobStats
  const divisionSummary = monthlyJobStats.reduce(
    (acc, item) => {
      if (item.jobCategory === "coach") {
        acc.coachJobs += item.totalCompleted || 0;
        acc.coachKm += item.totalDistanceKm || 0;
        acc.coachPax += item.totalPassengers || 0;
      } else {
        acc.truckJobs += item.totalCompleted || 0;
        acc.truckKm += item.totalDistanceKm || 0;
        acc.truckMass += item.totalCargoMass || 0;
      }
      return acc;
    },
    {
      truckJobs: 0,
      truckKm: 0,
      truckMass: 0,
      coachJobs: 0,
      coachKm: 0,
      coachPax: 0,
    }
  );

  const driverJoinDate =
    dLink?.createdAt || (dLink?._id ? dLink._id.getTimestamp() : null);

  const totalDrivenKm = Math.round(
    divisionSummary.truckKm + divisionSummary.coachKm,
  );

  const stats = {
    rankName: userDoc?.truckyRank || "Driver",
    rankColor: userDoc?.truckyRankColor || "#b39ddb",
    distance: totalDrivenKm.toLocaleString("id-ID"),
    points: (userPoint?.totalPoints ?? 0).toLocaleString("id-ID"),
    userNc: (userNC?.totalNC ?? 0).toLocaleString("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    joinDate: driverJoinDate
      ? new Date(driverJoinDate).toLocaleDateString("id-ID", {
          timeZone: "Asia/Jakarta",
        })
      : "-",
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-12">
      {/* Header Profile Dashboard */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
        <div className="flex items-center gap-6">
          <DecoratedAvatar
            src={session.user.image || "/placeholder-avatar.png"}
            alt={session.user.name || "Avatar"}
            decorationId={userDoc?.avatarDecoration || null}
            isNismaraPlus={userDoc?.nismaraplus?.status === true}
            userRole={userDoc?.discordRole || userDoc?.role || session.user.role}
            topManager={userDoc?.topManager}
            sizeClass="w-20 h-20"
            frameClass="border-4 shadow-lg"
            borderColor={stats.rankColor}
          />
          <div>
            <h1 className="text-3xl font-bold text-(-primary-foreground) mb-1">
              {session.user.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="px-3 py-1 rounded-full text-xs font-bold border"
                style={{
                  backgroundColor: `${stats.rankColor}20`,
                  color: stats.rankColor,
                  borderColor: `${stats.rankColor}50`,
                }}
              >
                {stats.rankName}
              </span>
              <span className="text-sm text-gray-400 font-mono">
                ID: {truckyId}
              </span>
            </div>
          </div>
        </div>

        <div className="glass-panel px-6 py-3 rounded-xl border-primary/30 text-right">
          <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-bold">
            Bergabung Sejak
          </p>
          <p className="text-lg font-medium text-(-primary-foreground)">
            {stats.joinDate}
          </p>
        </div>
      </div>

      {/* Banner Promo Rewind 2026 (otomatis muncul mulai 28 Desember 2026 00:00 WIB) */}
      {showRewind2026Banner && <RewindPromoBanner variant="dashboard" />}

      {/* Grid Statistik VTC */}
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-foreground">
        <Shield className="text-accent-lilac" /> Statistik Nismara
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <Coins className="absolute top-4 right-4 w-12 h-12 text-yellow-500/20 group-hover:text-yellow-500/40 transition-colors" />
          <p className="text-sm text-gray-400 mb-1">Total Nismara Coins</p>
          <p className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
            {stats.userNc}
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <Route className="absolute top-4 right-4 w-12 h-12 text-blue-500/20 group-hover:text-blue-500/40 transition-colors" />
          <p className="text-sm text-gray-400 mb-1">Total Jarak Tempuh</p>
          <p className="text-4xl font-bold text-(-primary-foreground)">
            {stats.distance} Km
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <TriangleAlert className="absolute top-4 right-4 w-12 h-12 text-red-500/20 group-hover:text-red-500/40 transition-colors" />
          <p className="text-sm text-gray-400 mb-1">Total Poin</p>
          <p className="text-4xl font-bold text-(-primary-foreground)">
            {stats.points} Pts
          </p>
        </div>
      </div>

      {/* Driving Score & Safety Rating */}
      <DrivingScoreCard drivingScore={drivingScore} variant="dashboard" />

      {/* Ringkasan Divisi: Truck Logistics vs Coach / Bus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        {/* Truck Logistics */}
        <div className="glass-panel p-6 rounded-2xl border border-sky-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                  Divisi Truck Logistics
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Akumulasi pengiriman kargo truk
                </p>
              </div>
            </div>
            <Link
              href="/cargo-market"
              className="text-xs font-bold text-sky-400 hover:underline flex items-center gap-1"
            >
              Cargo Market <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-xl bg-card/50 border border-border/40">
              <p className="text-xl font-black text-foreground">
                {divisionSummary.truckJobs.toLocaleString("id-ID")}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                Jobs Selesai
              </p>
            </div>
            <div className="p-3 rounded-xl bg-card/50 border border-border/40">
              <p className="text-xl font-black text-sky-400">
                {Math.round(divisionSummary.truckKm).toLocaleString("id-ID")}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                KM Tempuh
              </p>
            </div>
            <div className="p-3 rounded-xl bg-card/50 border border-border/40">
              <p className="text-xl font-black text-emerald-400">
                {Math.round(divisionSummary.truckMass).toLocaleString("id-ID")}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                Tonase (Ton)
              </p>
            </div>
          </div>
        </div>

        {/* Coach / Bus */}
        <div className="glass-panel p-6 rounded-2xl border border-amber-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                  Divisi Coach & Bus
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Akumulasi perjalanan bus & penumpang
                </p>
              </div>
            </div>
            <Link
              href="/coach-terminal"
              className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1"
            >
              Coach Terminal <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-xl bg-card/50 border border-border/40">
              <p className="text-xl font-black text-foreground">
                {divisionSummary.coachJobs.toLocaleString("id-ID")}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                Trip Selesai
              </p>
            </div>
            <div className="p-3 rounded-xl bg-card/50 border border-border/40">
              <p className="text-xl font-black text-amber-400">
                {Math.round(divisionSummary.coachKm).toLocaleString("id-ID")}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                KM Tempuh
              </p>
            </div>
            <div className="p-3 rounded-xl bg-card/50 border border-border/40">
              <p className="text-xl font-black text-amber-300">
                {Math.round(divisionSummary.coachPax).toLocaleString("id-ID")}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                Penumpang (Pax)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --- SECTION: Analisis Pekerjaan Month-by-Month (ETS2 & ATS) --- */}
      <DriverMonthlyJobAnalytics stats={monthlyJobStats} />

      {/* --- SECTION: Insights Pekerjaan (Jobs) --- */}
      <div className="flex items-center justify-between mb-6 mt-12">
        <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
          <Truck className="text-accent-lilac" /> Status Pekerjaan Terakhir
        </h2>
        <Link
          href="/dashboard/jobs"
          className="text-sm text-accent-lilac hover:text-foreground flex items-center gap-1 transition-colors"
        >
          Lihat Semua Jobs ({totalJobsCount}) <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Ongoing Jobs */}
        <div className="glass-panel p-6 rounded-2xl border-blue-500/20">
          <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-blue-400">
            <Clock className="w-5 h-5" /> Sedang Berjalan
          </h3>
          <div className="space-y-3">
            {ongoingJobs.length > 0 ? (
              ongoingJobs.map((job) => {
                const isCoach =
                  job.jobCategory === "coach" ||
                  job.marketType === "bus_company_job" ||
                  job.marketType === "bus_tourist_job";
                return (
                  <Link
                    href={`/jobs/${job.jobId}`}
                    key={job.jobId}
                    className="block"
                  >
                    <div
                      className="p-3 bg-card/50 rounded-lg border border-border/50 
                         transition-all duration-300 ease-in-out
                         hover:bg-blue-500/10 hover:border-blue-500/40 
                         hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/10"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm text-foreground truncate">
                          {`Job #${job.jobId}` || "Kargo Tidak Diketahui"}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 border ${
                            isCoach
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                              : "bg-sky-500/15 text-sky-400 border-sky-500/30"
                          }`}
                        >
                          {isCoach ? "🚌 Coach" : "🚛 Truck"}
                        </span>
                      </div>
                      {job.sourceCity && job.destinationCity && (
                        <p className="text-xs text-foreground/80 mt-1 truncate">
                          {job.sourceCity} → {job.destinationCity}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatWIB(job.createdAt) || "-"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {job.game || "-"}
                      </p>
                    </div>
                  </Link>
                );
              })
            ) : (
              <p className="text-sm text-gray-500 italic">
                Tidak ada pekerjaan aktif.
              </p>
            )}
          </div>
        </div>

        {/* Completed Jobs */}
        <div className="glass-panel p-6 rounded-2xl border-green-500/20">
          <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-green-400">
            <CheckCircle2 className="w-5 h-5" /> Selesai Terakhir
          </h3>
          <div className="space-y-3">
            {completedJobs.length > 0 ? (
              completedJobs.map((job) => {
                const isCoach =
                  job.jobCategory === "coach" ||
                  job.marketType === "bus_company_job" ||
                  job.marketType === "bus_tourist_job";
                return (
                  <Link
                    href={`/jobs/${job.jobId}`}
                    key={job.jobId}
                    className="block"
                  >
                    <div
                      key={job._id.toString()}
                      className="p-3 bg-card/50 rounded-lg border border-border/50 
                         transition-all duration-300 ease-in-out
                         hover:bg-green-500/10 hover:border-green-500/40 
                         hover:-translate-y-1 hover:shadow-lg hover:shadow-green-500/10"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm text-foreground truncate">
                          {`Job #${job?.jobId}` || "Kargo Selesai"}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 border ${
                            isCoach
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                              : "bg-sky-500/15 text-sky-400 border-sky-500/30"
                          }`}
                        >
                          {isCoach ? "🚌 Coach" : "🚛 Truck"}
                        </span>
                      </div>
                      {job.sourceCity && job.destinationCity && (
                        <p className="text-xs text-foreground/80 mt-1 truncate">
                          {job.sourceCity} → {job.destinationCity}
                          {isCoach && job.totalPassengers
                            ? ` • ${job.totalPassengers} Pax`
                            : ""}
                        </p>
                      )}
                      {(() => {
                        const val =
                          typeof job?.revenue === "number"
                            ? job.revenue
                            : (job?.nc?.total ?? 0);
                        return (
                          <p
                            className={`text-xs mt-1 font-semibold ${
                              val < 0
                                ? "text-red-400"
                                : val > 0
                                  ? "text-green-500/80"
                                  : "text-gray-400"
                            }`}
                          >
                            {val > 0 ? "+" : ""}
                            {val.toLocaleString("id-ID")} NC
                          </p>
                        );
                      })()}
                      <p className="text-xs text-gray-400 mt-1">
                        {job?.game || 0}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatWIB(job.updatedAt) || "-"}
                      </p>
                    </div>
                  </Link>
                );
              })
            ) : (
              <p className="text-sm text-gray-500 italic">
                Belum ada pekerjaan selesai.
              </p>
            )}
          </div>
        </div>

        {/* Canceled Jobs */}
        <div className="glass-panel p-6 rounded-2xl border-red-500/20">
          <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-red-400">
            <XCircle className="w-5 h-5" /> Dibatalkan
          </h3>
          <div className="space-y-3">
            {canceledJobs.length > 0 ? (
              canceledJobs.map((job) => {
                const isCoach =
                  job.jobCategory === "coach" ||
                  job.marketType === "bus_company_job" ||
                  job.marketType === "bus_tourist_job";
                return (
                  <Link
                    href={`/jobs/${job.jobId}`}
                    key={job.jobId}
                    className="block"
                  >
                    <div
                      key={job._id.toString()}
                      className="p-3 bg-card/50 rounded-lg border border-border/50 
                         transition-all duration-300 ease-in-out
                         hover:bg-red-500/10 hover:border-red-500/40 
                         hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm text-foreground truncate">
                          Job #{job.jobId || "Kargo Dibatalkan"}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 border ${
                            isCoach
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                              : "bg-sky-500/15 text-sky-400 border-sky-500/30"
                          }`}
                        >
                          {isCoach ? "🚌 Coach" : "🚛 Truck"}
                        </span>
                      </div>
                      {job.sourceCity && job.destinationCity && (
                        <p className="text-xs text-foreground/80 mt-1 truncate">
                          {job.sourceCity} → {job.destinationCity}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {job?.game || 0}
                      </p>
                      <p className="text-xs text-red-400/80 mt-0.5">
                        {formatWIB(job.createdAt) || "-"}
                      </p>
                    </div>
                  </Link>
                );
              })
            ) : (
              <p className="text-sm text-gray-500 italic">
                Tidak ada riwayat pembatalan.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* --- SECTION: Insights Histori Transaksi & Poin --- */}
      <div className="flex items-center justify-between mb-6 mt-12">
        <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
          <TrendingUp className="text-accent-lilac" /> Riwayat NC & Penalti
        </h2>
        <Link
          href="/dashboard/histories"
          className="text-sm text-accent-lilac hover:text-foreground flex items-center gap-1 transition-colors"
        >
          Lihat Semua Histori <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* Riwayat NC */}
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-yellow-400">
            <Coins className="w-5 h-5" /> Transaksi NC Terakhir
          </h3>
          <div className="space-y-3">
            {ncIncomes.length > 0 ? (
              ncIncomes.map((history) => {
                // Menentukan logika warna dan tanda untuk NC
                const isEarn = history.type === "earn";
                const ncSign = isEarn ? "+" : "-";
                const ncColor = isEarn ? "text-green-400" : "text-red-400";

                return (
                  <div
                    key={history._id.toString()}
                    className="flex justify-between items-center p-3 bg-card/50 rounded-lg border border-border/50"
                  >
                    <div className="overflow-hidden pr-3">
                      <p className="text-sm text-foreground font-medium truncate">
                        {history.reason ||
                          (isEarn ? "Pemasukan NC" : "Pengeluaran NC")}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(history.createdAt).toLocaleDateString(
                          "id-ID",
                        )}
                      </p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${ncColor}`}>
                      {ncSign}
                      {history.amount} NC
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500 italic">
                Belum ada riwayat transaksi NC.
              </p>
            )}
          </div>
        </div>

        {/* Riwayat Poin Penalti */}
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-red-400">
            <TriangleAlert className="w-5 h-5" /> Riwayat Poin Terakhir
          </h3>
          <div className="space-y-3">
            {pointPenalties.length > 0 ? (
              pointPenalties.map((penalty) => {
                // Menentukan logika warna dan tanda untuk Poin Penalti
                const isAdd = penalty.type === "add";
                const ptsSign = isAdd ? "+" : "-";
                const ptsColor = isAdd ? "text-red-400" : "text-green-400";

                return (
                  <div
                    key={penalty._id.toString()}
                    className="flex justify-between items-center p-3 bg-card/50 rounded-lg border border-border/50"
                  >
                    <div className="overflow-hidden pr-3">
                      <p className="text-sm text-foreground font-medium truncate">
                        {penalty.reason ||
                          (isAdd ? "Penalti Ditambahkan" : "Penalti Dikurangi")}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(penalty.createdAt).toLocaleDateString(
                          "id-ID",
                        )}
                      </p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${ptsColor}`}>
                      {ptsSign}
                      {penalty.points} Pts
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500 italic">
                Bersih! Tidak ada riwayat poin.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
