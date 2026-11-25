"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Store,
  Save,
  RotateCcw,
  Coins,
  Flame,
  ShieldAlert,
  Ticket,
  SlidersHorizontal,
  ArrowUpRight,
  Loader2,
  Calculator,
  Clock,
  Sparkles,
} from "lucide-react";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { showAlert, showConfirm } from "@/lib/dialog";
import {
  type CommunityMarketConfig,
  type PercentageCategoryPricing,
  DEFAULT_COMMUNITY_MARKET_CONFIG,
  VOUCHER_CATEGORY_LABELS,
  calculateFairPriceRange,
  formatNCWhole,
} from "@/lib/communityMarketShared";

interface Stats {
  activeListings: number;
  activeBuyOrders: number;
  totalTrades: number;
  totalVolumeNC: number;
  totalTaxBurnNC: number;
  listingFeeBurnNC: number;
  totalNCBurned: number;
}

const PCT_CATEGORIES: Array<
  "FLEET_BUY" | "FLEET_MAINTENANCE" | "GARAGE_RENT" | "MARKET_MOD"
> = ["FLEET_BUY", "FLEET_MAINTENANCE", "GARAGE_RENT", "MARKET_MOD"];

export default function CommunityMarketConfigClient({
  initialConfig,
  initialStats,
}: {
  initialConfig: CommunityMarketConfig;
  initialStats: Stats;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<CommunityMarketConfig>(initialConfig);
  const [saving, setSaving] = useState(false);

  const updatePctCat = (
    cat: "FLEET_BUY" | "FLEET_MAINTENANCE" | "GARAGE_RENT" | "MARKET_MOD",
    field: keyof PercentageCategoryPricing,
    value: number
  ) => {
    setConfig((prev) => ({
      ...prev,
      voucherCategories: {
        ...prev.voucherCategories,
        [cat]: {
          ...prev.voucherCategories[cat],
          [field]: value,
        },
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/manage/community-market/config", {
        method: "PUT",
        ...NO_CACHE_FETCH_OPTIONS,
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan pengaturan.");
      }
      setConfig(data.config);
      await showAlert("Konfigurasi Community Market berhasil diperbarui!");
      router.refresh();
    } catch (err: any) {
      await showAlert(err.message || "Gagal menyimpan pengaturan.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    const ok = await showConfirm(
      "Kembalikan seluruh angka pengaturan ke nilai bawaan (Default)? Anda tetap perlu klik Simpan Perubahan untuk menerapkannya."
    );
    if (!ok) return;
    setConfig(DEFAULT_COMMUNITY_MARKET_CONFIG);
  };

  // Live Simulator previews
  const simulatorRows = useMemo(() => {
    return {
      fleetBuy: [10, 25, 50, 100].map((pct) => ({
        label: `Diskon ${pct}%`,
        range: calculateFairPriceRange(config, {
          itemType: "VOUCHER",
          category: "FLEET_BUY",
          discountType: "percentage",
          discountValue: pct,
        }),
      })),
      maintenance: [10, 25, 50, 100].map((pct) => ({
        label: `Diskon ${pct}%`,
        range: calculateFairPriceRange(config, {
          itemType: "VOUCHER",
          category: "FLEET_MAINTENANCE",
          discountType: "percentage",
          discountValue: pct,
        }),
      })),
      booster: [
        { label: "+50% (2 Jam)", pct: 50, hrs: 2 },
        { label: "+50% (6 Jam)", pct: 50, hrs: 6 },
        { label: "+100% (6 Jam)", pct: 100, hrs: 6 },
        { label: "+100% (12 Jam)", pct: 100, hrs: 12 },
      ].map((b) => ({
        label: b.label,
        range: calculateFairPriceRange(config, {
          itemType: "VOUCHER",
          category: "NC_BOOSTER",
          discountType: "percentage",
          discountValue: b.pct,
          durationHours: b.hrs,
        }),
      })),
    };
  }, [config]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-black uppercase tracking-widest mb-2">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Economy Control Center
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-2.5">
            <Store className="w-7 h-7 text-primary" />
            Pengaturan Community Market
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Atur batas harga wajar per item, pajak transaksi, biaya durasi iklan (Sell Listing & Buy Order terpisah), serta benefit Nismara+ & Booster secara dinamis.
          </p>
        </div>

        <Link
          href="/community-market"
          className="self-start md:self-auto px-4 py-2.5 rounded-xl bg-card border border-border text-xs font-bold text-foreground hover:border-primary/50 inline-flex items-center gap-1.5"
        >
          Lihat Community Market <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Live Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border/70">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Iklan & Buy Order Aktif
          </p>
          <p className="text-2xl font-black text-foreground mt-1 tabular-nums">
            {initialStats.activeListings}{" "}
            <span className="text-sm text-sky-400 font-bold">
              / {initialStats.activeBuyOrders} BO
            </span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/70">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Total Transaksi Selesai
          </p>
          <p className="text-2xl font-black text-emerald-400 mt-1 tabular-nums">
            {initialStats.totalTrades.toLocaleString("id-ID")}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/70">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Total Volume Perdagangan
          </p>
          <p className="text-xl font-black text-foreground mt-1 tabular-nums">
            {formatNCWhole(initialStats.totalVolumeNC)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-orange-500/30 bg-gradient-to-br from-card to-orange-500/5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" /> Total NC Burn (Pajak + Iklan)
          </p>
          <p className="text-xl font-black text-orange-400 mt-1 tabular-nums">
            {formatNCWhole(initialStats.totalNCBurned)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Pajak: {formatNCWhole(initialStats.totalTaxBurnNC)} · Iklan:{" "}
            {formatNCWhole(initialStats.listingFeeBurnNC)}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Global Settings & Tax */}
        <div className="rounded-2xl bg-card border border-border/70 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
            <div>
              <h2 className="text-base font-black text-foreground flex items-center gap-2">
                <Coins className="w-4 h-4 text-primary" />
                Pengaturan Umum & Pajak Transaksi
              </h2>
              <p className="text-xs text-muted-foreground">
                Kontrol status aktif fitur, pajak penjualan, dan ambang waktu voucher.
              </p>
            </div>
            <label className="inline-flex items-center gap-2.5 cursor-pointer px-3.5 py-2 rounded-xl bg-muted/40 border border-border">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-xs font-black uppercase tracking-wider text-foreground">
                {config.enabled ? "Market Aktif" : "Mode Pemeliharaan"}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                Pajak Transaksi Penjual (%)
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={config.transactionFeePercent}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    transactionFeePercent: Math.max(0, Math.min(50, Number(e.target.value) || 0)),
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                Min. Sisa Waktu Voucher Dijual (Jam)
              </label>
              <input
                type="number"
                min={1}
                max={168}
                value={config.minVoucherRemainingHours}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    minVoucherRemainingHours: Math.max(1, Number(e.target.value) || 24),
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                Ambang Badge Flash Deal (Jam)
              </label>
              <input
                type="number"
                min={6}
                max={336}
                value={config.flashDealThresholdHours}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    flashDealThresholdHours: Math.max(6, Number(e.target.value) || 72),
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Listing Duration Fees (Separated Sell Listing vs Buy Order) */}
        <div className="rounded-2xl bg-card border border-border/70 p-6 space-y-5">
          <div className="pb-4 border-b border-border/60">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Biaya Durasi Pasang Iklan (Non-Refundable)
            </h2>
            <p className="text-xs text-muted-foreground">
              Dipisahkan antara <strong>Sell Listing</strong> dan <strong>Buy Order</strong> agar suatu saat dapat diatur berbeda dengan mudah.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sell Listing Fees */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-3">
              <p className="text-xs font-black uppercase tracking-wider text-primary">
                Tarif Sell Listing (NC)
              </p>
              <div className="grid grid-cols-3 gap-3">
                {([7, 14, 30] as const).map((d) => (
                  <div key={d} className="space-y-1">
                    <label className="text-[11px] font-bold text-muted-foreground">
                      {d} Hari
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={config.sellListingDurations[d]}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          sellListingDurations: {
                            ...prev.sellListingDurations,
                            [d]: Math.max(0, Number(e.target.value) || 0),
                          },
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-bold"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Buy Order Fees */}
            <div className="p-4 rounded-xl bg-muted/30 border border-sky-500/25 space-y-3">
              <p className="text-xs font-black uppercase tracking-wider text-sky-400">
                Tarif Buy Order (NC)
              </p>
              <div className="grid grid-cols-3 gap-3">
                {([7, 14, 30] as const).map((d) => (
                  <div key={d} className="space-y-1">
                    <label className="text-[11px] font-bold text-muted-foreground">
                      {d} Hari
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={config.buyOrderDurations[d]}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          buyOrderDurations: {
                            ...prev.buyOrderDurations,
                            [d]: Math.max(0, Number(e.target.value) || 0),
                          },
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-bold"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            <label className="inline-flex items-center gap-2.5 text-xs font-bold text-foreground cursor-pointer px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <input
                type="checkbox"
                checked={config.freeListingForNismaraPlus}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    freeListingForNismaraPlus: e.target.checked,
                  }))
                }
                className="w-4 h-4 accent-emerald-500"
              />
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Gratis Semua Durasi untuk Nismara+
            </label>

            <label className="inline-flex items-center gap-2.5 text-xs font-bold text-foreground cursor-pointer px-3.5 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30">
              <input
                type="checkbox"
                checked={config.freeListingForBooster}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    freeListingForBooster: e.target.checked,
                  }))
                }
                className="w-4 h-4 accent-purple-500"
              />
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Gratis Semua Durasi untuk Discord Server Booster
            </label>
          </div>
        </div>

        {/* Section 3: Penalty Ticket Range */}
        <div className="rounded-2xl bg-card border border-border/70 p-6 space-y-4">
          <div className="pb-3 border-b border-border/60">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Rentang Harga Wajar: Tiket Penghapus Penalti (per 1 Tiket)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                Harga Minimum (NC)
              </label>
              <input
                type="number"
                min={100}
                value={config.penaltyTicket.minPrice}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    penaltyTicket: {
                      ...prev.penaltyTicket,
                      minPrice: Math.max(100, Number(e.target.value) || 100),
                    },
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                Harga Maksimum (NC)
              </label>
              <input
                type="number"
                min={200}
                value={config.penaltyTicket.maxPrice}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    penaltyTicket: {
                      ...prev.penaltyTicket,
                      maxPrice: Math.max(200, Number(e.target.value) || 200),
                    },
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Per-Category Voucher Pricing */}
        <div className="rounded-2xl bg-card border border-border/70 p-6 space-y-5">
          <div className="pb-3 border-b border-border/60">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <Ticket className="w-4 h-4 text-teal-400" />
              Rentang Harga Proporsional Per Kategori Voucher
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Rumus Voucher Persentase: <code className="text-primary">Max = min(Plafon, BaseMax + Diskon% × PerPersen)</code>. Khusus voucher dengan <code className="text-amber-400">maxDiscount &gt; 0</code> dari sumbernya, plafon otomatis tidak melebihi 90% dari batas potongan.
            </p>
          </div>

          <div className="space-y-4">
            {PCT_CATEGORIES.map((cat) => {
              const c = config.voucherCategories[cat];
              return (
                <div
                  key={cat}
                  className={`p-4 rounded-xl border space-y-3 ${
                    cat === "FLEET_BUY"
                      ? "bg-teal-500/5 border-teal-500/30"
                      : "bg-muted/25 border-border/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-foreground">
                      {VOUCHER_CATEGORY_LABELS[cat]}
                      {cat === "FLEET_BUY" && (
                        <span className="ml-2 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400">
                          High-Value Curve
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground">
                        Min Dasar (NC)
                      </label>
                      <input
                        type="number"
                        min={100}
                        value={c.baseMin}
                        onChange={(e) => updatePctCat(cat, "baseMin", Number(e.target.value) || 100)}
                        className="w-full px-2.5 py-2 rounded-lg bg-background border border-border text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground">
                        Base Max (NC)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={c.baseMax}
                        onChange={(e) => updatePctCat(cat, "baseMax", Number(e.target.value) || 0)}
                        className="w-full px-2.5 py-2 rounded-lg bg-background border border-border text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground">
                        +NC per 1%
                      </label>
                      <input
                        type="number"
                        min={10}
                        value={c.perPercentMax}
                        onChange={(e) =>
                          updatePctCat(cat, "perPercentMax", Number(e.target.value) || 10)
                        }
                        className="w-full px-2.5 py-2 rounded-lg bg-background border border-border text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground">
                        Plafon Max (NC)
                      </label>
                      <input
                        type="number"
                        min={500}
                        value={c.maxCap}
                        onChange={(e) => updatePctCat(cat, "maxCap", Number(e.target.value) || 500)}
                        className="w-full px-2.5 py-2 rounded-lg bg-background border border-border text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground">
                        Rasio Min (0.05-0.8)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min={0.05}
                        max={0.8}
                        value={c.minRatioOfMax}
                        onChange={(e) =>
                          updatePctCat(cat, "minRatioOfMax", Number(e.target.value) || 0.15)
                        }
                        className="w-full px-2.5 py-2 rounded-lg bg-background border border-border text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* NC_BOOSTER */}
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-3">
              <p className="text-sm font-black text-foreground">
                {VOUCHER_CATEGORY_LABELS.NC_BOOSTER}{" "}
                <span className="text-[11px] font-normal text-muted-foreground">
                  (1 Unit = +50% selama 2 Jam)
                </span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">
                    Min Dasar (NC)
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={config.voucherCategories.NC_BOOSTER.baseMin}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        voucherCategories: {
                          ...prev.voucherCategories,
                          NC_BOOSTER: {
                            ...prev.voucherCategories.NC_BOOSTER,
                            baseMin: Number(e.target.value) || 100,
                          },
                        },
                      }))
                    }
                    className="w-full px-2.5 py-2 rounded-lg bg-background border border-border text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">
                    Max per Unit (NC)
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={config.voucherCategories.NC_BOOSTER.maxPerUnit}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        voucherCategories: {
                          ...prev.voucherCategories,
                          NC_BOOSTER: {
                            ...prev.voucherCategories.NC_BOOSTER,
                            maxPerUnit: Number(e.target.value) || 100,
                          },
                        },
                      }))
                    }
                    className="w-full px-2.5 py-2 rounded-lg bg-background border border-border text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">
                    Plafon Max (NC)
                  </label>
                  <input
                    type="number"
                    min={500}
                    value={config.voucherCategories.NC_BOOSTER.maxCap}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        voucherCategories: {
                          ...prev.voucherCategories,
                          NC_BOOSTER: {
                            ...prev.voucherCategories.NC_BOOSTER,
                            maxCap: Number(e.target.value) || 500,
                          },
                        },
                      }))
                    }
                    className="w-full px-2.5 py-2 rounded-lg bg-background border border-border text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">
                    Rasio Min
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min={0.05}
                    max={0.8}
                    value={config.voucherCategories.NC_BOOSTER.minRatioOfMax}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        voucherCategories: {
                          ...prev.voucherCategories,
                          NC_BOOSTER: {
                            ...prev.voucherCategories.NC_BOOSTER,
                            minRatioOfMax: Number(e.target.value) || 0.15,
                          },
                        },
                      }))
                    }
                    className="w-full px-2.5 py-2 rounded-lg bg-background border border-border text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Simulator Preview */}
          <div className="rounded-xl bg-background/80 border border-primary/25 p-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Calculator className="w-4 h-4" />
              Live Price Range Simulator (Pratinjau Real-Time)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <p className="font-black text-teal-400">Dealer Armada (FLEET_BUY)</p>
                {simulatorRows.fleetBuy.map((r) => (
                  <div key={r.label} className="flex justify-between text-muted-foreground">
                    <span>{r.label}</span>
                    <span className="font-bold text-foreground tabular-nums">
                      {formatNCWhole(r.range.minPrice)} – {formatNCWhole(r.range.maxPrice)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <p className="font-black text-emerald-400">Servis Armada (MAINTENANCE)</p>
                {simulatorRows.maintenance.map((r) => (
                  <div key={r.label} className="flex justify-between text-muted-foreground">
                    <span>{r.label}</span>
                    <span className="font-bold text-foreground tabular-nums">
                      {formatNCWhole(r.range.minPrice)} – {formatNCWhole(r.range.maxPrice)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <p className="font-black text-amber-400">NC Booster</p>
                {simulatorRows.booster.map((r) => (
                  <div key={r.label} className="flex justify-between text-muted-foreground">
                    <span>{r.label}</span>
                    <span className="font-bold text-foreground tabular-nums">
                      {formatNCWhole(r.range.minPrice)} – {formatNCWhole(r.range.maxPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Save Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted inline-flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset ke Default
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-black hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Perubahan Konfigurasi
          </button>
        </div>
      </form>
    </div>
  );
}
