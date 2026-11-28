import clientPromise from "@/lib/mongodb";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import GalleryGrid from "@/components/gallery/GalleryGrid";
import AchievementSection from "@/components/profile/AchievementSection";
import CollectibleSection from "@/components/profile/CollectibleSection";
import ProfileVisualShell from "@/components/profile/ProfileVisualShell";
import DecoratedAvatar from "@/components/profile/DecoratedAvatar";
import UserBadges from "@/components/icons/UserBadges";
import DrivingScoreCard from "@/components/DrivingScoreCard";
import { sanitizeObjectPosition } from "@/lib/profilePosition";
import { resolveProfileTheme } from "@/lib/profileThemes";
import {
  isUserStaffRole,
  isUserTopManagerActive,
  resolveActiveDecorationDef,
} from "@/lib/avatarDecorations";
import { getAvatarDecorationCatalogMap } from "@/lib/avatarDecorationsServer";
import {
  recalculateUserDrivingScore,
  type DrivingScoreData,
} from "@/lib/drivingScore";
import {
  fetchDriverPresence,
  formatLastOnlineRelative,
} from "@/lib/trackerPresence";
import { notFound } from "next/navigation";
import {
  Truck,
  Bus,
  Users,
  MapPin,
  Clock,
  Globe,
  Trophy,
  Activity,
  Package,
  TriangleAlert,
  Medal,
  Gamepad2,
  ExternalLink,
  MessageSquare,
  Heart,
  Grid3X3,
  MonitorPlay,
  ShieldCheck,
  Star,
  Gem,
} from "lucide-react";
import {
  YoutubeIcon,
  FacebookIcon,
  DiscordIcon,
  InstagramIcon,
} from "@/components/icons/SocialMedia";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import type { Metadata } from "next";
import { cache } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Deduplicates MongoDB user + driverLink lookup between generateMetadata and PublicProfilePage in a single request
const getProfileIdentity = cache(async (truckyId: string) => {
  const client = await clientPromise;
  const db = client.db();
  const GUILD_ID = process.env.DISCORD_GUILD_ID || "863959415702028318";

  let [initialUser, driverLink] = await Promise.all([
    db.collection("users").findOne({
      $or: [{ truckyId: truckyId }, { truckyId: Number(truckyId) }],
    }),
    db.collection("driverlinks").findOne({
      $or: [{ truckyId: truckyId }, { truckyId: Number(truckyId) }],
      guildId: GUILD_ID,
    }),
  ]);

  if (!driverLink && initialUser?.discordId) {
    driverLink = await db.collection("driverlinks").findOne({
      userId: initialUser.discordId,
      guildId: GUILD_ID,
    });
  }

  if (!initialUser && driverLink?.userId) {
    initialUser = await db.collection("users").findOne({
      $or: [{ discordId: driverLink.userId }, { id: driverLink.userId }],
    });
  }

  return { initialUser, driverLink };
});

export async function generateMetadata(props: {
  params: Promise<{ truckyId: string }>;
}): Promise<Metadata> {
  const { truckyId } = await props.params;
  
  try {
    const { initialUser, driverLink } = await getProfileIdentity(truckyId);
    let user: any = initialUser;

    if (!user && driverLink) {
      user = {
        name: driverLink.truckyName || `Driver #${truckyId}`,
        image: `https://cdn.truckyapp.com/public/users/${truckyId}/avatar.png`,
        discordRole: "user",
      };
    }

    if (user) {
      const name = user.name || "Driver";
      const title = `Profil ${name} (@${truckyId})`;
      const roleText = user.role === "manager" || user.role === "admin" || user.discordRole === "manager"
        ? "Staff Nismara Transport" 
        : user.nismaraplus?.status 
        ? "Driver Nismara+" 
        : "Driver Nismara Transport";
      const description = `Lihat profil resmi, statistik pengiriman, pencapaian, dan armada truk ${name} (${roleText}) di Nismara Transport.`;
      const avatarUrl = user.image || "https://images.nismara.my.id/227300_188.jpg";
      const profileUrl = `https://transport.nismara.web.id/profile/${truckyId}`;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          url: profileUrl,
          siteName: "Nismara Transport",
          locale: "id_ID",
          type: "profile",
          images: [
            {
              url: avatarUrl,
              width: 500,
              height: 500,
              alt: name,
            },
          ],
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: [avatarUrl],
        },
      };
    }
  } catch (error) {
    console.error("Error generating profile metadata:", error);
  }

  return {
    title: `Profil Driver #${truckyId}`,
    description: `Profil pengemudi virtual trucking di Nismara Transport.`,
  };
}

export default async function PublicProfilePage(props: {
  params: Promise<{ truckyId: string }>;
}) {
  const { truckyId } = await props.params;
  const client = await clientPromise;
  const db = client.db();
  const GUILD_ID = process.env.DISCORD_GUILD_ID || "863959415702028318";

  const session = await getServerSession(authOptions);
  const isManager =
    session?.user?.role === "manager" || session?.user?.role === "admin";

  // 1. Reuse request-cached user & driverLink lookup (shared with generateMetadata)
  const { initialUser, driverLink } = await getProfileIdentity(truckyId);

  if (!initialUser && !driverLink) notFound();

  let user: any = initialUser;
  if (!user && driverLink) {
    user = {
      _id: driverLink._id,
      discordId: driverLink.userId,
      truckyId: Number(driverLink.truckyId) || driverLink.truckyId,
      name: driverLink.truckyName || `Driver #${truckyId}`,
      image: `https://cdn.truckyapp.com/public/users/${truckyId}/avatar.png`,
      discordRole: "user",
      truckyRank: "Driver",
      truckyRankColor: "#64748b",
      truckyRole: "Driver",
      isDriver: true,
      nationality: "Indonesia",
      createdAt:
        driverLink.createdAt ||
        (driverLink._id ? driverLink._id.getTimestamp() : new Date()),
    };

    // Auto-heal / provision in background
    db.collection("users")
      .updateOne(
        { discordId: driverLink.userId },
        { $setOnInsert: { ...user, updatedAt: new Date() } },
        { upsert: true },
      )
      .catch((err) => console.error("Auto provision user failed:", err));
  }

  if (!user) notFound();

  // Self-heal: jika user di database belum memiliki createdAt, sinkronkan dari driverLink
  if (driverLink?.createdAt && user?._id && !user.createdAt) {
    user.createdAt = driverLink.createdAt;
    db.collection("users")
      .updateOne(
        { _id: user._id },
        { $set: { createdAt: driverLink.createdAt } },
      )
      .catch((err) => console.error("Auto sync user createdAt failed:", err));
  }

  // Waktu bergabung driver resmi diambil dari dokumen driverlinks
  const joinedDate =
    driverLink?.createdAt ||
    (driverLink?._id ? driverLink._id.getTimestamp() : null) ||
    user.createdAt ||
    (user._id ? user._id.getTimestamp() : null);

  const userDiscordId = driverLink?.userId || user.discordId;

  const loggedInDiscordId = session?.user?.id || session?.user?.discordId;
  const isOwner = loggedInDiscordId === userDiscordId;

  let loggedInUserTruckyId = null;
  if (loggedInDiscordId) {
    const me = await db
      .collection("users")
      .findOne({ discordId: loggedInDiscordId });
    loggedInUserTruckyId = me?.truckyId || null;
  }

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  // Driving Score (ambil dari dokumen users; auto-hitung jika belum pernah terisi)
  let profileDrivingScore: DrivingScoreData | null =
    (user?.drivingScore as DrivingScoreData | undefined) || null;
  if (!profileDrivingScore && userDiscordId) {
    profileDrivingScore = await recalculateUserDrivingScore(
      db,
      String(userDiscordId),
    );
  }

  // Parallel fetches for stats & history
  const [
    points,
    latestJobs,
    userAchievements,
    jobStatsRaw,
    userCollectibles,
    driverPresence,
  ] = await Promise.all([
    db
      .collection("points")
      .findOne({ userId: userDiscordId, guildId: GUILD_ID }),
    db
      .collection("jobhistories")
      .find(
        { guildId: GUILD_ID, truckyId: truckyId, jobStatus: "COMPLETED" },
        { sort: { completedAt: -1 }, projection: { routePath: 0 } },
      )
      .limit(3)
      .toArray(),
    db
      .collection("userachievements")
      .aggregate([
        { $match: { truckyId: truckyId.toString() } },
        {
          $lookup: {
            from: "achievements",
            localField: "achievementId",
            foreignField: "_id",
            as: "achievementDetails",
          },
        },
        { $unwind: "$achievementDetails" },
        {
          $group: {
            _id: "$achievementId",
            count: { $sum: 1 },
            lastEarned: { $max: "$createdAt" },
            achievementDetails: { $first: "$achievementDetails" },
          },
        },
        { $sort: { lastEarned: -1 } },
      ])
      .toArray(),
    db
      .collection("jobhistories")
      .aggregate([
        { $match: { truckyId: truckyId.toString(), guildId: GUILD_ID } },
        {
          $group: {
            _id: null,
            totalCompleted: {
              $sum: { $cond: [{ $eq: ["$jobStatus", "COMPLETED"] }, 1, 0] },
            },
            totalCoachCompleted: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$jobStatus", "COMPLETED"] },
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
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalCanceled: {
              $sum: { $cond: [{ $eq: ["$jobStatus", "CANCELED"] }, 1, 0] },
            },
            totalDrivenDistanceKm: {
              $sum: {
                $cond: [
                  { $eq: ["$jobStatus", "COMPLETED"] },
                  { $ifNull: ["$distanceKm", 0] },
                  0,
                ],
              },
            },
            totalCargoMassT: {
              $sum: {
                $cond: [
                  { $eq: ["$jobStatus", "COMPLETED"] },
                  { $ifNull: ["$cargoMass", 0] },
                  0,
                ],
              },
            },
            totalPassengers: {
              $sum: {
                $cond: [
                  { $eq: ["$jobStatus", "COMPLETED"] },
                  { $ifNull: ["$totalPassengers", 0] },
                  0,
                ],
              },
            },
            recentDuration: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$jobStatus", "COMPLETED"] },
                      { $gte: ["$completedAt", twoWeeksAgo] },
                    ],
                  },
                  { $ifNull: ["$durationSeconds", 0] },
                  0,
                ],
              },
            },
          },
        },
      ])
      .toArray(),
    db
      .collection("collectibles")
      .find({ discordId: userDiscordId })
      .sort({ createdAt: -1 })
      .toArray(),
    fetchDriverPresence(userDiscordId),
  ]);

  const jobStats = jobStatsRaw[0] || {
    totalCompleted: 0,
    totalCoachCompleted: 0,
    totalCanceled: 0,
    totalDrivenDistanceKm: 0,
    totalCargoMassT: 0,
    totalPassengers: 0,
    recentDuration: 0,
  };
  const totalTruckCompleted = Math.max(
    0,
    (jobStats.totalCompleted || 0) - (jobStats.totalCoachCompleted || 0)
  );
  const recentHours = Math.floor(jobStats.recentDuration / 3600);

  // Helper formatting
  const formatNum = (num: number) => num?.toLocaleString("id-ID") || "0";
  const rankColor = user.truckyRankColor || "#8e24aa";

  // XP & Level calculations
  const xpMultiplier = 500;
  const currentXp = user.xp || 0;
  const level = Math.floor(Math.sqrt(currentXp / xpMultiplier)) + 1;
  
  const currentLevelBaseXp = Math.pow(level - 1, 2) * xpMultiplier;
  const nextLevelXp = Math.pow(level, 2) * xpMultiplier;
  
  const xpEarnedInLevel = currentXp - currentLevelBaseXp;
  const xpNeededForCurrentLevel = nextLevelXp - currentLevelBaseXp;
  
  const xpPercentage = Math.min(
    100,
    Math.max(0, Math.round((xpEarnedInLevel / xpNeededForCurrentLevel) * 100)),
  );

  // Determine Favorite Game based on latest job or default to ETS2
  const favoriteGame =
    latestJobs[0]?.game === "ats"
      ? "American Truck Simulator"
      : "Euro Truck Simulator 2";

  const bannerPosition = sanitizeObjectPosition(user.bannerPosition);
  const backgroundPosition = sanitizeObjectPosition(user.backgroundPosition);
  const decorationCatalogMap = user.avatarDecoration
    ? await getAvatarDecorationCatalogMap()
    : null;
  const activeAvatarDecoration =
    user.avatarDecoration && decorationCatalogMap
      ? resolveActiveDecorationDef(
          decorationCatalogMap.get(String(user.avatarDecoration)),
          {
            isNismaraPlus: user.nismaraplus?.status === true,
            isStaff: isUserStaffRole(user.discordRole || user.role),
            isTopManager: isUserTopManagerActive(user.topManager),
          },
        )
      : null;

  const resolvedProfileTheme = resolveProfileTheme(user.profileTheme, {
    isNismaraPlus: user.nismaraplus?.status === true,
    isBooster: user.isBooster === true,
  });

  const lastOnlineSource =
    driverPresence?.lastOnlineAt ||
    user.trackerLastInGameSync ||
    user.trackerLastSync ||
    null;
  const lastOnlineRelative = formatLastOnlineRelative(lastOnlineSource);

  return (
    <ProfileVisualShell
      isOwner={isOwner}
      bannerUrl={user.bannerUrl || null}
      backgroundUrl={user.backgroundUrl || null}
      initialBannerPosition={bannerPosition}
      initialBackgroundPosition={backgroundPosition}
      rankColor={rankColor}
      resolvedTheme={resolvedProfileTheme}
    >
      {/* Content Container (Bottom half) directly attached to banner — solid high-opacity surface avoids 3000px-tall backdrop-blur-xl scroll lag */}
      <div
        className="bg-background/92 border border-border/50 border-t-0 rounded-b-3xl px-6 md:px-10 pb-12 pt-0 shadow-2xl relative z-10 mb-8"
        style={
          resolvedProfileTheme.surfaceGradient
            ? { background: resolvedProfileTheme.surfaceGradient }
            : undefined
        }
      >
          <div className="flex flex-col md:flex-row gap-6 md:gap-10 -mt-10 md:-mt-14 relative z-10 mb-12">
            {/* Avatar */}
            <div className="shrink-0 flex justify-center md:block">
              <DecoratedAvatar
                src={user.image || "/placeholder-avatar.png"}
                alt={user.name || "Driver"}
                decoration={activeAvatarDecoration}
                forcePreview
                sizeClass="w-32 h-32 md:w-44 md:h-44"
                frameClass="border-4 md:border-[6px] border-background shadow-2xl"
                fallbackBg={`${rankColor}11`}
              />
            </div>

            {/* Identity Info */}
            <div className="flex-1 flex flex-col justify-end text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
                <div>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                    <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight drop-shadow-md">
                      {user.name || "Driver"}
                    </h1>
                    <UserBadges
                      role={user.discordRole}
                      isBooster={user.isBooster === true}
                      isNismaraPlus={user.nismaraplus?.status === true}
                      nismaraPlusStartedAt={user.nismaraplus?.startedAt}
                      isTopManager={user.topManager?.status === true && (!user.topManager?.expiredAt || new Date(user.topManager.expiredAt) > new Date())}
                      topManagerMonth={user.topManager?.month}
                      truckyRank={user.truckyRank}
                      className="w-7 h-7 md:w-9 md:h-9"
                    />
                  </div>
                  <p className="text-foreground/85 font-medium mt-1 md:mt-2 text-sm md:text-base flex items-center justify-center md:justify-start gap-2 drop-shadow-sm">
                    <MapPin className="w-4 h-4 opacity-80" />{" "}
                    {user.nationality || "Indonesia"}
                  </p>

                  {/* Live Tracker Presence, Driving Location & Last Online */}
                  {(driverPresence?.online || driverPresence?.lastLocation || lastOnlineRelative) && (
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2.5 text-xs">
                      {driverPresence?.online ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-950/75 text-emerald-300 border border-emerald-400/50 font-semibold shadow-sm">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                            </span>
                            {driverPresence.statusLabel}
                          </span>
                          {driverPresence.locationLabel && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-950/75 text-sky-300 border border-sky-400/45 font-medium shadow-sm">
                              <MapPin className="w-3.5 h-3.5" />
                              {driverPresence.locationLabel}
                            </span>
                          )}
                          {driverPresence.jobSummary?.sourceCity &&
                            driverPresence.jobSummary?.destinationCity && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-950/75 text-violet-300 border border-violet-400/45 font-medium shadow-sm">
                                {driverPresence.jobSummary.jobCategory === "coach" ? (
                                  <Bus className="w-3.5 h-3.5" />
                                ) : (
                                  <Truck className="w-3.5 h-3.5" />
                                )}
                                {driverPresence.jobSummary.sourceCity} →{" "}
                                {driverPresence.jobSummary.destinationCity}
                              </span>
                            )}
                        </>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-950/75 text-zinc-200 border border-white/15 font-medium shadow-sm">
                            <span className="h-2 w-2 rounded-full bg-zinc-400" />
                            Offline
                          </span>
                          {lastOnlineRelative && (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-950/75 text-zinc-200 border border-white/15 font-medium shadow-sm"
                              title={
                                lastOnlineSource
                                  ? new Date(lastOnlineSource).toLocaleString("id-ID", {
                                      timeZone: "Asia/Jakarta",
                                    }) + " WIB"
                                  : undefined
                              }
                            >
                              <Clock className="w-3.5 h-3.5 text-zinc-400" />
                              Last Online: {lastOnlineRelative}
                            </span>
                          )}
                          {driverPresence?.lastLocation && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-950/75 text-zinc-100 border border-white/15 font-medium shadow-sm">
                              <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                              Last Location: {driverPresence.lastLocation}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Level Badge (Steam Style) */}
                <div className="flex flex-col items-center md:items-end">
                  <span className="text-xs font-bold text-foreground/80 uppercase tracking-widest mb-1 drop-shadow-sm">
                    Level
                  </span>
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center border-[3px] bg-zinc-950/80 text-white"
                    style={{
                      borderColor: rankColor,
                      boxShadow: `0 0 18px ${rankColor}55, 0 4px 12px rgba(0,0,0,0.5)`,
                    }}
                  >
                    <span className="text-xl font-black drop-shadow-sm">{level}</span>
                  </div>
                </div>
              </div>

              {/* Badges / Roles */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mt-4 relative z-20">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md border bg-zinc-950/75 text-white shadow-sm"
                  style={{
                    borderColor: `${rankColor}cc`,
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: rankColor,
                      boxShadow: `0 0 8px ${rankColor}`,
                    }}
                  />
                  {user.truckyRank || user.discordRole || "Driver"}
                </span>
                {user.nismaraplus?.status && (
                  <span className="group relative px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md bg-zinc-950/75 text-amber-300 border border-amber-400/50 shadow-sm flex items-center gap-1.5 cursor-help">
                    <Star className="w-3 h-3 text-amber-300" /> Nismara+
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-black/90 backdrop-blur-sm text-white text-[11px] rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg border border-white/10 font-medium normal-case tracking-normal pointer-events-none">
                      Aktif sejak{" "}
                      {user.nismaraplus.startedAt
                        ? format(
                            new Date(user.nismaraplus.startedAt),
                            "d MMMM yyyy",
                            { locale: localeId },
                          )
                        : "sekarang"}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90" />
                    </div>
                  </span>
                )}
                {user.isBooster === true && (
                  <span className="group relative px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md bg-zinc-950/75 text-fuchsia-300 border border-fuchsia-400/50 shadow-sm flex items-center gap-1.5 cursor-help">
                    <Gem className="w-3 h-3 text-fuchsia-300" /> Server Booster
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-black/90 backdrop-blur-sm text-white text-[11px] rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg border border-white/10 font-medium normal-case tracking-normal pointer-events-none">
                      Discord Server Booster
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90" />
                    </div>
                  </span>
                )}
                {user.isDriver && (
                  <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md bg-zinc-950/75 text-emerald-300 border border-emerald-400/50 shadow-sm flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-300" /> Verified Driver
                  </span>
                )}
                {(user.isTmpDriver || user.truckersmpId) && (
                  user.truckersmpId ? (
                    <a
                      href={`https://truckersmp.com/user/${user.truckersmpId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md bg-zinc-950/75 text-orange-300 border border-orange-400/50 hover:bg-zinc-900/90 hover:border-orange-400/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Truck className="w-3.5 h-3.5 text-orange-300" />
                      <span>TruckersMP Driver</span>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-black/90 backdrop-blur-sm text-white text-[11px] rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg border border-white/10 font-medium normal-case tracking-normal pointer-events-none">
                        ID: {user.truckersmpId} &bull; Klik untuk lihat profil TruckersMP
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90" />
                      </div>
                    </a>
                  ) : (
                    <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md bg-zinc-950/75 text-orange-300 border border-orange-400/50 flex items-center gap-1.5 shadow-sm">
                      <Truck className="w-3.5 h-3.5 text-orange-300" />
                      <span>TruckersMP Driver</span>
                    </span>
                  )
                )}
                {user.isHaulmpDriver && (
                  <span className="group relative px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md bg-zinc-950/75 text-cyan-300 border border-cyan-400/50 flex items-center gap-1.5 cursor-help shadow-sm">
                    <Truck className="w-3.5 h-3.5 text-cyan-300" />
                    <span>HaulMP Driver</span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-black/90 backdrop-blur-sm text-white text-[11px] rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg border border-white/10 font-medium normal-case tracking-normal pointer-events-none">
                      {user.haulmpId ? `ID: ${user.haulmpId} • ` : ""}Driver Resmi VTC HaulMP
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90" />
                    </div>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* --- MAIN CONTENT (2 COLUMNS) --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT COLUMN: Gamification & Stats */}
            <div className="lg:col-span-2 space-y-8">
              {/* Game Favorit Showcase (Steam Style) */}
              <div className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-4">
                  <Gamepad2 className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-lg font-bold text-foreground/90 uppercase tracking-widest text-sm">
                    Game Favorit
                  </h2>
                </div>

                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="w-full sm:w-1/3 aspect-video bg-muted rounded-xl overflow-hidden relative border border-border/50 shrink-0 shadow-inner">
                    <img
                      src={
                        latestJobs[0]?.game === "ats"
                          ? "https://images.nismara.my.id/ats.jpg"
                          : "https://images.nismara.my.id/ets.jpg"
                      }
                      alt={favoriteGame}
                      className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white border border-white/10">
                      {latestJobs[0]?.game === "ats" ? "ATS" : "ETS2"}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <h3 className="text-2xl font-bold text-foreground mb-1">
                      {favoriteGame}
                    </h3>
                    <div className="flex flex-wrap items-center gap-6 mt-4">
                      <div>
                        <p className="text-3xl font-light text-foreground">
                          {formatNum(jobStats.totalDrivenDistanceKm || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">
                          KM Driven
                        </p>
                      </div>
                      <div>
                        <p className="text-3xl font-light text-foreground">
                          {formatNum(jobStats.totalCompleted)}
                        </p>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">
                          Selesai
                        </p>
                      </div>
                      <div>
                        <p className="text-3xl font-light text-red-500">
                          {formatNum(jobStats.totalCanceled)}
                        </p>
                        <p className="text-xs text-red-500/70 uppercase tracking-widest font-bold mt-1">
                          Dibatalkan
                        </p>
                      </div>
                    </div>

                    {/* Division Breakdown Pills (Truck vs Coach) */}
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold">
                        <Truck className="w-3.5 h-3.5" />
                        {formatNum(totalTruckCompleted)} Truck Jobs
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
                        <Bus className="w-3.5 h-3.5" />
                        {formatNum(jobStats.totalCoachCompleted || 0)} Coach Trips
                      </span>
                    </div>

                    {/* Recent Driving Info */}
                    {recentHours > 0 && (
                      <div className="mt-4 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg w-fit shadow-[0_0_10px_rgba(var(--primary-rgb),0.1)]">
                        <p className="text-xs font-bold text-primary flex items-center gap-2">
                          <MonitorPlay className="w-4 h-4" />
                          Telah mengemudi {recentHours} jam (2 minggu terakhir)
                        </p>
                      </div>
                    )}

                    {/* XP Progress */}
                    <div className="mt-6">
                      <div className="flex justify-between text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
                        <span>Progres XP (Level {level})</span>
                        <span>
                          {formatNum(currentXp)} / {formatNum(nextLevelXp)}{" "}
                          XP
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-background rounded-full overflow-hidden border border-border/50">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${xpPercentage}%`,
                            backgroundColor: rankColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall Stats (Nismara Info) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-card/40 backdrop-blur-sm p-5 rounded-2xl border border-border/50 text-center hover:bg-card/60 transition-colors">
                  <Package className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                  <p className="text-xl font-black text-foreground">
                    {formatNum(jobStats.totalCargoMassT || 0)}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
                    Total Kargo (t)
                  </p>
                </div>
                <div className="bg-card/40 backdrop-blur-sm p-5 rounded-2xl border border-border/50 text-center hover:bg-card/60 transition-colors">
                  <Users className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                  <p className="text-xl font-black text-foreground">
                    {formatNum(jobStats.totalPassengers || 0)}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
                    Penumpang (Pax)
                  </p>
                </div>
                <div className="bg-card/40 backdrop-blur-sm p-5 rounded-2xl border border-border/50 text-center hover:bg-card/60 transition-colors">
                  <Trophy className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <p className="text-xl font-black text-foreground">
                    {formatNum(userCollectibles.length)}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
                    Total Convoy
                  </p>
                </div>
                <div className="bg-card/40 backdrop-blur-sm p-5 rounded-2xl border border-border/50 text-center hover:bg-card/60 transition-colors">
                  <TriangleAlert className="w-6 h-6 mx-auto mb-2 text-red-500" />
                  <p className="text-xl font-black text-foreground">
                    {formatNum(points?.totalPoints || 0)}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
                    Penalti
                  </p>
                </div>
              </div>

              {/* Driving Score & Safety Rating */}
              <DrivingScoreCard
                drivingScore={profileDrivingScore}
                variant="profile"
              />

              {/* Aktivitas Terkini (Recent Activity) */}
              <div className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-4">
                  <Activity className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-lg font-bold text-foreground/90 uppercase tracking-widest text-sm">
                    Aktivitas Terkini
                  </h2>
                </div>

                {latestJobs.length > 0 ? (
                  <div className="space-y-3">
                    {latestJobs.map((job: any) => {
                      const isCoach =
                        job.jobCategory === "coach" ||
                        job.marketType === "bus_company_job" ||
                        job.marketType === "bus_tourist_job";
                      const stopsCount = Array.isArray(job.stops)
                        ? job.stops.length
                        : 0;
                      const paxCount = job.totalPassengers || 0;

                      return (
                        <Link
                          href={`/jobs/${job.jobId || job._id.toString()}`}
                          key={job.jobId || job._id.toString()}
                        >
                          <div className="group flex flex-col sm:flex-row items-center gap-6 bg-background/50 border border-border/30 rounded-xl p-5 hover:border-primary/50 transition-colors relative overflow-hidden mb-3">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />

                            <div
                              className={`w-16 h-16 rounded-2xl bg-card border flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform ${
                                isCoach
                                  ? "border-amber-500/40"
                                  : "border-border/50"
                              }`}
                            >
                              {isCoach ? (
                                <Bus className="w-8 h-8 text-amber-400 group-hover:text-amber-300 transition-colors" />
                              ) : (
                                <Truck className="w-8 h-8 text-primary/70 group-hover:text-primary transition-colors" />
                              )}
                            </div>
                            <div className="flex-1 text-center sm:text-left z-10">
                              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                                <h4 className="font-bold text-foreground text-lg line-clamp-1 group-hover:text-primary transition-colors">
                                  {job.cargoName || "Unknown Cargo"}
                                </h4>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                    isCoach
                                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                      : "bg-sky-500/15 text-sky-400 border-sky-500/30"
                                  }`}
                                >
                                  {isCoach ? "🚌 Coach" : "🚛 Truck"}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                <span className="font-medium text-foreground/80">
                                  {job.sourceCity}
                                </span>
                                <span className="hidden sm:inline text-muted-foreground/50">
                                  →
                                </span>
                                <span className="inline sm:hidden text-muted-foreground/50">
                                  ↓
                                </span>
                                <span className="font-medium text-foreground/80">
                                  {job.destinationCity}
                                </span>
                                {isCoach ? (
                                  <span className="text-xs text-amber-400/90 font-semibold sm:ml-2">
                                    • {stopsCount} Halte • {paxCount} Pax
                                  </span>
                                ) : job.cargoMass ? (
                                  <span className="text-xs text-muted-foreground sm:ml-2">
                                    • {job.cargoMass} Ton
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            <div className="text-center sm:text-right shrink-0 z-10 border-t sm:border-t-0 sm:border-l border-border/30 pt-4 sm:pt-0 sm:pl-6 mt-2 sm:mt-0 w-full sm:w-auto">
                              <p className="text-sm text-muted-foreground mb-1">
                                {job.completedAt
                                  ? formatDistanceToNow(
                                      new Date(job.completedAt),
                                      {
                                        addSuffix: true,
                                        locale: localeId,
                                      },
                                    )
                                  : "Baru saja"}
                              </p>
                              {(() => {
                                const val =
                                  typeof job.revenue === "number"
                                    ? job.revenue
                                    : (job.nc?.total ?? 0);
                                return (
                                  <p
                                    className={`font-black text-xl ${
                                      val < 0
                                        ? "text-red-400"
                                        : val > 0
                                          ? "text-primary"
                                          : "text-muted-foreground"
                                    }`}
                                  >
                                    {val > 0 ? "+" : ""}
                                    {formatNum(val)} NC
                                  </p>
                                );
                              })()}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground bg-background/30 rounded-xl border border-dashed border-border">
                    Belum ada aktivitas pekerjaan yang tercatat.
                  </div>
                )}
              </div>

              {/* Collectibles */}
              <CollectibleSection
                collectibles={JSON.parse(JSON.stringify(userCollectibles))}
              />
            </div>

            {/* RIGHT COLUMN: Info & Socials */}
            <div className="space-y-8">
              {/* Status Online / Basic Info */}
              <div className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-foreground/90 uppercase tracking-widest text-sm mb-6 border-b border-border/50 pb-4">
                  Informasi Driver
                </h2>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Bergabung
                    </span>
                    <span className="text-sm font-bold text-foreground bg-background/50 px-2 py-1 rounded border border-border/50">
                      {joinedDate
                        ? new Date(joinedDate).toLocaleDateString("id-ID", {
                            timeZone: "Asia/Jakarta",
                          })
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Role
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {user.truckyRole || (user.discordRole === "manager" ? "Staff / Manager" : "Member")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Status
                    </span>
                    <span
                      className={`text-sm font-bold px-2 py-1 rounded border ${user.isOnLeave ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"}`}
                    >
                      {user.isOnLeave ? "Cuti" : "Aktif"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lencana / Badges */}
              <AchievementSection
                userAchievements={JSON.parse(JSON.stringify(userAchievements))}
              />

              {/* Social Links */}
              <div className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-foreground/90 uppercase tracking-widest text-sm mb-6 border-b border-border/50 pb-4">
                  Koneksi Sosmed
                </h2>
                <div className="space-y-3">
                  {user.social_media?.youtube && (
                    <a
                      href={user.social_media.youtube}
                      target="_blank"
                      className="group flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/30 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                          <YoutubeIcon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-foreground">
                          YouTube
                        </span>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-red-500" />
                    </a>
                  )}
                  {user.social_media?.facebook && (
                    <a
                      href={user.social_media.facebook}
                      target="_blank"
                      className="group flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/30 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                          <FacebookIcon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-foreground">
                          Facebook
                        </span>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-blue-500" />
                    </a>
                  )}
                  {user.social_media?.instagram && (
                    <a
                      href={user.social_media.instagram}
                      target="_blank"
                      className="group flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/30 hover:bg-pink-500/10 hover:border-pink-500/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-pink-500/10 rounded-lg text-pink-500 group-hover:bg-pink-500 group-hover:text-white transition-colors">
                          <InstagramIcon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-foreground">
                          Instagram
                        </span>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-pink-500" />
                    </a>
                  )}
                  {user.social_media?.world_of_truck && (
                    <a
                      href={user.social_media.world_of_truck}
                      target="_blank"
                      className="group flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/30 hover:bg-orange-500/10 hover:border-orange-500/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                          <Globe className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-foreground">
                          World of Trucks
                        </span>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-orange-500" />
                    </a>
                  )}
                  {user.truckersmpId && (
                    <a
                      href={`https://truckersmp.com/user/${user.truckersmpId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/30 hover:bg-orange-500/10 hover:border-orange-500/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                          <Truck className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-foreground block">
                            TruckersMP
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ID: {user.truckersmpId}
                          </span>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-orange-500" />
                    </a>
                  )}
                  {/* Fallback if no socials */}
                  {!user.social_media?.youtube &&
                    !user.social_media?.facebook &&
                    !user.social_media?.instagram &&
                    !user.social_media?.world_of_truck &&
                    !user.truckersmpId && (
                      <p className="text-sm text-muted-foreground text-center italic py-2">
                        Belum ada sosial media yang ditautkan.
                      </p>
                    )}
                </div>
              </div>
            </div>
          </div>

          {/* --- TRUCK SHOWCASE (Instagram Style Gallery) --- */}
          <div className="mt-24 bg-card/40 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]">
                  <Grid3X3 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">
                    Galeri Truk
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Koleksi foto perjalanan dan armada kebanggaan.
                  </p>
                </div>
              </div>

              {/* Navigasi / Filter Mockup */}
              <div className="flex bg-background/50 p-1 rounded-xl border border-border/50 w-fit">
                <button className="px-4 py-1.5 rounded-lg bg-card shadow text-sm font-bold text-foreground border border-border/50">
                  Postingan
                </button>
                <button className="px-4 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground">
                  Tag
                </button>
              </div>
            </div>

            {/* Grid Layout (3 Columns) */}
            <GalleryGrid
              truckyId={truckyId}
              isOwner={isOwner}
              discordId={String(loggedInDiscordId || "")}
              loggedInUserTruckyId={loggedInUserTruckyId}
              profileName={user.name || "Pemilik"}
              profileAvatar={
                user.image || "/placeholder-avatar.png"
              }
              profileAvatarDecoration={user.avatarDecoration || null}
              profileDiscordId={userDiscordId}
              profileIsNismaraPlus={user.nismaraplus?.status === true}
              profileIsBooster={user.isBooster === true}
              profileRole={user.discordRole || "user"}
              profileTopManager={user.topManager}
              isManager={isManager}
            />
          </div>
        </div>
    </ProfileVisualShell>
  );
}
