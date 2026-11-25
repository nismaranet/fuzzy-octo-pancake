import React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

interface Props {
  variant?: "home" | "dashboard";
}

/**
 * Banner pengumuman Miles of Memories — Nismara Rewind 2026.
 * Hanya dirender oleh server page setelah jadwal rilis publik (28 Des 2026 00:00 WIB) tercapai.
 */
export default function RewindPromoBanner({ variant = "home" }: Props) {
  const isHome = variant === "home";

  return (
    <section
      className={
        isHome
          ? "relative z-20 max-w-6xl mx-auto px-4 sm:px-6 -mt-8 mb-6"
          : "mb-8"
      }
    >
      <Link
        href="/rewind/2026"
        className="group relative block rounded-3xl overflow-hidden border border-amber-400/35 bg-gradient-to-r from-[#0C1220] via-[#171B2C] to-[#1E1710] p-5 sm:p-7 shadow-2xl transition-all hover:border-amber-300/60"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(245,185,66,0.22),transparent_50%)] pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/35 text-amber-200 text-[11px] font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nismara Rewind 2026 Sudah Dibuka</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Miles of Memories 2026
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Putar kembali kilas balik kilometer, rekor Hardcore Simulation, julukan driver 2026, dan unduh kartu kenanganmu untuk dibagikan.
            </p>
          </div>

          <div className="shrink-0">
            <span className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-full bg-amber-400 group-hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm transition-colors">
              <span>Lihat Rewind Kamu</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </Link>
    </section>
  );
}
