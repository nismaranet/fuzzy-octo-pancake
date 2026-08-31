"use client";

import React, { useState } from "react";
import {
  Trophy,
  Crown,
  Sparkles,
  Flame,
  Plus,
  Edit,
  CheckCircle2,
  Users,
  Search,
  Calendar,
  Layers,
  Clock,
  ArrowRight,
  Gift,
  Coins,
  ShieldAlert,
  CreditCard,
  Check,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { showAlert, showConfirm } from "@/lib/dialog";
import { useRouter } from "next/navigation";
import SeasonFormModal from "./SeasonFormModal";

export default function ManageSeasonPassClient({
  initialSeasons,
  initialActiveSeason,
  initialStats,
  initialDriverProgress,
  initialOrders = [],
  isOwner = false,
}: {
  initialSeasons: any[];
  initialActiveSeason: any;
  initialStats: any;
  initialDriverProgress: any[];
  initialOrders?: any[];
  isOwner?: boolean;
}) {
  const router = useRouter();
  const [seasons, setSeasons] = useState<any[]>(initialSeasons || []);
  const [selectedSeason, setSelectedSeason] = useState<any>(initialActiveSeason || initialSeasons?.[0]);
  const [stats, setStats] = useState<any>(initialStats || {});
  const [driverProgress, setDriverProgress] = useState<any[]>(initialDriverProgress || []);
  const [orders, setOrders] = useState<any[]>(initialOrders || []);

  const [activeTab, setActiveTab] = useState<"SEASONS" | "DRIVERS" | "ORDERS">("SEASONS");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT" | null>(null);
  const [editingSeason, setEditingSeason] = useState<any>(null);
  const [isActivating, setIsActivating] = useState<number | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  const pendingOrders = orders.filter((o) => o.status === "pending");

  const filteredDrivers = driverProgress.filter((p) => {
    const name = p.user?.name || "";
    const discordId = p.discordId || "";
    const query = searchQuery.toLowerCase();
    return name.toLowerCase().includes(query) || discordId.includes(query);
  });

  const handleSelectSeason = async (seasonNum: number) => {
    try {
      const res = await fetch(`/api/manage/season-pass?seasonNumber=${seasonNum}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedSeason(data.activeSeason);
        setStats(data.stats);
        setDriverProgress(data.driverProgress);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleActivateSeason = async (seasonNumber: number) => {
    const confirmed = await showConfirm(
      `Aktifkan Season ${seasonNumber} sebagai Musim Aktif Utama? Musim aktif lainnya akan otomatis diubah statusnya menjadi COMPLETED.`
    );
    if (!confirmed) return;

    setIsActivating(seasonNumber);
    try {
      const res = await fetch("/api/manage/season-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACTIVATE", seasonNumber }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengaktifkan musim");

      await showAlert(data.message || "Musim berhasil diaktifkan!");
      router.refresh();
      window.location.reload();
    } catch (err: any) {
      await showAlert(`Gagal: ${err.message}`);
    } finally {
      setIsActivating(null);
    }
  };

  const handleOrderAction = async (orderId: string, action: "APPROVE" | "REJECT", driverName: string) => {
    const actionText = action === "APPROVE" ? "menyetujui pembayaran dan mengaktifkan Pass" : "menolak pesanan";
    const confirmed = await showConfirm(`Apakah Anda yakin ingin ${actionText} untuk ${driverName}?`);
    if (!confirmed) return;

    setProcessingOrderId(orderId);
    try {
      const res = await fetch("/api/manage/season-pass/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses pesanan");

      await showAlert(data.message || "Berhasil!");
      // Update local orders
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, status: action === "APPROVE" ? "success" : "rejected" } : o))
      );
      router.refresh();
    } catch (err: any) {
      await showAlert(`Gagal: ${err.message}`);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const refreshData = async () => {
    try {
      const res = await fetch(`/api/manage/season-pass?seasonNumber=${selectedSeason?.seasonNumber || 1}`);
      const data = await res.json();
      if (res.ok) {
        setSeasons(data.seasons);
        setSelectedSeason(data.activeSeason);
        setStats(data.stats);
        setDriverProgress(data.driverProgress);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const latestSeasonNum = seasons.reduce((max, s) => Math.max(max, s.seasonNumber || 1), 1);

  return (
    <div className="space-y-8">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-950/40 via-card/90 to-purple-950/30 border border-amber-500/30 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Trophy size={14} /> Manajemen Musim & Seasonal Pass
              </span>
              <span className="px-3 py-1 rounded-full bg-card border border-border text-muted-foreground text-xs font-semibold">
                Total {seasons.length} Musim Terdaftar
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-foreground tracking-tight">
              Pusat Kendali Season Pass
            </h1>
            <p className="text-muted-foreground text-sm max-w-2xl">
              Kelola musim yang sedang berjalan, pantau progres seluruh driver, konfirmasi pesanan pembelian Nismara Pass, dan buat musim baru.
            </p>
          </div>

          <button
            onClick={() => {
              setEditingSeason(null);
              setModalMode("CREATE");
            }}
            className="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center gap-2 self-start md:self-auto shrink-0"
          >
            <Plus size={16} /> Buat Musim Baru
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-md space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Users size={14} className="text-blue-400" /> Total Driver Aktif
          </p>
          <p className="text-2xl font-black text-foreground">{stats.totalDrivers || 0} Driver</p>
          <p className="text-[11px] text-muted-foreground">Pada Season {selectedSeason?.seasonNumber}</p>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-md space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Crown size={14} className="fill-amber-400" /> Premium Pass Terjual
          </p>
          <p className="text-2xl font-black text-foreground">{stats.totalPremium || 0} Pengemudi</p>
          <p className="text-[11px] text-emerald-400 font-semibold">
            {stats.totalDrivers ? `${Math.round((stats.totalPremium / stats.totalDrivers) * 100)}% Konversi` : "0%"}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-md space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Tamat Level 30
          </p>
          <p className="text-2xl font-black text-foreground">{stats.completedCount || 0} Juara</p>
          <p className="text-[11px] text-muted-foreground">Mencapai 225.000 XP</p>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-md space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
            <CreditCard size={14} /> Pesanan Menunggu
          </p>
          <p className="text-2xl font-black text-amber-400 font-mono">
            {pendingOrders.length} Pesanan
          </p>
          <p className="text-[11px] text-muted-foreground">Khusus Konfirmasi Owner</p>
        </div>
      </div>

      {/* 3. Navigation Tabs & Season Selector */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/60 pb-4">
        {/* Tabs */}
        <div className="flex items-center p-1 bg-card border border-border/60 rounded-xl w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab("SEASONS")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTab === "SEASONS"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Daftar Musim ({seasons.length})
          </button>
          <button
            onClick={() => setActiveTab("DRIVERS")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTab === "DRIVERS"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Roster Driver ({driverProgress.length})
          </button>
          <button
            onClick={() => setActiveTab("ORDERS")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
              activeTab === "ORDERS"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Pesanan Masuk</span>
            {pendingOrders.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black">
                {pendingOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Season Selector Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0">
            Pilih Musim:
          </span>
          <select
            value={selectedSeason?.seasonNumber || 1}
            onChange={(e) => handleSelectSeason(Number(e.target.value))}
            className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-bold text-foreground focus:outline-none focus:border-amber-500 w-full sm:w-auto"
          >
            {seasons.map((s) => (
              <option key={s.seasonNumber} value={s.seasonNumber}>
                Season {s.seasonNumber}: {s.title} ({s.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Tab 1: Daftar Musim */}
      {activeTab === "SEASONS" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {seasons.map((s) => {
            const isActive = s.status === "ACTIVE";
            const isDraft = s.status === "DRAFT";

            return (
              <div
                key={s.seasonNumber}
                className={`relative overflow-hidden rounded-2xl border p-6 flex flex-col justify-between transition-all duration-300 ${
                  isActive
                    ? "bg-gradient-to-b from-card via-card to-amber-950/20 border-amber-500/50 shadow-xl shadow-amber-500/10 ring-2 ring-amber-500/30"
                    : "bg-card border-border/80 shadow-md"
                }`}
              >
                <div className="space-y-4">
                  {/* Status & Number */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-muted text-foreground">
                      Season {s.seasonNumber}
                    </span>

                    <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                      isActive
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse"
                        : isDraft
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : "bg-muted/60 border-border text-muted-foreground"
                    }`}>
                      {s.status}
                    </span>
                  </div>

                  {/* Title & Dates */}
                  <div>
                    <h3 className="text-lg font-black text-foreground">{s.title}</h3>
                    {s.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{s.subtitle}</p>}
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/40">
                    <div className="p-2 rounded-lg bg-muted/30">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Durasi</span>
                      <span className="font-semibold text-foreground">
                        {new Date(s.startAt).toLocaleDateString("id-ID")} - {new Date(s.endAt).toLocaleDateString("id-ID")}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-muted/30">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Target XP</span>
                      <span className="font-semibold text-foreground">{s.totalXp?.toLocaleString("id-ID")} XP</span>
                    </div>

                    <div className="p-2 rounded-lg bg-muted/30">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Harga IDR</span>
                      <span className="font-semibold text-amber-400">Rp {s.premiumPriceIdr?.toLocaleString("id-ID")}</span>
                    </div>

                    <div className="p-2 rounded-lg bg-muted/30">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Level Aktif</span>
                      <span className="font-semibold text-foreground">{s.levels?.length || 30} Level</span>
                    </div>
                  </div>

                  {/* Grand Prize */}
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <Gift size={12} /> Hadiah Puncak Level 30
                    </span>
                    <p className="text-xs font-bold text-foreground truncate">{s.grandPrize?.title || "Hadiah Puncak"}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 mt-4 border-t border-border/40">
                  {!isActive && (
                    <button
                      onClick={() => handleActivateSeason(s.seasonNumber)}
                      disabled={isActivating === s.seasonNumber}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md disabled:opacity-50"
                    >
                      {isActivating === s.seasonNumber ? "Mengaktifkan..." : "Aktifkan Musim"}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setEditingSeason(s);
                      setModalMode("EDIT");
                    }}
                    className="px-3.5 py-2 rounded-xl bg-muted/80 hover:bg-muted text-foreground text-xs font-bold uppercase tracking-wider transition flex items-center gap-1"
                  >
                    <Edit size={13} /> Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Tab 2: Roster Driver */}
      {activeTab === "DRIVERS" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-3 p-3 bg-card border border-border/80 rounded-2xl">
            <Search size={16} className="text-muted-foreground ml-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari driver berdasarkan nama atau Discord ID..."
              className="bg-transparent border-none text-sm focus:outline-none w-full text-foreground"
            />
          </div>

          {/* Drivers Table */}
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground uppercase font-black tracking-wider">
                  <tr>
                    <th className="p-3.5">Pengemudi (Driver)</th>
                    <th className="p-3.5">Level Saat Ini</th>
                    <th className="p-3.5">Total XP</th>
                    <th className="p-3.5">Status Pass</th>
                    <th className="p-3.5">Hadiah Diklaim (Free / Prem)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredDrivers.length > 0 ? (
                    filteredDrivers.map((p) => (
                      <tr key={p._id || p.discordId} className="hover:bg-muted/20 transition">
                        <td className="p-3.5 font-bold text-foreground">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center font-black text-xs text-muted-foreground">
                              {p.user?.name ? p.user.name[0].toUpperCase() : "D"}
                            </div>
                            <div>
                              <p className="font-bold text-foreground">{p.user?.name || "Driver Nismara"}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{p.discordId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 font-black text-foreground">
                          <span className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground font-black">
                            Level {p.currentLevel || 1}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-foreground">
                          {(p.currentXp || 0).toLocaleString("id-ID")} XP
                        </td>
                        <td className="p-3.5">
                          {p.isPremium ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black text-[10px] uppercase">
                              <Crown size={10} className="fill-amber-400" /> Premium
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-medium">Free Track</span>
                          )}
                        </td>
                        <td className="p-3.5 font-semibold text-foreground">
                          <span className="text-emerald-400">{p.claimedFreeLevels?.length || 0} Free</span>
                          <span className="text-muted-foreground mx-1.5">/</span>
                          <span className="text-amber-400">{p.claimedPremiumLevels?.length || 0} Premium</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        Tidak ada driver yang ditemukan pada Season {selectedSeason?.seasonNumber}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. Tab 3: Pesanan Masuk (Order Pass IDR) */}
      {activeTab === "ORDERS" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-foreground space-y-1">
              <p className="font-bold">Otorisasi Khusus Owner & Developer</p>
              <p className="text-muted-foreground">
                Sesuai kebijakan resmi, pesanan Nismara Pass Premium hanya dapat disetujui atau ditolak secara langsung oleh <strong>Owner / Developer</strong> setelah bukti transfer diverifikasi.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground uppercase font-black tracking-wider">
                  <tr>
                    <th className="p-3.5">Driver / Pemesan</th>
                    <th className="p-3.5">Musim</th>
                    <th className="p-3.5">Total Tagihan</th>
                    <th className="p-3.5">Tanggal Order</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Aksi Konfirmasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {orders.length > 0 ? (
                    orders.map((o) => {
                      const isPending = o.status === "pending";
                      const isSuccess = o.status === "success";
                      const isRejected = o.status === "rejected";

                      return (
                        <tr key={o._id} className="hover:bg-muted/20 transition">
                          <td className="p-3.5 font-bold text-foreground">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center font-black text-xs text-muted-foreground">
                                {o.userId?.name ? o.userId.name[0].toUpperCase() : "D"}
                              </div>
                              <div>
                                <p className="font-bold text-foreground">{o.userId?.name || "Driver"}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{o.discordId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 font-black text-foreground">
                            Season {o.seasonNumber}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-amber-400">
                            Rp {(o.amountIDR || 35000).toLocaleString("id-ID")}
                          </td>
                          <td className="p-3.5 text-muted-foreground">
                            {new Date(o.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border ${
                                isPending
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse"
                                  : isSuccess
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                  : "bg-red-500/10 border-red-500/30 text-red-400"
                              }`}
                            >
                              {o.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            {isPending && isOwner ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOrderAction(o._id, "APPROVE", o.userId?.name || o.discordId)}
                                  disabled={processingOrderId === o._id}
                                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xs uppercase tracking-wider rounded-lg transition shadow-sm flex items-center gap-1 disabled:opacity-50"
                                >
                                  <Check size={13} />
                                  <span>{processingOrderId === o._id ? "Memproses..." : "Setujui"}</span>
                                </button>
                                <button
                                  onClick={() => handleOrderAction(o._id, "REJECT", o.userId?.name || o.discordId)}
                                  disabled={processingOrderId === o._id}
                                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-xs uppercase tracking-wider rounded-lg transition flex items-center gap-1 disabled:opacity-50"
                                >
                                  <XCircle size={13} />
                                  <span>Tolak</span>
                                </button>
                              </div>
                            ) : isPending && !isOwner ? (
                              <span className="text-[11px] text-muted-foreground italic">Menunggu Owner</span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">Selesai</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Belum ada pesanan Nismara Pass yang masuk.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. Form Modal (Create / Edit) */}
      <SeasonFormModal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        onSuccess={refreshData}
        mode={modalMode || "CREATE"}
        initialData={editingSeason}
        latestSeasonNumber={latestSeasonNum}
      />
    </div>
  );
}
