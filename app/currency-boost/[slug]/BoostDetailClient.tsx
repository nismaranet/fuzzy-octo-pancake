"use client";

import {
  ArrowLeft,
  Trophy,
  Calendar,
  Gamepad2,
  Users,
  Zap,
  ShieldCheck,
  Truck,
  Bus,
  Award,
  Gauge,
  SignalHigh,
  CheckCircle,
  XCircle,
  Coins,
  Clock,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import UserBadges from "@/components/icons/UserBadges";
import DecoratedAvatar from "@/components/profile/DecoratedAvatar";

interface CurrentUserDrivingScore {
  score: number;
  grade: string;
  status: string;
}

export default function BoostDetailClient({
  event,
  currentUserDrivingScore = null,
}: {
  event: any;
  currentUserDrivingScore?: CurrentUserDrivingScore | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  const isExpired = event.endAt ? new Date() > new Date(event.endAt) : false;
  const isPending = event.isScheduled && new Date() < new Date(event.startDate);
  const statusActive = event.isActive && !isExpired && !isPending;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isPending || !event.startDate) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(event.startDate).getTime();
      const difference = target - now;

      if (difference <= 0) {
        window.location.reload(); 
        clearInterval(interval);
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        let text = "";
        if (days > 0) text += `${days} hari `;
        if (hours > 0) text += `${hours} jam `;
        if (minutes > 0) text += `${minutes} menit `;
        text += `${seconds} detik`;
        
        setTimeLeft(text);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPending, event.startDate]);

  const formatDate = (dateString: string | null) => {
    if (!mounted || !dateString) return "-";
    return (
      new Date(dateString).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }) + " WIB"
    );
  };

  const getGameName = (id: string) => {
    if (id === "1") return "Euro Truck Simulator 2";
    if (id === "2") return "American Truck Simulator";
    return "Semua Game";
  };

  const getTypeName = (type: string) => {
    if (type === "Singleplayer" || type === "Single Player") return "Singleplayer";
    if (type === "TruckersMP") return "TruckersMP";
    if (type === "HaulMP") return "HaulMP";
    if (type === "Convoy") return "Convoy";
    return "Semua Mode";
  };

  const getCategoryName = (jobCategory?: string) => {
    if (jobCategory === "truck") return "Logistics (Truck)";
    if (jobCategory === "coach") return "Coaches (Bus)";
    return "Semua Divisi (Truck & Coaches)";
  };

  const basePct = Math.round(Number(event.multiplier || 0) * 100);
  const dsBonus = event.drivingScoreBonus || {
    enabled: false,
    gradeABonus: 0.1,
    gradeSBonus: 0.2,
    requireRealMiles: true,
  };
  const gradeAPct = Math.round(Number(dsBonus.gradeABonus ?? 0.1) * 100);
  const gradeSPct = Math.round(Number(dsBonus.gradeSBonus ?? 0.2) * 100);

  const userIsRankedActive = currentUserDrivingScore?.status === "active";
  const userGrade = userIsRankedActive
    ? String(currentUserDrivingScore?.grade || "").toUpperCase()
    : null;
  const userExtraPct =
    dsBonus.enabled && userGrade === "S"
      ? gradeSPct
      : dsBonus.enabled && userGrade === "A"
        ? gradeAPct
        : 0;
  const userEffectivePct = basePct + userExtraPct;

  const totalEventBonus = event.participants.reduce(
    (sum: number, p: any) => sum + (p.totalEarned || 0),
    0,
  );

  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Navigation */}
      <Link
        href="/currency-boost"
        className="inline-flex items-center gap-2 text-accent-lilac hover:text-white transition-colors font-bold text-sm uppercase tracking-widest"
      >
        <ArrowLeft size={16} /> Kembali ke Currency Boost
      </Link>

      {/* Hero Header Section */}
      <div className="relative rounded-[3rem] overflow-hidden bg-card border border-border shadow-2xl group">
        <div className="absolute inset-0 z-0">
          <img
            src={event.imageUrl || "https://i.imgur.com/8Q0Zp0C.png"}
            alt={event.nameEvent}
            className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
        </div>

        <div className="relative z-10 p-8 md:p-12 lg:p-16 flex flex-col md:flex-row gap-8 items-start md:items-end justify-between">
          <div className="space-y-4 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              {isPending ? (
                <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                  <Clock size={14} /> Belum Dimulai
                </span>
              ) : statusActive ? (
                <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                  <CheckCircle size={14} /> Berjalan
                </span>
              ) : (
                <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <XCircle size={14} /> Berakhir
                </span>
              )}
              <span className="bg-accent-lilac/20 text-accent-lilac border border-accent-lilac/30 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck size={14} /> Official Event
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">
              {event.nameEvent}
            </h1>

            <div className="flex flex-wrap gap-3 text-sm font-bold text-gray-300">
              <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-2xl backdrop-blur-sm border border-white/10">
                <Gamepad2 className="text-accent-lilac" size={18} />
                <span>{getGameName(event.gameId)}</span>
              </div>
              <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-2xl backdrop-blur-sm border border-white/10">
                {event.jobCategory === "coach" ? (
                  <Bus className="text-teal-400" size={18} />
                ) : (
                  <Truck className="text-sky-400" size={18} />
                )}
                <span>{getCategoryName(event.jobCategory)}</span>
              </div>
              <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-2xl backdrop-blur-sm border border-white/10">
                <SignalHigh className="text-accent-lilac" size={18} />
                <span>{getTypeName(event.type)}</span>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 text-center bg-black/60 backdrop-blur-md border border-yellow-500/30 p-6 rounded-[2rem] shadow-[0_0_30px_rgba(234,179,8,0.2)]">
            <p className="text-yellow-500 font-black uppercase tracking-widest text-[10px] mb-2">
              {dsBonus.enabled ? "Bonus Dasar Event" : "Economy Surge"}
            </p>
            <div className="text-5xl md:text-6xl font-black text-white drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] flex items-center justify-center gap-2">
              <Zap className="text-yellow-500 fill-yellow-500" size={36} />
              +{basePct}%
            </div>
            <p className="text-gray-300 text-xs font-bold mt-2">
              {dsBonus.enabled
                ? `Hingga +${basePct + gradeSPct}% untuk Grade S`
                : "Bonus Penghasilan"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Info & Details Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border p-8 rounded-[2.5rem] shadow-xl relative z-20">
            {/* Watermark clipped inside its own isolated container */}
            <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
              <div className="absolute -top-10 -right-10 text-border opacity-20">
                <Calendar size={150} />
              </div>
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-6">
              Detail Waktu
            </h3>

            <div className="space-y-6 relative z-10">
              {isPending ? (
                <div>
                  <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Clock size={12} /> Dimulai Dalam
                  </p>
                  <p className="font-bold text-orange-200">
                    {timeLeft || "Menghitung..."}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    ({formatDate(event.startDate)})
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                    Dimulai Pada
                  </p>
                  <p className="font-bold text-gray-200">
                    {formatDate(event.setAt)}
                  </p>
                </div>
              )}
              <div className="h-px w-full bg-border" />
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                  Berakhir Pada
                </p>
                <p className="font-bold text-red-400">
                  {formatDate(event.endAt)}
                </p>
              </div>

              {event.organizer && (
                <>
                  <div className="h-px w-full bg-border" />
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <User size={12} /> Penyelenggara Event
                    </p>
                    <div className="flex items-center gap-3 bg-black/30 p-2.5 rounded-2xl border border-white/5 relative z-10 hover:z-50">
                      {event.organizer.truckyId ? (
                        <Link
                          href={`/profile/${event.organizer.truckyId}`}
                          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={`Lihat profil ${event.organizer.name || "Penyelenggara"}`}
                        >
                          {event.organizer.avatarUrl ? (
                            <DecoratedAvatar
                              src={event.organizer.avatarUrl}
                              alt={event.organizer.name}
                              decorationId={event.organizer.avatarDecoration || null}
                              isNismaraPlus={event.organizer.isNismaraPlus === true}
                              userRole={event.organizer.role}
                              topManager={event.organizer.topManager}
                              sizeClass="w-8 h-8"
                              frameClass="ring-2 ring-white/10 hover:ring-primary/60 transition-all"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">
                              <User size={14} />
                            </div>
                          )}
                        </Link>
                      ) : event.organizer.avatarUrl ? (
                        <DecoratedAvatar
                          src={event.organizer.avatarUrl}
                          alt={event.organizer.name}
                          decorationId={event.organizer.avatarDecoration || null}
                          isNismaraPlus={event.organizer.isNismaraPlus === true}
                          userRole={event.organizer.role}
                          topManager={event.organizer.topManager}
                          sizeClass="w-8 h-8"
                          frameClass="ring-2 ring-white/10"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs shrink-0">
                          <User size={14} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {event.organizer.truckyId ? (
                            <Link
                              href={`/profile/${event.organizer.truckyId}`}
                              className="font-bold text-white text-sm truncate hover:underline hover:text-primary transition-colors"
                            >
                              {event.organizer.name || "Management Nismara"}
                            </Link>
                          ) : (
                            <span className="font-bold text-white text-sm truncate">
                              {event.organizer.name || "Management Nismara"}
                            </span>
                          )}
                          <UserBadges
                            role={event.organizer.role}
                            isBooster={event.organizer.isBooster}
                            isNismaraPlus={event.organizer.isNismaraPlus}
                            nismaraPlusStartedAt={event.organizer.nismaraPlusStartedAt}
                            truckyRank={event.organizer.truckyRank}
                            topManager={event.organizer.topManager}
                            tooltipPlacement="top"
                            className="w-3.5 h-3.5"
                          />
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {event.organizer.role === "admin"
                            ? "Administrator"
                            : event.organizer.role === "manager"
                            ? "Event Manager"
                            : "Management Staff"}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Driving Score Tier & Personal Boost Card */}
          {dsBonus.enabled && (
            <div className="bg-card border border-emerald-500/30 p-6 md:p-7 rounded-[2.5rem] shadow-xl space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500 dark:text-emerald-400">
                  <Award size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground tracking-tight">
                    Bonus Driving Score
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Extra boost otomatis untuk driver dengan grade tinggi
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-muted/40 border border-border/60 text-sm">
                  <span className="font-semibold text-muted-foreground">Semua Driver</span>
                  <span className="font-black text-foreground tabular-nums">+{basePct}% NC</span>
                </div>
                <div
                  className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border text-sm ${
                    userGrade === "A"
                      ? "bg-sky-500/15 border-sky-500/50"
                      : "bg-sky-500/5 border-sky-500/20"
                  }`}
                >
                  <div>
                    <span className="font-bold text-foreground block">Grade A (Aktif)</span>
                    <span className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
                      Base +{basePct}% + Extra +{gradeAPct}%
                    </span>
                  </div>
                  <span className="font-black text-sky-600 dark:text-sky-400 tabular-nums">
                    +{basePct + gradeAPct}% NC
                  </span>
                </div>
                <div
                  className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border text-sm ${
                    userGrade === "S"
                      ? "bg-emerald-500/15 border-emerald-500/50"
                      : "bg-emerald-500/5 border-emerald-500/20"
                  }`}
                >
                  <div>
                    <span className="font-bold text-foreground block">Grade S (Aktif)</span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Base +{basePct}% + Extra +{gradeSPct}%
                    </span>
                  </div>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    +{basePct + gradeSPct}% NC
                  </span>
                </div>
              </div>

              {dsBonus.requireRealMiles && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-foreground/90 leading-relaxed">
                  <Gauge size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <p>
                    Extra boost Grade A dan S hanya berlaku pada pengiriman{" "}
                    <strong className="text-foreground">Real Miles</strong>. Pengiriman Race Miles tetap mendapatkan Base Boost (+{basePct}%).
                  </p>
                </div>
              )}

              {currentUserDrivingScore && (
                <div className="pt-3 border-t border-border/60 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Simulasi Boost Anda Saat Ini
                  </p>
                  {userExtraPct > 0 ? (
                    <div className="px-4 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/35">
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        Total Boost Anda: +{userEffectivePct}% NC
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Driving Score Anda Grade {userGrade} ({currentUserDrivingScore.score.toFixed(1)}) berstatus Aktif.
                      </p>
                    </div>
                  ) : (
                    <div className="px-4 py-3 rounded-2xl bg-muted/40 border border-border/60">
                      <p className="text-sm font-bold text-foreground">
                        Boost Anda: +{basePct}% NC (Base)
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {userIsRankedActive
                          ? `Grade Anda saat ini ${currentUserDrivingScore.grade} (${currentUserDrivingScore.score.toFixed(1)}). Tingkatkan ke Grade A (+${gradeAPct}%) atau Grade S (+${gradeSPct}%).`
                          : "Status Driving Score Anda belum Aktif. Selesaikan minimal 5 job dalam 30 hari terakhir untuk membuka extra boost."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="bg-accent-lilac/10 border border-accent-lilac/20 p-8 rounded-[2.5rem] shadow-xl text-center">
            <h3 className="text-xl font-black text-accent-lilac uppercase tracking-tight mb-4">
              Cara Berpartisipasi
            </h3>
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
              Mainkan{" "}
              <strong className="text-foreground">
                {getGameName(event.gameId)}
              </strong>{" "}
              pada divisi{" "}
              <strong className="text-foreground">
                {getCategoryName(event.jobCategory)}
              </strong>{" "}
              dengan mode{" "}
              <strong className="text-foreground">{getTypeName(event.type)}</strong>{" "}
              selama periode event berlangsung. Setiap job yang valid otomatis memperoleh bonus dasar +{basePct}% NC
              {dsBonus.enabled
                ? ` dan tambahan hingga +${gradeSPct}% NC untuk driver Grade S Aktif.`
                : "."}
            </p>
          </div>
        </div>

        {/* Leaderboard Panel */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border p-6 md:p-8 rounded-[2.5rem] shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                <Trophy className="text-yellow-500" size={28} /> Leaderboard
                Partisipan
              </h3>
              <div className="flex items-center gap-2">
                <div className="bg-black/50 px-4 py-2 rounded-2xl flex items-center gap-2 border border-border">
                  <Coins className="text-yellow-500" size={16} />
                  <span className="text-sm font-bold text-green-400">
                    + {totalEventBonus.toLocaleString("id-ID")} NC
                  </span>
                </div>
                <div className="bg-black/50 px-4 py-2 rounded-2xl flex items-center gap-2 border border-border">
                  <Users className="text-gray-400" size={16} />
                  <span className="text-sm font-bold text-gray-200">
                    {event.participants.length} Driver
                  </span>
                </div>
              </div>
            </div>

            {event.participants.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-border rounded-3xl">
                <Truck className="mx-auto text-gray-600 mb-4" size={48} />
                <p className="text-gray-400 font-bold uppercase tracking-widest">
                  Belum ada data partisipan
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  Selesaikan job untuk mulai muncul di leaderboard ini.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {event.participants.map((p: any, idx: number) => (
                  <div
                    key={p.discordId}
                    className={`flex items-center gap-4 p-4 rounded-2xl transition-colors relative z-10 hover:z-50 ${idx < 3 ? "bg-gradient-to-r from-accent-lilac/10 to-transparent border border-accent-lilac/20" : "bg-black/20 hover:bg-black/40 border border-transparent"}`}
                  >
                    {/* Rank Number */}
                    <div
                      className={`w-8 font-black text-xl text-center ${idx === 0 ? "text-yellow-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-amber-600" : "text-gray-600"}`}
                    >
                      #{idx + 1}
                    </div>

                    {/* Avatar & Info */}
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className="relative shrink-0">
                        {p.truckyId ? (
                          <Link
                            href={`/profile/${p.truckyId}`}
                            className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label={`Lihat profil ${p.name}`}
                          >
                            <DecoratedAvatar
                              src={p.avatarUrl}
                              alt={p.name}
                              decoration={p.avatarDecorationDef || null}
                              forcePreview
                              sizeClass="w-10 h-10"
                              frameClass="ring-2 ring-background hover:ring-primary/60 transition-all"
                            />
                          </Link>
                        ) : (
                          <DecoratedAvatar
                            src={p.avatarUrl}
                            alt={p.name}
                            decoration={p.avatarDecorationDef || null}
                            forcePreview
                            sizeClass="w-10 h-10"
                            frameClass="ring-2 ring-background"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {p.truckyId ? (
                            <Link
                              href={`/profile/${p.truckyId}`}
                              className="font-bold text-white text-sm hover:underline hover:text-primary transition-colors truncate max-w-[160px] sm:max-w-[240px]"
                            >
                              {p.name}
                            </Link>
                          ) : (
                            <h4 className="font-bold text-white text-sm truncate max-w-[160px] sm:max-w-[240px]">
                              {p.name}
                            </h4>
                          )}
                          <UserBadges
                            role={p.role}
                            isBooster={p.isBooster}
                            isNismaraPlus={p.isNismaraPlus}
                            nismaraPlusStartedAt={p.nismaraPlusStartedAt}
                            truckyRank={p.truckyRank}
                            topManager={p.topManager}
                            className="w-4 h-4"
                          />
                        </div>
                        <p className="text-xs text-gray-500">
                          Bergabung: {formatDate(p.joinedAt)}
                          {p.jobsCount > 0 ? ` • ${p.jobsCount} job` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Earnings */}
                    <div className="text-right">
                      <p className="text-green-400 font-black flex items-center justify-end gap-1 tabular-nums">
                        +{" "}
                        {p.totalEarned.toLocaleString("id-ID", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}{" "}
                        NC
                      </p>
                      {p.gradeBonusEarned > 0 ? (
                        <p className="text-[10px] text-emerald-400 font-semibold tabular-nums">
                          Termasuk +{p.gradeBonusEarned.toLocaleString("id-ID")} NC Grade
                        </p>
                      ) : (
                        <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
                          Total Bonus
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
