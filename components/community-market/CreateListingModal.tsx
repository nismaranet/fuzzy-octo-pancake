"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Ticket,
  ShieldAlert,
  Sparkles,
  Coins,
  Clock,
  Info,
  CheckCircle2,
  Infinity as InfinityIcon,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { showAlert } from "@/lib/dialog";
import {
  type CommunityMarketConfig,
  type CommunityMarketItemType,
  calculateFairPriceRange,
  resolveListingDurationFee,
  getMaxAllowedVoucherListingDuration,
  formatNCWhole,
  formatWIBShort,
  formatVoucherBenefitSummary,
  VOUCHER_CATEGORY_SHORT_LABELS,
  type VoucherCategoryKey,
} from "@/lib/communityMarketShared";

export interface TradableVoucherOption {
  _id: string;
  code: string;
  title: string;
  description?: string;
  category: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  durationHours?: number;
  maxDiscount?: number;
  minSpend?: number;
  expiresAt?: string | null;
  source?: string;
  canListNow?: boolean;
  availableDurations?: Array<7 | 14 | 30>;
}

interface CreateListingModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialItemType?: CommunityMarketItemType;
  preselectedVoucherId?: string | null;
}

export default function CreateListingModal({
  open,
  onClose,
  onSuccess,
  initialItemType = "PENALTY_TICKET",
  preselectedVoucherId = null,
}: CreateListingModalProps) {
  const router = useRouter();
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [config, setConfig] = useState<CommunityMarketConfig | null>(null);
  const [balance, setBalance] = useState(0);
  const [freeListing, setFreeListing] = useState<{
    eligible: boolean;
    reason: string | null;
  }>({ eligible: false, reason: null });
  const [safeboxStock, setSafeboxStock] = useState(0);
  const [vouchers, setVouchers] = useState<TradableVoucherOption[]>([]);
  const [priceGuide, setPriceGuide] = useState<Record<string, any>>({});

  const [itemType, setItemType] = useState<CommunityMarketItemType>(initialItemType);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string>(
    preselectedVoucherId || ""
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [durationDays, setDurationDays] = useState<7 | 14 | 30>(7);

  useEffect(() => {
    if (!open) return;
    setItemType(preselectedVoucherId ? "VOUCHER" : initialItemType);
    if (preselectedVoucherId) setSelectedVoucherId(preselectedVoucherId);
    setQuantity(1);
    setDurationDays(7);

    let active = true;
    setLoadingData(true);
    fetch("/api/community-market/my", { ...NO_CACHE_FETCH_OPTIONS })
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data.success) return;
        setConfig(data.config);
        setBalance(data.balance || 0);
        setFreeListing(data.freeListing || { eligible: false, reason: null });
        setSafeboxStock(data.garage?.safeboxStock || 0);
        const vList: TradableVoucherOption[] = data.tradableVouchers || [];
        setVouchers(vList);
        setPriceGuide(data.priceGuide || {});

        if (preselectedVoucherId) {
          setSelectedVoucherId(preselectedVoucherId);
        } else if (vList.length > 0 && !selectedVoucherId) {
          const firstListable = vList.find((v) => v.canListNow !== false) || vList[0];
          setSelectedVoucherId(firstListable._id);
        }
      })
      .catch((err) => console.error("Failed loading sell modal data:", err))
      .finally(() => {
        if (active) setLoadingData(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialItemType, preselectedVoucherId]);

  const selectedVoucher = useMemo(
    () => vouchers.find((v) => v._id === selectedVoucherId) || null,
    [vouchers, selectedVoucherId]
  );

  const voucherDurationMeta = useMemo(() => {
    if (itemType !== "VOUCHER" || !selectedVoucher || !config) {
      return { availableDurations: [7, 14, 30] as Array<7 | 14 | 30>, canList: true };
    }
    return getMaxAllowedVoucherListingDuration(
      selectedVoucher.expiresAt,
      config.minVoucherRemainingHours
    );
  }, [itemType, selectedVoucher, config]);

  // Reset duration to 7 if current selection is no longer valid for selected voucher
  useEffect(() => {
    if (
      voucherDurationMeta.availableDurations.length > 0 &&
      !voucherDurationMeta.availableDurations.includes(durationDays)
    ) {
      setDurationDays(voucherDurationMeta.availableDurations[0]);
    }
  }, [voucherDurationMeta, durationDays]);

  const fairRange = useMemo(() => {
    if (!config) return null;
    if (itemType === "PENALTY_TICKET") {
      return calculateFairPriceRange(config, { itemType: "PENALTY_TICKET" });
    }
    if (!selectedVoucher) return null;
    return calculateFairPriceRange(config, {
      itemType: "VOUCHER",
      category: selectedVoucher.category,
      discountType: selectedVoucher.discountType,
      discountValue: selectedVoucher.discountValue,
      durationHours: selectedVoucher.durationHours,
      maxDiscount: selectedVoucher.maxDiscount,
    });
  }, [config, itemType, selectedVoucher]);

  // Set helpful suggested default price when fairRange changes
  useEffect(() => {
    if (!fairRange) return;
    const guideKey =
      itemType === "PENALTY_TICKET"
        ? "PENALTY_TICKET"
        : selectedVoucher?.category || "";
    const avg = priceGuide[guideKey]?.avgPrice;
    const suggested =
      avg && avg >= fairRange.minPrice && avg <= fairRange.maxPrice
        ? avg
        : Math.round((fairRange.minPrice + fairRange.maxPrice) / 2);
    setUnitPrice(String(suggested));
  }, [fairRange, itemType, selectedVoucher?._id, priceGuide]);

  const numericPrice = Math.round(Number(unitPrice) || 0);
  const effectiveQty = itemType === "VOUCHER" ? 1 : Math.max(1, quantity);
  const grossTotal = numericPrice * effectiveQty;
  const taxPercent = config?.transactionFeePercent ?? 11;
  const taxAmount = Math.round(grossTotal * (taxPercent / 100));
  const netPayout = Math.max(0, grossTotal - taxAmount);

  const listingFee = config
    ? resolveListingDurationFee(config, "SELL_LISTING", durationDays, freeListing.eligible)
    : 0;

  const currentGuide =
    itemType === "PENALTY_TICKET"
      ? priceGuide["PENALTY_TICKET"]
      : selectedVoucher
        ? priceGuide[selectedVoucher.category]
        : null;

  const isPriceValid =
    fairRange !== null &&
    numericPrice >= fairRange.minPrice &&
    numericPrice <= fairRange.maxPrice;

  const canSubmit =
    !submitting &&
    !loadingData &&
    isPriceValid &&
    balance >= listingFee &&
    (itemType === "PENALTY_TICKET"
      ? safeboxStock >= effectiveQty && effectiveQty >= 1
      : Boolean(selectedVoucher) && voucherDurationMeta.canList);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/community-market/listings", {
        method: "POST",
        ...NO_CACHE_FETCH_OPTIONS,
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemType,
          voucherId: itemType === "VOUCHER" ? selectedVoucherId : undefined,
          quantity: effectiveQty,
          unitPrice: numericPrice,
          durationDays,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memasang iklan.");
      }
      await showAlert(data.message || "Item berhasil dipajang di Community Market!");
      router.refresh();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      await showAlert(err.message || "Gagal memasang iklan.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const benefitMeta = selectedVoucher
    ? formatVoucherBenefitSummary(selectedVoucher)
    : null;

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
              <Sparkles className="w-5 h-5 text-primary" />
              Pasang Jual di Community Market
            </h2>
            <p className="text-xs text-muted-foreground">
              Saldo dompet Anda: <strong className="text-foreground">{formatNCWhole(balance)}</strong>
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
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <p className="text-sm">Memuat inventaris Anda...</p>
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
                    ? "bg-rose-500/10 border-rose-500/50 text-foreground shadow-sm"
                    : "bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Tiket Penalti
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Stok Safebox: <strong className="text-foreground">{safeboxStock} tiket</strong>
                </p>
              </button>

              <button
                type="button"
                onClick={() => setItemType("VOUCHER")}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  itemType === "VOUCHER"
                    ? "bg-teal-500/10 border-teal-500/50 text-foreground shadow-sm"
                    : "bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Ticket className="w-4 h-4 text-teal-400" />
                  Voucher Driver
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Tersedia dijual:{" "}
                  <strong className="text-foreground">
                    {vouchers.filter((v) => v.canListNow !== false).length} voucher
                  </strong>
                </p>
              </button>
            </div>

            {/* Pilihan Item Spesifik */}
            {itemType === "PENALTY_TICKET" ? (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Jumlah Tiket Dijual (Maks. {safeboxStock})
                </label>
                {safeboxStock < 1 ? (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                    Anda tidak memiliki stok Tiket Penghapus Penalti di Safebox Garasi.
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={Math.min(50, safeboxStock)}
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(
                          Math.min(
                            Math.min(50, safeboxStock),
                            Math.max(1, Math.floor(Number(e.target.value) || 1))
                          )
                        )
                      }
                      className="w-28 px-3 py-2 rounded-xl bg-background border border-border text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <span className="text-xs text-muted-foreground">
                      Pembeli dapat membeli satuan maupun borongan dari stok iklan Anda.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pilih Voucher yang Ingin Dijual
                </label>
                {vouchers.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
                    Tidak ada voucher aktif yang dapat diperdagangkan. (Voucher gaji manager bersifat eksklusif dan tidak dapat dijual).
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {vouchers.map((v) => {
                      const b = formatVoucherBenefitSummary(v);
                      const isSelected = v._id === selectedVoucherId;
                      const disabled = v.canListNow === false;
                      return (
                        <button
                          key={v._id}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSelectedVoucherId(v._id)}
                          className={`w-full p-3 rounded-xl border text-left transition-all ${
                            disabled
                              ? "opacity-50 cursor-not-allowed bg-muted/20 border-border/40"
                              : isSelected
                                ? "bg-teal-500/10 border-teal-500/50"
                                : "bg-background/60 border-border/60 hover:border-border"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">
                                {v.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                  {VOUCHER_CATEGORY_SHORT_LABELS[v.category as VoucherCategoryKey] ||
                                    v.category}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                    b.isUnlimitedCap
                                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                      : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                  }`}
                                >
                                  {b.isUnlimitedCap && <InfinityIcon className="w-3 h-3" />}
                                  {b.capBadge}
                                </span>
                              </div>
                            </div>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {v.expiresAt ? `Exp: ${formatWIBShort(v.expiresAt)}` : "Permanen"}
                            </span>
                          </div>
                          {disabled && (
                            <p className="text-[11px] text-rose-400 mt-1.5">
                              Sisa masa aktif kurang dari {config?.minVoucherRemainingHours ?? 24} jam — tidak dapat dijual.
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedVoucher && benefitMeta && (
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-muted-foreground">
                      Ketentuan yang tampil ke pembeli:{" "}
                      <strong className="text-foreground">{benefitMeta.headline}</strong> ·{" "}
                      <strong className={benefitMeta.isUnlimitedCap ? "text-emerald-400" : "text-amber-400"}>
                        {benefitMeta.capBadge}
                      </strong>
                      {benefitMeta.minSpendLabel ? ` · ${benefitMeta.minSpendLabel}` : ""}.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Harga Jual + Panduan Harga */}
            {fairRange && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Harga Jual {itemType === "PENALTY_TICKET" ? "per 1 Tiket" : "Voucher"} (NC)
                  </label>
                  <span className="text-[11px] font-semibold text-primary">
                    Rentang Wajar: {formatNCWhole(fairRange.minPrice)} – {formatNCWhole(fairRange.maxPrice)}
                  </span>
                </div>

                <div className="relative">
                  <Coins className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min={fairRange.minPrice}
                    max={fairRange.maxPrice}
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder={`${fairRange.minPrice} - ${fairRange.maxPrice}`}
                    className={`w-full pl-10 pr-14 py-2.5 rounded-xl bg-background border text-sm font-bold text-foreground focus:outline-none focus:ring-2 ${
                      isPriceValid
                        ? "border-border focus:ring-primary/50"
                        : "border-rose-500 focus:ring-rose-500/40"
                    }`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    NC
                  </span>
                </div>

                {!isPriceValid && numericPrice > 0 && (
                  <p className="text-xs text-rose-400">
                    Harga harus berada di antara {formatNCWhole(fairRange.minPrice)} hingga{" "}
                    {formatNCWhole(fairRange.maxPrice)}.
                  </p>
                )}

                {currentGuide && currentGuide.tradeCount > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-2 rounded-lg">
                    <TrendingUp className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>
                      Rata-rata laku 30 hari terakhir:{" "}
                      <strong className="text-foreground">
                        {formatNCWhole(currentGuide.avgPrice)}
                      </strong>{" "}
                      ({currentGuide.tradeCount} transaksi)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Durasi Iklan */}
            {config && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Durasi Tayang Iklan
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
                    const isAllowed = voucherDurationMeta.availableDurations.includes(days);
                    const fee = resolveListingDurationFee(
                      config,
                      "SELL_LISTING",
                      days,
                      freeListing.eligible
                    );
                    const baseFee = config.sellListingDurations[days];
                    const selected = durationDays === days;
                    return (
                      <button
                        key={days}
                        type="button"
                        disabled={!isAllowed}
                        onClick={() => setDurationDays(days)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          !isAllowed
                            ? "opacity-40 cursor-not-allowed bg-muted/20 border-border/40"
                            : selected
                              ? "bg-primary/15 border-primary text-foreground shadow-sm"
                              : "bg-background/60 border-border/60 text-muted-foreground hover:border-border"
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
                <p className="text-[11px] text-muted-foreground">
                  Biaya pasang iklan bersifat <strong>non-refundable</strong>. Voucher otomatis diturunkan {config.minVoucherRemainingHours} jam sebelum tanggal kedaluwarsa.
                </p>
              </div>
            )}

            {/* Kalkulator Transparansi Pajak 11% */}
            <div className="rounded-xl bg-muted/40 border border-border/60 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Total Harga Jual ({effectiveQty} unit)</span>
                <span className="font-bold text-foreground">{formatNCWhole(grossTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Pajak Transaksi Community Market ({taxPercent}%)</span>
                <span className="font-bold text-rose-400">-{formatNCWhole(taxAmount)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/60 text-sm">
                <span className="font-bold text-foreground">Estimasi Diterima Bersih</span>
                <span className="font-black text-emerald-400">{formatNCWhole(netPayout)}</span>
              </div>
              {listingFee > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-amber-400">
                  <span className="flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> Biaya Iklan Dibayar Sekarang
                  </span>
                  <span className="font-black">{formatNCWhole(listingFee)}</span>
                </div>
              )}
            </div>

            {balance < listingFee && (
              <p className="text-xs text-rose-400 font-semibold">
                Saldo NC Anda tidak mencukupi untuk biaya pasang iklan ({formatNCWhole(listingFee)}).
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
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-black hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Tayangkan Sekarang
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
