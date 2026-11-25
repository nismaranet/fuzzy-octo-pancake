import { Loader2, Ghost } from "lucide-react";
import { NismaraIcon } from "@/components/icons/SocialMedia";

interface LoadingScreenProps {
  title?: string;
  subtitle?: string;
}

export default function LoadingScreen({
  title = "Nismara Transport",
  subtitle = "Memuat Data...",
}: LoadingScreenProps) {
  return (
    <>
      {/* 1. NATAL & TAHUN BARU (Nordic Winter & Champagne Gold) */}
      <div className="loading-season-winter fixed inset-0 z-[9999] flex-col items-center justify-center bg-background min-h-screen overflow-hidden px-6">
        {/* Ambient Nordic Pine & Champagne Gold backdrop */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-[#1E4D3F]/25 dark:bg-[#1E4D3F]/35 blur-[130px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/3 -translate-y-2/3 w-[280px] h-[280px] rounded-full bg-[#D9B26F]/20 blur-[110px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-7 text-center">
          {/* Concentric Brushed Brass Emblem Frame */}
          <div className="relative flex items-center justify-center w-36 h-36">
            <svg
              viewBox="0 0 144 144"
              fill="none"
              aria-hidden="true"
              className="absolute inset-0 w-full h-full holiday-ring-spin text-[#9A6A1D] dark:text-[#D9B26F]"
            >
              <circle
                cx="72"
                cy="72"
                r="66"
                stroke="currentColor"
                strokeOpacity="0.35"
                strokeWidth="1"
                strokeDasharray="4 6"
              />
              <circle
                cx="72"
                cy="72"
                r="57"
                stroke="currentColor"
                strokeOpacity="0.22"
                strokeWidth="1"
              />
              {/* Four cardinal Nordic 4-point brass stars */}
              <path d="M72 2L73.6 6.4L78 8L73.6 9.6L72 14L70.4 9.6L66 8L70.4 6.4Z" fill="currentColor" />
              <path d="M72 130L73.6 134.4L78 136L73.6 137.6L72 142L70.4 137.6L66 136L70.4 134.4Z" fill="currentColor" />
              <path d="M8 66L9.6 70.4L14 72L9.6 73.6L8 78L6.4 73.6L2 72L6.4 70.4Z" fill="currentColor" />
              <path d="M136 66L137.6 70.4L142 72L137.6 73.6L136 78L134.4 73.6L130 72L134.4 70.4Z" fill="currentColor" />
            </svg>

            <div className="relative flex items-center justify-center w-24 h-24 rounded-2xl border border-[#9A6A1D]/35 dark:border-[#D9B26F]/40 bg-card shadow-xl">
              <NismaraIcon className="w-14 h-14 text-[#1E4D3F] dark:text-[#E6C27A]" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-2.5 max-w-xs">
            <p className="text-xs font-medium text-[#8A5D18] dark:text-[#E2BF7D]">
              Edisi Natal &amp; Tahun Baru
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {title === "Nismara Transport" ? "Nismara Winter Edition" : title}
            </h2>

            {/* Fine brass hairline divider */}
            <div aria-hidden="true" className="flex items-center gap-2 w-36 my-0.5">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#D9B26F]/60" />
              <span className="w-1.5 h-1.5 rotate-45 bg-[#D9B26F]" />
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#D9B26F]/60" />
            </div>

            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9A6A1D] dark:text-[#D9B26F]" />
              <span>
                {subtitle === "Memuat Data..." ? "Menyiapkan armada akhir tahun..." : subtitle}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. HALLOWEEN */}
      <div className="loading-season-halloween fixed inset-0 z-[9999] flex-col items-center justify-center bg-background min-h-screen overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-30">
          <div className="w-[320px] h-[320px] bg-orange-600 rounded-full blur-[140px] animate-pulse" />
          <div className="w-[260px] h-[260px] bg-purple-600 rounded-full blur-[120px] animate-pulse delay-500" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="relative p-6 glass-panel rounded-3xl border-orange-500/30 shadow-2xl shadow-orange-500/20 bg-zinc-950/60 backdrop-blur-xl">
            <NismaraIcon className="w-20 h-20 text-orange-400 animate-pulse" />
            <div className="absolute -top-2 -right-2 bg-orange-500/20 border border-orange-500/40 rounded-full p-1.5 shadow-lg shadow-orange-500/20">
              <Ghost className="w-4 h-4 text-orange-300 animate-bounce" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <h2 className="text-foreground font-black uppercase tracking-[0.2em] text-sm bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-amber-300 to-purple-400">
              {title === "Nismara Transport" ? "Nismara Halloween Event" : title}
            </h2>

            <div className="flex items-center gap-2 text-orange-300/70 text-xs font-medium uppercase tracking-widest">
              <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
              <span>
                {subtitle === "Memuat Data..." ? "Memanggil Roh Nismara..." : subtitle}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. STANDARD DEFAULT */}
      <div className="loading-season-default fixed inset-0 z-[9999] flex-col items-center justify-center bg-background min-h-screen overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="w-[300px] h-[300px] bg-primary rounded-full blur-[120px] animate-pulse" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="relative p-6 glass-panel rounded-3xl border-primary/20 shadow-2xl shadow-primary/10">
            <NismaraIcon className="w-20 h-20 text-primary animate-pulse" />
          </div>

          <div className="flex flex-col items-center gap-3">
            <h2 className="text-foreground font-black uppercase tracking-[0.2em] text-sm bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent-sky">
              {title}
            </h2>

            <div className="flex items-center gap-2 text-foreground/50 text-xs font-medium uppercase tracking-widest">
              <Loader2 className="w-4 h-4 animate-spin text-accent-sky" />
              <span>{subtitle}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
