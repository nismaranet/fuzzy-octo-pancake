"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  CheckCircle2,
  Loader2,
  Infinity as InfinityIcon,
  AlertCircle,
} from "lucide-react";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { showAlert } from "@/lib/dialog";
import {
  formatNCWhole,
  formatWIBShort,
  formatVoucherBenefitSummary,
} from "@/lib/communityMarketShared";

interface FulfillBuyOrderModalProps {
  open: boolean;
  buyOrder: any | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function FulfillBuyOrderModal({
  open,
  buyOrder,
  onClose,
  onSuccess,
}: FulfillBuyOrderModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [safeboxStock, setSafeboxStock] = useState(0);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [feePercent, setFeePercent] = useState(11);
  const [minVoucherRemainingHours, setMinVoucherRemainingHours] = useState(24);

  const [quantity, setQuantity] = useState(1);
  const [selectedVoucherId, setSelectedVoucherId] = useState("");

  useEffect(() => {
    if (!open || !buyOrder) return;
    setQuantity(1);
    setSelectedVoucherId("");
    let active = true;
    setLoading(true);
    fetch("/api/community-market/my", { ...NO_CACHE_FETCH_OPTIONS })
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data.success) return;
        setSafeboxStock(data.garage?.safeboxStock || 0);
        setVouchers(data.tradableVouchers || []);
        setFeePercent(data.config?.transactionFeePercent ?? 11);
        setMinVoucherRemainingHours(data.config?.minVoucherRemainingHours ?? 24);
      })
      .catch((err) => console.error("Failed loading fulfill data:", err))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, buyOrder]);

  const eligibleVouchers = useMemo(() => {
    if (!buyOrder || buyOrder.itemType !== "VOUCHER") return [];
    const c = buyOrder.criteria || {};
    const requiredHours = Math.max(
      minVoucherRemainingHours,
      (Number(c.minRemainingDays) || 1) * 24
    );

    const normCat = (x?: string) => (x === "GARAGE_UPGRADE" ? "GARAGE_RENT" : x || "");

    return vouchers.filter((v) => {
      if (c.category && normCat(v.category) !== normCat(c.category)) return false;
      if (c.discountType && c.discountType !== "any" && v.category !== "NC_BOOSTER") {
        if (v.discountType !== c.discountType) return false;
      }
      if (c.minDiscountValue && Number(v.discountValue || 0) < Number(c.minDiscountValue)) {
        return false;
      }
      if (
        v.category === "NC_BOOSTER" &&
        c.minDurationHours &&
        Number(v.durationHours || 0) < Number(c.minDurationHours)
      ) {
        return false;
      }
      if (c.requireUnlimitedMaxDiscount && Number(v.maxDiscount || 0) > 0) {
        return false;
      }
      if (v.expiresAt) {
        const remMs = new Date(v.expiresAt).getTime() - Date.now();
        if (remMs < requiredHours * 3600 * 1000) return false;
      }
      return true;
    });
  }, [buyOrder, vouchers, minVoucherRemainingHours]);

  useEffect(() => {
    if (eligibleVouchers.length > 0 && !selectedVoucherId) {
      setSelectedVoucherId(eligibleVouchers[0]._id);
    }
  }, [eligibleVouchers, selectedVoucherId]);

  if (!open || !buyOrder) return null;

  const maxSellableQty =
    buyOrder.itemType === "PENALTY_TICKET"
      ? Math.min(buyOrder.remainingQuantity, safeboxStock)
      : 1;
  const effectiveQty =
    buyOrder.itemType === "VOUCHER"
      ? 1
      : Math.max(1, Math.min(maxSellableQty || 1, quantity));
  const gross = buyOrder.offerPrice * effectiveQty;
  const tax = Math.round(gross * (feePercent / 100));
  const net = Math.max(0, gross - tax);

  const canSubmit =
    !submitting &&
    !loading &&
    (buyOrder.itemType === "PENALTY_TICKET"
      ? maxSellableQty >= 1 && effectiveQty <= maxSellableQty
      : Boolean(selectedVoucherId));

  const handleFulfill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/community-market/buy-orders/${buyOrder._id}/fulfill`,
        {
          method: "POST",
          ...NO_CACHE_FETCH_OPTIONS,
          headers: {
            ...NO_CACHE_FETCH_OPTIONS.headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            quantity: effectiveQty,
            voucherId: buyOrder.itemType === "VOUCHER" ? selectedVoucherId : undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memenuhi Buy Order.");
      }
      await showAlert(data.message || "Buy Order berhasil dipenuhi!");
      router.refresh();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      await showAlert(err.message || "Gagal memenuhi Buy Order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div>
            <h2 className="text-lg font-black text-foreground">Penuhi Buy Order</h2>
            <p className="text-xs text-muted-foreground">{buyOrder.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs">Memeriksa item yang cocok di inventaris Anda...</p>
          </div>
        ) : (
          <form onSubmit={handleFulfill} className="p-6 space-y-5">
            {buyOrder.itemType === "PENALTY_TICKET" ? (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Jumlah Tiket yang Dijual (Stok Anda: {safeboxStock} · Diminta: {buyOrder.remainingQuantity})
                </label>
                {maxSellableQty < 1 ? (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Anda belum memiliki stok Tiket Penghapus Penalti di Safebox.
                  </div>
                ) : (
                  <input
                    type="number"
                    min={1}
                    max={maxSellableQty}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(
                        Math.min(maxSellableQty, Math.max(1, Math.floor(Number(e.target.value) || 1)))
                      )
                    }
                    className="w-32 px-3 py-2 rounded-xl bg-background border border-border text-sm font-bold"
                  />
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Voucher Anda yang Memenuhi Kriteria ({eligibleVouchers.length})
                </label>
                {eligibleVouchers.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Anda belum memiliki voucher tradable yang memenuhi seluruh kriteria pembeli ini (kategori, nilai minimal, ketentuan unlimited, dan sisa masa aktif).
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {eligibleVouchers.map((v) => {
                      const b = formatVoucherBenefitSummary(v);
                      const selected = v._id === selectedVoucherId;
                      return (
                        <button
                          key={v._id}
                          type="button"
                          onClick={() => setSelectedVoucherId(v._id)}
                          className={`w-full p-3 rounded-xl border text-left transition-all ${
                            selected
                              ? "bg-emerald-500/10 border-emerald-500/50"
                              : "bg-background/60 border-border/60"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-foreground truncate">
                              {v.title}
                            </span>
                            {selected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                            <span className="font-semibold text-foreground">{b.headline}</span>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                b.isUnlimitedCap
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-amber-500/15 text-amber-400"
                              }`}
                            >
                              {b.isUnlimitedCap && <InfinityIcon className="w-3 h-3" />}
                              {b.capBadge}
                            </span>
                            <span>
                              {v.expiresAt ? `Exp: ${formatWIBShort(v.expiresAt)}` : "Permanen"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Rincian Pencairan */}
            <div className="rounded-xl bg-muted/40 border border-border/60 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Harga Tawaran Pembeli ({effectiveQty} unit)</span>
                <span className="font-bold text-foreground">{formatNCWhole(gross)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Pajak Transaksi ({feePercent}%)</span>
                <span className="font-bold text-rose-400">-{formatNCWhole(tax)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border/60 text-sm">
                <span className="font-bold text-foreground">Dana Masuk ke Dompet Anda</span>
                <span className="font-black text-emerald-400">{formatNCWhole(net)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-black hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Kirim & Cairkan NC
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
