"use client";

import React from "react";
import LoginButton from "@/components/LoginButton";
import { NismaraIcon } from "@/components/icons/SocialMedia";
import { ShieldCheck, Lock, Globe, Zap, ArrowRight } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-(-background) relative overflow-hidden p-6">
      {/* 1. BACKGROUND ORNAMENT (PREMIUM FEEL) */}
      <div className="absolute top-0 -left-20 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-0 -right-20 w-[500px] h-[500px] bg-accent-sky/10 blur-[120px] rounded-full animate-pulse delay-1000" />

      {/* GRID OVERLAY */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, var(--color-foreground) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-5xl flex flex-col md:flex-row bg-card/40 backdrop-blur-2xl border border-border rounded-[3rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.2)] animate-in fade-in zoom-in duration-700">
        {/* SISI KIRI: VISUAL & BRANDING */}
        <div className="flex-1 p-12 bg-gradient-to-br from-primary/20 via-transparent to-accent-sky/10 flex flex-col justify-between relative overflow-hidden border-r border-border/50">
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/20">
                <NismaraIcon className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-black text-(-primary-foreground) uppercase tracking-tighter">
                Nismara <span className="text-accent-sky">Transport</span>
              </h1>
            </div>

            <div className="space-y-2">
              <h2 className="text-5xl font-black text-(-primary-foreground) italic uppercase tracking-tighter leading-none">
                Start Your <br />
                <span className="text-gradient">Virtual Journey</span>
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 relative z-10">
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
              <Zap size={20} className="text-primary mb-2" />
              <p className="text-[10px] font-black uppercase text-foreground/30 tracking-widest">
                Real-time
              </p>
              <p className="text-xs font-bold text-(-primary-foreground)">
                Telemetry Sync
              </p>
            </div>
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
              <Globe size={20} className="text-accent-sky mb-2" />
              <p className="text-[10px] font-black uppercase text-foreground/30 tracking-widest">
                Global
              </p>
              <p className="text-xs font-bold text-(-primary-foreground)">
                Economy Hub
              </p>
            </div>
          </div>

          {/* DECORATIVE TRUCK ICON */}
          <Lock className="absolute -bottom-10 -right-10 w-64 h-64 text-foreground/5 -rotate-12" />
        </div>

        {/* SISI KANAN: LOGIN FORM */}
        <div className="w-full md:w-[450px] p-12 flex flex-col justify-center bg-card/60 relative">
          <div className="space-y-8">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                  System Secure
                </span>
              </div>
              <h3 className="text-3xl font-black text-(-primary-foreground) uppercase italic">
                Welcome
              </h3>
              <p className="text-sm font-medium text-foreground/40">
                Gunakan akun Discord Anda untuk sinkronisasi data driver secara
                otomatis.
              </p>
            </div>

            <div className="space-y-4">
              {/* BUTTON LOGIN DISCORD */}
              <div className="group relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent-sky rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
                <div className="relative">
                  <LoginButton />
                </div>
              </div>

              <div className="flex items-center gap-4 text-foreground/10 px-2">
                <div className="h-px flex-1 bg-current" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Authorized Access Only
                </span>
                <div className="h-px flex-1 bg-current" />
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <p className="text-[10px] font-medium text-foreground/30 leading-relaxed">
                Dengan menekan tombol masuk, Anda menyetujui{" "}
                <a
                  href="/terms"
                  className="text-primary hover:underline font-bold"
                >
                  Terms of Service
                </a>{" "}
                dan{" "}
                <a
                  href="/privacy"
                  className="text-primary hover:underline font-bold"
                >
                  Privacy Policy
                </a>{" "}
                Nismara Transport.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
