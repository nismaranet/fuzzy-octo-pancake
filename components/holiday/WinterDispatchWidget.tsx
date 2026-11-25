"use client";

import React, { useEffect, useState, useRef } from "react";
import { X, Gift, Volume2, VolumeX } from "lucide-react";
import type { SantaStatus } from "./FlyingSantaSleigh";

interface JakartaClock {
  year: number;
  month: number;
  day: number;
  targetYear: number;
  isChristmasWindow: boolean;
  isNewYearWeek: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  msRemaining: number;
}

function getJakartaParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === "year")?.value || now.getUTCFullYear());
  const month = Number(parts.find((p) => p.type === "month")?.value || 1);
  const day = Number(parts.find((p) => p.type === "day")?.value || 1);
  return { year, month, day };
}

function computeJakartaClock(): JakartaClock {
  const now = new Date();
  const { year, month, day } = getJakartaParts(now);
  const isChristmasWindow = month === 12 && day >= 24 && day <= 26;
  const isNewYearWeek = month === 1 && day <= 7;

  const targetYear = year + 1;
  const targetUtcMs = Date.UTC(targetYear, 0, 1, -7, 0, 0);
  const diff = Math.max(0, targetUtcMs - now.getTime());

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    year,
    month,
    day,
    targetYear,
    isChristmasWindow,
    isNewYearWeek,
    days,
    hours,
    minutes,
    seconds,
    msRemaining: diff,
  };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function NordicStarMark({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function WinterDispatchWidget({
  snowEnabled,
  onToggleSnow,
  soundEnabled,
  onToggleSound,
  fireworksRunning,
  onTriggerFireworks,
  santaStatus,
  onSummonSanta,
}: {
  snowEnabled: boolean;
  onToggleSnow: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  fireworksRunning: boolean;
  onTriggerFireworks: () => void;
  santaStatus: SantaStatus;
  onSummonSanta: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [clock, setClock] = useState<JakartaClock | null>(null);
  const celebratedRef = useRef(false);

  useEffect(() => {
    setClock(computeJakartaClock());
    const id = window.setInterval(() => {
      const next = computeJakartaClock();
      setClock(next);
      if (next.msRemaining === 0 && !celebratedRef.current) {
        celebratedRef.current = true;
        onTriggerFireworks();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [onTriggerFireworks]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  if (!clock) return null;

  const heading = clock.isNewYearWeek
    ? `Selamat Tahun Baru ${clock.year}`
    : clock.isChristmasWindow
      ? "Selamat Hari Natal"
      : `Menyambut Natal & Tahun Baru ${clock.targetYear}`;

  const bodyCopy = clock.isNewYearWeek
    ? "Semoga perjalanan tahun ini membawa rute yang lancar, aman, dan penuh kebersamaan bagi seluruh keluarga besar Nismara Transport."
    : clock.isChristmasWindow
      ? "Damai dan hangatnya Natal menyertai seluruh driver Nismara Transport. Jaga keselamatan berkendara dan nikmati waktu bersama keluarga."
      : "Terima kasih telah menempuh perjalanan sepanjang tahun bersama Nismara Transport. Tetap utamakan keselamatan di setiap rute menjelang akhir tahun.";

  const compactLabel = clock.isNewYearWeek
    ? `Tahun Baru ${clock.year}`
    : `${clock.days}h ${pad2(clock.hours)}:${pad2(clock.minutes)}:${pad2(clock.seconds)}`;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 flex flex-col items-end gap-2.5">
      {open && (
        <div
          role="dialog"
          aria-label="Kartu Ucapan Natal dan Tahun Baru Nismara Transport"
          className="w-[calc(100vw-2rem)] sm:w-[356px] max-w-[356px] rounded-xl border border-border bg-card text-card-foreground shadow-xl overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="h-[2px] w-full bg-gradient-to-r from-[#1E4D3F] via-[#D9B26F] to-[#B83B47]"
          />

          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8A5D18] dark:text-[#E2BF7D]">
                  <NordicStarMark className="w-3.5 h-3.5 shrink-0" />
                  <span>Edisi Akhir Tahun Nismara</span>
                </p>
                <h2 className="text-base font-semibold tracking-tight text-foreground leading-snug">
                  {heading}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup kartu edisi akhir tahun"
                className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {bodyCopy}
            </p>

            {!clock.isNewYearWeek && (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: String(clock.days), label: "Hari" },
                    { value: pad2(clock.hours), label: "Jam" },
                    { value: pad2(clock.minutes), label: "Menit" },
                    { value: pad2(clock.seconds), label: "Detik" },
                  ].map((unit) => (
                    <div
                      key={unit.label}
                      className="rounded-lg border border-border bg-muted/50 py-2 px-1 text-center"
                    >
                      <div className="text-lg font-semibold font-mono tabular-nums text-foreground leading-tight">
                        {unit.value}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {unit.label}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Menuju 1 Januari {clock.targetYear}, 00:00 WIB
                </p>
              </div>
            )}

            {/* Primary celebration action */}
            <button
              type="button"
              onClick={onTriggerFireworks}
              disabled={fireworksRunning}
              className="w-full min-h-[44px] rounded-lg bg-[#1E4D3F] hover:bg-[#173D32] text-[#F8FAFC] border border-[#D9B26F]/40 px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              {fireworksRunning ? "Kembang api sedang menyala..." : "Nyalakan kembang api"}
            </button>

            {/* Daily Santa Gift status for drivers */}
            {santaStatus.loaded && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 text-[#8A5D18] dark:text-[#E2BF7D] shrink-0" aria-hidden="true" />
                    <span>Hadiah Harian Santa</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {!santaStatus.inClaimWindow
                      ? "Dibuka 20 Des - 2 Jan (WIB)."
                      : !santaStatus.isDriver
                        ? "Khusus driver resmi Nismara."
                        : santaStatus.claimedToday
                          ? santaStatus.lastRewardLabel
                            ? `Sudah diklaim: ${santaStatus.lastRewardLabel}`
                            : "Sudah diklaim hari ini."
                          : "Klik kereta Santa yang melintas di layar."}
                  </p>
                </div>

                {santaStatus.eligible && (
                  <button
                    type="button"
                    onClick={() => {
                      onSummonSanta();
                      setOpen(false);
                    }}
                    className="shrink-0 min-h-[36px] rounded-md border border-[#D9B26F]/50 bg-card hover:bg-accent px-3 py-1.5 text-xs font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                  >
                    Panggil Santa
                  </button>
                )}
              </div>
            )}

            {/* Driver comfort controls */}
            <div className="pt-3 border-t border-border space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="holiday-snow-toggle"
                  className="text-sm text-foreground cursor-pointer select-none"
                >
                  Efek salju di layar
                </label>

                <button
                  id="holiday-snow-toggle"
                  type="button"
                  role="switch"
                  aria-checked={snowEnabled}
                  onClick={onToggleSnow}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
                    snowEnabled ? "bg-[#1E4D3F]" : "bg-muted"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      snowEnabled ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="holiday-sound-toggle"
                  className="text-sm text-foreground cursor-pointer select-none inline-flex items-center gap-1.5"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span>Suara kembang api</span>
                </label>

                <button
                  id="holiday-sound-toggle"
                  type="button"
                  role="switch"
                  aria-checked={soundEnabled}
                  onClick={onToggleSound}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
                    soundEnabled ? "bg-[#1E4D3F]" : "bg-muted"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      soundEnabled ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compact trigger button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Buka informasi Natal dan hitung mundur Tahun Baru"
        className="inline-flex items-center gap-2.5 min-h-[44px] rounded-lg border border-border bg-card hover:bg-accent text-card-foreground shadow-md px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      >
        <NordicStarMark className="w-4 h-4 shrink-0 text-[#8A5D18] dark:text-[#D9B26F]" />
        <span className="font-mono tabular-nums text-xs sm:text-sm text-foreground">
          {compactLabel}
        </span>
        {santaStatus.eligible ? (
          <span className="hidden sm:inline text-xs font-medium text-[#8A5D18] dark:text-[#E2BF7D]">
            Kado Santa
          </span>
        ) : (
          <span className="hidden sm:inline text-xs text-muted-foreground">
            {clock.isNewYearWeek ? "WIB" : `ke ${clock.targetYear}`}
          </span>
        )}
      </button>
    </div>
  );
}
