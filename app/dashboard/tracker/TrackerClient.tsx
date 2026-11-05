"use client";

import React, { useState, useEffect } from "react";
import {
  Download,
  KeyRound,
  Copy,
  CheckCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  Monitor,
  Terminal,
  Sparkles,
  Check,
  Loader2,
  HelpCircle,
  Radio,
  FileCode,
  Laptop,
} from "lucide-react";
import { showAlert, showConfirm } from "@/lib/dialog";
import { generateTrackerToken, revokeTrackerToken } from "./actions";

interface ReleaseDownloads {
  windowsExe: string;
  windowsMsi: string;
  windowsDll: string;
  linuxAppImage: string;
  linuxDeb: string;
  linuxRpm: string;
  macosDmg: string;
  macosTar: string;
}

interface ReleaseData {
  tagName: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  downloads: ReleaseDownloads;
}

interface TrackerClientProps {
  initialToken: string | null;
  trackerLastSync: string | null;
  trackerVersion: string | null;
  release: ReleaseData;
}

export default function TrackerClient({
  initialToken,
  trackerLastSync,
  trackerVersion,
  release,
}: TrackerClientProps) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [detectedOs, setDetectedOs] = useState<"windows" | "linux" | "macos">(
    "windows",
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent.toLowerCase();
      if (ua.includes("win")) {
        setDetectedOs("windows");
      } else if (ua.includes("mac")) {
        setDetectedOs("macos");
      } else if (ua.includes("linux")) {
        setDetectedOs("linux");
      }
    }
  }, []);

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      await showAlert(
        "Nismara Tracker Token berhasil disalin ke clipboard!",
        "Berhasil",
      );
    } catch {
      await showAlert("Gagal menyalin token ke clipboard.", "Error");
    }
  };

  const handleGenerate = async () => {
    if (token) {
      const confirmed = await showConfirm(
        "Membuat token baru akan memutuskan sesi in-game atau companion yang menggunakan token lama. Lanjutkan?",
        "Perbarui Token",
      );
      if (!confirmed) return;
    }

    setIsGenerating(true);
    try {
      const res = await generateTrackerToken();
      if (res.success && res.token) {
        setToken(res.token);
        setShowToken(true);
        await showAlert(res.message, "Sukses");
      } else {
        await showAlert(res.message, "Gagal");
      }
    } catch (err) {
      console.error(err);
      await showAlert(
        "Terjadi kesalahan jaringan saat membuat token.",
        "Error",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async () => {
    const confirmed = await showConfirm(
      "Apakah Anda yakin ingin menonaktifkan token tracker Anda?",
      "Nonaktifkan Token",
    );
    if (!confirmed) return;

    setIsRevoking(true);
    try {
      const res = await revokeTrackerToken();
      if (res.success) {
        setToken(null);
        await showAlert(res.message, "Sukses");
      } else {
        await showAlert(res.message, "Gagal");
      }
    } catch (err) {
      console.error(err);
      await showAlert("Gagal menonaktifkan token tracker.", "Error");
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* ======================================================== */}
      {/* HERO HEADER                                             */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-cyan-950/40 via-black/60 to-purple-950/30 border border-cyan-500/20 p-8 md:p-10 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Official VTC Telemetry & Desktop Hub</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Nismara Tracker & Companion
            </h1>
            <p className="text-sm md:text-base text-gray-400 max-w-2xl leading-relaxed">
              In-game telemetry plugin berbasis{" "}
              <strong className="text-cyan-300">
                Apple iPhone 16 OS (DirectX 11)
              </strong>{" "}
              untuk Euro Truck Simulator 2 & American Truck Simulator, serta
              aplikasi desktop Companion hub modern.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <a
              href="#downloads"
              className="px-6 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-xl shadow-cyan-500/25 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Aplikasi</span>
            </a>
            <a
              href={release.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-bold text-sm flex items-center justify-center gap-2 transition-all hover:border-white/20"
            >
              <span>GitHub Release</span>
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DRIVER AUTHENTICATION TOKEN CARD                         */}
      {/* ======================================================== */}
      <div className="glass-panel p-8 rounded-[2rem] border-cyan-500/30 bg-black/40 relative overflow-hidden">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Driver Tracker Token
              </h2>
              <p className="text-xs text-gray-400">
                Token autentikasi aman untuk menghubungkan game & companion ke
                akun Anda.
              </p>
            </div>
          </div>

          {token ? (
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
              <CheckCircle className="w-3.5 h-3.5" /> Token Aktif
            </span>
          ) : (
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" /> Belum Ada Token
            </span>
          )}
        </div>

        {token ? (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 font-mono text-base tracking-wider text-cyan-300 select-all overflow-x-auto py-1">
                {showToken ? token : token.replace(/([^-]{3})[^-]+/g, "$1••••")}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  {showToken ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  <span>{showToken ? "Sembunyikan" : "Lihat"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copied ? "Tersalin!" : "Salin Token"}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
              <div className="text-xs text-gray-400 flex items-center gap-2">
                {trackerLastSync ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>
                      Sinkronisasi in-game terakhir:{" "}
                      <strong className="text-gray-200">
                        {new Date(trackerLastSync).toLocaleString("id-ID")}
                      </strong>
                      {trackerVersion ? ` (Plugin v${trackerVersion})` : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>
                      Belum pernah disinkronkan dari dalam game ETS2/ATS.
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`}
                  />
                  <span>Perbarui Token</span>
                </button>
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={isRevoking}
                  className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                >
                  <span>Nonaktifkan</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-400 leading-relaxed">
              Anda belum memiliki Nismara Tracker Token. Buat token Anda
              sekarang untuk mulai melacak pekerjaan, armada truk, garasi, dan
              poin penalti Anda secara otomatis langsung dari kabin truk ETS2 &
              ATS.
            </p>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-cyan-500/25 text-sm"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              <span>Generate Tracker Token Sekarang</span>
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* DOWNLOAD CENTER                                          */}
      {/* ======================================================== */}
      <div id="downloads" className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
              <Download className="w-6 h-6 text-cyan-400" />
              <span>Download Center</span>
            </h2>
            <p className="text-xs md:text-sm text-gray-400 mt-1">
              Pilih paket instalasi sesuai dengan sistem operasi komputer Anda.
              Versi rilis:{" "}
              <strong className="text-cyan-400 font-mono">
                {release.tagName}
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
              ✓ Auto-Updater Enabled
            </span>
          </div>
        </div>

        {/* Multi-OS Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* WINDOWS CARD */}
          <div
            className={`glass-panel p-6 rounded-[2rem] border transition-all flex flex-col justify-between ${
              detectedOs === "windows"
                ? "border-cyan-500/60 bg-cyan-950/20 shadow-xl shadow-cyan-500/10"
                : "border-border/40 bg-black/40 hover:border-border/80"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Monitor className="w-6 h-6" />
                </div>
                {detectedOs === "windows" && (
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-cyan-500 text-black">
                    OS Terdeteksi
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">
                  Windows 10 / 11
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Arsitektur x64. Kompatibel penuh dengan DirectX 11 dan
                  instalasi Steam resmi.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <a
                  href={release.downloads.windowsExe}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-between transition-all shadow-md shadow-blue-600/20"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    <span>Nismara Companion (.exe)</span>
                  </span>
                  <span className="text-[10px] font-mono bg-black/30 px-2 py-0.5 rounded">
                    Setup
                  </span>
                </a>

                <a
                  href={release.downloads.windowsMsi}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-semibold text-xs flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-gray-400" />
                    <span>Windows Installer (.msi)</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">
                    MSI
                  </span>
                </a>

                <a
                  href={release.downloads.windowsDll}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-semibold text-xs flex items-center justify-between transition-all"
                  title="Single DLL standalone. Letakkan langsung di Euro Truck Simulator 2/bin/win_x64/plugins/"
                >
                  <span className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <span>NismaraTracker.dll Standalone</span>
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400">
                    Manual DLL
                  </span>
                </a>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 mt-6 pt-4 border-t border-white/5">
              Direkomendasikan mengunduh Companion (.exe) untuk auto-install DLL
              dan launcher game instan.
            </p>
          </div>

          {/* LINUX CARD */}
          <div
            className={`glass-panel p-6 rounded-[2rem] border transition-all flex flex-col justify-between ${
              detectedOs === "linux"
                ? "border-cyan-500/60 bg-cyan-950/20 shadow-xl shadow-cyan-500/10"
                : "border-border/40 bg-black/40 hover:border-border/80"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Terminal className="w-6 h-6" />
                </div>
                {detectedOs === "linux" && (
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-cyan-500 text-black">
                    OS Terdeteksi
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">Linux (x86_64)</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Mendukung Steam Proton / Wine serta distribusi modern (Ubuntu,
                  Debian, Fedora, Arch).
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <a
                  href={release.downloads.linuxAppImage}
                  className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-between transition-all shadow-md shadow-amber-600/20"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    <span>Universal AppImage</span>
                  </span>
                  <span className="text-[10px] font-mono bg-black/30 px-2 py-0.5 rounded">
                    Portable
                  </span>
                </a>

                <a
                  href={release.downloads.linuxDeb}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-semibold text-xs flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-gray-400" />
                    <span>Debian / Ubuntu (.deb)</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">
                    DEB
                  </span>
                </a>

                <a
                  href={release.downloads.linuxRpm}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-semibold text-xs flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-gray-400" />
                    <span>Fedora / RHEL (.rpm)</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">
                    RPM
                  </span>
                </a>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 mt-6 pt-4 border-t border-white/5">
              AppImage dapat langsung dijalankan setelah memberikan izin
              eksekusi (<code className="text-gray-400">chmod +x</code>).
            </p>
          </div>

          {/* MACOS CARD */}
          <div
            className={`glass-panel p-6 rounded-[2rem] border transition-all flex flex-col justify-between ${
              detectedOs === "macos"
                ? "border-cyan-500/60 bg-cyan-950/20 shadow-xl shadow-cyan-500/10"
                : "border-border/40 bg-black/40 hover:border-border/80"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Laptop className="w-6 h-6" />
                </div>
                {detectedOs === "macos" && (
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-cyan-500 text-black">
                    OS Terdeteksi
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">macOS</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Apple Silicon (M1/M2/M3/M4) dengan performa grafis tinggi dan
                  efisiensi memori.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <a
                  href={release.downloads.macosDmg}
                  className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-between transition-all shadow-md shadow-purple-600/20"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    <span>Apple Silicon DMG (.dmg)</span>
                  </span>
                  <span className="text-[10px] font-mono bg-black/30 px-2 py-0.5 rounded">
                    ARM64
                  </span>
                </a>

                <a
                  href={release.downloads.macosTar}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-semibold text-xs flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-gray-400" />
                    <span>Tarball Archive (.tar.gz)</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">
                    TAR
                  </span>
                </a>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 mt-6 pt-4 border-t border-white/5">
              Buka disk image `.dmg` lalu seret Nismara Companion ke folder
              Applications Anda.
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* QUICK START GUIDE (3 LANGKAH MUDAH)                       */}
      {/* ======================================================== */}
      <div className="glass-panel p-8 rounded-[2rem] border-border/40 bg-black/30 space-y-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          <span>Panduan Cepat Memulai (3 Langkah Mudah)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 font-extrabold flex items-center justify-center text-sm border border-cyan-500/30">
              1
            </div>
            <h4 className="font-bold text-white text-sm">
              Unduh Nismara Companion
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Unduh installer sesuai OS Anda di bagian atas dan lakukan
              instalasi. Companion akan otomatis menyiapkan plugin game untuk
              Anda.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 font-extrabold flex items-center justify-center text-sm border border-cyan-500/30">
              2
            </div>
            <h4 className="font-bold text-white text-sm">
              Masukkan Driver Token
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Buka tab <strong>Settings</strong> di Nismara Companion, tempel
              token Anda dari card di atas, lalu klik{" "}
              <strong>Simpan Token ke Game Config</strong>.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 font-extrabold flex items-center justify-center text-sm border border-cyan-500/30">
              3
            </div>
            <h4 className="font-bold text-white text-sm">
              Luncurkan Game & Tekan F11
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Luncurkan ETS2 atau ATS via Companion, masuk ke kabin truk, dan
              tekan hotkey{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono text-[11px]">
                F11
              </kbd>{" "}
              untuk membuka tracker in-game!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
