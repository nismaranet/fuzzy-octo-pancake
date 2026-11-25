"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  Clock,
  Share2,
  Check,
  ShoppingCart,
  Trash2,
  Star,
  Ticket,
  ShieldAlert,
  HandCoins,
  Infinity as InfinityIcon,
  TrendingUp,
  CheckCircle2,
  Loader2,
  Flame,
} from "lucide-react";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { showAlert, showConfirm } from "@/lib/dialog";
import {
  type CommunityMarketConfig,
  type VoucherCategoryKey,
  VOUCHER_CATEGORY_LABELS,
  formatNCWhole,
  formatWIBShort,
  formatVoucherBenefitSummary,
} from "@/lib/communityMarketShared";
import MarketUserBadgeRow from "./MarketUserBadgeRow";
import FulfillBuyOrderModal from "./FulfillBuyOrderModal";
import RateSellerModal from "./RateSellerModal";

interface CommunityMarketDetailClientProps {
  kind: "listing" | "buy_order";
  record: any;
  sellerReviews?: any[];
  priceGuide?: any | null;
  config: CommunityMarketConfig;
  currentUser: {
    discordId: string;
    isDriver: boolean;
  } | null;
}

export default function CommunityMarketDetailClient({
  kind,
  record,
  sellerReviews = [],
  priceGuide = null,
  config,
  currentUser,
}: CommunityMarketDetailClientProps) {
  const router = useRouter();
  const [views, setViews] = useState<number>(record.views || 0);
  const [copied, setCopied] = useState(false);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [fulfillOpen, setFulfillOpen] = useState(false);
  const [rateTarget, setRateTarget] = useState<{
    tradeId: string;
    itemTitle?: string;
    sellerName?: string;
  } | null>(null);

  // Deduplicated view counter hit on mount
  useEffect(() => {
    let active = true;
    fetch("/api/community-market/view", {
      method: "POST",
      ...NO_CACHE_FETCH_OPTIONS,
      headers: {
        ...NO_CACHE_FETCH_OPTIONS.headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: kind, id: record._id }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success && typeof data.views === "number") {
          setViews(data.views);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [kind, record._id]);

  const handleCopyShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isListing = kind === "listing";
  const isVoucher = record.itemType === "VOUCHER";
  const isActive = record.status === "active" && record.remainingQuantity > 0;
  const ownerDiscordId = isListing
    ? String(record.sellerDiscordId)
    : String(record.buyerDiscordId);
  const isOwner = currentUser?.discordId === ownerDiscordId;

  const benefit =
    isListing && isVoucher ? formatVoucherBenefitSummary(record.itemSnapshot) : null;

  const handleBuy = async () => {
    if (!currentUser) {
      router.push("/login");
      return;
    }
    const finalQty = isVoucher ? 1 : Math.max(1, Math.min(record.remainingQuantity, qty));
    const total = record.unitPrice * finalQty;
    const ok = await showConfirm(
      `Beli ${finalQty > 1 ? `${finalQty}x ` : ""}${record.itemSnapshot.title} seharga ${formatNCWhole(total)}?`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/community-market/listings/${record._id}/buy`, {
        method: "POST",
        ...NO_CACHE_FETCH_OPTIONS,
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity: finalQty }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Pembelian gagal.");
      await showAlert(data.message || "Pembelian berhasil!");
      router.refresh();
      if (data.tradeId) {
        setRateTarget({
          tradeId: data.tradeId,
          itemTitle: record.itemSnapshot.title,
          sellerName: record.seller?.name,
        });
      }
    } catch (err: any) {
      await showAlert(err.message || "Pembelian gagal.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    const ok = await showConfirm(
      isListing
        ? "Batalkan iklan jual ini? Sisa item akan kembali ke inventaris Anda (biaya pasang iklan tidak kembali)."
        : `Batalkan Buy Order ini? Sisa dana escrow ${formatNCWhole(record.escrowRemaining)} dikembalikan 100% ke dompet Anda (biaya pasang iklan tidak kembali).`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const endpoint = isListing
        ? `/api/community-market/listings/${record._id}`
        : `/api/community-market/buy-orders/${record._id}`;
      const res = await fetch(endpoint, {
        method: "DELETE",
        ...NO_CACHE_FETCH_OPTIONS,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Gagal membatalkan.");
      await showAlert(data.message || "Berhasil dibatalkan.");
      router.push("/community-market");
      router.refresh();
    } catch (err: any) {
      await showAlert(err.message || "Gagal membatalkan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/community-market"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Community Market
        </Link>

        <button
          type="button"
          onClick={handleCopyShare}
          className="px-3.5 py-2 rounded-xl bg-card border border-border/70 text-xs font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
          {copied ? "Link Disalin" : "Bagikan Link"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Specification Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl bg-card border border-border/70 p-6 md:p-8 shadow-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                    !isListing
                      ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                      : isVoucher
                        ? "bg-teal-500/15 text-teal-400 border-teal-500/30"
                        : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {!isListing ? (
                    <>
                      <HandCoins className="w-3.5 h-3.5" /> Buy Order (Dicari)
                    </>
                  ) : isVoucher ? (
                    <>
                      <Ticket className="w-3.5 h-3.5" />
                      {VOUCHER_CATEGORY_LABELS[
                        record.itemSnapshot.category as VoucherCategoryKey
                      ] || record.itemSnapshot.category}
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5" /> Tiket Penghapus Penalti
                    </>
                  )}
                </span>

                {record.isFlashDeal && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black uppercase bg-orange-500/20 text-orange-400 border border-orange-500/40">
                    <Flame className="w-3.5 h-3.5" /> Flash Deal
                  </span>
                )}

                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {record.status}
                </span>
              </div>

              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-muted/40 px-3 py-1 rounded-full">
                <Eye className="w-3.5 h-3.5 text-primary" />
                {views.toLocaleString("id-ID")} kali dilihat
              </span>
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground">
                {isListing ? record.itemSnapshot.title : record.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {isListing
                  ? record.itemSnapshot.description ||
                    "Item resmi Nismara Transport yang diperdagangkan antar-driver secara instan dan aman."
                  : record.notes ||
                    "Pembeli telah mengunci dana NC di escrow. Penjual yang memiliki item sesuai kriteria dapat langsung memenuhi pesanan ini."}
              </p>
            </div>

            {/* Voucher Benefit Transparency Panel */}
            {benefit && (
              <div className="p-4 rounded-2xl bg-muted/35 border border-border/60 space-y-2.5">
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  Ketentuan & Manfaat Voucher (100% Utuh)
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1.5 rounded-xl bg-background border border-border text-sm font-black text-foreground">
                    {benefit.headline}
                  </span>
                  <span
                    className={`px-3 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 border ${
                      benefit.isUnlimitedCap
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/35"
                        : "bg-amber-500/15 text-amber-400 border-amber-500/35"
                    }`}
                  >
                    {benefit.isUnlimitedCap && <InfinityIcon className="w-4 h-4" />}
                    {benefit.capBadge}
                  </span>
                  {benefit.minSpendLabel ? (
                    <span className="px-3 py-1.5 rounded-xl bg-background border border-border text-xs font-bold text-muted-foreground">
                      {benefit.minSpendLabel}
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-background border border-border text-xs font-bold text-muted-foreground">
                      Tanpa Min. Belanja
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Buy Order Criteria Panel */}
            {!isListing && isVoucher && record.criteria && (
              <div className="p-4 rounded-2xl bg-sky-500/5 border border-sky-500/20 space-y-2 text-xs">
                <p className="text-[11px] font-black uppercase tracking-widest text-sky-400">
                  Kriteria Voucher yang Dicari
                </p>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <div>
                    Kategori:{" "}
                    <strong className="text-foreground">
                      {VOUCHER_CATEGORY_LABELS[
                        record.criteria.category as VoucherCategoryKey
                      ] || record.criteria.category}
                    </strong>
                  </div>
                  <div>
                    Minimal Nilai:{" "}
                    <strong className="text-foreground">
                      {record.criteria.discountType === "fixed"
                        ? formatNCWhole(record.criteria.minDiscountValue)
                        : `${record.criteria.minDiscountValue}%`}
                      {record.criteria.minDurationHours > 0
                        ? ` (${record.criteria.minDurationHours}+ Jam)`
                        : ""}
                    </strong>
                  </div>
                  <div>
                    Min. Sisa Aktif:{" "}
                    <strong className="text-foreground">
                      {record.criteria.minRemainingDays || 2} Hari
                    </strong>
                  </div>
                  <div>
                    Ketentuan Cap:{" "}
                    <strong className="text-foreground">
                      {record.criteria.requireUnlimitedMaxDiscount
                        ? "Wajib Tanpa Batas (Unlimited)"
                        : "Bebas"}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-background/60 border border-border/60">
                <p className="text-muted-foreground">Stok / Kuota</p>
                <p className="font-black text-foreground mt-0.5">
                  {record.remainingQuantity} / {record.quantity} unit
                </p>
              </div>
              <div className="p-3 rounded-xl bg-background/60 border border-border/60">
                <p className="text-muted-foreground">Iklan Berakhir</p>
                <p className="font-bold text-foreground mt-0.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  {formatWIBShort(record.expiresAt)}
                </p>
              </div>
              {isListing && isVoucher && (
                <div className="p-3 rounded-xl bg-background/60 border border-border/60">
                  <p className="text-muted-foreground">Voucher Berlaku s/d</p>
                  <p className="font-bold text-amber-400 mt-0.5">
                    {record.itemSnapshot.expiresAt
                      ? formatWIBShort(record.itemSnapshot.expiresAt)
                      : "Permanen"}
                  </p>
                </div>
              )}
              {!isListing && (
                <div className="p-3 rounded-xl bg-background/60 border border-border/60">
                  <p className="text-muted-foreground">Sisa Dana Escrow</p>
                  <p className="font-black text-sky-400 mt-0.5">
                    {formatNCWhole(record.escrowRemaining)}
                  </p>
                </div>
              )}
            </div>

            {priceGuide && priceGuide.tradeCount > 0 && (
              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-2.5 text-xs">
                <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                <span className="text-muted-foreground">
                  Panduan Pasar 30 Hari Terakhir: Rata-rata laku{" "}
                  <strong className="text-foreground">{formatNCWhole(priceGuide.avgPrice)}</strong>{" "}
                  (Rentang {formatNCWhole(priceGuide.minSoldPrice)} –{" "}
                  {formatNCWhole(priceGuide.maxSoldPrice)} dari {priceGuide.tradeCount} transaksi).
                </span>
              </div>
            )}
          </div>

          {/* Seller Reviews List (for Sell Listings) */}
          {isListing && (
            <div className="rounded-3xl bg-card border border-border/70 p-6 space-y-4">
              <h2 className="text-base font-black text-foreground flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                Ulasan Terverifikasi Penjual ({sellerReviews.length})
              </h2>
              {sellerReviews.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Penjual ini belum memiliki ulasan. Ulasan hanya dapat diberikan oleh pembeli dari transaksi yang berhasil.
                </p>
              ) : (
                <div className="space-y-3">
                  {sellerReviews.map((rev) => (
                    <div
                      key={rev._id}
                      className="relative z-10 hover:z-50 p-4 rounded-2xl bg-background/60 border border-border/60 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <MarketUserBadgeRow
                          user={rev.buyer}
                          showSellerStats={false}
                          compact
                        />
                        <div className="flex items-center gap-0.5 shrink-0">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= rev.rating
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {rev.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {rev.tags.map((tag: string) => (
                            <span
                              key={tag}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {rev.comment && (
                        <p className="text-xs text-foreground/90">{rev.comment}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {formatWIBShort(rev.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Action Card */}
        <div className="space-y-5">
          <div className="rounded-3xl bg-card border border-border/70 p-6 shadow-xl space-y-5 sticky top-24">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isListing ? "Harga Jual" : "Tawaran Pembeli"} {!isVoucher ? "per 1 Tiket" : ""}
              </p>
              <p
                className={`text-3xl font-black mt-1 tabular-nums ${
                  isListing ? "text-primary" : "text-sky-400"
                }`}
              >
                {formatNCWhole(isListing ? record.unitPrice : record.offerPrice)}
              </p>
            </div>

            <div className="relative z-10 hover:z-50 p-4 rounded-2xl bg-muted/35 border border-border/60">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                {isListing ? "Penjual" : "Pemesan (Buy Order)"}
              </p>
              <MarketUserBadgeRow
                user={isListing ? record.seller : record.buyer}
                showSellerStats={isListing}
              />
            </div>

            {isActive ? (
              isOwner ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCancel}
                  className="w-full py-3 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/35 text-sm font-black hover:bg-rose-500/25 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {isListing ? "Batalkan Iklan Saya" : "Batalkan & Tarik Escrow"}
                </button>
              ) : isListing ? (
                <div className="space-y-3">
                  {!isVoucher && record.remainingQuantity > 1 && (
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-bold text-muted-foreground">
                        Jumlah Beli
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={record.remainingQuantity}
                        value={qty}
                        onChange={(e) =>
                          setQty(
                            Math.max(
                              1,
                              Math.min(
                                record.remainingQuantity,
                                Math.floor(Number(e.target.value) || 1)
                              )
                            )
                          )
                        }
                        className="w-24 px-3 py-2 rounded-xl bg-background border border-border text-sm font-black text-center"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={busy || !config.enabled}
                    onClick={handleBuy}
                    className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-black hover:opacity-90 disabled:opacity-40 inline-flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                    Beli Sekarang ({formatNCWhole(record.unitPrice * (isVoucher ? 1 : qty))})
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!config.enabled}
                  onClick={() => {
                    if (!currentUser) {
                      router.push("/login");
                      return;
                    }
                    setFulfillOpen(true);
                  }}
                  className="w-full py-3.5 rounded-xl bg-emerald-500 text-white text-sm font-black hover:bg-emerald-600 disabled:opacity-40 inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Jual & Penuhi Pesanan Ini
                </button>
              )
            ) : (
              <div className="p-3.5 rounded-xl bg-muted/50 text-center text-xs font-bold text-muted-foreground">
                Iklan ini sudah tidak aktif ({record.status}).
              </div>
            )}

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              Transaksi otomatis via sistem Escrow Nismara. Pajak transaksi {config.transactionFeePercent}% ditanggung penjual.
            </p>
          </div>
        </div>
      </div>

      <FulfillBuyOrderModal
        open={fulfillOpen}
        buyOrder={!isListing ? record : null}
        onClose={() => setFulfillOpen(false)}
        onSuccess={() => router.refresh()}
      />

      <RateSellerModal
        open={Boolean(rateTarget)}
        tradeId={rateTarget?.tradeId || null}
        itemTitle={rateTarget?.itemTitle}
        sellerName={rateTarget?.sellerName}
        onClose={() => setRateTarget(null)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
