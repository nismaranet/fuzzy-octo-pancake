"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  BarChart3,
  Truck,
  Bus,
  Route,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Coins,
  Fuel,
  Gift,
  FileSignature,
  Ticket,
  Sparkles,
  Image as ImageIcon,
  Gamepad2,
  Code2,
  ShieldCheck,
  Award,
  ArrowUpRight,
  Info,
  Flame,
  Gauge,
} from "lucide-react";
import type {
  PublicStatisticsPayload,
  PeriodStats,
  MetricDelta,
} from "@/lib/publicStatistics";

type CompareMode = "mom" | "qoq" | "yoy";
type DivisionFilter = "all" | "logistics" | "coaches";

function formatInt(n: number): string {
  return Math.round(n || 0).toLocaleString("id-ID");
}

function formatKm(n: number): string {
  return (n || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function formatNC(n: number): string {
  return (
    (n || 0).toLocaleString("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " NC"
  );
}

function formatCompactNC(n: number): string {
  const v = n || 0;
  if (Math.abs(v) >= 1_000_000) {
    return `${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} Jt NC`;
  }
  if (Math.abs(v) >= 1_000) {
    return `${(v / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} Rb NC`;
  }
  return formatNC(v);
}

function formatFuel(n: number): string {
  return `${Math.floor(n || 0).toLocaleString("id-ID")} L`;
}

function calcDelta(a: number, b: number): MetricDelta {
  const va = Math.round((a || 0) * 100) / 100;
  const vb = Math.round((b || 0) * 100) / 100;
  const delta = Math.round((vb - va) * 100) / 100;
  const pctChange =
    va === 0 ? (vb === 0 ? 0 : null) : Math.round(((vb - va) / Math.abs(va)) * 10000) / 100;
  return { periodA: va, periodB: vb, delta, pctChange };
}

function DeltaBadge({ delta }: { delta: MetricDelta }) {
  if (delta.pctChange === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
        <Sparkles className="w-3 h-3" /> Baru
      </span>
    );
  }
  if (delta.delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
        <TrendingUp className="w-3 h-3" /> +{delta.pctChange.toLocaleString("id-ID")}%
      </span>
    );
  }
  if (delta.delta < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[11px] font-bold text-rose-400">
        <TrendingDown className="w-3 h-3" /> {delta.pctChange.toLocaleString("id-ID")}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
      <Minus className="w-3 h-3" /> 0%
    </span>
  );
}

function CompareCard({
  title,
  subtitle,
  icon,
  accentClass,
  delta,
  formatter,
  labelA,
  labelB,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  accentClass: string;
  delta: MetricDelta;
  formatter: (n: number) => string;
  labelA: string;
  labelB: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-5 flex flex-col justify-between gap-4 hover:border-primary/40 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center border ${accentClass}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
          </div>
        </div>
        <DeltaBadge delta={delta} />
      </div>

      <div>
        <p className="text-2xl font-black tracking-tight text-foreground">
          {formatter(delta.periodB)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {labelB} <span className="mx-1 text-border">•</span> vs{" "}
          <span className="font-semibold text-foreground/80">{formatter(delta.periodA)}</span>{" "}
          ({labelA})
        </p>
      </div>
    </div>
  );
}

export default function StatisticsClient({
  data,
}: {
  data: PublicStatisticsPayload;
}) {
  const [mode, setMode] = useState<CompareMode>("mom");
  const [division, setDivision] = useState<DivisionFilter>("all");

  const activeSeries: PeriodStats[] = useMemo(() => {
    if (mode === "mom") return data.monthly;
    if (mode === "qoq") return data.quarterly;
    return data.yearly;
  }, [data, mode]);

  const defaultIdxB = Math.max(0, activeSeries.length - 1);
  const defaultIdxA = Math.max(0, activeSeries.length - 2);

  const [selectedA, setSelectedA] = useState<string>(
    data.monthly[Math.max(0, data.monthly.length - 2)]?.key || ""
  );
  const [selectedB, setSelectedB] = useState<string>(
    data.monthly[Math.max(0, data.monthly.length - 1)]?.key || ""
  );

  const handleModeChange = (nextMode: CompareMode) => {
    setMode(nextMode);
    const nextSeries =
      nextMode === "mom"
        ? data.monthly
        : nextMode === "qoq"
          ? data.quarterly
          : data.yearly;
    const idxB = Math.max(0, nextSeries.length - 1);
    const idxA = Math.max(0, nextSeries.length - 2);
    setSelectedA(nextSeries[idxA]?.key || "");
    setSelectedB(nextSeries[idxB]?.key || "");
  };

  const periodA =
    activeSeries.find((p) => p.key === selectedA) || activeSeries[defaultIdxA] || activeSeries[0];
  const periodB =
    activeSeries.find((p) => p.key === selectedB) || activeSeries[defaultIdxB] || activeSeries[0];

  const chartData = useMemo(() => {
    return activeSeries.map((p) => {
      const hcJobs =
        division === "logistics"
          ? p.logistics.hardcoreJobs
          : division === "coaches"
            ? p.coaches.hardcoreJobs
            : p.logistics.hardcoreJobs + p.coaches.hardcoreJobs;
      const normJobs =
        division === "logistics"
          ? p.logistics.normalJobs
          : division === "coaches"
            ? p.coaches.normalJobs
            : p.logistics.normalJobs + p.coaches.normalJobs;
      const realJobs =
        division === "logistics"
          ? p.logistics.realMilesJobs
          : division === "coaches"
            ? p.coaches.realMilesJobs
            : p.logistics.realMilesJobs + p.coaches.realMilesJobs;
      const raceJobs =
        division === "logistics"
          ? p.logistics.raceMilesJobs
          : division === "coaches"
            ? p.coaches.raceMilesJobs
            : p.logistics.raceMilesJobs + p.coaches.raceMilesJobs;
      const realKm =
        division === "logistics"
          ? p.logistics.realMilesKm
          : division === "coaches"
            ? p.coaches.realMilesKm
            : p.logistics.realMilesKm + p.coaches.realMilesKm;
      const raceKm =
        division === "logistics"
          ? p.logistics.raceMilesKm
          : division === "coaches"
            ? p.coaches.raceMilesKm
            : p.logistics.raceMilesKm + p.coaches.raceMilesKm;

      return {
        name: p.shortLabel,
        fullLabel: p.label,
        truckJobs: p.logistics.completedJobs,
        coachTrips: p.coaches.completedJobs,
        truckKm: Math.round(p.logistics.totalDistanceKm),
        coachKm: Math.round(p.coaches.totalDistanceKm),
        coachPax: p.coaches.totalPassengers,
        ets2Jobs: p.logistics.ets2Jobs,
        atsJobs: p.logistics.atsJobs,
        spJobs: p.logistics.spJobs,
        tmpJobs: p.logistics.tmpJobs,
        hardcoreJobs: hcJobs,
        normalJobs: normJobs,
        realMilesJobs: realJobs,
        raceMilesJobs: raceJobs,
        realMilesKm: Math.round(realKm),
        raceMilesKm: Math.round(raceKm),
        ncSpent: Math.round(p.economyAndGames.ncSpentTotal),
        fuelLiters: p.economyAndGames.fuelTotalLiters,
        minigameTickets:
          p.economyAndGames.lottoTicketsCount +
          p.economyAndGames.scratchTicketsCount +
          p.economyAndGames.racingTicketsCount,
      };
    });
  }, [activeSeries, division]);

  const modeTitle =
    mode === "mom"
      ? "Month-over-Month (MoM)"
      : mode === "qoq"
        ? "Quarter-over-Quarter (QoQ)"
        : "Year-over-Year (YoY)";

  return (
    <main className="min-h-screen w-full pb-24">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-primary/10 via-background to-background pt-12 pb-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-4 max-w-3xl">
              <div className="inline-flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-xs font-bold text-primary">
                  <BarChart3 className="w-3.5 h-3.5" /> Public Analytics & Transparency
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" /> Update: {data.generatedAtWIB}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
                Statistik & Performa{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-sky-400">
                  Nismara Transport
                </span>
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Laporan operasional real-time dan historis komunitas VTC Nismara Transport (ETS2 &amp; ATS).
                Mencakup perbandingan <strong>MoM, QoQ, dan YoY</strong> dengan pemisahan ketat antara{" "}
                <strong>Divisi Logistik (Truck)</strong> dan <strong>Divisi Coaches (Bus DLC)</strong>,
                aktivitas event komunitas, pasar BBM, hingga permainan hiburan berbasis Nismara Coin (NC).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/api/public/statistics"
                target="_blank"
                className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 hover:bg-card px-4 py-2.5 text-xs font-bold text-foreground transition-all"
              >
                <Code2 className="w-4 h-4 text-sky-400" />
                Public JSON API (AI-Ready)
                <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
              </Link>
              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 px-4 py-2.5 text-xs font-bold transition-all"
              >
                <Award className="w-4 h-4" />
                Lihat Leaderboard
              </Link>
            </div>
          </div>

          {/* ALL-TIME SNAPSHOT STRIP */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-10">
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-sky-400" /> Logistik Sukses
              </p>
              <p className="text-xl sm:text-2xl font-black text-foreground mt-1.5">
                {formatInt(data.overview.totalLogisticsJobs)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {formatKm(data.overview.totalLogisticsDistanceKm)} km
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Bus className="w-3.5 h-3.5 text-emerald-400" /> Coaches Trip
              </p>
              <p className="text-xl sm:text-2xl font-black text-foreground mt-1.5">
                {formatInt(data.overview.totalCoachesTrips)}
              </p>
              <p className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                {formatInt(data.overview.totalCoachesPassengers)} penumpang
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5 text-primary" /> Total Jarak
              </p>
              <p className="text-xl sm:text-2xl font-black text-foreground mt-1.5">
                {(data.overview.totalCombinedDistanceKm / 1_000_000).toLocaleString("id-ID", {
                  maximumFractionDigits: 2,
                })}{" "}
                Jt km
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Truck + Bus gabungan
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" /> Driver &amp; Tim
              </p>
              <p className="text-xl sm:text-2xl font-black text-foreground mt-1.5">
                {formatInt(data.overview.totalRegisteredDrivers)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {formatInt(data.overview.activeTeamsCount)} tim aktif
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-amber-400" /> Event Komunitas
              </p>
              <p className="text-xl sm:text-2xl font-black text-foreground mt-1.5">
                {formatInt(
                  data.overview.totalConvoys +
                    data.overview.totalSpecialContracts +
                    data.overview.totalGiveaways
                )}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {data.overview.totalConvoys} convoy • {data.overview.totalGiveaways} giveaway
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Fuel className="w-3.5 h-3.5 text-yellow-400" /> Pasar BBM
              </p>
              <p className="text-xl sm:text-2xl font-black text-foreground mt-1.5">
                {formatFuel(data.overview.totalFuelLitersTraded)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {formatInt(data.overview.totalGalleryPosts)} foto galeri
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 space-y-12">
        {/* INTERACTIVE COMPARISON STUDIO (MoM / QoQ / YoY) */}
        <section className="space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Perbandingan Performa — {modeTitle}
              </h2>
              <p className="text-xs text-muted-foreground">
                Pilih mode perbandingan dan rentang periode untuk melihat pertumbuhan operasional &amp; komunitas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Mode Switcher */}
              <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border/60">
                {(
                  [
                    { id: "mom", label: "MoM (Bulan)" },
                    { id: "qoq", label: "QoQ (Kuartal)" },
                    { id: "yoy", label: "YoY (Tahun)" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleModeChange(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      mode === item.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Period A & B Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="period-a-select">
                  Periode Pembanding A
                </label>
                <select
                  id="period-a-select"
                  value={periodA?.key || ""}
                  onChange={(e) => setSelectedA(e.target.value)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {activeSeries.map((p) => (
                    <option key={p.key} value={p.key}>
                      A: {p.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-black text-muted-foreground">vs</span>
                <label className="sr-only" htmlFor="period-b-select">
                  Periode Target B
                </label>
                <select
                  id="period-b-select"
                  value={periodB?.key || ""}
                  onChange={(e) => setSelectedB(e.target.value)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {activeSeries.map((p) => (
                    <option key={p.key} value={p.key}>
                      B: {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Division Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: "all", label: "Semua Divisi (Terpisah)" },
                { id: "logistics", label: "Divisi Logistik (Truck / Kargo)" },
                { id: "coaches", label: "Divisi Coaches (Bus / Penumpang)" },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDivision(d.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                  division === d.id
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-card/40 border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {periodA && periodB && (
            <div className="space-y-8">
              {/* 1. LOGISTICS DIVISION (TRUCK) */}
              {(division === "all" || division === "logistics") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-wider text-sky-400 flex items-center gap-2">
                      <Truck className="w-4 h-4" /> Divisi Logistik — Truck &amp; Kargo
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      ETS2: {formatInt(periodB.logistics.ets2Jobs)} • ATS: {formatInt(periodB.logistics.atsJobs)} • Hardcore: {formatInt(periodB.logistics.hardcoreJobs)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <CompareCard
                      title="Pengiriman Sukses"
                      subtitle={`Completion Rate ${periodB.logistics.completionRatePct}%`}
                      icon={<Truck className="w-4 h-4 text-sky-400" />}
                      accentClass="bg-sky-500/10 border-sky-500/25"
                      delta={calcDelta(periodA.logistics.completedJobs, periodB.logistics.completedJobs)}
                      formatter={(n) => `${formatInt(n)} jobs`}
                      labelA={periodA.shortLabel}
                      labelB={periodB.shortLabel}
                    />
                    <CompareCard
                      title="Jarak Tempuh Logistik"
                      subtitle={`Durasi ${formatKm(periodB.logistics.totalDurationHours)} jam`}
                      icon={<Route className="w-4 h-4 text-sky-400" />}
                      accentClass="bg-sky-500/10 border-sky-500/25"
                      delta={calcDelta(periodA.logistics.totalDistanceKm, periodB.logistics.totalDistanceKm)}
                      formatter={(n) => `${formatKm(n)} km`}
                      labelA={periodA.shortLabel}
                      labelB={periodB.shortLabel}
                    />
                    <CompareCard
                      title="Pendapatan Kotor (NC)"
                      subtitle="Virtual Nismara Coin"
                      icon={<Coins className="w-4 h-4 text-amber-400" />}
                      accentClass="bg-amber-500/10 border-amber-500/25"
                      delta={calcDelta(periodA.logistics.totalRevenueNC, periodB.logistics.totalRevenueNC)}
                      formatter={formatCompactNC}
                      labelA={periodA.shortLabel}
                      labelB={periodB.shortLabel}
                    />
                    <CompareCard
                      title="Driver Logistik Aktif"
                      subtitle={`Avg Damage Kendaraan ${periodB.logistics.avgDamageVehiclePct}%`}
                      icon={<Users className="w-4 h-4 text-indigo-400" />}
                      accentClass="bg-indigo-500/10 border-indigo-500/25"
                      delta={calcDelta(periodA.logistics.uniqueDrivers, periodB.logistics.uniqueDrivers)}
                      formatter={(n) => `${formatInt(n)} driver`}
                      labelA={periodA.shortLabel}
                      labelB={periodB.shortLabel}
                    />
                  </div>
                </div>
              )}

              {/* 2. COACHES DIVISION (BUS DLC) */}
              {(division === "all" || division === "coaches") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                      <Bus className="w-4 h-4" /> Divisi Coaches — Bus &amp; Penumpang (DLC Coaches)
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      Rilis DLC: 12 Nov 2026 • Rata-rata {periodB.coaches.avgPassengersPerTrip} pax/trip
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <CompareCard
                      title="Trip Bus Sukses"
                      subtitle={`Completion Rate ${periodB.coaches.completionRatePct}%`}
                      icon={<Bus className="w-4 h-4 text-emerald-400" />}
                      accentClass="bg-emerald-500/10 border-emerald-500/25"
                      delta={calcDelta(periodA.coaches.completedJobs, periodB.coaches.completedJobs)}
                      formatter={(n) => `${formatInt(n)} trip`}
                      labelA={periodA.shortLabel}
                      labelB={periodB.shortLabel}
                    />
                    <CompareCard
                      title="Penumpang Diangkut"
                      subtitle={`${formatInt(periodB.coaches.totalStops)} pemberhentian/halte`}
                      icon={<Users className="w-4 h-4 text-emerald-400" />}
                      accentClass="bg-emerald-500/10 border-emerald-500/25"
                      delta={calcDelta(periodA.coaches.totalPassengers, periodB.coaches.totalPassengers)}
                      formatter={(n) => `${formatInt(n)} pax`}
                      labelA={periodA.shortLabel}
                      labelB={periodB.shortLabel}
                    />
                    <CompareCard
                      title="Jarak Tempuh Bus"
                      subtitle={`Durasi ${formatKm(periodB.coaches.totalDurationHours)} jam`}
                      icon={<Route className="w-4 h-4 text-emerald-400" />}
                      accentClass="bg-emerald-500/10 border-emerald-500/25"
                      delta={calcDelta(periodA.coaches.totalDistanceKm, periodB.coaches.totalDistanceKm)}
                      formatter={(n) => `${formatKm(n)} km`}
                      labelA={periodA.shortLabel}
                      labelB={periodB.shortLabel}
                    />
                    <CompareCard
                      title="Pendapatan Coaches (NC)"
                      subtitle={`${formatInt(periodB.coaches.uniqueDrivers)} driver bus aktif`}
                      icon={<Coins className="w-4 h-4 text-emerald-400" />}
                      accentClass="bg-emerald-500/10 border-emerald-500/25"
                      delta={calcDelta(periodA.coaches.totalRevenueNC, periodB.coaches.totalRevenueNC)}
                      formatter={formatCompactNC}
                      labelA={periodA.shortLabel}
                      labelB={periodB.shortLabel}
                    />
                  </div>
                </div>
              )}

              {/* 2.5. MODE SIMULASI (HARDCORE vs BIASA) & KATEGORI MILES (REAL vs RACE) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-black uppercase tracking-wider text-rose-400 flex items-center gap-2">
                    <Flame className="w-4 h-4" /> Mode Simulasi (Hardcore vs Biasa) &amp; Real Miles vs Race Miles
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Filter aktif:{" "}
                    {division === "all"
                      ? "Logistik + Coaches"
                      : division === "logistics"
                        ? "Logistik (Truck)"
                        : "Coaches (Bus)"}
                  </span>
                </div>
                {(() => {
                  const pick = (p: PeriodStats) => {
                    if (division === "logistics") {
                      return {
                        hc: p.logistics.hardcoreJobs,
                        norm: p.logistics.normalJobs,
                        hcRating: p.logistics.avgHardcoreRating,
                        realJobs: p.logistics.realMilesJobs,
                        raceJobs: p.logistics.raceMilesJobs,
                        realKm: p.logistics.realMilesKm,
                        raceKm: p.logistics.raceMilesKm,
                      };
                    }
                    if (division === "coaches") {
                      return {
                        hc: p.coaches.hardcoreJobs,
                        norm: p.coaches.normalJobs,
                        hcRating: p.coaches.avgHardcoreRating,
                        realJobs: p.coaches.realMilesJobs,
                        raceJobs: p.coaches.raceMilesJobs,
                        realKm: p.coaches.realMilesKm,
                        raceKm: p.coaches.raceMilesKm,
                      };
                    }
                    const hcTotal = p.logistics.hardcoreJobs + p.coaches.hardcoreJobs;
                    const hcRating =
                      hcTotal > 0
                        ? Math.round(
                            ((p.logistics.avgHardcoreRating * p.logistics.hardcoreJobs +
                              p.coaches.avgHardcoreRating * p.coaches.hardcoreJobs) /
                              hcTotal) *
                              100
                          ) / 100
                        : 0;
                    return {
                      hc: hcTotal,
                      norm: p.logistics.normalJobs + p.coaches.normalJobs,
                      hcRating,
                      realJobs: p.logistics.realMilesJobs + p.coaches.realMilesJobs,
                      raceJobs: p.logistics.raceMilesJobs + p.coaches.raceMilesJobs,
                      realKm: p.logistics.realMilesKm + p.coaches.realMilesKm,
                      raceKm: p.logistics.raceMilesKm + p.coaches.raceMilesKm,
                    };
                  };
                  const aM = pick(periodA);
                  const bM = pick(periodB);
                  const totalJobsB = bM.hc + bM.norm;
                  const hcSharePct = totalJobsB > 0 ? Math.round((bM.hc / totalJobsB) * 1000) / 10 : 0;
                  const totalMilesJobsB = bM.realJobs + bM.raceJobs;
                  const realSharePct =
                    totalMilesJobsB > 0 ? Math.round((bM.realJobs / totalMilesJobsB) * 1000) / 10 : 0;

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <CompareCard
                        title="Hardcore Simulation"
                        subtitle={`${hcSharePct}% dari total • Avg Rating ${bM.hcRating}`}
                        icon={<Flame className="w-4 h-4 text-rose-400" />}
                        accentClass="bg-rose-500/10 border-rose-500/25"
                        delta={calcDelta(aM.hc, bM.hc)}
                        formatter={(n) => `${formatInt(n)} jobs`}
                        labelA={periodA.shortLabel}
                        labelB={periodB.shortLabel}
                      />
                      <CompareCard
                        title="Job Reguler (Biasa)"
                        subtitle={`${Math.max(0, Math.round((100 - hcSharePct) * 10) / 10)}% dari total job`}
                        icon={<Truck className="w-4 h-4 text-slate-300" />}
                        accentClass="bg-slate-500/10 border-slate-500/25"
                        delta={calcDelta(aM.norm, bM.norm)}
                        formatter={(n) => `${formatInt(n)} jobs`}
                        labelA={periodA.shortLabel}
                        labelB={periodB.shortLabel}
                      />
                      <CompareCard
                        title="Real Miles (Ranked)"
                        subtitle={`${realSharePct}% • ${formatKm(bM.realKm)} km`}
                        icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
                        accentClass="bg-emerald-500/10 border-emerald-500/25"
                        delta={calcDelta(aM.realJobs, bM.realJobs)}
                        formatter={(n) => `${formatInt(n)} jobs`}
                        labelA={periodA.shortLabel}
                        labelB={periodB.shortLabel}
                      />
                      <CompareCard
                        title="Race Miles (Unranked)"
                        subtitle={`${formatKm(bM.raceKm)} km (kecepatan tinggi)`}
                        icon={<Gauge className="w-4 h-4 text-orange-400" />}
                        accentClass="bg-orange-500/10 border-orange-500/25"
                        delta={calcDelta(aM.raceJobs, bM.raceJobs)}
                        formatter={(n) => `${formatInt(n)} jobs`}
                        labelA={periodA.shortLabel}
                        labelB={periodB.shortLabel}
                      />
                    </div>
                  );
                })()}
              </div>

              {/* 3. COMMUNITY EVENTS & VIRTUAL ECONOMY / MINIGAMES */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Community Events */}
                <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-wider text-violet-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Event Komunitas &amp; Aktivitas ({periodB.label})
                    </h3>
                    <span className="text-[11px] text-muted-foreground">vs {periodA.shortLabel}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-background/60 border border-border/50 p-3.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-sky-400" /> Convoy Komunitas
                      </p>
                      <p className="text-lg font-black text-foreground mt-1">
                        {formatInt(periodB.community.convoysCount)} event
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatInt(periodB.community.convoyParticipants)} partisipan (vs{" "}
                        {formatInt(periodA.community.convoyParticipants)})
                      </p>
                    </div>
                    <div className="rounded-xl bg-background/60 border border-border/50 p-3.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <FileSignature className="w-3.5 h-3.5 text-violet-400" /> Special Contracts
                      </p>
                      <p className="text-lg font-black text-foreground mt-1">
                        {formatInt(periodB.community.contractsCount)} kontrak
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatInt(periodB.community.specialContractJobs)} jobs (vs{" "}
                        {formatInt(periodA.community.specialContractJobs)})
                      </p>
                    </div>
                    <div className="rounded-xl bg-background/60 border border-border/50 p-3.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-amber-400" /> Giveaway Komunitas
                      </p>
                      <p className="text-lg font-black text-foreground mt-1">
                        {formatInt(periodB.community.giveawaysCount)} event
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatInt(periodB.community.giveawayTicketsCount)} tiket •{" "}
                        {formatInt(periodB.community.giveawayWinnersCount)} pemenang
                      </p>
                    </div>
                    <div className="rounded-xl bg-background/60 border border-border/50 p-3.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5 text-rose-400" /> Kupon &amp; Voucher
                      </p>
                      <p className="text-lg font-black text-foreground mt-1">
                        {formatInt(periodB.community.vouchersIssued)} voucher
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatInt(periodB.community.vouchersUsed)} dipakai •{" "}
                        {formatInt(periodB.community.couponClaimsCount)} klaim kupon
                      </p>
                    </div>
                    <div className="rounded-xl bg-background/60 border border-border/50 p-3.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> NC Boost Events
                      </p>
                      <p className="text-lg font-black text-foreground mt-1">
                        {formatInt(periodB.community.ncBoostEventsCount)} event
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatInt(periodB.community.ncBoostParticipants)} peserta aktif
                      </p>
                    </div>
                    <div className="rounded-xl bg-background/60 border border-border/50 p-3.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-pink-400" /> Galeri Sosial
                      </p>
                      <p className="text-lg font-black text-foreground mt-1">
                        {formatInt(periodB.community.galleryPostsCount)} post
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatInt(periodB.community.galleryTotalLikes)} likes (vs{" "}
                        {formatInt(periodA.community.galleryPostsCount)} post)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Virtual Economy & NC Minigames */}
                <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                      <Gamepad2 className="w-4 h-4" /> Ekonomi Virtual NC &amp; Hiburan ({periodB.label})
                    </h3>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                      Virtual NC Only
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-background/60 border border-border/50 p-3.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-amber-400" /> Belanja Fleet &amp; Market
                      </p>
                      <p className="text-lg font-black text-foreground mt-1">
                        {formatCompactNC(periodB.economyAndGames.ncSpentTotal)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatInt(periodB.economyAndGames.ncTransactionsCount)} transaksi NC
                      </p>
                    </div>
                    <div className="rounded-xl bg-background/60 border border-border/50 p-3.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Fuel className="w-3.5 h-3.5 text-yellow-400" /> Pasar BBM (Solar)
                      </p>
                      <p className="text-lg font-black text-foreground mt-1">
                        {formatFuel(periodB.economyAndGames.fuelTotalLiters)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        P2P: {formatFuel(periodB.economyAndGames.fuelP2pLiters)} •{" "}
                        {formatCompactNC(periodB.economyAndGames.fuelTotalVolumeNC)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-background/60 border border-border/50 p-3.5">
                      <p className="text-[11px] text-muted-foreground">Nismara Lotto (NC)</p>
                      <p className="text-lg font-black text-foreground mt-1">
                        {formatInt(periodB.economyAndGames.lottoTicketsCount)} tiket
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {periodB.economyAndGames.lottoPeriodsCount} periode • Hadiah{" "}
                        {formatCompactNC(periodB.economyAndGames.lottoPrizeWonNC)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-background/60 border border-border/50 p-3.5">
                      <p className="text-[11px] text-muted-foreground">Nismara Scratchers (NC)</p>
                      <p className="text-lg font-black text-foreground mt-1">
                        {formatInt(periodB.economyAndGames.scratchTicketsCount)} tiket
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Hadiah: {formatCompactNC(periodB.economyAndGames.scratchPrizeWonNC)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-background/60 border border-border/50 p-3.5">
                      <p className="text-[11px] text-muted-foreground">Truck Racing (NC)</p>
                      <p className="text-lg font-black text-foreground mt-1">
                        {formatInt(periodB.economyAndGames.racingTicketsCount)} ronde
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Volume: {formatCompactNC(periodB.economyAndGames.racingBetNC)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-background/60 border border-border/50 p-3.5">
                      <p className="text-[11px] text-muted-foreground">Kuis Driver</p>
                      <p className="text-lg font-black text-foreground mt-1">
                        {formatInt(periodB.economyAndGames.quizAttemptsCount)} sesi
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatInt(periodB.economyAndGames.quizPassedCount)} lulus ujian
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 pt-1">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                    <span>{data.currencyDisclaimer}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* INTERACTIVE CHARTS */}
        <section className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Logistics vs Coaches Trips */}
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-6">
              <div className="mb-4">
                <h3 className="text-base font-black text-foreground">
                  Tren Pengiriman — Logistik (Truck) vs Coaches (Bus)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Jumlah pengiriman sukses per periode ({modeTitle})
                </p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradTruck" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradCoach" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Area
                      type="monotone"
                      dataKey="truckJobs"
                      name="Logistik (Truck)"
                      stroke="#38bdf8"
                      strokeWidth={2.5}
                      fill="url(#gradTruck)"
                    />
                    <Area
                      type="monotone"
                      dataKey="coachTrips"
                      name="Coaches (Bus)"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#gradCoach)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: ETS2 vs ATS Breakdown */}
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-6">
              <div className="mb-4">
                <h3 className="text-base font-black text-foreground">
                  Distribusi Simulator (ETS2 vs ATS)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Volume pekerjaan logistik sukses berdasarkan game ({modeTitle})
                </p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="ets2Jobs" name="ETS2" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="atsJobs" name="ATS" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Jarak Tempuh KM */}
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-6">
              <div className="mb-4">
                <h3 className="text-base font-black text-foreground">
                  Total Jarak Tempuh (KM) — Truck vs Bus
                </h3>
                <p className="text-xs text-muted-foreground">
                  Akumulasi kilometer operasional yang diselesaikan driver ({modeTitle})
                </p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                      formatter={(val: any) => [`${formatInt(Number(val))} km`, ""]}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="truckKm" name="Jarak Truck (km)" stackId="km" fill="#0ea5e9" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="coachKm" name="Jarak Bus (km)" stackId="km" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Pasar BBM & Aktivitas Minigame NC */}
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-6">
              <div className="mb-4">
                <h3 className="text-base font-black text-foreground">
                  Volume Pasar BBM (Liter) &amp; Permainan NC
                </h3>
                <p className="text-xs text-muted-foreground">
                  Perdagangan solar (Sistem + P2P) dan total tiket minigames ({modeTitle})
                </p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k L` : `${v} L`)}
                    />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar yAxisId="left" dataKey="fuelLiters" name="BBM (Liter)" fill="#eab308" radius={[6, 6, 0, 0]} />
                    <Bar
                      yAxisId="right"
                      dataKey="minigameTickets"
                      name="Tiket Lotto/Scratch/Racing"
                      fill="#ec4899"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 5: Hardcore Simulation vs Job Biasa */}
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-6">
              <div className="mb-4">
                <h3 className="text-base font-black text-foreground">
                  Hardcore Simulation vs Job Biasa
                </h3>
                <p className="text-xs text-muted-foreground">
                  Perbandingan jumlah pengiriman mode Hardcore dan reguler ({modeTitle})
                </p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="normalJobs" name="Job Biasa" stackId="mode" fill="#64748b" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="hardcoreJobs" name="Hardcore Simulation" stackId="mode" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 6: Real Miles vs Race Miles */}
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-6">
              <div className="mb-4">
                <h3 className="text-base font-black text-foreground">
                  Real Miles vs Race Miles
                </h3>
                <p className="text-xs text-muted-foreground">
                  Perbandingan pengiriman Real Miles (Ranked) vs Race Miles ({modeTitle})
                </p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="realMilesJobs" name="Real Miles (Jobs)" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="raceMilesJobs" name="Race Miles (Jobs)" fill="#f97316" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* TOP HIGHLIGHTS: KARGO, BUS & RUTE */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-sky-400 flex items-center gap-2">
              <Truck className="w-4 h-4" /> Top 5 Kargo Logistik (by NC)
            </h3>
            <ul className="space-y-2.5">
              {data.topHighlights.topTruckCargosByNC.map((c, idx) => (
                <li
                  key={c.cargoName}
                  className="flex items-center justify-between gap-2 text-xs py-2 border-b border-border/40 last:border-0"
                >
                  <span className="font-bold text-foreground truncate">
                    #{idx + 1} {c.cargoName}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="font-bold text-sky-400 block">{formatCompactNC(c.revenueNC)}</span>
                    <span className="text-[11px] text-muted-foreground">{formatInt(c.jobs)} jobs</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Bus className="w-4 h-4" /> Top 5 Armada Bus (Coaches)
            </h3>
            {data.topHighlights.topCoachModels.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada data armada bus.</p>
            ) : (
              <ul className="space-y-2.5">
                {data.topHighlights.topCoachModels.map((b, idx) => (
                  <li
                    key={b.model}
                    className="flex items-center justify-between gap-2 text-xs py-2 border-b border-border/40 last:border-0"
                  >
                    <span className="font-bold text-foreground truncate">
                      #{idx + 1} {b.model}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="font-bold text-emerald-400 block">{formatInt(b.trips)} trip</span>
                      <span className="text-[11px] text-muted-foreground">{formatInt(b.passengers)} pax</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Route className="w-4 h-4" /> Top 5 Rute Bus Favorit
            </h3>
            {data.topHighlights.topCoachRoutes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada data rute bus.</p>
            ) : (
              <ul className="space-y-2.5">
                {data.topHighlights.topCoachRoutes.map((r, idx) => (
                  <li
                    key={r.route}
                    className="flex items-center justify-between gap-2 text-xs py-2 border-b border-border/40 last:border-0"
                  >
                    <span className="font-bold text-foreground truncate">
                      #{idx + 1} {r.route}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="font-bold text-emerald-400 block">{formatInt(r.trips)} trip</span>
                      <span className="text-[11px] text-muted-foreground">{formatInt(r.passengers)} pax</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* FULL HISTORICAL SEMANTIC TABLE (SSR & AI-CRAWLER FRIENDLY) */}
        <section className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md overflow-hidden">
          <div className="p-6 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-foreground">
                Tabel Data Historis Lengkap ({modeTitle})
              </h2>
              <p className="text-xs text-muted-foreground">
                Data agregat resmi Nismara Transport zona waktu WIB (Asia/Jakarta), terpisah antara Logistik &amp; Coaches.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
              <ShieldCheck className="w-4 h-4" /> Data Publik Terverifikasi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 font-black">Periode</th>
                  <th className="py-3.5 px-4 font-black text-right">Truck Jobs</th>
                  <th className="py-3.5 px-4 font-black text-right">Truck KM</th>
                  <th className="py-3.5 px-4 font-black text-right">Bus Trips</th>
                  <th className="py-3.5 px-4 font-black text-right">Penumpang Bus</th>
                  <th className="py-3.5 px-4 font-black text-right">Hardcore / Biasa</th>
                  <th className="py-3.5 px-4 font-black text-right">Real / Race Miles</th>
                  <th className="py-3.5 px-4 font-black text-right">Convoy</th>
                  <th className="py-3.5 px-4 font-black text-right">Contracts</th>
                  <th className="py-3.5 px-4 font-black text-right">Giveaway</th>
                  <th className="py-3.5 px-4 font-black text-right">BBM (L)</th>
                  <th className="py-3.5 px-4 font-black text-right">Belanja NC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {[...activeSeries].reverse().map((row) => (
                  <tr key={row.key} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-foreground whitespace-nowrap">
                      {row.label}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-sky-400 whitespace-nowrap">
                      {formatInt(row.logistics.completedJobs)}
                    </td>
                    <td className="py-3 px-4 text-right text-foreground/90 whitespace-nowrap">
                      {formatKm(row.logistics.totalDistanceKm)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-400 whitespace-nowrap">
                      {formatInt(row.coaches.completedJobs)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-300 whitespace-nowrap">
                      {formatInt(row.coaches.totalPassengers)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="text-rose-400 font-semibold">
                        {formatInt(row.logistics.hardcoreJobs + row.coaches.hardcoreJobs)}
                      </span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="text-foreground/80">
                        {formatInt(row.logistics.normalJobs + row.coaches.normalJobs)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="text-emerald-400 font-semibold">
                        {formatInt(row.logistics.realMilesJobs + row.coaches.realMilesJobs)}
                      </span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="text-orange-400 font-semibold">
                        {formatInt(row.logistics.raceMilesJobs + row.coaches.raceMilesJobs)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-foreground/90 whitespace-nowrap">
                      {formatInt(row.community.convoysCount)}
                    </td>
                    <td className="py-3 px-4 text-right text-foreground/90 whitespace-nowrap">
                      {formatInt(row.community.contractsCount)} ({formatInt(row.community.specialContractJobs)} jobs)
                    </td>
                    <td className="py-3 px-4 text-right text-foreground/90 whitespace-nowrap">
                      {formatInt(row.community.giveawaysCount)}
                    </td>
                    <td className="py-3 px-4 text-right text-yellow-400 whitespace-nowrap">
                      {formatFuel(row.economyAndGames.fuelTotalLiters)}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-400 whitespace-nowrap">
                      {formatCompactNC(row.economyAndGames.ncSpentTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
