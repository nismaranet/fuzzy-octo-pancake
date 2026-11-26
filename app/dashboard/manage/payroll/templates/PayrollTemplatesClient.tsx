"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Download,
  Edit3,
  Copy,
  Trash2,
  X,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Calendar,
  Pin,
  RotateCcw,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { showAlert, showConfirm } from "@/lib/dialog";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { buildAutoVoucherTitle } from "@/lib/communityMarketShared";
import type {
  IPayrollTierItem,
  IPayrollVoucherItem,
  PayrollVoucherCategory,
} from "@/lib/models/PayrollRewardTemplate";
import {
  PAYROLL_VOUCHER_CATEGORIES,
  PAYROLL_VOUCHER_CATEGORY_LABELS,
  STARTER_PAYROLL_TEMPLATES,
  buildTierLabel,
  computeTemplateEconomySummary,
  type SerializedPayrollTemplate,
} from "@/lib/payrollTemplates";

interface ScheduleInfo {
  month: string;
  templateId: string | null;
  templateSlug: string;
  templateName: string;
  isManualOverride: boolean;
  isLocked?: boolean;
}

interface InitialProps {
  currentMonth: string;
  nextMonth: string;
  templates: SerializedPayrollTemplate[];
  currentSnapshot: ScheduleInfo & { tiers: IPayrollTierItem[]; baseSalary: number };
  nextMonthSchedule: ScheduleInfo;
}

interface FormState {
  name: string;
  slug: string;
  description: string;
  baseSalary: number;
  infiniteLoopStep: number;
  infiniteLoopBonusNc: number;
  infiniteLoopPenaltyTickets: number;
  isActive: boolean;
  rotationOrder: number;
  tiers: IPayrollTierItem[];
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background";

function formatMonthLabel(mStr: string): string {
  if (!mStr || !mStr.includes("-")) return mStr;
  const [y, m] = mStr.split("-");
  const names = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${names[parseInt(m, 10) - 1] || m} ${y}`;
}

function createDefaultForm(nextOrder: number): FormState {
  const base = STARTER_PAYROLL_TEMPLATES[0];
  return {
    name: "",
    slug: "",
    description: "",
    baseSalary: base.baseSalary,
    infiniteLoopStep: base.infiniteLoopStep,
    infiniteLoopBonusNc: base.infiniteLoopBonusNc,
    infiniteLoopPenaltyTickets: base.infiniteLoopPenaltyTickets,
    isActive: true,
    rotationOrder: nextOrder,
    tiers: JSON.parse(JSON.stringify(base.tiers)),
  };
}

export default function PayrollTemplatesClient({
  initialData,
}: {
  initialData: InitialProps;
}) {
  const router = useRouter();
  const [data, setData] = useState<InitialProps>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [schedulingMonth, setSchedulingMonth] = useState<string | null>(null);

  // Slide-over Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => createDefaultForm(1));
  const [openTier, setOpenTier] = useState<number | null>(10);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Tutup drawer dengan Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, isSaving]);

  const refreshData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/manage/payroll/templates", NO_CACHE_FETCH_OPTIONS);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setLoadError(json.error || "Gagal memuat ulang data template payroll.");
        return;
      }
      setData({
        currentMonth: json.currentMonth,
        nextMonth: json.nextMonth,
        templates: json.templates || [],
        currentSnapshot: json.currentSnapshot,
        nextMonthSchedule: json.nextMonthSchedule,
      });
    } catch {
      setLoadError("Gagal terhubung ke server. Periksa koneksi lalu coba lagi.");
    } finally {
      setIsLoading(false);
      router.refresh();
    }
  };

  const openCreateDrawer = () => {
    setEditingId(null);
    setForm(createDefaultForm(data.templates.length + 1));
    setOpenTier(10);
    setDrawerOpen(true);
  };

  const openEditDrawer = (tpl: SerializedPayrollTemplate) => {
    setEditingId(tpl._id);
    setForm({
      name: tpl.name,
      slug: tpl.slug,
      description: tpl.description || "",
      baseSalary: tpl.baseSalary,
      infiniteLoopStep: tpl.infiniteLoopStep,
      infiniteLoopBonusNc: tpl.infiniteLoopBonusNc,
      infiniteLoopPenaltyTickets: tpl.infiniteLoopPenaltyTickets,
      isActive: tpl.isActive,
      rotationOrder: tpl.rotationOrder,
      tiers: JSON.parse(JSON.stringify(tpl.tiers || [])),
    });
    setOpenTier(10);
    setDrawerOpen(true);
  };

  const openDuplicateDrawer = (tpl: SerializedPayrollTemplate) => {
    setEditingId(null);
    setForm({
      name: `${tpl.name} (Salinan)`,
      slug: `${tpl.slug}-copy-${Date.now().toString().slice(-3)}`,
      description: tpl.description || "",
      baseSalary: tpl.baseSalary,
      infiniteLoopStep: tpl.infiniteLoopStep,
      infiniteLoopBonusNc: tpl.infiniteLoopBonusNc,
      infiniteLoopPenaltyTickets: tpl.infiniteLoopPenaltyTickets,
      isActive: true,
      rotationOrder: data.templates.length + 1,
      tiers: JSON.parse(JSON.stringify(tpl.tiers || [])),
    });
    setOpenTier(10);
    setDrawerOpen(true);
  };

  const handleSeedBalanced = async () => {
    const confirmed = await showConfirm(
      "Impor 3 preset Template Seimbang (Seimbang A, B, dan C — masing-masing total 100.000 NC dengan kombinasi Servis, Operasional Garasi, Beli Armada, Mod Workshop, Booster, Safebox, dan Fuel)? Template yang sudah ada tidak akan ditimpa.",
      "Impor 3 Template Seimbang"
    );
    if (!confirmed) return;

    setIsSeeding(true);
    try {
      const res = await fetch("/api/manage/payroll/templates/seed", {
        ...NO_CACHE_FETCH_OPTIONS,
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        await showAlert(json.error || "Gagal mengimpor template awal.", "Gagal");
        return;
      }
      await refreshData();
      await showAlert(json.message || "Template awal berhasil diimpor.", "Berhasil");
    } catch (err: any) {
      await showAlert(err?.message || "Terjadi kesalahan jaringan.", "Error");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleScheduleMonth = async (month: string, templateId: string) => {
    if (!templateId) return;
    if (month === data.currentMonth) {
      const confirmed = await showConfirm(
        `Terapkan template terpilih untuk periode berjalan ${formatMonthLabel(month)}? Perubahan hanya diizinkan selama belum ada Manager yang mengklaim gaji periode ini.`,
        "Ganti Template Bulan Berjalan"
      );
      if (!confirmed) return;
    }

    setSchedulingMonth(month);
    try {
      const res = await fetch("/api/manage/payroll/templates/schedule", {
        ...NO_CACHE_FETCH_OPTIONS,
        method: "POST",
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ month, templateId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        await showAlert(json.error || "Gagal menjadwalkan template.", "Gagal");
        return;
      }
      await refreshData();
      await showAlert(json.message || "Jadwal template diperbarui.", "Berhasil");
    } catch (err: any) {
      await showAlert(err?.message || "Terjadi kesalahan jaringan.", "Error");
    } finally {
      setSchedulingMonth(null);
    }
  };

  const handleToggleActive = async (tpl: SerializedPayrollTemplate) => {
    setBusyId(tpl._id);
    try {
      const res = await fetch(`/api/manage/payroll/templates/${tpl._id}`, {
        ...NO_CACHE_FETCH_OPTIONS,
        method: "PATCH",
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !tpl.isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        await showAlert(json.error || "Gagal mengubah status template.", "Gagal");
        return;
      }
      await refreshData();
    } catch (err: any) {
      await showAlert(err?.message || "Terjadi kesalahan jaringan.", "Error");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (tpl: SerializedPayrollTemplate) => {
    const confirmed = await showConfirm(
      `Hapus template "${tpl.name}"? Snapshot bulan yang sudah berjalan atau sudah diklaim tidak akan terpengaruh.`,
      "Hapus Template Payroll"
    );
    if (!confirmed) return;

    setBusyId(tpl._id);
    try {
      const res = await fetch(`/api/manage/payroll/templates/${tpl._id}`, {
        ...NO_CACHE_FETCH_OPTIONS,
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        await showAlert(json.error || "Gagal menghapus template.", "Gagal");
        return;
      }
      await refreshData();
      await showAlert(json.message || "Template dihapus.", "Berhasil");
    } catch (err: any) {
      await showAlert(err?.message || "Terjadi kesalahan jaringan.", "Error");
    } finally {
      setBusyId(null);
    }
  };

  // Tier editing helpers
  const updateTier = (tierIndex: number, patch: Partial<IPayrollTierItem>) => {
    setForm((prev) => {
      const nextTiers = prev.tiers.map((t, idx) => {
        if (idx !== tierIndex) return t;
        const merged = { ...t, ...patch };
        return {
          ...merged,
          label: buildTierLabel(merged),
        };
      });
      return { ...prev, tiers: nextTiers };
    });
  };

  const addVoucherToTier = (tierIndex: number) => {
    const newVoucher: IPayrollVoucherItem = {
      title: "Diskon Servis Armada 50% (Reward Manager)",
      category: "FLEET_MAINTENANCE",
      discountType: "percentage",
      discountValue: 50,
      maxDiscount: 0,
      durationHours: 0,
      expireDays: 60,
    };
    const current = form.tiers[tierIndex]?.vouchers || [];
    updateTier(tierIndex, { vouchers: [...current, newVoucher] });
  };

  const updateVoucherInTier = (
    tierIndex: number,
    vIdx: number,
    patch: Partial<IPayrollVoucherItem>
  ) => {
    const current = form.tiers[tierIndex]?.vouchers || [];
    const nextVouchers = current.map((v, i) => {
      if (i !== vIdx) return v;
      const nextCat = (patch.category ?? v.category) as PayrollVoucherCategory;
      const isBooster = nextCat === "NC_BOOSTER";
      const nextVal = patch.discountValue ?? v.discountValue;
      const nextHrs = isBooster ? patch.durationHours ?? (v.durationHours || 6) : 0;
      const nextMax = isBooster ? 0 : patch.maxDiscount ?? (v.maxDiscount || 0);
      const merged: IPayrollVoucherItem = {
        ...v,
        ...patch,
        category: nextCat,
        discountValue: nextVal,
        durationHours: nextHrs,
        maxDiscount: nextMax,
      };
      if (patch.title === undefined) {
        merged.title = `${buildAutoVoucherTitle({
          category: nextCat,
          discountValue: nextVal,
          durationHours: nextHrs,
          maxDiscount: nextMax,
        })} (Reward Manager)`;
      }
      return merged;
    });
    updateTier(tierIndex, { vouchers: nextVouchers });
  };

  const removeVoucherFromTier = (tierIndex: number, vIdx: number) => {
    const current = form.tiers[tierIndex]?.vouchers || [];
    updateTier(tierIndex, { vouchers: current.filter((_, i) => i !== vIdx) });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      await showAlert("Nama template wajib diisi.", "Validasi");
      return;
    }

    setIsSaving(true);
    try {
      const endpoint = editingId
        ? `/api/manage/payroll/templates/${editingId}`
        : "/api/manage/payroll/templates";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        ...NO_CACHE_FETCH_OPTIONS,
        method,
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        await showAlert(json.error || "Gagal menyimpan template payroll.", "Gagal");
        return;
      }

      setDrawerOpen(false);
      await refreshData();
      await showAlert(json.message || "Template berhasil disimpan.", "Berhasil");
    } catch (err: any) {
      await showAlert(err?.message || "Terjadi kesalahan jaringan.", "Error");
    } finally {
      setIsSaving(false);
    }
  };

  const liveSummary = useMemo(() => computeTemplateEconomySummary(form), [form]);
  const hasDominantVoucher = useMemo(
    () => Object.values(liveSummary.voucherCountsByCategory).some((c) => c > 2),
    [liveSummary]
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Compact 1-Row Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/manage/payroll"
              className={`inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded ${FOCUS_RING}`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Payroll</span>
            </Link>
            <span className="text-muted-foreground/50 text-xs">/</span>
            <span className="text-xs font-semibold text-amber-400">Web Owner Only</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-0.5">
            Template Rotasi Payroll Staff
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Atur variasi paket hadiah bulanan yang seimbang dan rotasi otomatis tiap tanggal 1 WIB.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSeedBalanced}
            disabled={isSeeding}
            className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-border bg-card hover:bg-muted/50 text-xs font-medium text-foreground disabled:opacity-50 cursor-pointer ${FOCUS_RING}`}
          >
            {isSeeding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Impor 3 Template Seimbang</span>
          </button>

          <button
            type="button"
            onClick={openCreateDrawer}
            className={`inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold cursor-pointer ${FOCUS_RING}`}
          >
            <Plus className="w-4 h-4" />
            <span>Template Baru</span>
          </button>
        </div>
      </div>

      {/* Compact Schedule Strip: Bulan Berjalan & Bulan Depan (Rahasia dari Manager) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Bulan Berjalan */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold text-foreground">
                Aktif Bulan Ini ({formatMonthLabel(data.currentMonth)})
              </span>
              {data.currentSnapshot.isManualOverride && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-semibold">
                  Pin Manual
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-foreground truncate">
              {data.currentSnapshot.templateName}
            </p>
          </div>

          {data.templates.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                aria-label="Pilih template untuk bulan berjalan"
                disabled={schedulingMonth === data.currentMonth}
                value={data.currentSnapshot.templateId || ""}
                onChange={(e) => {
                  if (e.target.value) {
                    handleScheduleMonth(data.currentMonth, e.target.value);
                  }
                }}
                className={`min-h-[36px] px-2.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground ${FOCUS_RING}`}
              >
                <option value="" disabled>
                  Ganti template...
                </option>
                {data.templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    #{t.rotationOrder} {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Bulan Depan (Elemen Kejutan — Hanya Owner yang Lihat) */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Pin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="font-semibold text-foreground">
                Bulan Depan ({formatMonthLabel(data.nextMonth)})
              </span>
              <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-semibold">
                {data.nextMonthSchedule.isManualOverride ? "Pin Manual" : "Auto-Rotasi"}
              </span>
            </div>
            <p className="text-sm font-bold text-foreground truncate">
              {data.nextMonthSchedule.templateName}
            </p>
          </div>

          {data.templates.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                aria-label="Pin template untuk bulan depan"
                disabled={schedulingMonth === data.nextMonth}
                value={data.nextMonthSchedule.templateId || ""}
                onChange={(e) => {
                  if (e.target.value) {
                    handleScheduleMonth(data.nextMonth, e.target.value);
                  }
                }}
                className={`min-h-[36px] px-2.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground ${FOCUS_RING}`}
              >
                <option value="" disabled>
                  Pin bulan depan...
                </option>
                {data.templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    #{t.rotationOrder} {t.name}
                  </option>
                ))}
              </select>

              {data.nextMonthSchedule.isManualOverride && (
                <button
                  type="button"
                  title="Kembalikan ke auto-rotasi"
                  aria-label="Kembalikan bulan depan ke rotasi otomatis"
                  disabled={schedulingMonth === data.nextMonth}
                  onClick={() => handleScheduleMonth(data.nextMonth, "AUTO")}
                  className={`min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground cursor-pointer ${FOCUS_RING}`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Template Table Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loadError && (
          <div
            role="alert"
            className="px-4 py-3 border-b border-red-500/30 bg-red-500/10 flex items-center justify-between gap-2 text-xs text-red-300"
          >
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loadError}</span>
            </span>
            <button
              type="button"
              onClick={refreshData}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-red-400/40 font-semibold cursor-pointer ${FOCUS_RING}`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba lagi</span>
            </button>
          </div>
        )}

        {isLoading ? (
          <div
            role="status"
            className="p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Memuat template payroll...</span>
          </div>
        ) : data.templates.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-semibold text-foreground">
              Belum ada template payroll tersimpan
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Klik <strong>Impor 3 Template Seimbang</strong> untuk mengisi paket rotasi A, B,
              dan C secara otomatis, atau buat template baru dari awal.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSeedBalanced}
                disabled={isSeeding}
                className={`min-h-[40px] px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold cursor-pointer ${FOCUS_RING}`}
              >
                Impor 3 Template Seimbang
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 pl-4 pr-3 w-16">Urut</th>
                    <th className="py-2.5 px-3">Nama Template</th>
                    <th className="py-2.5 px-3 w-32">Total NC</th>
                    <th className="py-2.5 px-3 w-36">Safebox & Fuel</th>
                    <th className="py-2.5 px-3">Distribusi Voucher</th>
                    <th className="py-2.5 px-3 w-28">Rotasi</th>
                    <th className="py-2.5 pl-3 pr-4 w-36 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70 text-sm">
                  {data.templates.map((tpl) => {
                    const summary = computeTemplateEconomySummary(tpl);
                    const isBusy = busyId === tpl._id;
                    const isCurrent = data.currentSnapshot.templateId === tpl._id;

                    return (
                      <tr key={tpl._id} className="hover:bg-muted/25 transition-colors">
                        <td className="py-3 pl-4 pr-3 font-semibold text-muted-foreground tabular-nums">
                          #{tpl.rotationOrder}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditDrawer(tpl)}
                              className={`font-semibold text-foreground hover:text-primary transition-colors text-left cursor-pointer rounded ${FOCUS_RING}`}
                            >
                              {tpl.name}
                            </button>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] font-semibold text-amber-300">
                                Aktif
                              </span>
                            )}
                          </div>
                          {tpl.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-md mt-0.5">
                              {tpl.description}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3 font-semibold text-amber-400 tabular-nums whitespace-nowrap">
                          {summary.maxTotalNc.toLocaleString("id-ID")} NC
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                          <div>{summary.totalPenaltyTickets} Tiket Safebox</div>
                          <div>{summary.totalFuelLiters.toLocaleString("id-ID")} L Fuel</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1.5 text-[11px]">
                            {PAYROLL_VOUCHER_CATEGORIES.map((cat) => {
                              const count = summary.voucherCountsByCategory[cat];
                              if (count === 0) return null;
                              return (
                                <span
                                  key={cat}
                                  className={`px-2 py-0.5 rounded-md border ${
                                    count > 2
                                      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                                      : "border-border bg-background text-muted-foreground"
                                  }`}
                                >
                                  {PAYROLL_VOUCHER_CATEGORY_LABELS[cat]}: {count}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleActive(tpl)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer disabled:opacity-40 ${FOCUS_RING} ${
                              tpl.isActive
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
                                : "bg-muted text-muted-foreground border-border hover:text-foreground"
                            }`}
                          >
                            {tpl.isActive ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Aktif</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Nonaktif</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="py-3 pl-3 pr-4 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => openEditDrawer(tpl)}
                              title="Edit template"
                              aria-label={`Edit ${tpl.name}`}
                              className={`p-2 rounded-lg border border-transparent hover:border-border hover:bg-background text-muted-foreground hover:text-primary cursor-pointer ${FOCUS_RING}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => openDuplicateDrawer(tpl)}
                              title="Duplikat template"
                              aria-label={`Duplikat ${tpl.name}`}
                              className={`p-2 rounded-lg border border-transparent hover:border-border hover:bg-background text-muted-foreground hover:text-foreground cursor-pointer ${FOCUS_RING}`}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDelete(tpl)}
                              title="Hapus template"
                              aria-label={`Hapus ${tpl.name}`}
                              className={`p-2 rounded-lg border border-transparent hover:border-red-500/30 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 cursor-pointer ${FOCUS_RING}`}
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

            {/* Mobile Reflow Cards (< md, tap targets >= 44px) */}
            <div className="md:hidden divide-y divide-border">
              {data.templates.map((tpl) => {
                const summary = computeTemplateEconomySummary(tpl);
                const isBusy = busyId === tpl._id;
                return (
                  <div key={tpl._id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Urutan #{tpl.rotationOrder}
                        </p>
                        <p className="text-sm font-bold text-foreground">{tpl.name}</p>
                        <p className="text-xs text-amber-400 font-semibold mt-0.5 tabular-nums">
                          {summary.maxTotalNc.toLocaleString("id-ID")} NC ·{" "}
                          {summary.totalPenaltyTickets} Tiket ·{" "}
                          {summary.totalFuelLiters.toLocaleString("id-ID")} L Fuel
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleActive(tpl)}
                        className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-medium ${FOCUS_RING} ${
                          tpl.isActive
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {tpl.isActive ? "Aktif" : "Nonaktif"}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => openEditDrawer(tpl)}
                        className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground ${FOCUS_RING}`}
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openDuplicateDrawer(tpl)}
                        className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground ${FOCUS_RING}`}
                      >
                        <Copy className="w-4 h-4" />
                        <span>Salin</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(tpl)}
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
          </>
        )}
      </div>

      {/* SLIDE-OVER DRAWER EDITOR + LIVE ECONOMY BALANCE BAR */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="payroll-tpl-drawer-title"
          className="fixed inset-0 z-50 flex justify-end bg-black/65"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSaving) setDrawerOpen(false);
          }}
        >
          <div className="w-full max-w-3xl h-full bg-card border-l border-border shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
              <div>
                <h2
                  id="payroll-tpl-drawer-title"
                  className="text-base sm:text-lg font-bold text-foreground"
                >
                  {editingId ? `Edit Template: ${form.name}` : "Buat Template Payroll Baru"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Pastikan komposisi hadiah seimbang di semua pilar (Servis, Garasi, Armada, Mod, Booster).
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup editor template"
                onClick={() => !isSaving && setDrawerOpen(false)}
                className={`min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground cursor-pointer ${FOCUS_RING}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Economy Balance Bar */}
            <div className="px-5 py-3 border-b border-border bg-background/60 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-3 tabular-nums">
                  <span className="font-semibold text-amber-400">
                    Total NC: {liveSummary.maxTotalNc.toLocaleString("id-ID")} NC
                  </span>
                  <span className="text-muted-foreground">
                    Safebox: <strong className="text-foreground">{liveSummary.totalPenaltyTickets}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Fuel:{" "}
                    <strong className="text-foreground">
                      {liveSummary.totalFuelLiters.toLocaleString("id-ID")} L
                    </strong>
                  </span>
                  <span className="text-muted-foreground">
                    Voucher: <strong className="text-foreground">{liveSummary.totalVouchers}</strong>
                  </span>
                </div>

                {hasDominantVoucher && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Ada kategori voucher &gt; 2x</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {PAYROLL_VOUCHER_CATEGORIES.map((cat) => {
                  const cnt = liveSummary.voucherCountsByCategory[cat];
                  return (
                    <span
                      key={cat}
                      className={`px-2 py-0.5 rounded-md border tabular-nums ${
                        cnt > 2
                          ? "border-amber-500/40 bg-amber-500/15 text-amber-300 font-semibold"
                          : cnt > 0
                          ? "border-border bg-card text-foreground"
                          : "border-border/50 bg-transparent text-muted-foreground/70"
                      }`}
                    >
                      {PAYROLL_VOUCHER_CATEGORY_LABELS[cat]}: {cnt}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Drawer Body */}
            <form
              id="payroll-template-form"
              onSubmit={handleSave}
              className="flex-1 overflow-y-auto p-5 pb-24 space-y-5"
            >
              {/* Meta Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="tpl-name" className="text-xs font-semibold text-foreground">
                    Nama Template
                  </label>
                  <input
                    id="tpl-name"
                    type="text"
                    required
                    maxLength={120}
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Contoh: Seimbang D — Armada & Operasional"
                    className={`w-full min-h-[40px] px-3 rounded-lg border border-border bg-background text-sm text-foreground ${FOCUS_RING}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="tpl-order" className="text-xs font-semibold text-foreground">
                    Urutan Rotasi
                  </label>
                  <input
                    id="tpl-order"
                    type="number"
                    min={1}
                    required
                    value={form.rotationOrder}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, rotationOrder: Math.max(1, Number(e.target.value) || 1) }))
                    }
                    className={`w-full min-h-[40px] px-3 rounded-lg border border-border bg-background text-sm text-foreground tabular-nums ${FOCUS_RING}`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="tpl-desc" className="text-xs font-semibold text-foreground">
                  Deskripsi Singkat (Opsional)
                </label>
                <input
                  id="tpl-desc"
                  type="text"
                  maxLength={400}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Ringkasan karakter paket hadiah bulan ini"
                  className={`w-full min-h-[38px] px-3 rounded-lg border border-border bg-background text-xs text-foreground ${FOCUS_RING}`}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label htmlFor="tpl-base" className="text-[11px] font-semibold text-muted-foreground">
                    Base NC
                  </label>
                  <input
                    id="tpl-base"
                    type="number"
                    min={0}
                    step={1000}
                    value={form.baseSalary}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, baseSalary: Math.max(0, Number(e.target.value) || 0) }))
                    }
                    className={`w-full min-h-[38px] px-2.5 rounded-lg border border-border bg-background text-xs text-foreground tabular-nums ${FOCUS_RING}`}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="tpl-lstep" className="text-[11px] font-semibold text-muted-foreground">
                    Loop Step (&gt;100pt)
                  </label>
                  <input
                    id="tpl-lstep"
                    type="number"
                    min={1}
                    value={form.infiniteLoopStep}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        infiniteLoopStep: Math.max(1, Number(e.target.value) || 10),
                      }))
                    }
                    className={`w-full min-h-[38px] px-2.5 rounded-lg border border-border bg-background text-xs text-foreground tabular-nums ${FOCUS_RING}`}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="tpl-lnc" className="text-[11px] font-semibold text-muted-foreground">
                    Loop Bonus NC
                  </label>
                  <input
                    id="tpl-lnc"
                    type="number"
                    min={0}
                    step={500}
                    value={form.infiniteLoopBonusNc}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        infiniteLoopBonusNc: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className={`w-full min-h-[38px] px-2.5 rounded-lg border border-border bg-background text-xs text-foreground tabular-nums ${FOCUS_RING}`}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="tpl-ltkt" className="text-[11px] font-semibold text-muted-foreground">
                    Loop Tiket
                  </label>
                  <input
                    id="tpl-ltkt"
                    type="number"
                    min={0}
                    value={form.infiniteLoopPenaltyTickets}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        infiniteLoopPenaltyTickets: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className={`w-full min-h-[38px] px-2.5 rounded-lg border border-border bg-background text-xs text-foreground tabular-nums ${FOCUS_RING}`}
                  />
                </div>
              </div>

              {/* 10-Tier Collapsible Matrix */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Konfigurasi Tangga Milestone (Tier 10 – 100)
                </p>

                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {form.tiers.map((t, tierIdx) => {
                    const expanded = openTier === t.tier;
                    return (
                      <div key={t.tier} className="bg-background/40">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setOpenTier(expanded ? null : t.tier)}
                          className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-muted/30 transition-colors cursor-pointer ${FOCUS_RING}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-12 shrink-0 text-xs font-bold text-amber-400 tabular-nums">
                              T{t.tier}
                            </span>
                            <span className="text-xs font-medium text-foreground truncate">
                              {t.label}
                            </span>
                          </div>
                          {expanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                        </button>

                        {expanded && (
                          <div className="px-4 pb-4 pt-2 border-t border-border/60 bg-card space-y-3">
                            <div className="grid grid-cols-3 gap-2.5">
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-muted-foreground">
                                  Bonus NC
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  step={1000}
                                  value={t.bonusNc}
                                  onChange={(e) =>
                                    updateTier(tierIdx, {
                                      bonusNc: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                  className={`w-full min-h-[36px] px-2.5 rounded-lg border border-border bg-background text-xs text-foreground tabular-nums ${FOCUS_RING}`}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-muted-foreground">
                                  Tiket Safebox
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={t.penaltyTickets}
                                  onChange={(e) =>
                                    updateTier(tierIdx, {
                                      penaltyTickets: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                  className={`w-full min-h-[36px] px-2.5 rounded-lg border border-border bg-background text-xs text-foreground tabular-nums ${FOCUS_RING}`}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-muted-foreground">
                                  Fuel Garasi (L)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  step={250}
                                  value={t.fuelLiters}
                                  onChange={(e) =>
                                    updateTier(tierIdx, {
                                      fuelLiters: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                  className={`w-full min-h-[36px] px-2.5 rounded-lg border border-border bg-background text-xs text-foreground tabular-nums ${FOCUS_RING}`}
                                />
                              </div>
                            </div>

                            {/* Vouchers inside Tier */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-muted-foreground">
                                  Voucher di Tier {t.tier} ({t.vouchers.length})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => addVoucherToTier(tierIdx)}
                                  className={`inline-flex items-center gap-1 min-h-[30px] px-2.5 rounded-md border border-border bg-background hover:bg-muted/40 text-[11px] font-semibold text-foreground cursor-pointer ${FOCUS_RING}`}
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Tambah Voucher</span>
                                </button>
                              </div>

                              {t.vouchers.map((v, vIdx) => {
                                const isBooster = v.category === "NC_BOOSTER";
                                return (
                                  <div
                                    key={vIdx}
                                    className="rounded-lg border border-border bg-background/60 p-3 space-y-2.5"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <input
                                        type="text"
                                        required
                                        value={v.title}
                                        onChange={(e) =>
                                          updateVoucherInTier(tierIdx, vIdx, {
                                            title: e.target.value,
                                          })
                                        }
                                        placeholder="Judul voucher"
                                        className={`flex-1 min-h-[34px] px-2.5 rounded-md border border-border bg-card text-xs text-foreground ${FOCUS_RING}`}
                                      />
                                      <button
                                        type="button"
                                        aria-label="Hapus voucher"
                                        onClick={() => removeVoucherFromTier(tierIdx, vIdx)}
                                        className={`min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 cursor-pointer ${FOCUS_RING}`}
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-muted-foreground">
                                          Kategori
                                        </label>
                                        <select
                                          value={v.category}
                                          onChange={(e) =>
                                            updateVoucherInTier(tierIdx, vIdx, {
                                              category: e.target.value as PayrollVoucherCategory,
                                            })
                                          }
                                          className={`w-full min-h-[34px] px-2 rounded-md border border-border bg-card text-xs text-foreground ${FOCUS_RING}`}
                                        >
                                          {PAYROLL_VOUCHER_CATEGORIES.map((cat) => (
                                            <option key={cat} value={cat}>
                                              {PAYROLL_VOUCHER_CATEGORY_LABELS[cat]}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-muted-foreground">
                                          {isBooster ? "Bonus (%)" : "Diskon (%)"}
                                        </label>
                                        <input
                                          type="number"
                                          min={1}
                                          max={isBooster ? 200 : 100}
                                          value={v.discountValue}
                                          onChange={(e) =>
                                            updateVoucherInTier(tierIdx, vIdx, {
                                              discountValue: Math.max(
                                                1,
                                                Number(e.target.value) || 1
                                              ),
                                            })
                                          }
                                          className={`w-full min-h-[34px] px-2 rounded-md border border-border bg-card text-xs text-foreground tabular-nums ${FOCUS_RING}`}
                                        />
                                      </div>

                                      {isBooster ? (
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-semibold text-muted-foreground">
                                            Durasi (Jam)
                                          </label>
                                          <input
                                            type="number"
                                            min={1}
                                            max={72}
                                            value={v.durationHours || 6}
                                            onChange={(e) =>
                                              updateVoucherInTier(tierIdx, vIdx, {
                                                durationHours: Math.max(
                                                  1,
                                                  Number(e.target.value) || 6
                                                ),
                                              })
                                            }
                                            className={`w-full min-h-[34px] px-2 rounded-md border border-border bg-card text-xs text-foreground tabular-nums ${FOCUS_RING}`}
                                          />
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-semibold text-muted-foreground">
                                            Maks. Potongan (0=Unlim)
                                          </label>
                                          <input
                                            type="number"
                                            min={0}
                                            step={1000}
                                            value={v.maxDiscount || 0}
                                            onChange={(e) =>
                                              updateVoucherInTier(tierIdx, vIdx, {
                                                maxDiscount: Math.max(
                                                  0,
                                                  Number(e.target.value) || 0
                                                ),
                                              })
                                            }
                                            className={`w-full min-h-[34px] px-2 rounded-md border border-border bg-card text-xs text-foreground tabular-nums ${FOCUS_RING}`}
                                          />
                                        </div>
                                      )}

                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-muted-foreground">
                                          Aktif (Hari)
                                        </label>
                                        <input
                                          type="number"
                                          min={1}
                                          max={365}
                                          value={v.expireDays || 60}
                                          onChange={(e) =>
                                            updateVoucherInTier(tierIdx, vIdx, {
                                              expireDays: Math.max(
                                                1,
                                                Number(e.target.value) || 60
                                              ),
                                            })
                                          }
                                          className={`w-full min-h-[34px] px-2 rounded-md border border-border bg-card text-xs text-foreground tabular-nums ${FOCUS_RING}`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
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
                form="payroll-template-form"
                disabled={isSaving}
                className={`inline-flex items-center gap-1.5 min-h-[40px] px-5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer ${FOCUS_RING}`}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{editingId ? "Simpan Perubahan" : "Simpan Template"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
