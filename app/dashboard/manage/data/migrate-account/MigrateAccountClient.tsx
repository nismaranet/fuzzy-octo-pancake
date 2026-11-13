"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Award,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Database,
  History,
  Image as ImageIcon,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Ticket,
  Truck,
  UserCheck,
  Warehouse,
} from "lucide-react";
import { showAlert, showConfirm } from "@/lib/dialog";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import type {
  MigrationConflictStrategy,
  MigrationExecutionResult,
  MigrationPreviewResult,
} from "@/lib/accountMigration";

export interface SelectableAccountOption {
  discordId: string;
  name: string;
  truckyId: string | null;
  truckyRank: string | null;
  truckyRole: string | null;
  image: string | null;
  isDriver: boolean;
  nismaraPlus: boolean;
}

export interface MigrationHistoryItem {
  _id: string;
  migrationId: string;
  oldDiscordId: string;
  newDiscordId: string;
  strategy: MigrationConflictStrategy;
  executedByDiscordId: string;
  executedByName: string;
  totalDocumentsTouched: number;
  sourceTruckyId?: string | null;
  createdAt: string;
  roleSync?: {
    assigned?: Array<{ label: string; roleId: string }>;
    revoked?: Array<{ label: string; roleId: string }>;
  };
}

interface MigrateAccountClientProps {
  initialDrivers: SelectableAccountOption[];
  initialHistory: MigrationHistoryItem[];
  initialOldDiscordId?: string;
}

function formatNC(val: number): string {
  return `${Number(val || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} NC`;
}

function formatFuel(val: number): string {
  return `${Math.floor(Number(val || 0)).toLocaleString("id-ID")} L`;
}

function formatWIB(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return "-";
  return `${dt.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} WIB`;
}

function SearchableDriverPicker({
  label,
  placeholder,
  value,
  onChange,
  options,
  helperText,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  options: SelectableAccountOption[];
  helperText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 40);
    return options
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.discordId.toLowerCase().includes(q) ||
          (d.truckyId || "").toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [options, query]);

  const selectedDriver = useMemo(
    () => options.find((d) => d.discordId === value.trim()),
    [options, value],
  );

  return (
    <div ref={containerRef} className="space-y-2 relative">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-black uppercase tracking-widest text-foreground/70">
          {label}
        </label>
        {selectedDriver && (
          <span className="text-[11px] font-bold text-accent-lilac truncate max-w-[220px]">
            {selectedDriver.name}
            {selectedDriver.truckyId ? ` (#${selectedDriver.truckyId})` : ""}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode="numeric"
          className="flex-1 bg-background/70 border border-white/10 focus:border-accent-lilac/60 rounded-2xl px-4 py-3 text-sm font-mono text-foreground placeholder:text-foreground/30 outline-none transition-colors"
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="px-3.5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground/70 hover:text-foreground flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
          title="Cari dari daftar akun terdaftar"
        >
          <Search size={15} />
          <span className="hidden sm:inline">Pilih Driver</span>
          <ChevronDown
            size={14}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {helperText && (
        <p className="text-[11px] text-foreground/45 font-medium">{helperText}</p>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-[#14141d] border border-white/15 shadow-2xl overflow-hidden">
          <div className="p-2.5 border-b border-white/10 flex items-center gap-2 bg-white/[0.02]">
            <Search size={14} className="text-foreground/40 shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, Discord ID, atau Trucky ID..."
              className="w-full bg-transparent text-xs text-foreground placeholder:text-foreground/35 outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-white/5">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-foreground/45">
                Tidak ada driver cocok. Anda tetap dapat mengetik Discord ID secara manual.
              </div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.discordId}
                  type="button"
                  onClick={() => {
                    onChange(item.discordId);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-white/[0.06] flex items-center justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground truncate flex items-center gap-2">
                      <span>{item.name}</span>
                      {item.nismaraPlus && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-black uppercase">
                          N+
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-foreground/45 font-mono truncate">
                      {item.discordId}
                      {item.truckyId ? ` • Trucky #${item.truckyId}` : ""}
                    </div>
                  </div>
                  {value.trim() === item.discordId && (
                    <Check size={15} className="text-emerald-400 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MigrateAccountClient({
  initialDrivers,
  initialHistory,
  initialOldDiscordId = "",
}: MigrateAccountClientProps) {
  const router = useRouter();
  const drivers = initialDrivers;
  const [fetchedHistory, setFetchedHistory] = useState<MigrationHistoryItem[] | null>(null);
  const history = fetchedHistory ?? initialHistory;
  const [oldDiscordId, setOldDiscordId] = useState(initialOldDiscordId);
  const [newDiscordId, setNewDiscordId] = useState("");
  const [confirmTargetId, setConfirmTargetId] = useState("");
  const [strategy, setStrategy] = useState<MigrationConflictStrategy>("override");

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [preview, setPreview] = useState<MigrationPreviewResult | null>(null);
  const [executionResult, setExecutionResult] =
    useState<MigrationExecutionResult | null>(null);

  const handleLoadPreview = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const oldId = oldDiscordId.trim();
    const newId = newDiscordId.trim();

    if (!/^\d{17,22}$/.test(oldId) || !/^\d{17,22}$/.test(newId)) {
      await showAlert("Masukkan Discord ID lama dan baru berupa 17-22 digit angka.");
      return;
    }
    if (oldId === newId) {
      await showAlert("Discord ID lama dan Discord ID baru tidak boleh sama.");
      return;
    }

    setIsLoadingPreview(true);
    setPreview(null);
    setExecutionResult(null);
    setConfirmTargetId("");

    try {
      const res = await fetch("/api/manage/users/migrate/preview", {
        ...NO_CACHE_FETCH_OPTIONS,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Pragma: "no-cache",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({ oldDiscordId: oldId, newDiscordId: newId }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        await showAlert(data?.error || "Gagal memuat preview migrasi akun.");
        return;
      }

      setPreview(data.preview);
      setStrategy(
        data.preview.conflictStatus === "mergeable_conflict" ? "override" : "override",
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat preview.";
      await showAlert(msg);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const refreshHistory = async () => {
    try {
      const res = await fetch("/api/manage/users/migrate", NO_CACHE_FETCH_OPTIONS);
      const data = await res.json();
      if (res.ok && data?.success && Array.isArray(data.history)) {
        setFetchedHistory(data.history);
      }
    } catch {
      // ignore background refresh failure
    }
  };

  const handleExecuteMigration = async () => {
    if (!preview || !preview.canMigrate) return;

    if (confirmTargetId.trim() !== preview.newDiscordId) {
      await showAlert(
        `Ketik ulang Discord ID baru (${preview.newDiscordId}) pada kolom konfirmasi terlebih dahulu.`,
      );
      return;
    }

    const strategyText =
      preview.conflictStatus === "mergeable_conflict"
        ? strategy === "merge"
          ? "MERGE (Gabungkan data akun baru + akun lama)"
          : "OVERRIDE (Timpa data bawaan akun baru dengan akun lama)"
        : "CLEAN MIGRATION (Akun baru bersih)";

    const confirmed = await showConfirm(
      `Konfirmasi FINAL Migrasi Akun Discord:\n\n` +
        `• Akun Lama: ${preview.oldDiscordId} (${preview.sourceSummary.name || preview.sourceDiscord.username || "-"})\n` +
        `• Akun Baru: ${preview.newDiscordId} (${preview.targetDiscord.globalName || preview.targetDiscord.username || "-"})\n` +
        `• Mode: ${strategyText}\n\n` +
        `Seluruh sesi login lama akan dicabut, data database dipindahkan, dan role server Discord akan disinkronkan. Lanjutkan?`,
    );

    if (!confirmed) return;

    setIsExecuting(true);
    try {
      const res = await fetch("/api/manage/users/migrate", {
        ...NO_CACHE_FETCH_OPTIONS,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Pragma: "no-cache",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({
          oldDiscordId: preview.oldDiscordId,
          newDiscordId: preview.newDiscordId,
          confirmTargetDiscordId: confirmTargetId.trim(),
          conflictStrategy: strategy,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        await showAlert(data?.error || "Migrasi gagal dieksekusi.");
        return;
      }

      setExecutionResult(data.result);
      await refreshHistory();
      router.refresh();
      await showAlert(
        `Migrasi akun selesai! ID: ${data.result.migrationId} (${data.result.totalDocumentsTouched} catatan diproses).`,
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Terjadi kesalahan saat mengeksekusi migrasi.";
      await showAlert(msg);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/dashboard/manage/data"
            className="inline-flex items-center gap-2 text-xs font-bold text-foreground/50 hover:text-accent-lilac transition-colors"
          >
            <ArrowLeft size={14} />
            Kembali ke Manage Data
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <ArrowLeftRight size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
                  Migrasi Akun Discord
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-widest">
                  Owner Only
                </span>
              </div>
              <p className="text-sm text-foreground/55 mt-0.5">
                Pindahkan seluruh data akun, auth NextAuth, ekonomi, armada, galeri, riwayat,
                hingga role server Discord dari akun lama (ter-hack) ke akun Discord baru.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="rounded-3xl bg-amber-500/[0.06] border border-amber-500/20 p-5 flex items-start gap-4">
        <ShieldAlert size={22} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-foreground/75 leading-relaxed">
          <p className="font-bold text-amber-300 text-sm">
            Protokol Keamanan Migrasi Akun Discord
          </p>
          <ul className="list-disc pl-4 space-y-1 text-foreground/65">
            <li>
              Pastikan Anda sudah memverifikasi identitas asli driver (misal lewat VTC /
              Trucky / bukti kepemilikan akun lama) sebelum memindahkan akun.
            </li>
            <li>
              Semua sesi login aktif akun lama akan langsung dicabut sehingga akun yang
              ter-hack tidak lagi memiliki akses dashboard.
            </li>
            <li>
              Jika akun Discord baru sudah tertaut di <code className="text-amber-300">driverlinks</code> ke
              <strong> Trucky ID berbeda</strong>, sistem otomatis memblokir migrasi demi keamanan data VTC.
            </li>
          </ul>
        </div>
      </div>

      {/* Step 1: Form Input */}
      <form
        onSubmit={handleLoadPreview}
        className="rounded-[32px] bg-surface/40 border border-white/10 p-6 md:p-8 space-y-6"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-accent-lilac/20 text-accent-lilac text-xs font-black flex items-center justify-center">
              1
            </span>
            <h2 className="text-lg font-black text-foreground">
              Pilih Akun Sumber (Lama) & Akun Target (Baru)
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SearchableDriverPicker
            label="Discord ID Lama (Sumber / Akun Ter-hack)"
            placeholder="Contoh: 863959415702028318"
            value={oldDiscordId}
            onChange={(val) => {
              setOldDiscordId(val);
              setPreview(null);
              setExecutionResult(null);
            }}
            options={drivers}
            helperText="Cari dari daftar driver terdaftar atau tempel Discord ID lama (17-22 digit)."
          />

          <SearchableDriverPicker
            label="Discord ID Baru (Target Penerima Data)"
            placeholder="Contoh: 129384756102938475"
            value={newDiscordId}
            onChange={(val) => {
              setNewDiscordId(val);
              setPreview(null);
              setExecutionResult(null);
            }}
            options={drivers}
            helperText="Tempel Discord ID akun baru yang sudah diverifikasi milik driver."
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoadingPreview || isExecuting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-accent-lilac text-black font-black text-sm hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isLoadingPreview ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                Memeriksa Discord & Database...
              </>
            ) : (
              <>
                <RefreshCw size={17} />
                Muat Preview & Cek Konflik
              </>
            )}
          </button>
        </div>
      </form>

      {/* Step 2: Side-by-Side Preview & Conflict Resolver */}
      {preview && (
        <div className="space-y-6">
          {/* Status & Warnings */}
          {preview.blockReason && (
            <div className="rounded-3xl bg-red-500/10 border border-red-500/30 p-5 flex items-start gap-3.5">
              <ShieldAlert size={22} className="text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-black text-red-400">
                  Migrasi Diblokir oleh Validasi Sistem
                </div>
                <p className="text-xs text-red-200/80 leading-relaxed">
                  {preview.blockReason}
                </p>
              </div>
            </div>
          )}

          {preview.warnings.length > 0 && (
            <div className="rounded-3xl bg-amber-500/10 border border-amber-500/25 p-5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-400">
                <AlertTriangle size={15} />
                Peringatan Sebelum Eksekusi
              </div>
              <ul className="list-disc pl-5 space-y-1 text-xs text-amber-100/80">
                {preview.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Side by side cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Source Card */}
            <div className="rounded-[32px] bg-surface/40 border border-white/10 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="text-xs font-black uppercase tracking-widest text-red-400">
                  Akun Lama (Sumber)
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                    preview.sourceMember.inGuild
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-white/10 text-foreground/60"
                  }`}
                >
                  {preview.sourceMember.inGuild
                    ? "Di Server Discord"
                    : "Tidak di Server / Keluar"}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {preview.sourceDiscord.avatarUrl ? (
                  <Image
                    src={preview.sourceDiscord.avatarUrl}
                    alt={preview.sourceDiscord.username || preview.oldDiscordId}
                    width={56}
                    height={56}
                    unoptimized
                    className="w-14 h-14 rounded-2xl object-cover border border-white/10"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-foreground/40">
                    <UserCheck size={24} />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-base font-black text-foreground truncate">
                    {preview.sourceSummary.name ||
                      preview.sourceDiscord.globalName ||
                      preview.sourceDiscord.username ||
                      "Tanpa Nama"}
                  </div>
                  <div className="text-xs text-foreground/55 font-mono">
                    {preview.oldDiscordId}
                    {preview.sourceDiscord.username
                      ? ` • @${preview.sourceDiscord.username}`
                      : ""}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {preview.sourceSummary.truckyId && (
                      <span className="px-2 py-0.5 rounded-lg bg-accent-cyan/15 text-accent-cyan text-[10px] font-bold">
                        Trucky #{preview.sourceSummary.truckyId}
                      </span>
                    )}
                    {preview.sourceSummary.truckyRank && (
                      <span className="px-2 py-0.5 rounded-lg bg-white/10 text-foreground/75 text-[10px] font-bold">
                        {preview.sourceSummary.truckyRank}
                      </span>
                    )}
                    {preview.sourceSummary.nismaraPlusActive && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                        Nismara+ Aktif
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="text-foreground/45 flex items-center gap-1.5 mb-1">
                    <Coins size={13} /> Saldo NC
                  </div>
                  <div className="font-black text-foreground">
                    {formatNC(preview.sourceSummary.totalNC)}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="text-foreground/45 flex items-center gap-1.5 mb-1">
                    <Shield size={13} /> Poin Penalti
                  </div>
                  <div className="font-black text-foreground">
                    {preview.sourceSummary.totalPoints} Poin
                  </div>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="text-foreground/45 flex items-center gap-1.5 mb-1">
                    <Warehouse size={13} /> Garasi
                  </div>
                  <div className="font-black text-foreground">
                    {preview.sourceSummary.hasGarage
                      ? `${preview.sourceSummary.garageSlotsUsed}/${preview.sourceSummary.garageSlots} Slot • ${formatFuel(preview.sourceSummary.garageFuelStock)}`
                      : "Belum Ada"}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="text-foreground/45 flex items-center gap-1.5 mb-1">
                    <Truck size={13} /> Armada
                  </div>
                  <div className="font-black text-foreground">
                    {preview.sourceSummary.fleetsOwnedCount} Milik /{" "}
                    {preview.sourceSummary.fleetsDrivenCount} Driver
                  </div>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="text-foreground/45 flex items-center gap-1.5 mb-1">
                    <Briefcase size={13} /> Job & Transaksi
                  </div>
                  <div className="font-black text-foreground">
                    {preview.sourceSummary.jobHistoriesCount} Job •{" "}
                    {preview.sourceSummary.transactionsCount} Trx
                  </div>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="text-foreground/45 flex items-center gap-1.5 mb-1">
                    <ImageIcon size={13} /> Galeri & Market
                  </div>
                  <div className="font-black text-foreground">
                    {preview.sourceSummary.galleryPostsCount} Post •{" "}
                    {preview.sourceSummary.marketPurchasesCount} Beli
                  </div>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="text-foreground/45 flex items-center gap-1.5 mb-1">
                    <Ticket size={13} /> Tiket & Voucher
                  </div>
                  <div className="font-black text-foreground">
                    {preview.sourceSummary.ticketsCount} Tiket •{" "}
                    {preview.sourceSummary.vouchersCount} Voucher
                  </div>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="text-foreground/45 flex items-center gap-1.5 mb-1">
                    <Award size={13} /> Achiev & Season
                  </div>
                  <div className="font-black text-foreground">
                    {preview.sourceSummary.achievementsCount} Achiev •{" "}
                    {preview.sourceSummary.seasonProgressCount} Season
                  </div>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="text-foreground/45 flex items-center gap-1.5 mb-1">
                    <Database size={13} /> Order & Lainnya
                  </div>
                  <div className="font-black text-foreground">
                    {preview.sourceSummary.ordersCount +
                      preview.sourceSummary.staffRecordsCount +
                      preview.sourceSummary.otherRecordsCount}{" "}
                    Catatan
                  </div>
                </div>
              </div>
            </div>

            {/* Target Card */}
            <div className="rounded-[32px] bg-surface/40 border border-white/10 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
                  Akun Baru (Target)
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                    preview.targetMember.inGuild
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {preview.targetMember.inGuild
                    ? "Di Server Discord"
                    : preview.targetDiscord.exists
                      ? "Belum Join Server"
                      : preview.targetDiscord.apiAvailable
                        ? "ID Tidak Ditemukan"
                        : "Status API Tidak Tersedia"}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {preview.targetDiscord.avatarUrl ? (
                  <Image
                    src={preview.targetDiscord.avatarUrl}
                    alt={preview.targetDiscord.username || preview.newDiscordId}
                    width={56}
                    height={56}
                    unoptimized
                    className="w-14 h-14 rounded-2xl object-cover border border-white/10"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-foreground/40">
                    <Sparkles size={24} />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-base font-black text-foreground truncate">
                    {preview.targetDiscord.globalName ||
                      preview.targetDiscord.username ||
                      preview.targetSummary.name ||
                      "Akun Discord Target"}
                  </div>
                  <div className="text-xs text-foreground/55 font-mono">
                    {preview.newDiscordId}
                    {preview.targetDiscord.username
                      ? ` • @${preview.targetDiscord.username}`
                      : ""}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {preview.conflictStatus === "clean" && (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                        Bersih (Siap Terima Data)
                      </span>
                    )}
                    {preview.conflictStatus === "mergeable_conflict" && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                        Memiliki Data Awal / Konflik Dapat Diselesaikan
                      </span>
                    )}
                    {preview.conflictStatus === "blocked_driver_conflict" && (
                      <span className="px-2 py-0.5 rounded-lg bg-red-500/15 text-red-400 text-[10px] font-bold">
                        Konflik Trucky ID Berbeda (Diblokir)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Existing Target Data Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="text-foreground/45 mb-1">Profil Web / OAuth</div>
                  <div className="font-black text-foreground">
                    {preview.targetSummary.hasUserDoc ? "Sudah Ada" : "Belum Ada"}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="text-foreground/45 mb-1">Saldo NC</div>
                  <div className="font-black text-foreground">
                    {formatNC(preview.targetSummary.totalNC)}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="text-foreground/45 mb-1">Poin Penalti</div>
                  <div className="font-black text-foreground">
                    {preview.targetSummary.totalPoints} Poin
                  </div>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="text-foreground/45 mb-1">Garasi & Armada</div>
                  <div className="font-black text-foreground">
                    {preview.targetSummary.hasGarage ? "Ada" : "Tidak"} •{" "}
                    {preview.targetSummary.fleetsOwnedCount} Milik
                  </div>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="text-foreground/45 mb-1">Job & Transaksi</div>
                  <div className="font-black text-foreground">
                    {preview.targetSummary.jobHistoriesCount} Job •{" "}
                    {preview.targetSummary.transactionsCount} Trx
                  </div>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="text-foreground/45 mb-1">Season & Voucher</div>
                  <div className="font-black text-foreground">
                    {preview.targetSummary.seasonProgressCount} Season •{" "}
                    {preview.targetSummary.vouchersCount} Voucher
                  </div>
                </div>
              </div>

              {/* Role Sync Prediction */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-2 text-xs">
                <div className="font-black uppercase tracking-wider text-foreground/70 text-[11px]">
                  Prediksi Sinkronisasi Role Discord Server
                </div>
                <div className="flex flex-wrap gap-2">
                  {preview.rolePrediction.willAssignToNew.length > 0 ? (
                    preview.rolePrediction.willAssignToNew.map((r) => (
                      <span
                        key={r.key}
                        className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 font-bold"
                      >
                        + Berikan {r.label} ke Akun Baru
                      </span>
                    ))
                  ) : (
                    <span className="text-foreground/45">
                      Tidak ada role Driver/Intern/N+ yang perlu diberikan ke akun baru.
                    </span>
                  )}
                  {preview.rolePrediction.willRevokeFromOld.map((r) => (
                    <span
                      key={`rev-${r.key}`}
                      className="px-2.5 py-1 rounded-xl bg-red-500/15 border border-red-500/25 text-red-300 font-bold"
                    >
                      − Cabut {r.label} dari Akun Lama
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Conflict Strategy Picker & Final Confirmation */}
          {preview.canMigrate && (
            <div className="rounded-[32px] bg-surface/40 border border-white/10 p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
                <span className="w-7 h-7 rounded-full bg-accent-lilac/20 text-accent-lilac text-xs font-black flex items-center justify-center">
                  2
                </span>
                <h2 className="text-lg font-black text-foreground">
                  {preview.conflictStatus === "mergeable_conflict"
                    ? "Pilih Strategi Penyelesaian Konflik & Konfirmasi"
                    : "Konfirmasi & Eksekusi Migrasi"}
                </h2>
              </div>

              {preview.conflictStatus === "mergeable_conflict" && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 text-xs text-amber-100/85 space-y-1.5">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <Info size={15} /> Ditemukan data di akun Discord baru:
                    </div>
                    <ul className="list-disc pl-5 space-y-0.5 text-amber-100/75">
                      {preview.conflictReasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setStrategy("override")}
                      className={`text-left p-5 rounded-2xl border transition-all cursor-pointer ${
                        strategy === "override"
                          ? "bg-red-500/10 border-red-400/60 shadow-lg shadow-red-500/5"
                          : "bg-white/[0.02] border-white/10 hover:border-white/25"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-sm text-foreground">
                          Override (Timpa Data Akun Baru)
                        </span>
                        <span
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            strategy === "override"
                              ? "border-red-400 bg-red-400"
                              : "border-white/30"
                          }`}
                        />
                      </div>
                      <p className="text-xs text-foreground/60 leading-relaxed">
                        Cocok jika akun baru baru saja dibuat/login kosong. Data starter
                        (profil, NC, penalti, garasi, progres season, voucher, market/quest
                        claim) di akun baru dihapus lalu digantikan sepenuhnya oleh data akun
                        lama.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStrategy("merge")}
                      className={`text-left p-5 rounded-2xl border transition-all cursor-pointer ${
                        strategy === "merge"
                          ? "bg-emerald-500/10 border-emerald-400/60 shadow-lg shadow-emerald-500/5"
                          : "bg-white/[0.02] border-white/10 hover:border-white/25"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-sm text-foreground">
                          Merge (Gabungkan Kedua Akun)
                        </span>
                        <span
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            strategy === "merge"
                              ? "border-emerald-400 bg-emerald-400"
                              : "border-white/30"
                          }`}
                        />
                      </div>
                      <p className="text-xs text-foreground/60 leading-relaxed">
                        Menggabungkan saldo NC, poin penalti, stok garasi/fuel/safebox,
                        armada, progres Season Pass (XP & level), voucher, achievement,
                        galeri, dan riwayat dari kedua akun agar tidak ada progres yang
                        hilang.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Typed Confirmation */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase tracking-widest text-foreground/75 block">
                    Ketik Ulang Discord ID Baru untuk Konfirmasi Eksekusi
                  </label>
                  <p className="text-xs text-foreground/50">
                    Masukkan <code className="text-accent-lilac font-mono">{preview.newDiscordId}</code> untuk
                    membuka tombol eksekusi migrasi.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={confirmTargetId}
                    onChange={(e) => setConfirmTargetId(e.target.value)}
                    placeholder={`Ketik ${preview.newDiscordId}`}
                    className="flex-1 bg-background/80 border border-white/15 focus:border-emerald-400/60 rounded-2xl px-4 py-3 text-sm font-mono text-foreground outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleExecuteMigration}
                    disabled={isExecuting || confirmTargetId.trim() !== preview.newDiscordId}
                    className="px-7 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 size={17} className="animate-spin" />
                        Memigrasikan Seluruh Data...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={17} />
                        Eksekusi Migrasi Akun
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Post-Execution Detailed Report */}
      {executionResult && (
        <div className="rounded-[32px] bg-emerald-500/[0.06] border border-emerald-500/30 p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-500/20 pb-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={28} className="text-emerald-400 shrink-0" />
              <div>
                <h2 className="text-xl font-black text-emerald-300">
                  Migrasi Akun Berhasil Dieksekusi!
                </h2>
                <p className="text-xs text-foreground/65">
                  ID: <span className="font-mono font-bold">{executionResult.migrationId}</span> •{" "}
                  Mode:{" "}
                  <span className="uppercase font-bold">{executionResult.strategy}</span> • Total{" "}
                  <span className="font-bold text-foreground">
                    {executionResult.totalDocumentsTouched}
                  </span>{" "}
                  dokumen/catatan diproses
                </p>
              </div>
            </div>
          </div>

          {/* Role Sync Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded-2xl bg-black/25 border border-white/10 p-4 space-y-2">
              <div className="font-black uppercase tracking-wider text-foreground/70">
                Sinkronisasi Role Discord
              </div>
              {executionResult.roleSync.assigned.map((r, i) => (
                <div key={`a-${i}`} className="text-emerald-400 font-semibold">
                  ✓ Role {r.label} diberikan ke {executionResult.newDiscordId}
                </div>
              ))}
              {executionResult.roleSync.revoked.map((r, i) => (
                <div key={`r-${i}`} className="text-sky-300 font-semibold">
                  ✓ Role {r.label} dicabut dari {executionResult.oldDiscordId}
                </div>
              ))}
              {executionResult.roleSync.skipped.map((msg, i) => (
                <div key={`s-${i}`} className="text-amber-300">
                  • {msg}
                </div>
              ))}
              {executionResult.roleSync.errors.map((err, i) => (
                <div key={`e-${i}`} className="text-red-400 font-semibold">
                  ✕ {err}
                </div>
              ))}
              {executionResult.roleSync.managerRoleNotice && (
                <div className="text-amber-200/80 pt-1">
                  ℹ {executionResult.roleSync.managerRoleNotice}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-black/25 border border-white/10 p-4 space-y-2">
              <div className="font-black uppercase tracking-wider text-foreground/70">
                Auth & Cache Redis Dibersihkan
              </div>
              <div className="text-foreground/75">
                Canonical User ID:{" "}
                <span className="font-mono text-accent-lilac">
                  {executionResult.canonicalUserId || "-"}
                </span>
              </div>
              <div className="text-foreground/60">
                Redis Keys Cleared:{" "}
                {executionResult.redisKeysCleared.length > 0
                  ? executionResult.redisKeysCleared.join(", ")
                  : "Tidak ada cache aktif"}
              </div>
            </div>
          </div>

          {/* Collection Breakdown Table */}
          {executionResult.collections.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.04] text-foreground/55 uppercase tracking-wider text-[10px] font-black">
                  <tr>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Koleksi MongoDB</th>
                    <th className="px-4 py-3 text-right">Diperbarui</th>
                    <th className="px-4 py-3 text-right">Konflik Dihapus</th>
                    <th className="px-4 py-3">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {executionResult.collections.map((c, idx) => (
                    <tr key={`${c.collection}-${idx}`} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-foreground/60">{c.group}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-foreground">
                        {c.collection}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-400">
                        {c.updatedCount}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-amber-400">
                        {c.deletedConflictsCount}
                      </td>
                      <td className="px-4 py-2.5 text-foreground/55">{c.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Audit Log History */}
      <div className="rounded-[32px] bg-surface/40 border border-white/10 p-6 md:p-8 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <History size={20} className="text-accent-lilac" />
            <h2 className="text-lg font-black text-foreground">
              Riwayat Audit Migrasi Akun
            </h2>
          </div>
          <span className="text-xs text-foreground/45 font-bold">
            {history.length} catatan terbaru
          </span>
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-foreground/45">
            Belum ada riwayat migrasi akun yang tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-foreground/50 uppercase tracking-wider text-[10px] font-black">
                <tr>
                  <th className="px-4 py-3">Waktu (WIB)</th>
                  <th className="px-4 py-3">ID & Mode</th>
                  <th className="px-4 py-3">Akun Lama → Baru</th>
                  <th className="px-4 py-3">Trucky ID</th>
                  <th className="px-4 py-3 text-right">Record</th>
                  <th className="px-4 py-3">Eksekutor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.map((h) => (
                  <tr key={h._id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 whitespace-nowrap text-foreground/70">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-foreground/40" />
                        {formatWIB(h.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-foreground">
                        {h.migrationId}
                      </div>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          h.strategy === "merge"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {h.strategy}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      <div className="text-red-300">{h.oldDiscordId}</div>
                      <div className="text-emerald-300">→ {h.newDiscordId}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-foreground/70">
                      {h.sourceTruckyId ? `#${h.sourceTruckyId}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-foreground">
                      {h.totalDocumentsTouched}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-foreground">{h.executedByName}</div>
                      <div className="text-[10px] font-mono text-foreground/45">
                        {h.executedByDiscordId}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

