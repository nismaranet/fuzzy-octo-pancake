import React from "react";
import clientPromise from "@/lib/mongodb";
import { getCompanyMembersMap } from "@/lib/trucky";
import CargoMarketChart from "@/app/cargo-market/[game_id]/[in_game_id]/CargoMarketChart";
import UserBadges from "@/components/icons/UserBadges";
import DecoratedAvatar from "@/components/profile/DecoratedAvatar";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Bus,
  Users,
  MapPin,
  Clock,
  Radio,
  CheckCircle2,
  Coins,
  TrendingUp,
  TrendingDown,
  Navigation,
  Compass,
  Route,
  PackageOpen,
  User as UserIcon,
  ArrowRight,
  Ticket,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Coach Terminal & Papan Keberangkatan Bus",
  description:
    "Pantau tarif penumpang Euro Truck Simulator 2 DLC Coaches (Intercity Transit & Tourist Charter), jadwal keberangkatan bus aktif, dan riwayat perjalanan penumpang di Nismara Transport.",
  openGraph: {
    title: "Coach Terminal & Papan Keberangkatan Bus",
    description:
      "Pantau tarif penumpang Euro Truck Simulator 2 DLC Coaches (Intercity Transit & Tourist Charter), jadwal keberangkatan bus aktif, dan riwayat perjalanan penumpang di Nismara Transport.",
    url: "https://transport.nismara.web.id/coach-terminal",
    siteName: "Nismara Transport",
    locale: "id_ID",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

function formatWIB(dateInput: string | Date | undefined) {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CoachTerminalPage() {
  const client = await clientPromise;
  const db = client.db();

  const coachJobFilter = {
    $or: [
      { jobCategory: "coach" },
      {
        cargoId: { $in: ["Passengers", "bus_company_job", "bus_tourist_job"] },
      },
      { marketType: { $regex: /^bus/i } },
      { statsType: { $regex: /^coaches/i } },
    ],
  };

  // 1. Fetch Coach Fare records (bus_company_job & bus_tourist_job) + Ongoing & Completed Coach Jobs in parallel
  const [coachCargos, ongoingCoachJobs, completedCoachJobs] = await Promise.all(
    [
      db
        .collection("cargos")
        .find({
          in_game_id: { $in: ["bus_company_job", "bus_tourist_job"] },
        })
        .toArray(),
      db
        .collection("jobhistories")
        .find({
          ...coachJobFilter,
          jobStatus: { $ne: "CANCELED" },
          completedAt: { $exists: false },
        })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray(),
      db
        .collection("jobhistories")
        .find({
          ...coachJobFilter,
          jobStatus: { $ne: "CANCELED" },
          completedAt: { $exists: true },
        })
        .sort({ completedAt: -1, createdAt: -1 })
        .limit(20)
        .toArray(),
    ],
  );

  const companyFare: any = coachCargos.find(
    (c) => c.in_game_id === "bus_company_job",
  ) || {
    _id: null,
    name: "Bus Company Job (Intercity Transit)",
    in_game_id: "bus_company_job",
    price_per_km: 2.0,
    market_demand: 0,
    price_per_km_with_market_change: 2.0,
  };

  const touristFare: any = coachCargos.find(
    (c) => c.in_game_id === "bus_tourist_job",
  ) || {
    _id: null,
    name: "Bus Tourist Job (Tourist Charter)",
    in_game_id: "bus_tourist_job",
    price_per_km: 2.0,
    market_demand: 0,
    price_per_km_with_market_change: 2.0,
  };

  // 2. Fetch Market History for both Coach Fares
  const fareIds = coachCargos.map((c) => c._id).filter(Boolean);
  const rawHistory =
    fareIds.length > 0
      ? await db
          .collection("cargomarkethistories")
          .find({ cargo_id: { $in: fareIds } })
          .sort({ createdAt: 1 })
          .limit(200)
          .toArray()
      : [];

  const companyHistory = rawHistory
    .filter(
      (h) =>
        h.in_game_id === "bus_company_job" ||
        (companyFare._id &&
          h.cargo_id?.toString() === companyFare._id.toString()),
    )
    .map((r) => ({
      _id: r._id.toString(),
      new_market_demand: r.new_market_demand || 0,
      new_price: r.new_price || 0,
      createdAt: r.createdAt
        ? new Date(r.createdAt).toISOString()
        : new Date().toISOString(),
    }));

  const touristHistory = rawHistory
    .filter(
      (h) =>
        h.in_game_id === "bus_tourist_job" ||
        (touristFare._id &&
          h.cargo_id?.toString() === touristFare._id.toString()),
    )
    .map((r) => ({
      _id: r._id.toString(),
      new_market_demand: r.new_market_demand || 0,
      new_price: r.new_price || 0,
      createdAt: r.createdAt
        ? new Date(r.createdAt).toISOString()
        : new Date().toISOString(),
    }));

  // 3. Resolve Driver Profiles for ongoing & completed jobs
  const allJobs = [...ongoingCoachJobs, ...completedCoachJobs];
  const discordIds = [
    ...new Set(
      allJobs
        .map((j) => j.driverId)
        .filter(Boolean)
        .map(String),
    ),
  ];
  const truckyIds = [
    ...new Set(
      allJobs.map((j) => Number(j.truckyId)).filter((n) => !isNaN(n) && n > 0),
    ),
  ];

  const userFilters: any[] = [];
  if (discordIds.length > 0)
    userFilters.push({ discordId: { $in: discordIds } });
  if (truckyIds.length > 0) {
    userFilters.push({ truckyId: { $in: truckyIds } });
    userFilters.push({ truckyId: { $in: truckyIds.map(String) } });
  }

  const [dbUsers, membersMap] = await Promise.all([
    userFilters.length > 0
      ? db.collection("users").find({ $or: userFilters }).toArray()
      : Promise.resolve([]),
    getCompanyMembersMap(35643).catch(() => ({}) as Record<number, any>),
  ]);

  const userByDiscordId = new Map<string, any>();
  const userByTruckyId = new Map<number, any>();
  for (const u of dbUsers) {
    if (u.discordId) userByDiscordId.set(String(u.discordId), u);
    if (u.truckyId) userByTruckyId.set(Number(u.truckyId), u);
  }

  const resolveDriver = (job: any) => {
    const tId = Number(job.truckyId);
    const dId = job.driverId ? String(job.driverId) : "";
    const member = !isNaN(tId) ? membersMap[tId] : null;
    const dbUser =
      (dId ? userByDiscordId.get(dId) : null) ||
      (!isNaN(tId) ? userByTruckyId.get(tId) : null);

    return {
      name:
        dbUser?.name ||
        member?.name ||
        member?.username ||
        (!isNaN(tId) && tId > 0 ? `Driver #${tId}` : "Driver"),
      avatar: dbUser?.image || dbUser?.avatarUrl || member?.avatar_url || null,
      dbUser,
    };
  };

  const getServiceBadge = (job: any) => {
    const isTourist =
      job.cargoId === "bus_tourist_job" ||
      String(job.marketType || "")
        .toLowerCase()
        .includes("tourist");
    if (isTourist) {
      return {
        label: "Tourist Charter",
        color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        icon: <Compass size={12} />,
      };
    }
    return {
      label: "Intercity Transit",
      color: "bg-sky-500/15 text-sky-400 border-sky-500/30",
      icon: <Bus size={12} />,
    };
  };

  return (
    <div className="min-h-screen bg-background">
      {/* HEADER TERMINAL */}
      <div className="w-full bg-card border-b border-border/50 py-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 via-emerald-500/5 to-transparent z-0" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-background/80 backdrop-blur-md rounded-2xl border border-sky-500/30 flex items-center justify-center shadow-xl">
                <Bus size={32} className="text-sky-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-sky-500/20 text-sky-400 border border-sky-500/30">
                    ETS2 DLC Coaches
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Radio size={10} className="animate-pulse" /> Update Tarif
                    Tiap 2 Jam
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase drop-shadow-lg">
                  Coach Terminal
                </h1>
                <p className="text-muted-foreground font-bold uppercase tracking-widest mt-1.5 text-xs">
                  Papan Tarif Penumpang, Keberangkatan Aktif & Kedatangan Bus
                  Nismara
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/jobs?category=coach"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 text-white hover:bg-sky-500/90 text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-sky-500/20"
              >
                <Ticket size={16} /> Logbook Bus
              </Link>
              <Link
                href="/cargo-market"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border hover:bg-muted text-xs font-bold uppercase tracking-wider transition-all"
              >
                <PackageOpen size={16} /> Pasar Kargo Truk
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        {/* 1. PAPAN TARIF PENUMPANG (COACH FARE INDEX) */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-foreground flex items-center gap-2.5">
                <Coins className="text-sky-400" size={24} /> Indeks Tarif Tiket
                & Layanan Bus
              </h2>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                Tarif dasar penumpang sebesar 2,00 NC/km dengan fluktuasi
                permintaan pasar otomatis setiap 2 jam.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* CARD 1: BUS COMPANY JOB (INTERCITY TRANSIT) */}
            <div className="glass-panel rounded-3xl border border-sky-500/30 bg-sky-500/5 p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                      <Bus size={24} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">
                        Reguler Antar-Kota • Halte ke Halte
                      </span>
                      <h3 className="text-xl font-black uppercase tracking-tight text-foreground">
                        Bus Company Job
                      </h3>
                    </div>
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 ${
                      (companyFare.market_demand || 0) < 0
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    {(companyFare.market_demand || 0) < 0 ? (
                      <TrendingDown size={14} />
                    ) : (
                      <TrendingUp size={14} />
                    )}
                    {(companyFare.market_demand || 0) > 0
                      ? `+${Number(companyFare.market_demand || 0).toFixed(1)}%`
                      : `${Number(companyFare.market_demand || 0).toFixed(1)}%`}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-card/80 border border-border/50 mb-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                      Tarif Dasar (Base)
                    </p>
                    <p className="text-lg font-black text-foreground">
                      {Number(companyFare.price_per_km || 2).toLocaleString(
                        "id-ID",
                        {
                          minimumFractionDigits: 2,
                        },
                      )}{" "}
                      <span className="text-xs text-muted-foreground">
                        NC / km
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                      Tarif Berlaku Saat Ini
                    </p>
                    <p className="text-2xl font-black text-sky-400 flex items-center justify-end gap-1.5">
                      <Coins size={20} />
                      {Number(
                        companyFare.price_per_km_with_market_change ||
                          companyFare.price_per_km ||
                          2,
                      ).toLocaleString("id-ID", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      <span className="text-xs uppercase">NC/km</span>
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  Grafik Fluktuasi Permintaan (Intercity Transit)
                </p>
                <CargoMarketChart
                  historyData={companyHistory}
                  themeColor="blue"
                />
              </div>
            </div>

            {/* CARD 2: BUS TOURIST JOB (TOURIST CHARTER) */}
            <div className="glass-panel rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Compass size={24} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                        Pariwisata & Viewpoints • Pulang-Pergi
                      </span>
                      <h3 className="text-xl font-black uppercase tracking-tight text-foreground">
                        Bus Tourist Job
                      </h3>
                    </div>
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 ${
                      (touristFare.market_demand || 0) < 0
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    {(touristFare.market_demand || 0) < 0 ? (
                      <TrendingDown size={14} />
                    ) : (
                      <TrendingUp size={14} />
                    )}
                    {(touristFare.market_demand || 0) > 0
                      ? `+${Number(touristFare.market_demand || 0).toFixed(1)}%`
                      : `${Number(touristFare.market_demand || 0).toFixed(1)}%`}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-card/80 border border-border/50 mb-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                      Tarif Dasar (Base)
                    </p>
                    <p className="text-lg font-black text-foreground">
                      {Number(touristFare.price_per_km || 2).toLocaleString(
                        "id-ID",
                        {
                          minimumFractionDigits: 2,
                        },
                      )}{" "}
                      <span className="text-xs text-muted-foreground">
                        NC / km
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                      Tarif Berlaku Saat Ini
                    </p>
                    <p className="text-2xl font-black text-amber-400 flex items-center justify-end gap-1.5">
                      <Coins size={20} />
                      {Number(
                        touristFare.price_per_km_with_market_change ||
                          touristFare.price_per_km ||
                          2,
                      ).toLocaleString("id-ID", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      <span className="text-xs uppercase">NC/km</span>
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  Grafik Fluktuasi Permintaan (Tourist Charter)
                </p>
                <CargoMarketChart
                  historyData={touristHistory}
                  themeColor="red"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 2. PAPAN KEBERANGKATAN AKTIF (LIVE DEPARTURES BOARD) */}
        <section className="glass-panel rounded-3xl border border-sky-500/30 bg-card p-6 md:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-wide text-foreground">
                  Papan Keberangkatan Terminal (Sedang Berjalan)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Pengemudi bus Nismara yang saat ini sedang mengantar penumpang
                  di jalan raya
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-sky-500/15 text-sky-400 border border-sky-500/30 w-fit">
              {ongoingCoachJobs.length} Bus Beroperasi
            </span>
          </div>

          {ongoingCoachJobs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ongoingCoachJobs.map((job) => {
                const driver = resolveDriver(job);
                const service = getServiceBadge(job);
                return (
                  <Link
                    key={job._id.toString()}
                    href={`/jobs/${job.jobId || job._id}`}
                    className="p-5 rounded-2xl border border-border/60 bg-background/60 hover:border-sky-500/50 hover:bg-sky-500/5 transition-all group flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <DecoratedAvatar
                          src={driver.avatar}
                          alt={driver.name}
                          fallbackText={driver.name.charAt(0)}
                          decorationId={driver.dbUser?.avatarDecoration || null}
                          isNismaraPlus={driver.dbUser?.nismaraplus?.status === true}
                          userRole={driver.dbUser?.discordRole || driver.dbUser?.role}
                          topManager={driver.dbUser?.topManager}
                          sizeClass="w-10 h-10"
                          frameClass="border border-sky-500/30"
                          fallbackBg="bg-sky-500/15 text-sky-400"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-foreground truncate group-hover:text-sky-400 transition-colors">
                            {driver.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {job.vehicle?.brand || "Coach"}{" "}
                            {job.vehicle?.model || ""}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 ${service.color}`}
                      >
                        {service.icon} {service.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border/40">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">
                          Keberangkatan
                        </p>
                        <p className="text-sm font-black text-foreground truncate">
                          {job.sourceCity || "-"}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-sky-400 shrink-0" />
                      <div className="min-w-0 text-right">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">
                          Tujuan Akhir
                        </p>
                        <p className="text-sm font-black text-foreground truncate">
                          {job.destinationCity || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Route size={13} className="text-sky-400" />
                        {job.plannedDistanceKm || job.distanceKm || 0} km
                      </span>
                      <span className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Clock size={12} /> Berangkat{" "}
                        {formatWIB(job.startedAt || job.createdAt)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center border border-dashed border-border/60 rounded-2xl bg-background/30">
              <Bus className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-bold uppercase tracking-widest text-foreground">
                Belum Ada Bus yang Sedang Berjalan Saat Ini
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Jadilah pengemudi bus pertama yang berangkat dari terminal hari
                ini!
              </p>
            </div>
          )}
        </section>

        {/* 3. PAPAN KEDATANGAN / RIWAYAT PERJALANAN BUS SELESAI */}
        <section className="glass-panel rounded-3xl border border-border/50 bg-card p-6 md:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-wide text-foreground">
                  Papan Kedatangan Terminal (Perjalanan Selesai)
                </h2>
                <p className="text-xs text-muted-foreground">
                  20 perjalanan bus terakhir yang telah tiba di terminal tujuan
                  dengan selamat
                </p>
              </div>
            </div>
            <Link
              href="/jobs?category=coach"
              className="text-xs font-black uppercase tracking-widest text-sky-400 hover:underline flex items-center gap-1"
            >
              Lihat Semua di Logbook →
            </Link>
          </div>

          {completedCoachJobs.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-border/50">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/50 border-b border-border/50">
                  <tr>
                    <th className="px-5 py-4">Pengemudi Bus</th>
                    <th className="px-5 py-4">Layanan</th>
                    <th className="px-5 py-4">Rute Perjalanan</th>
                    <th className="px-5 py-4">Halte & Penumpang</th>
                    <th className="px-5 py-4">Jarak</th>
                    <th className="px-5 py-4">Waktu Tiba</th>
                    <th className="px-5 py-4 text-right">Pendapatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {completedCoachJobs.map((job) => {
                    const driver = resolveDriver(job);
                    const service = getServiceBadge(job);
                    const stopsCount = Array.isArray(job.stops)
                      ? job.stops.length
                      : 0;
                    const totalPax =
                      job.totalPassengers ||
                      (Array.isArray(job.stops)
                        ? job.stops.reduce(
                            (acc: number, s: any) =>
                              acc + (Number(s.passengersIn) || 0),
                            0,
                          )
                        : 0);
                    const netRevenue =
                      typeof job.revenue === "number"
                        ? job.revenue
                        : (job.nc?.total || 0) - (job.ncCost?.total || 0);

                    return (
                      <tr
                        key={job._id.toString()}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/jobs/${job.jobId || job._id}`}
                            className="flex items-center gap-3 group"
                          >
                            <DecoratedAvatar
                              src={driver.avatar}
                              alt={driver.name}
                              fallbackText={driver.name.charAt(0)}
                              decorationId={driver.dbUser?.avatarDecoration || null}
                              isNismaraPlus={driver.dbUser?.nismaraplus?.status === true}
                              userRole={driver.dbUser?.discordRole || driver.dbUser?.role}
                              topManager={driver.dbUser?.topManager}
                              sizeClass="w-9 h-9"
                              frameClass="border border-border/50"
                              fallbackBg="bg-muted text-muted-foreground"
                            />
                            <div>
                              <div className="font-bold text-foreground group-hover:text-sky-400 transition-colors flex items-center gap-1">
                                {driver.name}
                                {driver.dbUser && (
                                  <UserBadges
                                    role={driver.dbUser?.discordRole}
                                    isBooster={driver.dbUser?.isBooster}
                                    isNismaraPlus={
                                      driver.dbUser?.nismaraplus?.status
                                    }
                                    nismaraPlusStartedAt={
                                      driver.dbUser?.nismaraplus?.startedAt
                                    }
                                    truckyRank={driver.dbUser?.truckyRank}
                                    topManager={driver.dbUser?.topManager}
                                    className="w-3.5 h-3.5"
                                  />
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {job.vehicle?.brand || "Bus"}{" "}
                                {job.vehicle?.model || ""}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${service.color}`}
                          >
                            {service.icon} {service.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            href={`/jobs/${job.jobId || job._id}`}
                            className="font-bold text-foreground hover:text-sky-400 transition-colors flex items-center gap-1.5"
                          >
                            <span>{job.sourceCity || "-"}</span>
                            <ArrowRight
                              size={13}
                              className="text-muted-foreground"
                            />
                            <span>{job.destinationCity || "-"}</span>
                          </Link>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3 text-xs">
                            <span className="inline-flex items-center gap-1 font-bold text-sky-400">
                              <MapPin size={13} /> {stopsCount} Halte
                            </span>
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                              <Users size={13} /> {totalPax} Pax
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-bold text-muted-foreground">
                          {(
                            job.distanceKm ||
                            job.plannedDistanceKm ||
                            0
                          ).toLocaleString("id-ID")}{" "}
                          km
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground font-mono">
                          {formatWIB(job.completedAt || job.updatedAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            href={`/jobs/${job.jobId || job._id}`}
                            className={`font-black text-sm ${
                              netRevenue < 0
                                ? "text-red-400"
                                : "text-emerald-400"
                            }`}
                          >
                            {netRevenue > 0 ? "+" : ""}
                            {netRevenue.toLocaleString("id-ID")} NC
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Bus className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-bold uppercase tracking-widest text-foreground">
                Belum Ada Riwayat Perjalanan Bus
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
