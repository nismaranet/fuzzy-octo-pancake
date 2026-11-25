import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Gauge,
  AlertOctagon,
  Sparkles,
  Flame,
  Clock,
  CheckCircle2,
  Info,
  Award,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";
import {
  type DrivingScoreData,
  MIN_JOBS_FOR_RANK,
  getDrivingGradeMeta,
} from "@/lib/drivingScore";

interface DrivingScoreCardProps {
  drivingScore: DrivingScoreData | null | undefined;
  variant?: "dashboard" | "profile";
}

function getCoachingTip(ds: DrivingScoreData): string {
  if (ds.status === "calibrating") {
    const remaining = Math.max(1, MIN_JOBS_FOR_RANK - ds.sampleSize);
    return `Selesaikan ${remaining} pengiriman lagi (Truck atau Coaches) untuk membuka Driving Score & Grade resmi kamu.`;
  }
  if (ds.status === "inactive") {
    const remaining = Math.max(1, MIN_JOBS_FOR_RANK - ds.recent30dJobs);
    return `Skor saat ini memakai data historis (${ds.sampleSize} job terakhir). Selesaikan ${remaining} job lagi dalam 30 hari agar status kembali Aktif (Ranked) dan memenuhi syarat promo Grade.`;
  }
  if (ds.grade === "S") {
    return "Performa mengemudi luar biasa! Kamu berada di Grade S (Aktif) — pertahankan Real Miles & 0% damage untuk menjaga eligibilitas benefit eksklusif.";
  }

  const pillars = [
    {
      name: "Safety & Damage",
      val: ds.breakdown.safety,
      tip: "Kurangi kerusakan kendaraan/kargo (toleransi SP 10%, TMP/HaulMP 20%) untuk lonjakan skor paling besar.",
    },
    {
      name: "Speed Discipline",
      val: ds.breakdown.speed,
      tip: "Jaga kecepatan dalam batas Real Miles (ETS2 ≤100 km/h, ATS ≤130 km/h, Coaches ≤110 km/h) agar skor kecepatan maksimal.",
    },
    {
      name: "Traffic Compliance",
      val: ds.breakdown.traffic,
      tip: "Hindari tilang lalu lintas (lampu merah, kamera kecepatan, tabrakan) untuk mendongkrak skor Traffic Compliance.",
    },
    {
      name: "Clean & On-Time",
      val: ds.breakdown.clean,
      tip: "Selesaikan pengiriman tepat waktu tanpa penalti sistem & 0% kerusakan kargo agar pilar Clean Delivery naik ke 100.",
    },
  ].sort((a, b) => a.val - b.val);

  return `Fokus peningkatan tercepat (${pillars[0].name}: ${pillars[0].val}): ${pillars[0].tip}`;
}

export default function DrivingScoreCard({
  drivingScore,
  variant = "dashboard",
}: DrivingScoreCardProps) {
  const ds: DrivingScoreData = drivingScore || {
    score: null,
    grade: "UNRANKED",
    status: "calibrating",
    sampleSize: 0,
    recent30dJobs: 0,
    breakdown: {
      safety: 0,
      speed: 0,
      traffic: 0,
      clean: 0,
      hardcoreBonus: 0,
      avgDamageVehicle: 0,
      avgDamageCargo: 0,
      realMilesRate: 0,
      finesPer1000Km: 0,
      onTimeRate: 100,
    },
    updatedAt: null,
  };

  const meta = getDrivingGradeMeta(ds.grade);
  const isCalibrating = ds.status === "calibrating" || ds.score === null;
  const isInactive = ds.status === "inactive";
  const numericScore = isCalibrating ? 0 : Math.min(100, Math.max(0, ds.score || 0));

  // SVG Ring calculation
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (numericScore / 100) * circumference;

  const updatedWIB = ds.updatedAt
    ? new Date(ds.updatedAt).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB"
    : null;

  const pillars = [
    {
      key: "safety",
      label: "Safety & Damage",
      weight: "40%",
      score: ds.breakdown.safety,
      detail: `Avg Damage: ${ds.breakdown.avgDamageVehicle}% veh • ${ds.breakdown.avgDamageCargo}% cargo`,
      barClass: "bg-emerald-400",
      icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />,
    },
    {
      key: "speed",
      label: "Speed Discipline",
      weight: "30%",
      score: ds.breakdown.speed,
      detail: `Real Miles Rate: ${ds.breakdown.realMilesRate}%`,
      barClass: "bg-sky-400",
      icon: <Gauge className="w-3.5 h-3.5 text-sky-400" />,
    },
    {
      key: "clean",
      label: "Clean & On-Time",
      weight: "25%",
      score: ds.breakdown.clean,
      detail: `On-Time Rate: ${ds.breakdown.onTimeRate}%`,
      barClass: "bg-violet-400",
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />,
    },
    {
      key: "traffic",
      label: "Traffic Compliance",
      weight: "5%",
      score: ds.breakdown.traffic,
      detail: `${ds.breakdown.finesPer1000Km} tilang / 1.000 km`,
      barClass: "bg-amber-400",
      icon: <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />,
    },
  ];

  const containerClass =
    variant === "dashboard"
      ? "glass-panel p-6 rounded-2xl border border-border/60 mb-12 relative overflow-hidden"
      : "bg-card/40 backdrop-blur-sm border border-border/50 rounded-2xl p-6 relative overflow-hidden";

  return (
    <section className={containerClass} aria-label="Driving Score Pengemudi">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 mb-5 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${meta.bgClass} ${meta.borderClass}`}>
            <Award className={`w-5 h-5 ${meta.textClass}`} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
              Driving Score &amp; Safety Rating
              {ds.breakdown.hardcoreBonus > 0 && !isCalibrating && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-400 normal-case">
                  <Flame className="w-3 h-3" /> +{ds.breakdown.hardcoreBonus} Hardcore
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isCalibrating
                ? `Evaluasi otomatis dari minimal ${MIN_JOBS_FOR_RANK} pengiriman selesai (Truck & Coaches)`
                : isInactive
                  ? `Dihitung dari ${ds.sampleSize} pengiriman historis terakhir (${ds.recent30dJobs} job dalam 30 hari)`
                  : `Dihitung dari ${ds.sampleSize} pengiriman selesai dalam 30 hari terakhir`}
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2 flex-wrap">
          {ds.status === "active" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11px] font-bold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Aktif (Ranked)
            </span>
          )}
          {ds.status === "inactive" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/15 border border-slate-500/30 px-3 py-1 text-[11px] font-bold text-slate-300">
              <Clock className="w-3 h-3" />
              Historis (Inactive)
            </span>
          )}
          {ds.status === "calibrating" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 border border-border px-3 py-1 text-[11px] font-bold text-muted-foreground">
              <Sparkles className="w-3 h-3" />
              Kalibrasi ({ds.sampleSize}/{MIN_JOBS_FOR_RANK})
            </span>
          )}
          {updatedWIB && (
            <span className="text-[11px] text-muted-foreground hidden md:inline">
              Update: {updatedWIB}
            </span>
          )}
          <Link
            href="/kb/umum/panduan-driving-score"
            className="inline-flex items-center gap-1 rounded-full bg-card/80 hover:bg-primary/15 border border-border/70 hover:border-primary/40 px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:text-primary transition-all"
            title="Baca panduan lengkap cara perhitungan Driving Score"
          >
            <BookOpen className="w-3 h-3" />
            Panduan
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Radial Gauge + Grade */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-background/50 border border-border/40">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted/30"
              />
              {!isCalibrating && (
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke={isInactive ? "#94a3b8" : meta.ringColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={`text-3xl font-black tracking-tight ${
                  isInactive ? "text-slate-300" : meta.textClass
                }`}
              >
                {isCalibrating ? "N/A" : ds.score?.toFixed(1)}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {isCalibrating ? `${ds.sampleSize}/${MIN_JOBS_FOR_RANK} Jobs` : "dari 100"}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-col items-center gap-1">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                isInactive
                  ? "bg-slate-500/15 border-slate-500/30 text-slate-300"
                  : `${meta.bgClass} ${meta.borderClass} ${meta.textClass}`
              }`}
            >
              {isCalibrating ? "Belum Terkalibrasi" : `${meta.shortLabel} — ${meta.label}`}
            </span>
            {!isCalibrating && ds.score !== null && (
              <div className="mt-1.5 flex flex-col items-center gap-1">
                <p className="text-[11px] text-muted-foreground">
                  {ds.grade === "S"
                    ? "Peringkat tertinggi tercapai"
                    : ds.grade === "A"
                      ? `+${(97 - ds.score).toFixed(1)} poin lagi ke Grade S`
                      : ds.grade === "B"
                        ? `+${(88 - ds.score).toFixed(1)} poin lagi ke Grade A`
                        : ds.grade === "C"
                          ? `+${(76 - ds.score).toFixed(1)} poin lagi ke Grade B`
                          : `+${(60 - ds.score).toFixed(1)} poin lagi ke Grade C`}
                </p>
                <Link
                  href="/kb/umum/panduan-driving-score"
                  className="text-[10px] font-bold text-primary/80 hover:text-primary hover:underline transition-colors"
                >
                  Cara hitung &amp; batas grade →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right: 4 Pillars Breakdown OR Calibration Progress */}
        <div className="lg:col-span-8 space-y-4">
          {isCalibrating ? (
            <div className="rounded-xl bg-background/50 border border-border/40 p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-foreground">Progres Kalibrasi Driving Score</span>
                <span className="text-primary">
                  {ds.sampleSize} / {MIN_JOBS_FOR_RANK} Pengiriman Selesai
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-muted/50 overflow-hidden border border-border/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400 transition-all"
                  style={{
                    width: `${Math.min(100, (ds.sampleSize / MIN_JOBS_FOR_RANK) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sistem membutuhkan minimal <strong>{MIN_JOBS_FOR_RANK} pengiriman selesai</strong> (Logistik
                Truck maupun Coaches Bus) untuk menghitung 4 pilar keselamatan mengemudi secara adil.
                Pembatalan job (Canceled) tidak memotong skor.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {pillars.map((p) => (
                <div
                  key={p.key}
                  className="rounded-xl bg-background/50 border border-border/40 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      {p.icon}
                      {p.label}
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        ({p.weight})
                      </span>
                    </span>
                    <span className="text-sm font-black text-foreground">
                      {p.score.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isInactive ? "bg-slate-400" : p.barClass}`}
                      style={{ width: `${Math.min(100, Math.max(0, p.score))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{p.detail}</p>
                </div>
              ))}
            </div>
          )}

          {/* Actionable Tip / Footer note (especially rich on Dashboard) */}
          {variant === "dashboard" && (
            <div className="rounded-xl bg-primary/8 border border-primary/20 px-4 py-3 flex items-start gap-2.5 text-xs text-foreground/90">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="leading-relaxed">{getCoachingTip(ds)}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
