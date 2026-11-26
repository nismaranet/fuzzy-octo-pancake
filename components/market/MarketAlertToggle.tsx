"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { BellRing, BellOff, Loader2 } from "lucide-react";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { showAlert } from "@/lib/dialog";

interface MarketAlertToggleProps {
  className?: string;
}

export default function MarketAlertToggle({
  className = "",
}: MarketAlertToggleProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const isDriver = Boolean(session?.user?.isDriver);

  useEffect(() => {
    if (!session?.user?.discordId || !isDriver) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/discord/market-alert", NO_CACHE_FETCH_OPTIONS);
        const data = await res.json();
        if (!cancelled && res.ok && data?.success) {
          setConfigured(Boolean(data.configured));
          setEnabled(Boolean(data.enabled));
        }
      } catch {
        // Non-fatal: sembunyikan toggle jika gagal cek awal
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.discordId, isDriver]);

  if (!isDriver || loading || !configured) {
    return null;
  }

  const handleToggle = async () => {
    if (toggling) return;
    const nextEnabled = !enabled;
    setToggling(true);
    try {
      const res = await fetch("/api/discord/market-alert", {
        method: "POST",
        ...NO_CACHE_FETCH_OPTIONS,
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        await showAlert(
          data?.error || "Gagal memperbarui status Notifikasi Market Discord."
        );
        return;
      }
      setEnabled(Boolean(data.enabled));
    } catch {
      await showAlert("Gagal terhubung ke server saat mengubah notifikasi Discord.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={toggling}
      title={
        enabled
          ? "Klik untuk mematikan ping role Market Alert di Discord"
          : "Klik untuk mengaktifkan ping role Market Alert di Discord saat ada penawaran baru"
      }
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-60 ${
        enabled
          ? "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-400 shadow-sm shadow-emerald-500/10"
          : "bg-card/80 hover:bg-card border-border/70 text-muted-foreground hover:text-foreground"
      } ${className}`}
    >
      {toggling ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : enabled ? (
        <BellRing className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <BellOff className="w-3.5 h-3.5 shrink-0" />
      )}
      <span>
        Notif Market Discord:{" "}
        <strong className={enabled ? "text-emerald-300" : "text-foreground/80"}>
          {enabled ? "Aktif" : "Nonaktif"}
        </strong>
      </span>
    </button>
  );
}
