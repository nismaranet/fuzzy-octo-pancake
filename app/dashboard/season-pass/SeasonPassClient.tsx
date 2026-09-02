"use client";

import React, { useState, useMemo } from "react";
import {
  Trophy,
  Crown,
  Sparkles,
  Flame,
  Zap,
  Lock,
  CheckCircle2,
  Coins,
  Fuel,
  Shield,
  Ticket,
  Truck,
  Wrench,
  Clock,
  Gift,
  Download,
  Star,
  Info,
  X,
  ChevronRight,
  CreditCard,
  Send,
  ExternalLink,
  MessageSquare,
  Package,
} from "lucide-react";
import { showAlert } from "@/lib/dialog";
import { useRouter } from "next/navigation";

interface RewardItem {
  type: string;
  title: string;
  description?: string;
  amount?: number;
  voucherCategory?: string;
  voucherDiscountType?: string;
  voucherDiscountValue?: number;
  voucherDurationHours?: number;
  badgeId?: string;
}

interface SeasonLevel {
  level: number;
  xpRequired: number;
  cumulativeXp: number;
  freeRewards: RewardItem[];
  premiumRewards: RewardItem[];
}

export default function SeasonPassClient({
  initialSeason,
  initialProgress,
  initialWeekInfo,
  initialPendingOrder = null,
  initialMerchClaim = null,
  guildId = "863959415702028318",
  isSeasonActive = true,
}: {
  initialSeason: any;
  initialProgress: any;
  initialWeekInfo: any;
  initialPendingOrder?: any;
  initialMerchClaim?: any;
  guildId?: string;
  isSeasonActive?: boolean;
}) {
  const router = useRouter();
  const [season] = useState<any>(initialSeason);
  const [progress, setProgress] = useState<any>(initialProgress);
  const [weekInfo] = useState<any>(initialWeekInfo);
  const [pendingOrder, setPendingOrder] = useState<any>(initialPendingOrder);
  const [merchClaim, setMerchClaim] = useState<any>(
    initialMerchClaim || initialProgress?.merchClaim || null
  );

  const [activeTierFilter, setActiveTierFilter] = useState<"ALL" | "T1" | "T2" | "T3">("ALL");
  const [isClaiming, setIsClaiming] = useState<string | null>(null);
  const [isClaimingAll, setIsClaimingAll] = useState(false);
  const [selectedLevelModal, setSelectedLevelModal] = useState<SeasonLevel | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [showArchiveTrack, setShowArchiveTrack] = useState(false);

  // In-app Merchandise Claim Form State
  const [showMerchClaimModal, setShowMerchClaimModal] = useState(false);
  const [isSubmittingMerchClaim, setIsSubmittingMerchClaim] = useState(false);
  const [merchFormData, setMerchFormData] = useState({
    recipientName: "",
    recipientPhone: "",
    recipientAddress: "",
    shippingNotes: "",
  });

  const userXp = progress?.currentXp || 0;
  const isPremium = progress?.isPremium || false;

  // Level tertinggi yang telah tuntas & terbuka berdasarkan akumulasi XP
  const unlockedLevel = useMemo(() => {
    if (!season?.levels) return 0;
    let unlocked = 0;
    for (const lvl of season.levels) {
      if (userXp >= lvl.cumulativeXp) {
        unlocked = lvl.level;
      } else {
        break;
      }
    }
    return unlocked;
  }, [season, userXp]);

  // Level yang sedang ditempuh (1-30)
  const userLevel = Math.min(30, unlockedLevel + (unlockedLevel < 30 ? 1 : 0));

  const handleSubmitMerchClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !merchFormData.recipientName.trim() ||
      !merchFormData.recipientPhone.trim() ||
      !merchFormData.recipientAddress.trim()
    ) {
      await showAlert("Mohon lengkapi semua kolom bertanda bintang (*).");
      return;
    }

    setIsSubmittingMerchClaim(true);
    try {
      const res = await fetch("/api/season-pass/claim-merch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonNumber: season?.seasonNumber || 1,
          ...merchFormData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirimkan formulir klaim merchandise");
      }

      setMerchClaim(data.merchClaim);
      setShowMerchClaimModal(false);
      await showAlert(
        data.message ||
          "Data pengiriman berhasil dikirim! Channel Discord tiket telah dibuat untuk konfirmasi ongkir & resi bersama Owner & Developer."
      );
      router.refresh();
    } catch (err: any) {
      await showAlert(`Gagal: ${err.message}`);
    } finally {
      setIsSubmittingMerchClaim(false);
    }
  };

  // Levels for current tier filter
  const displayedLevels = useMemo(() => {
    if (!season?.levels) return [];
    if (activeTierFilter === "T1") return season.levels.filter((l: SeasonLevel) => l.level <= 10);
    if (activeTierFilter === "T2") return season.levels.filter((l: SeasonLevel) => l.level >= 11 && l.level <= 20);
    if (activeTierFilter === "T3") return season.levels.filter((l: SeasonLevel) => l.level >= 21 && l.level <= 30);
    return season.levels;
  }, [season, activeTierFilter]);

  // Next level XP calculations
  const nextLevelConfig = season?.levels?.find((l: SeasonLevel) => l.level === userLevel);
  const prevLevelCumulative = userLevel > 1 ? season?.levels?.find((l: SeasonLevel) => l.level === userLevel - 1)?.cumulativeXp || 0 : 0;
  const xpInCurrentLevel = Math.max(0, userXp - prevLevelCumulative);
  const xpNeededForCurrentLevel = nextLevelConfig?.xpRequired || 1;
  const levelProgressPercent = unlockedLevel >= 30 ? 100 : Math.min(100, Math.round((xpInCurrentLevel / xpNeededForCurrentLevel) * 100));

  // Count available unclaimed rewards up to unlockedLevel
  const unclaimedCount = useMemo(() => {
    if (!season?.levels || !progress || unlockedLevel === 0) return 0;
    let count = 0;
    for (let lvl = 1; lvl <= unlockedLevel; lvl++) {
      if (!progress.claimedFreeLevels?.includes(lvl)) count++;
      if (isPremium && !progress.claimedPremiumLevels?.includes(lvl)) count++;
    }
    return count;
  }, [season, progress, unlockedLevel, isPremium]);

  const isGracePeriod = !isSeasonActive && unclaimedCount > 0;
  const isOffSeason = !isSeasonActive && unclaimedCount === 0;

  const handleClaim = async (level: number, track: "free" | "premium") => {
    setIsClaiming(`${level}-${track}`);
    try {
      const res = await fetch("/api/season-pass/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, track, seasonNumber: season.seasonNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengklaim hadiah");
      }

      setProgress(data.progress);
      await showAlert(data.result?.message || "Hadiah berhasil diklaim!");
      router.refresh();
    } catch (err: any) {
      await showAlert(`Gagal: ${err.message}`);
    } finally {
      setIsClaiming(null);
    }
  };

  const handleClaimAll = async () => {
    setIsClaimingAll(true);
    try {
      const res = await fetch("/api/season-pass/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimAll: true, seasonNumber: season.seasonNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengklaim semua hadiah");
      }

      setProgress(data.progress);
      await showAlert(
        `🎉 Berhasil mengklaim ${data.result?.totalClaimedCount || 0} hadiah sekaligus!\n\n${data.result?.claimedResults?.slice(0, 6).join("\n")}${
          data.result?.claimedResults?.length > 6 ? `\n...dan ${data.result?.claimedResults?.length - 6} hadiah lainnya` : ""
        }`
      );
      router.refresh();
    } catch (err: any) {
      await showAlert(`Gagal: ${err.message}`);
    } finally {
      setIsClaimingAll(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!isSeasonActive) {
      await showAlert("Musim telah berakhir. Pembelian Nismara Pass untuk season ini telah ditutup.");
      return;
    }
    setIsCreatingOrder(true);
    try {
      const res = await fetch("/api/season-pass/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonNumber: season.seasonNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat pesanan Nismara Pass");
      }

      if (data.order) {
        setPendingOrder(data.order);
      }

      setShowBuyModal(false);
      await showAlert(
        `🎉 ${data.message || "Pesanan berhasil dibuat!"}\n\nSilakan selesaikan pembayaran dan koordinasi bukti transfer di channel Discord Anda.`
      );
      router.refresh();
    } catch (err: any) {
      await showAlert(`Gagal: ${err.message}`);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const getRewardIcon = (r: RewardItem, size: string = "w-4 h-4") => {
    switch (r.type) {
      case "NC":
        return <Coins className={`text-amber-400 ${size}`} />;
      case "FUEL":
        return <Fuel className={`text-cyan-400 ${size}`} />;
      case "SAFEBOX_TICKET":
        return <Shield className={`text-purple-400 ${size}`} />;
      case "VOUCHER":
        if (r.voucherCategory === "NC_BOOSTER") return <Zap className={`text-amber-400 ${size}`} />;
        if (r.voucherCategory === "FLEET_MAINTENANCE") return <Wrench className={`text-emerald-400 ${size}`} />;
        return <Truck className={`text-teal-400 ${size}`} />;
      case "NPLUS_TRIAL":
        return <Crown className={`text-emerald-400 ${size}`} />;
      case "BADGE":
        return <Trophy className={`text-amber-400 ${size}`} />;
      case "MOD_LIVERY":
      case "DOWNLOADABLE":
        return <Download className={`text-yellow-400 ${size}`} />;
      case "PHYSICAL_MERCH":
      case "PHYSICAL":
        return <Package className={`text-purple-400 ${size}`} />;
      case "DISCORD_ROLE":
        return <Star className={`text-indigo-400 ${size}`} />;
      default:
        return <Gift className={`text-blue-400 ${size}`} />;
    }
  };

  const discordChannelUrl = pendingOrder?.channelId
    ? `https://discord.com/channels/${guildId}/${pendingOrder.channelId}`
    : null;

  // OFF-SEASON HIBERNATION VIEW
  if (isOffSeason && !showArchiveTrack) {
    return (
      <div className="space-y-8 pb-16 animate-in fade-in duration-500">
        {/* Off-Season Hero Banner */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-card via-card/95 to-amber-500/10 border border-border p-8 md:p-14 shadow-2xl backdrop-blur-xl text-center space-y-6">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-widest">
            <Clock size={14} /> Off-Season • Jeda Antara Musim
          </div>

          <div className="max-w-2xl mx-auto space-y-3">
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground uppercase">
              Nismara Pass <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300">Off-Season</span>
            </h1>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
              Musim kompetisi Nismara Pass saat ini telah resmi berakhir. Manajemen dan Developer Nismara sedang mempersiapkan Season baru dengan tema baru, quest logistik spesial, serta hadiah eksklusif yang lebih spektakuler!
            </p>
          </div>

          {/* Previous Season Personal Hall of Fame */}
          <div className="pt-4 max-w-3xl mx-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-3">
              Pencapaian Pribadi Anda Pada Musim Terakhir (Season {season?.seasonNumber || 1})
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
              <div className="p-4 rounded-2xl bg-black/30 border border-border">
                <span className="text-[9px] font-black text-muted-foreground uppercase">Level Puncak</span>
                <p className="text-xl font-black text-foreground tabular-nums mt-0.5">Level {userLevel} / 30</p>
              </div>
              <div className="p-4 rounded-2xl bg-black/30 border border-border">
                <span className="text-[9px] font-black text-muted-foreground uppercase">Total XP Musim</span>
                <p className="text-xl font-black text-amber-400 tabular-nums mt-0.5">{userXp.toLocaleString("id-ID")} XP</p>
              </div>
              <div className="p-4 rounded-2xl bg-black/30 border border-border">
                <span className="text-[9px] font-black text-muted-foreground uppercase">Status Pass</span>
                <p className="text-base font-black text-purple-400 mt-0.5">{isPremium ? "Nismara Pass Premium" : "Free Track"}</p>
              </div>
              <div className="p-4 rounded-2xl bg-black/30 border border-border">
                <span className="text-[9px] font-black text-emerald-400 uppercase">Status Hadiah</span>
                <p className="text-sm font-black text-emerald-400 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 size={16} /> Tuntas Diklaim
                </p>
              </div>
            </div>
          </div>

          {/* Discord Announcement CTA & Links */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={`https://discord.com/channels/${guildId}`}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-6 py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              <MessageSquare size={16} /> Pantau Pengumuman di Discord
            </a>
            <button
              onClick={() => setShowArchiveTrack(true)}
              className="w-full sm:w-auto px-6 py-3.5 bg-card border border-border hover:border-primary/40 text-foreground font-bold text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              <Trophy size={16} /> Lihat Arsip Hadiah Musim Lalu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Return to Off-Season Banner Button if viewing archive */}
      {showArchiveTrack && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-border">
          <span className="text-xs font-bold text-muted-foreground">
            Anda sedang melihat <strong className="text-foreground">Arsip Hadiah Season {season?.seasonNumber || 1}</strong>
          </span>
          <button
            onClick={() => setShowArchiveTrack(false)}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-foreground text-xs font-bold uppercase tracking-wider transition-colors"
          >
            ⬅ Kembali ke Off-Season
          </button>
        </div>
      )}

      {/* Grace Period Vault Claim Alert */}
      {isGracePeriod && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/20 via-card to-emerald-500/10 border-2 border-amber-500/60 p-6 md:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider">
              <Sparkles size={13} /> Masa Tenggang Klaim • Season {season?.seasonNumber || 1} Telah Selesai
            </div>
            <h3 className="text-xl md:text-2xl font-black text-foreground uppercase tracking-tight">
              Klaim Sisa Hadiah Season Anda ({unclaimedCount} Hadiah Tersedia)
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Musim kompetisi telah resmi ditutup, namun Anda masih berhak mengambil seluruh reward dari level yang telah Anda capai. Segera klaim seluruh hadiah sebelum database diarsipkan!
            </p>
          </div>

          <button
            disabled={isClaimingAll}
            onClick={handleClaimAll}
            className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 hover:scale-105"
          >
            <Zap size={16} className="fill-black" /> {isClaimingAll ? "Mengklaim Semua..." : `Klaim Semua (${unclaimedCount} Hadiah)`}
          </button>
        </div>
      )}

      {/* 1. Header Banner & Status */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-950/40 via-card/90 to-amber-950/30 border border-amber-500/30 p-6 md:p-10 shadow-2xl backdrop-blur-xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          {/* Left Info */}
          <div className="space-y-4 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider">
                <Trophy size={14} /> {season?.title || "Season 1: Pioneer of Asphalt"}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-card/80 border border-border text-muted-foreground text-xs font-semibold">
                <Clock size={13} /> {isSeasonActive ? `Sisa ${weekInfo?.daysRemaining || 90} Hari` : "Musim Selesai (Off-Season)"}
              </span>
              {isSeasonActive && weekInfo?.isFinalRush && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-black uppercase tracking-wider animate-pulse">
                  <Flame size={13} /> Final Rush: 2x Pass XP!
                </span>
              )}
            </div>

            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground flex items-center gap-3">
                Nismara Pass <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300">Season {season?.seasonNumber || 1}</span>
              </h1>
              <p className="text-muted-foreground text-sm md:text-base mt-2 leading-relaxed">
                Narik job di game untuk mengumpulkan Seasonal XP, menaikkan level, dan membuka 30 level hadiah eksklusif NC, Fuel, Kupon Servis, NC Booster, dan Mod Livery!
              </p>
            </div>

            {/* Current Level & XP Bar */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider">
                    Level {userLevel}
                  </span>
                  <span className="text-muted-foreground">
                    {userLevel >= 30 ? "Maksimal (Tamat)" : `Level Berikutnya: Level ${userLevel + 1}`}
                  </span>
                </div>
                <span className="text-foreground font-mono">
                  {userXp.toLocaleString("id-ID")} / {season?.totalXp?.toLocaleString("id-ID") || "225.000"} Total XP
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-3.5 w-full bg-card/80 border border-border/80 rounded-full overflow-hidden p-0.5 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-300 rounded-full transition-all duration-500 shadow-md shadow-amber-500/20"
                  style={{ width: `${levelProgressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Right Status & Actions */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-4 shrink-0 justify-center">
            {/* Pass Track Status Card */}
            <div className={`p-5 rounded-2xl border backdrop-blur-md flex items-center justify-between gap-4 ${
              isPremium
                ? "bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-amber-950/30 border-amber-500/40 shadow-lg shadow-amber-500/10"
                : "bg-card/70 border-border/70"
            }`}>
              <div className="flex items-center gap-3.5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${
                  isPremium
                    ? "bg-gradient-to-br from-amber-400 to-orange-500 text-black shadow-md shadow-amber-500/30"
                    : "bg-muted text-muted-foreground"
                }`}>
                  <Crown size={24} className={isPremium ? "fill-black" : ""} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Status Pass Anda
                  </p>
                  <p className="text-base font-black text-foreground">
                    {isPremium ? "Nismara Pass Premium" : "Free Track (Gratis)"}
                  </p>
                </div>
              </div>

              {!isPremium && (
                !isSeasonActive ? (
                  <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-border text-muted-foreground text-[10px] font-bold uppercase">
                    Musim Selesai
                  </span>
                ) : discordChannelUrl ? (
                  <a
                    href={discordChannelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-amber-500/20 flex items-center gap-1.5 animate-pulse"
                  >
                    <ExternalLink size={14} />
                    Lanjutkan Order
                  </a>
                ) : (
                  <button
                    onClick={() => setShowBuyModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-amber-500/20 flex items-center gap-1.5"
                  >
                    <Crown size={14} className="fill-black" />
                    Beli Pass
                  </button>
                )
              )}
            </div>

            {/* Weekly Cap & Claim All Widget */}
            <div className="flex items-center gap-3">
              <div className="flex-1 p-3.5 bg-card/60 border border-border/50 rounded-xl">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Zap size={11} className="text-amber-400" /> Kuota XP Mingguan
                  {isPremium && (
                    <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-black text-[9px] uppercase border border-amber-500/30">
                      2x Limit
                    </span>
                  )}
                </p>
                <p className="text-xs font-black text-foreground mt-0.5">
                  {weekInfo?.isFinalRush
                    ? "Bebas (Uncapped)"
                    : `Minggu ${weekInfo?.currentWeekNumber || 1} (${weekInfo?.serverCumulativeCapXp?.toLocaleString("id-ID")} XP)`}
                </p>
              </div>

              {unclaimedCount > 0 && (
                <button
                  onClick={handleClaimAll}
                  disabled={isClaimingAll}
                  className="px-5 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 animate-pulse disabled:opacity-50"
                >
                  <Gift size={16} className="fill-black" />
                  <span>{isClaimingAll ? "Mengklaim..." : `Klaim Semua (${unclaimedCount})`}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Controls & Tier Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center p-1 bg-card/60 border border-border/50 rounded-xl w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTierFilter("ALL")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTierFilter === "ALL"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Semua (1–30)
          </button>
          <button
            onClick={() => setActiveTierFilter("T1")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTierFilter === "T1"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tier 1 (1–10)
          </button>
          <button
            onClick={() => setActiveTierFilter("T2")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTierFilter === "T2"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tier 2 (11–20)
          </button>
          <button
            onClick={() => setActiveTierFilter("T3")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTierFilter === "T3"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tier 3 (21–30)
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> Terbuka
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 ml-2" /> Siap Klaim
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-muted-foreground/40 ml-2" /> Terkunci
        </div>
      </div>

      {/* 3. The 30-Level Battle Pass Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {displayedLevels.map((lvlConfig: SeasonLevel) => {
          const isUnlocked = userXp >= lvlConfig.cumulativeXp;
          const isCurrentLevel = userLevel === lvlConfig.level && !isUnlocked;
          const isClaimedFree = progress?.claimedFreeLevels?.includes(lvlConfig.level);
          const isClaimedPremium = progress?.claimedPremiumLevels?.includes(lvlConfig.level);
          const isMilestone = lvlConfig.level === 10 || lvlConfig.level === 20 || lvlConfig.level === 30;

          const primaryFree = lvlConfig.freeRewards[0];
          const extraFreeCount = lvlConfig.freeRewards.length - 1;

          const primaryPremium = lvlConfig.premiumRewards[0];
          const extraPremiumCount = lvlConfig.premiumRewards.length - 1;

          return (
            <div
              key={lvlConfig.level}
              onClick={() => setSelectedLevelModal(lvlConfig)}
              className={`relative overflow-hidden rounded-2xl border transition-all duration-300 flex flex-col justify-between cursor-pointer hover:scale-[1.01] hover:shadow-xl group ${
                isCurrentLevel
                  ? "border-amber-400/80 bg-gradient-to-b from-card via-card to-amber-950/20 shadow-xl shadow-amber-500/10 ring-2 ring-amber-400/40"
                  : isUnlocked
                  ? "border-border/80 bg-card/80 shadow-md hover:border-amber-500/40"
                  : "border-border/30 bg-card/30 opacity-75 hover:opacity-90"
              }`}
            >
              {/* Level Header Indicator */}
              <div className={`px-3.5 py-2.5 border-b flex items-center justify-between ${
                isMilestone
                  ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/40"
                  : isUnlocked
                  ? "bg-muted/40 border-border/40"
                  : "bg-muted/10 border-border/20"
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                    isUnlocked
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {lvlConfig.level}
                  </span>
                  <span className="text-[11px] font-bold text-foreground">
                    {lvlConfig.level === 30 ? "Grand Finale" : `Level ${lvlConfig.level}`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-semibold text-muted-foreground">
                    {lvlConfig.cumulativeXp.toLocaleString("id-ID")} XP
                  </span>
                  <div className="p-1 rounded-md text-muted-foreground group-hover:text-amber-400 transition">
                    <Info size={13} />
                  </div>
                </div>
              </div>

              {/* Reward Tracks Container */}
              <div className="p-3 space-y-3 flex-1 flex flex-col justify-between">
                {/* Free Track Box */}
                <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30 flex flex-col justify-between h-[120px]">
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      <span>Free Track</span>
                      {isClaimedFree ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-bold">
                          <CheckCircle2 size={11} /> Diklaim
                        </span>
                      ) : extraFreeCount > 0 ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                          +{extraFreeCount} Hadiah Lagi
                        </span>
                      ) : null}
                    </div>

                    {/* Primary Free Item */}
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-card border border-border/60 flex items-center justify-center shrink-0">
                        {getRewardIcon(primaryFree, "w-3.5 h-3.5")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate" title={primaryFree.title}>
                          {primaryFree.title}
                        </p>
                        {extraFreeCount > 0 && (
                          <p className="text-[10px] text-emerald-400 font-semibold truncate flex items-center gap-0.5 mt-0.5">
                            <span>+{extraFreeCount} item lainnya</span>
                            <ChevronRight size={10} />
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {isUnlocked && !isClaimedFree ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClaim(lvlConfig.level, "free");
                      }}
                      disabled={isClaiming === `${lvlConfig.level}-free`}
                      className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-[11px] uppercase tracking-wider rounded-lg transition shadow-sm"
                    >
                      {isClaiming === `${lvlConfig.level}-free` ? "Mengklaim..." : "Klaim Gratis"}
                    </button>
                  ) : (
                    <div className="text-[10px] text-center text-muted-foreground/60 py-1 font-semibold">
                      {isClaimedFree ? "Hadiah Telah Diambil" : "Klik Untuk Detail"}
                    </div>
                  )}
                </div>

                {/* Premium Track Box */}
                <div className={`p-2.5 rounded-xl border flex flex-col justify-between h-[120px] relative overflow-hidden ${
                  isPremium
                    ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30"
                    : "bg-muted/10 border-border/20 opacity-85"
                }`}>
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      <span className="text-amber-400 flex items-center gap-1">
                        <Crown size={10} className="fill-amber-400" /> Premium
                      </span>
                      {isClaimedPremium ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-bold">
                          <CheckCircle2 size={11} /> Diklaim
                        </span>
                      ) : extraPremiumCount > 0 ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                          +{extraPremiumCount} Hadiah Lagi
                        </span>
                      ) : !isPremium ? (
                        <span className="text-muted-foreground flex items-center gap-0.5">
                          <Lock size={10} /> Terkunci
                        </span>
                      ) : null}
                    </div>

                    {/* Primary Premium Item */}
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-card/80 border border-amber-500/40 flex items-center justify-center shrink-0">
                        {getRewardIcon(primaryPremium, "w-3.5 h-3.5")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate" title={primaryPremium.title}>
                          {primaryPremium.title}
                        </p>
                        {extraPremiumCount > 0 && (
                          <p className="text-[10px] text-amber-400 font-semibold truncate flex items-center gap-0.5 mt-0.5">
                            <span>+{extraPremiumCount} item lainnya</span>
                            <ChevronRight size={10} />
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {isUnlocked && isPremium && !isClaimedPremium ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClaim(lvlConfig.level, "premium");
                      }}
                      disabled={isClaiming === `${lvlConfig.level}-premium`}
                      className="w-full py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-black text-[11px] uppercase tracking-wider rounded-lg transition shadow-sm"
                    >
                      {isClaiming === `${lvlConfig.level}-premium` ? "Mengklaim..." : "Klaim Premium"}
                    </button>
                  ) : isUnlocked && !isPremium ? (
                    discordChannelUrl ? (
                      <a
                        href={discordChannelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full py-1.5 bg-card border border-amber-500/40 hover:bg-amber-500/10 text-amber-400 font-bold text-[10px] uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-1"
                      >
                        <ExternalLink size={10} /> Lanjutkan Order
                      </a>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowBuyModal(true);
                        }}
                        className="w-full py-1.5 bg-card border border-amber-500/40 hover:bg-amber-500/10 text-amber-400 font-bold text-[10px] uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-1"
                      >
                        <Lock size={10} /> Beli Pass
                      </button>
                    )
                  ) : (
                    <div className="text-[10px] text-center text-muted-foreground/60 py-1 font-semibold">
                      {isClaimedPremium ? "Hadiah Telah Diambil" : "Klik Untuk Detail"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Grand Prize Level 30 Showcase */}
      {(() => {
        const isPhysicalGrandPrize =
          season?.grandPrize?.type === "PHYSICAL_MERCH" || season?.grandPrize?.type === "PHYSICAL";

        return (
          <div
            className={`relative overflow-hidden rounded-3xl border p-6 md:p-8 backdrop-blur-xl shadow-xl transition ${
              isPhysicalGrandPrize
                ? "bg-gradient-to-r from-purple-950/40 via-card to-pink-950/40 border-purple-500/40"
                : "bg-gradient-to-r from-amber-950/40 via-card to-orange-950/40 border-amber-500/40"
            }`}
          >
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex items-start md:items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 ${
                    isPhysicalGrandPrize
                      ? "bg-gradient-to-br from-purple-500 to-pink-600 shadow-purple-500/30"
                      : "bg-gradient-to-br from-amber-400 to-orange-500 text-black shadow-amber-500/30"
                  }`}
                >
                  {isPhysicalGrandPrize ? (
                    <Package size={32} className="text-white" />
                  ) : (
                    <Trophy size={32} className="fill-black text-black" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                        isPhysicalGrandPrize
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      }`}
                    >
                      <Star size={12} className={isPhysicalGrandPrize ? "fill-purple-300" : "fill-amber-300"} />
                      Hadiah Puncak Level 30
                    </span>
                    {isPhysicalGrandPrize ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold uppercase tracking-wider">
                        <Package size={11} /> Merchandise Fisik (Dikirim ke Rumah)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                        <Download size={11} /> Downloadable Content (Mod File)
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
                    {season?.grandPrize?.title || (isPhysicalGrandPrize ? "Merchandise Eksklusif Season 1" : "Mod Livery Truk Eksklusif Season 1")}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                    {season?.grandPrize?.description || (isPhysicalGrandPrize ? "Merchandise resmi edisi terbatas Nismara Transport dikirim via ekspedisi" : "Livery resmi edisi terbatas Season 1 untuk truk Scania & Volvo")} + S1 Champion Legend + Role Discord Juara!
                  </p>

                  {userLevel >= 30 && isPremium && (
                    <p className="text-[11px] font-medium text-foreground/80 flex items-center gap-1.5 pt-1">
                      {isPhysicalGrandPrize ? (
                        merchClaim?.channelId ? (
                          <>
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                            <span>Data pengiriman Anda telah diterima. Pantau konfirmasi resi & ongkir di channel Discord Anda.</span>
                          </>
                        ) : (
                          <>
                            <Package size={13} className="text-purple-400 shrink-0" />
                            <span>Silakan klik tombol klaim di samping untuk mengisi formulir alamat pengiriman penerima.</span>
                          </>
                        )
                      ) : season?.grandPrize?.downloadUrl ? (
                        <>
                          <Download size={13} className="text-amber-400 shrink-0" />
                          <span>File mod eksklusif sudah siap untuk diunduh dan dipasang di game simulator.</span>
                        </>
                      ) : null}
                    </p>
                  )}
                </div>
              </div>

              {/* Action / Progress Box */}
              <div className="shrink-0 w-full lg:w-auto flex flex-col sm:flex-row items-center gap-3">
                {userLevel >= 30 ? (
                  isPremium ? (
                    isPhysicalGrandPrize ? (
                      merchClaim?.channelId ? (
                        <a
                          href={`https://discord.com/channels/${guildId}/${merchClaim.channelId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 hover:from-purple-600 hover:to-pink-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition shadow-xl shadow-purple-500/25 flex items-center justify-center gap-2.5"
                        >
                          <Package size={17} />
                          <span>Buka Channel Klaim Discord</span>
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        <button
                          onClick={() => setShowMerchClaimModal(true)}
                          className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 hover:from-purple-600 hover:to-pink-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition shadow-xl shadow-purple-500/25 flex items-center justify-center gap-2.5 animate-pulse"
                        >
                          <Package size={17} />
                          <span>Klaim Merchandise (Isi Alamat)</span>
                        </button>
                      )
                    ) : season?.grandPrize?.downloadUrl ? (
                      <a
                        href={season.grandPrize.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-black text-xs uppercase tracking-wider rounded-2xl transition shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2.5"
                      >
                        <Download size={17} />
                        <span>Unduh Mod / Konten</span>
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      <div className="w-full sm:w-auto px-6 py-3.5 bg-emerald-500 text-black font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                        <CheckCircle2 size={18} />
                        Tamat Level 30
                      </div>
                    )
                  ) : (
                    <button
                      onClick={() => setShowBuyModal(true)}
                      className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-black text-xs uppercase tracking-wider rounded-2xl transition shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2"
                    >
                      <Crown size={16} className="fill-black" />
                      <span>Upgrade Pass Untuk Buka Hadiah</span>
                    </button>
                  )
                ) : (
                  <div className="w-full sm:w-auto px-5 py-3 bg-card/80 border border-border/60 rounded-2xl text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
                      Target Puncak
                    </span>
                    <span className="text-sm font-black text-amber-400 font-mono">
                      {userLevel} / 30 Level
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. Detail Modal Popup for Any Level */}
      {selectedLevelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-card border border-border/80 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-primary text-primary-foreground font-black text-lg flex items-center justify-center shadow-md">
                  {selectedLevelModal.level}
                </span>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-foreground">
                    Rincian Hadiah Level {selectedLevelModal.level}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    Syarat Akumulasi: {selectedLevelModal.cumulativeXp.toLocaleString("id-ID")} Seasonal XP
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLevelModal(null)}
                className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content: Free Track vs Premium Track */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Free Track Column */}
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-3">
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    🎁 Free Track ({selectedLevelModal.freeRewards.length} Hadiah)
                  </span>
                  {progress?.claimedFreeLevels?.includes(selectedLevelModal.level) ? (
                    <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 size={12} /> Sudah Diklaim
                    </span>
                  ) : userXp >= selectedLevelModal.cumulativeXp ? (
                    <span className="text-amber-400 text-xs font-bold">Siap Diklaim</span>
                  ) : (
                    <span className="text-muted-foreground text-xs font-semibold">Terkunci</span>
                  )}
                </div>

                <div className="space-y-2">
                  {selectedLevelModal.freeRewards.map((r, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border/60 shadow-sm">
                      <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
                        {getRewardIcon(r, "w-4 h-4")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground">{r.title}</p>
                        {r.description && <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{r.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {userXp >= selectedLevelModal.cumulativeXp && !progress?.claimedFreeLevels?.includes(selectedLevelModal.level) && (
                  <button
                    onClick={() => {
                      handleClaim(selectedLevelModal.level, "free");
                      setSelectedLevelModal(null);
                    }}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md mt-2"
                  >
                    Klaim Hadiah Gratis
                  </button>
                )}
              </div>

              {/* Premium Track Column */}
              <div className={`p-4 rounded-2xl border space-y-3 ${
                isPremium
                  ? "bg-gradient-to-b from-amber-500/10 to-orange-500/10 border-amber-500/40"
                  : "bg-card border-border/40"
              }`}>
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Crown size={13} className="fill-amber-400" /> Premium Track ({selectedLevelModal.premiumRewards.length} Hadiah)
                  </span>
                  {progress?.claimedPremiumLevels?.includes(selectedLevelModal.level) ? (
                    <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 size={12} /> Sudah Diklaim
                    </span>
                  ) : !isPremium ? (
                    <span className="text-muted-foreground text-xs font-semibold flex items-center gap-1">
                      <Lock size={12} /> Terkunci
                    </span>
                  ) : userXp >= selectedLevelModal.cumulativeXp ? (
                    <span className="text-amber-400 text-xs font-bold">Siap Diklaim</span>
                  ) : (
                    <span className="text-muted-foreground text-xs font-semibold">Terkunci</span>
                  )}
                </div>

                <div className="space-y-2">
                  {selectedLevelModal.premiumRewards.map((r, idx) => {
                    const isGrandPrizeItem =
                      r.type === "MOD_LIVERY" ||
                      r.type === "PHYSICAL_MERCH" ||
                      r.type === "DOWNLOADABLE" ||
                      r.type === "PHYSICAL";
                    const isPhysical =
                      r.type === "PHYSICAL_MERCH" ||
                      r.type === "PHYSICAL" ||
                      season?.grandPrize?.type === "PHYSICAL_MERCH" ||
                      season?.grandPrize?.type === "PHYSICAL";

                    return (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-card border border-amber-500/30 shadow-sm">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isGrandPrizeItem && isPhysical
                              ? "bg-purple-500/20 text-purple-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {getRewardIcon(r, "w-4 h-4")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-foreground truncate">{r.title}</p>
                            {isGrandPrizeItem && isPhysical && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold uppercase tracking-wider shrink-0">
                                Fisik
                              </span>
                            )}
                          </div>
                          {r.description && <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{r.description}</p>}

                          {/* Quick Link Button for Grand Prize if unlocked */}
                          {isGrandPrizeItem && isPremium && userLevel >= selectedLevelModal.level && (
                            isPhysical ? (
                              merchClaim?.channelId ? (
                                <a
                                  href={`https://discord.com/channels/${guildId}/${merchClaim.channelId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-wider transition bg-purple-500 text-white hover:bg-purple-600 shadow-sm"
                                >
                                  <Package size={12} />
                                  <span>Buka Channel Discord</span>
                                  <ExternalLink size={10} />
                                </a>
                              ) : (
                                <button
                                  onClick={() => {
                                    setSelectedLevelModal(null);
                                    setShowMerchClaimModal(true);
                                  }}
                                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-wider transition bg-purple-500 text-white hover:bg-purple-600 shadow-sm"
                                >
                                  <Package size={12} />
                                  <span>Isi Formulir Alamat</span>
                                </button>
                              )
                            ) : season?.grandPrize?.downloadUrl ? (
                              <a
                                href={season.grandPrize.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-wider transition bg-amber-500 text-black hover:bg-amber-600 shadow-sm"
                              >
                                <Download size={12} />
                                <span>Unduh Mod</span>
                                <ExternalLink size={10} />
                              </a>
                            ) : null
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {userLevel >= selectedLevelModal.level && isPremium && !progress?.claimedPremiumLevels?.includes(selectedLevelModal.level) && (
                  <button
                    onClick={() => {
                      handleClaim(selectedLevelModal.level, "premium");
                      setSelectedLevelModal(null);
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md mt-2"
                  >
                    Klaim Hadiah Premium
                  </button>
                )}

                {!isPremium && (
                  discordChannelUrl ? (
                    <a
                      href={discordChannelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md mt-2 flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink size={14} />
                      Lanjutkan Order di Discord
                    </a>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedLevelModal(null);
                        setShowBuyModal(true);
                      }}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md mt-2 flex items-center justify-center gap-1.5"
                    >
                      <Crown size={14} className="fill-black" />
                      Beli Nismara Pass Premium
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Dedicated Purchase Modal (Rupiah Only & Owner Confirmation Flow) */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-card border border-amber-500/40 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-black shadow-md shadow-amber-500/20">
                  <Crown size={20} className="fill-black" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground">Beli Nismara Pass Premium</h3>
                  <p className="text-xs text-muted-foreground">Season {season?.seasonNumber}: {season?.title}</p>
                </div>
              </div>

              <button
                onClick={() => setShowBuyModal(false)}
                className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Pending Order Status Banner if already ordered */}
            {discordChannelUrl && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Clock size={14} /> Pesanan Anda Sedang Diproses
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Anda sudah membuat pesanan Nismara Pass. Silakan buka channel tiket invoice di Discord untuk menyelesaikan pembayaran dan mengirimkan bukti transfer.
                </p>
                <a
                  href={discordChannelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-black font-black text-xs uppercase tracking-wider transition shadow-sm hover:bg-amber-600"
                >
                  <ExternalLink size={13} /> Buka Channel Discord
                </a>
              </div>
            )}

            {/* Pricing & Benefit Showcase */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-purple-950/20 border border-amber-500/30 space-y-4">
              <div className="flex items-baseline justify-between border-b border-amber-500/20 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Biaya Langganan Musim
                </span>
                <span className="text-2xl font-black text-amber-400">
                  Rp {(season?.premiumPriceIdr || 35000).toLocaleString("id-ID")},-
                </span>
              </div>

              <div className="space-y-2 text-xs text-foreground">
                <p className="font-bold flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                  <span>Buka seluruh 30 Level Hadiah Premium</span>
                </p>
                <p className="font-bold flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                  <span>2x Kuota XP Mingguan (40.000 XP vs 20.000 XP/minggu)</span>
                </p>
                <p className="font-bold flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                  <span>Total ~375.500 NC & 149.000 Liter Fuel</span>
                </p>
                <p className="font-bold flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                  <span>6x Voucher NC Booster & 2x 100% Free Servis</span>
                </p>
                <p className="font-bold flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                  <span>Hadiah Puncak: {season?.grandPrize?.title || "Mod Livery Eksklusif"}</span>
                </p>
              </div>
            </div>

            {/* Payment Flow Information & QRIS */}
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-3 text-xs text-muted-foreground">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <CreditCard size={14} className="text-amber-400" /> Metode Pembayaran (QRIS & Transfer)
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                <div className="w-28 h-28 rounded-xl overflow-hidden bg-white p-1.5 border border-border/60 shrink-0 shadow-md">
                  <img
                    src="https://images.nismara.my.id/Nismara_QR.jpg"
                    alt="QRIS Nismara"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="leading-relaxed flex-1">
                  Scan QRIS di samping atau lakukan transfer bank. Setelah Anda menekan tombol <strong>"Pesan Sekarang"</strong> di bawah, channel invoice Discord akan dibuat dengan QRIS lengkap dan pesanan akan <strong>dikonfirmasi langsung oleh Owner / Developer</strong>.
                </p>
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBuyModal(false)}
                className="px-5 py-2.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold uppercase tracking-wider transition"
              >
                Tutup
              </button>
              {discordChannelUrl ? (
                <a
                  href={discordChannelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center gap-2"
                >
                  <ExternalLink size={14} />
                  <span>Buka Channel Discord</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateOrder}
                  disabled={isCreatingOrder}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  <Send size={14} className="fill-black" />
                  <span>{isCreatingOrder ? "Membuat Pesanan..." : "Pesan Sekarang (Buka Tiket)"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. In-App Merchandise Claim Modal */}
      {showMerchClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-card border border-purple-500/40 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-sm">
                  <Package size={22} />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-foreground">
                    Formulir Pengiriman Merchandise
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {season?.grandPrize?.title || "Hadiah Puncak Merchandise Season Pass"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowMerchClaimModal(false)}
                className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Explanatory Banner */}
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200/90 leading-relaxed space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-purple-300">
                <Sparkles size={14} /> Konfirmasi Alamat Langsung ke Owner & Developer
              </p>
              <p>
                Setelah Anda mengirim data di bawah, sistem akan otomatis membuat channel tiket privat di Discord bersama Owner & Developer untuk konfirmasi ongkos kirim dan nomor resi pengiriman.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitMerchClaim} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Nama Lengkap Penerima</span>
                  <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={merchFormData.recipientName}
                  onChange={(e) => setMerchFormData({ ...merchFormData, recipientName: e.target.value })}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border focus:border-purple-500 focus:outline-none text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Nomor WhatsApp Penerima</span>
                  <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={merchFormData.recipientPhone}
                  onChange={(e) => setMerchFormData({ ...merchFormData, recipientPhone: e.target.value })}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border focus:border-purple-500 focus:outline-none text-sm font-medium font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Alamat Lengkap Pengiriman</span>
                  <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={merchFormData.recipientAddress}
                  onChange={(e) => setMerchFormData({ ...merchFormData, recipientAddress: e.target.value })}
                  placeholder="Nama Jalan, No. Rumah, RT/RW, Kelurahan, Kecamatan, Kota/Kabupaten, Provinsi, Kode Pos..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border focus:border-purple-500 focus:outline-none text-sm font-medium resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={merchFormData.shippingNotes}
                  onChange={(e) => setMerchFormData({ ...merchFormData, shippingNotes: e.target.value })}
                  placeholder="Contoh: Ukuran Kaos XL / Patokan samping minimarket..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border focus:border-purple-500 focus:outline-none text-sm font-medium"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowMerchClaimModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold uppercase tracking-wider transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMerchClaim}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-black text-xs uppercase tracking-wider transition shadow-lg shadow-purple-500/25 disabled:opacity-50 flex items-center gap-2"
                >
                  <Send size={14} />
                  <span>{isSubmittingMerchClaim ? "Mengirim Data..." : "Kirim Data Pengiriman"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
