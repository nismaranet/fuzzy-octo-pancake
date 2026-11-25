"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import {
  ShieldCheck,
  Monitor,
  Smartphone,
  LogOut,
  Trash2,
  RefreshCw,
  Loader2,
  Globe,
  Clock,
} from "lucide-react";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { showAlert, showConfirm } from "@/lib/dialog";

interface ActiveSessionItem {
  id: string;
  deviceLabel: string;
  deviceType: "desktop" | "mobile";
  country: string | null;
  ipMasked: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  expires: string;
  isCurrent: boolean;
}

function formatWIB(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return (
    d.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}

export default function ActiveSessionsCard() {
  const [sessions, setSessions] = useState<ActiveSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/sessions", NO_CACHE_FETCH_OPTIONS);
      const data = await res.json();
      if (res.ok && data.success) {
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Failed loading active sessions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRevoke = async (
    mode: "single" | "others" | "all",
    targetSession?: ActiveSessionItem,
  ) => {
    let confirmMsg = "";
    if (mode === "single" && targetSession) {
      confirmMsg = targetSession.isCurrent
        ? "Memutus sesi perangkat ini akan langsung mengeluarkan Anda dari website. Lanjutkan?"
        : `Putuskan sesi login pada "${targetSession.deviceLabel}"?`;
    } else if (mode === "others") {
      confirmMsg =
        "Keluarkan seluruh perangkat lain selain perangkat yang sedang Anda gunakan sekarang?";
    } else {
      confirmMsg =
        "Keluarkan SELURUH perangkat (termasuk perangkat ini)? Anda harus login kembali lewat Discord.";
    }

    const ok = await showConfirm(confirmMsg, "Konfirmasi Keamanan Sesi");
    if (!ok) return;

    const actionKey = mode === "single" ? targetSession?.id || "single" : mode;
    setBusyKey(actionKey);
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "DELETE",
        ...NO_CACHE_FETCH_OPTIONS,
        headers: {
          "Content-Type": "application/json",
          ...(NO_CACHE_FETCH_OPTIONS.headers || {}),
        },
        body: JSON.stringify({
          mode,
          sessionId: targetSession?.id,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        await showAlert(data.error || "Gagal memutus sesi.", "error");
        return;
      }

      if (data.revokedCurrent || mode === "all") {
        await showAlert(
          "Sesi berhasil diputus. Anda akan diarahkan ke halaman login.",
        );
        await signOut({ callbackUrl: "/login" });
        return;
      }

      await showAlert(data.message || "Sesi berhasil diperbarui.");
      await loadSessions();
    } catch {
      await showAlert("Terjadi kesalahan jaringan saat memutus sesi.", "error");
    } finally {
      setBusyKey(null);
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="glass-panel p-8 rounded-[2rem] border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Perangkat &amp; Sesi Aktif
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Setiap sesi login diikat ke profil browser/perangkat Anda. Jika ada perangkat asing, segera putuskan atau keluar dari semua perangkat.
            </p>
          </div>

          <button
            type="button"
            onClick={loadSessions}
            disabled={loading}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Segarkan
          </button>
        </div>

        {/* Emergency Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-2xl bg-black/25 border border-white/5">
          <button
            type="button"
            onClick={() => handleRevoke("others")}
            disabled={loading || busyKey !== null || otherSessionsCount === 0}
            className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-40"
          >
            {busyKey === "others" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
            Keluar Semua Perangkat Lain ({otherSessionsCount})
          </button>

          <button
            type="button"
            onClick={() => handleRevoke("all")}
            disabled={loading || busyKey !== null || sessions.length === 0}
            className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-40"
          >
            {busyKey === "all" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Keluar dari Semua Perangkat
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            Memuat daftar perangkat aktif...
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10 bg-black/20 rounded-2xl border border-dashed border-white/10 text-gray-400 text-sm">
            Tidak ada data sesi aktif yang ditemukan.
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                  item.isCurrent
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : "bg-black/20 border-white/10"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      item.isCurrent
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-white/5 text-gray-400 border-white/10"
                    }`}
                  >
                    {item.deviceType === "mobile" ? (
                      <Smartphone className="w-5 h-5" />
                    ) : (
                      <Monitor className="w-5 h-5" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {item.deviceLabel}
                      </span>
                      {item.isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Perangkat Ini
                        </span>
                      )}
                      {item.country && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {item.country}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                      <span>IP: {item.ipMasked || "Tidak tercatat"}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Aktif: {formatWIB(item.lastActiveAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-500">
                      Login: {formatWIB(item.createdAt)} • Kedaluwarsa: {formatWIB(item.expires)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRevoke("single", item)}
                  disabled={busyKey !== null}
                  className="self-end sm:self-center px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 shrink-0"
                >
                  {busyKey === item.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LogOut className="w-3.5 h-3.5" />
                  )}
                  Putuskan
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
