"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bus,
  Check,
  Crosshair,
  ExternalLink,
  Gauge,
  MapPin,
  Package,
  Share2,
  Truck,
  X,
} from "lucide-react";
import {
  formatGearLabel,
  getServerAccent,
  type LiveDriverPacket,
} from "./types";

interface DriverTelemetryCardProps {
  driver: LiveDriverPacket | null;
  isFollowed: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
}

export default function DriverTelemetryCard({
  driver,
  isFollowed,
  onToggleFollow,
  onClose,
}: DriverTelemetryCardProps) {
  const [copied, setCopied] = useState(false);

  if (!driver) return null;

  const accent = getServerAccent(driver.serverType, driver.isPaused);
  const isCoach = driver.jobCategory === "coach";
  const speedInt = Math.max(0, Math.round(driver.speed || 0));

  const planned = driver.jobSummary?.plannedDistanceKm || 0;
  const remaining = driver.jobSummary?.remainingDistanceKm || 0;
  const progressPct =
    planned > 0
      ? Math.max(0, Math.min(100, Math.round(((planned - remaining) / planned) * 100)))
      : null;

  const handleShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-[460] w-[calc(100vw-1.5rem)] max-w-[380px] rounded-2xl border border-white/12 bg-zinc-950/92 p-4 text-white backdrop-blur-xl shadow-2xl">
      {/* Header: Avatar + Identity */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative h-11 w-11 shrink-0">
            {driver.avatar ? (
              <img
                src={driver.avatar}
                alt={driver.driverName}
                className="h-11 w-11 rounded-full object-cover border-2"
                style={{ borderColor: accent.hex }}
              />
            ) : (
              <div
                className="h-11 w-11 rounded-full bg-zinc-800 border-2 flex items-center justify-center text-sm font-black text-white"
                style={{ borderColor: accent.hex }}
              >
                {(driver.driverName || "D").slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white truncate">
                {driver.driverName}
              </h3>
              {driver.fleetNumber && (
                <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-black text-zinc-200">
                  {driver.fleetNumber}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white"
                style={{ borderColor: `${driver.truckyRankColor || "#8e24aa"}bb` }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: driver.truckyRankColor || "#8e24aa" }}
                />
                {driver.truckyRank || "Driver"}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${accent.badgeClass}`}
              >
                {accent.label}
                {driver.serverName ? ` • ${driver.serverName}` : ""}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          aria-label="Tutup kartu telemetri"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Live Metrics Grid */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/8 bg-white/[0.04] px-2.5 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
            <Gauge className="h-3 w-3 text-sky-400" /> Speed
          </p>
          <p className="mt-0.5 font-mono text-base font-black text-white">
            {driver.isPaused ? "PAUSED" : `${speedInt}`}
            {!driver.isPaused && (
              <span className="ml-1 text-[10px] font-semibold text-zinc-400">km/h</span>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.04] px-2.5 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Gigi
          </p>
          <p className="mt-0.5 font-mono text-base font-black text-white">
            {formatGearLabel(driver.gear)}
          </p>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.04] px-2.5 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Divisi
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-white pt-1">
            {isCoach ? (
              <>
                <Bus className="h-3.5 w-3.5 text-amber-400" />
                <span>Coach</span>
              </>
            ) : (
              <>
                <Truck className="h-3.5 w-3.5 text-sky-400" />
                <span>Truck</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Current Location */}
      <div className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-sky-400" />
        <span className="truncate">
          {driver.locationLabel || driver.nearestCity || driver.game}
        </span>
      </div>

      {/* Active Job Info */}
      {driver.jobSummary &&
        (driver.jobSummary.sourceCity || driver.jobSummary.cargoName) && (
          <div className="mt-2.5 rounded-xl border border-violet-400/25 bg-violet-500/10 p-3">
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-white">
              <span className="truncate">
                {driver.jobSummary.sourceCity || "?"} →{" "}
                {driver.jobSummary.destinationCity || "?"}
              </span>
              {remaining > 0 && (
                <span className="shrink-0 font-mono text-[11px] text-violet-200">
                  Sisa {remaining.toLocaleString("id-ID")} km
                </span>
              )}
            </div>
            {driver.jobSummary.cargoName && (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-violet-200/85 truncate">
                <Package className="h-3 w-3 shrink-0" />
                <span className="truncate">{driver.jobSummary.cargoName}</span>
              </p>
            )}
            {progressPct !== null && (
              <div className="mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-400 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

      {/* Action Buttons */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleFollow}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
            isFollowed
              ? "bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/30"
              : "border border-white/15 bg-white/8 text-white hover:bg-white/15"
          }`}
        >
          <Crosshair className="h-3.5 w-3.5" />
          <span>{isFollowed ? "Mengikuti Kamera" : "Follow Kamera"}</span>
        </button>

        <button
          type="button"
          onClick={handleShareLink}
          title="Salin link lokasi driver"
          className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-white/15 hover:text-white transition-all cursor-pointer"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
        </button>

        {driver.truckyId && (
          <Link
            href={`/profile/${driver.truckyId}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/20 px-3 py-2 text-xs font-bold text-white hover:bg-primary/35 transition-all"
          >
            <span>Profil</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
