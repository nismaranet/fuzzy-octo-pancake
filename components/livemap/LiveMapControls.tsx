"use client";

import {
  Building2,
  Bus,
  Compass,
  Globe,
  Layers,
  MapPin,
  RotateCcw,
  Truck,
  Users,
} from "lucide-react";
import type { LiveMapDefinition } from "@/lib/liveMapCatalog";
import type { CategoryFilter, ServerFilter } from "./types";

interface LiveMapControlsProps {
  maps: LiveMapDefinition[];
  activeMap: LiveMapDefinition;
  mapDriverCounts: Record<string, number>;
  serverFilter: ServerFilter;
  categoryFilter: CategoryFilter;
  showCities: boolean;
  drawerOpen: boolean;
  totalVisibleDrivers: number;
  tileStatus: "loading" | "r2-tiles" | "tactical-grid";
  onSelectMap: (mapId: string) => void;
  onServerFilterChange: (filter: ServerFilter) => void;
  onCategoryFilterChange: (filter: CategoryFilter) => void;
  onToggleCities: () => void;
  onResetView: () => void;
  onFlyToHq?: () => void;
  hasHq?: boolean;
  onToggleDrawer: () => void;
}

const SERVER_FILTER_OPTIONS: { id: ServerFilter; label: string; dot?: string }[] = [
  { id: "all", label: "Semua Server" },
  { id: "truckersmp", label: "TruckersMP", dot: "bg-orange-400" },
  { id: "haulmp", label: "HaulMP", dot: "bg-cyan-400" },
  { id: "convoy", label: "Convoy", dot: "bg-violet-400" },
  { id: "singleplayer", label: "Singleplayer", dot: "bg-emerald-400" },
];

export default function LiveMapControls({
  maps,
  activeMap,
  mapDriverCounts,
  serverFilter,
  categoryFilter,
  showCities,
  drawerOpen,
  totalVisibleDrivers,
  tileStatus,
  onSelectMap,
  onServerFilterChange,
  onCategoryFilterChange,
  onToggleCities,
  onResetView,
  onFlyToHq,
  hasHq,
  onToggleDrawer,
}: LiveMapControlsProps) {
  return (
    <div className="pointer-events-none absolute top-3 left-3 right-3 z-[450] flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
      {/* Left Cluster: Map Switcher + Server/Vehicle Filters */}
      <div className="pointer-events-auto flex flex-col gap-2 max-w-full">
        {/* Top row: Game / Map Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-zinc-950/85 p-1.5 backdrop-blur-xl shadow-2xl w-fit">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-zinc-400">
            <Compass className="h-3.5 w-3.5 text-sky-400" />
            <span>Live Map</span>
          </div>
          <div className="hidden md:block h-5 w-px bg-white/10" />

          {maps.map((m) => {
            const isActive = m.id === activeMap.id;
            const count = mapDriverCounts[m.id] || 0;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMap(m.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "text-zinc-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>{m.shortName}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none ${
                    isActive
                      ? "bg-black/25 text-white"
                      : count > 0
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-white/10 text-zinc-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <span
            title="Mod Maps (ProMods, Map Indonesia, dll.) akan ditambahkan pada tahap berikutnya"
            className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-dashed border-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-500 cursor-default"
          >
            <Layers className="h-3 w-3" />
            <span>Mod Maps Soon</span>
          </span>
        </div>

        {/* Second row: Server & Vehicle Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-zinc-950/80 p-1 backdrop-blur-xl shadow-lg max-w-full">
            {SERVER_FILTER_OPTIONS.map((opt) => {
              const active = serverFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onServerFilterChange(opt.id)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-white/15 text-white shadow-xs"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  {opt.dot && <span className={`h-1.5 w-1.5 rounded-full ${opt.dot}`} />}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-950/80 p-1 backdrop-blur-xl shadow-lg">
            {(
              [
                { id: "all", label: "Semua", icon: Globe },
                { id: "truck", label: "Truck", icon: Truck },
                { id: "coach", label: "Coach", icon: Bus },
              ] as const
            ).map((cat) => {
              const Icon = cat.icon;
              const active = categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onCategoryFilterChange(cat.id)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-white/15 text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Cluster: Map Utilities + Driver List Drawer Button */}
      <div className="pointer-events-auto flex items-center gap-2 self-end sm:self-start">
        {tileStatus === "tactical-grid" && (
          <div className="hidden lg:flex items-center gap-1.5 rounded-xl border border-sky-400/30 bg-zinc-950/85 px-3 py-2 text-[11px] font-medium text-sky-200 backdrop-blur-xl shadow-lg">
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            <span>Mode Radar Grid (Menunggu Tile R2)</span>
          </div>
        )}

        {hasHq && onFlyToHq && (
          <button
            type="button"
            onClick={onFlyToHq}
            title="Terbang ke Nismara HQ"
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/45 bg-zinc-950/85 px-3 py-2 text-xs font-bold text-violet-300 backdrop-blur-xl shadow-lg hover:bg-violet-500/20 hover:text-white transition-all cursor-pointer"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">HQ</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleCities}
          title="Tampilkan / Sembunyikan Nama Kota"
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold backdrop-blur-xl shadow-lg transition-all cursor-pointer ${
            showCities
              ? "border-sky-400/40 bg-zinc-950/85 text-sky-300"
              : "border-white/10 bg-zinc-950/80 text-zinc-400 hover:text-white"
          }`}
        >
          <MapPin className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Kota</span>
        </button>

        <button
          type="button"
          onClick={onResetView}
          title="Reset Posisi Kamera Peta"
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-xs font-bold text-zinc-300 backdrop-blur-xl shadow-lg hover:bg-zinc-900 hover:text-white transition-all cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>

        <button
          type="button"
          onClick={onToggleDrawer}
          className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold backdrop-blur-xl shadow-lg transition-all cursor-pointer ${
            drawerOpen
              ? "border-primary/50 bg-primary/20 text-white"
              : "border-white/10 bg-zinc-950/85 text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <Users className="h-3.5 w-3.5 text-emerald-400" />
          <span>Driver</span>
          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-black text-emerald-300">
            {totalVisibleDrivers}
          </span>
        </button>
      </div>
    </div>
  );
}
