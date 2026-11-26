"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Plus,
  Download,
  Edit3,
  Trash2,
  X,
  Save,
  Loader2,
  UploadCloud,
  Calendar,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import DecoratedAvatar from "@/components/profile/DecoratedAvatar";
import {
  AVATAR_DECORATION_ACCESS_MAP,
  AVATAR_DECORATION_ACCESS_OPTIONS,
  AVATAR_DECORATION_CATEGORIES,
  AVATAR_DECORATION_RARITY_STYLES,
  SVG_DECORATION_PRESETS,
  getDecorationScheduleStatus,
  type AvatarDecorationAccess,
  type AvatarDecorationCategory,
  type AvatarDecorationDef,
  type AvatarDecorationRarity,
} from "@/lib/avatarDecorations";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { showAlert, showConfirm } from "@/lib/dialog";
import { formatWIBDateTimeLocal, slugify } from "@/lib/utils";

interface AvatarDecorationsClientProps {
  initialItems: AvatarDecorationDef[];
  initialIsSeeded: boolean;
  previewAvatarUrl: string;
  previewUserName: string;
}

interface EditorFormState {
  _id: string | null;
  name: string;
  slug: string;
  description: string;
  category: AvatarDecorationCategory;
  rarity: AvatarDecorationRarity;
  access: AvatarDecorationAccess;
  renderType: "image" | "svg";
  svgPresetKey: string;
  assetUrl: string;
  scale: number;
  accentColor: string;
  isActive: boolean;
  sortOrder: number;
  availableFrom: string;
  availableUntil: string;
}

const DEFAULT_FORM: EditorFormState = {
  _id: null,
  name: "",
  slug: "",
  description: "",
  category: "signature",
  rarity: "exclusive",
  access: "nismara_plus",
  renderType: "image",
  svgPresetKey: "nismara-aurora",
  assetUrl: "",
  scale: 1.28,
  accentColor: "#8b5cf6",
  isActive: true,
  sortOrder: 10,
  availableFrom: "",
  availableUntil: "",
};

function formatShortWib(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} WIB`;
}

export default function AvatarDecorationsClient({
  initialItems,
  initialIsSeeded,
  previewAvatarUrl,
  previewUserName,
}: AvatarDecorationsClientProps) {
  const router = useRouter();
  const [items, setItems] = useState<AvatarDecorationDef[]>(initialItems);
  const [isSeeded, setIsSeeded] = useState(initialIsSeeded);
  const [accessFilter, setAccessFilter] = useState<"all" | AvatarDecorationAccess>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Drawer Editor State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<EditorFormState>(DEFAULT_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setItems(initialItems);
    setIsSeeded(initialIsSeeded);
  }, [initialItems, initialIsSeeded]);

  // Revoke object URL saat drawer ditutup atau file diganti
  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  // Tutup drawer dengan Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) {
        closeDrawer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, isSaving]);

  const filteredItems = useMemo(() => {
    if (accessFilter === "all") return items;
    return items.filter((i) => i.access === accessFilter);
  }, [items, accessFilter]);

  const fetchLatest = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/manage/avatar-decorations", NO_CACHE_FETCH_OPTIONS);
      const json = await res.json();
      if (json.success) {
        setItems(json.items || []);
        setIsSeeded(Boolean(json.isSeeded));
      }
    } catch (err) {
      console.error("Refresh decorations error:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSeedStarter = async () => {
    const ok = await showConfirm(
      "Impor 6 dekorasi bawaan (Nismara Aurora, Mahkota Emas, RPM Redline, Angin Sakura, Prisma HUD, Gerhana Surya) ke database? Dekorasi yang sudah ada tidak akan ditimpa.",
      "Impor Dekorasi Bawaan",
    );
    if (!ok) return;

    setIsSeeding(true);
    try {
      const res = await fetch("/api/manage/avatar-decorations/seed", {
        method: "POST",
        ...NO_CACHE_FETCH_OPTIONS,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        await showAlert(json.error || "Gagal mengimpor dekorasi bawaan.");
        return;
      }
      await showAlert(json.message);
      await fetchLatest();
      router.refresh();
    } catch (err: any) {
      await showAlert(err?.message || "Kesalahan koneksi.");
    } finally {
      setIsSeeding(false);
    }
  };

  const openCreateDrawer = () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    setPendingFile(null);
    setSlugTouched(false);
    setForm({
      ...DEFAULT_FORM,
      sortOrder: items.length + 1,
    });
    setDrawerOpen(true);
  };

  const openEditDrawer = (item: AvatarDecorationDef) => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    setPendingFile(null);
    setSlugTouched(true);
    setForm({
      _id: item._id || null,
      name: item.name,
      slug: item.id,
      description: item.description || "",
      category: item.category,
      rarity: item.rarity,
      access: item.access,
      renderType: item.renderType,
      svgPresetKey: item.svgPresetKey || "nismara-aurora",
      assetUrl: item.assetUrl || "",
      scale: item.scale ?? 1.28,
      accentColor: item.accentColor || "#8b5cf6",
      isActive: item.isActive,
      sortOrder: item.sortOrder ?? 10,
      availableFrom: formatWIBDateTimeLocal(item.availableFrom),
      availableUntil: formatWIBDateTimeLocal(item.availableUntil),
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    setPendingFile(null);
    setDrawerOpen(false);
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/gif", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      showAlert(
        "Format file harus GIF, PNG (termasuk APNG), atau WebP (termasuk Animated WebP) agar transparansi dan animasi tetap utuh.",
      );
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showAlert("Ukuran file maksimal 5 MB.");
      e.target.value = "";
      return;
    }

    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    const objUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(objUrl);
    setPendingFile(file);
    setForm((prev) => ({ ...prev, renderType: "image" }));
  };

  const uploadDecorationToR2 = async (file: File): Promise<string> => {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        folder: "avatar-decorations",
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.signedUrl || !data.publicUrl) {
      throw new Error(data.error || "Gagal mendapatkan URL upload R2.");
    }

    const putRes = await fetch(data.signedUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!putRes.ok) {
      throw new Error("Gagal mengunggah file dekorasi ke Cloudflare R2.");
    }
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      await showAlert("Nama dekorasi wajib diisi.");
      return;
    }
    if (form.renderType === "image" && !pendingFile && !form.assetUrl.trim()) {
      await showAlert("Unggah file GIF / PNG / WebP terlebih dahulu.");
      return;
    }

    setIsSaving(true);
    try {
      let finalAssetUrl = form.assetUrl.trim();
      if (form.renderType === "image" && pendingFile) {
        // Deferred upload saat submit — file GIF/APNG/WebP diunggah apa adanya agar animasi tidak rusak
        finalAssetUrl = await uploadDecorationToR2(pendingFile);
      }

      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        description: form.description.trim(),
        category: form.category,
        rarity: form.rarity,
        access: form.access,
        renderType: form.renderType,
        svgPresetKey: form.renderType === "svg" ? form.svgPresetKey : null,
        assetUrl: form.renderType === "image" ? finalAssetUrl : null,
        scale: form.scale,
        accentColor: form.accentColor,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
        availableFrom: form.availableFrom || null,
        availableUntil: form.availableUntil || null,
      };

      const url = form._id
        ? `/api/manage/avatar-decorations/${form._id}`
        : "/api/manage/avatar-decorations";
      const method = form._id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        ...NO_CACHE_FETCH_OPTIONS,
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        await showAlert(json.error || "Gagal menyimpan dekorasi.");
        return;
      }

      closeDrawer();
      await fetchLatest();
      router.refresh();
    } catch (err: any) {
      await showAlert(err?.message || "Terjadi kesalahan saat menyimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (item: AvatarDecorationDef) => {
    if (!item._id) return;
    setBusyId(item._id);
    try {
      const res = await fetch(`/api/manage/avatar-decorations/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        ...NO_CACHE_FETCH_OPTIONS,
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        await showAlert(json.error || "Gagal mengubah status dekorasi.");
        return;
      }
      await fetchLatest();
      router.refresh();
    } catch (err: any) {
      await showAlert(err?.message || "Kesalahan koneksi.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: AvatarDecorationDef) => {
    if (!item._id) return;
    const ok = await showConfirm(
      `Hapus dekorasi "${item.name}" secara permanen? Jika memakai file gambar/GIF di R2, file tersebut juga akan ikut dihapus.`,
      "Hapus Dekorasi Avatar",
    );
    if (!ok) return;

    setBusyId(item._id);
    try {
      const res = await fetch(`/api/manage/avatar-decorations/${item._id}`, {
        method: "DELETE",
        ...NO_CACHE_FETCH_OPTIONS,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        await showAlert(json.error || "Gagal menghapus dekorasi.");
        return;
      }
      await fetchLatest();
      router.refresh();
    } catch (err: any) {
      await showAlert(err?.message || "Kesalahan koneksi.");
    } finally {
      setBusyId(null);
    }
  };

  // Live preview definition untuk drawer
  const livePreviewDef: AvatarDecorationDef = {
    id: form.slug || "preview",
    name: form.name || "Pratinjau",
    description: form.description,
    category: form.category,
    rarity: form.rarity,
    access: form.access,
    renderType: form.renderType,
    svgPresetKey: form.renderType === "svg" ? form.svgPresetKey : null,
    assetUrl:
      form.renderType === "image"
        ? localPreviewUrl || form.assetUrl || null
        : null,
    scale: form.scale,
    accentColor: form.accentColor,
    isActive: true,
    sortOrder: form.sortOrder,
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/dashboard/manage/data"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Manage Data
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Avatar Decorations
          </h1>
          <p className="text-xs text-muted-foreground">
            Kelola bingkai avatar (GIF, APNG, WebP animasi, PNG, atau SVG) untuk Nismara+, Event, Gratis berbatas waktu, Staff, dan Top Manager.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchLatest}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground transition-colors disabled:opacity-50"
            title="Muat ulang daftar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
          <button
            type="button"
            onClick={handleSeedStarter}
            disabled={isSeeding}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground transition-colors disabled:opacity-50"
          >
            {isSeeding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Impor 6 Bawaan</span>
          </button>
          <button
            type="button"
            onClick={openCreateDrawer}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Dekorasi</span>
          </button>
        </div>
      </div>

      {/* Empty DB Notice */}
      {!isSeeded && items.length === 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-foreground/90 space-y-0.5">
            <p className="font-bold text-amber-400">
              Database dekorasi masih kosong (sedang memakai 6 preset bawaan sementara)
            </p>
            <p className="text-muted-foreground">
              Klik <strong>Impor 6 Bawaan</strong> untuk memasukkan 6 desain awal ke database agar bisa diedit/diatur, atau langsung klik <strong>Tambah Dekorasi</strong> untuk mengunggah frame GIF/PNG/WebP baru.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSeedStarter}
            disabled={isSeeding}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shrink-0 transition-colors"
          >
            {isSeeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Impor Sekarang
          </button>
        </div>
      )}

      {/* Filter Pills by Access Tier */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setAccessFilter("all")}
          className={`px-3.5 py-1.5 min-h-[36px] rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors ${
            accessFilter === "all"
              ? "bg-primary/15 text-primary border-primary/40"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          Semua ({items.length})
        </button>
        {AVATAR_DECORATION_ACCESS_OPTIONS.map((opt) => {
          const count = items.filter((i) => i.access === opt.id).length;
          const active = accessFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAccessFilter(opt.id)}
              className={`px-3.5 py-1.5 min-h-[36px] rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors ${
                active
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {opt.shortLabel} ({count})
            </button>
          );
        })}
      </div>

      {/* Desktop Table */}
      {filteredItems.length > 0 ? (
        <>
          <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3">Pratinjau &amp; Nama</th>
                    <th className="px-4 py-3">Akses</th>
                    <th className="px-4 py-3">Jadwal (WIB)</th>
                    <th className="px-4 py-3">Sumber / Scale</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredItems.map((item) => {
                    const accessInfo = AVATAR_DECORATION_ACCESS_MAP[item.access];
                    const rarity = AVATAR_DECORATION_RARITY_STYLES[item.rarity];
                    const sched = getDecorationScheduleStatus(item);
                    const isBusy = busyId === item._id;

                    return (
                      <tr key={item._id || item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3.5">
                            <DecoratedAvatar
                              src={previewAvatarUrl}
                              alt={item.name}
                              decoration={item}
                              forcePreview
                              sizeClass="w-11 h-11"
                              frameClass="border-2 border-background"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground truncate max-w-[200px]">
                                  {item.name}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${rarity.badgeClass}`}>
                                  {rarity.label}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground font-mono truncate max-w-[240px]">
                                {item.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border ${accessInfo.badgeClass}`}>
                            {accessInfo.shortLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs">
                          {sched.state === "permanent" ? (
                            <span className="text-muted-foreground">Permanen</span>
                          ) : (
                            <div className="space-y-0.5">
                              <span
                                className={`inline-block font-semibold ${
                                  sched.state === "active"
                                    ? "text-emerald-400"
                                    : sched.state === "scheduled"
                                      ? "text-sky-400"
                                      : "text-red-400"
                                }`}
                              >
                                {sched.state === "active"
                                  ? "Berjalan"
                                  : sched.state === "scheduled"
                                    ? "Terjadwal"
                                    : "Berakhir"}
                              </span>
                              <div className="text-[11px] text-muted-foreground">
                                {item.availableFrom ? formatShortWib(item.availableFrom) : "Langsung"} –{" "}
                                {item.availableUntil ? formatShortWib(item.availableUntil) : "Tanpa batas"}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                          <div>{item.renderType === "image" ? "Gambar/GIF (R2)" : "Preset SVG"}</div>
                          <div className="text-[11px] font-mono">Scale {item.scale.toFixed(2)}x • #{item.sortOrder}</div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleActive(item)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              item.isActive
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20"
                                : "bg-muted text-muted-foreground border-border hover:text-foreground"
                            }`}
                          >
                            {item.isActive ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Aktif
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                Nonaktif
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditDrawer(item)}
                              className="p-2 rounded-lg bg-muted/60 hover:bg-muted text-foreground border border-border/60 transition-colors"
                              title="Edit dekorasi"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDelete(item)}
                              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 transition-colors disabled:opacity-50"
                              title="Hapus dekorasi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredItems.map((item) => {
              const accessInfo = AVATAR_DECORATION_ACCESS_MAP[item.access];
              const sched = getDecorationScheduleStatus(item);
              const isBusy = busyId === item._id;

              return (
                <div
                  key={item._id || item.id}
                  className="rounded-2xl border border-border bg-card p-4 space-y-3"
                >
                  <div className="flex items-center gap-3.5">
                    <DecoratedAvatar
                      src={previewAvatarUrl}
                      alt={item.name}
                      decoration={item}
                      forcePreview
                      sizeClass="w-12 h-12"
                      frameClass="border-2 border-background"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{item.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${accessInfo.badgeClass}`}>
                          {accessInfo.shortLabel}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {sched.state === "permanent"
                            ? "Permanen"
                            : sched.state === "active"
                              ? "Jadwal Aktif"
                              : sched.state === "scheduled"
                                ? "Terjadwal"
                                : "Berakhir"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleToggleActive(item)}
                      className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold border ${
                        item.isActive
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {item.isActive ? "Aktif" : "Nonaktif"}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditDrawer(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-muted text-foreground text-xs font-semibold border border-border"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(item)}
                        className="inline-flex items-center justify-center p-2.5 min-h-[40px] min-w-[40px] rounded-xl bg-red-500/10 text-red-400 border border-red-500/25"
                        aria-label="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center space-y-2">
          <Sparkles className="w-8 h-8 text-muted-foreground/50 mx-auto" />
          <p className="text-sm font-semibold text-foreground">
            Belum ada dekorasi di filter ini
          </p>
          <p className="text-xs text-muted-foreground">
            Klik Tambah Dekorasi untuk mengunggah frame GIF, PNG (APNG), atau WebP animasi.
          </p>
        </div>
      )}

      {/* Slide-Over Drawer Editor */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div
            className="fixed inset-0"
            onClick={() => !isSaving && closeDrawer()}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={form._id ? "Edit Dekorasi Avatar" : "Tambah Dekorasi Avatar"}
            className="relative z-10 w-full max-w-xl bg-card border-l border-border h-full flex flex-col shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {form._id ? "Edit Dekorasi Avatar" : "Tambah Dekorasi Baru"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Mendukung file GIF transparan, APNG, WebP animasi, PNG, maupun preset SVG.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                disabled={isSaving}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <form
              id="avatar-deco-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto px-5 py-5 pb-24 space-y-5"
            >
              {/* Dual Live Preview */}
              <div className="rounded-2xl bg-background/60 border border-border/70 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">
                    Pratinjau Live (Profil &amp; Leaderboard)
                  </span>
                  <span className="font-mono text-foreground tabular-nums">
                    Scale {form.scale.toFixed(2)}x
                  </span>
                </div>
                <div className="flex items-center justify-center gap-8 py-3">
                  <div className="flex flex-col items-center gap-2">
                    <DecoratedAvatar
                      src={previewAvatarUrl}
                      alt={previewUserName}
                      decoration={livePreviewDef}
                      forcePreview
                      sizeClass="w-24 h-24"
                      frameClass="border-[3px] border-background"
                    />
                    <span className="text-[11px] text-muted-foreground">Profil</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <DecoratedAvatar
                      src={previewAvatarUrl}
                      alt={previewUserName}
                      decoration={livePreviewDef}
                      forcePreview
                      sizeClass="w-10 h-10"
                      frameClass="border-2 border-background"
                    />
                    <span className="text-[11px] text-muted-foreground">Leaderboard</span>
                  </div>
                </div>
                <label className="block space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Ukuran Bingkai (Scale Overhang)</span>
                    <span className="font-mono text-foreground">{form.scale.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={1.6}
                    step={0.02}
                    value={form.scale}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        scale: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-primary cursor-pointer h-2"
                  />
                </label>
              </div>

              {/* Render Type Switcher */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Sumber Visual Bingkai
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, renderType: "image" }))}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                      form.renderType === "image"
                        ? "bg-primary/15 text-primary border-primary/40"
                        : "bg-background/40 text-muted-foreground border-border"
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    Upload GIF / PNG / WebP
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, renderType: "svg" }))}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                      form.renderType === "svg"
                        ? "bg-primary/15 text-primary border-primary/40"
                        : "bg-background/40 text-muted-foreground border-border"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    Preset SVG Bawaan
                  </button>
                </div>
              </div>

              {form.renderType === "image" ? (
                <div className="space-y-2.5">
                  <label
                    htmlFor="deco-asset-upload"
                    className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 bg-background/40 cursor-pointer transition-colors text-center"
                  >
                    <UploadCloud className="w-6 h-6 text-primary" />
                    <div className="text-xs font-semibold text-foreground">
                      {pendingFile
                        ? `File siap diunggah: ${pendingFile.name}`
                        : form.assetUrl
                          ? "Ganti file GIF / PNG / WebP"
                          : "Pilih file GIF, PNG (APNG), atau WebP"}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Rasio 1:1 (misal 512x512 px) latar transparan, maks 5 MB. Animasi GIF/APNG/WebP tetap utuh.
                    </p>
                  </label>
                  <input
                    id="deco-asset-upload"
                    type="file"
                    accept="image/gif,image/png,image/webp"
                    className="hidden"
                    onChange={handleSelectFile}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground block">
                    Pilih Preset SVG
                  </label>
                  <select
                    value={form.svgPresetKey}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, svgPresetKey: e.target.value }))
                    }
                    className="w-full rounded-xl bg-background border border-border px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {SVG_DECORATION_PRESETS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground block">
                    Nama Dekorasi *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={form.name}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      setForm((p) => ({
                        ...p,
                        name: nextName,
                        slug: slugTouched ? p.slug : slugify(nextName),
                      }));
                    }}
                    placeholder="Contoh: Anniversary 2026"
                    className="w-full rounded-xl bg-background border border-border px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground block">
                    Slug Unik *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setForm((p) => ({ ...p, slug: slugify(e.target.value) }));
                    }}
                    placeholder="anniversary-2026"
                    className="w-full rounded-xl bg-background border border-border px-3.5 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Deskripsi Singkat
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Jelaskan singkat gaya atau momen dekorasi ini..."
                  className="w-full rounded-xl bg-background border border-border px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {/* Access, Category, Rarity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground block">
                    Tipe Akses *
                  </label>
                  <select
                    value={form.access}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        access: e.target.value as AvatarDecorationAccess,
                      }))
                    }
                    className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {AVATAR_DECORATION_ACCESS_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground block">
                    Kategori
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        category: e.target.value as AvatarDecorationCategory,
                      }))
                    }
                    className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {AVATAR_DECORATION_CATEGORIES.filter((c) => c.id !== "all").map(
                      (cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground block">
                    Rarity Label
                  </label>
                  <select
                    value={form.rarity}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        rarity: e.target.value as AvatarDecorationRarity,
                      }))
                    }
                    className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {Object.entries(AVATAR_DECORATION_RARITY_STYLES).map(
                      ([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              {/* Optional Time Window (WIB) */}
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Calendar className="w-4 h-4 text-sky-400" />
                    <span>Batas Waktu Berlaku (Opsional — WIB)</span>
                  </div>
                  {(form.availableFrom || form.availableUntil) && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          availableFrom: "",
                          availableUntil: "",
                        }))
                      }
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Jadikan Permanen
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Kosongkan keduanya untuk dekorasi permanen, atau isi jadwal khusus (misal perayaan Anniversary / event musiman). Setelah lewat batas waktu, dekorasi otomatis berhenti tampil.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground block">
                      Mulai Berlaku (WIB)
                    </label>
                    <input
                      type="datetime-local"
                      value={form.availableFrom}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, availableFrom: e.target.value }))
                      }
                      className="w-full rounded-xl bg-background border border-border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground block">
                      Berakhir Pada (WIB)
                    </label>
                    <input
                      type="datetime-local"
                      value={form.availableUntil}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, availableUntil: e.target.value }))
                      }
                      className="w-full rounded-xl bg-background border border-border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Sort Order & Active Toggle */}
              <div className="grid grid-cols-2 gap-3.5 items-center">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground block">
                    Urutan Tampil
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        sortOrder: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full rounded-xl bg-background border border-border px-3.5 py-2 text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <label className="flex items-center gap-2.5 pt-5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, isActive: e.target.checked }))
                    }
                    className="w-4 h-4 accent-primary rounded"
                  />
                  <span className="text-xs font-semibold text-foreground">
                    Aktifkan &amp; Tampilkan ke Driver
                  </span>
                </label>
              </div>
            </form>

            {/* Drawer Footer */}
            <div className="px-5 py-4 border-t border-border bg-card flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={closeDrawer}
                disabled={isSaving}
                className="px-4 py-2.5 min-h-[42px] rounded-xl bg-muted hover:bg-muted/80 text-xs font-semibold text-foreground transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                form="avatar-deco-form"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Simpan Dekorasi
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
