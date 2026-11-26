"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Crown,
  Check,
  Lock,
  Loader2,
  Ban,
  Clock,
} from "lucide-react";
import DecoratedAvatar from "@/components/profile/DecoratedAvatar";
import {
  AVATAR_DECORATION_ACCESS_MAP,
  AVATAR_DECORATION_CATEGORIES,
  AVATAR_DECORATION_RARITY_STYLES,
  STARTER_AVATAR_DECORATIONS,
  checkDecorationEligibility,
  getDecorationScheduleStatus,
  type AvatarDecorationCategory,
  type AvatarDecorationDef,
} from "@/lib/avatarDecorations";
import { updateAvatarDecoration } from "@/app/dashboard/settings/actions";
import { showAlert } from "@/lib/dialog";

interface AvatarDecorationPickerProps {
  avatarUrl: string;
  userName: string;
  decorations?: AvatarDecorationDef[];
  isNismaraPlus: boolean;
  isStaff?: boolean;
  isTopManager?: boolean;
  equippedId: string | null;
  onChangeEquipped: (nextId: string | null) => void;
}

function formatUntilWib(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} WIB`;
}

export default function AvatarDecorationPicker({
  avatarUrl,
  userName,
  decorations,
  isNismaraPlus,
  isStaff = false,
  isTopManager = false,
  equippedId,
  onChangeEquipped,
}: AvatarDecorationPickerProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | AvatarDecorationCategory
  >("all");
  const [previewId, setPreviewId] = useState<string | null>(equippedId);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPreviewId(equippedId);
  }, [equippedId]);

  const catalog = useMemo(() => {
    const base =
      decorations && decorations.length > 0
        ? decorations
        : STARTER_AVATAR_DECORATIONS;
    const now = new Date();
    // Tampilkan dekorasi yang aktif & sedang dalam jadwal (atau sedang terpasang oleh user)
    return base.filter((d) => {
      if (!d.isActive) return false;
      const sched = getDecorationScheduleStatus(d, now);
      return sched.withinWindow || d.id === equippedId;
    });
  }, [decorations, equippedId]);

  const filteredDecorations = useMemo(() => {
    if (selectedCategory === "all") return catalog;
    return catalog.filter((d) => d.category === selectedCategory);
  }, [catalog, selectedCategory]);

  const eligibilityCtx = useMemo(
    () => ({ isNismaraPlus, isStaff, isTopManager }),
    [isNismaraPlus, isStaff, isTopManager],
  );

  const activePreviewDef = useMemo(
    () => catalog.find((d) => d.id === previewId) || null,
    [catalog, previewId],
  );

  const previewEligibility = useMemo(() => {
    if (!previewId) return { allowed: true };
    return checkDecorationEligibility(activePreviewDef, eligibilityCtx);
  }, [previewId, activePreviewDef, eligibilityCtx]);

  const isDirty = previewId !== equippedId;

  const handleApply = async () => {
    if (!previewEligibility.allowed) return;
    setIsSaving(true);
    try {
      const res = await updateAvatarDecoration(previewId);
      if (res.success) {
        onChangeEquipped(res.avatarDecoration ?? null);
        router.refresh();
        await showAlert(res.message);
      } else {
        await showAlert(res.message || "Gagal memperbarui dekorasi avatar.");
      }
    } catch (err) {
      console.error("Apply decoration error:", err);
      await showAlert("Terjadi kesalahan saat memasang dekorasi avatar.");
    } finally {
      setIsSaving(false);
    }
  };

  // Kategori yang memiliki minimal 1 item (+ "Semua")
  const visibleCategories = useMemo(() => {
    const present = new Set(catalog.map((d) => d.category));
    return AVATAR_DECORATION_CATEGORIES.filter(
      (c) => c.id === "all" || present.has(c.id),
    );
  }, [catalog]);

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-[2rem] border-border/50 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Dekorasi Avatar
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30">
              {catalog.length} Tersedia
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pilih bingkai avatar dari koleksi Gratis, Event, Nismara+, Staff, hingga Top Manager.
          </p>
        </div>

        {!isNismaraPlus && (
          <Link
            href="/dashboard/nismaraplus"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-bold transition-colors shrink-0"
          >
            <Crown className="w-3.5 h-3.5" />
            Buka Koleksi Nismara+
          </Link>
        )}
      </div>

      {/* Live Preview Stage */}
      <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-background/50 border border-border/60">
        <div className="p-3">
          <DecoratedAvatar
            src={avatarUrl || "/placeholder-avatar.png"}
            alt={userName || "Driver"}
            decoration={activePreviewDef}
            forcePreview
            sizeClass="w-24 h-24 sm:w-28 sm:h-28"
            frameClass="border-[3px] border-background"
          />
        </div>

        <div className="flex-1 text-center sm:text-left min-w-0 space-y-2">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <h3 className="text-base font-bold text-foreground">
              {activePreviewDef ? activePreviewDef.name : "Tanpa Dekorasi"}
            </h3>
            {activePreviewDef && (
              <>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                    AVATAR_DECORATION_ACCESS_MAP[activePreviewDef.access]
                      .badgeClass
                  }`}
                >
                  {
                    AVATAR_DECORATION_ACCESS_MAP[activePreviewDef.access]
                      .shortLabel
                  }
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                    AVATAR_DECORATION_RARITY_STYLES[activePreviewDef.rarity]
                      .badgeClass
                  }`}
                >
                  {
                    AVATAR_DECORATION_RARITY_STYLES[activePreviewDef.rarity]
                      .label
                  }
                </span>
              </>
            )}
            {previewId === equippedId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Check className="w-3 h-3" />
                Terpasang
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground max-w-md mx-auto sm:mx-0">
            {activePreviewDef
              ? activePreviewDef.description || "Bingkai dekorasi eksklusif Nismara Transport."
              : "Tampilkan foto profil standar tanpa bingkai dekorasi tambahan."}
          </p>

          {activePreviewDef?.availableUntil && (
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-400">
              <Clock className="w-3.5 h-3.5" />
              Berlaku s/d {formatUntilWib(activePreviewDef.availableUntil)}
            </p>
          )}

          <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
            {previewEligibility.allowed ? (
              <button
                type="button"
                onClick={handleApply}
                disabled={isSaving || !isDirty}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : previewId ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    {isDirty ? "Pasang Dekorasi Ini" : "Sedang Terpasang"}
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    {isDirty ? "Lepas Dekorasi" : "Tidak Ada Dekorasi"}
                  </>
                )}
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Pratinjau saja —{" "}
                  {previewEligibility.reason || "Akses terbatas"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {visibleCategories.map((cat) => {
          const active = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 min-h-[36px] rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                active
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "bg-background/40 text-muted-foreground border-border/50 hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Decoration Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {selectedCategory === "all" && (
          <button
            type="button"
            onClick={() => setPreviewId(null)}
            className={`group relative flex flex-col items-center justify-between gap-3 p-4 rounded-2xl border text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              previewId === null
                ? "bg-primary/10 border-primary shadow-sm"
                : "bg-background/40 border-border/60 hover:border-border"
            }`}
          >
            {equippedId === null && (
              <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                <Check className="w-3 h-3" />
              </span>
            )}
            <div className="w-16 h-16 my-1 rounded-full border-2 border-dashed border-border/80 flex items-center justify-center text-muted-foreground">
              <Ban className="w-5 h-5" />
            </div>
            <div className="w-full min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                Tanpa Dekorasi
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Standar
              </p>
            </div>
          </button>
        )}

        {filteredDecorations.map((deco) => {
          const isSelected = previewId === deco.id;
          const isEquipped = equippedId === deco.id;
          const elig = checkDecorationEligibility(deco, eligibilityCtx);
          const isLocked = !elig.allowed;
          const accessInfo = AVATAR_DECORATION_ACCESS_MAP[deco.access];

          return (
            <button
              key={deco.id}
              type="button"
              onClick={() => setPreviewId(deco.id)}
              className={`group relative flex flex-col items-center justify-between gap-3 p-4 rounded-2xl border text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isSelected
                  ? "bg-primary/10 border-primary shadow-sm"
                  : "bg-background/40 border-border/60 hover:border-border"
              }`}
            >
              {isEquipped ? (
                <span
                  className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm"
                  title="Sedang terpasang"
                >
                  <Check className="w-3 h-3" />
                </span>
              ) : isLocked ? (
                <span
                  className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center"
                  title={elig.reason || "Terkunci"}
                >
                  <Lock className="w-2.5 h-2.5" />
                </span>
              ) : null}

              <div className="my-1">
                <DecoratedAvatar
                  src={avatarUrl || "/placeholder-avatar.png"}
                  alt={deco.name}
                  decoration={deco}
                  forcePreview
                  sizeClass="w-16 h-16"
                  frameClass="border-2 border-background"
                />
              </div>

              <div className="w-full min-w-0 space-y-1">
                <p className="text-xs font-bold text-foreground truncate">
                  {deco.name}
                </p>
                <span
                  className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${accessInfo.badgeClass}`}
                >
                  {accessInfo.shortLabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <input type="hidden" name="avatarDecoration" value={equippedId || ""} />
    </div>
  );
}
