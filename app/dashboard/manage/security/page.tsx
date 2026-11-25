"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldAlert, AlertTriangle, User, Clock, CheckCircle2, KeyRound } from "lucide-react";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { showAlert } from "@/lib/dialog";

type SecurityAlert = {
  _id: string;
  discordId: string;
  action: string;
  amount: number;
  details: string;
  isResolved: boolean;
  createdAt: string;
};

const SESSION_ACTIONS = new Set([
  "STOLEN_SESSION_DETECTED",
  "STOLEN_SESSION_COUNTRY_MISMATCH",
  "SESSION_COUNTRY_CHANGED",
  "SESSION_REVOKED_BY_STAFF",
]);

export default function SecurityDashboard() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/manage/security", NO_CACHE_FETCH_OPTIONS);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      } else {
        setError("Gagal memuat data log keamanan. Pastikan Anda memiliki akses Admin atau Manager.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleResolve = async (alertId: string) => {
    setResolvingId(alertId);
    try {
      const res = await fetch("/api/manage/security", {
        method: "PATCH",
        ...NO_CACHE_FETCH_OPTIONS,
        headers: {
          "Content-Type": "application/json",
          ...(NO_CACHE_FETCH_OPTIONS.headers || {}),
        },
        body: JSON.stringify({ alertId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        await showAlert(data.error || "Gagal menandai alert selesai.", "error");
        return;
      }
      setAlerts((prev) =>
        prev.map((a) => (a._id === alertId ? { ...a, isResolved: true } : a)),
      );
    } catch {
      await showAlert("Terjadi kesalahan jaringan.", "error");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <main className="p-6 space-y-6 animate-in fade-in duration-700">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-red-500/20 rounded-xl">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground uppercase tracking-tight">Security &amp; Alerts</h1>
          <p className="text-muted-foreground font-medium">Pemantauan anomali sesi login, aktivitas ekstrem, dan deteksi dini sistem.</p>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl">
        <h2 className="text-xl font-bold uppercase tracking-widest text-red-500 flex items-center gap-2 mb-6">
          <AlertTriangle className="w-5 h-5" />
          Log Keamanan Sesi &amp; Transaksi Ekstrem
        </h2>

        {loading ? (
          <p className="text-muted-foreground animate-pulse">Memuat log...</p>
        ) : error ? (
          <p className="text-destructive font-bold bg-destructive/10 p-4 rounded-xl border border-destructive/20">{error}</p>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 bg-background/50 rounded-xl border border-dashed border-border">
            <ShieldAlert className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Belum ada aktivitas mencurigakan yang terdeteksi.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => {
              const isSessionAlert = SESSION_ACTIONS.has(alert.action) || alert.amount === 0;
              return (
                <div
                  key={alert._id}
                  className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 justify-between items-start md:items-center transition-all ${
                    alert.isResolved
                      ? "bg-background/40 border-border/50 opacity-60"
                      : isSessionAlert
                        ? "bg-amber-500/10 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                        : "bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                  }`}
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1 ${
                          alert.isResolved
                            ? "bg-slate-500/20 text-slate-400"
                            : isSessionAlert
                              ? "bg-amber-500 text-black"
                              : "bg-red-500 text-white"
                        }`}
                      >
                        {isSessionAlert && <KeyRound className="w-3 h-3" />}
                        {alert.action}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 font-bold">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.createdAt).toLocaleString("id-ID", {
                          timeZone: "Asia/Jakarta",
                        })}{" "}
                        WIB
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{alert.details}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 font-bold uppercase tracking-widest">
                      <User className="w-3 h-3" /> Discord ID: {alert.discordId}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {alert.amount > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Nilai Transaksi</p>
                        <p className={`text-xl font-black ${alert.isResolved ? "text-foreground" : "text-red-500"}`}>
                          {alert.amount.toLocaleString("id-ID")} N¢
                        </p>
                      </div>
                    )}

                    {!alert.isResolved ? (
                      <button
                        type="button"
                        onClick={() => handleResolve(alert._id)}
                        disabled={resolvingId === alert._id}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Tandai Selesai
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
