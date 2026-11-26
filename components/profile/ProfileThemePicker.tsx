"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Palette,
  Check,
  Lock,
  Crown,
  Sparkles,
  Loader2,
  Pipette,
  RotateCcw,
} from "lucide-react";
import {
  PROFILE_THEME_PRESETS,
  DEFAULT_CUSTOM_BASE_COLOR,
  DEFAULT_CUSTOM_ACCENT_COLOR,
  canUseCustomProfileTheme,
  normalizeHexColor,
  resolveProfileTheme,
  type ProfileThemePresetId,
  type UserProfileThemeConfig,
} from "@/lib/profileThemes";
import { updateProfileTheme } from "@/app/dashboard/settings/actions";
import { showAlert } from "@/lib/dialog";

const QUICK_CUSTOM_SWATCHES = [
  { label: "Violet", base: "#6d28d9", accent: "#c084fc" },
  { label: "Pastel Rose", base: "#be185d", accent: "#f9a8d4" },
  { label: "Sunset", base: "#c2410c", accent: "#fdba74" },
  { label: "Cyan", base: "#0369a1", accent: "#38bdf8" },
  { label: "Mint", base: "#047857", accent: "#6ee7b7" },
  { label: "Mocha", base: "#78350f", accent: "#fcd34d" },
];

interface ProfileThemePickerProps {
  value: UserProfileThemeConfig;
  onChange: (next: UserProfileThemeConfig) => void;
  bannerUrl?: string | null;
  backgroundUrl?: string | null;
  avatarUrl?: string | null;
  userName?: string;
  isNismaraPlus: boolean;
  isBooster: boolean;
}

export default function ProfileThemePicker({
  value,
  onChange,
  bannerUrl,
  backgroundUrl,
  avatarUrl,
  userName,
  isNismaraPlus,
  isBooster,
}: ProfileThemePickerProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const canUseCustom = canUseCustomProfileTheme({ isNismaraPlus, isBooster });
  const baseColor = normalizeHexColor(value.customBaseColor, DEFAULT_CUSTOM_BASE_COLOR);
  const accentColor = normalizeHexColor(
    value.customAccentColor,
    DEFAULT_CUSTOM_ACCENT_COLOR
  );

  // Live preview selalu merender tema yang dipilih (termasuk preview custom) agar user bisa melihat hasilnya
  const previewResolved = useMemo(
    () =>
      resolveProfileTheme(
        {
          preset: value.preset,
          customBaseColor: baseColor,
          customAccentColor: accentColor,
        },
        { isNismaraPlus: true, isBooster: true }
      ),
    [value.preset, baseColor, accentColor]
  );

  const activePresetMeta = useMemo(
    () => PROFILE_THEME_PRESETS.find((p) => p.id === value.preset) || null,
    [value.preset]
  );

  const handleSelectPreset = (presetId: ProfileThemePresetId) => {
    if (presetId === "custom") {
      onChange({
        preset: "custom",
        customBaseColor: baseColor,
        customAccentColor: accentColor,
      });
      return;
    }
    onChange({
      ...value,
      preset: presetId,
    });
  };

  const handleSaveInstant = async () => {
    if (value.preset === "custom" && !canUseCustom) {
      await showAlert(
        "Custom Color Picker khusus untuk member Nismara+ atau Discord Server Booster. Pilih salah satu dari 10 tema gratis atau upgrade ke Nismara+."
      );
      return;
    }

    setSaving(true);
    try {
      const res = await updateProfileTheme({
        preset: value.preset,
        customBaseColor: value.preset === "custom" ? baseColor : value.customBaseColor,
        customAccentColor: value.preset === "custom" ? accentColor : value.customAccentColor,
      });
      if (res.success) {
        router.refresh();
        await showAlert(res.message || "Tema warna profil berhasil disimpan!");
      } else {
        await showAlert(res.message || "Gagal menyimpan tema profil.");
      }
    } catch (err) {
      console.error("Save profile theme error:", err);
      await showAlert("Terjadi kesalahan saat menyimpan tema profil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-[2rem] border-border/50 space-y-6">
      {/* Hidden inputs agar tombol "Simpan Perubahan" utama juga ikut menyimpan */}
      <input type="hidden" name="profileThemePreset" value={value.preset} />
      <input
        type="hidden"
        name="profileThemeBaseColor"
        value={value.preset === "custom" ? baseColor : value.customBaseColor || ""}
      />
      <input
        type="hidden"
        name="profileThemeAccentColor"
        value={value.preset === "custom" ? accentColor : value.customAccentColor || ""}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Palette className="text-accent-lilac w-5 h-5" /> Warna Tema Profil
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Ubah nuansa warna kartu profil publikmu ala Steam agar selaras dengan banner &amp; wallpaper.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveInstant}
          disabled={saving || (value.preset === "custom" && !canUseCustom)}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer shadow-md shadow-primary/20"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          <span>{saving ? "Menyimpan..." : "Terapkan Tema"}</span>
        </button>
      </div>

      {/* LIVE MINI-PROFILE PREVIEW */}
      <div
        className="relative rounded-2xl overflow-hidden border border-border/60 p-4 sm:p-5 bg-cover bg-center"
        style={{
          backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : "none",
          backgroundColor: "#0c101a",
        }}
      >
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] pointer-events-none" />

        <div
          className="relative z-10 max-w-xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-border/60"
          style={previewResolved.vars as React.CSSProperties | undefined}
        >
          {/* Mini Banner */}
          <div
            className="h-20 sm:h-24 w-full bg-cover bg-center relative"
            style={{
              backgroundImage: bannerUrl ? `url(${bannerUrl})` : "none",
              backgroundColor: bannerUrl ? "transparent" : "hsl(var(--primary) / 0.25)",
            }}
          >
            <div
              className="absolute bottom-0 inset-x-0 h-12 pointer-events-none"
              style={{
                background: previewResolved.bannerFadeColor
                  ? `linear-gradient(to top, ${previewResolved.bannerFadeColor}, transparent)`
                  : "linear-gradient(to top, hsl(var(--background) / 0.9), transparent)",
              }}
            />
          </div>

          {/* Mini Content Container */}
          <div
            className="px-4 pb-4 pt-0 bg-background/85 backdrop-blur-xl"
            style={
              previewResolved.surfaceGradient
                ? { background: previewResolved.surfaceGradient }
                : undefined
            }
          >
            <div className="flex items-end gap-3 -mt-6 mb-3 relative z-10">
              <div className="w-12 h-12 rounded-full border-2 border-background overflow-hidden bg-card shrink-0 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl || "/placeholder-avatar.png"}
                  alt={userName || "Preview"}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 pb-0.5">
                <p className="text-sm font-black text-foreground truncate">
                  {userName || "Driver Nismara"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Pratinjau:{" "}
                  <span className="font-bold text-primary">
                    {value.preset === "custom"
                      ? "Custom Color"
                      : activePresetMeta?.name || "Default Theme"}
                  </span>
                </p>
              </div>
              <div className="px-2.5 py-1 rounded-full text-[10px] font-black bg-primary/20 text-primary border border-primary/40">
                LVL 25
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl p-2.5 bg-card/70 border border-border/60">
                <div className="text-[9px] uppercase font-bold text-muted-foreground">
                  Game Favorit
                </div>
                <div className="text-xs font-black text-foreground mt-0.5">ETS2</div>
                <div className="w-full h-1 rounded-full bg-muted mt-1.5 overflow-hidden">
                  <div className="w-3/4 h-full rounded-full bg-primary" />
                </div>
              </div>
              <div className="rounded-xl p-2.5 bg-card/70 border border-border/60">
                <div className="text-[9px] uppercase font-bold text-muted-foreground">
                  Saldo NC
                </div>
                <div className="text-xs font-black text-foreground mt-0.5">
                  125.000
                </div>
                <div className="text-[9px] text-primary font-bold mt-0.5">Aktif</div>
              </div>
              <div className="rounded-xl p-2.5 bg-card/70 border border-border/60">
                <div className="text-[9px] uppercase font-bold text-muted-foreground">
                  Lencana
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-3.5 h-3.5 rounded-full bg-primary/30 border border-primary/60 inline-block" />
                  <span className="w-3.5 h-3.5 rounded-full bg-primary/20 border border-border inline-block" />
                  <span className="w-3.5 h-3.5 rounded-full bg-muted border border-border inline-block" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STEAM-STYLE CIRCULAR THEME SWATCHES */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {PROFILE_THEME_PRESETS.map((preset) => {
          const isSelected = value.preset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset.id)}
              className={`group flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? "bg-primary/10 border-primary/60 shadow-lg shadow-primary/10"
                  : "bg-black/20 border-white/5 hover:border-white/20 hover:bg-white/[0.04]"
              }`}
              title={preset.tagline}
            >
              <div
                className="relative w-14 h-14 rounded-full shadow-inner transition-transform duration-200 group-hover:scale-105 flex items-center justify-center"
                style={{
                  background: preset.swatchGradient,
                  boxShadow: isSelected
                    ? `0 0 0 3px ${preset.ringColor}, 0 8px 20px rgba(0,0,0,0.45)`
                    : "inset 0 2px 6px rgba(255,255,255,0.12), 0 4px 12px rgba(0,0,0,0.4)",
                }}
              >
                {isSelected && (
                  <span className="w-6 h-6 rounded-full bg-black/65 backdrop-blur-sm text-white flex items-center justify-center border border-white/25">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
              <span
                className={`text-xs font-bold text-center leading-tight ${
                  isSelected ? "text-primary" : "text-foreground/90"
                }`}
              >
                {preset.name}
              </span>
            </button>
          );
        })}

        {/* CUSTOM COLOR SWATCH (NISMARA+ & BOOSTER ONLY) */}
        <button
          type="button"
          onClick={() => handleSelectPreset("custom")}
          className={`group flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all cursor-pointer relative ${
            value.preset === "custom"
              ? "bg-amber-500/10 border-amber-400/60 shadow-lg shadow-amber-500/10"
              : "bg-black/20 border-white/5 hover:border-amber-400/40 hover:bg-amber-500/[0.04]"
          }`}
          title="Pilih warna dasar & aksen bebas (Khusus Nismara+ & Booster)"
        >
          <div
            className="relative w-14 h-14 rounded-full shadow-inner transition-transform duration-200 group-hover:scale-105 flex items-center justify-center"
            style={{
              background:
                value.preset === "custom"
                  ? `linear-gradient(135deg, ${baseColor} 0%, ${accentColor} 100%)`
                  : "conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #38bdf8, #8b5cf6, #ec4899, #ef4444)",
              boxShadow:
                value.preset === "custom"
                  ? `0 0 0 3px ${accentColor}, 0 8px 20px rgba(0,0,0,0.45)`
                  : "0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            <span className="w-6 h-6 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center border border-white/25">
              {canUseCustom ? (
                value.preset === "custom" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Pipette className="w-3.5 h-3.5" />
                )
              ) : (
                <Lock className="w-3 h-3 text-amber-400" />
              )}
            </span>
          </div>
          <span
            className={`text-xs font-bold text-center leading-tight flex items-center gap-1 ${
              value.preset === "custom" ? "text-amber-400" : "text-foreground/90"
            }`}
          >
            Custom
          </span>
          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
            N+ / Booster
          </span>
        </button>
      </div>

      {/* CUSTOM COLOR PICKER PANEL (muncul saat Custom dipilih) */}
      {value.preset === "custom" && (
        <div className="p-5 rounded-2xl bg-black/30 border border-amber-500/25 space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-foreground">
                Custom Color Picker
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Eksklusif Nismara+ &amp; Booster
              </span>
            </div>

            {canUseCustom && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    preset: "custom",
                    customBaseColor: DEFAULT_CUSTOM_BASE_COLOR,
                    customAccentColor: DEFAULT_CUSTOM_ACCENT_COLOR,
                  })
                }
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset Warna
              </button>
            )}
          </div>

          {!canUseCustom && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  Kamu bisa mencoba pratinjau warna bebas di sini, namun untuk menyimpannya dibutuhkan keanggotaan{" "}
                  <strong className="text-amber-300">Nismara+</strong> atau status{" "}
                  <strong className="text-pink-300">Discord Server Booster</strong>.
                </p>
              </div>
              <Link
                href="/dashboard/nismaraplus"
                className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 text-black text-xs font-black hover:bg-amber-400 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" /> Lihat Nismara+
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Warna Dasar */}
            <div className="p-3.5 rounded-xl bg-background/60 border border-border/60 space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Warna Dasar Kartu Profil
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={baseColor}
                  onChange={(e) =>
                    onChange({
                      preset: "custom",
                      customBaseColor: e.target.value,
                      customAccentColor: accentColor,
                    })
                  }
                  className="w-11 h-11 rounded-xl border border-border bg-transparent cursor-pointer shrink-0"
                  aria-label="Pilih warna dasar kartu profil"
                />
                <input
                  type="text"
                  value={baseColor}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                      onChange({
                        preset: "custom",
                        customBaseColor: v,
                        customAccentColor: accentColor,
                      });
                    }
                  }}
                  maxLength={7}
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-foreground uppercase focus:outline-none focus:border-primary"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Kecerahan otomatis dikalibrasi agar teks profil tetap tajam &amp; nyaman dibaca.
              </p>
            </div>

            {/* Warna Aksen */}
            <div className="p-3.5 rounded-xl bg-background/60 border border-border/60 space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Warna Aksen &amp; Progress Bar
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) =>
                    onChange({
                      preset: "custom",
                      customBaseColor: baseColor,
                      customAccentColor: e.target.value,
                    })
                  }
                  className="w-11 h-11 rounded-xl border border-border bg-transparent cursor-pointer shrink-0"
                  aria-label="Pilih warna aksen profil"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                      onChange({
                        preset: "custom",
                        customBaseColor: baseColor,
                        customAccentColor: v,
                      });
                    }
                  }}
                  maxLength={7}
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-foreground uppercase focus:outline-none focus:border-primary"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Mewarnai bar XP, tombol utama, dan sorotan interaktif di halaman profilmu.
              </p>
            </div>
          </div>

          {/* Quick Palette Inspiration Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
              Inspirasi Cepat:
            </span>
            {QUICK_CUSTOM_SWATCHES.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() =>
                  onChange({
                    preset: "custom",
                    customBaseColor: chip.base,
                    customAccentColor: chip.accent,
                  })
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-foreground transition-colors cursor-pointer"
              >
                <span
                  className="w-3 h-3 rounded-full border border-white/30"
                  style={{
                    background: `linear-gradient(135deg, ${chip.base}, ${chip.accent})`,
                  }}
                />
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
