"use client";

import React, { useState, useEffect } from "react";
import {
  Download,
  RefreshCw,
  Monitor,
  Terminal,
  Sparkles,
  Radio,
  FileCode,
  Laptop,
  ShieldBan,
  RotateCcw,
  Trash2,
  Gamepad2,
  LogOut,
} from "lucide-react";
import { showAlert, showConfirm } from "@/lib/dialog";
import {
  revokeTrackerToken,
  getTrackerInfo,
  revokeTrackerDevice,
  restoreTrackerDevice,
  removeTrackerDevice,
} from "./actions";

interface TrackerDeviceItem {
  deviceId: string;
  deviceName: string;
  platform: string;
  clientType: "plugin" | "companion";
  clientVersion: string | null;
  lastGame: string | null;
  activeGame: string | null;
  lastInGameSyncAt: string | null;
  firstSeenAt: string | null;
  lastSyncAt: string | null;
  revoked: boolean;
  revokedAt: string | null;
}

interface ReleaseDownloads {
  windowsExe: string;
  windowsMsi: string | null;
  windowsDll: string;
  linuxAppImage: string;
  linuxDeb: string | null;
}

interface ReleaseData {
  tagName: string;
  name: string;
  publishedAt: string;
  downloads: ReleaseDownloads;
}

interface TrackerClientProps {
  trackerLastSync: string | null;
  trackerVersion: string | null;
  trackerLastGame: string | null;
  initialDevices: TrackerDeviceItem[];
  release: ReleaseData;
}

function getShortGameCode(gameName: string | null): string {
  if (!gameName) return "";
  const low = gameName.toLowerCase();
  if (low.includes("euro truck") || low === "ets2" || low === "eut2") return "ETS2";
  if (low.includes("american truck") || low === "ats" || low === "amtrucks") return "ATS";
  return gameName;
}

export default function TrackerClient({
  trackerLastSync,
  trackerVersion,
  trackerLastGame,
  initialDevices,
  release,
}: TrackerClientProps) {
  const [devices, setDevices] = useState<TrackerDeviceItem[]>(initialDevices || []);
  const [lastSync, setLastSync] = useState<string | null>(trackerLastSync);
  const [lastVersion, setLastVersion] = useState<string | null>(trackerVersion);
  const [lastGame, setLastGame] = useState<string | null>(trackerLastGame);
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [detectedOs, setDetectedOs] = useState<"windows" | "linux" | "macos">("windows");

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

  const handleRefreshDevices = async () => {
    setIsRefreshingDevices(true);
    try {
      const res = await getTrackerInfo();
      if (res.success) {
        if (Array.isArray(res.trackerDevices)) setDevices(res.trackerDevices);
        setLastSync(res.trackerLastSync ?? null);
        setLastVersion(res.trackerVersion ?? null);
        setLastGame(res.trackerLastGame ?? null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshingDevices(false);
    }
  };

  const handleRevokeDevice = async (dev: TrackerDeviceItem) => {
    const confirmed = await showConfirm(
      `Cabut akses untuk perangkat "${dev.deviceName}"? Perangkat tersebut tidak akan bisa mengirim telemetri sampai diizinkan kembali atau login ulang via Discord.`,
      "Cabut Akses Perangkat"
    );
    if (!confirmed) return;
    setBusyDeviceId(dev.deviceId);
    try {
      const res = await revokeTrackerDevice(dev.deviceId);
      if (res.success && Array.isArray(res.trackerDevices)) {
        setDevices(res.trackerDevices);
        await showAlert(res.message, "Berhasil");
      } else {
        await showAlert(res.message || "Gagal mencabut akses perangkat.", "Gagal");
      }
    } finally {
      setBusyDeviceId(null);
    }
  };

  const handleRestoreDevice = async (dev: TrackerDeviceItem) => {
    setBusyDeviceId(dev.deviceId);
    try {
      const res = await restoreTrackerDevice(dev.deviceId);
      if (res.success && Array.isArray(res.trackerDevices)) {
        setDevices(res.trackerDevices);
        await showAlert(res.message, "Berhasil");
      } else {
        await showAlert(res.message || "Gagal memulihkan akses perangkat.", "Gagal");
      }
    } finally {
      setBusyDeviceId(null);
    }
  };

  const handleRemoveDevice = async (dev: TrackerDeviceItem) => {
    const confirmed = await showConfirm(
      `Hapus "${dev.deviceName}" dari daftar perangkat?`,
      "Hapus Perangkat"
    );
    if (!confirmed) return;
    setBusyDeviceId(dev.deviceId);
    try {
      const res = await removeTrackerDevice(dev.deviceId);
      if (res.success && Array.isArray(res.trackerDevices)) {
        setDevices(res.trackerDevices);
      } else {
        await showAlert(res.message || "Gagal menghapus perangkat.", "Gagal");
      }
    } finally {
      setBusyDeviceId(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    const confirmed = await showConfirm(
      "Putuskan semua perangkat yang terhubung? Semua sesi Nismara Companion dan plugin game akan keluar, dan Anda cukup Login with Discord kembali di perangkat Anda.",
      "Putuskan Semua Perangkat"
    );
    if (!confirmed) return;

    setIsRevokingAll(true);
    try {
      const res = await revokeTrackerToken();
      if (res.success) {
        setDevices([]);
        await showAlert(res.message, "Sukses");
      } else {
        await showAlert(res.message, "Gagal");
      }
    } catch (err) {
      console.error(err);
      await showAlert("Gagal memutuskan semua sesi perangkat.", "Error");
    } finally {
      setIsRevokingAll(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* ======================================================== */}
      {/* HERO HEADER                                              */}
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
              Unduh <strong className="text-cyan-300">Nismara Companion</strong> untuk
              Euro Truck Simulator 2 & American Truck Simulator. Cukup buka aplikasi dan
              klik <strong className="text-white">Login with Discord</strong> — tanpa perlu
              menyalin token manual lagi.
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
          </div>
        </div>
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
              <strong className="text-cyan-400 font-mono">{release.tagName}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
              ✓ Login with Discord & Auto-Updater
            </span>
          </div>
        </div>

        {/* Multi-OS Grid (Windows & Linux Proton/Wine) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* WINDOWS CARD */}
          <div
            className={`glass-panel p-6 rounded-[2rem] border transition-all flex flex-col justify-between ${
              detectedOs === "windows" || detectedOs === "macos"
                ? "border-cyan-500/60 bg-cyan-950/20 shadow-xl shadow-cyan-500/10"
                : "border-border/40 bg-black/40 hover:border-border/80"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Monitor className="w-6 h-6" />
                </div>
                {detectedOs === "windows" && (
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-cyan-500 text-black">
                    OS Terdeteksi
                  </span>
                )}
                {detectedOs === "macos" && (
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    macOS via Wine / CrossOver
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">
                  Windows 10 / 11{" "}
                  <span className="text-xs font-medium text-gray-400">
                    (x64 &amp; macOS Wine/CrossOver)
                  </span>
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Kompatibel penuh dengan DirectX 11, Discord Rich Presence,
                  instalasi Steam resmi, serta macOS melalui CrossOver / Whisky /
                  Wine.
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

                {release.downloads.windowsMsi && (
                  <a
                    href={release.downloads.windowsMsi}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-semibold text-xs flex items-center justify-between transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-gray-400" />
                      <span>Windows Installer (.msi)</span>
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">MSI</span>
                  </a>
                )}

                <a
                  href={release.downloads.windowsDll}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-semibold text-xs flex items-center justify-between transition-all"
                  title="Single DLL standalone. Letakkan langsung di Euro Truck Simulator 2/bin/win_x64/plugins/"
                >
                  <span className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <span>NismaraTracker.dll Standalone</span>
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400">Manual DLL</span>
                </a>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 mt-6 pt-4 border-t border-white/5">
              Direkomendasikan mengunduh Companion (.exe) untuk auto-install DLL,
              auto-update via R2 CDN, dan login Discord 1 klik.
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
                <h3 className="text-lg font-bold text-white">
                  Linux (x86_64 — Proton / Wine)
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Sudah membundel <code className="text-gray-300">NismaraTracker.dll</code>{" "}
                  untuk ETS2/ATS yang berjalan lewat Steam Proton, Wine, atau
                  Steam Deck.
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

                {release.downloads.linuxDeb && (
                  <a
                    href={release.downloads.linuxDeb}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-semibold text-xs flex items-center justify-between transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-gray-400" />
                      <span>Debian / Ubuntu (.deb)</span>
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">DEB</span>
                  </a>
                )}
              </div>
            </div>

            <p className="text-[11px] text-gray-500 mt-6 pt-4 border-t border-white/5">
              AppImage dapat langsung dijalankan setelah memberikan izin
              eksekusi (<code className="text-gray-400">chmod +x</code>).
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ACTIVE DEVICES & SESSION SECURITY CARD                   */}
      {/* ======================================================== */}
      <div className="glass-panel p-8 rounded-[2rem] border-white/10 bg-black/40 relative overflow-hidden">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Perangkat Terhubung</h2>
              <p className="text-xs text-gray-400">
                Pantau PC yang terhubung ke akun driver Anda dan cabut akses segera jika ada perangkat asing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshDevices}
              disabled={isRefreshingDevices}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingDevices ? "animate-spin" : ""}`} />
              <span>Muat Ulang</span>
            </button>

            {devices.length > 0 && (
              <button
                type="button"
                onClick={handleRevokeAllSessions}
                disabled={isRevokingAll}
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Putuskan Semua</span>
              </button>
            )}
          </div>
        </div>

        {(lastSync || lastGame) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-gray-400 mb-5 pb-4 border-b border-white/10">
            {lastSync && (
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Sinkronisasi terakhir:{" "}
                <strong className="text-gray-200">
                  {new Date(lastSync).toLocaleString("id-ID")}
                </strong>
                {lastVersion ? ` (v${lastVersion})` : ""}
              </span>
            )}
            {lastGame && (
              <span className="inline-flex items-center gap-1.5 text-cyan-300">
                <Gamepad2 className="w-3.5 h-3.5" />
                Last Game: <strong className="text-white">{lastGame}</strong>
              </span>
            )}
          </div>
        )}

        {devices.length === 0 ? (
          <div className="p-5 rounded-2xl bg-black/50 border border-white/10 text-xs text-gray-400">
            Belum ada perangkat yang terhubung. Unduh{" "}
            <strong className="text-gray-200">Nismara Companion</strong> di atas lalu
            klik <strong className="text-white">Login with Discord</strong> agar
            perangkat Anda otomatis muncul di sini.
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((dev) => {
              const nowMs = Date.now();
              const lastSyncMs = dev.lastSyncAt ? new Date(dev.lastSyncAt).getTime() : 0;
              const lastInGameMs = dev.lastInGameSyncAt
                ? new Date(dev.lastInGameSyncAt).getTime()
                : 0;
              const isConnectedToGame =
                !dev.revoked &&
                Boolean(dev.activeGame) &&
                lastInGameMs > 0 &&
                nowMs - lastInGameMs < 90_000;
              const isCompanionOnline =
                !dev.revoked &&
                !isConnectedToGame &&
                lastSyncMs > 0 &&
                nowMs - lastSyncMs < 120_000;
              const isBusy = busyDeviceId === dev.deviceId;

              return (
                <div
                  key={dev.deviceId}
                  className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                    dev.revoked
                      ? "bg-rose-950/20 border-rose-500/25 opacity-80"
                      : isConnectedToGame
                      ? "bg-emerald-950/20 border-emerald-500/30"
                      : "bg-black/60 border-white/10"
                  }`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-bold text-sm text-white flex items-center gap-1.5">
                        <Laptop className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>{dev.deviceName}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/5 text-gray-300 border border-white/10">
                        {dev.platform}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        {dev.clientType === "plugin" ? "In-Game Plugin" : "Companion"}
                        {dev.clientVersion ? ` v${dev.clientVersion}` : ""}
                      </span>

                      {dev.revoked ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          Akses Dicabut
                        </span>
                      ) : isConnectedToGame ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Connected to {getShortGameCode(dev.activeGame)}
                        </span>
                      ) : isCompanionOnline ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                          Companion Online
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/5 text-gray-400 border border-white/10">
                          Offline
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
                        Last Game:{" "}
                        <strong className="text-gray-200">
                          {dev.lastGame || "Belum terhubung ke game"}
                        </strong>
                      </span>
                      <span>
                        Sinkronisasi terakhir:{" "}
                        <strong className="text-gray-200">
                          {dev.lastSyncAt
                            ? new Date(dev.lastSyncAt).toLocaleString("id-ID")
                            : "-"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!dev.revoked ? (
                      <button
                        type="button"
                        onClick={() => handleRevokeDevice(dev)}
                        disabled={isBusy}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <ShieldBan className="w-3.5 h-3.5" />
                        <span>Cabut Akses</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRestoreDevice(dev)}
                          disabled={isBusy}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Izinkan Lagi</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveDevice(dev)}
                          disabled={isBusy}
                          className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* QUICK START GUIDE (3 LANGKAH MUDAH)                      */}
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
            <h4 className="font-bold text-white text-sm">Unduh Nismara Companion</h4>
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
            <h4 className="font-bold text-white text-sm">Klik Login with Discord</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Buka Nismara Companion lalu klik{" "}
              <strong className="text-white">Login with Discord</strong>. Akun
              driver dan sesi plugin ETS2/ATS langsung terhubung secara otomatis.
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
