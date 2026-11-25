"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lock, ArrowLeft, Sparkles, Calendar } from "lucide-react";
import { runSplashChoreography } from "./rewindChoreography";

interface Props {
  releaseAtIso: string;
  enabled: boolean;
}

export default function RewindLockedTeaser({ releaseAtIso, enabled }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    ready: false,
  });

  useEffect(() => {
    if (!rootRef.current) return;
    return runSplashChoreography(rootRef.current);
  }, []);

  useEffect(() => {
    const targetMs = new Date(releaseAtIso).getTime();
    const update = () => {
      const diff = targetMs - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, ready: true });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
        ready: false,
      });
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [releaseAtIso]);

  const releaseLabel =
    new Date(releaseAtIso).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB";

  return (
    <main
      ref={rootRef}
      className="min-h-screen bg-[#070A12] text-slate-100 flex items-center justify-center px-4 py-24 relative overflow-hidden"
    >
      <div
        data-anim="orb"
        className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-400/20 blur-[110px] pointer-events-none"
      />
      <div
        data-anim="orb"
        className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-sky-400/15 blur-[110px] pointer-events-none"
      />

      <div className="relative z-10 max-w-xl w-full rounded-[2rem] bg-slate-950/80 border border-amber-400/25 p-8 sm:p-10 text-center space-y-6 shadow-2xl backdrop-blur-xl">
        <div
          data-anim="pill"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/35 text-amber-200 text-xs font-bold"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>{enabled ? "Segera Dibuka" : "Belum Tersedia"}</span>
        </div>

        <div className="space-y-2">
          <p
            data-anim="pill"
            className="text-xs font-bold uppercase tracking-[0.26em] text-slate-400"
          >
            Nismara Transport • Rewind 2026
          </p>
          <h1
            data-anim="headline-chars"
            className="text-4xl sm:text-5xl font-black tracking-tight text-white"
          >
            Miles of Memories
          </h1>
          <svg
            viewBox="0 0 260 14"
            className="w-40 mx-auto h-3.5 overflow-visible"
            aria-hidden="true"
          >
            <path
              data-anim="draw-path"
              d="M 6 8 Q 130 0 254 8"
              fill="none"
              stroke="#F5C56A"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <p
            data-anim="subcopy"
            className="text-sm sm:text-base text-slate-300 leading-relaxed pt-1"
          >
            {enabled
              ? "Kilas balik perjalanan 2026 untuk seluruh driver Nismara Transport sedang disiapkan. Kembali lagi saat pintu kenangan resmi dibuka."
              : "Halaman Nismara Rewind 2026 saat ini sedang ditutup oleh manajemen."}
          </p>
        </div>

        {enabled && (
          <>
            <div className="grid grid-cols-4 gap-2.5 pt-2">
              {[
                { label: "Hari", val: timeLeft.days },
                { label: "Jam", val: timeLeft.hours },
                { label: "Menit", val: timeLeft.minutes },
                { label: "Detik", val: timeLeft.seconds },
              ].map((box) => (
                <div
                  key={box.label}
                  data-anim="card"
                  className="p-3.5 rounded-2xl bg-white/5 border border-white/10"
                >
                  <p className="text-2xl sm:text-3xl font-black text-amber-300 tabular-nums">
                    {String(box.val).padStart(2, "0")}
                  </p>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                    {box.label}
                  </p>
                </div>
              ))}
            </div>

            <div
              data-anim="subcopy"
              className="inline-flex items-center gap-2 text-xs text-slate-300"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-300" />
              <span>Jadwal Rilis: {releaseLabel}</span>
            </div>

            {timeLeft.ready && (
              <div>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="min-h-[44px] px-6 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm inline-flex items-center gap-2 transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" /> Buka Rewind Sekarang
                </button>
              </div>
            )}
          </>
        )}

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
          </Link>
        </div>
      </div>
    </main>
  );
}
