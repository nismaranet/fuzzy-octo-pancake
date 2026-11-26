import clientPromise from "@/lib/mongodb";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTruckyFullJobData, getCompanyMembersMap } from "@/lib/trucky";
import IncidentLogs from "@/components/IncidentLogs";
import AppealButton from "./AppealButton";
import DecoratedAvatar from "@/components/profile/DecoratedAvatar";
import UserBadges from "@/components/icons/UserBadges";
import {
  ArrowLeft,
  Truck,
  Bus,
  Users,
  MapPin,
  Compass,
  Navigation,
  Fuel,
  ShieldAlert,
  Gauge,
  Zap,
  AlertCircle,
  Boxes,
  Timer,
  Weight,
  User,
  Calendar,
  Clock,
  Coins,
  TrendingDown,
  CheckCircle,
  Star,
  HelpCircle,
  Medal,
} from "lucide-react";

// Helper Format Waktu (Durasi)
function formatDuration(seconds: number) {
  if (!seconds) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}j ${m}m ${s}d`;
  return `${m}m ${s}d`;
}

// Helper Waktu WIB
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

// Komponen Render Bintang Hardcore
function HardcoreStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={14}
          className={
            star <= Math.round(rating)
              ? "fill-yellow-500 text-yellow-500"
              : "text-slate-300 dark:text-gray-600"
          }
        />
      ))}
      <span className="text-xs font-bold ml-2 text-foreground">
        {rating.toFixed(2)}
      </span>
    </div>
  );
}

export const revalidate = 600;

export default async function JobDetailPage(props: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await props.params;
  const client = await clientPromise;
  const db = client.db();

  const localJob = await db.collection("jobhistories").findOne({
    $or: [{ jobId: jobId }, { jobId: Number(jobId) }],
  });

  const trucky = await getTruckyFullJobData(jobId);

  if (!localJob && !trucky.details) notFound();

  const details = trucky.details || {};
  const events = trucky.events || [];
  const isCompleted =
    localJob?.jobStatus === "COMPLETED" || details?.status === "completed";

  const isCoach =
    localJob?.jobCategory === "coach" ||
    localJob?.cargoId === "Passengers" ||
    localJob?.cargoId === "bus_company_job" ||
    localJob?.cargoId === "bus_tourist_job" ||
    String(details?.market || "").startsWith("bus_") ||
    details?.cargo_id === "Passengers" ||
    String(
      details?.stats_type || details?.type || localJob?.statsType || "",
    ).startsWith("coaches");

  const rawStops =
    Array.isArray(localJob?.stops) && localJob.stops.length > 0
      ? localJob.stops
      : Array.isArray(details?.stops)
        ? details.stops.map((s: any) => ({
            progressive: Number(s.progressive) || 0,
            isLastStop: Boolean(s.is_last_stop),
            inGameId: s.in_game_id || "",
            name: s.name || "-",
            type: s.type || "city",
            typeName: s.type_name || "City",
            passengersIn: Number(s.passengers_in) || 0,
            passengersOut: Number(s.passengers_out) || 0,
            drivenDistanceKm:
              Number(s.driven_distance_km ?? s.driven_distance) || 0,
            inGameTimeEnd: Number(s.in_game_time_end) || 0,
            realTimeEnd: s.real_time_end ? new Date(s.real_time_end) : null,
          }))
        : [];

  const stops = [...rawStops].sort(
    (a: any, b: any) => (a.progressive || 0) - (b.progressive || 0),
  );
  const totalPassengers =
    localJob?.totalPassengers ||
    stops.reduce(
      (sum: number, s: any) => sum + (Number(s.passengersIn) || 0),
      0,
    );

  const gameMode = localJob?.gameMode || "Unknown Lobby";

  // Check if there is an assigned trucky vehicle or Nismara fleet
  let internalFleet = null;
  const fleetObjId = localJob?.fleet_data?.fleet_id;
  const legacyVehicleId =
    localJob?.vehicleId || details?.vehicle?.id?.toString();

  if (fleetObjId || legacyVehicleId) {
    const matchQuery = fleetObjId
      ? { _id: fleetObjId }
      : { id: legacyVehicleId };

    internalFleet = await db
      .collection("fleets")
      .aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: "fleetstores",
            localField: "model",
            foreignField: "_id",
            as: "modelInfo",
          },
        },
        { $unwind: { path: "$modelInfo", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "fleetbrands",
            localField: "modelInfo.brand",
            foreignField: "_id",
            as: "brandInfo",
          },
        },
        { $unwind: { path: "$brandInfo", preserveNullAndEmptyArrays: true } },
      ])
      .toArray();
    if (internalFleet && internalFleet.length > 0) {
      internalFleet = internalFleet[0];
    } else {
      internalFleet = null;
    }
  }

  // Kalkulasi Rata-rata Damage
  const vDamage = details?.vehicle_damage ?? localJob?.damage?.vehicle ?? 0;
  const tDamage = details?.trailers_damage ?? localJob?.damage?.trailer ?? 0;
  const cDamage = details?.cargo_damage ?? localJob?.damage?.cargo ?? 0;
  const avgDamage = (
    isCoach && tDamage === 0
      ? (vDamage + cDamage) / 2
      : (vDamage + tDamage + cDamage) / 3
  ).toFixed(1);

  // Prioritas Data Driver
  const truckyId = localJob?.truckyId || details?.user_id;
  const discordId = localJob?.driverId;

  let driverName = `Driver #${discordId || truckyId}`;
  let driverAvatar = null;
  let driverProfileTruckyId: string | number | null = truckyId || null;
  let driverAvatarDecoration: string | null = null;
  let driverIsNismaraPlus = false;
  let driverNismaraPlusStartedAt: any = null;
  let driverIsBooster = false;
  let driverRole: string | null = null;
  let driverTopManager: any = null;
  let driverTruckyRank: string | null = null;
  let driverRank = "Driver";
  let rankColor = "#6b7280";

  if (truckyId || discordId) {
    const mongoUser = await db.collection("users").findOne({
      $or: [
        { truckyId: truckyId },
        { truckyId: Number(truckyId) },
        { id: discordId },
        { discordId: discordId },
      ],
    });

    if (mongoUser && mongoUser.name) {
      driverName = mongoUser.name;
      driverAvatar = mongoUser.image || null;
      driverProfileTruckyId = mongoUser.truckyId || truckyId || null;
      driverAvatarDecoration = mongoUser.avatarDecoration || null;
      driverIsNismaraPlus = mongoUser.nismaraplus?.status === true;
      driverNismaraPlusStartedAt = mongoUser.nismaraplus?.startedAt || null;
      driverIsBooster = mongoUser.isBooster === true;
      driverRole = mongoUser.discordRole || mongoUser.role || null;
      driverTopManager = mongoUser.topManager || null;
      driverTruckyRank = mongoUser.truckyRank || null;
      const membersMap = await getCompanyMembersMap(35643);
      const member = membersMap[Number(truckyId)];
      if (member) {
        driverRank = member.rank?.name || member.role?.name || driverRank;
        rankColor = member.rank?.color || member.role?.color || rankColor;
      } else if (mongoUser.truckyRole) {
        driverRank = mongoUser.truckyRole;
        rankColor = mongoUser.truckyRoleColor || rankColor;
      }
    } else if (truckyId) {
      const membersMap = await getCompanyMembersMap(35643);
      const member = membersMap[Number(truckyId)];
      if (member) {
        driverName = member.username || member.name || driverName;
        driverAvatar = member.avatar_url || null;
        driverRank = member.rank?.name || driverRank;
        rankColor = member.rank?.color || rankColor;
      }
    }
  }

  // 1. Definisikan objek warna secara terpisah
  const statusMap = {
    COMPLETED:
      "text-green-600 bg-green-100 border-green-200 dark:text-green-400 dark:bg-green-400/10 dark:border-green-400/20",
    ONGOING:
      "text-blue-600 bg-blue-100 border-blue-200 dark:text-blue-400 dark:bg-blue-400/10 dark:border-blue-400/20 animate-pulse",
    CANCELED:
      "text-red-600 bg-red-100 border-red-200 dark:text-red-400 dark:bg-red-400/10 dark:border-red-400/20",
  };

  // 2. Ambil warnanya. TypeScript sekarang tidak akan protes.
  const statusColor =
    statusMap[localJob?.jobStatus as keyof typeof statusMap] ||
    "text-slate-600 bg-slate-100 border-slate-200 dark:text-gray-400 dark:bg-gray-400/10 dark:border-gray-400/20";

  const getLobbyInfo = (id: string) => {
    const lower = (id || "").toLowerCase();
    if (lower === "truckersmp") {
      return {
        name: "Truckers MP",
        color: "text-accent-sky",
        bg: "bg-accent-sky/10",
      };
    }
    if (lower === "haulmp") {
      return {
        name: "HaulMP",
        color: "text-emerald-400",
        bg: "bg-emerald-400/10",
      };
    }
    return {
      name: "SinglePlayer / Convoy",
      color: "text-accent-lilac",
      bg: "bg-accent-lilac/10",
    };
  };

  const gameLobby = getLobbyInfo(gameMode);

  return (
    <main className="min-h-screen pt-32 pb-20 px-4 bg-background transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        {/* Header & Status */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/jobs"
            className="flex items-center gap-2 text-slate-500 hover:text-primary font-bold text-sm transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Kembali ke Daftar Job
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <AppealButton jobId={jobId} driverId={discordId} />
            {isCoach ? (
              <div className="px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest bg-sky-500/15 text-sky-400 border-sky-500/30 flex items-center gap-1.5">
                <Bus className="w-3.5 h-3.5" /> Coach / Bus
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-400 border-orange-500/20 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" /> Truck Logistics
              </div>
            )}
            <div
              className={`px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${statusColor}`}
            >
              {localJob?.jobStatus || details?.status || "UNKNOWN"}
            </div>
            <div
              className={`px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${gameLobby.color}`}
            >
              {gameLobby.name}
            </div>
          </div>
        </div>

        {/* --- DRIVER & ROUTE INFO --- */}
        <div className="glass-panel p-8 lg:p-10 rounded-[3rem] border-primary/20 bg-card mb-8 relative overflow-hidden">
          <div className="flex items-center gap-4 mb-8 pb-8 border-b border-slate-200 dark:border-white/5">
            {driverProfileTruckyId ? (
              <Link
                href={`/profile/${driverProfileTruckyId}`}
                className="inline-flex items-center gap-4 group"
              >
                <DecoratedAvatar
                  src={driverAvatar}
                  alt={driverName}
                  fallbackText={driverName.charAt(0)}
                  decorationId={driverAvatarDecoration}
                  isNismaraPlus={driverIsNismaraPlus}
                  userRole={driverRole}
                  topManager={driverTopManager}
                  sizeClass="w-14 h-14"
                  frameClass="bg-slate-100 dark:bg-card border-2 border-slate-200 dark:border-white/10 group-hover:border-primary/60 transition-colors"
                />
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">
                    Assigned Driver
                  </p>
                  <h3 className="text-lg font-black text-foreground flex flex-wrap items-center gap-2">
                    <span className="group-hover:text-primary transition-colors">
                      {driverName}
                    </span>
                    <UserBadges
                      role={driverRole || undefined}
                      isBooster={driverIsBooster}
                      isNismaraPlus={driverIsNismaraPlus}
                      nismaraPlusStartedAt={driverNismaraPlusStartedAt}
                      truckyRank={driverTruckyRank || undefined}
                      topManager={driverTopManager}
                      className="w-4 h-4"
                    />
                    <span
                      className="text-[9px] px-2 py-0.5 rounded uppercase tracking-wider border"
                      style={{
                        color: rankColor,
                        borderColor: `${rankColor}50`,
                        backgroundColor: `${rankColor}10`,
                      }}
                    >
                      {driverRank}
                    </span>
                  </h3>
                </div>
              </Link>
            ) : (
              <>
                <DecoratedAvatar
                  src={driverAvatar}
                  alt={driverName}
                  fallbackText={driverName.charAt(0)}
                  decorationId={driverAvatarDecoration}
                  isNismaraPlus={driverIsNismaraPlus}
                  userRole={driverRole}
                  topManager={driverTopManager}
                  sizeClass="w-14 h-14"
                  frameClass="bg-slate-100 dark:bg-card border-2 border-slate-200 dark:border-white/10"
                />
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">
                    Assigned Driver
                  </p>
                  <h3 className="text-lg font-black text-foreground flex flex-wrap items-center gap-2">
                    {driverName}
                    <span
                      className="text-[9px] px-2 py-0.5 rounded uppercase tracking-wider border"
                      style={{
                        color: rankColor,
                        borderColor: `${rankColor}50`,
                        backgroundColor: `${rankColor}10`,
                      }}
                    >
                      {driverRank}
                    </span>
                  </h3>
                </div>
              </>
            )}
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">
            <div className="text-center lg:text-left">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">
                Source
              </p>
              <h2 className="text-3xl font-black text-foreground">
                {localJob?.sourceCity || details?.source_city}
              </h2>
              <p className="text-primary font-bold text-sm">
                {localJob?.sourceCompany || details?.source_company}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-full h-px bg-linear-to-r from-transparent via-primary/50 to-transparent relative">
                <Navigation className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-1" />
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                {localJob?.game || details?.game_name || "Simulator"}
              </span>
            </div>

            <div className="text-center lg:text-right">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">
                Destination
              </p>
              <h2 className="text-3xl font-black text-foreground">
                {localJob?.destinationCity || details?.destination_city}
              </h2>
              <p className="text-primary font-bold text-sm">
                {localJob?.destinationCompany || details?.destination_company}
              </p>
            </div>
          </div>
        </div>

        {/* --- QUICK STATS GRID --- */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatBox
            icon={<Navigation className="text-blue-500 dark:text-blue-400" />}
            label={localJob?.statsType || "Distance"}
            value={`${(details?.real_distance || (isCompleted ? localJob?.distanceKm : localJob?.plannedDistanceKm) || 0).toLocaleString()} km`}
          />
          {isCoach ? (
            <StatBox
              icon={<Users className="text-sky-500 dark:text-sky-400" />}
              label="Passengers"
              value={`${totalPassengers} Pax`}
            />
          ) : (
            <StatBox
              icon={<Weight className="text-orange-500 dark:text-orange-400" />}
              label="Weight"
              value={`${localJob?.cargoMass || details?.cargo_weight || 0} T`}
            />
          )}
          <StatBox
            icon={<Clock className="text-yellow-500 dark:text-yellow-400" />}
            label="Duration"
            value={formatDuration(localJob?.durationSeconds)}
          />
          <StatBox
            icon={<Fuel className="text-green-500 dark:text-green-400" />}
            label="Fuel"
            value={`${details?.fuel_used_l?.toFixed(1) || 0} L`}
          />
          <StatBox
            icon={<ShieldAlert className="text-red-500 dark:text-red-400" />}
            label="Avg Damage"
            value={`${avgDamage}%`}
          />
          {isCoach ? (
            <StatBox
              icon={<MapPin className="text-emerald-500 dark:text-emerald-400" />}
              label="Stops / Halte"
              value={stops.length > 0 ? `${stops.length} Titik` : "Direct"}
            />
          ) : (
            <StatBox
              icon={<CheckCircle className="text-primary" />}
              label="Market"
              value={localJob?.marketType?.split(" ")[0] || "-"}
            />
          )}
        </div>

        {/* --- MAIN CONTENT GRID --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* --- COACH TRANSIT & STOPS TIMELINE --- */}
            {isCoach && stops.length > 0 && (
              <div className="glass-panel p-8 rounded-[2.5rem] border-sky-500/30 bg-card relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-white/5">
                  <div>
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-3">
                      <Bus className="text-sky-500 w-5 h-5" /> Rute Transit &
                      Pemberhentian Penumpang
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                       Urutan halte kota dan titik wisata (viewpoints) yang
                      disinggahi selama perjalanan bus
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-sky-500/15 text-sky-400 border border-sky-500/30">
                      {stops.length} Halte
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {totalPassengers} Total Pax
                    </span>
                  </div>
                </div>

                <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-0.5 before:bg-sky-500/30">
                  {stops.map((stop: any, idx: number) => {
                    const isViewpoint =
                      String(stop.type || "").toLowerCase() === "viewpoints" ||
                      String(stop.typeName || "").toLowerCase() === "viewpoints";
                    const isFirst = idx === 0;
                    const isLast = Boolean(stop.isLastStop) || idx === stops.length - 1;

                    return (
                      <div
                        key={`${stop.progressive || idx}-${stop.inGameId || stop.name}`}
                        className="relative p-4 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        {/* Timeline Dot */}
                        <div
                          className={`w-4 h-4 rounded-full border-2 absolute -left-[21px] top-5 ${
                            isFirst || isLast
                              ? "bg-sky-500 border-sky-300 shadow-md shadow-sky-500/40"
                              : isViewpoint
                                ? "bg-amber-500 border-amber-300"
                                : "bg-card border-sky-500"
                          }`}
                        />

                        <div className="flex items-start gap-3">
                          <div className="px-2 py-1 rounded-lg bg-sky-500/10 text-sky-400 font-black text-xs border border-sky-500/20 shrink-0">
                            #{stop.progressive || idx + 1}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-black text-sm text-foreground">
                                {stop.name || "-"}
                              </h4>
                              <span
                                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                                  isViewpoint
                                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                    : "bg-sky-500/15 text-sky-400 border-sky-500/30"
                                }`}
                              >
                                {isViewpoint ? (
                                  <Compass className="w-3 h-3" />
                                ) : (
                                  <MapPin className="w-3 h-3" />
                                )}
                                {stop.typeName || (isViewpoint ? "Viewpoints" : "City")}
                              </span>
                              {isFirst && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                                  Keberangkatan
                                </span>
                              )}
                              {isLast && !isFirst && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/15 text-purple-400">
                                  Terminal Akhir
                                </span>
                              )}
                            </div>

                            {stop.realTimeEnd && (
                              <p className="text-[11px] text-slate-500 font-mono mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Tiba:{" "}
                                {formatWIB(stop.realTimeEnd)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {Number(stop.passengersIn) > 0 && (
                            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              +{stop.passengersIn} Naik
                            </span>
                          )}
                          {Number(stop.passengersOut) > 0 && (
                            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              -{stop.passengersOut} Turun
                            </span>
                          )}
                          {Number(stop.passengersIn) === 0 &&
                            Number(stop.passengersOut) === 0 && (
                              <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Kunjungan Wisata
                              </span>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* --- FINANCIAL & PENALTY BREAKDOWN --- */}
            {isCompleted && (
              <>
                {(localJob?.nc || localJob?.ncCost) && (
                  <div className="glass-panel p-8 rounded-[2.5rem] border-primary/20 bg-card">
                    <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-3">
                      <Coins className="text-primary w-5 h-5" /> Rincian
                      Finansial (Nismara Coins)
                    </h3>
                    <div className="space-y-3">
                      <BreakdownRow
                        label={
                          localJob?.lockedCargoPrice
                            ? `Base Earning (${localJob.lockedCargoPrice} NC / km)`
                            : "Base Earning"
                        }
                        value={localJob?.nc?.base}
                        color="text-green-600 dark:text-green-400"
                      />
                      <BreakdownRow
                        label={
                          localJob?.isSpecialContract &&
                          localJob?.lockedCargoPrice
                            ? `Special Contract (${localJob.lockedCargoPrice} NC / km)`
                            : "Special Contract Bonus"
                        }
                        value={localJob?.nc?.special}
                        color="text-yellow-600 dark:text-yellow-400"
                      />
                      <BreakdownRow
                        label="Hardcore Bonus"
                        value={localJob?.nc?.hardcore}
                        color="text-purple-600 dark:text-purple-400"
                      />
                      <BreakdownRow
                        label="Event Bonus"
                        value={localJob?.nc?.event}
                        color="text-blue-600 dark:text-blue-400"
                      />
                      <BreakdownRow
                        label="TruckersMP Bonus"
                        value={localJob?.nc?.truckersmp}
                        color="text-blue-600 dark:text-blue-400"
                      />
                      <BreakdownRow
                        label="HaulMP Bonus"
                        value={localJob?.nc?.haulmp}
                        color="text-emerald-600 dark:text-emerald-400"
                      />
                      <BreakdownRow
                        label="Nismara Plus Bonus"
                        value={localJob?.nc?.nismaraplus}
                        color="text-blue-600 dark:text-blue-400"
                      />
                      <BreakdownRow
                        label="Discord Booster Bonus"
                        value={localJob?.nc?.booster}
                        color="text-blue-600 dark:text-blue-400"
                      />
                      {(localJob?.nc?.userBoost > 0 ||
                        localJob?.nc?.voucher_boost > 0) && (
                        <BreakdownRow
                          label="Personal NC Boost"
                          value={
                            localJob?.nc?.userBoost ||
                            localJob?.nc?.voucher_boost
                          }
                          color="text-amber-500 dark:text-amber-400"
                        />
                      )}

                      {/* Pengeluaran */}
                      <BreakdownRow
                        label={
                          localJob?.rentPricePerKm
                            ? `Biaya Sewa (${localJob.rentPricePerKm} NC / km)`
                            : "Biaya Sewa"
                        }
                        value={localJob?.ncCost?.rent}
                        isPenalty
                      />
                      {localJob?.ncCost?.rentShare > 0 && (
                        <BreakdownRow
                          label={`Bagi Hasil Pemilik Armada (${Math.round((localJob?.rentShareRate || 0.25) * 100)}%)`}
                          value={localJob?.ncCost?.rentShare}
                          isPenalty
                        />
                      )}
                      <BreakdownRow
                        label="Biaya Servis"
                        value={localJob?.ncCost?.service}
                        isPenalty
                      />
                      <BreakdownRow
                        label={`Pajak (${Number(((localJob?.tax?.rate || 0) * 100).toFixed(2))}%)`}
                        value={localJob?.tax?.amount}
                        isPenalty
                      />
                      <BreakdownRow
                        label={
                          localJob?.marketFuelPricePerL
                            ? `Biaya Bahan Bakar (${localJob.marketFuelPricePerL} NC / L)`
                            : "Biaya Bahan Bakar"
                        }
                        value={localJob?.ncCost?.fuel}
                        isPenalty
                      />
                      <BreakdownRow
                        label={
                          localJob?.fines_events &&
                          localJob.fines_events.length > 0 ? (
                            <div className="flex items-center gap-1 relative group cursor-help">
                              <span>Denda / Fines</span>
                              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 p-3 bg-slate-800 text-slate-200 text-xs rounded-xl shadow-2xl z-20 border border-slate-700">
                                <p className="font-bold text-white border-b border-slate-600 pb-1.5 mb-1.5">
                                  Rincian Denda:
                                </p>
                                <ul className="space-y-1">
                                  {localJob.fines_events.map(
                                    (fine: any, idx: number) => (
                                      <li
                                        key={fine._id || idx}
                                        className="flex justify-between items-center gap-2"
                                      >
                                        <span className="truncate">
                                          {fine.offenceName}
                                        </span>
                                        <span className="text-red-400 font-bold shrink-0">
                                          -{fine.amount}
                                        </span>
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </div>
                            </div>
                          ) : (
                            "Denda / Fines"
                          )
                        }
                        value={localJob?.ncCost?.fines}
                        isPenalty
                      />

                      {/* Total Pengeluaran */}
                      <BreakdownRow
                        label="Penalti Menggunakan Kendaraan Harus di Services"
                        value={localJob?.maintenance_penalty}
                        isPenalty
                      />

                      {/* Diskon Pengeluaran */}
                      <BreakdownRow
                        label="Diskon Asuransi Servis"
                        value={localJob?.discount?.insurance}
                        color="text-green-600 dark:text-green-400"
                      />
                      <BreakdownRow
                        label="Diskon Nismara Plus"
                        value={localJob?.discount?.nismaraplus}
                        color="text-green-600 dark:text-green-400"
                      />

                      {/* Hasil Bersih */}
                      <div className="border-t border-slate-200 dark:border-white/10 pt-4 mt-4 flex justify-between items-center">
                        <span className="font-black text-foreground uppercase text-sm tracking-wider">
                          Pendapatan Bersih
                        </span>
                        {(() => {
                          const netRevenue =
                            typeof localJob?.revenue === "number"
                              ? localJob.revenue
                              : (localJob?.nc?.total || 0) -
                                (localJob?.ncCost?.total || 0);
                          const isPositive = netRevenue > 0;
                          const isNegative = netRevenue < 0;

                          return (
                            <span
                              className={`text-3xl font-black ${
                                isNegative
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-green-600 dark:text-green-400"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {netRevenue.toLocaleString("id-ID")} NC
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {localJob?.xp && (
                  <div className="glass-panel p-8 rounded-[2.5rem] border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-900/5 mt-8">
                    <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-3">
                      <Medal className="text-blue-500 w-5 h-5" /> Rincian
                      Experience Points (XP)
                    </h3>
                    <div className="space-y-3">
                      <BreakdownRow
                        label="Base XP"
                        value={localJob.xp.base}
                        color="text-green-600 dark:text-green-400"
                      />
                      <BreakdownRow
                        label="Special Contract Bonus"
                        value={localJob.xp.special}
                        color="text-yellow-600 dark:text-yellow-400"
                      />
                      <BreakdownRow
                        label="Hardcore Bonus"
                        value={localJob.xp.hardcore}
                        color="text-purple-600 dark:text-purple-400"
                      />
                      <BreakdownRow
                        label="Event Bonus"
                        value={localJob.xp.event}
                        color="text-blue-600 dark:text-blue-400"
                      />
                      <BreakdownRow
                        label="Nismara Plus Bonus"
                        value={localJob.xp.nismaraplus}
                        color="text-blue-600 dark:text-blue-400"
                      />
                      <BreakdownRow
                        label="Discord Booster Bonus"
                        value={localJob.xp.booster}
                        color="text-blue-600 dark:text-blue-400"
                      />

                      <div className="border-t border-slate-200 dark:border-white/10 pt-4 mt-4 flex justify-between items-center">
                        <span className="font-black text-foreground uppercase text-sm tracking-wider">
                          Total XP
                        </span>
                        <span className="text-3xl font-black text-blue-600 dark:text-blue-400">
                          +{localJob.xp.total?.toLocaleString() || 0} XP
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Penalty Section */}
            {isCompleted && (
              <div>
                {(localJob?.penalty?.total || 0) > 0 ? (
                  <div className="glass-panel p-8 rounded-[2.5rem] border-orange-200 bg-orange-50 dark:border-orange-500/20 dark:bg-orange-500/5">
                    <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-3">
                      <AlertCircle className="text-orange-600 dark:text-orange-400 w-5 h-5" />{" "}
                      Penalti Poin (Pelanggaran)
                    </h3>
                    <div className="space-y-3">
                      <BreakdownRow
                        label="Vehicle Damage"
                        value={localJob?.penalty?.vehicle}
                        isPenalty
                      />
                      <BreakdownRow
                        label="Trailer Damage"
                        value={localJob?.penalty?.trailer}
                        isPenalty
                      />
                      <BreakdownRow
                        label="Cargo Damage"
                        value={localJob?.penalty?.cargo}
                        isPenalty
                      />
                      <BreakdownRow
                        label="Speeding Violations"
                        value={localJob?.penalty?.speed}
                        isPenalty
                      />
                      <BreakdownRow
                        label="Distance Issues"
                        value={localJob?.penalty?.distance}
                        isPenalty
                      />
                      <div className="border-t border-orange-200 dark:border-orange-500/20 pt-3 mt-3 flex justify-between items-center">
                        <span className="font-bold text-foreground uppercase text-xs">
                          Total Poin Penalti
                        </span>
                        <span className="text-2xl font-black text-orange-600 dark:text-orange-400">
                          +{localJob?.penalty?.total || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="glass-panel p-6 rounded-2xl border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/5 flex justify-center items-center gap-3">
                    <CheckCircle className="text-emerald-500 w-6 h-6" />
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      Pekerjaan bersih, tidak menghasilkan poin penalti.
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="glass-panel p-8 rounded-[2.5rem] border-slate-200 dark:border-white/5 bg-card">
              <h3 className="text-xl font-bold text-foreground mb-8 flex items-center gap-3">
                <AlertCircle className="text-red-500 dark:text-red-400 w-5 h-5" />{" "}
                Catatan Insiden
              </h3>
              <IncidentLogs events={events} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-panel p-8 rounded-[2.5rem] border-slate-200 dark:border-white/5 bg-card">
              <h3 className="text-lg font-bold text-foreground mb-6">
                Waktu Pengiriman
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4 py-2 border-b border-slate-200 dark:border-white/5">
                  <Calendar className="text-slate-400 w-4 h-4" />
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">
                      Mulai
                    </p>
                    <p className="text-xs font-bold text-foreground">
                      {formatWIB(localJob?.startedAt || details?.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 py-2">
                  <Calendar className="text-slate-400 w-4 h-4" />
                  <div className="flex-1">
                    <p className="text-[10px] text-foreground/50 font-bold uppercase">
                      Selesai
                    </p>
                    <p className="text-xs font-bold text-foreground">
                      {formatWIB(localJob?.completedAt || details?.updated_at)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel p-8 rounded-[2.5rem] border-slate-200 dark:border-white/5 bg-card">
              <h3 className="text-lg font-bold text-foreground mb-6">Mode</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-white/5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">
                    Special Contract
                  </span>
                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded ${localJob?.isSpecialContract ? "bg-primary/20 text-primary" : "bg-slate-100 dark:bg-white/5 text-slate-500"}`}
                  >
                    {localJob?.isSpecialContract ? "YES" : "NO"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">
                    Hardcore Mode
                  </span>
                  {localJob?.isHardcore ? (
                    <HardcoreStars rating={localJob.hardcoreRating || 0} />
                  ) : (
                    <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500">
                      NO
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="glass-panel p-8 rounded-[2.5rem] border-slate-200 dark:border-white/5 bg-card">
              <h3 className="text-lg font-bold text-foreground mb-6">
                {isCoach ? "Detail Armada Bus" : "Detail Kendaraan"}
              </h3>
              <div className="space-y-4">
                {internalFleet ? (
                  <div className="flex flex-col mb-4">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">
                      Kendaraan
                    </span>
                    <Link
                      href={`/fleet/${internalFleet.id}`}
                      className="text-primary hover:underline font-medium text-sm flex items-center gap-1 w-fit"
                    >
                      {internalFleet.brandInfo?.name || "-"}{" "}
                      {internalFleet.modelInfo?.name || ""}{" "}
                      <span className="text-xs font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded ml-1">
                        {internalFleet.fleet_number}
                      </span>
                    </Link>
                  </div>
                ) : (
                  <DetailItem
                    label="Kendaraan"
                    value={`${details?.vehicle_brand_name || localJob?.vehicle?.brand || "-"} ${details?.vehicle_model_name || localJob?.vehicle?.model || ""}`}
                  />
                )}
                <DetailItem
                  label="Odometer Kendaraan"
                  value={
                    internalFleet
                      ? `${Math.round(internalFleet.odometer || 0).toLocaleString()} km`
                      : `${(details?.vehicle_odometer_end || 0).toLocaleString()} km`
                  }
                />
                <div className="flex flex-col mb-4">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">
                    {isCoach ? "Layanan & Tarif Penumpang" : "Kargo"}
                  </span>
                  {isCoach ? (
                    <Link
                      href="/coach-terminal"
                      className="text-sky-400 hover:underline font-bold text-sm w-fit flex items-center gap-1.5"
                    >
                      <Bus className="w-4 h-4" />
                      {localJob?.marketType ||
                        (details?.market === "bus_tourist_job"
                          ? "Bus Tourist Job"
                          : "Bus Company Job")}{" "}
                      {localJob?.lockedCargoPrice && (
                        <span className="text-muted-foreground font-medium">
                          ({localJob.lockedCargoPrice} NC/km)
                        </span>
                      )}
                    </Link>
                  ) : details?.game_id && details?.cargo_id ? (
                    <Link
                      href={`/cargo-market/${details.game_id}/${details.cargo_id}`}
                      className="text-primary hover:underline font-medium text-sm w-fit flex items-center gap-1"
                    >
                      {details.cargo_name || "Tidak diketahui"}{" "}
                      {localJob?.lockedCargoPrice && (
                        <span className="text-muted-foreground">
                          ({localJob.lockedCargoPrice} NC/km)
                        </span>
                      )}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-slate-800 dark:text-white flex items-center gap-1">
                      {details?.cargo_name ||
                        localJob?.cargoName ||
                        "Tidak diketahui"}{" "}
                      {localJob?.lockedCargoPrice && (
                        <span className="text-muted-foreground">
                          ({localJob.lockedCargoPrice} NC/km)
                        </span>
                      )}
                    </span>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-slate-200 dark:border-white/5 space-y-3">
                  <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">
                    Rincian Damage
                  </h4>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 dark:text-gray-400 font-medium">
                      {isCoach ? "Bus Utama" : "Truk Utama"}
                    </span>
                    <span
                      className={`${vDamage > 0 ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"} font-bold`}
                    >
                      {vDamage}%
                    </span>
                  </div>
                  {(!isCoach || tDamage > 0) && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 dark:text-gray-400 font-medium">
                        Trailer
                      </span>
                      <span
                        className={`${tDamage > 0 ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"} font-bold`}
                      >
                        {tDamage}%
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 dark:text-gray-400 font-medium">
                      {isCoach ? "Penumpang (Comfort)" : "Muatan (Cargo)"}
                    </span>
                    <span
                      className={`${cDamage > 0 ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"} font-bold`}
                    >
                      {cDamage}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatBox({
  icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-panel p-5 rounded-3xl border-slate-200 dark:border-white/5 bg-card">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5">
          {icon}
        </div>
        <p className="text-[9px] text-slate-500 dark:text-gray-400 font-bold uppercase tracking-widest truncate">
          {label}
        </p>
      </div>
      <p className="text-xl font-black text-foreground truncate">{value}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 dark:border-white/5 pb-2">
      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  color = "text-foreground",
  isPenalty = false,
}: {
  label: React.ReactNode;
  value: number;
  color?: string;
  isPenalty?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-white/5 pb-2">
      <span className="text-slate-600 dark:text-gray-400">{label}</span>
      <span
        className={`font-bold ${isPenalty ? "text-red-600 dark:text-red-400" : color}`}
      >
        {isPenalty ? "-" : "+"}
        {value}{" "}
      </span>
    </div>
  );
}
