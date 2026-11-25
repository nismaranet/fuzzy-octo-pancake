"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Volume2,
  VolumeX,
  Pause,
  Play,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  Check,
  RotateCcw,
  Flame,
  Trophy,
  Truck,
  Bus,
  Camera,
  Heart,
  Sparkles,
  Clock,
  Star,
  Award,
  LogIn,
  Music,
  ArrowRight,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import type {
  CollectiveRewind2026,
  PersonalRewind2026,
  RewindGalleryPhoto,
} from "@/lib/rewind2026";
import { RewindAudioPlayer } from "@/lib/rewindAudio";
import {
  downloadRewindPosterPng,
  type RewindPosterFormat,
} from "@/lib/rewindCardExport";
import {
  runRewindSlideChoreography,
  runSplashChoreography,
  type ChoreographyHandle,
} from "./rewindChoreography";
import RewindLivingBackdrop, {
  type RewindBackdropMotif,
} from "./RewindLivingBackdrop";

interface Props {
  collective: CollectiveRewind2026;
  personal: PersonalRewind2026 | null;
  musicUrl?: string;
  isOwnerPreview?: boolean;
  releaseAtIso?: string;
  isSharedView?: boolean;
  isLoggedIn?: boolean;
}

const DEFAULT_SLIDE_MS = 9000;

function formatNum(n: number): string {
  return Math.round(n || 0).toLocaleString("id-ID");
}

function formatDrivingDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds || 0));
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (hours <= 0) return `${Math.max(1, mins)} menit`;
  if (mins === 0) return `${hours.toLocaleString("id-ID")} jam`;
  return `${hours.toLocaleString("id-ID")} jam ${mins} mnt`;
}

function formatWibDate(iso?: string): string {
  if (!iso) return "28 Desember 2026, 00:00 WIB";
  return (
    new Date(iso).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}

interface SlideDef {
  id: string;
  chapter: "Kolektif 2026" | "Perjalananmu" | "Bagikan";
  /** "light" untuk slide Swiss editorial terang (kontras drastis ala Wrapped!) */
  chromeMode: "dark" | "light";
  motif: RewindBackdropMotif;
  bgClass: string;
  orbA?: string;
  orbB?: string;
  durationMs?: number;
  creditPhoto?: RewindGalleryPhoto | null;
  render: () => React.ReactNode;
}

export default function RewindStoryExperience({
  collective,
  personal,
  musicUrl = "",
  isOwnerPreview = false,
  releaseAtIso,
  isSharedView = false,
  isLoggedIn = false,
}: Props) {
  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [audioMode, setAudioMode] = useState<"custom" | "synth">("synth");
  const [progress, setProgress] = useState(0);
  const [exportingFormat, setExportingFormat] = useState<RewindPosterFormat | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const playerRef = useRef<RewindAudioPlayer | null>(null);
  const splashRootRef = useRef<HTMLDivElement | null>(null);
  const stageRootRef = useRef<HTMLDivElement | null>(null);
  const choreoRef = useRef<ChoreographyHandle | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  // Ref-based timer (anti double-skip React 19 StrictMode!)
  const elapsedMsRef = useRef(0);
  const hasAdvancedRef = useRef(false);

  const handleDownload = useCallback(
    async (format: RewindPosterFormat) => {
      setExportingFormat(format);
      setPaused(true);
      try {
        await downloadRewindPosterPng({ format, collective, personal });
      } finally {
        setExportingFormat(null);
      }
    },
    [collective, personal]
  );

  const handleCopyShareLink = useCallback(async () => {
    setPaused(true);
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://transport.nismara.web.id";
    const shareUrl = personal?.driver.truckyId
      ? `${base}/rewind/2026/${personal.driver.truckyId}`
      : `${base}/rewind/2026`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // ignore
    }
  }, [personal]);

  const slides: SlideDef[] = useMemo(() => {
    const list: SlideDef[] = [];

    // =========================================================================
    // SCENE 1: SWISS EDITORIAL MAGAZINE COVER (BRIGHT WARM CREAM & INK!)
    // =========================================================================
    list.push({
      id: "collective-opening",
      chapter: "Kolektif 2026",
      chromeMode: "light",
      motif: "topography",
      bgClass: "bg-[#F4EDE0] text-[#111111]",
      orbA: "bg-amber-400/35",
      orbB: "bg-orange-400/20",
      durationMs: 8500,
      render: () => (
        <div className="relative w-full max-w-4xl mx-auto">
          {/* Oversized Editorial Watermark */}
          <div
            data-anim="watermark"
            aria-hidden="true"
            className="pointer-events-none select-none absolute -top-16 -right-6 sm:-right-12 text-[11rem] sm:text-[17rem] font-black leading-none tracking-tighter text-[#111111]/[0.05]"
          >
            26
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-7 space-y-5 text-left">
              <div
                data-anim="pill"
                className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#111111] text-[#F4EDE0] text-[11px] font-bold uppercase tracking-[0.2em]"
              >
                Edisi Tahun Pertama
              </div>

              <h1
                data-anim="headline-chars"
                className="text-5xl sm:text-7xl font-black tracking-tight text-[#111111] leading-[0.98]"
              >
                Miles of Memories
              </h1>

              <p
                data-anim="subcopy"
                className="text-base sm:text-lg text-[#3D3830] leading-relaxed font-medium max-w-md"
              >
                2026 bukan sekadar angka di kalender. Ini adalah tahun pertama website Nismara Transport menjadi rumah bagi ribuan rute, tawa di radio konvoi, dan cerita dari balik kemudi.
              </p>
            </div>

            {/* Right Asymmetric Editorial Ledger */}
            <div className="md:col-span-5 border-t-2 md:border-t-0 md:border-l-2 border-[#111111]/15 pt-5 md:pt-0 md:pl-8 space-y-5 text-left">
              <div data-anim="card" className="space-y-0.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A6F5D]">
                  Keluarga Besar
                </p>
                <p className="text-4xl sm:text-5xl font-black text-[#111111] tabular-nums">
                  <span data-counter={collective.totalDrivers}>
                    {formatNum(collective.totalDrivers)}
                  </span>{" "}
                  <span className="text-lg font-bold text-[#B45309]">Driver</span>
                </p>
              </div>
              <div className="h-px bg-[#111111]/12" />
              <div data-anim="card" className="space-y-0.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A6F5D]">
                  Pengiriman Tuntas
                </p>
                <p className="text-4xl sm:text-5xl font-black text-[#111111] tabular-nums">
                  <span data-counter={collective.totalJobs}>
                    {formatNum(collective.totalJobs)}
                  </span>{" "}
                  <span className="text-lg font-bold text-[#B45309]">Job</span>
                </p>
              </div>
              <div className="h-px bg-[#111111]/12" />
              <div data-anim="card" className="space-y-0.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A6F5D]">
                  Kenangan Terabadikan
                </p>
                <p className="text-3xl font-black text-[#111111] tabular-nums">
                  <span data-counter={collective.community.galleryCount}>
                    {formatNum(collective.community.galleryCount)}
                  </span>{" "}
                  <span className="text-base font-bold text-[#7A6F5D]">Foto Galeri</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    });

    // =========================================================================
    // SCENE 2: DEEP COBALT AUTOBAHN — ANIMATED HIGHWAY ROUTE + MOTION BEACON
    // =========================================================================
    list.push({
      id: "collective-distance",
      chapter: "Kolektif 2026",
      chromeMode: "dark",
      motif: "highway",
      bgClass: "bg-[#06132E] text-white",
      orbA: "bg-sky-400/30",
      orbB: "bg-amber-400/20",
      durationMs: 9000,
      render: () => (
        <div className="w-full max-w-4xl mx-auto space-y-6">
          <div className="space-y-2 text-left">
            <p
              data-anim="pill"
              className="text-xs font-black uppercase tracking-[0.26em] text-sky-300"
            >
              01 / Total Jarak Bersama
            </p>
            <h2
              data-anim="headline"
              className="text-2xl sm:text-3xl font-bold text-slate-200 max-w-xl"
            >
              Sepanjang 2026, roda armada kita tak pernah benar-benar berhenti berputar.
            </h2>
          </div>

          <div data-anim="hero-num" className="text-left">
            <div className="flex items-baseline flex-wrap gap-x-3">
              <span
                data-counter={collective.totalKm}
                className="text-6xl sm:text-8xl font-black tracking-tighter text-amber-300 tabular-nums leading-none"
              >
                {formatNum(collective.totalKm)}
              </span>
              <span className="text-2xl sm:text-4xl font-black text-white uppercase">
                km
              </span>
            </div>
            <p data-anim="subcopy" className="text-base sm:text-xl font-semibold text-sky-200 mt-2">
              Setara{" "}
              <strong
                data-counter={collective.earthLaps}
                data-decimals="1"
                className="text-white tabular-nums"
              >
                {collective.earthLaps.toLocaleString("id-ID")}
              </strong>{" "}
              kali memutari garis khatulistiwa Bumi.
            </p>
          </div>

          {/* Full-Bleed Animated SVG Highway with Travelling Motion Beacon */}
          <div className="relative py-2">
            <svg
              viewBox="0 0 800 96"
              className="w-full h-20 sm:h-24 overflow-visible"
              aria-hidden="true"
            >
              <path
                d="M 16 74 C 190 10, 340 88, 520 26 C 640 -8, 720 62, 784 36"
                fill="none"
                stroke="rgba(148,163,184,0.18)"
                strokeWidth="4"
                strokeDasharray="8 8"
              />
              <path
                data-anim="draw-path"
                data-anim-role="track"
                d="M 16 74 C 190 10, 340 88, 520 26 C 640 -8, 720 62, 784 36"
                fill="none"
                stroke="url(#autobahnGrad)"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
              <path
                data-anim="motion-track"
                d="M 16 74 C 190 10, 340 88, 520 26 C 640 -8, 720 62, 784 36"
                fill="none"
                stroke="transparent"
              />
              <circle cx="16" cy="74" r="6" fill="#38BDF8" />
              <circle cx="784" cy="36" r="7" fill="#FACC15" />
              <defs>
                <linearGradient id="autobahnGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="55%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#FACC15" />
                </linearGradient>
              </defs>
            </svg>
            <span
              data-anim="motion-beacon"
              className="absolute top-0 left-0 w-4 h-4 -ml-2 -mt-2 rounded-full bg-amber-300 shadow-[0_0_24px_6px_rgba(250,204,21,0.9)] opacity-0 pointer-events-none"
            />
          </div>

          {/* Crisp Bottom Telemetry Ticker Strip */}
          <div className="grid grid-cols-3 gap-4 border-t border-white/15 pt-5 text-left">
            <div data-anim="card">
              <p className="text-[11px] font-bold uppercase tracking-widest text-sky-300/80">
                Waktu di Jalan
              </p>
              <p className="text-2xl sm:text-3xl font-black text-white tabular-nums mt-0.5">
                <span data-counter={collective.totalHours}>
                  {formatNum(collective.totalHours)}
                </span>{" "}
                <span className="text-sm font-semibold text-slate-300">jam</span>
              </p>
            </div>
            <div data-anim="card">
              <p className="text-[11px] font-bold uppercase tracking-widest text-sky-300/80">
                Tonase Kargo
              </p>
              <p className="text-2xl sm:text-3xl font-black text-white tabular-nums mt-0.5">
                <span data-counter={collective.totalMassTons}>
                  {formatNum(collective.totalMassTons)}
                </span>{" "}
                <span className="text-sm font-semibold text-slate-300">ton</span>
              </p>
            </div>
            <div data-anim="card">
              <p className="text-[11px] font-bold uppercase tracking-widest text-teal-300">
                Debut Coaches
              </p>
              <p className="text-2xl sm:text-3xl font-black text-teal-200 tabular-nums mt-0.5">
                <span data-counter={collective.totalPassengers}>
                  {formatNum(collective.totalPassengers)}
                </span>{" "}
                <span className="text-sm font-semibold text-slate-300">penumpang</span>
              </p>
            </div>
          </div>
        </div>
      ),
    });

    // =========================================================================
    // SCENE 2.5: ETS2 VS ATS — DUEL DUA BENUA 2026
    // =========================================================================
    const ets2 = collective.gameBreakdown.ets2;
    const ats = collective.gameBreakdown.ats;
    const totalGameJobs = Math.max(1, ets2.totalJobs + ats.totalJobs);
    const ets2Pct = Math.round((ets2.totalJobs / totalGameJobs) * 100);
    const atsPct = Math.max(0, 100 - ets2Pct);

    list.push({
      id: "collective-games",
      chapter: "Kolektif 2026",
      chromeMode: "dark",
      motif: "constellation",
      bgClass: "bg-gradient-to-br from-[#081A3D] via-[#131426] to-[#320D11] text-white",
      orbA: "bg-sky-400/28",
      orbB: "bg-rose-500/28",
      durationMs: 9500,
      render: () => (
        <div className="w-full max-w-4xl mx-auto space-y-5">
          <div className="text-center space-y-1.5">
            <p
              data-anim="pill"
              className="text-xs font-black uppercase tracking-[0.26em] text-amber-300"
            >
              02 / Dua Benua Satu Tujuan
            </p>
            <h2
              data-anim="headline"
              className="text-3xl sm:text-5xl font-black text-white tracking-tight"
            >
              ETS2 vs ATS Sepanjang 2026
            </h2>
          </div>

          {/* Tug-of-War Ratio Bar */}
          <div className="space-y-1.5 max-w-2xl mx-auto">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider">
              <span className="text-sky-300">ETS2 · {ets2Pct}%</span>
              <span className="text-rose-300">{atsPct}% · ATS</span>
            </div>
            <div className="h-3 rounded-full bg-rose-500/75 overflow-hidden flex">
              <div
                data-anim="hbar"
                style={{ width: `${Math.max(4, ets2Pct)}%` }}
                className="h-full origin-left bg-gradient-to-r from-sky-400 to-blue-500"
              />
            </div>
          </div>

          {/* Side-by-Side Game Duel Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            {/* ETS2 Card */}
            <div
              data-anim="card"
              className="p-5 sm:p-6 rounded-3xl bg-[#0A1E44]/85 border border-sky-400/35 space-y-4 backdrop-blur-md"
            >
              <div className="flex items-center justify-between gap-2 border-b border-sky-300/20 pb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-300">
                    EROPA
                  </p>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    Euro Truck Simulator 2
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-sky-400/20 text-sky-200 font-black text-xs">
                  ETS2
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-sky-200/75 font-bold">
                    Total Pekerjaan
                  </p>
                  <p className="text-2xl font-black text-white tabular-nums">
                    <span data-counter={ets2.totalJobs}>{formatNum(ets2.totalJobs)}</span>{" "}
                    <span className="text-xs font-semibold text-sky-200">job</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-sky-200/75 font-bold">
                    Total Jarak
                  </p>
                  <p className="text-2xl font-black text-amber-300 tabular-nums">
                    <span data-counter={ets2.totalKm}>{formatNum(ets2.totalKm)}</span>{" "}
                    <span className="text-xs font-semibold text-white">km</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-sky-200/75 font-bold">
                    Pendapatan Net NC
                  </p>
                  <p className="text-lg font-black text-emerald-300 tabular-nums">
                    {formatNum(ets2.totalNetNc)} NC
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-sky-200/75 font-bold">
                    Kargo Terbanyak
                  </p>
                  <p className="text-sm font-black text-white truncate">
                    {ets2.topCargo?.name || "-"}
                  </p>
                  {ets2.topCargo && (
                    <p className="text-[10px] text-sky-200/80 tabular-nums">
                      {formatNum(ets2.topCargo.count)} pengiriman
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ATS Card */}
            <div
              data-anim="card"
              className="p-5 sm:p-6 rounded-3xl bg-[#381014]/85 border border-rose-400/35 space-y-4 backdrop-blur-md"
            >
              <div className="flex items-center justify-between gap-2 border-b border-rose-300/20 pb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-300">
                    AMERIKA
                  </p>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    American Truck Simulator
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-rose-400/20 text-rose-200 font-black text-xs">
                  ATS
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-rose-200/75 font-bold">
                    Total Pekerjaan
                  </p>
                  <p className="text-2xl font-black text-white tabular-nums">
                    <span data-counter={ats.totalJobs}>{formatNum(ats.totalJobs)}</span>{" "}
                    <span className="text-xs font-semibold text-rose-200">job</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-rose-200/75 font-bold">
                    Total Jarak
                  </p>
                  <p className="text-2xl font-black text-amber-300 tabular-nums">
                    <span data-counter={ats.totalKm}>{formatNum(ats.totalKm)}</span>{" "}
                    <span className="text-xs font-semibold text-white">km</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-rose-200/75 font-bold">
                    Pendapatan Net NC
                  </p>
                  <p className="text-lg font-black text-emerald-300 tabular-nums">
                    {formatNum(ats.totalNetNc)} NC
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-rose-200/75 font-bold">
                    Kargo Terbanyak
                  </p>
                  <p className="text-sm font-black text-white truncate">
                    {ats.topCargo?.name || "-"}
                  </p>
                  {ats.topCargo && (
                    <p className="text-[10px] text-rose-200/80 tabular-nums">
                      {formatNum(ats.topCargo.count)} pengiriman
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    });

    // =========================================================================
    // SCENE 3: BURNT VERMILION — SPLIT BRUTALIST HARDCORE + TELEMETRY BAR RACE
    // =========================================================================
    const topCityMax = Math.max(1, collective.topCities[0]?.count || 1);
    const topVehMax = Math.max(1, collective.topVehicles[0]?.count || 1);
    list.push({
      id: "collective-hardcore",
      chapter: "Kolektif 2026",
      chromeMode: "dark",
      motif: "embers",
      bgClass: "bg-[#1C0906] text-white",
      orbA: "bg-orange-500/35",
      orbB: "bg-red-500/20",
      durationMs: 9500,
      render: () => (
        <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left Story Statement */}
          <div className="md:col-span-6 space-y-4 text-left">
            <div
              data-anim="pill"
              className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-orange-500 text-[#1C0906] text-[11px] font-black uppercase tracking-widest"
            >
              <Flame className="w-3.5 h-3.5" /> Hardcore Simulation 2026
            </div>
            <h2
              data-anim="headline"
              className="text-3xl sm:text-5xl font-black leading-[1.04] tracking-tight text-white"
            >
              <span data-counter={collective.hardcore.totalJobs}>
                {formatNum(collective.hardcore.totalJobs)}
              </span>{" "}
              kali kita menolak jalan mudah.
            </h2>
            <p data-anim="subcopy" className="text-sm sm:text-base text-orange-100/80 leading-relaxed">
              Driver Nismara melahap{" "}
              <strong className="text-amber-300">
                {formatNum(collective.hardcore.totalKm)} km
              </strong>{" "}
              dalam mode Hardcore Simulation dengan rata-rata rating{" "}
              <strong className="text-white">
                {collective.hardcore.avgRating.toFixed(2)}★
              </strong>
              .
            </p>

            {collective.hardcore.topDriver && (
              <div
                data-anim="card"
                className="pt-3 border-t border-orange-300/20 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-orange-300">
                    Raja Rating Hardcore 2026
                  </p>
                  <p className="text-lg font-black text-white">
                    {collective.hardcore.topDriver.name}
                  </p>
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-orange-500/25 border border-orange-400/50 text-amber-200 font-black text-sm tabular-nums">
                  {collective.hardcore.topDriver.avgRating?.toFixed(2)}★
                </span>
              </div>
            )}
          </div>

          {/* Right Horizontal Telemetry Bar Race */}
          <div className="md:col-span-6 space-y-5 text-left">
            <div className="space-y-2.5">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-300">
                Kota Paling Sering Dituju
              </p>
              {collective.topCities.map((c, idx) => {
                const w = Math.max(24, Math.round((c.count / topCityMax) * 100));
                return (
                  <div key={c.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-white">
                        0{idx + 1} · {c.name}
                      </span>
                      <span className="text-orange-200 tabular-nums">{c.count} trip</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        data-anim="hbar"
                        style={{ width: `${w}%` }}
                        className="h-full origin-left rounded-full bg-gradient-to-r from-orange-500 to-amber-300"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2.5 pt-2">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-300">
                Armada Penguasa Aspal
              </p>
              {collective.topVehicles.map((v, idx) => {
                const w = Math.max(24, Math.round((v.count / topVehMax) * 100));
                return (
                  <div key={v.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-white truncate pr-2">
                        0{idx + 1} · {v.name}
                      </span>
                      <span className="text-amber-200 tabular-nums shrink-0">
                        {v.count}x
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        data-anim="hbar"
                        style={{ width: `${w}%` }}
                        className="h-full origin-left rounded-full bg-gradient-to-r from-amber-400 to-yellow-200"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ),
    });

    // =========================================================================
    // SCENE 4: EMERALD VAULT — KINETIC MARQUEE + PERFORATED 2026 YEAR RECEIPT
    // =========================================================================
    list.push({
      id: "collective-community",
      chapter: "Kolektif 2026",
      chromeMode: "dark",
      motif: "aurora",
      bgClass: "bg-[#041F1A] text-white",
      orbA: "bg-emerald-400/25",
      orbB: "bg-amber-400/20",
      durationMs: 9000,
      render: () => (
        <div className="relative w-full max-w-4xl mx-auto">
          {/* Background Kinetic Marquee Tape */}
          <div
            aria-hidden="true"
            className="pointer-events-none select-none absolute -inset-x-24 top-1/2 -translate-y-1/2 -rotate-6 opacity-[0.07] overflow-hidden whitespace-nowrap"
          >
            <div
              data-anim="marquee"
              className="inline-block text-7xl sm:text-8xl font-black uppercase tracking-tight text-emerald-200"
            >
              CONVOY · SPECIAL CONTRACT · NC BOOST · GIVEAWAY · MARKET · SCRATCHERS · LOTTO ·&nbsp;
              CONVOY · SPECIAL CONTRACT · NC BOOST · GIVEAWAY · MARKET · SCRATCHERS · LOTTO ·&nbsp;
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-7 items-center">
            <div className="md:col-span-5 space-y-3 text-left">
              <p
                data-anim="pill"
                className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300"
              >
                03 / Ekonomi &amp; Komunitas
              </p>
              <h2
                data-anim="headline"
                className="text-3xl sm:text-4xl font-black text-white leading-tight"
              >
                Struk Kenangan Nismara 2026
              </h2>
              <p data-anim="subcopy" className="text-sm text-emerald-100/80 leading-relaxed">
                Dari mabar konvoi sampai deg-degan menggosok kartu Scratchers, semua tercatat rapi sepanjang tahun.
              </p>
            </div>

            {/* Authentic Thermal / Manifest Receipt Paper */}
            <div
              data-anim="waybill"
              className="md:col-span-7 bg-[#FAF6EE] text-[#141715] rounded-2xl p-6 sm:p-7 shadow-2xl border-t-[6px] border-emerald-500 font-mono text-left space-y-3"
            >
              <div className="flex items-center justify-between border-b border-dashed border-black/25 pb-3">
                <span className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-emerald-700" /> NISMARA LEDGER 2026
                </span>
                <span className="text-[11px] font-bold text-black/60">FY-2026</span>
              </div>

              <div className="space-y-2 text-xs sm:text-sm">
                {[
                  ["KONVOI MABAR RESMI", `${formatNum(collective.community.totalConvoys)} EVENT`],
                  ["SPECIAL CONTRACT SELESAI", `${formatNum(collective.community.totalSpecialContracts)} JOB`],
                  ["CURRENCY BOOST EVENT", `${formatNum(collective.community.totalNcEvents)} PERIODE`],
                  ["UNDIAN GIVEAWAY", `${formatNum(collective.community.totalGiveaways)} ACARA`],
                  ["ARMADA DI GARASI", `${formatNum(collective.community.totalFleets)} UNIT`],
                  ["MOD MARKET TERJUAL", `${formatNum(collective.community.totalMarketPurchases)} ITEM`],
                  ["KARTU SCRATCHERS & LOTTO", `${formatNum(collective.community.totalScratchTickets + collective.community.totalLottoTickets)} TIKET`],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    data-anim="receipt-row"
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-black/70 font-semibold">{k}</span>
                    <span className="font-black text-[#141715] tabular-nums">{v}</span>
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-dashed border-black/30 pt-3 flex items-baseline justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                  TOTAL NET NC 2026
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[#064E3B] tabular-nums">
                  <span data-counter={collective.totalNetNc}>
                    {formatNum(collective.totalNetNc)}
                  </span>{" "}
                  NC
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
    });

    // =========================================================================
    // SCENE 5: PHOTOGRAPHY EXHIBITION — CRISP 35MM POLAROID GALLERY HEROES!
    // =========================================================================
    list.push({
      id: "collective-memories",
      chapter: "Kolektif 2026",
      chromeMode: "dark",
      motif: "bokeh",
      bgClass: "bg-[#110D13] text-white",
      orbA: "bg-rose-500/25",
      orbB: "bg-amber-400/20",
      durationMs: 9500,
      render: () => (
        <div className="w-full max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 text-left">
            <div>
              <p
                data-anim="pill"
                className="text-xs font-black uppercase tracking-[0.25em] text-rose-300 flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" /> 04 / Pameran Galeri 2026
              </p>
              <h2
                data-anim="headline"
                className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-1"
              >
                Momen Paling Dicintai
              </h2>
            </div>
            <p data-anim="subcopy" className="text-xs sm:text-sm text-slate-300 max-w-xs">
              Diabadikan langsung oleh lensa para driver di Social Gallery Nismara.
            </p>
          </div>

          {collective.topPhotos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 py-2">
              {collective.topPhotos.map((photo, idx) => (
                <div
                  key={photo.id}
                  data-anim="polaroid"
                  className="p-2.5 pb-4 rounded-xl bg-[#FAF7F0] text-[#171717] shadow-[0_25px_55px_rgba(0,0,0,0.65)]"
                >
                  <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.imageUrl}
                      alt={photo.caption || `Foto oleh ${photo.photographerName}`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-amber-300 font-mono text-[10px] font-bold">
                      #{idx + 1}
                    </span>
                  </div>
                  <div className="pt-3 px-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-black text-[#171717] truncate">
                      {photo.photographerName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-rose-600 font-black shrink-0 tabular-nums">
                      <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                      {photo.likesCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    });

    // =========================================================================
    // SCENE 5.5: DEDICATED COLLECTIVE LEADERBOARDS (JARAK · PENDAPATAN · PEKERJAAN)
    // =========================================================================
    list.push({
      id: "collective-leaderboards",
      chapter: "Kolektif 2026",
      chromeMode: "dark",
      motif: "constellation",
      bgClass: "bg-[#0B0E1A] text-white",
      orbA: "bg-amber-400/30",
      orbB: "bg-indigo-500/25",
      durationMs: 10000,
      render: () => {
        const boards = [
          {
            key: "km",
            title: "Jarak Terjauh",
            accentText: "text-amber-300",
            borderClass: "border-amber-400/30",
            entries: collective.topDriversByKm.map((d) => ({
              id: d.discordId,
              name: d.name,
              avatarUrl: d.avatarUrl,
              value: `${formatNum(d.totalKm)} km`,
            })),
            myRank: personal?.rankings.km.rank ?? null,
            myPct: personal?.rankings.km.percentileTop ?? null,
            myVal: personal ? `${formatNum(personal.totalKm)} km` : null,
          },
          {
            key: "nc",
            title: "Pendapatan Terbesar",
            accentText: "text-emerald-300",
            borderClass: "border-emerald-400/30",
            entries: collective.topDriversByNc.map((d) => ({
              id: d.discordId,
              name: d.name,
              avatarUrl: d.avatarUrl,
              value: `${formatNum(d.totalNetNc || 0)} NC`,
            })),
            myRank: personal?.rankings.nc.rank ?? null,
            myPct: personal?.rankings.nc.percentileTop ?? null,
            myVal: personal ? `${formatNum(personal.totalNetNc)} NC` : null,
          },
          {
            key: "jobs",
            title: "Pekerjaan Terbanyak",
            accentText: "text-sky-300",
            borderClass: "border-sky-400/30",
            entries: collective.topDriversByJobs.map((d) => ({
              id: d.discordId,
              name: d.name,
              avatarUrl: d.avatarUrl,
              value: `${formatNum(d.totalJobs)} job`,
            })),
            myRank: personal?.rankings.jobs.rank ?? null,
            myPct: personal?.rankings.jobs.percentileTop ?? null,
            myVal: personal ? `${formatNum(personal.totalJobs)} job` : null,
          },
        ];

        return (
          <div className="w-full max-w-4xl mx-auto space-y-5">
            <div className="text-center space-y-1.5">
              <div
                data-anim="pill"
                className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-400/15 border border-amber-300/35 text-amber-200 text-xs font-black uppercase tracking-[0.2em]"
              >
                <Trophy className="w-3.5 h-3.5" /> Papan Juara 2026
              </div>
              <h2
                data-anim="headline"
                className="text-3xl sm:text-5xl font-black text-white tracking-tight"
              >
                Para Penguasa Jalanan Nismara
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              {boards.map((board) => (
                <div
                  key={board.key}
                  data-anim="card"
                  className={`p-4 sm:p-5 rounded-3xl bg-slate-950/75 border ${board.borderClass} backdrop-blur-md flex flex-col justify-between gap-4`}
                >
                  <div className="space-y-3">
                    <p
                      className={`text-xs font-black uppercase tracking-[0.18em] ${board.accentText}`}
                    >
                      {board.title}
                    </p>

                    <div className="space-y-2">
                      {board.entries.map((entry, idx) => (
                        <div
                          key={entry.id}
                          className={`flex items-center gap-2.5 p-2 rounded-xl ${
                            idx === 0
                              ? "bg-white/10 border border-white/15"
                              : "bg-white/[0.04]"
                          }`}
                        >
                          <span
                            className={`w-6 text-center font-black text-sm shrink-0 ${
                              idx === 0
                                ? "text-amber-300"
                                : idx === 1
                                  ? "text-slate-200"
                                  : "text-orange-300"
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          {entry.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={entry.avatarUrl}
                              alt={entry.name}
                              className="w-7 h-7 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {entry.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate">
                              {entry.name}
                            </p>
                            <p className={`text-[11px] font-black tabular-nums ${board.accentText}`}>
                              {entry.value}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Personal Position Callout Directly Below Each Leaderboard */}
                  {personal && personal.hasActivity && board.myRank && board.myVal && (
                    <div className="pt-3 border-t border-white/12">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Posisi Kamu
                      </p>
                      <div className="flex items-baseline justify-between gap-2 mt-0.5">
                        <p className="text-xs font-black text-white tabular-nums">
                          #{board.myRank} · {board.myVal}
                        </p>
                        {board.myPct && (
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-black text-amber-200 shrink-0">
                            Top {board.myPct}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      },
    });

    // =========================================================================
    // SCENE 5.8: DEDICATED DRIVING SCORE LEADERBOARD (HALL OF SAFETY 2026)
    // =========================================================================
    const dsBoard = collective.drivingScoreLeaderboard;
    if (dsBoard && dsBoard.topDrivers.length > 0) {
      list.push({
        id: "collective-driving-score-leaderboard",
        chapter: "Kolektif 2026",
        chromeMode: "dark",
        motif: "topography",
        bgClass: "bg-[#051817] text-white",
        orbA: "bg-emerald-400/30",
        orbB: "bg-amber-400/20",
        durationMs: 9500,
        render: () => {
          // Olympic podium ordering on desktop: #2, #1 (center tall), #3
          const p1 = dsBoard.topDrivers[0] || null;
          const p2 = dsBoard.topDrivers[1] || null;
          const p3 = dsBoard.topDrivers[2] || null;
          const podiumOrder = [
            p2 ? { driver: p2, rank: 2, heightClass: "sm:pt-6", ring: "ring-slate-300", badge: "bg-slate-200 text-slate-900" } : null,
            p1 ? { driver: p1, rank: 1, heightClass: "sm:pt-0", ring: "ring-amber-300", badge: "bg-amber-400 text-slate-950" } : null,
            p3 ? { driver: p3, rank: 3, heightClass: "sm:pt-10", ring: "ring-orange-300", badge: "bg-orange-400 text-slate-950" } : null,
          ].filter(Boolean) as {
            driver: (typeof dsBoard.topDrivers)[number];
            rank: number;
            heightClass: string;
            ring: string;
            badge: string;
          }[];

          return (
            <div className="w-full max-w-4xl mx-auto space-y-6 text-center">
              <div className="space-y-1.5">
                <div
                  data-anim="pill"
                  className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-400/15 border border-emerald-300/40 text-emerald-200 text-xs font-black uppercase tracking-[0.2em]"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Hall of Safety · Driving Score 2026
                </div>
                <h2
                  data-anim="headline"
                  className="text-3xl sm:text-5xl font-black text-white tracking-tight"
                >
                  Pengemudi Paling Presisi &amp; Aman
                </h2>
                <p data-anim="subcopy" className="text-xs sm:text-sm text-emerald-100/80">
                  Dari <strong className="text-white">{dsBoard.totalActiveRanked}</strong> driver aktif berperingkat (rata-rata{" "}
                  <strong className="text-emerald-300">{dsBoard.avgScore.toFixed(1)}</strong> ·{" "}
                  <strong className="text-amber-300">{dsBoard.gradeSCount} Grade S</strong> &amp;{" "}
                  <strong className="text-sky-300">{dsBoard.gradeACount} Grade A</strong>)
                </p>
              </div>

              {/* Olympic Podium #2 — #1 — #3 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end max-w-3xl mx-auto">
                {podiumOrder.map((item) => (
                  <div
                    key={`${item.rank}-${item.driver.discordId}`}
                    data-anim="card"
                    className={`${item.heightClass}`}
                  >
                    <div
                      className={`p-5 rounded-3xl border backdrop-blur-md space-y-3 ${
                        item.rank === 1
                          ? "bg-emerald-950/80 border-amber-300/50 shadow-[0_0_45px_rgba(245,197,106,0.18)]"
                          : "bg-slate-950/75 border-white/12"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${item.badge}`}
                        >
                          #{item.rank}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-black">
                          Grade {item.driver.grade}
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-2 pt-1">
                        {item.driver.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.driver.avatarUrl}
                            alt={item.driver.name}
                            className={`w-16 h-16 rounded-full object-cover ring-2 ${item.ring}`}
                          />
                        ) : (
                          <div
                            className={`w-16 h-16 rounded-full bg-white/10 ring-2 ${item.ring} flex items-center justify-center text-xl font-black`}
                          >
                            {item.driver.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <p className="text-sm sm:text-base font-black text-white truncate max-w-full">
                          {item.driver.name}
                        </p>
                      </div>

                      <div className="pt-1 border-t border-white/10">
                        <p
                          data-counter={item.driver.score}
                          data-decimals="1"
                          className={`text-3xl font-black tabular-nums ${
                            item.rank === 1 ? "text-amber-300" : "text-emerald-300"
                          }`}
                        >
                          {item.driver.score.toFixed(1)}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                          Skor / 100
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Personal Driving Score Position Strip */}
              {personal && (
                <div
                  data-anim="card"
                  className="max-w-xl mx-auto p-4 rounded-2xl bg-slate-950/80 border border-emerald-400/35 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                      Posisi Driving Score Kamu
                    </p>
                    {personal.rankings.drivingScore.rank ? (
                      <p className="text-sm sm:text-base font-black text-white">
                        Peringkat #{personal.rankings.drivingScore.rank} dari{" "}
                        {personal.rankings.drivingScore.totalRanked} driver · Grade{" "}
                        {personal.safety.drivingGrade} (
                        {personal.safety.drivingScore?.toFixed(1)})
                      </p>
                    ) : (
                      <p className="text-xs sm:text-sm font-semibold text-slate-300">
                        Status Driving Score saat ini belum Aktif (butuh minimal 5 job dalam 30 hari terakhir).
                      </p>
                    )}
                  </div>
                  {personal.rankings.drivingScore.percentileTop && (
                    <span className="px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-200 text-xs font-black shrink-0 self-start sm:self-center">
                      Top {personal.rankings.drivingScore.percentileTop}% Driver
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        },
      });
    }

    // =========================================================================
    // CHAPTER 2: PERSONAL REWIND
    // =========================================================================
    if (personal) {
      // =======================================================================
      // SCENE 6: PERSONAL SPOTLIGHT — ORBITAL COMPASS RING + RUBBER STAMP SEAL
      // =======================================================================
      list.push({
        id: "personal-headline",
        chapter: "Perjalananmu",
        chromeMode: "dark",
        motif: "highway",
        bgClass: "bg-[#120728] text-white",
        orbA: "bg-fuchsia-500/30",
        orbB: "bg-amber-400/25",
        durationMs: 9000,
        render: () => (
          <div className="w-full max-w-3xl mx-auto text-center space-y-6">
            <p
              data-anim="pill"
              className="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300"
            >
              {isSharedView ? "Babak Personal" : "Sekarang, Tentang Kamu"}
            </p>

            {/* Orbital Ring Portrait */}
            <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
              <svg
                data-anim="orbit-spin"
                viewBox="0 0 140 140"
                className="absolute inset-0 w-full h-full"
                aria-hidden="true"
              >
                <circle
                  cx="70"
                  cy="70"
                  r="64"
                  fill="none"
                  stroke="rgba(250,204,21,0.45)"
                  strokeWidth="1.5"
                  strokeDasharray="6 8"
                />
                <circle cx="70" cy="6" r="4" fill="#FDE047" />
              </svg>
              {personal.driver.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  data-anim="avatar"
                  src={personal.driver.avatarUrl}
                  alt={personal.driver.name}
                  className="w-24 h-24 rounded-full object-cover ring-2 ring-amber-300 shadow-2xl"
                />
              ) : (
                <div
                  data-anim="avatar"
                  className="w-24 h-24 rounded-full bg-amber-400/20 border-2 border-amber-300 flex items-center justify-center text-3xl font-black text-amber-300"
                >
                  {personal.driver.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <h2
              data-anim="headline"
              className="text-3xl sm:text-5xl font-black text-white tracking-tight"
            >
              {personal.driver.name}
            </h2>

            {personal.hasActivity ? (
              <div className="space-y-5">
                <div className="relative inline-block">
                  <div data-anim="hero-num">
                    <p className="text-6xl sm:text-8xl font-black tracking-tighter text-amber-300 tabular-nums leading-none">
                      <span data-counter={personal.totalKm}>
                        {formatNum(personal.totalKm)}
                      </span>
                      <span className="text-2xl sm:text-3xl text-white ml-2">km</span>
                    </p>
                  </div>

                  {/* Rubber-Stamp Customs Seal */}
                  {personal.percentileTop && (
                    <div
                      data-anim="stamp"
                      className="mt-3 sm:mt-0 sm:absolute sm:-right-32 sm:-top-5 inline-flex items-center px-3.5 py-1.5 rounded-lg border-2 border-fuchsia-300 bg-fuchsia-500/20 text-fuchsia-100 font-black text-xs uppercase tracking-widest shadow-lg"
                    >
                      TOP {personal.percentileTop}% DRIVER
                    </div>
                  )}
                </div>

                <p data-anim="subcopy" className="text-sm sm:text-base text-slate-200">
                  <strong className="text-white">{formatNum(personal.totalJobs)} perjalanan</strong> ·{" "}
                  <strong className="text-sky-300">
                    {formatDrivingDuration(personal.totalDurationSeconds)}
                  </strong>{" "}
                  mengemudi bersama Nismara ·{" "}
                  <strong className="text-emerald-300">{formatNum(personal.totalNetNc)} NC</strong> bersih
                </p>

                {/* Logistics vs Coaches Division Split */}
                <div className="grid grid-cols-2 gap-3 max-w-md mx-auto pt-1 text-left">
                  <div
                    data-anim="card"
                    className="p-3.5 rounded-2xl bg-white/[0.07] border border-sky-400/25"
                  >
                    <p className="text-[10px] font-black uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5" /> Logistics (Truck)
                    </p>
                    <p className="text-xl font-black text-white tabular-nums mt-1">
                      {formatNum(personal.truckJobs)} job
                    </p>
                    <p className="text-[11px] text-slate-300 tabular-nums">
                      {formatDrivingDuration(personal.truckDurationSeconds)} · {formatNum(personal.truckKm)} km
                    </p>
                  </div>

                  <div
                    data-anim="card"
                    className="p-3.5 rounded-2xl bg-white/[0.07] border border-teal-400/25"
                  >
                    <p className="text-[10px] font-black uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                      <Bus className="w-3.5 h-3.5" /> Coaches (Bus)
                    </p>
                    <p className="text-xl font-black text-white tabular-nums mt-1">
                      {formatNum(personal.coachJobs)} job
                    </p>
                    <p className="text-[11px] text-slate-300 tabular-nums">
                      {personal.coachJobs > 0
                        ? `${formatDrivingDuration(personal.coachDurationSeconds)} · ${formatNum(personal.totalPassengers)} pax`
                        : "Belum ada rute bus"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p
                data-anim="subcopy"
                className="text-base text-slate-200 max-w-md mx-auto leading-relaxed"
              >
                Tahun 2026 jadi langkah pertamamu bergabung di Nismara. Mesin sudah panas, dan 2027 saatnya mencetak kilometer pertamamu!
              </p>
            )}
          </div>
        ),
      });

      if (personal.hasActivity) {
        // =====================================================================
        // SCENE 7: SUNSET SKYLINE — FULL-WIDTH 12-MONTH EQUALIZER + WIB CLOCK
        // =====================================================================
        const maxMonthKm = Math.max(1, ...personal.monthlyJobs.map((m) => m.km));
        list.push({
          id: "personal-rhythm",
          chapter: "Perjalananmu",
          chromeMode: "dark",
          motif: "aurora",
          bgClass: "bg-gradient-to-b from-[#130C2E] via-[#2B123A] to-[#471D26] text-white",
          orbA: "bg-amber-400/25",
          orbB: "bg-pink-500/20",
          durationMs: 9000,
          render: () => (
            <div className="w-full max-w-4xl mx-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end text-left">
                <div className="md:col-span-7 space-y-1.5">
                  <p
                    data-anim="pill"
                    className="text-xs font-black uppercase tracking-[0.25em] text-amber-300 flex items-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5" /> Ritme &amp; Jam Terbang
                  </p>
                  <h2
                    data-anim="headline"
                    className="text-3xl sm:text-5xl font-black text-white leading-tight"
                  >
                    {personal.busiestMonth
                      ? `${personal.busiestMonth.name} adalah puncakmu.`
                      : "Ritme perjalananmu di 2026."}
                  </h2>
                </div>
                {personal.busiestMonth && (
                  <div data-anim="subcopy" className="md:col-span-5 md:text-right">
                    <p className="text-3xl sm:text-4xl font-black text-amber-300 tabular-nums">
                      <span data-counter={personal.busiestMonth.km}>
                        {formatNum(personal.busiestMonth.km)}
                      </span>{" "}
                      <span className="text-base text-white">km</span>
                    </p>
                    <p className="text-xs text-rose-100/80">
                      dalam {personal.busiestMonth.jobs} perjalanan di bulan {personal.busiestMonth.name}
                    </p>
                  </div>
                )}
              </div>

              {/* Edge-to-Edge City Skyline Bar Chart */}
              <div className="grid grid-cols-12 gap-2 sm:gap-3 items-end h-44 pt-4 border-b border-white/20 pb-3">
                {personal.monthlyJobs.map((m) => {
                  const hPct =
                    m.km > 0
                      ? Math.max(12, Math.round((m.km / maxMonthKm) * 100))
                      : 4;
                  const isPeak =
                    personal.busiestMonth &&
                    m.km === personal.busiestMonth.km &&
                    m.km > 0;
                  return (
                    <div
                      key={m.month}
                      className="flex flex-col items-center gap-2 h-full justify-end"
                    >
                      <div className="w-full flex items-end justify-center flex-1">
                        <div
                          data-anim="bar"
                          style={{ height: `${hPct}%` }}
                          className={`w-full rounded-t-md origin-bottom ${
                            isPeak
                              ? "bg-gradient-to-t from-amber-500 via-amber-300 to-yellow-100"
                              : m.km > 0
                                ? "bg-gradient-to-t from-rose-400/50 to-amber-200/80"
                                : "bg-white/10"
                          }`}
                        >
                          {isPeak && (
                            <div
                              data-anim="bar-peak"
                              className="w-full h-full rounded-t-md bg-yellow-200/35"
                            />
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold ${
                          isPeak ? "text-amber-300" : "text-white/60"
                        }`}
                      >
                        {m.month}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Peak Time Editorial Callout */}
              <div
                data-anim="card"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-rose-200">
                    Kebiasaan Waktu Main (WIB)
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-white">
                    {personal.peakTimeOfDay.label}
                  </p>
                  <p className="text-xs sm:text-sm text-rose-100/80">
                    {personal.peakTimeOfDay.subtitle}
                  </p>
                </div>
                <div className="sm:text-right shrink-0">
                  <span
                    data-counter={personal.peakTimeOfDay.sharePct}
                    data-suffix="%"
                    className="text-4xl font-black text-amber-300 tabular-nums"
                  >
                    {personal.peakTimeOfDay.sharePct}%
                  </span>
                  <p className="text-[10px] uppercase tracking-wider text-rose-200/80">
                    dari total job
                  </p>
                </div>
              </div>
            </div>
          ),
        });

        // =====================================================================
        // SCENE 8: PHYSICAL FREIGHT WAYBILL / BOARDING PASS ON DEEP PETROL TEAL
        // =====================================================================
        list.push({
          id: "personal-favorites",
          chapter: "Perjalananmu",
          chromeMode: "dark",
          motif: "topography",
          bgClass: "bg-[#061A23] text-white",
          orbA: "bg-teal-400/25",
          orbB: "bg-amber-400/20",
          durationMs: 9500,
          render: () => (
            <div className="w-full max-w-2xl mx-auto space-y-5">
              <div className="text-center space-y-1">
                <p
                  data-anim="pill"
                  className="text-xs font-black uppercase tracking-[0.26em] text-teal-300"
                >
                  Surat Jalan &amp; Armada Andalan
                </p>
                <h2
                  data-anim="headline"
                  className="text-2xl sm:text-4xl font-black text-white"
                >
                  Rekor Rute Terjauhmu di 2026
                </h2>
              </div>

              {/* Authentic Cream Waybill / Boarding Pass Card */}
              <div
                data-anim="waybill"
                className="rounded-3xl overflow-hidden bg-[#F5EFE2] text-[#11181C] shadow-[0_30px_70px_rgba(0,0,0,0.65)] text-left"
              >
                {/* Top Dark Teal Stub Header */}
                <div className="bg-[#0C3544] text-white px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em]">
                    {personal.longestJob?.isCoach ? (
                      <Bus className="w-4 h-4 text-amber-300" />
                    ) : (
                      <Truck className="w-4 h-4 text-amber-300" />
                    )}
                    <span>NISMARA WAYBILL · 2026</span>
                  </div>
                  <span className="font-mono text-xs text-teal-200">
                    {personal.favoriteMode || "SIMULATION"}
                  </span>
                </div>

                {/* Longest Route Big Airport-Board Display */}
                {personal.longestJob && (
                  <div className="px-6 py-6 space-y-3 border-b-2 border-dashed border-[#11181C]/20">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#5F6B70]">
                          ORIGIN
                        </p>
                        <p className="text-2xl sm:text-3xl font-black text-[#11181C] truncate">
                          {personal.longestJob.sourceCity}
                        </p>
                      </div>

                      <div className="flex-1 px-2 flex flex-col items-center">
                        <span className="text-xs font-black text-[#B45309] tabular-nums mb-1">
                          <span data-counter={personal.longestJob.distanceKm}>
                            {formatNum(personal.longestJob.distanceKm)}
                          </span>{" "}
                          km
                        </span>
                        <svg viewBox="0 0 140 16" className="w-full h-4 overflow-visible" aria-hidden="true">
                          <path
                            data-anim="draw-path"
                            d="M 4 8 L 136 8"
                            fill="none"
                            stroke="#0C3544"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>

                      <div className="min-w-0 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#5F6B70]">
                          DESTINATION
                        </p>
                        <p className="text-2xl sm:text-3xl font-black text-[#0C3544] truncate">
                          {personal.longestJob.destinationCity}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-[#475459]">
                      Muatan: <strong className="text-[#11181C]">{personal.longestJob.cargoName}</strong>
                    </p>
                  </div>
                )}

                {/* Bottom Stamped Specs — Kota Asal Terbanyak, Kota Tujuan Terbanyak, Armada & Kargo */}
                <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#EFE7D6]">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B6456]">
                      KOTA ASAL TERBANYAK
                    </p>
                    <p className="text-xs sm:text-sm font-black text-[#11181C] mt-0.5 truncate">
                      {personal.favoriteSourceCity?.name || "-"}
                    </p>
                    {personal.favoriteSourceCity && (
                      <p className="text-[10px] text-[#6B6456] tabular-nums">
                        {personal.favoriteSourceCity.count}x berangkat
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B6456]">
                      KOTA TUJUAN TERBANYAK
                    </p>
                    <p className="text-xs sm:text-sm font-black text-[#0C3544] mt-0.5 truncate">
                      {personal.favoriteCity?.name || "-"}
                    </p>
                    {personal.favoriteCity && (
                      <p className="text-[10px] text-[#6B6456] tabular-nums">
                        {personal.favoriteCity.count}x pengiriman
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B6456]">
                      ARMADA FAVORIT
                    </p>
                    <p className="text-xs sm:text-sm font-black text-[#11181C] mt-0.5 line-clamp-2">
                      {personal.favoriteVehicle?.name || "Armada Nismara"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B6456]">
                      KARGO ANDALAN
                    </p>
                    <p className="text-xs sm:text-sm font-black text-[#11181C] mt-0.5 line-clamp-2">
                      {personal.favoriteCargo?.name || "Coaches"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ),
        });

        // =====================================================================
        // SCENE 9: COCKPIT TACHOMETER — HARDCORE SIMULATION & HARDCORE TITLE
        // =====================================================================
        const hcGaugeRatio = Math.min(1, Math.max(0.06, personal.hardcore.avgRating / 5));
        const tickCount = 24;
        list.push({
          id: "personal-hardcore",
          chapter: "Perjalananmu",
          chromeMode: "dark",
          motif: "embers",
          bgClass: "bg-[#120604] text-white",
          orbA: "bg-orange-500/35",
          orbB: "bg-amber-400/20",
          durationMs: 9500,
          render: () => (
            <div className="w-full max-w-3xl mx-auto text-center space-y-5">
              <div
                data-anim="pill"
                className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-500/20 border border-orange-400/45 text-orange-200 text-xs font-black uppercase tracking-widest"
              >
                <Flame className="w-3.5 h-3.5" /> Arena Hardcore Simulation
              </div>

              {personal.hardcore.totalJobs > 0 ? (
                <>
                  {/* Cockpit Instrument Tachometer Dial */}
                  <div className="relative w-52 h-52 sm:w-60 sm:h-60 mx-auto flex items-center justify-center">
                    <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden="true">
                      {/* 24 Cockpit Tick Marks */}
                      {Array.from({ length: tickCount }).map((_, i) => {
                        const deg = -215 + (i / (tickCount - 1)) * 250;
                        const rad = (deg * Math.PI) / 180;
                        const x1 = 100 + Math.cos(rad) * 82;
                        const y1 = 100 + Math.sin(rad) * 82;
                        const x2 = 100 + Math.cos(rad) * 90;
                        const y2 = 100 + Math.sin(rad) * 90;
                        const activeTick = i / (tickCount - 1) <= hcGaugeRatio;
                        return (
                          <line
                            key={i}
                            data-anim="gauge-tick"
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={activeTick ? "#FB923C" : "rgba(255,255,255,0.16)"}
                            strokeWidth={i % 4 === 0 ? "2.8" : "1.5"}
                            strokeLinecap="round"
                          />
                        );
                      })}
                      {/* Base Track */}
                      <circle
                        cx="100"
                        cy="100"
                        r="68"
                        fill="none"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="10"
                      />
                      {/* Active Animated Gauge */}
                      <circle
                        data-anim="draw-gauge"
                        data-gauge-target={hcGaugeRatio.toFixed(3)}
                        cx="100"
                        cy="100"
                        r="68"
                        fill="none"
                        stroke="url(#cockpitGrad)"
                        strokeWidth="10"
                        strokeLinecap="round"
                        transform="rotate(-90 100 100)"
                      />
                      <defs>
                        <linearGradient id="cockpitGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#F97316" />
                          <stop offset="100%" stopColor="#FDE047" />
                        </linearGradient>
                      </defs>
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300">
                        AVG RATING
                      </span>
                      <span
                        data-counter={personal.hardcore.avgRating}
                        data-decimals="2"
                        data-suffix="★"
                        className="text-4xl sm:text-5xl font-black text-white tabular-nums mt-0.5"
                      >
                        {personal.hardcore.avgRating.toFixed(2)}★
                      </span>
                      <span className="text-[11px] font-semibold text-orange-200/80">
                        {formatNum(personal.hardcore.totalJobs)} job Hardcore
                      </span>
                    </div>
                  </div>

                  {personal.hardcore.title && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-300">
                        Gelar Hardcore 2026
                      </p>
                      <h2
                        data-anim="headline-chars"
                        className="text-3xl sm:text-5xl font-black text-white tracking-tight"
                      >
                        {personal.hardcore.title.title}
                      </h2>
                      <p
                        data-anim="subcopy"
                        className="text-sm text-orange-100/80 max-w-md mx-auto"
                      >
                        {personal.hardcore.title.subtitle}
                      </p>
                    </div>
                  )}

                  <div
                    data-anim="card"
                    className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-orange-100/90 pt-1"
                  >
                    <span>
                      <strong className="text-amber-300 tabular-nums">
                        {formatNum(personal.hardcore.highRatingJobs)}
                      </strong>{" "}
                      job rating 4★+
                    </span>
                    <span>·</span>
                    <span>
                      <strong className="text-white tabular-nums">
                        {formatNum(personal.hardcore.totalKm)} km
                      </strong>{" "}
                      jarak Hardcore
                    </span>
                    <span>·</span>
                    <span>
                      <strong className="text-orange-300 tabular-nums">
                        {personal.hardcore.sharePct}%
                      </strong>{" "}
                      dari total jobmu
                    </span>
                  </div>
                </>
              ) : (
                <div className="space-y-3 max-w-md mx-auto py-8">
                  <h2 data-anim="headline" className="text-3xl sm:text-5xl font-black text-white">
                    Belum Menjajal Hardcore?
                  </h2>
                  <p data-anim="subcopy" className="text-sm sm:text-base text-orange-100/80 leading-relaxed">
                    Di 2027 nanti, aktifkan mode Hardcore Simulation dan buktikan kamu layak menyandang gelar{" "}
                    <strong className="text-amber-300">Hardcore Grandmaster</strong>.
                  </p>
                </div>
              )}
            </div>
          ),
        });

        // =====================================================================
        // SCENE 10: EDITORIAL MAGAZINE INFOGRAPHIC — GIANT GRADE LETTER EMBLEM
        // =====================================================================
        const gradeDisplay =
          personal.safety.drivingScore !== null
            ? personal.safety.drivingGrade
            : "★";
        list.push({
          id: "personal-safety-economy",
          chapter: "Perjalananmu",
          chromeMode: "dark",
          motif: "topography",
          bgClass: "bg-[#07151C] text-white",
          orbA: "bg-emerald-400/25",
          orbB: "bg-sky-400/20",
          durationMs: 9000,
          render: () => (
            <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center text-left">
              {/* Left Monumental Grade Emblem */}
              <div className="md:col-span-5 flex flex-col items-center md:items-start space-y-3">
                <p
                  data-anim="pill"
                  className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300"
                >
                  Reputasi &amp; Disiplin
                </p>
                <div
                  data-anim="grade-emblem"
                  className="relative flex items-baseline gap-3"
                >
                  <span className="text-[7.5rem] sm:text-[9.5rem] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-emerald-200 via-emerald-400 to-teal-600 select-none">
                    {gradeDisplay}
                  </span>
                  {personal.safety.drivingScore !== null && (
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                        DRIVING SCORE
                      </p>
                      <p className="text-2xl font-black text-white tabular-nums">
                        {personal.safety.drivingScore.toFixed(1)}
                        <span className="text-sm text-slate-400"> / 100</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Real Miles Progress Bar */}
                <div className="w-full max-w-xs space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-sky-300">Real Miles Rate</span>
                    <span
                      data-counter={personal.safety.realMilesRate}
                      data-suffix="%"
                      className="text-white tabular-nums"
                    >
                      {personal.safety.realMilesRate}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      data-anim="hbar"
                      style={{ width: `${Math.max(6, personal.safety.realMilesRate)}%` }}
                      className="h-full origin-left rounded-full bg-gradient-to-r from-sky-400 to-emerald-300"
                    />
                  </div>
                </div>
              </div>

              {/* Right Editorial Highlights */}
              <div className="md:col-span-7 space-y-4">
                <h2
                  data-anim="headline"
                  className="text-2xl sm:text-3xl font-black text-white leading-snug"
                >
                  {personal.safety.totalFines === 0
                    ? "Nol tilang sepanjang 2026. Polisi jalan raya cuma bisa melambaikan tangan."
                    : `${formatNum(personal.safety.zeroDamageJobs)} pengiriman tiba tanpa goresan sedikit pun.`}
                </h2>

                <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/15 pt-4">
                  <div data-anim="card">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                      Zero Damage
                    </p>
                    <p
                      data-counter={personal.safety.zeroDamageJobs}
                      className="text-2xl sm:text-3xl font-black text-white tabular-nums"
                    >
                      {formatNum(personal.safety.zeroDamageJobs)}
                    </p>
                  </div>
                  <div data-anim="card">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                      Special Contract
                    </p>
                    <p
                      data-counter={personal.footprint.specialContractJobs}
                      className="text-2xl sm:text-3xl font-black text-amber-300 tabular-nums"
                    >
                      {formatNum(personal.footprint.specialContractJobs)}
                    </p>
                  </div>
                  <div data-anim="card">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                      Bonus Event NC Boost
                    </p>
                    <p
                      data-counter={personal.footprint.ncBoostEarned}
                      data-prefix="+"
                      className="text-2xl sm:text-3xl font-black text-emerald-300 tabular-nums"
                    >
                      +{formatNum(personal.footprint.ncBoostEarned)}
                    </p>
                  </div>
                  <div data-anim="card">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                      Armada &amp; Achievement
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-sky-300 tabular-nums">
                      {personal.footprint.fleetsOwned}{" "}
                      <span className="text-xs font-semibold text-slate-400">unit</span> ·{" "}
                      {personal.footprint.achievementsUnlocked}{" "}
                      <span className="text-xs font-semibold text-slate-400">achv</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ),
        });

        // =====================================================================
        // SCENE 11 (CONDITIONAL): 2.35:1 WIDESCREEN CINEMA FRAME (USER GALLERY)
        // =====================================================================
        if (personal.gallery.topPhoto) {
          const topPhoto = personal.gallery.topPhoto;
          list.push({
            id: "personal-gallery",
            chapter: "Perjalananmu",
            chromeMode: "dark",
            motif: "bokeh",
            bgClass: "bg-[#0B090D] text-white",
            orbA: "bg-rose-500/25",
            orbB: "bg-amber-400/20",
            durationMs: 9000,
            creditPhoto: topPhoto,
            render: () => (
              <div className="w-full max-w-3xl mx-auto space-y-5 text-center">
                <p
                  data-anim="pill"
                  className="text-xs font-black uppercase tracking-[0.26em] text-rose-300"
                >
                  Kenangan di Lensa Kamu
                </p>

                {/* Crisp 2.35:1 Widescreen Cinema Still */}
                <div className="relative rounded-2xl overflow-hidden border border-white/15 shadow-[0_30px_80px_rgba(0,0,0,0.85)] bg-black">
                  <div className="relative aspect-[16/9] w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      data-anim="cinema-photo"
                      src={topPhoto.imageUrl}
                      alt={topPhoto.caption || "Foto Galeri 2026"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="px-5 py-3.5 bg-black/90 flex items-center justify-between gap-4 text-left border-t border-white/10">
                    <p className="text-xs sm:text-sm italic text-slate-200 line-clamp-1">
                      &ldquo;{topPhoto.caption || "Momen paling berkesan di jalanan 2026."}&rdquo;
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-rose-300 text-xs font-black shrink-0 tabular-nums">
                      <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                      {topPhoto.likesCount} likes
                    </span>
                  </div>
                </div>

                <p data-anim="subcopy" className="text-xs sm:text-sm text-slate-300">
                  Kamu mengunggah <strong className="text-white">{personal.gallery.postsCount} foto</strong> dan menginspirasi{" "}
                  <strong className="text-rose-300">{personal.gallery.totalLikes} likes</strong> sepanjang 2026.
                </p>
              </div>
            ),
          });
        }
      }

      // =======================================================================
      // SCENE 12: THE CLIMAX — AWARD SHOW PERSONA REVEAL (NEVER SKIPPED!)
      // =======================================================================
      list.push({
        id: "personal-persona",
        chapter: "Perjalananmu",
        chromeMode: "dark",
        motif: "embers",
        bgClass: "bg-[#110C04] text-white",
        orbA: "bg-amber-400/40",
        orbB: "bg-orange-500/30",
        durationMs: 10000,
        render: () => (
          <div className="relative w-full max-w-2xl mx-auto text-center py-8 space-y-6">
            {/* Radial Shockwaves & 20 Golden Sparks */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                data-anim="ring-burst"
                className="w-52 h-52 rounded-full border-2 border-amber-300/70"
              />
              <div
                data-anim="ring-burst"
                className="absolute w-52 h-52 rounded-full border border-orange-400/55"
              />
              {Array.from({ length: 20 }).map((_, i) => (
                <span
                  key={i}
                  data-anim="spark"
                  className={`absolute rounded-full ${
                    i % 3 === 0
                      ? "w-2.5 h-2.5 bg-amber-300"
                      : i % 3 === 1
                        ? "w-2 h-2 bg-orange-300"
                        : "w-1.5 h-1.5 bg-white"
                  }`}
                />
              ))}
            </div>

            <div
              data-anim="pill"
              className="relative z-10 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 border border-amber-300/50 text-amber-200 text-xs font-black uppercase tracking-[0.22em]"
            >
              <Award className="w-4 h-4" /> Driver Persona 2026
            </div>

            <div className="relative z-10 space-y-4">
              <p data-anim="subcopy" className="text-sm sm:text-base text-amber-100/75">
                Dari seluruh kilometer, jam terbang, dan caramu menaklukkan rute 2026...
              </p>
              <h2
                data-anim="headline-chars"
                className="text-5xl sm:text-7xl font-black text-amber-300 tracking-tight leading-[1.02] drop-shadow-[0_0_40px_rgba(245,197,106,0.45)]"
              >
                {personal.persona.title}
              </h2>
              <p
                data-anim="subcopy"
                className="text-base sm:text-xl text-white font-medium leading-relaxed max-w-lg mx-auto"
              >
                {personal.persona.tagline}
              </p>
            </div>

            {personal.hardcore.title && (
              <div
                data-anim="stamp"
                className="relative z-10 inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-orange-500/25 border-2 border-orange-400/60 text-orange-100 text-xs sm:text-sm font-black uppercase tracking-wider"
              >
                <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                {personal.hardcore.title.title} · {personal.hardcore.avgRating.toFixed(2)}★
              </div>
            )}
          </div>
        ),
      });
    }

    // =========================================================================
    // SCENE 13: COLLECTOR'S FOIL CARD STUDIO — DOWNLOAD PNG & SHARE LINK
    // =========================================================================
    list.push({
      id: "final-share",
      chapter: "Bagikan",
      chromeMode: "dark",
      motif: "bokeh",
      bgClass: "bg-[#080B14] text-white",
      orbA: "bg-amber-400/25",
      orbB: "bg-sky-400/20",
      durationMs: 12000,
      render: () => (
        <div
          className="space-y-5 max-w-xl mx-auto text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-1">
            <p
              data-anim="pill"
              className="text-xs font-black uppercase tracking-[0.26em] text-amber-300"
            >
              Sampai Jumpa di Aspal 2027
            </p>
            <h2 data-anim="headline" className="text-2xl sm:text-4xl font-black text-white">
              Kartu Kenangan 2026 Kamu
            </h2>
          </div>

          {/* Foil Collector Card */}
          <div
            data-anim="poster-card"
            className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-br from-[#141A2A] via-[#0F1422] to-[#1D160B] border border-amber-300/45 shadow-[0_25px_70px_rgba(0,0,0,0.75)] text-left space-y-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                {personal?.driver.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={personal.driver.avatarUrl}
                    alt={personal.driver.name}
                    className="w-13 h-13 rounded-full object-cover ring-2 ring-amber-300 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                    MILES OF MEMORIES · 2026
                  </p>
                  <p className="text-xl font-black text-white truncate">
                    {personal ? personal.driver.name : "Nismara Transport Community"}
                  </p>
                  <p className="text-xs font-bold text-amber-200 truncate">
                    {personal ? personal.persona.title : "Tahun Pertama Website Nismara"}
                  </p>
                </div>
              </div>
              {personal?.hardcore.title && (
                <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/25 border border-orange-400/50 text-orange-200 text-[11px] font-black shrink-0">
                  <Flame className="w-3.5 h-3.5" /> {personal.hardcore.avgRating.toFixed(1)}★
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-white/[0.06] border border-white/10">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Total KM</p>
                <p className="text-base font-black text-amber-300 tabular-nums mt-0.5">
                  {formatNum(personal ? personal.totalKm : collective.totalKm)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.06] border border-white/10">
                <p className="text-[10px] text-slate-400 uppercase font-bold">
                  Logistics / Bus
                </p>
                <p className="text-sm font-black text-sky-300 tabular-nums mt-0.5">
                  {personal
                    ? `${formatNum(personal.truckJobs)} / ${formatNum(personal.coachJobs)}`
                    : `${formatNum(collective.truckJobs)} / ${formatNum(collective.coachJobs)}`}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.06] border border-white/10">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Durasi 2026</p>
                <p className="text-sm font-black text-emerald-300 tabular-nums mt-0.5">
                  {personal
                    ? formatDrivingDuration(personal.totalDurationSeconds)
                    : `${formatNum(collective.totalHours)} jam`}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.06] border border-white/10">
                <p className="text-[10px] text-slate-400 uppercase font-bold">
                  Kota Favorit
                </p>
                <p className="text-sm font-black text-white truncate mt-0.5">
                  {personal
                    ? personal.favoriteCity?.name || "-"
                    : collective.topCities[0]?.name || "-"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/nismara-group-logo.png"
                alt="Nismara Group"
                className="h-7 w-auto object-contain opacity-95"
              />
              <span className="text-[11px] font-bold text-amber-300">
                #MilesOfMemories2026
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              data-anim="card"
              onClick={() => handleDownload("story")}
              disabled={exportingFormat !== null}
              className="min-h-[48px] px-4 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              <span>
                {exportingFormat === "story"
                  ? "Membuat Story PNG..."
                  : "Download Story PNG (9:16)"}
              </span>
            </button>

            <button
              type="button"
              data-anim="card"
              onClick={() => handleDownload("square")}
              disabled={exportingFormat !== null}
              className="min-h-[48px] px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              <span>
                {exportingFormat === "square"
                  ? "Membuat Square PNG..."
                  : "Download Discord / Feed (1:1)"}
              </span>
            </button>
          </div>

          <div data-anim="subcopy" className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-100 text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Link Rewind Disalin!
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" /> Salin Link Rewind
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                elapsedMsRef.current = 0;
                hasAdvancedRef.current = false;
                setCurrentIdx(0);
                setProgress(0);
                setPaused(false);
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold inline-flex items-center gap-2 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Putar Ulang
            </button>

            {!isLoggedIn && !personal && (
              <Link
                href="/login"
                className="min-h-[42px] px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-bold inline-flex items-center gap-2 transition"
              >
                <LogIn className="w-3.5 h-3.5" /> Login Lihat Rewind Pribadimu
              </Link>
            )}
          </div>
        </div>
      ),
    });

    return list;
  }, [
    collective,
    personal,
    isSharedView,
    isLoggedIn,
    exportingFormat,
    copiedLink,
    handleDownload,
    handleCopyShareLink,
  ]);

  const totalSlides = slides.length;
  const safeIdx = Math.min(currentIdx, totalSlides - 1);
  const activeSlide = slides[safeIdx];
  const isLightChrome = activeSlide.chromeMode === "light";

  const goToSlide = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(totalSlides - 1, nextIndex));
      elapsedMsRef.current = 0;
      hasAdvancedRef.current = false;
      setProgress(0);
      setCurrentIdx(clamped);
    },
    [totalSlides]
  );

  const goNext = useCallback(() => {
    if (safeIdx < totalSlides - 1) goToSlide(safeIdx + 1);
  }, [safeIdx, totalSlides, goToSlide]);

  const goPrev = useCallback(() => {
    if (safeIdx > 0) goToSlide(safeIdx - 1);
  }, [safeIdx, goToSlide]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      playerRef.current?.stop();
    };
  }, []);

  // Splash intro Anime.js choreography
  useEffect(() => {
    if (started || !splashRootRef.current) return;
    return runSplashChoreography(splashRootRef.current);
  }, [started]);

  // Slide Anime.js choreography on slide change
  useEffect(() => {
    if (!started || !stageRootRef.current) return;
    const handle = runRewindSlideChoreography(stageRootRef.current);
    choreoRef.current = handle;
    return () => {
      handle.cleanup();
      choreoRef.current = null;
    };
  }, [started, safeIdx]);

  // Sync Pause/Play button with Anime.js timeline
  useEffect(() => {
    if (!choreoRef.current) return;
    if (paused) choreoRef.current.pause();
    else choreoRef.current.play();
  }, [paused]);

  // Rock-solid RAF Auto-Advance Timer (zero nested setState, zero React 19 StrictMode double-skip!)
  useEffect(() => {
    if (!started || paused || safeIdx >= totalSlides - 1) return;

    const duration = activeSlide.durationMs || DEFAULT_SLIDE_MS;
    hasAdvancedRef.current = false;
    let rafId = 0;
    let lastTime = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(100, Math.max(0, now - lastTime));
      lastTime = now;
      elapsedMsRef.current += dt;

      const pct = Math.min(100, (elapsedMsRef.current / duration) * 100);
      setProgress(pct);

      if (elapsedMsRef.current >= duration && !hasAdvancedRef.current) {
        hasAdvancedRef.current = true;
        elapsedMsRef.current = 0;
        setProgress(0);
        setCurrentIdx((idx) => (idx < totalSlides - 1 ? idx + 1 : idx));
        return;
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [started, paused, safeIdx, totalSlides, activeSlide.durationMs]);

  const handleStart = async (withSound: boolean) => {
    elapsedMsRef.current = 0;
    hasAdvancedRef.current = false;
    setStarted(true);
    setCurrentIdx(0);
    setProgress(0);
    setPaused(false);
    setMuted(!withSound);

    const player = new RewindAudioPlayer(musicUrl);
    playerRef.current = player;
    player.setMuted(!withSound);
    await player.start();
    setAudioMode(player.getMode());
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    const nextMuted = playerRef.current.toggleMute();
    setMuted(nextMuted);
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!started) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key.toLowerCase() === "m") {
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [started, goNext, goPrev]);

  // ===========================================================================
  // SPLASH INTRO SCREEN — EDITORIAL SPLIT WITH ROLLING 35MM GALLERY FILMSTRIP
  // ===========================================================================
  if (!started) {
    const filmPhotos = collective.backdropPhotos.slice(0, 6);
    const loopFilm = [...filmPhotos, ...filmPhotos];
    return (
      <div
        ref={splashRootRef}
        className="fixed inset-0 z-[70] bg-[#090B11] text-slate-50 flex items-center justify-center p-6 sm:p-10 overflow-hidden"
      >
        <RewindLivingBackdrop motif="highway" lightMode={false} paused={false} />
        <div
          data-anim="orb"
          className="absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full bg-amber-400/20 blur-[120px] pointer-events-none"
        />
        <div
          data-anim="orb"
          className="absolute -bottom-24 right-1/4 w-96 h-96 rounded-full bg-sky-400/15 blur-[120px] pointer-events-none"
        />

        <div className="absolute top-5 right-5 z-30">
          <Link
            href={isLoggedIn ? "/dashboard" : "/"}
            className="min-h-[42px] min-w-[42px] rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition"
            aria-label="Tutup Rewind"
          >
            <X className="w-5 h-5" />
          </Link>
        </div>

        <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Asymmetric Editorial Lockup */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {isOwnerPreview && (
              <div
                data-anim="pill"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/45 text-amber-200 text-xs font-bold"
              >
                Mode Preview Owner · Rilis Publik: {formatWibDate(releaseAtIso)}
              </div>
            )}

            <div className="space-y-3">
              <p
                data-anim="pill"
                className="text-xs font-black uppercase tracking-[0.3em] text-amber-300"
              >
                Nismara Transport · Rewind 2026
              </p>
              <h1
                data-anim="headline-chars"
                className="text-5xl sm:text-7xl font-black tracking-tight text-white leading-[0.98]"
              >
                Miles of Memories
              </h1>
              <svg
                viewBox="0 0 320 16"
                className="w-52 h-4 overflow-visible"
                aria-hidden="true"
              >
                <path
                  data-anim="draw-path"
                  d="M 2 8 L 316 8"
                  fill="none"
                  stroke="#F5C56A"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <p
                data-anim="subcopy"
                className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-md pt-1"
              >
                {personal
                  ? `Kilas balik tahun pertama website Nismara Transport, dirangkum khusus untuk ${personal.driver.name}.`
                  : "Kilas balik tahun pertama website Nismara Transport bersama seluruh driver ETS2, ATS, dan Coaches."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                type="button"
                data-anim="card"
                onClick={() => handleStart(true)}
                className="min-h-[52px] px-7 py-3.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm tracking-wide flex items-center justify-center gap-2.5 shadow-[0_0_36px_rgba(245,185,66,0.38)] transition cursor-pointer"
              >
                <Music className="w-4 h-4" />
                <span>Mulai dengan Musik</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                data-anim="card"
                onClick={() => handleStart(false)}
                className="min-h-[52px] px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-slate-100 font-semibold text-sm transition cursor-pointer"
              >
                Tanpa Suara
              </button>
            </div>
          </div>

          {/* Right Vertical 35mm Gallery Filmstrip */}
          {loopFilm.length > 0 && (
            <div className="hidden lg:block lg:col-span-5 relative h-[78vh] overflow-hidden rounded-3xl border border-white/15 bg-black/60 px-4">
              <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#090B11] to-transparent z-10 pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#090B11] to-transparent z-10 pointer-events-none" />
              <div data-anim="filmstrip" className="space-y-4 py-4">
                {loopFilm.map((photo, idx) => (
                  <div
                    key={`${photo.id}-${idx}`}
                    className="rounded-2xl overflow-hidden border border-white/15 bg-slate-900 shadow-lg"
                  >
                    <div className="aspect-[16/10] w-full overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // MAIN STORY STAGE
  // ===========================================================================
  return (
    <div
      className={`fixed inset-0 z-[70] ${activeSlide.bgClass} flex flex-col overflow-hidden select-none transition-colors duration-700`}
      onTouchStart={(e) => {
        touchStartXRef.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartXRef.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartXRef.current;
        touchStartXRef.current = null;
        if (Math.abs(delta) > 45) {
          if (delta < 0) goNext();
          else goPrev();
        }
      }}
    >
      {/* Top Segmented Progress Bars & Adaptive Chrome (Light or Dark!) */}
      <header className="relative z-30 px-4 sm:px-6 pt-4 pb-2 max-w-4xl w-full mx-auto space-y-3">
        <div className="flex items-center gap-1.5">
          {slides.map((s, idx) => {
            const pct =
              idx < safeIdx
                ? 100
                : idx === safeIdx
                  ? safeIdx === totalSlides - 1
                    ? 100
                    : progress
                  : 0;
            return (
              <button
                key={s.id}
                type="button"
                aria-label={`Slide ${idx + 1}`}
                onClick={() => goToSlide(idx)}
                className={`flex-1 h-1.5 rounded-full overflow-hidden cursor-pointer transition ${
                  isLightChrome
                    ? "bg-black/15 hover:bg-black/25"
                    : "bg-white/20 hover:bg-white/30"
                }`}
              >
                <div
                  className={`h-full rounded-full ${
                    isLightChrome ? "bg-[#111111]" : "bg-amber-300"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`text-xs font-black tracking-wide truncate ${
                isLightChrome ? "text-[#111111]" : "text-amber-300"
              }`}
            >
              Miles of Memories 2026
            </span>
            <span
              className={`text-[11px] font-semibold hidden sm:inline ${
                isLightChrome ? "text-black/60" : "text-slate-400"
              }`}
            >
              · {activeSlide.chapter} ({safeIdx + 1}/{totalSlides})
            </span>
            {isOwnerPreview && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isLightChrome
                    ? "bg-[#111111] text-[#F4EDE0]"
                    : "bg-amber-500/20 border border-amber-400/40 text-amber-200"
                }`}
              >
                Preview Owner
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleMute}
              title={
                muted
                  ? "Nyalakan Musik"
                  : audioMode === "custom"
                    ? "Matikan Musik Kustom"
                    : "Matikan Musik Bawaan"
              }
              className={`min-h-[38px] min-w-[38px] rounded-full border flex items-center justify-center transition cursor-pointer ${
                isLightChrome
                  ? "bg-black/10 hover:bg-black/15 border-black/15 text-[#111111]"
                  : "bg-white/10 hover:bg-white/20 border-white/15 text-white"
              }`}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              title={paused ? "Lanjutkan Auto-Play" : "Jeda Slide"}
              className={`min-h-[38px] min-w-[38px] rounded-full border flex items-center justify-center transition cursor-pointer ${
                isLightChrome
                  ? "bg-black/10 hover:bg-black/15 border-black/15 text-[#111111]"
                  : "bg-white/10 hover:bg-white/20 border-white/15 text-white"
              }`}
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <Link
              href={isLoggedIn ? "/dashboard" : "/"}
              title="Keluar dari Rewind"
              className={`min-h-[38px] min-w-[38px] rounded-full border flex items-center justify-center transition ${
                isLightChrome
                  ? "bg-black/10 hover:bg-black/15 border-black/15 text-[#111111]"
                  : "bg-white/10 hover:bg-white/20 border-white/15 text-white"
              }`}
            >
              <X className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Scoped Anime.js Stage */}
      <div
        key={activeSlide.id}
        ref={stageRootRef}
        className="relative flex-1 flex flex-col overflow-hidden"
      >
        {/* Living Miles of Memories Animated Canvas Backdrop */}
        <RewindLivingBackdrop
          motif={activeSlide.motif}
          lightMode={isLightChrome}
          paused={paused}
        />

        {activeSlide.orbA && (
          <div
            data-anim="orb"
            className={`absolute -top-28 -right-24 w-[28rem] h-[28rem] rounded-full ${activeSlide.orbA} blur-[120px] pointer-events-none z-0`}
          />
        )}
        {activeSlide.orbB && (
          <div
            data-anim="orb"
            className={`absolute -bottom-32 -left-24 w-[26rem] h-[26rem] rounded-full ${activeSlide.orbB} blur-[120px] pointer-events-none z-0`}
          />
        )}

        <main
          className="relative z-10 flex-1 flex items-center justify-center px-5 sm:px-14 py-4 overflow-y-auto"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest("button, a, input")) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            if (clickX < rect.width * 0.28) goPrev();
            else goNext();
          }}
        >
          {safeIdx > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label="Slide sebelumnya"
              className={`hidden md:flex fixed left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full border items-center justify-center transition cursor-pointer ${
                isLightChrome
                  ? "bg-black/10 hover:bg-black/15 border-black/15 text-[#111111]"
                  : "bg-white/10 hover:bg-white/20 border-white/15 text-white"
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {safeIdx < totalSlides - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              aria-label="Slide berikutnya"
              className={`hidden md:flex fixed right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full border items-center justify-center transition cursor-pointer ${
                isLightChrome
                  ? "bg-black/10 hover:bg-black/15 border-black/15 text-[#111111]"
                  : "bg-white/10 hover:bg-white/20 border-white/15 text-white"
              }`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          <div className="w-full max-w-4xl mx-auto">{activeSlide.render()}</div>
        </main>
      </div>

      {/* Bottom Footer Bar */}
      <footer
        className={`relative z-30 px-4 sm:px-6 pb-4 pt-2 max-w-4xl w-full mx-auto flex items-center justify-between gap-3 text-[11px] ${
          isLightChrome ? "text-black/60" : "text-slate-400"
        }`}
      >
        <div className="truncate">
          {activeSlide.creditPhoto ? (
            <span>
              Foto oleh{" "}
              <strong className={isLightChrome ? "text-black" : "text-slate-200"}>
                {activeSlide.creditPhoto.photographerName}
              </strong>
            </span>
          ) : (
            <span>Nismara Transport · #MilesOfMemories2026</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {safeIdx < totalSlides - 1 && (
            <button
              type="button"
              onClick={() => {
                goToSlide(totalSlides - 1);
                setPaused(true);
              }}
              className={`px-3 py-1.5 rounded-full font-semibold transition cursor-pointer ${
                isLightChrome
                  ? "bg-black/10 hover:bg-black/15 text-[#111111]"
                  : "bg-white/10 hover:bg-white/20 text-slate-100"
              }`}
            >
              Ke Kartu Share →
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
