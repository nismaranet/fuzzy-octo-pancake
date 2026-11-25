"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Store,
  Flame,
  Search,
  Plus,
  HandCoins,
  Eye,
  Clock,
  Ticket,
  ShieldAlert,
  Infinity as InfinityIcon,
  Star,
  ArrowUpRight,
  Trash2,
  ShoppingCart,
  CheckCircle2,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Tag,
} from "lucide-react";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { showAlert, showConfirm } from "@/lib/dialog";
import {
  type CommunityMarketConfig,
  VOUCHER_CATEGORY_SHORT_LABELS,
  normalizeVoucherCategoryKey,
  formatNCWhole,
  formatWIBShort,
  formatVoucherBenefitSummary,
} from "@/lib/communityMarketShared";
import MarketUserBadgeRow from "./MarketUserBadgeRow";
import CreateListingModal from "./CreateListingModal";
import CreateBuyOrderModal from "./CreateBuyOrderModal";
import FulfillBuyOrderModal from "./FulfillBuyOrderModal";
import RateSellerModal from "./RateSellerModal";

interface CommunityMarketClientProps {
  initialListings: any[];
  initialBuyOrders: any[];
  initialPriceGuide: Record<string, any>;
  initialConfig: CommunityMarketConfig;
  initialStats: {
    activeListings: number;
    activeBuyOrders: number;
    flashDealCount: number;
  };
  currentUser: {
    discordId: string;
    isDriver: boolean;
    role?: string;
  } | null;
}

export default function CommunityMarketClient({
  initialListings,
  initialBuyOrders,
  initialPriceGuide,
  initialConfig,
  initialStats,
  currentUser,
}: CommunityMarketClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<
    "SELL" | "FLASH" | "BUY_ORDERS" | "MY_ACTIVITY"
  >("SELL");
  const [config, setConfig] = useState<CommunityMarketConfig>(initialConfig);
  const [listings, setListings] = useState<any[]>(initialListings);
  const [buyOrders, setBuyOrders] = useState<any[]>(initialBuyOrders);
  const [priceGuide, setPriceGuide] = useState<Record<string, any>>(initialPriceGuide);
  const [stats, setStats] = useState(initialStats);

  // Filters
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [loadingFeed, setLoadingFeed] = useState(false);

  // My Activity
  const [myData, setMyData] = useState<any>(null);
  const [loadingMy, setLoadingMy] = useState(false);

  // Modals
  const [createListingOpen, setCreateListingOpen] = useState(false);
  const [createListingInitialType, setCreateListingInitialType] = useState<
    "VOUCHER" | "PENALTY_TICKET"
  >("PENALTY_TICKET");
  const [createBuyOrderOpen, setCreateBuyOrderOpen] = useState(false);
  const [fulfillTarget, setFulfillTarget] = useState<any | null>(null);
  const [rateTarget, setRateTarget] = useState<{
    tradeId: string;
    itemTitle?: string;
    sellerName?: string;
  } | null>(null);

  // Inline qty state for penalty ticket purchase cards
  const [buyQtyMap, setBuyQtyMap] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // Sync URL query shortcuts
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "flash") setActiveTab("FLASH");
    else if (tab === "buy-orders") setActiveTab("BUY_ORDERS");
    else if (tab === "my" && currentUser) setActiveTab("MY_ACTIVITY");

    const action = searchParams.get("action");
    if (action === "sell" && currentUser?.isDriver) {
      const t = searchParams.get("type") === "VOUCHER" ? "VOUCHER" : "PENALTY_TICKET";
      setCreateListingInitialType(t);
      setCreateListingOpen(true);
    } else if (action === "buy-order" && currentUser?.isDriver) {
      setCreateBuyOrderOpen(true);
    }
  }, [searchParams, currentUser]);

  const fetchSellListings = useCallback(
    async (flashOnly = false) => {
      setLoadingFeed(true);
      try {
        const params = new URLSearchParams();
        if (flashOnly) {
          params.set("flashDeal", "true");
        } else if (itemTypeFilter !== "ALL") {
          params.set("itemType", itemTypeFilter);
        }
        if (categoryFilter !== "ALL") params.set("category", categoryFilter);
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        params.set("sort", flashOnly ? "expiring_soon" : sortBy);

        const res = await fetch(`/api/community-market/listings?${params.toString()}`, {
          ...NO_CACHE_FETCH_OPTIONS,
        });
        const data = await res.json();
        if (data.success) {
          setListings(data.listings || []);
          if (data.priceGuide) setPriceGuide(data.priceGuide);
          if (data.config) setConfig(data.config);
          if (!flashOnly && itemTypeFilter === "ALL" && categoryFilter === "ALL" && !searchQuery.trim()) {
            setStats((prev) => ({ ...prev, activeListings: data.total ?? prev.activeListings }));
          }
        }
      } catch (err) {
        console.error("Failed refreshing sell listings:", err);
      } finally {
        setLoadingFeed(false);
      }
    },
    [itemTypeFilter, categoryFilter, searchQuery, sortBy]
  );

  const fetchBuyOrders = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const params = new URLSearchParams();
      if (itemTypeFilter !== "ALL") params.set("itemType", itemTypeFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("sort", sortBy === "newest" ? "price_desc" : sortBy);

      const res = await fetch(`/api/community-market/buy-orders?${params.toString()}`, {
        ...NO_CACHE_FETCH_OPTIONS,
      });
      const data = await res.json();
      if (data.success) {
        setBuyOrders(data.buyOrders || []);
        if (data.priceGuide) setPriceGuide(data.priceGuide);
        if (itemTypeFilter === "ALL" && categoryFilter === "ALL" && !searchQuery.trim()) {
          setStats((prev) => ({ ...prev, activeBuyOrders: data.total ?? prev.activeBuyOrders }));
        }
      }
    } catch (err) {
      console.error("Failed refreshing buy orders:", err);
    } finally {
      setLoadingFeed(false);
    }
  }, [itemTypeFilter, categoryFilter, searchQuery, sortBy]);

  const fetchMyActivity = useCallback(async () => {
    if (!currentUser) return;
    setLoadingMy(true);
    try {
      const res = await fetch("/api/community-market/my", { ...NO_CACHE_FETCH_OPTIONS });
      const data = await res.json();
      if (data.success) {
        setMyData(data);
      }
    } catch (err) {
      console.error("Failed loading my activity:", err);
    } finally {
      setLoadingMy(false);
    }
  }, [currentUser]);

  const refreshActiveTab = useCallback(() => {
    if (activeTab === "SELL") fetchSellListings(false);
    else if (activeTab === "FLASH") fetchSellListings(true);
    else if (activeTab === "BUY_ORDERS") fetchBuyOrders();
    else if (activeTab === "MY_ACTIVITY") fetchMyActivity();
  }, [activeTab, fetchSellListings, fetchBuyOrders, fetchMyActivity]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshActiveTab();
    }, 180);
    return () => clearTimeout(timer);
  }, [refreshActiveTab]);

  // Preload my unrated count badge quietly if signed in
  useEffect(() => {
    if (currentUser && !myData) {
      fetchMyActivity();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const handleBuyListing = async (listing: any) => {
    if (!currentUser) {
      router.push("/login");
      return;
    }
    if (!currentUser.isDriver) {
      await showAlert("Hanya driver resmi Nismara yang dapat bertransaksi di Community Market.");
      return;
    }

    const qty =
      listing.itemType === "PENALTY_TICKET"
        ? Math.max(1, Math.min(listing.remainingQuantity, buyQtyMap[listing._id] || 1))
        : 1;
    const totalPrice = listing.unitPrice * qty;

    const confirmed = await showConfirm(
      `Beli ${qty > 1 ? `${qty}x ` : ""}${listing.itemSnapshot.title} seharga ${formatNCWhole(totalPrice)}? Saldo NC akan langsung dipotong dan item masuk ke inventaris Anda.`
    );
    if (!confirmed) return;

    setBusyId(listing._id);
    try {
      const res = await fetch(`/api/community-market/listings/${listing._id}/buy`, {
        method: "POST",
        ...NO_CACHE_FETCH_OPTIONS,
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity: qty }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Pembelian gagal.");
      }

      await showAlert(data.message || "Pembelian berhasil!");
      refreshActiveTab();
      fetchMyActivity();
      router.refresh();

      if (data.tradeId) {
        setRateTarget({
          tradeId: data.tradeId,
          itemTitle: listing.itemSnapshot.title,
          sellerName: listing.seller?.name,
        });
      }
    } catch (err: any) {
      await showAlert(err.message || "Pembelian gagal.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelListing = async (listing: any) => {
    const confirmed = await showConfirm(
      `Batalkan iklan "${listing.itemSnapshot.title}"? Sisa item akan kembali ke inventaris Anda, namun biaya jasa pasang iklan tidak dikembalikan.`
    );
    if (!confirmed) return;

    setBusyId(listing._id);
    try {
      const res = await fetch(`/api/community-market/listings/${listing._id}`, {
        method: "DELETE",
        ...NO_CACHE_FETCH_OPTIONS,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal membatalkan iklan.");
      }
      await showAlert(data.message || "Iklan dibatalkan.");
      refreshActiveTab();
      fetchMyActivity();
      router.refresh();
    } catch (err: any) {
      await showAlert(err.message || "Gagal membatalkan iklan.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelBuyOrder = async (order: any) => {
    const confirmed = await showConfirm(
      `Batalkan Buy Order "${order.title}"? Sisa dana escrow sebesar ${formatNCWhole(order.escrowRemaining)} akan dikembalikan 100% ke dompet Anda (biaya jasa pasang iklan tidak kembali).`
    );
    if (!confirmed) return;

    setBusyId(order._id);
    try {
      const res = await fetch(`/api/community-market/buy-orders/${order._id}`, {
        method: "DELETE",
        ...NO_CACHE_FETCH_OPTIONS,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal membatalkan Buy Order.");
      }
      await showAlert(data.message || "Buy Order dibatalkan.");
      refreshActiveTab();
      fetchMyActivity();
      router.refresh();
    } catch (err: any) {
      await showAlert(err.message || "Gagal membatalkan Buy Order.");
    } finally {
      setBusyId(null);
    }
  };

  const unratedTradesCount = (myData?.myTrades || []).filter(
    (t: any) => t.direction === "BUY" && !t.isRated
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Maintenance Warning */}
      {!config.enabled && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex items-center gap-3 text-amber-300 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>
            <strong>Community Market sedang dalam pemeliharaan.</strong> Penayangan & transaksi baru ditutup sementara oleh manajemen.
          </span>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card/95 to-primary/10 border border-border/70 p-6 md:p-9 shadow-xl">
        <div className="absolute -right-16 -top-16 w-72 h-72 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-black uppercase tracking-widest">
              <Store className="w-3.5 h-3.5" />
              Nismara P2P Trading Hub · Pajak {config.transactionFeePercent}%
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
              Community Market
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bursa perdagangan antar-driver Nismara Transport. Jual Voucher atau Tiket Penghapus Penalti yang tidak terpakai sebelum hangus, atau pasang <strong className="text-foreground">Buy Order</strong> dengan jaminan Escrow NC otomatis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {currentUser?.isDriver ? (
              <>
                <button
                  type="button"
                  disabled={!config.enabled}
                  onClick={() => {
                    setCreateListingInitialType("PENALTY_TICKET");
                    setCreateListingOpen(true);
                  }}
                  className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:opacity-90 disabled:opacity-40 transition-all shadow-lg shadow-primary/20 inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Pasang Jual
                </button>
                <button
                  type="button"
                  disabled={!config.enabled}
                  onClick={() => setCreateBuyOrderOpen(true)}
                  className="px-5 py-3 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/35 font-black text-sm hover:bg-sky-500/25 disabled:opacity-40 transition-all inline-flex items-center gap-2"
                >
                  <HandCoins className="w-4 h-4" />
                  Buat Buy Order
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:opacity-90 transition-all"
              >
                Login Driver untuk Bertransaksi
              </Link>
            )}
          </div>
        </div>

        {/* Live Market Pulse Bar */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7 pt-6 border-t border-border/50">
          <div className="p-3.5 rounded-2xl bg-background/60 border border-border/60">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Etalase Aktif
            </p>
            <p className="text-xl font-black text-foreground mt-0.5 tabular-nums">
              {stats.activeListings}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-background/60 border border-border/60">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Buy Order (Dicari)
            </p>
            <p className="text-xl font-black text-sky-400 mt-0.5 tabular-nums">
              {stats.activeBuyOrders}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-background/60 border border-border/60">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Flash Deal Aktif
            </p>
            <p className="text-xl font-black text-orange-400 mt-0.5 tabular-nums">
              {stats.flashDealCount}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-background/60 border border-border/60">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Avg Tiket Penalti (30h)
            </p>
            <p className="text-xl font-black text-emerald-400 mt-0.5 tabular-nums">
              {priceGuide["PENALTY_TICKET"]?.avgPrice
                ? formatNCWhole(priceGuide["PENALTY_TICKET"].avgPrice)
                : "Baru"}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs + Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("SELL")}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all inline-flex items-center gap-2 ${
              activeTab === "SELL"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-card border border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Tag className="w-4 h-4" />
            Etalase Jual
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("FLASH")}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all inline-flex items-center gap-2 ${
              activeTab === "FLASH"
                ? "bg-orange-500 text-white shadow-md"
                : "bg-card border border-border/60 text-muted-foreground hover:text-orange-400"
            }`}
          >
            <Flame className="w-4 h-4" />
            Flash Deal
            {stats.flashDealCount > 0 && (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-black/20">
                {stats.flashDealCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("BUY_ORDERS")}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all inline-flex items-center gap-2 ${
              activeTab === "BUY_ORDERS"
                ? "bg-sky-500 text-white shadow-md"
                : "bg-card border border-border/60 text-muted-foreground hover:text-sky-400"
            }`}
          >
            <HandCoins className="w-4 h-4" />
            Dicari (Buy Orders)
          </button>

          {currentUser && (
            <button
              type="button"
              onClick={() => setActiveTab("MY_ACTIVITY")}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all inline-flex items-center gap-2 ${
                activeTab === "MY_ACTIVITY"
                  ? "bg-emerald-500 text-white shadow-md"
                  : "bg-card border border-border/60 text-muted-foreground hover:text-emerald-400"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Aktivitas Saya
              {unratedTradesCount > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-400 text-black">
                  {unratedTradesCount} Ulasan
                </span>
              )}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={refreshActiveTab}
          className="self-start md:self-auto px-3.5 py-2 rounded-xl bg-card border border-border/60 text-xs font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingFeed || loadingMy ? "animate-spin" : ""}`} />
          Muat Ulang
        </button>
      </div>

      {/* Filter Bar (for SELL, FLASH, BUY_ORDERS) */}
      {activeTab !== "MY_ACTIVITY" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-card/70 border border-border/60 p-4 rounded-2xl">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari voucher atau tiket..."
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground"
            />
          </div>

          {activeTab !== "FLASH" && (
            <select
              value={itemTypeFilter}
              onChange={(e) => {
                setItemTypeFilter(e.target.value);
                if (e.target.value === "PENALTY_TICKET") setCategoryFilter("ALL");
              }}
              className="px-3 py-2 rounded-xl bg-background border border-border text-sm font-semibold text-foreground"
            >
              <option value="ALL">Semua Jenis Item</option>
              <option value="PENALTY_TICKET">Tiket Penghapus Penalti</option>
              <option value="VOUCHER">Voucher Driver</option>
            </select>
          )}

          <select
            value={categoryFilter}
            disabled={itemTypeFilter === "PENALTY_TICKET"}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-background border border-border text-sm font-semibold text-foreground disabled:opacity-40"
          >
            <option value="ALL">Semua Kategori Voucher</option>
            <option value="FLEET_BUY">Dealer Armada (Fleet Buy)</option>
            <option value="FLEET_MAINTENANCE">Servis Armada</option>
            <option value="GARAGE_RENT">Operasional Garasi</option>
            <option value="MARKET_MOD">Mod Workshop</option>
            <option value="NC_BOOSTER">NC Booster</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-xl bg-background border border-border text-sm font-semibold text-foreground"
          >
            <option value="newest">Terbaru</option>
            <option value="price_asc">Harga Termurah</option>
            <option value="price_desc">Harga Tertinggi</option>
            <option value="expiring_soon">Segera Berakhir</option>
            <option value="most_viewed">Paling Banyak Dilihat</option>
          </select>
        </div>
      )}

      {/* TAB CONTENT: SELL / FLASH DEAL */}
      {(activeTab === "SELL" || activeTab === "FLASH") && (
        <div>
          {loadingFeed ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm">Memuat etalase Community Market...</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="py-16 text-center rounded-3xl bg-card/50 border border-dashed border-border/70 px-6">
              <Store className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <h3 className="text-lg font-black text-foreground">
                {activeTab === "FLASH"
                  ? "Belum ada Flash Deal saat ini"
                  : "Belum ada item yang cocok"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                {activeTab === "FLASH"
                  ? "Voucher yang sisa masa berlakunya mendekati habis akan muncul otomatis di sini."
                  : "Jadilah yang pertama menawarkan voucher atau tiket penghapus penalti, atau buat Buy Order agar penjual datang kepada Anda!"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {listings.map((listing) => {
                const isOwn = currentUser?.discordId === String(listing.sellerDiscordId);
                const isVoucher = listing.itemType === "VOUCHER";
                const benefit = isVoucher
                  ? formatVoucherBenefitSummary(listing.itemSnapshot)
                  : null;
                const qtyVal = buyQtyMap[listing._id] || 1;
                const avgPrice = priceGuide[listing.itemSnapshot.category]?.avgPrice;

                return (
                  <div
                    key={listing._id}
                    className="relative z-10 hover:z-50 flex flex-col justify-between rounded-2xl bg-card border border-border/70 hover:border-primary/40 p-5 shadow-sm hover:shadow-xl transition-all"
                  >
                    <div className="space-y-3.5">
                      {/* Top badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              isVoucher
                                ? "bg-teal-500/10 text-teal-400 border-teal-500/30"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            }`}
                          >
                            {isVoucher ? (
                              <>
                                <Ticket className="w-3 h-3" />
                                {VOUCHER_CATEGORY_SHORT_LABELS[
                                  normalizeVoucherCategoryKey(listing.itemSnapshot.category)
                                ]}
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="w-3 h-3" />
                                Tiket Penalti
                              </>
                            )}
                          </span>

                          {listing.isFlashDeal && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/40">
                              <Flame className="w-3 h-3" /> Flash Deal
                            </span>
                          )}
                        </div>

                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground shrink-0">
                          <Eye className="w-3.5 h-3.5" />
                          {listing.views || 0}
                        </span>
                      </div>

                      {/* Title & Voucher Transparency Badges */}
                      <div>
                        <Link
                          href={`/community-market/${listing.slug}`}
                          className="text-base font-black text-foreground hover:text-primary transition-colors line-clamp-2"
                        >
                          {listing.itemSnapshot.title}
                        </Link>

                        {benefit ? (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="text-xs font-extrabold text-foreground bg-muted/60 px-2.5 py-1 rounded-lg">
                              {benefit.headline}
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 border ${
                                benefit.isUnlimitedCap
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              }`}
                            >
                              {benefit.isUnlimitedCap && <InfinityIcon className="w-3.5 h-3.5" />}
                              {benefit.capBadge}
                            </span>
                            {benefit.minSpendLabel && (
                              <span className="text-[11px] text-muted-foreground bg-muted/40 px-2 py-1 rounded-lg">
                                {benefit.minSpendLabel}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Stok tersedia:{" "}
                            <strong className="text-foreground">
                              {listing.remainingQuantity} / {listing.quantity} tiket
                            </strong>
                          </p>
                        )}
                      </div>

                      {/* Expiry metadata */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {isVoucher && listing.itemSnapshot.expiresAt && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            Voucher Exp: {formatWIBShort(listing.itemSnapshot.expiresAt)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Iklan s/d: {formatWIBShort(listing.expiresAt)}
                        </span>
                      </div>

                      {/* Seller info */}
                      <div className="pt-3 border-t border-border/50">
                        <MarketUserBadgeRow user={listing.seller} compact />
                      </div>
                    </div>

                    {/* Price & Action Footer */}
                    <div className="mt-4 pt-3.5 border-t border-border/50 space-y-3">
                      <div className="flex items-end justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Harga {!isVoucher ? "/ Tiket" : ""}
                          </p>
                          <p className="text-xl font-black text-primary tabular-nums">
                            {formatNCWhole(listing.unitPrice)}
                          </p>
                          {avgPrice > 0 && (
                            <p className="text-[10px] text-muted-foreground">
                              Avg 30h: {formatNCWhole(avgPrice)}
                            </p>
                          )}
                        </div>

                        <Link
                          href={`/community-market/${listing.slug}`}
                          className="text-xs font-bold text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                        >
                          Detail <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>

                      {isOwn ? (
                        <button
                          type="button"
                          disabled={busyId === listing._id}
                          onClick={() => handleCancelListing(listing)}
                          className="w-full py-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-black hover:bg-rose-500/20 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Batalkan Iklan Saya
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          {!isVoucher && listing.remainingQuantity > 1 && (
                            <input
                              type="number"
                              min={1}
                              max={listing.remainingQuantity}
                              value={qtyVal}
                              onChange={(e) =>
                                setBuyQtyMap((prev) => ({
                                  ...prev,
                                  [listing._id]: Math.max(
                                    1,
                                    Math.min(
                                      listing.remainingQuantity,
                                      Math.floor(Number(e.target.value) || 1)
                                    )
                                  ),
                                }))
                              }
                              className="w-16 px-2.5 py-2.5 rounded-xl bg-background border border-border text-xs font-black text-center"
                              title="Jumlah beli"
                            />
                          )}
                          <button
                            type="button"
                            disabled={busyId === listing._id || !config.enabled}
                            onClick={() => handleBuyListing(listing)}
                            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:opacity-90 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
                          >
                            {busyId === listing._id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ShoppingCart className="w-3.5 h-3.5" />
                            )}
                            Beli{" "}
                            {!isVoucher && qtyVal > 1
                              ? `${qtyVal}x (${formatNCWhole(listing.unitPrice * qtyVal)})`
                              : "Sekarang"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: BUY ORDERS */}
      {activeTab === "BUY_ORDERS" && (
        <div>
          {loadingFeed ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
              <p className="text-sm">Memuat daftar Buy Order...</p>
            </div>
          ) : buyOrders.length === 0 ? (
            <div className="py-16 text-center rounded-3xl bg-card/50 border border-dashed border-border/70 px-6">
              <HandCoins className="w-10 h-10 text-sky-400/50 mx-auto mb-3" />
              <h3 className="text-lg font-black text-foreground">Belum ada Buy Order aktif</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Sedang mencari Tiket Penghapus Penalti atau Voucher tertentu? Pasang Buy Order dengan Escrow NC supaya penjual bisa langsung mengirimkannya ke Anda!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {buyOrders.map((order) => {
                const isOwn = currentUser?.discordId === String(order.buyerDiscordId);
                const isVoucher = order.itemType === "VOUCHER";
                const c = order.criteria || {};

                return (
                  <div
                    key={order._id}
                    className="relative z-10 hover:z-50 flex flex-col justify-between rounded-2xl bg-card border border-sky-500/25 hover:border-sky-500/60 p-5 shadow-sm hover:shadow-xl transition-all"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/15 text-sky-400 border border-sky-500/30">
                          <HandCoins className="w-3 h-3" /> Buy Order · Escrow Terkunci
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Eye className="w-3.5 h-3.5" /> {order.views || 0}
                        </span>
                      </div>

                      <div>
                        <Link
                          href={`/community-market/${order.slug}`}
                          className="text-base font-black text-foreground hover:text-sky-400 transition-colors"
                        >
                          {order.title}
                        </Link>
                        {order.notes && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                            &ldquo;{order.notes}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <span className="px-2 py-0.5 rounded-lg bg-muted/60 font-bold text-foreground">
                          Butuh: {order.remainingQuantity} / {order.quantity} unit
                        </span>
                        {isVoucher && c.minRemainingDays && (
                          <span className="px-2 py-0.5 rounded-lg bg-muted/60 text-muted-foreground">
                            Min. sisa {c.minRemainingDays} hari
                          </span>
                        )}
                        {isVoucher && c.requireUnlimitedMaxDiscount && (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 font-bold inline-flex items-center gap-1">
                            <InfinityIcon className="w-3 h-3" /> Wajib Unlimited
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Berlaku s/d: {formatWIBShort(order.expiresAt)}
                      </div>

                      <div className="pt-3 border-t border-border/50">
                        <MarketUserBadgeRow
                          user={order.buyer}
                          showSellerStats={false}
                          compact
                        />
                      </div>
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-border/50 space-y-3">
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Tawaran Pembeli / Unit
                          </p>
                          <p className="text-xl font-black text-sky-400 tabular-nums">
                            {formatNCWhole(order.offerPrice)}
                          </p>
                        </div>
                        <Link
                          href={`/community-market/${order.slug}`}
                          className="text-xs font-bold text-muted-foreground hover:text-sky-400 inline-flex items-center gap-1"
                        >
                          Detail <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>

                      {isOwn ? (
                        <button
                          type="button"
                          disabled={busyId === order._id}
                          onClick={() => handleCancelBuyOrder(order)}
                          className="w-full py-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-black hover:bg-rose-500/20 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Batalkan & Tarik Escrow ({formatNCWhole(order.escrowRemaining)})
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!config.enabled}
                          onClick={() => {
                            if (!currentUser) {
                              router.push("/login");
                              return;
                            }
                            setFulfillTarget(order);
                          }}
                          className="w-full py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-black hover:bg-emerald-600 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Jual & Penuhi Pesanan Ini
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: MY ACTIVITY */}
      {activeTab === "MY_ACTIVITY" && currentUser && (
        <div className="space-y-6">
          {loadingMy && !myData ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Iklan Jual Saya */}
              <div className="rounded-2xl bg-card border border-border/70 p-5 space-y-4">
                <h3 className="text-base font-black text-foreground">
                  Iklan Jual Saya ({(myData?.myListings || []).length})
                </h3>
                {(myData?.myListings || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Belum ada riwayat iklan jual.</p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {(myData?.myListings || []).map((l: any) => (
                      <div
                        key={l._id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/community-market/${l.slug}`}
                            className="text-sm font-bold text-foreground hover:text-primary"
                          >
                            {l.itemSnapshot.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {formatNCWhole(l.unitPrice)} · Sisa {l.remainingQuantity}/{l.quantity} ·{" "}
                            {l.views || 0} dilihat · Exp {formatWIBShort(l.expiresAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                              l.status === "active"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : l.status === "sold"
                                  ? "bg-sky-500/15 text-sky-400"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {l.status}
                          </span>
                          {l.status === "active" && (
                            <button
                              type="button"
                              onClick={() => handleCancelListing(l)}
                              className="px-3 py-1 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-bold hover:bg-rose-500/20"
                            >
                              Batalkan
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Buy Order Saya */}
              <div className="rounded-2xl bg-card border border-border/70 p-5 space-y-4">
                <h3 className="text-base font-black text-foreground">
                  Buy Order Saya ({(myData?.myBuyOrders || []).length})
                </h3>
                {(myData?.myBuyOrders || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Belum ada riwayat Buy Order.</p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {(myData?.myBuyOrders || []).map((o: any) => (
                      <div
                        key={o._id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/community-market/${o.slug}`}
                            className="text-sm font-bold text-foreground hover:text-sky-400"
                          >
                            {o.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            Tawaran {formatNCWhole(o.offerPrice)} · Sisa {o.remainingQuantity}/{o.quantity} · Escrow{" "}
                            {formatNCWhole(o.escrowRemaining)} · Exp {formatWIBShort(o.expiresAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                              o.status === "active"
                                ? "bg-sky-500/15 text-sky-400"
                                : o.status === "fulfilled"
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {o.status}
                          </span>
                          {o.status === "active" && (
                            <button
                              type="button"
                              onClick={() => handleCancelBuyOrder(o)}
                              className="px-3 py-1 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-bold hover:bg-rose-500/20"
                            >
                              Batalkan & Refund
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Riwayat Transaksi & Ulasan */}
              <div className="rounded-2xl bg-card border border-border/70 p-5 space-y-4">
                <h3 className="text-base font-black text-foreground">
                  Riwayat Transaksi Selesai ({(myData?.myTrades || []).length})
                </h3>
                {(myData?.myTrades || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Belum ada transaksi selesai.</p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {(myData?.myTrades || []).map((t: any) => (
                      <div
                        key={t._id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                t.direction === "BUY"
                                  ? "bg-sky-500/15 text-sky-400"
                                  : "bg-emerald-500/15 text-emerald-400"
                              }`}
                            >
                              {t.direction === "BUY" ? "Beli" : "Jual"}
                            </span>
                            <p className="text-sm font-bold text-foreground truncate">
                              {t.quantity > 1 ? `${t.quantity}x ` : ""}
                              {t.itemSnapshot.title}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t.direction === "BUY"
                              ? `Bayar ${formatNCWhole(t.grossAmount)} dari ${t.seller?.name || "Driver"}`
                              : `Terima bersih ${formatNCWhole(t.netSellerPayout)} (Pajak ${t.feePercent}%: ${formatNCWhole(t.feeAmount)})`}
                            {" · "}
                            {formatWIBShort(t.createdAt)}
                          </p>
                        </div>

                        {t.direction === "BUY" && (
                          <div className="shrink-0">
                            {t.isRated ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Sudah Diulas
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setRateTarget({
                                    tradeId: t._id,
                                    itemTitle: t.itemSnapshot.title,
                                    sellerName: t.seller?.name,
                                  })
                                }
                                className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-black text-xs font-black hover:bg-amber-400 inline-flex items-center gap-1.5"
                              >
                                <Star className="w-3.5 h-3.5 fill-black" />
                                Beri Rating
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateListingModal
        open={createListingOpen}
        initialItemType={createListingInitialType}
        onClose={() => setCreateListingOpen(false)}
        onSuccess={() => {
          refreshActiveTab();
          fetchMyActivity();
        }}
      />

      <CreateBuyOrderModal
        open={createBuyOrderOpen}
        onClose={() => setCreateBuyOrderOpen(false)}
        onSuccess={() => {
          setActiveTab("BUY_ORDERS");
          fetchBuyOrders();
          fetchMyActivity();
        }}
      />

      <FulfillBuyOrderModal
        open={Boolean(fulfillTarget)}
        buyOrder={fulfillTarget}
        onClose={() => setFulfillTarget(null)}
        onSuccess={() => {
          fetchBuyOrders();
          fetchMyActivity();
        }}
      />

      <RateSellerModal
        open={Boolean(rateTarget)}
        tradeId={rateTarget?.tradeId || null}
        itemTitle={rateTarget?.itemTitle}
        sellerName={rateTarget?.sellerName}
        onClose={() => setRateTarget(null)}
        onSuccess={() => {
          fetchMyActivity();
          refreshActiveTab();
        }}
      />
    </div>
  );
}
