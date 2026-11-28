"use client";

import { useMemo, useState } from "react";
import { Bus, MapPin, Radio, Search, Truck, X } from "lucide-react";
import { getServerAccent, type LiveDriverPacket } from "./types";

interface DriverListDrawerProps {
  open: boolean;
  drivers: LiveDriverPacket[];
  selectedDriverId: string | null;
  followDriverId: string | null;
  lastUpdatedAt: string | null;
  isPollingPaused: boolean;
  mapName: string;
  onSelectAndFly: (discordId: string) => void;
  onClose: () => void;
}

export default function DriverListDrawer({
  open,
  drivers,
  selectedDriverId,
  followDriverId,
  lastUpdatedAt,
  isPollingPaused,
  mapName,
  onSelectAndFly,
  onClose,
}: DriverListDrawerProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...drivers].sort((a, b) => (b.speed || 0) - (a.speed || 0));
    if (!q) return sorted;
    return sorted.filter((d) => {
      return (
        (d.driverName || "").toLowerCase().includes(q) ||
        (d.fleetNumber || "").toLowerCase().includes(q) ||
        (d.nearestCity || "").toLowerCase().includes(q) ||
        (d.serverType || "").toLowerCase().includes(q) ||
        (d.jobSummary?.sourceCity || "").toLowerCase().includes(q) ||
        (d.jobSummary?.destinationCity || "").toLowerCase().includes(q) ||
        (d.jobSummary?.cargoName || "").toLowerCase().includes(q)
      );
    });
  }, [drivers, query]);

  if (!open) return null;

  return (
    <aside className="absolute top-[116px] sm:top-[68px] right-3 bottom-3 sm:bottom-12 z-[460] w-[calc(100vw-1.5rem)] max-w-[330px] flex flex-col rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full ${
                  isPollingPaused
                    ? "bg-amber-400"
                    : "animate-ping bg-emerald-400 opacity-75"
                }`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  isPollingPaused ? "bg-amber-400" : "bg-emerald-400"
                }`}
              />
            </span>
            <h2 className="text-xs font-black uppercase tracking-wider text-white truncate">
              Driver Aktif ({drivers.length})
            </h2>
          </div>
          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
            {mapName}
            {lastUpdatedAt ? ` • Sync ${lastUpdatedAt}` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          aria-label="Tutup daftar driver"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="border-b border-white/10 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari driver, lambung, kota..."
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-sky-400/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Driver List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 px-4">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400">
              <Radio className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold text-zinc-200">
              {drivers.length === 0
                ? "Belum ada driver online"
                : "Driver tidak ditemukan"}
            </p>
            <p className="mt-1 text-[11px] text-zinc-400 leading-relaxed">
              {drivers.length === 0
                ? "Buka ETS2 atau ATS dengan Nismara Companion aktif untuk langsung muncul di peta real-time."
                : "Coba ubah kata kunci pencarian atau filter server."}
            </p>
          </div>
        ) : (
          filtered.map((driver) => {
            const accent = getServerAccent(driver.serverType, driver.isPaused);
            const isSelected = selectedDriverId === driver.discordId;
            const isFollowed = followDriverId === driver.discordId;
            const isCoach = driver.jobCategory === "coach";
            const speedInt = Math.max(0, Math.round(driver.speed || 0));

            return (
              <button
                key={driver.discordId}
                type="button"
                onClick={() => onSelectAndFly(driver.discordId)}
                className={`w-full text-left rounded-xl border p-2.5 transition-all cursor-pointer ${
                  isSelected
                    ? "border-sky-400/60 bg-sky-500/10 shadow-lg"
                    : "border-white/8 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.07]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative h-9 w-9 shrink-0">
                    {driver.avatar ? (
                      <img
                        src={driver.avatar}
                        alt={driver.driverName}
                        className="h-9 w-9 rounded-full object-cover border border-white/15"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-zinc-800 border border-white/15 flex items-center justify-center text-xs font-black text-zinc-200">
                        {(driver.driverName || "D").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950"
                      style={{ backgroundColor: accent.hex }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <p className="text-xs font-bold text-white truncate">
                        {driver.driverName}
                      </p>
                      <span
                        className="shrink-0 font-mono text-[11px] font-black"
                        style={{ color: accent.hex }}
                      >
                        {driver.isPaused ? "PAUSED" : `${speedInt} km/h`}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                      {driver.fleetNumber && (
                        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono font-bold text-zinc-200">
                          {driver.fleetNumber}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-semibold ${accent.badgeClass}`}
                      >
                        {isCoach ? (
                          <Bus className="h-2.5 w-2.5" />
                        ) : (
                          <Truck className="h-2.5 w-2.5" />
                        )}
                        {accent.label}
                      </span>
                      {isFollowed && (
                        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-bold text-sky-300">
                          FOLLOW
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-400 truncate">
                      <MapPin className="h-3 w-3 shrink-0 text-zinc-500" />
                      <span className="truncate">
                        {driver.jobSummary?.sourceCity &&
                        driver.jobSummary?.destinationCity
                          ? `${driver.jobSummary.sourceCity} → ${driver.jobSummary.destinationCity}`
                          : driver.locationLabel || driver.nearestCity || driver.game}
                      </span>
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
