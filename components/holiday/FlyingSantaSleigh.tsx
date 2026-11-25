"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Loader2, Gift, CheckCircle2, AlertCircle } from "lucide-react";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { playSantaChimeSound, unlockHolidayAudio } from "@/lib/holidaySound";

export interface SantaStatus {
  loaded: boolean;
  active: boolean;
  inClaimWindow: boolean;
  isLoggedIn: boolean;
  isDriver: boolean;
  eligible: boolean;
  claimedToday: boolean;
  todayWib?: string;
  lastRewardLabel?: string | null;
}

interface ClaimedReward {
  id: string;
  tier: "common" | "uncommon" | "rare" | "epic" | "jackpot";
  kind: "NC" | "FUEL" | "VOUCHER";
  label: string;
  detail: string;
  amount: number | null;
  voucherCode: string | null;
  destinationHref: string;
  destinationLabel: string;
}

const TIER_META: Record<
  ClaimedReward["tier"],
  { label: string; badgeClass: string }
> = {
  common: {
    label: "Hadiah Harian",
    badgeClass: "bg-muted text-foreground border-border",
  },
  uncommon: {
    label: "Hadiah Spesial",
    badgeClass: "bg-[#1E4D3F]/15 text-[#1B4D3E] dark:text-[#6EE7B7] border-[#1E4D3F]/35",
  },
  rare: {
    label: "Hadiah Langka",
    badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/35",
  },
  epic: {
    label: "Hadiah Epik",
    badgeClass: "bg-[#D9A94F]/20 text-[#8A5D18] dark:text-[#F5D99B] border-[#D9A94F]/45",
  },
  jackpot: {
    label: "Jackpot Langka",
    badgeClass: "bg-[#B83B47]/15 text-[#9E2A35] dark:text-[#FDA4AF] border-[#B83B47]/45",
  },
};

function SantaSleighArtwork() {
  return (
    <svg
      width="206"
      height="66"
      viewBox="0 0 206 66"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
    >
      {/* Trailing golden stardust behind sleigh */}
      <circle cx="8" cy="40" r="2.2" fill="#F5D99B" fillOpacity="0.85" />
      <circle cx="17" cy="46" r="1.5" fill="#E6C27A" fillOpacity="0.65" />
      <circle cx="24" cy="37" r="1.8" fill="#FFF7DF" fillOpacity="0.75" />
      <path d="M14 31L15 33.8L17.8 34.8L15 35.8L14 38.6L13 35.8L10.2 34.8L13 33.8Z" fill="#F5D99B" />

      {/* Golden runners (skis) */}
      <path
        d="M32 54 H78 C85 54 88 49 86 44"
        stroke="#E2B660"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M44 54 L46 47 M68 54 L67 47" stroke="#C89F59" strokeWidth="2" strokeLinecap="round" />

      {/* Gift sack overflowing behind Santa */}
      <path
        d="M35 37 C32 28 38 22 46 24 C51 25 53 31 52 38 Z"
        fill="#8A5D18"
        stroke="#D9B26F"
        strokeWidth="1.2"
      />
      <rect x="38" y="21" width="7" height="6" rx="1" fill="#1E4D3F" stroke="#E2B660" strokeWidth="0.9" />
      <rect x="44" y="19" width="6" height="6" rx="1" fill="#B83B47" stroke="#F5D99B" strokeWidth="0.9" />

      {/* Santa torso, beard, and crimson cap */}
      <path d="M51 39 C51 30 57 26 63 28 C67 29 68 34 67 40 Z" fill="#B83B47" />
      <circle cx="60" cy="22.5" r="4.3" fill="#F6D5B8" />
      {/* Beard */}
      <path d="M57 24.5 C58 29 64 29 65 24.5 C63 26 59 26 57 24.5 Z" fill="#F8FAFC" />
      {/* Santa hat */}
      <path d="M55.5 20.5 C57 14 63 14.5 64.5 20.5 Z" fill="#B83B47" />
      <path d="M55 20.5 H65" stroke="#F8FAFC" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="54.5" cy="16.5" r="2.1" fill="#F8FAFC" />

      {/* Sleigh crimson hull with champagne gold trim */}
      <path
        d="M32 36 C32 45 40 48 52 48 H74 C80 48 84 42 82 35 C78 39 73 40 67 39 H44 C38 39 35 37 32 36 Z"
        fill="#9E2A35"
        stroke="#E6C27A"
        strokeWidth="1.5"
      />
      <path d="M39 43 H75" stroke="#E6C27A" strokeWidth="1.1" strokeOpacity="0.8" />

      {/* Golden harness reins from Santa to reindeer */}
      <path d="M67 31 Q104 36 135 28" stroke="#E2B660" strokeWidth="1.15" strokeOpacity="0.85" />
      <path d="M67 33 Q125 40 179 25" stroke="#E2B660" strokeWidth="1.15" strokeOpacity="0.85" />

      {/* Reindeer 1 (Back) */}
      <g transform="translate(106, 20)">
        <path
          d="M6 19 C11 15 21 15 27 17 C30 14 31 10 34 9 C36 8.5 39 10 38 12 C37 13.5 34 14 32 15 C31 19 29 22 26 23 L32 31 M25 22 L21 31 M11 21 L6 30 M13 21 L16 30"
          stroke="#9B6E43"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <ellipse cx="18" cy="19" rx="10" ry="4.6" fill="#8C6038" />
        <circle cx="35" cy="10.5" r="3" fill="#8C6038" />
        {/* Antlers */}
        <path d="M33 8 L30 2 M32 5 L28 4 M34 8 L35 2" stroke="#E2B660" strokeWidth="1.2" strokeLinecap="round" />
        {/* Crimson collar */}
        <path d="M29 14 L33 16" stroke="#C64351" strokeWidth="2.2" strokeLinecap="round" />
      </g>

      {/* Reindeer 2 (Lead Rudolph with glowing crimson nose) */}
      <g transform="translate(152, 16)">
        <path
          d="M6 19 C11 15 21 15 27 17 C30 14 31 10 34 9 C36 8.5 39 10 38 12 C37 13.5 34 14 32 15 C31 19 29 22 26 23 L33 30 M25 22 L21 31 M11 21 L5 29 M13 21 L17 30"
          stroke="#AD7D4F"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <ellipse cx="18" cy="19" rx="10" ry="4.6" fill="#9D6F43" />
        <circle cx="35" cy="10.5" r="3.1" fill="#9D6F43" />
        {/* Antlers */}
        <path d="M33 8 L30 2 M32 5 L28 4 M34 8 L36 2" stroke="#F5D99B" strokeWidth="1.2" strokeLinecap="round" />
        {/* Collar */}
        <path d="M29 14 L33 16" stroke="#C64351" strokeWidth="2.2" strokeLinecap="round" />
        {/* Lead reindeer crimson nose glow */}
        <circle cx="39" cy="11.5" r="4.2" fill="#E05263" fillOpacity="0.35" />
        <circle cx="39" cy="11.5" r="1.9" fill="#F43F5E" />
      </g>
    </svg>
  );
}

export default function FlyingSantaSleigh({
  status,
  summonSignal,
  soundEnabled,
  onStatusChange,
  onTriggerFireworks,
}: {
  status: SantaStatus;
  summonSignal: number;
  soundEnabled: boolean;
  onStatusChange: (next: Partial<SantaStatus>) => void;
  onTriggerFireworks: () => void;
}) {
  const router = useRouter();
  const [flying, setFlying] = useState(false);
  const [direction, setDirection] = useState<"ltr" | "rtl">("ltr");
  const [topPct, setTopPct] = useState(18);
  const [posX, setPosX] = useState(-240);
  const [bobY, setBobY] = useState(0);
  const hoveredRef = useRef(false);
  const flyingRef = useRef(false);
  flyingRef.current = flying;

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimedReward, setClaimedReward] = useState<ClaimedReward | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<{
    title: string;
    body: string;
    ctaHref?: string;
    ctaLabel?: string;
  } | null>(null);

  const startFlight = useCallback((forceLtr = false) => {
    const dir: "ltr" | "rtl" = forceLtr ? "ltr" : Math.random() > 0.5 ? "ltr" : "rtl";
    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    setDirection(dir);
    setTopPct(15 + Math.floor(Math.random() * 14)); // 15% - 28% from top
    setPosX(dir === "ltr" ? -230 : w + 40);
    setFlying(true);
  }, []);

  // Initial pass & periodic schedule
  useEffect(() => {
    const firstTimer = window.setTimeout(() => {
      startFlight(true);
    }, 3200);

    const interval = window.setInterval(() => {
      if (!flyingRef.current) {
        startFlight(false);
      }
    }, 30000);

    return () => {
      window.clearTimeout(firstTimer);
      window.clearInterval(interval);
    };
  }, [startFlight]);

  // Manual summon from WinterDispatchWidget
  useEffect(() => {
    if (summonSignal > 0) {
      startFlight(true);
    }
  }, [summonSignal, startFlight]);

  // Smooth RAF flight loop (pauses glide on hover/focus so drivers can easily click!)
  useEffect(() => {
    if (!flying) return;

    let animId = 0;
    let x = posX;
    let tick = 0;
    const speed = typeof window !== "undefined" && window.innerWidth < 640 ? 1.55 : 2.1;

    const step = () => {
      const w = window.innerWidth;
      if (!hoveredRef.current) {
        tick += 1;
        x += direction === "ltr" ? speed : -speed;
        setPosX(x);
        setBobY(Math.sin(tick * 0.055) * 8);

        if ((direction === "ltr" && x > w + 60) || (direction === "rtl" && x < -260)) {
          setFlying(false);
          return;
        }
      }
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flying, direction]);

  // Close modal on Escape
  useEffect(() => {
    if (!modalOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [modalOpen]);

  const handleCatchSanta = async () => {
    unlockHolidayAudio();
    if (soundEnabled) {
      playSantaChimeSound(0.2);
    }

    setModalOpen(true);
    setModalError(null);
    setClaimedReward(null);
    setInfoMessage(null);

    if (!status.isLoggedIn) {
      setInfoMessage({
        title: "Hadiah Harian Santa",
        body: "Masuk dengan akun driver Nismara Transport untuk mengklaim hadiah harian dari kereta Santa.",
        ctaHref: "/login",
        ctaLabel: "Masuk ke akun",
      });
      return;
    }

    if (!status.isDriver) {
      setInfoMessage({
        title: "Khusus Driver Resmi Nismara",
        body: "Hadiah harian Santa hanya diberikan kepada driver aktif Nismara Transport. Daftar menjadi driver untuk ikut menikmati bonus harian.",
        ctaHref: "/register",
        ctaLabel: "Daftar jadi driver",
      });
      return;
    }

    if (status.claimedToday) {
      setInfoMessage({
        title: "Hadiah Hari Ini Sudah Diambil",
        body: status.lastRewardLabel
          ? `Hari ini kamu sudah menerima ${status.lastRewardLabel}. Santa akan kembali membawa kado baru besok setelah 00:00 WIB.`
          : "Kamu sudah mengambil hadiah harian Santa hari ini. Kembali lagi besok setelah 00:00 WIB.",
        ctaHref: "/dashboard",
        ctaLabel: "Buka Dashboard",
      });
      return;
    }

    setClaiming(true);
    try {
      const res = await fetch("/api/holiday/santa-claim", {
        method: "POST",
        ...NO_CACHE_FETCH_OPTIONS,
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.claimedToday) {
          onStatusChange({
            claimedToday: true,
            eligible: false,
            lastRewardLabel: data.lastRewardLabel || null,
          });
        }
        setModalError(data.error || "Gagal mengambil hadiah Santa.");
        return;
      }

      const reward: ClaimedReward = data.reward;
      setClaimedReward(reward);
      onStatusChange({
        claimedToday: true,
        eligible: false,
        lastRewardLabel: reward.label,
      });
      onTriggerFireworks();
      router.refresh();
    } catch {
      setModalError("Koneksi ke server terputus saat membuka kado Santa. Coba lagi.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <>
      {/* Flying Santa Sleigh */}
      {flying && (
        <div
          style={{
            top: `${topPct}%`,
            transform: `translate3d(${posX}px, ${bobY}px, 0)`,
          }}
          className="fixed left-0 z-[65] pointer-events-none will-change-transform"
        >
          <button
            type="button"
            onClick={handleCatchSanta}
            onMouseEnter={() => {
              hoveredRef.current = true;
            }}
            onMouseLeave={() => {
              hoveredRef.current = false;
            }}
            onFocus={() => {
              hoveredRef.current = true;
            }}
            onBlur={() => {
              hoveredRef.current = false;
            }}
            aria-label={
              status.eligible
                ? "Klik kereta Santa untuk klaim hadiah harian driver"
                : "Klik kereta Santa untuk informasi hadiah harian"
            }
            className="pointer-events-auto group flex flex-col items-center p-1.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer transition-transform hover:scale-105"
          >
            <div
              style={{
                transform: direction === "rtl" ? "scaleX(-1)" : undefined,
              }}
            >
              <SantaSleighArtwork />
            </div>

            {status.eligible && (
              <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-md border border-[#D9B26F]/60 bg-card/95 text-foreground shadow-md px-2.5 py-1 text-xs font-medium whitespace-nowrap">
                <Gift className="w-3.5 h-3.5 text-[#9A6A1D] dark:text-[#E2BF7D]" aria-hidden="true" />
                <span>Klik Santa: Hadiah Harian</span>
              </span>
            )}
          </button>
        </div>
      )}

      {/* Gift Claim & Reveal Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget && !claiming) setModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Hadiah Harian Santa Nismara Transport"
            className="w-full max-w-md rounded-xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden"
          >
            <div
              aria-hidden="true"
              className="h-[2px] w-full bg-gradient-to-r from-[#1E4D3F] via-[#D9B26F] to-[#B83B47]"
            />

            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[#8A5D18] dark:text-[#E2BF7D]">
                    Kiriman Kereta Santa Nismara
                  </p>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    {claiming
                      ? "Membuka kado harian..."
                      : claimedReward
                        ? "Selamat, kamu mendapat kado!"
                        : infoMessage?.title || "Hadiah Harian Santa"}
                  </h2>
                </div>

                {!claiming && (
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    aria-label="Tutup dialog hadiah Santa"
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              {claiming && (
                <div className="py-8 flex flex-col items-center gap-3 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#9A6A1D] dark:text-[#D9B26F]" />
                  <p className="text-sm text-muted-foreground">
                    Santa sedang memilih kado dari kereta untukmu...
                  </p>
                </div>
              )}

              {!claiming && claimedReward && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#D9B26F]/45 bg-muted/40 p-4 space-y-2.5 text-center">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${
                        TIER_META[claimedReward.tier].badgeClass
                      }`}
                    >
                      {TIER_META[claimedReward.tier].label}
                    </span>

                    <div className="text-xl font-semibold tracking-tight text-foreground">
                      {claimedReward.label}
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {claimedReward.detail}
                    </p>

                    {claimedReward.voucherCode && (
                      <div className="pt-1">
                        <span className="inline-block rounded-md border border-border bg-background px-3 py-1 text-xs font-mono tabular-nums text-foreground">
                          Kode: {claimedReward.voucherCode}
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                    <span>Hadiah sudah langsung masuk ke akunmu. Reset harian pukul 00:00 WIB.</span>
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <Link
                      href={claimedReward.destinationHref}
                      onClick={() => setModalOpen(false)}
                      className="flex-1 inline-flex items-center justify-center min-h-[44px] rounded-lg bg-[#1E4D3F] hover:bg-[#173D32] text-[#F8FAFC] px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {claimedReward.destinationLabel}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="inline-flex items-center justify-center min-h-[44px] rounded-lg border border-border bg-background hover:bg-accent px-4 py-2.5 text-sm font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}

              {!claiming && modalError && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-destructive/35 bg-destructive/10 p-3.5 flex items-start gap-2.5 text-sm text-foreground">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" aria-hidden="true" />
                    <span>{modalError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="w-full min-h-[44px] rounded-lg border border-border bg-background hover:bg-accent px-4 py-2.5 text-sm font-medium text-foreground transition-colors cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              )}

              {!claiming && infoMessage && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {infoMessage.body}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    {infoMessage.ctaHref && infoMessage.ctaLabel && (
                      <Link
                        href={infoMessage.ctaHref}
                        onClick={() => setModalOpen(false)}
                        className="flex-1 inline-flex items-center justify-center min-h-[44px] rounded-lg bg-[#1E4D3F] hover:bg-[#173D32] text-[#F8FAFC] px-4 py-2.5 text-sm font-medium transition-colors"
                      >
                        {infoMessage.ctaLabel}
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="inline-flex items-center justify-center min-h-[44px] rounded-lg border border-border bg-background hover:bg-accent px-4 py-2.5 text-sm font-medium text-foreground transition-colors cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
