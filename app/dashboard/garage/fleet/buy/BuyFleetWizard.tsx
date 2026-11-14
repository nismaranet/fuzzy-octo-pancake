"use client";

import React, { useState, useEffect } from "react";
import {
  Truck,
  Bus,
  Car,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Ticket,
  CheckCircle2,
  Info,
} from "lucide-react";

const ETS2_LOGO = "https://images.nismara.my.id/img/euro-truck-simulator-2.png";
const ATS_LOGO = "https://images.nismara.my.id/img/american-truck-simulator.png";
import { useRouter } from "next/navigation";
import VoucherPickerModal, { VoucherTriggerBar } from "@/components/voucher/VoucherPickerModal";

interface UserData {
  discordId: string;
  isBooster: boolean;
  isNismaraPlus: boolean;
  balance: number;
}

interface BuyFleetWizardProps {
  user: UserData;
  stores: any[];
  brands: any[];
  garage: { fleetSlot: number; fleetSlotUsed: number } | null;
}

export default function BuyFleetWizard({
  user,
  stores,
  brands,
  garage,
}: BuyFleetWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedBrand, setSelectedBrand] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [gameFilter, setGameFilter] = useState<"ALL" | "1" | "2">("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "truck" | "bus" | "car">("ALL");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(false);

  // Fetch available fleet buy vouchers when entering Step 3
  useEffect(() => {
    if (step === 3) {
      setIsLoadingVouchers(true);
      fetch("/api/vouchers/my?category=FLEET_BUY&status=ACTIVE", {
        cache: "no-store",
        headers: { "Pragma": "no-cache", "Cache-Control": "no-cache" },
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
    }
  }, [step]);

  const matchesGameAndType = (s: any) => {
    const gMatch =
      gameFilter === "ALL" || String(s.game_id ?? "1") === gameFilter;
    const tMatch =
      typeFilter === "ALL" ||
      String(s.type || "truck").toLowerCase() === typeFilter;
    return gMatch && tMatch;
  };

  const filteredBrands = brands.filter((b) => {
    if (gameFilter === "ALL" && typeFilter === "ALL") return true;
    return stores.some(
      (s) =>
        String(s.brand?._id || s.brand) === String(b._id) &&
        matchesGameAndType(s)
    );
  });

  const filteredStores = stores.filter(
    (s) =>
      String(s.brand?._id || s.brand) === String(selectedBrand?._id) &&
      matchesGameAndType(s)
  );

  // Kalkulasi harga (Total diskon gabungan maskimal 40% jika Nismara+ dan Booster)
  const basePrice = selectedModel?.price || 0;
  const adminFee = 500;
  const taxFee = Math.round(basePrice * 0.11);

  let nismaraPlusDiscount = 0;
  let boosterDiscount = 0;

  if (user.isNismaraPlus) nismaraPlusDiscount = basePrice * 0.2;
  if (user.isBooster) boosterDiscount = basePrice * 0.2;

  // Voucher discount calculation
  const selectedVoucher = vouchers.find((v) => v._id === selectedVoucherId);
  let voucherDiscount = 0;
  if (selectedVoucher && basePrice > 0) {
    if (selectedVoucher.discountType === "percentage") {
      voucherDiscount = Math.round(basePrice * (selectedVoucher.discountValue / 100));
      if (selectedVoucher.maxDiscount > 0) {
        voucherDiscount = Math.min(voucherDiscount, selectedVoucher.maxDiscount);
      }
    } else if (selectedVoucher.discountType === "fixed") {
      voucherDiscount = Math.min(basePrice, selectedVoucher.discountValue);
    }
    voucherDiscount = Math.max(0, Math.min(basePrice, voucherDiscount));
  }

  let upgradeFee = 0;
  let upgradeSlotCount = 0;
  let needsUpgrade = false;

  if (garage && garage.fleetSlotUsed >= garage.fleetSlot) {
    needsUpgrade = true;
    const deficit = garage.fleetSlotUsed - garage.fleetSlot;
    upgradeSlotCount = deficit + 1;

    const currentSlot = garage.fleetSlot;
    const targetSlot = currentSlot + upgradeSlotCount;
    for (let i = currentSlot + 1; i <= targetSlot; i++) {
      const tier = Math.floor((i - 1) / 3);
      upgradeFee += 1000 + tier * 500;
    }
  }

  const totalPrice = Math.max(
    adminFee,
    basePrice +
      taxFee -
      nismaraPlusDiscount -
      boosterDiscount -
      voucherDiscount +
      adminFee +
      upgradeFee
  );
  const canAfford = user.balance >= totalPrice;

  const handleConfirm = async () => {
    if (!canAfford) {
      setError("Saldo NC Anda tidak mencukupi!");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/fleet/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fleetStoreId: selectedModel._id,
          requiresGarageUpgrade: needsUpgrade,
          voucherId: selectedVoucherId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Terjadi kesalahan saat membuat pesanan");
      }

      router.push("/dashboard/transactions");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-[2rem] p-8 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-500">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Header & Steps */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-10 border-b border-border/50 pb-6 relative z-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-widest flex items-center gap-3">
            <Truck className="text-primary" size={32} />
            Beli Armada Baru
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            Ekspansi armada anda
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-4 py-2 bg-background border border-border rounded-xl">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Saldo NC Anda
            </p>
            <p className="font-black text-primary tabular-nums">
              {user.balance.toLocaleString("id-ID")} NC
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-8 text-sm font-bold uppercase tracking-wider relative z-10 overflow-x-auto pb-2">
        <button
          onClick={() => {
            setStep(1);
            setSelectedModel(null);
          }}
          className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${step === 1 ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground hover:text-foreground"}`}
        >
          <span className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center text-[10px]">
            1
          </span>{" "}
          Pilih Brand
        </button>
        <div className="w-8 h-[2px] bg-border shrink-0" />
        <div
          className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${step === 2 ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground"}`}
        >
          <span className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center text-[10px]">
            2
          </span>{" "}
          Pilih Model
        </div>
        <div className="w-8 h-[2px] bg-border shrink-0" />
        <div
          className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${step === 3 ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground"}`}
        >
          <span className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center text-[10px]">
            3
          </span>{" "}
          Konfirmasi
        </div>
      </div>

      <div className="relative z-10 min-h-[400px]">
        {(step === 1 || step === 2) && (
          <div className="mb-6 p-4 bg-background/60 border border-border/60 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">
                Filter Game:
              </span>
              <button
                type="button"
                onClick={() => setGameFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                  gameFilter === "ALL"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                Semua Game
              </button>
              <button
                type="button"
                onClick={() => setGameFilter("1")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                  gameFilter === "1"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                <img
                  src={ETS2_LOGO}
                  alt="ETS2"
                  className="h-3.5 w-auto object-contain"
                />
                ETS2
              </button>
              <button
                type="button"
                onClick={() => setGameFilter("2")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                  gameFilter === "2"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                <img
                  src={ATS_LOGO}
                  alt="ATS"
                  className="h-3.5 w-auto object-contain"
                />
                ATS
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">
                Jenis Kendaraan:
              </span>
              <button
                type="button"
                onClick={() => setTypeFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                  typeFilter === "ALL"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                Semua Jenis
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("truck")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                  typeFilter === "truck"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                <Truck size={12} /> Truck
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("bus")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                  typeFilter === "bus"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                <Bus size={12} /> Bus / Coach
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("car")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                  typeFilter === "car"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                <Car size={12} /> Car
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Pilih Brand */}
        {step === 1 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
            {filteredBrands.map((brand) => {
              const brandModels = stores.filter(
                (s) =>
                  String(s.brand?._id || s.brand) === String(brand._id) &&
                  matchesGameAndType(s)
              );
              const hasETS2 = brandModels.some(
                (s) => String(s.game_id ?? "1") !== "2"
              );
              const hasATS = brandModels.some(
                (s) => String(s.game_id ?? "1") === "2"
              );

              return (
                <button
                  key={brand._id.toString()}
                  onClick={() => {
                    setSelectedBrand(brand);
                    setStep(2);
                  }}
                  className="bg-background border border-border rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className="h-16 flex items-center justify-center w-full">
                    {brand.logo_url ? (
                      <img
                        src={brand.logo_url}
                        alt={brand.name}
                        className="max-h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform"
                      />
                    ) : (
                      <Truck size={40} className="text-muted-foreground" />
                    )}
                  </div>
                  <span className="font-black uppercase tracking-widest text-sm text-center">
                    {brand.name}
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {hasETS2 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-card text-foreground border border-border">
                        <img
                          src={ETS2_LOGO}
                          alt="ETS2"
                          className="h-3 w-auto object-contain"
                        />
                        ETS2
                      </span>
                    )}
                    {hasATS && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-card text-foreground border border-border">
                        <img
                          src={ATS_LOGO}
                          alt="ATS"
                          className="h-3 w-auto object-contain"
                        />
                        ATS
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold text-muted-foreground bg-muted/50">
                      {brandModels.length} unit
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* STEP 2: Pilih Model */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3 mb-6">
              {selectedBrand?.logo_url && (
                <img
                  src={selectedBrand.logo_url}
                  alt="Brand"
                  className="h-8 object-contain"
                />
              )}
              <h2 className="text-xl font-black uppercase italic tracking-wider">
                Model Tersedia
              </h2>
            </div>

            {filteredStores.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground italic bg-background/50 rounded-xl border border-border">
                Belum ada model kendaraan untuk brand dan filter ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStores.map((model) => {
                  const isATSModel = String(model.game_id ?? "1") === "2";
                  return (
                    <div
                      key={model._id.toString()}
                      className="bg-background border border-border rounded-2xl overflow-hidden flex flex-col"
                    >
                      <div className="aspect-video bg-muted/30 p-6 flex items-center justify-center relative">
                        {model.photo_url ? (
                          <img
                            src={model.photo_url}
                            alt={model.name}
                            className="w-full h-full object-contain drop-shadow-xl"
                          />
                        ) : (
                          <Truck size={48} className="text-muted-foreground/30" />
                        )}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-background/85 text-foreground border border-border backdrop-blur-sm">
                            <img
                              src={isATSModel ? ATS_LOGO : ETS2_LOGO}
                              alt={isATSModel ? "ATS" : "ETS2"}
                              className="h-3.5 w-auto object-contain"
                            />
                            {isATSModel ? "ATS" : "ETS2"}
                          </span>
                          <span className="px-2 py-1 bg-background/80 backdrop-blur-sm rounded-md text-[10px] font-black uppercase tracking-widest border border-border">
                            {model.type}
                          </span>
                        </div>
                      </div>

                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="font-black text-lg uppercase italic tracking-wide mb-2">
                          {model.name}
                        </h3>
                        <p className="text-2xl font-black text-primary mb-4 tabular-nums">
                          {model.price.toLocaleString("id-ID")} NC
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                          <div className="bg-card border border-border/50 rounded-lg p-3">
                            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                              Maint. Mesin
                            </p>
                            <p className="text-xs font-bold">
                              {model.component_cost_maintenance?.engine?.toLocaleString(
                                "id-ID",
                              )}{" "}
                              NC
                            </p>
                          </div>
                          <div className="bg-card border border-border/50 rounded-lg p-3">
                            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                              Unfix Mesin
                            </p>
                            <p className="text-xs font-bold">
                              {model.component_cost_unfix_wear?.engine?.toLocaleString(
                                "id-ID",
                              )}{" "}
                              NC
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedModel(model);
                            setStep(3);
                          }}
                          className="mt-auto w-full py-3 bg-primary/10 hover:bg-primary/20 text-primary font-bold uppercase tracking-widest text-sm rounded-xl transition-colors border border-primary/20"
                        >
                          Pilih Kendaraan
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Konfirmasi */}
        {step === 3 && selectedModel && (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-background border border-border rounded-3xl overflow-hidden shadow-xl">
              <div className="grid grid-cols-1 md:grid-cols-5">
                {/* Visual Section */}
                <div className="md:col-span-2 bg-muted/20 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-border">
                  {selectedBrand?.logo_url && (
                    <img
                      src={selectedBrand.logo_url}
                      alt="Brand"
                      className="h-10 object-contain mb-6 opacity-50"
                    />
                  )}
                  {selectedModel.photo_url ? (
                    <img
                      src={selectedModel.photo_url}
                      alt={selectedModel.name}
                      className="w-full h-auto object-contain drop-shadow-2xl mb-6"
                    />
                  ) : (
                    <Truck
                      size={100}
                      className="text-muted-foreground/20 mb-6"
                    />
                  )}
                  <h3 className="font-black text-2xl uppercase italic tracking-wide text-center">
                    {selectedModel.name}
                  </h3>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-background border border-border">
                      <img
                        src={
                          String(selectedModel.game_id ?? "1") === "2"
                            ? ATS_LOGO
                            : ETS2_LOGO
                        }
                        alt={
                          String(selectedModel.game_id ?? "1") === "2"
                            ? "ATS"
                            : "ETS2"
                        }
                        className="h-3.5 w-auto object-contain"
                      />
                      {String(selectedModel.game_id ?? "1") === "2"
                        ? "ATS"
                        : "ETS2"}
                    </span>
                    <span className="px-3 py-1 bg-background rounded-full text-[10px] font-black uppercase tracking-widest border border-border">
                      {selectedModel.type}
                    </span>
                  </div>
                </div>

                {/* Calculation Section */}
                <div className="md:col-span-3 p-8">
                  <h3 className="text-lg font-black uppercase tracking-widest border-b border-border pb-4 mb-6">
                    Ringkasan Biaya
                  </h3>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-bold">
                        Harga Dasar Kendaraan
                      </span>
                      <span className="font-black tabular-nums">
                        {basePrice.toLocaleString("id-ID")} NC
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-bold flex items-center gap-2">
                        Pajak{" "}
                        <span className="px-2 py-0.5 bg-muted rounded text-[9px] uppercase tracking-widest">
                          11%
                        </span>
                      </span>
                      <span className="font-black tabular-nums">
                        +{taxFee.toLocaleString("id-ID")} NC
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-bold flex items-center gap-2">
                        Biaya Admin{" "}
                        <span className="px-2 py-0.5 bg-muted rounded text-[9px] uppercase tracking-widest">
                          Fixed
                        </span>
                      </span>
                      <span className="font-black tabular-nums">
                        +{adminFee.toLocaleString("id-ID")} NC
                      </span>
                    </div>

                    {needsUpgrade && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-bold flex items-center gap-2">
                          Upgrade Slot Garasi (+{upgradeSlotCount} Slot){" "}
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded text-[9px] uppercase tracking-widest">
                            Wajib
                          </span>
                        </span>
                        <span className="font-black tabular-nums text-amber-500">
                          +{upgradeFee.toLocaleString("id-ID")} NC
                        </span>
                      </div>
                    )}

                    {nismaraPlusDiscount > 0 && (
                      <div className="flex justify-between items-center text-sm text-emerald-500">
                        <span className="font-bold flex items-center gap-2">
                          Diskon Nismara+{" "}
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-500 rounded text-[9px] uppercase tracking-widest">
                            20%
                          </span>
                        </span>
                        <span className="font-black tabular-nums">
                          -{nismaraPlusDiscount.toLocaleString("id-ID")} NC
                        </span>
                      </div>
                    )}

                    {boosterDiscount > 0 && (
                      <div className="flex justify-between items-center text-sm text-fuchsia-500">
                        <span className="font-bold flex items-center gap-2">
                          Diskon Server Booster{" "}
                          <span className="px-2 py-0.5 bg-fuchsia-500/20 text-fuchsia-500 rounded text-[9px] uppercase tracking-widest">
                            20%
                          </span>
                        </span>
                        <span className="font-black tabular-nums">
                          -{boosterDiscount.toLocaleString("id-ID")} NC
                        </span>
                      </div>
                    )}

                    {voucherDiscount > 0 && selectedVoucher && (
                      <div className="flex justify-between items-center text-sm text-teal-400">
                        <span className="font-bold flex items-center gap-2">
                          <Ticket size={14} /> Diskon Kupon Fleet{" "}
                          <span className="px-2 py-0.5 bg-teal-500/20 text-teal-400 rounded text-[9px] uppercase tracking-widest">
                            {selectedVoucher.discountType === "percentage" ? `${selectedVoucher.discountValue}%` : "Fixed"}
                          </span>
                        </span>
                        <span className="font-black tabular-nums">
                          -{voucherDiscount.toLocaleString("id-ID")} NC
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Voucher Selection Section */}
                  <div className="mt-6 pt-6 border-t border-border/50 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Ticket size={14} className="text-teal-400" /> Kupon Diskon Pembelian
                      </span>
                      {vouchers.length > 0 && (
                        <span className="text-[10px] bg-teal-500/20 text-teal-400 font-bold px-2 py-0.5 rounded-full border border-teal-500/30">
                          {vouchers.length} Tersedia
                        </span>
                      )}
                    </div>

                    <VoucherTriggerBar
                      vouchers={vouchers}
                      selectedVoucher={selectedVoucher}
                      isLoading={isLoadingVouchers}
                      onOpenModal={() => setIsVoucherModalOpen(true)}
                      onRemoveVoucher={() => setSelectedVoucherId(null)}
                      accentColor="teal"
                    />
                  </div>

                  <div className="mt-6 pt-6 border-t border-border border-dashed">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                          Total Yang Harus Dibayar
                        </p>
                        {canAfford ? (
                          <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-bold uppercase tracking-widest">
                            <CheckCircle size={14} /> Saldo Mencukupi
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-red-500 text-[10px] font-bold uppercase tracking-widest">
                            <AlertTriangle size={14} /> Saldo Kurang
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-4xl font-black italic tracking-tighter tabular-nums ${canAfford ? "text-primary" : "text-red-500"}`}
                      >
                        {totalPrice.toLocaleString("id-ID")}{" "}
                        <span className="text-xl">NC</span>
                      </span>
                    </div>
                  </div>

                  {error && (
                    <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-500">
                      <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                      <p className="text-sm font-medium">{error}</p>
                    </div>
                  )}

                  <button
                    disabled={!canAfford || isSubmitting}
                    onClick={handleConfirm}
                    className="mt-8 w-full py-4 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary text-primary-foreground font-black uppercase tracking-widest rounded-xl transition-all shadow-xl hover:shadow-primary/25 hover:-translate-y-1 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />{" "}
                        Memproses...
                      </>
                    ) : (
                      "Konfirmasi & Buat Tiket Pembelian"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dedicated Voucher Picker Modal */}
      <VoucherPickerModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        vouchers={vouchers}
        selectedVoucherId={selectedVoucherId}
        onSelectVoucher={(id) => setSelectedVoucherId(id)}
        title="Pilih Kupon Diskon Armada"
        categoryLabel="Pembelian Armada"
      />
    </div>
  );
}
