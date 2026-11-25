"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Hash,
  Folder,
  Loader2,
  Search,
  ChevronDown,
  RefreshCw,
  Keyboard,
  AlertTriangle,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Music,
  Upload,
  ExternalLink,
  Trash2,
} from "lucide-react";
import type { SeasonThemeMode, WebConfig } from "@/lib/webConfig";
import type { DiscordGuildMeta } from "@/lib/discordGuildMeta";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { showAlert, showConfirm } from "@/lib/dialog";

interface Props {
  initialConfig: WebConfig;
  initialDiscordMeta: DiscordGuildMeta;
  meta: {
    hasDbRecord: boolean;
    updatedAt: string | null;
    updatedBy: string | null;
  };
}

type PickerKind = "category" | "channel" | "role";

interface PickerOption {
  id: string;
  name: string;
  sublabel?: string | null;
  colorHex?: string | null;
  managed?: boolean;
}

const SNOWFLAKE_RE = /^\d{15,22}$/;

function formatWIB(iso: string | null): string | null {
  if (!iso) return null;
  return (
    new Date(iso).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}

function DiscordEntityPicker({
  id,
  label,
  envName,
  kind,
  value,
  options,
  onChange,
  discordReady,
}: {
  id: string;
  label: string;
  envName: string;
  kind: PickerKind;
  value: string;
  options: PickerOption[];
  onChange: (newId: string) => void;
  discordReady: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((opt) => opt.id === value.trim()) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        opt.id.includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open]);

  const trimmedQuery = query.trim();
  const canUseManualFromSearch =
    trimmedQuery.length > 0 &&
    SNOWFLAKE_RE.test(trimmedQuery) &&
    !options.some((o) => o.id === trimmedQuery);

  const kindLabel =
    kind === "category" ? "category" : kind === "channel" ? "channel" : "role";

  return (
    <div
      ref={containerRef}
      className={`space-y-2 relative ${open ? "z-50" : "z-10 focus-within:z-20"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          title={`Key lama: ${envName}`}
          className="text-sm font-medium text-foreground truncate"
        >
          {label}
        </label>

        <button
          type="button"
          onClick={() => {
            setManualMode((prev) => !prev);
            setOpen(false);
          }}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 min-h-[32px] text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <Keyboard className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{manualMode ? "Pilih nama" : "Input ID"}</span>
        </button>
      </div>

      {manualMode ? (
        <div className="space-y-1.5">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`ID ${kindLabel} Discord (15-22 digit)`}
            className="w-full min-h-[44px] rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm font-mono tabular-nums text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-mono text-muted-foreground truncate">{envName}</span>
            {selected ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-medium truncate">
                Cocok: {kind === "role" ? `@${selected.name}` : selected.name}
              </span>
            ) : value.trim() && discordReady ? (
              <span className="text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Tidak ada di daftar server
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="relative">
          <button
            id={id}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => {
              setOpen((prev) => !prev);
              setQuery("");
            }}
            className={`w-full min-h-[54px] rounded-lg border px-3.5 py-2 text-left transition-colors flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
              open
                ? "border-ring bg-background"
                : "border-input bg-background hover:border-foreground/30"
            }`}
          >
            <div className="min-w-0 flex-1 flex items-center gap-2.5">
              {kind === "category" && (
                <Folder className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              {kind === "channel" && (
                <Hash className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              {kind === "role" && (
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-border"
                  style={{
                    backgroundColor: selected?.colorHex || "#64748b",
                  }}
                />
              )}

              <div className="min-w-0 flex-1">
                {selected ? (
                  <>
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {kind === "role" ? `@${selected.name}` : selected.name}
                      </span>
                      {selected.sublabel && (
                        <span className="text-xs text-muted-foreground truncate">
                          {selected.sublabel}
                        </span>
                      )}
                    </div>
                    <span className="block text-xs font-mono tabular-nums text-muted-foreground">
                      {selected.id}
                    </span>
                  </>
                ) : value.trim() ? (
                  <>
                    <span className="block text-sm font-mono tabular-nums text-foreground truncate">
                      {value.trim()}
                    </span>
                    <span className="block text-xs text-amber-700 dark:text-amber-400">
                      {discordReady
                        ? `ID kustom (tidak ditemukan di daftar ${kindLabel})`
                        : "Daftar Discord belum tersedia"}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Pilih {kindLabel} atau masukkan ID
                  </span>
                )}
              </div>
            </div>

            <ChevronDown
              aria-hidden="true"
              className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${
                open ? "rotate-180 text-foreground" : ""
              }`}
            />
          </button>

          {open && (
            <div
              role="listbox"
              className="absolute left-0 right-0 mt-1.5 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden z-50"
            >
              <div className="p-2 border-b border-border flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground shrink-0 ml-1" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Cari nama ${kindLabel} atau tempel ID...`}
                  className="w-full min-h-[36px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Hapus pencarian"
                    onClick={() => setQuery("")}
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto py-1">
                {filtered.length > 0 ? (
                  filtered.map((opt) => {
                    const isSelected = opt.id === value.trim();
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChange(opt.id);
                          setOpen(false);
                          setQuery("");
                        }}
                        className={`w-full min-h-[44px] px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors focus-visible:outline-none focus-visible:bg-accent cursor-pointer ${
                          isSelected
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/60 text-foreground"
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2.5 flex-1">
                          {kind === "category" && (
                            <Folder className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          )}
                          {kind === "channel" && (
                            <Hash className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          )}
                          {kind === "role" && (
                            <span
                              aria-hidden="true"
                              className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-border"
                              style={{
                                backgroundColor: opt.colorHex || "#64748b",
                              }}
                            />
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2 min-w-0">
                              <span className="text-sm font-medium truncate">
                                {kind === "role" ? `@${opt.name}` : opt.name}
                              </span>
                              {opt.sublabel && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {opt.sublabel}
                                </span>
                              )}
                              {opt.managed && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  (bot)
                                </span>
                              )}
                            </div>
                            <span className="block text-xs font-mono tabular-nums text-muted-foreground">
                              {opt.id}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <Check className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3.5 py-5 text-center text-sm text-muted-foreground">
                    {options.length === 0
                      ? "Daftar Discord kosong. Klik Input ID untuk mengisi manual."
                      : `Tidak ditemukan ${kindLabel} yang cocok dengan "${query}".`}
                  </div>
                )}

                {canUseManualFromSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(trimmedQuery);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="w-full min-h-[44px] px-3 py-2.5 border-t border-border bg-secondary hover:bg-secondary/80 text-left text-sm text-secondary-foreground font-medium flex items-center gap-2 cursor-pointer"
                  >
                    <Keyboard className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      Pakai ID manual: <code className="font-mono">{trimmedQuery}</code>
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WebConfigClient({
  initialConfig,
  initialDiscordMeta,
  meta,
}: Props) {
  const router = useRouter();
  const [savedSnapshot, setSavedSnapshot] = useState<WebConfig>(initialConfig);
  const [config, setConfig] = useState<WebConfig>(initialConfig);
  const [discordMeta, setDiscordMeta] = useState<DiscordGuildMeta>(initialDiscordMeta);
  const [syncingDiscord, setSyncingDiscord] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedWIB, setLastSavedWIB] = useState<string | null>(() =>
    formatWIB(meta.updatedAt)
  );

  const isoToWibLocalInput = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "2026-12-28T00:00";
    const wib = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const y = wib.getFullYear();
    const m = String(wib.getMonth() + 1).padStart(2, "0");
    const day = String(wib.getDate()).padStart(2, "0");
    const h = String(wib.getHours()).padStart(2, "0");
    const min = String(wib.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day}T${h}:${min}`;
  };

  const handleUploadRewindAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const extOk = /\.(mp3|wav|ogg)$/i.test(file.name);
    if (!extOk) {
      await showAlert("Format audio harus .mp3, .wav, atau .ogg.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      await showAlert("Ukuran file audio maksimal 15MB.");
      return;
    }

    setUploadingAudio(true);
    try {
      const mimeType =
        file.type ||
        (file.name.toLowerCase().endsWith(".wav")
          ? "audio/wav"
          : file.name.toLowerCase().endsWith(".ogg")
            ? "audio/ogg"
            : "audio/mpeg");

      const presignedRes = await fetch("/api/upload", {
        method: "POST",
        ...NO_CACHE_FETCH_OPTIONS,
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: mimeType,
          folder: "audio",
          fileSize: file.size,
        }),
      });
      const presigned = await presignedRes.json();
      if (!presignedRes.ok || !presigned.signedUrl || !presigned.publicUrl) {
        await showAlert(presigned.error || "Gagal mendapatkan izin upload audio ke R2.");
        return;
      }

      const putRes = await fetch(presigned.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: file,
      });
      if (!putRes.ok) {
        await showAlert("Gagal mengunggah file audio ke Cloudflare R2.");
        return;
      }

      setConfig((prev) => ({
        ...prev,
        features: {
          ...prev.features,
          rewind2026: {
            ...prev.features.rewind2026,
            musicUrl: presigned.publicUrl,
          },
        },
      }));
      await showAlert("Audio berhasil diunggah. Klik 'Simpan konfigurasi' agar langsung aktif di Rewind 2026.");
    } catch {
      await showAlert("Terjadi kesalahan jaringan saat mengunggah audio.");
    } finally {
      setUploadingAudio(false);
    }
  };

  useEffect(() => {
    setSavedSnapshot(initialConfig);
    setConfig(initialConfig);
  }, [initialConfig]);

  useEffect(() => {
    setDiscordMeta(initialDiscordMeta);
  }, [initialDiscordMeta]);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(savedSnapshot),
    [config, savedSnapshot]
  );

  const categoryOptions: PickerOption[] = useMemo(
    () => discordMeta.categories.map((c) => ({ id: c.id, name: c.name })),
    [discordMeta.categories]
  );

  const channelOptions: PickerOption[] = useMemo(
    () =>
      discordMeta.textChannels.map((c) => ({
        id: c.id,
        name: c.name,
        sublabel: c.parentName,
      })),
    [discordMeta.textChannels]
  );

  const roleOptions: PickerOption[] = useMemo(
    () =>
      discordMeta.roles.map((r) => ({
        id: r.id,
        name: r.name,
        colorHex: r.colorHex,
        managed: r.managed,
      })),
    [discordMeta.roles]
  );

  const handleSyncDiscord = async () => {
    setSyncingDiscord(true);
    try {
      const res = await fetch("/api/manage/web-config/discord-meta?refresh=1", {
        ...NO_CACHE_FETCH_OPTIONS,
      });
      const data = (await res.json()) as DiscordGuildMeta;
      if (!res.ok || !data.ok) {
        await showAlert(data.error || "Gagal mengambil daftar terbaru dari Discord.");
        return;
      }
      setDiscordMeta(data);
    } catch {
      await showAlert("Koneksi ke server gagal saat menyinkronkan Discord.");
    } finally {
      setSyncingDiscord(false);
    }
  };

  const updateOwner = (key: keyof WebConfig["owners"], val: string) =>
    setConfig((prev) => ({ ...prev, owners: { ...prev.owners, [key]: val } }));

  const updateChannel = (key: keyof WebConfig["discordChannels"], val: string) =>
    setConfig((prev) => ({
      ...prev,
      discordChannels: { ...prev.discordChannels, [key]: val },
    }));

  const updateRole = (key: keyof WebConfig["discordRoles"], val: string) =>
    setConfig((prev) => ({
      ...prev,
      discordRoles: { ...prev.discordRoles, [key]: val },
    }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await showConfirm(
      "Simpan perubahan konfigurasi web sekarang? Pengaturan baru langsung berlaku di seluruh website."
    );
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch("/api/manage/web-config", {
        method: "PUT",
        ...NO_CACHE_FETCH_OPTIONS,
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!res.ok) {
        await showAlert(json.error || "Gagal menyimpan konfigurasi.");
        return;
      }

      setSavedSnapshot(json.config);
      setConfig(json.config);
      if (json.updatedAt) {
        setLastSavedWIB(formatWIB(json.updatedAt));
      }
      router.refresh();
      await showAlert("Konfigurasi berhasil disimpan.");
    } catch {
      await showAlert("Terjadi kesalahan jaringan saat menyimpan konfigurasi.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full min-h-[44px] rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm font-mono tabular-nums text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <header className="pb-6 border-b border-border space-y-4">
        <Link
          href="/dashboard/manage/data"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Manage Data</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Konfigurasi Web
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Atur ID owner, channel, category, role Discord, dan tema musiman langsung dari database tanpa redeploy.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSyncDiscord}
            disabled={syncingDiscord}
            className="shrink-0 inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg border border-border bg-card hover:bg-accent px-4 py-2 text-sm font-medium text-foreground transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <RefreshCw
              className={`w-4 h-4 ${syncingDiscord ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>{syncingDiscord ? "Menyinkronkan..." : "Sync Discord"}</span>
          </button>
        </div>

        {/* Status metadata strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1">
          <span className="inline-flex items-center gap-1.5 text-foreground font-medium">
            <span
              aria-hidden="true"
              className={`w-2 h-2 rounded-full ${
                meta.hasDbRecord ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {meta.hasDbRecord ? "Sumber: MongoDB" : "Sumber: fallback .env"}
          </span>

          {discordMeta.ok ? (
            <span>
              Discord tersinkron: {discordMeta.categories.length} category,{" "}
              {discordMeta.textChannels.length} channel, {discordMeta.roles.length} role
            </span>
          ) : (
            <span className="text-amber-700 dark:text-amber-400">
              {discordMeta.error || "Gagal memuat nama Discord; input manual ID tetap aktif."}
            </span>
          )}

          {lastSavedWIB && <span>Terakhir disimpan {lastSavedWIB}</span>}
        </div>
      </header>

      <form onSubmit={handleSave} className="divide-y divide-border">
        {/* 1. Akses Owner */}
        <section className="py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-4 space-y-1.5">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Akses Owner
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Akun Developer dan Owner Nismara dipisah. Keduanya memiliki akses penuh ke halaman ini, persetujuan Nismara+, dan migrasi akun.
            </p>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="owner-dev" className="block text-sm font-medium text-foreground">
                Developer Discord ID
              </label>
              <input
                id="owner-dev"
                type="text"
                inputMode="numeric"
                value={config.owners.developerDiscordId}
                onChange={(e) => updateOwner("developerDiscordId", e.target.value)}
                placeholder="Discord ID 17-20 digit"
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground font-mono">OWNER_DISCORD_ID</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="owner-nismara" className="block text-sm font-medium text-foreground">
                Owner Nismara Discord ID
              </label>
              <input
                id="owner-nismara"
                type="text"
                inputMode="numeric"
                value={config.owners.nismaraOwnerDiscordId}
                onChange={(e) => updateOwner("nismaraOwnerDiscordId", e.target.value)}
                placeholder="Discord ID 17-20 digit"
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground font-mono">NISMARA_OWNER_DISCORD_ID</p>
            </div>
          </div>
        </section>

        {/* 2. Tema Musiman */}
        <section className="py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-4 space-y-1.5">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Tema Musiman
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pilih dekorasi acara musiman yang tampil di seluruh website. Perubahan berlaku begitu disimpan tanpa redeploy.
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="Pilihan tema musiman website"
            className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {(
              [
                {
                  id: "none",
                  title: "Nonaktif",
                  desc: "Tampilan standar Nismara tanpa overlay musiman.",
                },
                {
                  id: "halloween",
                  title: "Halloween",
                  desc: "Labu, jaring sudut, dan hantu interaktif edisi Oktober.",
                },
                {
                  id: "christmas_new_year",
                  title: "Natal & Tahun Baru",
                  desc: "Palet emas sampanye, loading screen musim dingin, salju kristal, dan kembang api.",
                },
              ] as Array<{ id: SeasonThemeMode; title: string; desc: string }>
            ).map((opt) => {
              const active = config.features.seasonTheme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      features: {
                        ...prev.features,
                        seasonTheme: opt.id,
                        halloweenTheme: opt.id === "halloween",
                      },
                    }))
                  }
                  className={`min-h-[88px] rounded-lg border p-3.5 text-left transition-colors flex flex-col justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
                    active
                      ? "border-primary bg-accent/70"
                      : "border-border bg-card hover:border-foreground/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {opt.title}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/50"
                      }`}
                    >
                      {active && <Check className="w-2.5 h-2.5" />}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {opt.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2.5 Miles of Memories — Rewind 2026 */}
        <section className="relative z-25 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-4 space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Kilas Balik Tahunan</span>
            </div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Miles of Memories (Rewind 2026)
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Atur jadwal rilis publik dan musik latar (MP3/WAV) untuk Rewind 2026. Sebelum jadwal rilis tiba, halaman dan banner promo dirahasiakan dan hanya bisa di-preview oleh Owner.
            </p>
            <div className="pt-2">
              <Link
                href="/rewind/2026"
                target="_blank"
                className="inline-flex items-center gap-2 min-h-[40px] rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-2 text-xs font-semibold text-amber-600 dark:text-amber-300 transition-colors"
              >
                <span>Buka Preview Rewind 2026</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-5">
            <div className="p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Aktifkan Miles of Memories 2026</p>
                <p className="text-xs text-muted-foreground">
                  Jika nonaktif, halaman Rewind terkunci untuk umum dan banner promo tidak muncul.
                </p>
              </div>
              <button
                type="button"
                aria-label="Toggle Rewind 2026"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    features: {
                      ...prev.features,
                      rewind2026: {
                        ...prev.features.rewind2026,
                        enabled: !prev.features.rewind2026.enabled,
                      },
                    },
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  config.features.rewind2026.enabled ? "bg-amber-500" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.features.rewind2026.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="rewind-release-at"
                className="text-sm font-medium text-foreground block"
              >
                Jadwal Rilis Publik (WIB)
              </label>
              <input
                id="rewind-release-at"
                type="datetime-local"
                value={isoToWibLocalInput(config.features.rewind2026.releaseAt)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  setConfig((prev) => ({
                    ...prev,
                    features: {
                      ...prev.features,
                      rewind2026: {
                        ...prev.features.rewind2026,
                        releaseAt: `${v}:00+07:00`,
                      },
                    },
                  }));
                }}
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">
                Default: 28 Desember 2026, 00:00 WIB. Banner promo di beranda &amp; dashboard otomatis muncul setelah waktu ini.
              </p>
            </div>

            <div className="space-y-2.5 p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label
                  htmlFor="rewind-music-url"
                  className="text-sm font-medium text-foreground flex items-center gap-1.5"
                >
                  <Music className="w-4 h-4 text-amber-500" aria-hidden="true" />
                  <span>Musik Latar Rewind (MP3 / WAV)</span>
                </label>

                <label className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-accent text-xs font-medium text-foreground cursor-pointer transition-colors">
                  {uploadingAudio ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{uploadingAudio ? "Mengunggah..." : "Upload MP3 / WAV"}</span>
                  <input
                    type="file"
                    accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
                    onChange={handleUploadRewindAudio}
                    disabled={uploadingAudio}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="rewind-music-url"
                  type="text"
                  placeholder="Kosongkan untuk musik bawaan, atau tempel URL MP3/WAV (https://... atau /audio/lagu.mp3)"
                  value={config.features.rewind2026.musicUrl}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      features: {
                        ...prev.features,
                        rewind2026: {
                          ...prev.features.rewind2026,
                          musicUrl: e.target.value,
                        },
                      },
                    }))
                  }
                  className={inputClass}
                />
                {config.features.rewind2026.musicUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        features: {
                          ...prev.features,
                          rewind2026: {
                            ...prev.features.rewind2026,
                            musicUrl: "",
                          },
                        },
                      }))
                    }
                    title="Hapus musik kustom dan kembali ke musik bawaan"
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              {config.features.rewind2026.musicUrl ? (
                <audio
                  controls
                  src={config.features.rewind2026.musicUrl}
                  className="w-full h-9 mt-1"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Saat ini menggunakan <strong>Soundtrack Bawaan Miles of Memories</strong> (instrumen ambient hangat). Unggah file MP3/WAV kapan saja untuk menggantinya.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* 3. Channel & Category Discord */}
        <section className="relative z-20 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-4 space-y-1.5">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Channel &amp; Category Discord
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pilih langsung berdasarkan nama di server Discord, atau klik Input ID untuk menempel ID secara manual.
            </p>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
            {(
              [
                ["generalDriverChannelId", "General Driver Channel", "DISCORD_GENERAL_DRIVER_ID_CHANNEL", "channel"],
                ["interviewChannelId", "Interview & Evaluasi", "DISCORD_INTERVIEW_CHANNEL_ID", "category"],
                ["plusCategoryId", "Nismara+ & Season Pass", "DISCORD_PLUS_CATEGORY_ID", "category"],
                ["ticketCategoryId", "Tiket Bantuan", "DISCORD_TICKET_CATEGORY_ID", "category"],
                ["registrationCategoryId", "Registrasi Driver", "DISCORD_REGISTRATION_CATEGORY_ID", "category"],
                ["serviceFleetCategoryId", "Servis Armada", "DISCORD_SERVICE_FLEET_CATEGORY_ID", "category"],
                ["fleetOrderCategoryId", "Pemesanan Armada", "DISCORD_FLEET_ORDER_CATEGORY_ID", "category"],
                ["communityGoalsCategoryId", "Community Goals", "DISCORD_COMMUNITY_GOALS_CATEGORY_ID", "category"],
              ] as const
            ).map(([field, label, envName, kind]) => (
              <DiscordEntityPicker
                key={field}
                id={`channel-${field}`}
                label={label}
                envName={envName}
                kind={kind}
                value={config.discordChannels[field]}
                options={kind === "channel" ? channelOptions : categoryOptions}
                onChange={(val) => updateChannel(field, val)}
                discordReady={discordMeta.ok}
              />
            ))}
          </div>
        </section>

        {/* 4. Role Discord */}
        <section className="relative z-10 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-4 space-y-1.5">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Role Discord
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Dipakai untuk sinkronisasi izin manager saat login, promosi intern, payroll staff, serta akses Nismara+ dan Lotto.
            </p>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
            {(
              [
                ["driverRoleId", "Driver", "DISCORD_DRIVER_ROLE_ID"],
                ["internRoleId", "Intern", "DISCORD_INTERN_ROLE_ID"],
                ["managerRoleId", "Manager", "DISCORD_MANAGER_ROLE_ID"],
                ["nismaraPlusRoleId", "Nismara+", "DISCORD_NISMARAPLUS_ROLE_ID"],
                ["lottoRoleId", "Lotto", "DISCORD_LOTTO_ROLE_ID"],
                ["staffHrRoleId", "Staff HR", "DISCORD_STAFF_HR_ROLE_ID"],
                ["staffOperationalRoleId", "Staff Operational", "DISCORD_STAFF_OPERATIONAL_ROLE_ID"],
                ["staffGeneralManagerRoleId", "General Manager", "DISCORD_STAFF_GENERAL_MANAGER_ROLE_ID"],
                ["staffDeputyRoleId", "Deputy", "DISCORD_STAFF_DEPUTY_ROLE_ID"],
                ["staffDirectorRoleId", "Director", "DISCORD_STAFF_DIRECTOR_ROLE_ID"],
              ] as const
            ).map(([field, label, envName]) => (
              <DiscordEntityPicker
                key={field}
                id={`role-${field}`}
                label={label}
                envName={envName}
                kind="role"
                value={config.discordRoles[field]}
                options={roleOptions}
                onChange={(val) => updateRole(field, val)}
                discordReady={discordMeta.ok}
              />
            ))}
          </div>
        </section>

        {/* Footer Actions + Security Note */}
        <footer className="pt-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
            Token bot, API key, webhook URL, serta kredensial MongoDB dan Redis tidak disimpan di halaman ini dan tetap dikelola melalui environment variables Coolify.
          </p>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={() => setConfig(savedSnapshot)}
                disabled={saving}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-lg border border-border bg-background hover:bg-accent px-4 py-2 text-sm font-medium text-foreground transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Batalkan</span>
              </button>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="w-4 h-4" aria-hidden="true" />
              )}
              <span>{saving ? "Menyimpan..." : "Simpan konfigurasi"}</span>
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
