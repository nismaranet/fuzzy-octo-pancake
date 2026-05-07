"use client";

import React from "react";
import {
  Truck,
  Cpu,
  Zap,
  Timer,
  ShieldCheck,
  Activity,
  Radio,
  Map,
  Gauge,
} from "lucide-react";

export default function FleetComingSoonPage() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-10 pb-10 animate-in fade-in duration-700">
      {/* 1. HEADER SECTION (Konsisten dengan Page Lain) */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-sky/10 rounded-lg text-accent-sky">
              <Truck size={24} />
            </div>
            <h1 className="text-4xl font-black text-(-primary-foreground) tracking-tighter uppercase italic">
              Fleet Management
            </h1>
          </div>
          <p className="text-(-primary-foreground)/40 font-bold uppercase text-[10px] tracking-[0.2em] ml-11">
            Nismara Transport Hub • Real-time Asset Tracking
          </p>
        </div>
      </div>

      {/* 2. MAIN COMING SOON MODULE */}
      <div className="relative group bg-card border border-border rounded-[3.5rem] overflow-hidden min-h-[600px] flex flex-col items-center justify-center p-12 shadow-2xl">
        {/* DYNAMIC BACKGROUND (PENTING BUAT VISUAL) */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent-sky/10 blur-[120px] rounded-full translate-x-1/2 translate-y-1/2 animate-pulse delay-700" />

        {/* GRID OVERLAY */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, var(--color-foreground) 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* CENTER VISUAL: THE TRUCK CORE */}
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-accent-lilac/30 blur-[60px] rounded-full animate-ping scale-150 opacity-50" />
          <div className="relative p-10 bg-white/5 border border-white/10 rounded-[3rem] shadow-2xl backdrop-blur-2xl group-hover:scale-105 transition-transform duration-700">
            <Truck size={80} className="text-accent-lilac animate-bounce" />
          </div>
          {/* SATELLITE ICONS */}
          <div className="absolute -top-4 -right-4 p-3 bg-primary rounded-2xl shadow-xl border border-white/10 animate-spin-slow">
            <Cpu size={24} className="text-white" />
          </div>
          <div className="absolute -bottom-2 -left-6 p-3 bg-accent-sky rounded-2xl shadow-xl border border-white/10 animate-pulse">
            <Radio size={20} className="text-white" />
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="relative z-10 text-center space-y-6 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-black uppercase tracking-[0.4em] text-primary shadow-inner">
            <Activity size={14} className="animate-pulse" /> Global System
            Overhaul
          </div>

          <h2 className="text-6xl md:text-7xl font-black text-(-primary-foreground) italic uppercase tracking-tighter leading-none">
            MAJU BERSAMA:{" "}
            <span className="text-accent-sky italic">FLEET 2.0</span>
          </h2>

          <p className="text-foreground/50 text-lg font-medium leading-relaxed px-4">
            Kami sedang merombak total infrastruktur pelacakan armada. Modul ini
            akan mengintegrasikan{" "}
            <span className="text-accent-lilac font-bold">
              Telemetri Real-time
            </span>
            , audit kesehatan mesin truk, dan visualisasi rute GPS langsung dari
            World Map Trucky.
          </p>
        </div>

        {/* PROGRESS INDICATOR */}
        <div className="w-full max-w-lg mt-12 space-y-5 relative z-10 px-6">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em]">
                Sync Status
              </p>
              <p className="text-xs font-black text-accent-sky uppercase italic">
                API Handshake: Completed
              </p>
            </div>
            <p className="text-2xl font-black text-accent-lilac italic tabular-nums">
              12<span className="text-xs ml-0.5">%</span>
            </p>
          </div>
          <div className="h-2.5 w-full bg-foreground/5 rounded-full overflow-hidden border border-border shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-primary via-accent-lilac to-accent-sky transition-all duration-1000 ease-out shadow-[0_0_25px_rgba(109,40,217,0.5)]"
              style={{ width: "12%" }}
            />
          </div>
        </div>

        {/* CERTIFICATION FOOTER */}
        <div className="absolute bottom-8 flex items-center gap-5 text-foreground/20">
          <ShieldCheck size={16} />
          <span className="text-[9px] font-black uppercase tracking-[0.4em]">
            Nismara Certified Operational Control Center
          </span>
        </div>
      </div>

      {/* INTERNAL CSS FOR SPIN ANIMATION */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>
    </div>
  );
}
