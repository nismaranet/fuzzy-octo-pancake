"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Star, Loader2 } from "lucide-react";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { showAlert } from "@/lib/dialog";
import { COMMUNITY_MARKET_REVIEW_TAGS_LIST } from "@/lib/communityMarketShared";

interface RateSellerModalProps {
  open: boolean;
  tradeId: string | null;
  itemTitle?: string;
  sellerName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RateSellerModal({
  open,
  tradeId,
  itemTitle,
  sellerName,
  onClose,
  onSuccess,
}: RateSellerModalProps) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>(["Transaksi Lancar"]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open || !tradeId) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 4 ? [...prev, tag] : prev
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/community-market/reviews", {
        method: "POST",
        ...NO_CACHE_FETCH_OPTIONS,
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tradeId,
          rating,
          tags: selectedTags,
          comment,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan ulasan.");
      }
      await showAlert(data.message || "Ulasan berhasil dikirim!");
      router.refresh();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      await showAlert(err.message || "Gagal menyimpan ulasan.");
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
        className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div>
            <h2 className="text-lg font-black text-foreground">Beri Rating Penjual</h2>
            <p className="text-xs text-muted-foreground truncate">
              {itemTitle || "Transaksi Community Market"}
              {sellerName ? ` · ${sellerName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Star Picker */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-9 h-9 ${
                        active ? "text-amber-400 fill-amber-400" : "text-muted-foreground/40"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <span className="text-xs font-bold text-amber-400">
              {rating === 5
                ? "Sangat Memuaskan"
                : rating === 4
                  ? "Bagus"
                  : rating === 3
                    ? "Cukup Baik"
                    : rating === 2
                      ? "Kurang Memuaskan"
                      : "Buruk"}
            </span>
          </div>

          {/* Preset Tags */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pilih Tag Cepat (Maks. 4)
            </label>
            <div className="flex flex-wrap gap-2">
              {COMMUNITY_MARKET_REVIEW_TAGS_LIST.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      active
                        ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                        : "bg-muted/30 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Komentar Opsional */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Komentar Singkat (Opsional)
            </label>
            <textarea
              rows={3}
              maxLength={200}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tulis pengalaman transaksi Anda..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground resize-none"
            />
          </div>

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted"
            >
              Nanti Saja
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-amber-500 text-black text-sm font-black hover:bg-amber-400 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Kirim Ulasan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
