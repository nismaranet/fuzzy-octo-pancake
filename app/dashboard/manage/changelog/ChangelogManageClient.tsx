"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Download,
  X,
  ArrowUp,
  ArrowDown,
  Save,
  Loader2,
  FileClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { showAlert, showConfirm } from "@/lib/dialog";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { formatWIBDateTimeLocal } from "@/lib/utils";
import type { ChangelogProduct, ChangelogStatus } from "@/lib/models/ChangelogEntry";
import {
  CHANGELOG_PRODUCTS,
  CHANGELOG_PRODUCT_MAP,
  buildReleaseCountSentence,
  formatChangelogDateWIB,
  sortChangelogEntriesDesc,
  type SerializedChangelogEntry,
} from "@/lib/changelog";

type SectionKey = "added" | "improved" | "fixed";
type DrawerTab = "editor" | "preview";

interface FormState {
  product: ChangelogProduct;
  version: string;
  title: string;
  summary: string;
  releaseDate: string;
  status: ChangelogStatus;
  sections: {
    added: string[];
    improved: string[];
    fixed: string[];
  };
  highlightFeatureUrl: string;
  highlightFeatureLabel: string;
  articleUrl: string;
}

const SECTION_CONFIG: {
  key: SectionKey;
  label: string;
  placeholder: string;
  dotClass: string;
}[] = [
  {
    key: "added",
    label: "Fitur Baru",
    placeholder: "Contoh: Menambahkan tab Keamanan dan Sesi di menu Pengaturan...",
    dotClass: "bg-emerald-400",
  },
  {
    key: "improved",
    label: "Peningkatan",
    placeholder: "Contoh: Halaman dashboard kini dimuat lebih ringan...",
    dotClass: "bg-sky-400",
  },
  {
    key: "fixed",
    label: "Perbaikan",
    placeholder: "Contoh: Memperbaiki kendala transaksi pembelian di Community Market...",
    dotClass: "bg-amber-400",
  },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background";

function createEmptyForm(defaultProduct: ChangelogProduct = "web"): FormState {
  return {
    product: defaultProduct,
    version: "",
    title: "",
    summary: "",
    releaseDate: formatWIBDateTimeLocal(new Date()),
    status: "draft",
    sections: {
      added: [""],
      improved: [],
      fixed: [],
    },
    highlightFeatureUrl: "",
    highlightFeatureLabel: "",
    articleUrl: "",
  };
}

function formatShortDateWIB(dateInput: string): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ChangelogManageClient({
  initialEntries,
}: {
  initialEntries: SerializedChangelogEntry[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<SerializedChangelogEntry[]>(initialEntries);
  const [filterProduct, setFilterProduct] = useState<ChangelogProduct | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ChangelogStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Slide-over Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("editor");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => createEmptyForm("web"));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  // Tutup drawer dengan tombol Escape (aksesibilitas keyboard)
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, isSaving]);

  // Reset ke halaman 1 setiap kali filter/search/pageSize berubah
  useEffect(() => {
    setPage(1);
  }, [filterProduct, filterStatus, searchQuery, pageSize]);

  const refreshEntries = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/manage/changelog", NO_CACHE_FETCH_OPTIONS);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLoadError(data.error || "Gagal memuat ulang daftar changelog.");
        return;
      }
      if (Array.isArray(data.entries)) {
        setEntries(sortChangelogEntriesDesc(data.entries));
      }
    } catch {
      setLoadError("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
    } finally {
      setIsLoading(false);
      router.refresh();
    }
  };

  const productCounts = useMemo(() => {
    const counts: Record<ChangelogProduct | "all", number> = {
      all: entries.length,
      web: 0,
      natasya: 0,
      tracker: 0,
    };
    for (const e of entries) {
      counts[e.product] = (counts[e.product] || 0) + 1;
    }
    return counts;
  }, [entries]);

  const draftCount = useMemo(
    () => entries.filter((e) => e.status === "draft").length,
    [entries]
  );

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filterProduct !== "all" && entry.product !== filterProduct) return false;
      if (filterStatus !== "all" && entry.status !== filterStatus) return false;
      if (q) {
        const hay = `${entry.version} ${entry.title} ${entry.summary}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, filterProduct, filterStatus, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedEntries = filteredEntries.slice(startIndex, startIndex + pageSize);

  const openCreateDrawer = () => {
    setEditingId(null);
    setDrawerTab("editor");
    setForm(createEmptyForm(filterProduct === "all" ? "web" : filterProduct));
    setDrawerOpen(true);
  };

  const openEditDrawer = (entry: SerializedChangelogEntry) => {
    setEditingId(entry._id);
    setDrawerTab("editor");
    setForm({
      product: entry.product,
      version: entry.version,
      title: entry.title,
      summary: entry.summary,
      releaseDate: formatWIBDateTimeLocal(entry.releaseDate),
      status: entry.status,
      sections: {
        added: [...(entry.sections.added || [])],
        improved: [...(entry.sections.improved || [])],
        fixed: [...(entry.sections.fixed || [])],
      },
      highlightFeatureUrl: entry.highlightFeatureUrl || "",
      highlightFeatureLabel: entry.highlightFeatureLabel || "",
      articleUrl: entry.articleUrl || "",
    });
    setDrawerOpen(true);
  };

  const handleAddRow = (key: SectionKey) => {
    setForm((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [key]: [...prev.sections[key], ""],
      },
    }));
  };

  const handleChangeRow = (key: SectionKey, idx: number, value: string) => {
    setForm((prev) => {
      const nextList = [...prev.sections[key]];
      nextList[idx] = value;
      return {
        ...prev,
        sections: { ...prev.sections, [key]: nextList },
      };
    });
  };

  const handleRemoveRow = (key: SectionKey, idx: number) => {
    setForm((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [key]: prev.sections[key].filter((_, i) => i !== idx),
      },
    }));
  };

  const handleMoveRow = (key: SectionKey, idx: number, dir: -1 | 1) => {
    setForm((prev) => {
      const list = [...prev.sections[key]];
      const target = idx + dir;
      if (target < 0 || target >= list.length) return prev;
      [list[idx], list[target]] = [list[target], list[idx]];
      return {
        ...prev,
        sections: { ...prev.sections, [key]: list },
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedSections = {
      added: form.sections.added.map((s) => s.trim()).filter(Boolean),
      improved: form.sections.improved.map((s) => s.trim()).filter(Boolean),
      fixed: form.sections.fixed.map((s) => s.trim()).filter(Boolean),
    };

    if (
      cleanedSections.added.length +
        cleanedSections.improved.length +
        cleanedSections.fixed.length ===
      0
    ) {
      await showAlert(
        "Isi minimal 1 poin pada Fitur Baru, Peningkatan, atau Perbaikan.",
        "Validasi"
      );
      return;
    }

    setIsSaving(true);
    try {
      const endpoint = editingId
        ? `/api/manage/changelog/${editingId}`
        : "/api/manage/changelog";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        ...NO_CACHE_FETCH_OPTIONS,
        method,
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product: form.product,
          version: form.version,
          title: form.title,
          summary: form.summary,
          releaseDate: form.releaseDate,
          status: form.status,
          sections: cleanedSections,
          highlightFeatureUrl: form.highlightFeatureUrl || null,
          highlightFeatureLabel: form.highlightFeatureLabel || null,
          articleUrl: form.articleUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        await showAlert(data.error || "Gagal menyimpan catatan perubahan.", "Gagal");
        return;
      }

      setDrawerOpen(false);
      await refreshEntries();
      await showAlert(data.message || "Catatan perubahan berhasil disimpan.", "Berhasil");
    } catch (err: any) {
      await showAlert(err?.message || "Terjadi kesalahan jaringan.", "Error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePublish = async (entry: SerializedChangelogEntry) => {
    const nextStatus: ChangelogStatus =
      entry.status === "published" ? "draft" : "published";
    const confirmed = await showConfirm(
      nextStatus === "published"
        ? `Publikasikan v${entry.version} (${CHANGELOG_PRODUCT_MAP[entry.product].label}) ke halaman /changelog publik?`
        : `Ubah v${entry.version} menjadi Draft (sembunyikan dari publik)?`,
      nextStatus === "published" ? "Publikasikan Rilis" : "Ubah ke Draft"
    );
    if (!confirmed) return;

    setBusyId(entry._id);
    try {
      const res = await fetch(`/api/manage/changelog/${entry._id}`, {
        ...NO_CACHE_FETCH_OPTIONS,
        method: "PATCH",
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        await showAlert(data.error || "Gagal mengubah status rilis.", "Gagal");
        return;
      }
      await refreshEntries();
    } catch (err: any) {
      await showAlert(err?.message || "Terjadi kesalahan jaringan.", "Error");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (entry: SerializedChangelogEntry) => {
    const confirmed = await showConfirm(
      `Yakin hapus permanen catatan perubahan v${entry.version} (${CHANGELOG_PRODUCT_MAP[entry.product].label})?`,
      "Hapus Changelog"
    );
    if (!confirmed) return;

    setBusyId(entry._id);
    try {
      const res = await fetch(`/api/manage/changelog/${entry._id}`, {
        ...NO_CACHE_FETCH_OPTIONS,
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        await showAlert(data.error || "Gagal menghapus catatan perubahan.", "Gagal");
        return;
      }
      await refreshEntries();
      await showAlert(data.message || "Catatan perubahan dihapus.", "Berhasil");
    } catch (err: any) {
      await showAlert(err?.message || "Terjadi kesalahan jaringan.", "Error");
    } finally {
      setBusyId(null);
    }
  };

  const handleSeedInitial = async () => {
    const confirmed = await showConfirm(
      "Impor riwayat versi awal non-teknis untuk Web Transport, Bot Natasya, dan Nismara Tracker? Versi yang sudah ada di database tidak akan ditimpa.",
      "Impor Riwayat Awal"
    );
    if (!confirmed) return;

    setIsSeeding(true);
    try {
      const res = await fetch("/api/manage/changelog/seed", {
        ...NO_CACHE_FETCH_OPTIONS,
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        await showAlert(data.error || "Gagal mengimpor riwayat awal.", "Gagal");
        return;
      }
      await refreshEntries();
      await showAlert(data.message || "Riwayat awal berhasil diimpor.", "Berhasil");
    } catch (err: any) {
      await showAlert(err?.message || "Terjadi kesalahan jaringan.", "Error");
    } finally {
      setIsSeeding(false);
    }
  };

  const previewSections = useMemo(
    () => ({
      added: form.sections.added.map((s) => s.trim()).filter(Boolean),
      improved: form.sections.improved.map((s) => s.trim()).filter(Boolean),
      fixed: form.sections.fixed.map((s) => s.trim()).filter(Boolean),
    }),
    [form.sections]
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Compact Top Header Bar (1 baris, tanpa hero card & stat cards boros ruang) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Changelog Hub
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {entries.length} rilis tersimpan
            {draftCount > 0 ? ` (${draftCount} masih Draft)` : " (semua sudah terbit)"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/changelog"
            target="_blank"
            className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-border bg-card hover:bg-muted/50 text-xs font-medium text-foreground transition-colors ${FOCUS_RING}`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Lihat Publik</span>
          </Link>

          <button
            type="button"
            onClick={handleSeedInitial}
            disabled={isSeeding}
            className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-border bg-card hover:bg-muted/50 text-xs font-medium text-foreground transition-colors disabled:opacity-50 cursor-pointer ${FOCUS_RING}`}
          >
            {isSeeding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Impor Riwayat</span>
          </button>

          <button
            type="button"
            onClick={openCreateDrawer}
            className={`inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold transition-opacity cursor-pointer ${FOCUS_RING}`}
          >
            <Plus className="w-4 h-4" />
            <span>Rilis Baru</span>
          </button>
        </div>
      </div>

      {/* Main Table Card: Toolbar + Table/Mobile List + Pagination menyatu */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Toolbar Filter & Search terpadu */}
        <div className="p-3 sm:p-4 border-b border-border flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Product Tabs dengan jumlah rilis langsung di label */}
          <div
            role="tablist"
            aria-label="Filter produk changelog"
            className="flex items-center gap-1 overflow-x-auto no-scrollbar"
          >
            {(
              [
                { id: "all", label: "Semua" },
                ...CHANGELOG_PRODUCTS.map((p) => ({ id: p.id, label: p.label })),
              ] as const
            ).map((tab) => {
              const active = filterProduct === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilterProduct(tab.id)}
                  className={`min-h-[36px] px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${FOCUS_RING} ${
                    active
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="text-[11px] opacity-80 tabular-nums">
                    ({productCounts[tab.id]})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Status Filter + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-background p-0.5 self-start sm:self-auto">
              {(
                [
                  { id: "all", label: "Semua" },
                  { id: "published", label: "Published" },
                  { id: "draft", label: "Draft" },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setFilterStatus(st.id)}
                  className={`min-h-[32px] px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${FOCUS_RING} ${
                    filterStatus === st.id
                      ? "bg-card text-foreground border border-border"
                      : "text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label="Cari versi atau judul rilis"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari versi atau judul..."
                className={`w-full min-h-[36px] pl-8 pr-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground ${FOCUS_RING}`}
              />
            </div>
          </div>
        </div>

        {/* Error State */}
        {loadError && (
          <div
            role="alert"
            className="px-4 py-3 border-b border-red-500/30 bg-red-500/10 flex flex-wrap items-center justify-between gap-2 text-xs text-red-300"
          >
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loadError}</span>
            </span>
            <button
              type="button"
              onClick={refreshEntries}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-red-400/40 hover:bg-red-500/20 font-semibold cursor-pointer ${FOCUS_RING}`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba lagi</span>
            </button>
          </div>
        )}

        {/* Loading / Empty / Data States */}
        {isLoading ? (
          <div
            role="status"
            className="p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Memuat daftar catatan perubahan...</span>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-semibold text-foreground">
              {entries.length === 0
                ? "Belum ada catatan perubahan tersimpan"
                : "Tidak ada rilis yang cocok dengan filter ini"}
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {entries.length === 0
                ? "Klik Impor Riwayat untuk mengisi versi awal Web Transport, Bot Natasya, dan Nismara Tracker, atau buat rilis baru."
                : "Coba ubah kata kunci pencarian atau reset filter produk dan status."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {entries.length === 0 ? (
                <>
                  <button
                    type="button"
                    onClick={handleSeedInitial}
                    disabled={isSeeding}
                    className={`min-h-[40px] px-3.5 rounded-lg border border-border bg-background hover:bg-muted/50 text-xs font-medium text-foreground cursor-pointer ${FOCUS_RING}`}
                  >
                    Impor Riwayat Awal
                  </button>
                  <button
                    type="button"
                    onClick={openCreateDrawer}
                    className={`min-h-[40px] px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold cursor-pointer ${FOCUS_RING}`}
                  >
                    Buat Rilis Baru
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setFilterProduct("all");
                    setFilterStatus("all");
                    setSearchQuery("");
                  }}
                  className={`min-h-[40px] px-3.5 rounded-lg border border-border bg-background hover:bg-muted/50 text-xs font-medium text-foreground cursor-pointer ${FOCUS_RING}`}
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* DESKTOP COMPACT DATA TABLE (md+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 pl-4 pr-3 w-24">Versi</th>
                    <th className="py-2.5 px-3 w-36">Produk</th>
                    <th className="py-2.5 px-3">Judul Rilis</th>
                    <th className="py-2.5 px-3 w-28">Poin</th>
                    <th className="py-2.5 px-3 w-28">Status</th>
                    <th className="py-2.5 px-3 w-32">Tanggal</th>
                    <th className="py-2.5 pl-3 pr-4 w-44 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70 text-sm">
                  {paginatedEntries.map((entry) => {
                    const isPub = entry.status === "published";
                    const isBusy = busyId === entry._id;
                    const prodMeta = CHANGELOG_PRODUCT_MAP[entry.product];
                    const addedLen = entry.sections.added.length;
                    const improvedLen = entry.sections.improved.length;
                    const fixedLen = entry.sections.fixed.length;

                    return (
                      <tr
                        key={entry._id}
                        className="hover:bg-muted/25 transition-colors group"
                      >
                        <td className="py-3 pl-4 pr-3 font-semibold text-foreground tabular-nums whitespace-nowrap">
                          v{entry.version}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-xs font-medium text-muted-foreground">
                            {prodMeta.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-md">
                          <button
                            type="button"
                            onClick={() => openEditDrawer(entry)}
                            className={`text-left font-medium text-foreground hover:text-primary transition-colors line-clamp-1 cursor-pointer rounded ${FOCUS_RING}`}
                          >
                            {entry.title}
                          </button>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-xs tabular-nums">
                            {addedLen > 0 && (
                              <span
                                title={`${addedLen} Fitur Baru`}
                                className="text-emerald-400 font-medium"
                              >
                                +{addedLen}
                              </span>
                            )}
                            {improvedLen > 0 && (
                              <span
                                title={`${improvedLen} Peningkatan`}
                                className="text-sky-400 font-medium"
                              >
                                ~{improvedLen}
                              </span>
                            )}
                            {fixedLen > 0 && (
                              <span
                                title={`${fixedLen} Perbaikan`}
                                className="text-amber-400 font-medium"
                              >
                                {fixedLen} fix
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${
                              isPub
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                            }`}
                          >
                            {isPub ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <FileClock className="w-3 h-3" />
                            )}
                            <span>{isPub ? "Published" : "Draft"}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                          {formatShortDateWIB(entry.releaseDate)}
                        </td>
                        <td className="py-3 pl-3 pr-4 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleTogglePublish(entry)}
                              title={isPub ? "Ubah ke Draft" : "Publikasikan"}
                              aria-label={
                                isPub
                                  ? `Ubah v${entry.version} ke Draft`
                                  : `Publikasikan v${entry.version}`
                              }
                              className={`p-2 rounded-lg border border-transparent hover:border-border hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors cursor-pointer ${FOCUS_RING}`}
                            >
                              {isPub ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4 text-emerald-400" />
                              )}
                            </button>

                            {isPub && (
                              <Link
                                href={`/changelog?tab=${entry.product}#v${entry.version}`}
                                target="_blank"
                                title="Buka di halaman publik"
                                aria-label={`Buka v${entry.version} di halaman publik`}
                                className={`p-2 rounded-lg border border-transparent hover:border-border hover:bg-background text-muted-foreground hover:text-foreground transition-colors ${FOCUS_RING}`}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                            )}

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => openEditDrawer(entry)}
                              title="Edit rilis"
                              aria-label={`Edit v${entry.version}`}
                              className={`p-2 rounded-lg border border-transparent hover:border-border hover:bg-background text-muted-foreground hover:text-primary disabled:opacity-40 transition-colors cursor-pointer ${FOCUS_RING}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDelete(entry)}
                              title="Hapus rilis"
                              aria-label={`Hapus v${entry.version}`}
                              className={`p-2 rounded-lg border border-transparent hover:border-red-500/30 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 disabled:opacity-40 transition-colors cursor-pointer ${FOCUS_RING}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE REFLOW LIST (< md, zero horizontal overflow, tap targets >= 44px) */}
            <div className="md:hidden divide-y divide-border">
              {paginatedEntries.map((entry) => {
                const isPub = entry.status === "published";
                const isBusy = busyId === entry._id;
                const prodMeta = CHANGELOG_PRODUCT_MAP[entry.product];

                return (
                  <div key={entry._id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold text-foreground tabular-nums">
                            v{entry.version}
                          </span>
                          <span className="text-muted-foreground">{prodMeta.label}</span>
                          <span className="text-muted-foreground">
                            {formatShortDateWIB(entry.releaseDate)}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-foreground mt-1 leading-snug">
                          {entry.title}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                          isPub
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                        }`}
                      >
                        {isPub ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <FileClock className="w-3 h-3" />
                        )}
                        <span>{isPub ? "Published" : "Draft"}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openEditDrawer(entry)}
                        className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground ${FOCUS_RING}`}
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleTogglePublish(entry)}
                        className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground ${FOCUS_RING}`}
                      >
                        {isPub ? (
                          <>
                            <EyeOff className="w-4 h-4" />
                            <span>Draft</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 text-emerald-400" />
                            <span>Publish</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(entry)}
                        className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-xs font-medium text-red-300 ${FOCUS_RING}`}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-border bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                <span className="tabular-nums">
                  Menampilkan{" "}
                  <strong className="text-foreground">
                    {startIndex + 1}–
                    {Math.min(startIndex + pageSize, filteredEntries.length)}
                  </strong>{" "}
                  dari <strong className="text-foreground">{filteredEntries.length}</strong>{" "}
                  rilis
                </span>

                <div className="inline-flex items-center gap-1">
                  <span>Per halaman:</span>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPageSize(size)}
                      className={`min-w-[32px] min-h-[30px] px-2 rounded-md border text-xs tabular-nums transition-colors cursor-pointer ${FOCUS_RING} ${
                        pageSize === size
                          ? "border-primary/40 bg-primary/15 text-primary font-semibold"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-muted-foreground tabular-nums">
                  Hal {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={`inline-flex items-center gap-1 min-h-[36px] px-3 rounded-lg border border-border bg-background hover:bg-muted/40 text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${FOCUS_RING}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Sebelumnya</span>
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className={`inline-flex items-center gap-1 min-h-[36px] px-3 rounded-lg border border-border bg-background hover:bg-muted/40 text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${FOCUS_RING}`}
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* SLIDE-OVER DRAWER EDITOR (Tulis | Pratinjau) */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="changelog-drawer-title"
          className="fixed inset-0 z-50 flex justify-end bg-black/65"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSaving) setDrawerOpen(false);
          }}
        >
          <div className="w-full max-w-2xl h-full bg-card border-l border-border shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id="changelog-drawer-title"
                  className="text-base sm:text-lg font-bold text-foreground truncate"
                >
                  {editingId ? `Edit Rilis v${form.version}` : "Buat Catatan Perubahan"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Tulis dengan bahasa non-teknis agar mudah dipahami driver.
                </p>
              </div>

              <button
                type="button"
                aria-label="Tutup panel editor"
                onClick={() => !isSaving && setDrawerOpen(false)}
                className={`min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground cursor-pointer ${FOCUS_RING}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Mode Tabs (Editor vs Pratinjau) */}
            <div className="px-5 pt-3 border-b border-border flex items-center gap-4">
              {(
                [
                  { id: "editor", label: "Editor" },
                  { id: "preview", label: "Pratinjau Publik" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDrawerTab(tab.id)}
                  className={`relative pb-2.5 text-xs font-semibold transition-colors cursor-pointer ${FOCUS_RING} ${
                    drawerTab === tab.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  {drawerTab === tab.id && (
                    <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Drawer Content */}
            <form
              id="changelog-drawer-form"
              onSubmit={handleSave}
              className="flex-1 overflow-y-auto p-5 pb-24 space-y-5"
            >
              {drawerTab === "editor" ? (
                <>
                  {/* Produk */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Produk</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CHANGELOG_PRODUCTS.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, product: prod.id }))}
                          className={`min-h-[40px] px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${FOCUS_RING} ${
                            form.product === prod.id
                              ? "border-primary bg-primary/15 text-primary font-semibold"
                              : "border-border bg-background text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {prod.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Versi, Tanggal, Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="cl-version"
                        className="text-xs font-semibold text-foreground"
                      >
                        Nomor Versi
                      </label>
                      <input
                        id="cl-version"
                        type="text"
                        required
                        value={form.version}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, version: e.target.value }))
                        }
                        placeholder="1.5.3"
                        className={`w-full min-h-[40px] px-3 rounded-lg border border-border bg-background text-sm text-foreground ${FOCUS_RING}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="cl-date"
                        className="text-xs font-semibold text-foreground"
                      >
                        Tanggal Rilis (WIB)
                      </label>
                      <input
                        id="cl-date"
                        type="datetime-local"
                        required
                        value={form.releaseDate}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, releaseDate: e.target.value }))
                        }
                        className={`w-full min-h-[40px] px-2.5 rounded-lg border border-border bg-background text-xs text-foreground ${FOCUS_RING}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Status</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(["draft", "published"] as ChangelogStatus[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, status: st }))}
                            className={`min-h-[40px] rounded-lg border text-xs font-medium transition-colors cursor-pointer ${FOCUS_RING} ${
                              form.status === st
                                ? st === "published"
                                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-semibold"
                                  : "border-amber-500/40 bg-amber-500/15 text-amber-300 font-semibold"
                                : "border-border bg-background text-muted-foreground"
                            }`}
                          >
                            {st === "published" ? "Published" : "Draft"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Judul */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="cl-title"
                      className="text-xs font-semibold text-foreground"
                    >
                      Judul Rilis
                    </label>
                    <input
                      id="cl-title"
                      type="text"
                      required
                      maxLength={160}
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Contoh: Perlindungan Sesi Login dan Halaman Keamanan Akun"
                      className={`w-full min-h-[40px] px-3 rounded-lg border border-border bg-background text-sm text-foreground ${FOCUS_RING}`}
                    />
                  </div>

                  {/* Ringkasan */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="cl-summary"
                      className="text-xs font-semibold text-foreground"
                    >
                      Ringkasan Singkat (Non-Teknis)
                    </label>
                    <textarea
                      id="cl-summary"
                      required
                      rows={3}
                      maxLength={800}
                      value={form.summary}
                      onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
                      placeholder="Jelaskan manfaat utama rilis ini dalam 2 sampai 3 kalimat singkat."
                      className={`w-full p-3 rounded-lg border border-border bg-background text-sm text-foreground resize-y ${FOCUS_RING}`}
                    />
                  </div>

                  {/* Dynamic Sections Builder */}
                  <div className="space-y-3">
                    {SECTION_CONFIG.map((sec) => {
                      const list = form.sections[sec.key];
                      return (
                        <div
                          key={sec.key}
                          className="rounded-xl border border-border bg-background/50 p-3.5 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
                              <span className={`w-2 h-2 rounded-full ${sec.dotClass}`} />
                              <span>
                                {sec.label} ({list.length})
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddRow(sec.key)}
                              className={`inline-flex items-center gap-1 min-h-[34px] px-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 text-xs font-medium text-foreground cursor-pointer ${FOCUS_RING}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Tambah Poin</span>
                            </button>
                          </div>

                          {list.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Belum ada poin di kategori ini.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {list.map((val, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={(e) =>
                                      handleChangeRow(sec.key, idx, e.target.value)
                                    }
                                    placeholder={sec.placeholder}
                                    className={`flex-1 min-h-[38px] px-3 rounded-lg border border-border bg-card text-xs text-foreground ${FOCUS_RING}`}
                                  />
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveRow(sec.key, idx, -1)}
                                    aria-label="Geser ke atas"
                                    className={`min-w-[34px] min-h-[38px] inline-flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer ${FOCUS_RING}`}
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === list.length - 1}
                                    onClick={() => handleMoveRow(sec.key, idx, 1)}
                                    aria-label="Geser ke bawah"
                                    className={`min-w-[34px] min-h-[38px] inline-flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer ${FOCUS_RING}`}
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRow(sec.key, idx)}
                                    aria-label="Hapus baris"
                                    className={`min-w-[34px] min-h-[38px] inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 cursor-pointer ${FOCUS_RING}`}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Tautan Opsional */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="cl-feat-url"
                        className="text-xs font-semibold text-foreground"
                      >
                        Tautan Fitur (Opsional)
                      </label>
                      <input
                        id="cl-feat-url"
                        type="text"
                        value={form.highlightFeatureUrl}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, highlightFeatureUrl: e.target.value }))
                        }
                        placeholder="/community-market"
                        className={`w-full min-h-[38px] px-3 rounded-lg border border-border bg-background text-xs text-foreground ${FOCUS_RING}`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="cl-feat-label"
                        className="text-xs font-semibold text-foreground"
                      >
                        Label Tombol Fitur
                      </label>
                      <input
                        id="cl-feat-label"
                        type="text"
                        value={form.highlightFeatureLabel}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            highlightFeatureLabel: e.target.value,
                          }))
                        }
                        placeholder="Buka Community Market"
                        className={`w-full min-h-[38px] px-3 rounded-lg border border-border bg-background text-xs text-foreground ${FOCUS_RING}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="cl-article-url"
                      className="text-xs font-semibold text-foreground"
                    >
                      Tautan Artikel Website Utama (Opsional)
                    </label>
                    <input
                      id="cl-article-url"
                      type="text"
                      value={form.articleUrl}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, articleUrl: e.target.value }))
                      }
                      placeholder="https://nismara.web.id/blog/update-1-5-0"
                      className={`w-full min-h-[38px] px-3 rounded-lg border border-border bg-background text-xs text-foreground ${FOCUS_RING}`}
                    />
                  </div>
                </>
              ) : (
                /* Tab Pratinjau Publik */
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      v{form.version.trim().replace(/^v/i, "") || "0.0.0"}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/30 text-[11px] font-semibold text-sky-300">
                      {CHANGELOG_PRODUCT_MAP[form.product].label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {form.releaseDate
                        ? formatChangelogDateWIB(`${form.releaseDate}:00+07:00`)
                        : "-"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-border bg-background/60 p-5 space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-foreground leading-snug">
                        {form.title || "Judul rilis akan muncul di sini"}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {form.summary || "Ringkasan non-teknis akan muncul di sini."}
                        {buildReleaseCountSentence(previewSections)
                          ? ` ${buildReleaseCountSentence(previewSections)}`
                          : ""}
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      {SECTION_CONFIG.map((sec) => {
                        const items = previewSections[sec.key];
                        if (items.length === 0) return null;
                        return (
                          <div
                            key={sec.key}
                            className="rounded-xl border border-border/80 bg-card p-4 space-y-2"
                          >
                            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <span className={`w-2 h-2 rounded-full ${sec.dotClass}`} />
                              <span>{sec.label}</span>
                              <span className="text-xs font-normal text-muted-foreground">
                                ({items.length})
                              </span>
                            </p>
                            <ul className="space-y-2">
                              {items.map((text, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2.5 text-sm text-foreground/85 leading-relaxed"
                                >
                                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                                  <span>{text}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Drawer Sticky Footer */}
            <div className="px-5 py-3.5 border-t border-border bg-card flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setDrawerOpen(false)}
                className={`min-h-[40px] px-4 rounded-lg border border-border bg-background text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer ${FOCUS_RING}`}
              >
                Batal
              </button>
              <button
                type="submit"
                form="changelog-drawer-form"
                disabled={isSaving}
                className={`inline-flex items-center gap-1.5 min-h-[40px] px-5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer ${FOCUS_RING}`}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{editingId ? "Simpan Perubahan" : "Simpan Rilis"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
