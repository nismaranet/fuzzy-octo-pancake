"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  AlertCircle,
  Wrench,
  Calendar,
  Receipt,
  Info,
  Ticket,
  Sparkles,
  Lock,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import VoucherPickerModal, {
  VoucherTriggerBar,
} from "@/components/voucher/VoucherPickerModal";
import {
  FLEET_PART_KEYS,
  type ComponentAction,
  type FleetMaintenanceEvaluation,
  type FleetPartKey,
  validateAndPriceMaintenanceSelection,
} from "@/lib/fleetMaintenance";

interface FleetMaintenanceClientProps {
  fleetId: string;
  evaluation: FleetMaintenanceEvaluation;
}

export default function FleetMaintenanceClient({
  fleetId,
  evaluation,
}: FleetMaintenanceClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(
    null,
  );
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(false);
  const [selections, setSelections] = useState<
    Record<FleetPartKey, ComponentAction>
  >(() => ({ ...evaluation.defaultSelections }));

  const router = useRouter();

  // Sync defaults when modal opens or evaluation prop changes
  useEffect(() => {
    if (isModalOpen) {
      // Pre-select mandatory items; if pure early-service (no mandatory), auto-pick the first eligible item
      const nextSelections: Record<FleetPartKey, ComponentAction> = {
        ...evaluation.defaultSelections,
      };
      if (!evaluation.hasMandatoryAny) {
        const firstEligible = FLEET_PART_KEYS.map((k) => evaluation.parts[k]).find(
          (p) => p.allowMaintain || p.allowReplace,
        );
        if (firstEligible) {
          nextSelections[firstEligible.key] = firstEligible.allowMaintain
            ? "maintenance"
            : "replace";
        }
      }
      setSelections(nextSelections);
      setIsLoadingVouchers(true);
      fetch("/api/vouchers/my?category=FLEET_MAINTENANCE&status=ACTIVE", {
        cache: "no-store",
        headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.vouchers)) {
            setVouchers(data.vouchers);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingVouchers(false));
    } else {
      setSelectedVoucherId(null);
      setError(null);
    }
  }, [isModalOpen, evaluation]);

  const priced = useMemo(
    () => validateAndPriceMaintenanceSelection(evaluation, selections),
    [evaluation, selections],
  );

  const selectedVoucher = vouchers.find((v) => v._id === selectedVoucherId);
  const totalComponentCost = priced.valid ? priced.totalComponentCost : 0;
  const adminFee = evaluation.adminFee;

  let voucherDiscount = 0;
  if (selectedVoucher && totalComponentCost > 0) {
    if (selectedVoucher.discountType === "percentage") {
      voucherDiscount = Math.round(
        totalComponentCost * (selectedVoucher.discountValue / 100),
      );
      if (selectedVoucher.maxDiscount > 0) {
        voucherDiscount = Math.min(voucherDiscount, selectedVoucher.maxDiscount);
      }
    } else if (selectedVoucher.discountType === "fixed") {
      voucherDiscount = Math.min(
        totalComponentCost,
        selectedVoucher.discountValue,
      );
    }
    voucherDiscount = Math.max(0, Math.min(totalComponentCost, voucherDiscount));
  }

  const finalComponentCost = Math.max(0, totalComponentCost - voucherDiscount);
  const totalPrice = priced.valid ? finalComponentCost + adminFee : 0;

  const setPartAction = (key: FleetPartKey, action: ComponentAction) => {
    setError(null);
    setSelections((prev) => ({ ...prev, [key]: action }));
  };

  const handleSubmit = async () => {
    if (!priced.valid) {
      setError(priced.error || "Pilih minimal satu komponen.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/fleet/maintenance", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Pragma: "no-cache",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({
          fleetId,
          selections,
          voucherId: selectedVoucherId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Terjadi kesalahan saat memproses permintaan.",
        );
      }

      setIsModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerStyle = evaluation.hasMandatoryReplace
    ? "bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-red-500/25"
    : evaluation.hasMandatoryMaintenance
      ? "bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-primary/25"
      : "bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30";

  const triggerLabel = evaluation.hasMandatoryReplace
    ? "Request Penggantian"
    : evaluation.hasMandatoryMaintenance
      ? "Request Maintenance"
      : "Servis Lebih Awal";

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`${triggerStyle} px-5 py-3 rounded-xl flex items-center gap-2 font-bold uppercase tracking-widest text-sm transition-all hover:-translate-y-0.5`}
      >
        {evaluation.hasMandatoryReplace ? (
          <RefreshCw size={17} />
        ) : evaluation.hasMandatoryMaintenance ? (
          <Wrench size={17} />
        ) : (
          <Sparkles size={17} />
        )}
        {triggerLabel}
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-border/50 bg-muted/30 shrink-0">
              <h2 className="text-lg font-black uppercase italic tracking-wider flex items-center gap-2">
                <AlertCircle
                  className={
                    priced.orderType === "replace"
                      ? "text-red-500"
                      : evaluation.hasMandatoryMaintenance
                        ? "text-amber-500"
                        : "text-sky-400"
                  }
                />
                {evaluation.hasMandatoryAny
                  ? "Konfirmasi Servis & Bundling"
                  : "Servis / Ganti Lebih Awal"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Anda dapat menggabungkan komponen yang sudah mencapai ≥50% dalam
                1 tiket untuk hemat biaya admin & antrean garasi.
              </p>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-sm font-medium">
                  {error}
                </div>
              )}

              {/* Component Selection Cards */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Wrench size={14} /> Pilih Aksi Per Komponen
                </h3>

                <div className="space-y-2.5">
                  {FLEET_PART_KEYS.map((key) => {
                    const part = evaluation.parts[key];
                    const currentAction = selections[key];
                    const isEligible = part.allowMaintain || part.allowReplace;

                    return (
                      <div
                        key={key}
                        className={`rounded-xl border p-3.5 transition-colors ${
                          currentAction === "replace"
                            ? "bg-red-500/5 border-red-500/30"
                            : currentAction === "maintenance"
                              ? "bg-amber-500/5 border-amber-500/30"
                              : "bg-background/50 border-border/50"
                        } ${!isEligible ? "opacity-55" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">
                              {part.label}
                            </span>
                            {part.mustReplace ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                                <Lock size={10} /> Wajib Ganti
                              </span>
                            ) : part.mustMaintain ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                <Lock size={10} /> Wajib Servis
                              </span>
                            ) : isEligible ? (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
                                Bisa Sekalian
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Masih Prima
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-semibold text-right">
                            <span>
                              Pakai {part.cycleUsagePercent}% • Wear{" "}
                              {part.wearPercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            disabled={part.isMandatory}
                            onClick={() => setPartAction(key, "none")}
                            className={`px-2 py-2 rounded-lg text-[11px] font-bold transition-all border ${
                              currentAction === "none"
                                ? "bg-muted text-foreground border-border"
                                : "bg-background/60 text-muted-foreground border-border/40 hover:bg-muted/60"
                            } disabled:opacity-35 disabled:cursor-not-allowed`}
                          >
                            Lewati
                          </button>

                          <button
                            type="button"
                            disabled={!part.allowMaintain}
                            onClick={() => setPartAction(key, "maintenance")}
                            className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all border flex flex-col items-center leading-tight ${
                              currentAction === "maintenance"
                                ? "bg-amber-500 text-black border-amber-400 shadow-sm"
                                : "bg-background/60 text-foreground border-border/40 hover:border-amber-500/50"
                            } disabled:opacity-35 disabled:cursor-not-allowed`}
                          >
                            <span>Rutin</span>
                            <span className="text-[10px] opacity-80 font-semibold">
                              {part.maintCost.toLocaleString("id-ID")} NC •{" "}
                              {part.maintDays}h
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={!part.allowReplace}
                            onClick={() => setPartAction(key, "replace")}
                            className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all border flex flex-col items-center leading-tight ${
                              currentAction === "replace"
                                ? "bg-red-500 text-white border-red-400 shadow-sm"
                                : "bg-background/60 text-foreground border-border/40 hover:border-red-500/50"
                            } disabled:opacity-35 disabled:cursor-not-allowed`}
                          >
                            <span>Ganti Baru</span>
                            <span className="text-[10px] opacity-85 font-semibold">
                              {part.replaceCost.toLocaleString("id-ID")} NC •{" "}
                              {part.replaceDays}h
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Estimated Duration */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Calendar size={14} /> Estimasi Waktu (Termasuk Boost Mekanik)
                </h3>
                <div className="bg-background/50 border border-border/50 p-3.5 rounded-xl flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Total Durasi Bengkel ({priced.items.length} komponen)
                  </span>
                  <span className="font-black text-amber-500">
                    {priced.valid ? priced.serviceDuration : 0} Hari
                  </span>
                </div>
              </div>

              {/* Voucher Selector Section */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Ticket size={14} className="text-emerald-400" /> Kupon /
                    Voucher Servis
                  </span>
                  {vouchers.length > 0 && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      {vouchers.length} Tersedia
                    </span>
                  )}
                </h3>

                <VoucherTriggerBar
                  vouchers={vouchers}
                  selectedVoucher={selectedVoucher}
                  isLoading={isLoadingVouchers}
                  onOpenModal={() => setIsVoucherModalOpen(true)}
                  onRemoveVoucher={() => setSelectedVoucherId(null)}
                  accentColor="emerald"
                />
              </div>

              {/* Cost Breakdown */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Receipt size={14} /> Rincian Biaya
                </h3>
                <div className="bg-background/50 border border-border/50 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Biaya Komponen
                    </span>
                    <span className="font-medium">
                      {totalComponentCost.toLocaleString("id-ID")} NC
                    </span>
                  </div>

                  {voucherDiscount > 0 && selectedVoucher && (
                    <div className="flex justify-between text-sm text-emerald-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Ticket size={13} /> Diskon Voucher (
                        {selectedVoucher.discountType === "percentage"
                          ? `${selectedVoucher.discountValue}%`
                          : "Fixed"}
                        )
                      </span>
                      <span>
                        -{voucherDiscount.toLocaleString("id-ID")} NC
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Biaya Admin (Manager)
                    </span>
                    <span className="font-medium">
                      {adminFee.toLocaleString("id-ID")} NC
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border/50 flex justify-between">
                    <span className="font-bold uppercase">
                      Total Pembayaran
                    </span>
                    <span className="font-black text-emerald-500 text-lg">
                      {totalPrice.toLocaleString("id-ID")} NC
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-accent-sky/10 border border-accent-sky/20 p-3 rounded-xl flex gap-3 text-accent-sky items-start">
                <Info size={16} className="shrink-0 mt-0.5" />
                <p className="text-xs font-medium leading-relaxed">
                  Permintaan dikirim ke Manajer Logistik untuk dikonfirmasi.
                  Saldo NC dipotong saat disetujui. Jadwal servis komponen yang
                  dipilih akan di-reset mulai dari odometer saat servis selesai.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-border/50 bg-muted/30 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl font-bold uppercase tracking-widest text-sm text-muted-foreground hover:bg-background transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !priced.valid}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl font-bold uppercase tracking-widest text-sm transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Memproses...
                  </>
                ) : (
                  "Kirim Permintaan"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Voucher Picker Modal */}
      <VoucherPickerModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        vouchers={vouchers}
        selectedVoucherId={selectedVoucherId}
        onSelectVoucher={(id) => setSelectedVoucherId(id)}
        title="Pilih Kupon Servis"
        categoryLabel="Servis & Perawatan"
      />
    </>
  );
}
