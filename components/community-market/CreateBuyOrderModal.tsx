"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Search,
  ShieldAlert,
  Ticket,
  Coins,
  Clock,
  Lock,
  Loader2,
  Infinity as InfinityIcon,
} from "lucide-react";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { showAlert } from "@/lib/dialog";
import {
  type CommunityMarketConfig,
  type CommunityMarketItemType,
  type VoucherCategoryKey,
  VOUCHER_CATEGORY_LABELS,
  calculateFairPriceRange,
  resolveListingDurationFee,
  formatNCWhole,
} from "@/lib/communityMarketShared";

interface CreateBuyOrderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const VOUCHER_CATEGORIES: VoucherCategoryKey[] = [
  "FLEET_BUY",
  "FLEET_MAINTENANCE",
  "GARAGE_RENT",
  "MARKET_MOD",
  "NC_BOOSTER",
];

export default function CreateBuyOrderModal({
  open,
  onClose,
  onSuccess,
}: CreateBuyOrderModalProps) {
  const router = useRouter();
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [config, setConfig] = useState<CommunityMarketConfig | null>(null);
  const [balance, setBalance] = useState(0);
  const [freeListing, setFreeListing] = useState<{ eligible: boolean; reason: string | null }>({
    eligible: false,
    reason: null,
  });
  const [safeboxFreeSlots, setSafeboxFreeSlots] = useState(0);

  const [itemType, setItemType] = useState<CommunityMarketItemType>("PENALTY_TICKET");
  const [category, setCategory] = useState<VoucherCategoryKey>("FLEET_BUY");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [minDiscountValue, setMinDiscountValue] = useState<number>(25);
  const [minDurationHours, setMinDurationHours] = useState<number>(2);
  const [minRemainingDays, setMinRemainingDays] = useState<number>(3);
  const [requireUnlimited, setRequireUnlimited] = useState<boolean>(true);
  const [quantity, setQuantity] = useState<number>(1);
  const [offerPrice, setOfferPrice] = useState<string>("");
  const [durationDays, setDurationDays] = useState<7 | 14 | 30>(7);
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingData(true);
    fetch("/api/community-market/my", { ...NO_CACHE_FETCH_OPTIONS })
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data.success) return;
        setConfig(data.config);
        setBalance(data.balance || 0);
        setFreeListing(data.freeListing || { eligible: false, reason: null });
        const g = data.garage;
        if (g?.exists && g.status !== "suspended") {
          setSafeboxFreeSlots(
            Math.max(
              0,
              (g.safeboxCapacity || 10) -
                (g.safeboxStock || 0) -
                (g.pendingBuyOrderTickets || 0)
            )
          );
        } else {
          setSafeboxFreeSlots(0);
        }
      })
      .catch((err) => console.error("Failed loading buy order data:", err))
      .finally(() => {
        if (active) setLoadingData(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  const fairRange = useMemo(() => {
    if (!config) return null;
    if (itemType === "PENALTY_TICKET") {
      return calculateFairPriceRange(config, { itemType: "PENALTY_TICKET" });
    }
    return calculateFairPriceRange(config, {
      itemType: "VOUCHER",
      category,
      discountType: category === "NC_BOOSTER" ? "percentage" : discountType,
      discountValue: minDiscountValue,
      durationHours: category === "NC_BOOSTER" ? minDurationHours : 0,
    });
  }, [config, itemType, category, discountType, minDiscountValue, minDurationHours]);

  useEffect(() => {
    if (!fairRange) return;
    setOfferPrice(String(Math.round((fairRange.minPrice + fairRange.maxPrice) / 2)));
  }, [fairRange]);

  const numericOffer = Math.round(Number(offerPrice) || 0);
  const effectiveQty = Math.max(1, Math.min(20, Math.floor(quantity || 1)));
  const escrowTotal = numericOffer * effectiveQty;
  const listingFee = config
    ? resolveListingDurationFee(config, "BUY_ORDER", durationDays, freeListing.eligible)
    : 0;
  const totalDeduct = escrowTotal + listingFee;

  const isPriceValid =
    fairRange !== null &&
    numericOffer >= fairRange.minPrice &&
    numericOffer <= fairRange.maxPrice;

  const safeboxOk = itemType !== "PENALTY_TICKET" || safeboxFreeSlots >= effectiveQty;

  const canSubmit =
    !submitting &&
    !loadingData &&
    isPriceValid &&
    safeboxOk &&
    balance >= totalDeduct;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/community-market/buy-orders", {
        method: "POST",
        ...NO_CACHE_FETCH_OPTIONS,
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemType,
          quantity: effectiveQty,
          offerPrice: numericOffer,
          durationDays,
          notes,
          criteria:
            itemType === "VOUCHER"
              ? {
                  category,
                  discountType: category === "NC_BOOSTER" ? "percentage" : discountType,
                  minDiscountValue,
                  minDurationHours: category === "NC_BOOSTER" ? minDurationHours : 0,
                  minRemainingDays,
                  requireUnlimitedMaxDiscount:
                    category !== "NC_BOOSTER" &&
                    discountType === "percentage" &&
                    requireUnlimited,
                }
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal membuat Buy Order.");
      }
      await showAlert(data.message || "Buy Order berhasil dibuat!");
      router.refresh();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      await showAlert(err.message || "Gagal membuat Buy Order.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-card/95 backdrop-blur border-b border-border/60">
          <div>
            <h2 className="text-lg font-black text-foreground flex items-center gap-2">
              <Search className="w-5 h-5 text-sky-400" />
              Buat Buy Order (Dicari)
            </h2>
            <p className="text-xs text-muted-foreground">
              Saldo tersedia: <strong className="text-foreground">{formatNCWhole(balance)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loadingData ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
            <p className="text-sm">Menyiapkan formulir Buy Order...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Pilih Jenis Item */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setItemType("PENALTY_TICKET")}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  itemType === "PENALTY_TICKET"
                    ? "bg-rose-500/10 border-rose-500/50 text-foreground"
                    : "bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Tiket Penalti
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Slot Safebox kosong: <strong className="text-foreground">{safeboxFreeSlots}</strong>
                </p>
              </button>

              <button
                type="button"
                onClick={() => setItemType("VOUCHER")}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  itemType === "VOUCHER"
                    ? "bg-teal-500/10 border-teal-500/50 text-foreground"
                    : "bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Ticket className="w-4 h-4 text-teal-400" />
                  Voucher Driver
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Tentukan kriteria diskon / booster
                </p>
              </button>
            </div>

            {itemType === "PENALTY_TICKET" ? (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Jumlah Tiket Dicari (Slot kosong: {safeboxFreeSlots})
                </label>
                {safeboxFreeSlots < 1 ? (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                    Safebox Anda penuh atau belum aktif. Upgrade Safebox di menu Garasi terlebih dahulu.
                  </div>
                ) : (
                  <input
                    type="number"
                    min={1}
                    max={Math.min(20, safeboxFreeSlots)}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(
                        Math.min(
                          Math.min(20, safeboxFreeSlots),
                          Math.max(1, Math.floor(Number(e.target.value) || 1))
                        )
                      )
                    }
                    className="w-32 px-3 py-2 rounded-xl bg-background border border-border text-sm font-bold text-foreground"
                  />
                )}
              </div>
            ) : (
              <div className="space-y-4 p-4 rounded-xl bg-muted/30 border border-border/60">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Kategori Voucher
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {VOUCHER_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setCategory(cat);
                          if (cat === "NC_BOOSTER") {
                            setDiscountType("percentage");
                            setMinDiscountValue(50);
                          }
                        }}
                        className={`px-3 py-2 rounded-lg border text-xs font-bold text-left transition-all ${
                          category === cat
                            ? "bg-primary/15 border-primary text-foreground"
                            : "bg-background/60 border-border/60 text-muted-foreground"
                        }`}
                      >
                        {VOUCHER_CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {category === "NC_BOOSTER" ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-muted-foreground">
                          Min. Bonus Boost (%)
                        </label>
                        <input
                          type="number"
                          min={10}
                          max={200}
                          value={minDiscountValue}
                          onChange={(e) => setMinDiscountValue(Math.max(10, Number(e.target.value) || 10))}
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-muted-foreground">
                          Min. Durasi (Jam)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={48}
                          value={minDurationHours}
                          onChange={(e) => setMinDurationHours(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-bold"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-muted-foreground">
                          Tipe Diskon
                        </label>
                        <select
                          value={discountType}
                          onChange={(e) => {
                            const next = e.target.value as "percentage" | "fixed";
                            setDiscountType(next);
                            setMinDiscountValue(next === "fixed" ? 5000 : 25);
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-bold"
                        >
                          <option value="percentage">Persentase (%)</option>
                          <option value="fixed">Nominal Tetap (NC)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-muted-foreground">
                          Min. Nilai {discountType === "fixed" ? "(NC)" : "(%)"}
                        </label>
                        <input
                          type="number"
                          min={discountType === "fixed" ? 500 : 5}
                          max={discountType === "fixed" ? 100000 : 100}
                          value={minDiscountValue}
                          onChange={(e) => setMinDiscountValue(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-bold"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-muted-foreground">
                      Min. Sisa Masa Aktif (Hari)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={minRemainingDays}
                      onChange={(e) => setMinRemainingDays(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-muted-foreground">
                      Jumlah Voucher Dicari
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(Math.min(10, Math.max(1, Math.floor(Number(e.target.value) || 1))))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-bold"
                    />
                  </div>
                </div>

                {category !== "NC_BOOSTER" && discountType === "percentage" && (
                  <label className="flex items-center gap-2.5 text-xs font-semibold text-foreground cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={requireUnlimited}
                      onChange={(e) => setRequireUnlimited(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <span className="inline-flex items-center gap-1">
                      <InfinityIcon className="w-3.5 h-3.5 text-emerald-400" />
                      Wajib voucher Tanpa Batas Potongan (Unlimited)
                    </span>
                  </label>
                )}
              </div>
            )}

            {/* Harga Tawaran */}
            {fairRange && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Harga Tawaran per 1 Unit (NC)
                  </label>
                  <span className="text-[11px] font-semibold text-sky-400">
                    Rentang Wajar: {formatNCWhole(fairRange.minPrice)} – {formatNCWhole(fairRange.maxPrice)}
                  </span>
                </div>
                <div className="relative">
                  <Coins className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min={fairRange.minPrice}
                    max={fairRange.maxPrice}
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    className={`w-full pl-10 pr-14 py-2.5 rounded-xl bg-background border text-sm font-bold text-foreground focus:outline-none focus:ring-2 ${
                      isPriceValid
                        ? "border-border focus:ring-sky-500/50"
                        : "border-rose-500 focus:ring-rose-500/40"
                    }`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    NC
                  </span>
                </div>
                {!isPriceValid && numericOffer > 0 && (
                  <p className="text-xs text-rose-400">
                    Harga tawaran harus berada di antara {formatNCWhole(fairRange.minPrice)} hingga{" "}
                    {formatNCWhole(fairRange.maxPrice)}.
                  </p>
                )}
              </div>
            )}

            {/* Durasi Buy Order */}
            {config && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Durasi Tayang Buy Order
                  </label>
                  {freeListing.eligible && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Gratis (
                      {freeListing.reason === "BOTH"
                        ? "Nismara+ & Booster"
                        : freeListing.reason === "NISMARA_PLUS"
                          ? "Nismara+"
                          : "Server Booster"}
                      )
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {([7, 14, 30] as const).map((days) => {
                    const fee = resolveListingDurationFee(
                      config,
                      "BUY_ORDER",
                      days,
                      freeListing.eligible
                    );
                    const baseFee = config.buyOrderDurations[days];
                    return (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setDurationDays(days)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          durationDays === days
                            ? "bg-sky-500/15 border-sky-500 text-foreground"
                            : "bg-background/60 border-border/60 text-muted-foreground"
                        }`}
                      >
                        <p className="text-sm font-black">{days} Hari</p>
                        <p className="text-[11px] font-bold mt-0.5">
                          {fee === 0 ? (
                            <span className="text-emerald-400">
                              Gratis
                              {freeListing.eligible && baseFee > 0 && (
                                <span className="line-through text-muted-foreground ml-1 font-normal">
                                  {baseFee.toLocaleString("id-ID")}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-amber-400">{formatNCWhole(fee)}</span>
                          )}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Catatan opsional */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Catatan Tambahan (Opsional)
              </label>
              <input
                type="text"
                maxLength={240}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Butuh cepat buat beli armada bus baru minggu ini"
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground"
              />
            </div>

            {/* Ringkasan Escrow */}
            <div className="rounded-xl bg-sky-500/5 border border-sky-500/25 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-sky-400" />
                  Dana Escrow Belanja ({effectiveQty} × {formatNCWhole(numericOffer)})
                </span>
                <span className="font-bold text-foreground">{formatNCWhole(escrowTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Biaya Pasang Iklan ({durationDays} Hari · Non-Refundable)</span>
                <span className="font-bold text-amber-400">
                  {listingFee === 0 ? "Gratis" : formatNCWhole(listingFee)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-sky-500/20 text-sm">
                <span className="font-bold text-foreground">Total Dipotong Sekarang</span>
                <span className="font-black text-sky-400">{formatNCWhole(totalDeduct)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                Dana <strong>Escrow ({formatNCWhole(escrowTotal)})</strong> dikembalikan <strong>100%</strong> ke dompet Anda jika Buy Order dibatalkan atau kedaluwarsa. Hanya biaya jasa pasang iklan yang tidak kembali.
              </p>
            </div>

            {balance < totalDeduct && (
              <p className="text-xs text-rose-400 font-semibold">
                Saldo NC tidak mencukupi. Anda butuh {formatNCWhole(totalDeduct)}.
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-5 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-black hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Terbitkan Buy Order
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
