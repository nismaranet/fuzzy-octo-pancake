"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Move, Check, X, RotateCcw, Loader2, Image as ImageIcon, Monitor, Pencil } from "lucide-react";
import { updateProfilePositions } from "@/app/dashboard/settings/actions";
import { showAlert } from "@/lib/dialog";
import {
  parseObjectPosition,
  formatObjectPosition,
  clampPercent,
  type PositionXY,
} from "@/lib/profilePosition";
import type { ResolvedProfileTheme } from "@/lib/profileThemes";

interface ProfileVisualShellProps {
  isOwner: boolean;
  bannerUrl?: string | null;
  backgroundUrl?: string | null;
  initialBannerPosition: string;
  initialBackgroundPosition: string;
  rankColor: string;
  resolvedTheme?: ResolvedProfileTheme | null;
  children: React.ReactNode;
}

export default function ProfileVisualShell({
  isOwner,
  bannerUrl,
  backgroundUrl,
  initialBannerPosition,
  initialBackgroundPosition,
  rankColor,
  resolvedTheme,
  children,
}: ProfileVisualShellProps) {
  const router = useRouter();

  const [bannerPos, setBannerPos] = useState<PositionXY>(() =>
    parseObjectPosition(initialBannerPosition),
  );
  const [bgPos, setBgPos] = useState<PositionXY>(() =>
    parseObjectPosition(initialBackgroundPosition),
  );

  const [savedBannerPos, setSavedBannerPos] = useState<PositionXY>(() =>
    parseObjectPosition(initialBannerPosition),
  );
  const [savedBgPos, setSavedBgPos] = useState<PositionXY>(() =>
    parseObjectPosition(initialBackgroundPosition),
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editTarget, setEditTarget] = useState<"banner" | "wallpaper">(
    bannerUrl ? "banner" : "wallpaper",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startPosX: number;
    startPosY: number;
    width: number;
    height: number;
    target: "banner" | "wallpaper";
  } | null>(null);

  useEffect(() => {
    const parsedBanner = parseObjectPosition(initialBannerPosition);
    const parsedBg = parseObjectPosition(initialBackgroundPosition);
    setBannerPos(parsedBanner);
    setSavedBannerPos(parsedBanner);
    setBgPos(parsedBg);
    setSavedBgPos(parsedBg);
  }, [initialBannerPosition, initialBackgroundPosition]);

  // Escape untuk membatalkan mode atur posisi
  useEffect(() => {
    if (!isEditing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) {
        setBannerPos(savedBannerPos);
        setBgPos(savedBgPos);
        setIsEditing(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEditing, isSaving, savedBannerPos, savedBgPos]);

  const canReposition = isOwner && Boolean(bannerUrl || backgroundUrl);

  const startEditing = () => {
    setEditTarget(bannerUrl ? "banner" : "wallpaper");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setBannerPos(savedBannerPos);
    setBgPos(savedBgPos);
    setIsEditing(false);
  };

  const handleResetActive = () => {
    if (editTarget === "banner") {
      setBannerPos({ x: 50, y: 50 });
    } else {
      setBgPos({ x: 50, y: 50 });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const nextBannerStr = formatObjectPosition(bannerPos.x, bannerPos.y);
      const nextBgStr = formatObjectPosition(bgPos.x, bgPos.y);
      const res = await updateProfilePositions(nextBannerStr, nextBgStr);
      if (res.success) {
        setSavedBannerPos(bannerPos);
        setSavedBgPos(bgPos);
        setIsEditing(false);
        router.refresh();
      } else {
        await showAlert(res.message || "Gagal menyimpan posisi gambar.");
      }
    } catch (err) {
      console.error("Save profile position error:", err);
      await showAlert("Terjadi kesalahan saat menyimpan posisi gambar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    target: "banner" | "wallpaper",
  ) => {
    if (!isEditing || editTarget !== target) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const currentPos = target === "banner" ? bannerPos : bgPos;

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPosX: currentPos.x,
      startPosY: currentPos.y,
      width: Math.max(rect.width, 200),
      height: Math.max(rect.height, 200),
      target,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;

    // Tarik ke bawah (dy > 0) => tampilkan bagian atas gambar (y berkurang menuju 0%)
    const sensitivity = drag.target === "wallpaper" ? 130 : 120;
    const nextX = clampPercent(drag.startPosX - (dx / drag.width) * sensitivity);
    const nextY = clampPercent(drag.startPosY - (dy / drag.height) * sensitivity);

    if (drag.target === "banner") {
      setBannerPos({ x: nextX, y: nextY });
    } else {
      setBgPos({ x: nextX, y: nextY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore if already released
      }
      dragRef.current = null;
      setIsDragging(false);
    }
  };

  const activePos = editTarget === "banner" ? bannerPos : bgPos;
  const setActivePos = (updater: (prev: PositionXY) => PositionXY) => {
    if (editTarget === "banner") {
      setBannerPos(updater);
    } else {
      setBgPos(updater);
    }
  };

  const bannerPosCss = formatObjectPosition(bannerPos.x, bannerPos.y);
  const bgPosCss = formatObjectPosition(bgPos.x, bgPos.y);

  return (
    <main
      className="min-h-screen pt-24 pb-20 relative bg-background bg-fixed bg-cover overflow-x-clip"
      style={{
        ...(resolvedTheme?.vars as React.CSSProperties | undefined),
        backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : "none",
        backgroundPosition: bgPosCss,
      }}
    >
      {/* Background Overlay */}
      <div
        className={`absolute inset-0 pointer-events-none z-0 transition-all duration-300 ${
          isEditing && editTarget === "wallpaper"
            ? "bg-background/15 backdrop-blur-none"
            : "bg-background/50 backdrop-blur-[2px]"
        }`}
      />

      {/* Fullscreen Drag Surface saat mengedit Wallpaper */}
      {isEditing && editTarget === "wallpaper" && backgroundUrl && (
        <div
          onPointerDown={(e) => handlePointerDown(e, "wallpaper")}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`fixed inset-0 z-30 touch-none select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          aria-label="Geser untuk mengatur posisi wallpaper"
        />
      )}

      <div className="max-w-6xl mx-auto px-4 relative z-10 mt-4 mb-12">
        {/* --- HEADER BANNER --- */}
        <div
          className={`w-full rounded-t-3xl overflow-hidden relative z-10 shadow-2xl transition-opacity duration-300 ${
            isEditing && editTarget === "wallpaper" ? "opacity-30 pointer-events-none" : "opacity-100"
          }`}
        >
          <div
            onPointerDown={(e) => handlePointerDown(e, "banner")}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`h-64 md:h-96 w-full relative bg-cover ${
              isEditing && editTarget === "banner" && bannerUrl
                ? `touch-none select-none ring-2 ring-inset ring-primary/80 ${
                    isDragging ? "cursor-grabbing" : "cursor-grab"
                  }`
                : ""
            }`}
            style={{
              backgroundImage: bannerUrl ? `url(${bannerUrl})` : "none",
              backgroundPosition: bannerPosCss,
              backgroundColor: bannerUrl ? "transparent" : `${rankColor}22`,
            }}
          >
            {/* Gradient bawah banner */}
            <div
              className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-background/90 to-transparent pointer-events-none"
              style={
                resolvedTheme?.bannerFadeColor
                  ? {
                      background: `linear-gradient(to top, ${resolvedTheme.bannerFadeColor}, transparent)`,
                    }
                  : undefined
              }
            />

            {/* Petunjuk drag saat edit banner */}
            {isEditing && editTarget === "banner" && bannerUrl && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-semibold shadow-lg">
                  <Move className="w-4 h-4 text-primary shrink-0" />
                  <span>Geser banner untuk mengatur posisi</span>
                </div>
              </div>
            )}

            {/* Tombol Aksi Pemilik Profil (Edit Profil & Atur Posisi) */}
            {isOwner && !isEditing && (
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex flex-wrap items-center justify-end gap-2">
                <Link
                  href="/dashboard/settings"
                  className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[38px] rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs font-semibold border border-white/15 backdrop-blur-md shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Profil</span>
                </Link>
                {canReposition && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[38px] rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs font-semibold border border-white/15 backdrop-blur-md shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span>Atur Posisi</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Konten Profil Utama */}
        <div
          className={`transition-opacity duration-300 ${
            isEditing && editTarget === "wallpaper" ? "opacity-25 pointer-events-none" : "opacity-100"
          }`}
        >
          {children}
        </div>
      </div>

      {/* Floating Editor Dock (muncul saat Mode Atur Posisi aktif) */}
      {isEditing && (
        <div
          role="dialog"
          aria-label="Atur Posisi Banner dan Wallpaper"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl p-4 space-y-3.5"
        >
          {/* Header + Target Switcher */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/60">
              {bannerUrl && (
                <button
                  type="button"
                  onClick={() => setEditTarget("banner")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    editTarget === "banner"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Banner
                </button>
              )}
              {backgroundUrl && (
                <button
                  type="button"
                  onClick={() => setEditTarget("wallpaper")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    editTarget === "wallpaper"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  Wallpaper
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetActive}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Kembalikan ke posisi tengah (50% 50%)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Tengah</span>
            </button>
          </div>

          {editTarget === "wallpaper" && (
            <p className="text-[11px] text-muted-foreground">
              Geser langsung area latar di layar atau gunakan slider di bawah untuk menyesuaikan posisi wallpaper.
            </p>
          )}

          {/* Sliders X & Y */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Horizontal (Kiri - Kanan)</span>
                <span className="font-mono font-semibold text-foreground tabular-nums">
                  {activePos.x}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={activePos.x}
                onChange={(e) =>
                  setActivePos((prev) => ({
                    ...prev,
                    x: clampPercent(Number(e.target.value)),
                  }))
                }
                className="w-full accent-primary cursor-pointer h-2"
              />
            </label>

            <label className="space-y-1 block">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Vertikal (Atas - Bawah)</span>
                <span className="font-mono font-semibold text-foreground tabular-nums">
                  {activePos.y}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={activePos.y}
                onChange={(e) =>
                  setActivePos((prev) => ({
                    ...prev,
                    y: clampPercent(Number(e.target.value)),
                  }))
                }
                className="w-full accent-primary cursor-pointer h-2"
              />
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted border border-border/60 transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Simpan Posisi
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
