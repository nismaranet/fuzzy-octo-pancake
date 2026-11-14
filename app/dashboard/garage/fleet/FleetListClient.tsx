"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Truck,
  Bus,
  Car,
  Search,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Gamepad2,
  SlidersHorizontal,
  X,
  Gauge,
  ArrowUpDown,
  Clock,
  ShieldAlert,
  CircleDot,
  ParkingSquare,
} from "lucide-react";

const ETS2_LOGO = "https://images.nismara.my.id/img/euro-truck-simulator-2.png";
const ATS_LOGO = "https://images.nismara.my.id/img/american-truck-simulator.png";

export interface FleetComponentStatus {
  key: "engine" | "tires" | "transmission" | "brakes";
  label: string;
  odometer: number;
  threshold: number;
  kmPct: number;
  wearPct: number;
  needsMaintenance: boolean;
  needsReplace: boolean;
}

export interface SerializedFleetItem {
  _id: string;
  id: string;
  displayName: string;
  customName: string | null;
  brandName: string;
  brandLogo: string | null;
  modelName: string;
  imageUrl: string | null;
  fleetNumber: string;
  odometer: number;
  wheels: string;
  game: "ETS2" | "ATS";
  vehicleType: "truck" | "bus" | "car";
  isCurrentlyDriven: boolean;
  rawStatus: string;
  serviceState: "in_service" | "needs_replace" | "needs_maintenance" | "healthy";
  activeOrderStatus: "pending" | "waiting" | "in_service" | null;
  maintenanceEndAt: string | null;
  estimatedServiceCost: number;
  issuesList: string[];
  components: FleetComponentStatus[];
}

interface FleetListClientProps {
  fleets: SerializedFleetItem[];
}

type GameFilter = "ALL" | "ETS2" | "ATS";
type TypeFilter = "ALL" | "truck" | "bus" | "car";
type StatusFilter =
  | "ALL"
  | "NEEDS_ATTENTION"
  | "IN_SERVICE"
  | "HEALTHY"
  | "DRIVEN"
  | "PARKED";
type SortOption = "SERVICE_PRIORITY" | "ODOMETER_DESC" | "ODOMETER_ASC" | "NAME_ASC";

export default function FleetListClient({ fleets }: FleetListClientProps) {
  const [search, setSearch] = useState("");
  const [gameFilter, setGameFilter] = useState<GameFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("SERVICE_PRIORITY");

  // Summary counts across all user fleets
  const summary = useMemo(() => {
    let ets2 = 0;
    let ats = 0;
    let truck = 0;
    let bus = 0;
    let car = 0;
    let needsAttention = 0;
    let inService = 0;
    let healthy = 0;
    let driven = 0;

    for (const f of fleets) {
      if (f.game === "ETS2") ets2++;
      else ats++;

      if (f.vehicleType === "bus") bus++;
      else if (f.vehicleType === "car") car++;
      else truck++;

      if (f.serviceState === "needs_maintenance" || f.serviceState === "needs_replace") {
        needsAttention++;
      } else if (f.serviceState === "in_service") {
        inService++;
      } else {
        healthy++;
      }

      if (f.isCurrentlyDriven) driven++;
    }

    return {
      total: fleets.length,
      ets2,
      ats,
      truck,
      bus,
      car,
      needsAttention,
      inService,
      healthy,
      driven,
    };
  }, [fleets]);

  const filteredFleets = useMemo(() => {
    const q = search.trim().toLowerCase();

    const matches = fleets.filter((f) => {
      if (gameFilter !== "ALL" && f.game !== gameFilter) return false;
      if (typeFilter !== "ALL" && f.vehicleType !== typeFilter) return false;

      if (statusFilter === "NEEDS_ATTENTION") {
        if (f.serviceState !== "needs_maintenance" && f.serviceState !== "needs_replace") {
          return false;
        }
      } else if (statusFilter === "IN_SERVICE") {
        if (f.serviceState !== "in_service") return false;
      } else if (statusFilter === "HEALTHY") {
        if (f.serviceState !== "healthy") return false;
      } else if (statusFilter === "DRIVEN") {
        if (!f.isCurrentlyDriven) return false;
      } else if (statusFilter === "PARKED") {
        if (f.isCurrentlyDriven) return false;
      }

      if (q) {
        const haystack = [
          f.displayName,
          f.customName || "",
          f.brandName,
          f.modelName,
          f.fleetNumber,
          f.id,
          f.game,
          f.vehicleType,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    const serviceWeight = (state: SerializedFleetItem["serviceState"]) => {
      if (state === "needs_replace") return 4;
      if (state === "needs_maintenance") return 3;
      if (state === "in_service") return 2;
      return 1;
    };

    return [...matches].sort((a, b) => {
      if (sortBy === "SERVICE_PRIORITY") {
        const diff = serviceWeight(b.serviceState) - serviceWeight(a.serviceState);
        if (diff !== 0) return diff;
        if (a.isCurrentlyDriven !== b.isCurrentlyDriven) {
          return a.isCurrentlyDriven ? -1 : 1;
        }
        return b.odometer - a.odometer;
      }
      if (sortBy === "ODOMETER_DESC") return b.odometer - a.odometer;
      if (sortBy === "ODOMETER_ASC") return a.odometer - b.odometer;
      return a.displayName.localeCompare(b.displayName, "id");
    });
  }, [fleets, search, gameFilter, typeFilter, statusFilter, sortBy]);

  const hasActiveFilters =
    search.trim() !== "" ||
    gameFilter !== "ALL" ||
    typeFilter !== "ALL" ||
    statusFilter !== "ALL";

  const resetFilters = () => {
    setSearch("");
    setGameFilter("ALL");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
  };

  const renderVehicleTypeBadge = (type: SerializedFleetItem["vehicleType"]) => {
    if (type === "bus") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/30 backdrop-blur-md">
          <Bus size={12} /> Bus / Coach
        </span>
      );
    }
    if (type === "car") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-purple-500/15 text-purple-400 border border-purple-500/30 backdrop-blur-md">
          <Car size={12} /> Car / Scout
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-sky-500/15 text-sky-400 border border-sky-500/30 backdrop-blur-md">
        <Truck size={12} /> Truck
      </span>
    );
  };

  const renderGameBadge = (game: SerializedFleetItem["game"]) => {
    if (game === "ATS") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-background/85 text-foreground border border-border/70 backdrop-blur-md shadow-sm">
          <img
            src={ATS_LOGO}
            alt="ATS"
            className="h-3.5 w-auto object-contain"
          />
          ATS
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-background/85 text-foreground border border-border/70 backdrop-blur-md shadow-sm">
        <img
          src={ETS2_LOGO}
          alt="ETS2"
          className="h-3.5 w-auto object-contain"
        />
        ETS2
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ALERT BANNER FOR FLEETS NEEDING SERVICE */}
      {summary.needsAttention > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-red-500/5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
              <AlertTriangle size={22} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-red-400">
                Perhatian: {summary.needsAttention} Kendaraan Membutuhkan Servis / Pergantian Part
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Segera lakukan maintenance agar performa kendaraan tetap optimal dan terhindar dari kerusakan parah saat job berlangsung.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setStatusFilter(
                statusFilter === "NEEDS_ATTENTION" ? "ALL" : "NEEDS_ATTENTION"
              )
            }
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shrink-0 border ${
              statusFilter === "NEEDS_ATTENTION"
                ? "bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/20"
                : "bg-red-500/15 hover:bg-red-500/25 text-red-400 border-red-500/30"
            }`}
          >
            {statusFilter === "NEEDS_ATTENTION"
              ? "Tampilkan Semua"
              : "Lihat yang Perlu Servis"}
          </button>
        </div>
      )}

      {/* SUMMARY STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={resetFilters}
          className={`text-left p-4 rounded-2xl border transition-all ${
            !hasActiveFilters
              ? "bg-primary/10 border-primary/40 shadow-md"
              : "bg-card border-border/60 hover:border-primary/30"
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Total Armada
          </p>
          <p className="text-2xl font-black text-foreground mt-1 tabular-nums">
            {summary.total}
          </p>
          <p className="text-[10px] font-bold text-muted-foreground mt-1">
            {summary.driven} Aktif Digunakan
          </p>
        </button>

        <button
          type="button"
          onClick={() => setGameFilter(gameFilter === "ETS2" ? "ALL" : "ETS2")}
          className={`text-left p-4 rounded-2xl border transition-all ${
            gameFilter === "ETS2"
              ? "bg-indigo-500/15 border-indigo-500/50 shadow-md"
              : "bg-card border-border/60 hover:border-indigo-500/30"
          }`}
        >
          <div className="flex items-center gap-2">
            <img
              src={ETS2_LOGO}
              alt="ETS2"
              className="h-4 w-auto object-contain"
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
              ETS2 Fleet
            </span>
          </div>
          <p className="text-2xl font-black text-foreground mt-1 tabular-nums">
            {summary.ets2}
          </p>
          <p className="text-[10px] font-bold text-muted-foreground mt-1">
            Euro Truck Sim 2
          </p>
        </button>

        <button
          type="button"
          onClick={() => setGameFilter(gameFilter === "ATS" ? "ALL" : "ATS")}
          className={`text-left p-4 rounded-2xl border transition-all ${
            gameFilter === "ATS"
              ? "bg-rose-500/15 border-rose-500/50 shadow-md"
              : "bg-card border-border/60 hover:border-rose-500/30"
          }`}
        >
          <div className="flex items-center gap-2">
            <img
              src={ATS_LOGO}
              alt="ATS"
              className="h-4 w-auto object-contain"
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">
              ATS Fleet
            </span>
          </div>
          <p className="text-2xl font-black text-foreground mt-1 tabular-nums">
            {summary.ats}
          </p>
          <p className="text-[10px] font-bold text-muted-foreground mt-1">
            American Truck Sim
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter(typeFilter === "truck" ? "ALL" : "truck")}
          className={`text-left p-4 rounded-2xl border transition-all ${
            typeFilter === "truck"
              ? "bg-sky-500/15 border-sky-500/50 shadow-md"
              : "bg-card border-border/60 hover:border-sky-500/30"
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
            <Truck size={13} /> Truck
          </p>
          <p className="text-2xl font-black text-foreground mt-1 tabular-nums">
            {summary.truck}
          </p>
          <p className="text-[10px] font-bold text-muted-foreground mt-1">
            Divisi Logistik
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter(typeFilter === "bus" ? "ALL" : "bus")}
          className={`text-left p-4 rounded-2xl border transition-all ${
            typeFilter === "bus"
              ? "bg-amber-500/15 border-amber-500/50 shadow-md"
              : "bg-card border-border/60 hover:border-amber-500/30"
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
            <Bus size={13} /> Bus &amp; Car
          </p>
          <p className="text-2xl font-black text-foreground mt-1 tabular-nums">
            {summary.bus + summary.car}
          </p>
          <p className="text-[10px] font-bold text-muted-foreground mt-1">
            {summary.bus} Bus • {summary.car} Car
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter(
              statusFilter === "NEEDS_ATTENTION" ? "ALL" : "NEEDS_ATTENTION"
            )
          }
          className={`text-left p-4 rounded-2xl border transition-all ${
            statusFilter === "NEEDS_ATTENTION"
              ? "bg-red-500/15 border-red-500/50 shadow-md"
              : summary.needsAttention > 0
                ? "bg-red-500/5 border-red-500/30 hover:border-red-500/50"
                : "bg-card border-border/60 hover:border-emerald-500/30"
          }`}
        >
          <p
            className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
              summary.needsAttention > 0 ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {summary.needsAttention > 0 ? (
              <>
                <AlertTriangle size={13} /> Perlu Servis
              </>
            ) : (
              <>
                <CheckCircle2 size={13} /> Status Servis
              </>
            )}
          </p>
          <p className="text-2xl font-black text-foreground mt-1 tabular-nums">
            {summary.needsAttention}
          </p>
          <p className="text-[10px] font-bold text-muted-foreground mt-1">
            {summary.inService} Diservis • {summary.healthy} Prima
          </p>
        </button>
      </div>

      {/* SEARCH & MULTI-FILTER BAR */}
      <div className="bg-card border border-border/60 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama kendaraan, merk, model, plat nomor, atau ID..."
              className="w-full bg-background border border-border rounded-xl py-2.5 pl-11 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative flex items-center w-full sm:w-auto">
              <ArrowUpDown
                size={15}
                className="absolute left-3.5 text-muted-foreground pointer-events-none"
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full sm:w-auto bg-background border border-border rounded-xl py-2.5 pl-9 pr-8 text-xs font-black uppercase tracking-wider text-foreground focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="SERVICE_PRIORITY">Urutkan: Prioritas Servis</option>
                <option value="ODOMETER_DESC">Odometer Tertinggi</option>
                <option value="ODOMETER_ASC">Odometer Terendah</option>
                <option value="NAME_ASC">Nama Kendaraan (A-Z)</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-3.5 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 transition-colors shrink-0"
              >
                <X size={14} /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills Row */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-2 border-t border-border/40">
          <div className="flex flex-wrap items-center gap-2">
            {/* Game Filter Pills */}
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1 flex items-center gap-1">
              <Gamepad2 size={13} /> Game:
            </span>
            <button
              type="button"
              onClick={() => setGameFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                gameFilter === "ALL"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
              }`}
            >
              Semua ({summary.total})
            </button>
            <button
              type="button"
              onClick={() => setGameFilter("ETS2")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                gameFilter === "ETS2"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
              }`}
            >
              <img
                src={ETS2_LOGO}
                alt="ETS2"
                className="h-3.5 w-auto object-contain"
              />
              ETS2 ({summary.ets2})
            </button>
            <button
              type="button"
              onClick={() => setGameFilter("ATS")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                gameFilter === "ATS"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
              }`}
            >
              <img
                src={ATS_LOGO}
                alt="ATS"
                className="h-3.5 w-auto object-contain"
              />
              ATS ({summary.ats})
            </button>

            <span className="hidden sm:inline-block text-border mx-1">|</span>

            {/* Vehicle Type Filter Pills */}
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1 flex items-center gap-1">
              <Truck size={13} /> Jenis:
            </span>
            <button
              type="button"
              onClick={() => setTypeFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                typeFilter === "ALL"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
              }`}
            >
              Semua Jenis
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("truck")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                typeFilter === "truck"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
              }`}
            >
              <Truck size={12} /> Truck ({summary.truck})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("bus")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                typeFilter === "bus"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
              }`}
            >
              <Bus size={12} /> Bus ({summary.bus})
            </button>
            {summary.car > 0 && (
              <button
                type="button"
                onClick={() => setTypeFilter("car")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                  typeFilter === "car"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
                }`}
              >
                <Car size={12} /> Car ({summary.car})
              </button>
            )}
          </div>

          {/* Maintenance / Usage Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1 flex items-center gap-1">
              <SlidersHorizontal size={13} /> Status:
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                statusFilter === "ALL"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
              }`}
            >
              Semua Status
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("NEEDS_ATTENTION")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                statusFilter === "NEEDS_ATTENTION"
                  ? "bg-red-500 text-white border-red-500 shadow-sm"
                  : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
              }`}
            >
              <AlertTriangle size={12} /> Perlu Servis ({summary.needsAttention})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("IN_SERVICE")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                statusFilter === "IN_SERVICE"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
              }`}
            >
              <Wrench size={12} /> Diservis ({summary.inService})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("HEALTHY")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                statusFilter === "HEALTHY"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
              }`}
            >
              <CheckCircle2 size={12} /> Prima ({summary.healthy})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("DRIVEN")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                statusFilter === "DRIVEN"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
              }`}
            >
              <CircleDot size={12} /> Digunakan ({summary.driven})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("PARKED")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                statusFilter === "PARKED"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
              }`}
            >
              <ParkingSquare size={12} /> Terparkir ({summary.total - summary.driven})
            </button>
          </div>
        </div>
      </div>

      {/* RESULTS COUNTER */}
      <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-1">
        <span>
          Menampilkan <strong className="text-foreground">{filteredFleets.length}</strong> dari{" "}
          <strong className="text-foreground">{fleets.length}</strong> kendaraan
        </span>
      </div>

      {/* FLEET GRID */}
      {filteredFleets.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredFleets.map((fleet) => {
            const isCritical = fleet.serviceState === "needs_replace";
            const isWarning = fleet.serviceState === "needs_maintenance";
            const isInService = fleet.serviceState === "in_service";

            return (
              <Link
                href={`/dashboard/garage/fleet/${fleet.id}`}
                key={fleet._id}
                className={`bg-card rounded-2xl overflow-hidden shadow-lg group transition-all duration-300 flex flex-col border ${
                  isCritical
                    ? "border-red-500/60 hover:border-red-500 shadow-red-500/5"
                    : isWarning
                      ? "border-amber-500/60 hover:border-amber-500 shadow-amber-500/5"
                      : isInService
                        ? "border-sky-500/50 hover:border-sky-500"
                        : "border-border/60 hover:border-primary/50"
                }`}
              >
                {/* IMAGE & BADGES HEADER */}
                <div className="aspect-video relative bg-background/50 flex items-center justify-center p-6 border-b border-border/50">
                  {fleet.imageUrl ? (
                    <img
                      src={fleet.imageUrl}
                      alt={fleet.displayName}
                      className="w-full h-full object-contain drop-shadow-2xl group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : fleet.vehicleType === "bus" ? (
                    <Bus size={64} className="text-muted-foreground/30" />
                  ) : fleet.vehicleType === "car" ? (
                    <Car size={64} className="text-muted-foreground/30" />
                  ) : (
                    <Truck size={64} className="text-muted-foreground/30" />
                  )}

                  {/* TOP-LEFT: GAME & VEHICLE TYPE BADGES */}
                  <div className="absolute top-4 left-4 flex flex-wrap items-center gap-1.5">
                    {renderGameBadge(fleet.game)}
                    {renderVehicleTypeBadge(fleet.vehicleType)}
                  </div>

                  {/* TOP-RIGHT: SERVICE STATUS & DRIVER USAGE BADGES */}
                  <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
                    {isInService ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/30 backdrop-blur-md">
                        <Clock size={12} className="animate-spin" />
                        {fleet.activeOrderStatus === "pending"
                          ? "Menunggu Konfirmasi Servis"
                          : fleet.activeOrderStatus === "waiting"
                            ? "Antrean Bengkel"
                            : "Sedang Diservis"}
                      </span>
                    ) : isCritical ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/40 backdrop-blur-md animate-pulse">
                        <ShieldAlert size={12} /> Wajib Ganti Part!
                      </span>
                    ) : isWarning ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/40 backdrop-blur-md">
                        <Wrench size={12} /> Perlu Servis
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 backdrop-blur-md">
                        <CheckCircle2 size={12} /> Kondisi Prima
                      </span>
                    )}

                    {fleet.isCurrentlyDriven ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/10 backdrop-blur-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        Aktif Digunakan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-background/70 text-foreground/60 border border-border/60 backdrop-blur-md">
                        Terparkir
                      </span>
                    )}
                  </div>

                  {/* BOTTOM-LEFT: BRAND LOGO */}
                  {fleet.brandLogo && (
                    <div className="absolute bottom-4 left-4 p-2 bg-background/80 backdrop-blur-sm rounded-lg border border-border/50 flex items-center gap-2">
                      <img
                        src={fleet.brandLogo}
                        alt={fleet.brandName}
                        className="h-5 w-auto object-contain"
                      />
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground hidden sm:inline">
                        {fleet.brandName}
                      </span>
                    </div>
                  )}

                  {/* BOTTOM-RIGHT: CHASSIS / WHEELS */}
                  {fleet.wheels && (
                    <div className="absolute bottom-4 right-4 px-2.5 py-1 bg-background/80 backdrop-blur-sm rounded-lg border border-border/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {fleet.wheels}
                    </div>
                  )}
                </div>

                {/* CARD BODY */}
                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <div>
                        <h2 className="text-xl font-black uppercase tracking-wider text-foreground group-hover:text-primary transition-colors">
                          {fleet.displayName}
                        </h2>
                        {fleet.customName && (
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            {fleet.brandName} {fleet.modelName}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-black text-primary opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0">
                        KELOLA &rarr;
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-medium mt-2">
                      <span>
                        Plat:{" "}
                        <strong className="text-foreground font-mono">
                          {fleet.fleetNumber}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        ID:{" "}
                        <strong className="text-foreground font-mono">
                          {fleet.id}
                        </strong>
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Gauge size={13} className="text-primary" />
                        <strong className="text-foreground tabular-nums">
                          {fleet.odometer.toLocaleString("id-ID")} km
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* COMPONENT HEALTH MINI-GRID */}
                  <div className="pt-3 border-t border-border/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Wrench size={12} className="text-primary" /> Status Komponen
                      </span>
                      {(isCritical || isWarning) && fleet.estimatedServiceCost > 0 && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                          Est. Biaya Servis: ~{fleet.estimatedServiceCost.toLocaleString("id-ID")} NC
                        </span>
                      )}
                      {isInService && fleet.maintenanceEndAt && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                          Selesai: {new Date(fleet.maintenanceEndAt).toLocaleDateString("id-ID")}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {fleet.components.map((comp) => (
                        <div
                          key={comp.key}
                          className={`p-2 rounded-xl border text-left ${
                            comp.needsReplace
                              ? "bg-red-500/10 border-red-500/30"
                              : comp.needsMaintenance
                                ? "bg-amber-500/10 border-amber-500/30"
                                : "bg-background/60 border-border/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-foreground truncate">
                              {comp.label}
                            </span>
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                comp.needsReplace
                                  ? "bg-red-500/20 text-red-400"
                                  : comp.needsMaintenance
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-emerald-500/15 text-emerald-400"
                              }`}
                            >
                              {comp.needsReplace
                                ? "Ganti!"
                                : comp.needsMaintenance
                                  ? "Servis"
                                  : "OK"}
                            </span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                comp.needsReplace
                                  ? "bg-red-500"
                                  : comp.needsMaintenance
                                    ? "bg-amber-500"
                                    : comp.kmPct >= 85
                                      ? "bg-amber-400"
                                      : "bg-emerald-500"
                              }`}
                              style={{
                                width: `${
                                  comp.needsReplace ? 100 : Math.min(comp.kmPct, 100)
                                }%`,
                              }}
                            />
                          </div>
                          <div className="flex justify-between items-center mt-1 text-[9px] font-bold text-muted-foreground tabular-nums">
                            <span>Km: {comp.kmPct}%</span>
                            <span>Wear: {comp.wearPct}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="bg-card/50 border border-border border-dashed rounded-3xl p-10 text-center flex flex-col items-center justify-center min-h-[280px]">
          <Search size={36} className="text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-black uppercase tracking-wider mb-1">
            Tidak Ada Kendaraan yang Cocok
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mb-5">
            Tidak ditemukan kendaraan dengan filter atau kata kunci pencarian saat ini.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all"
          >
            Reset Semua Filter
          </button>
        </div>
      )}
    </div>
  );
}
