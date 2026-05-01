"use client";

import { useState, useMemo } from "react";
import { ShieldAlert, ChevronDown, Info, Zap } from "lucide-react";

// Helper Format Waktu ke WIB
function formatWIB(dateInput: string | Date | undefined) {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

// Helper untuk membersihkan teks (contoh: "wrong_way" -> "WRONG WAY")
function formatOffence(text: string | undefined) {
  if (!text) return "UNKNOWN OFFENCE";
  return text.replace(/_/g, " ");
}

export default function IncidentLogs({ events }: { events: any[] }) {
  const [visibleCount, setVisibleCount] = useState(5);

  // Mengurutkan data kejadian dari yang paling lama (pertama) ke paling baru (terakhir)
  const sortedEvents = useMemo(() => {
    if (!events) return [];
    return [...events].sort((a, b) => {
      const timeA = new Date(a.created_at || a.updated_at || 0).getTime();
      const timeB = new Date(b.created_at || b.updated_at || 0).getTime();
      return timeA - timeB; // Ascending (Kecil ke Besar / Lama ke Baru)
    });
  }, [events]);

  if (!sortedEvents || sortedEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 opacity-70">
        <ShieldAlert className="w-12 h-12 text-green-500 dark:text-green-400 mb-3 opacity-50" />
        <p className="text-green-600 dark:text-green-400 font-bold tracking-widest uppercase text-sm">
          No Incidents
        </p>
        <p className="text-slate-500 dark:text-gray-500 text-xs mt-1">
          Perjalanan bersih dan aman. Good job!
        </p>
      </div>
    );
  }

  // Gunakan data yang sudah diurutkan untuk lazy load
  const visibleEvents = sortedEvents.slice(0, visibleCount);
  const hasMore = visibleCount < sortedEvents.length;

  return (
    <div className="space-y-4">
      {visibleEvents.map((event: any, idx: number) => {
        const isFined = event.event_type === "fined";
        const isCollision = event.event_type === "collision";
        const damageData = event.attributes?.damage;

        return (
          <div
            key={idx}
            className="flex items-center justify-between p-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5"
          >
            <div className="flex items-center gap-4">
              <div
                className={`p-2 rounded-lg ${isFined ? "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400" : "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400"}`}
              >
                {isFined ? <ShieldAlert size={16} /> : <Zap size={16} />}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white uppercase">
                  {isFined
                    ? formatOffence(event.attributes?.offence)
                    : "Collision Detected"}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-gray-500">
                  {formatWIB(event?.created_at || event?.updated_at)} • Coord:{" "}
                  {event.x?.toFixed(0)}, {event.z?.toFixed(0)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Jika Fined, tampilkan nominal denda */}
              {isFined && event.attributes?.amount && (
                <span className="text-orange-600 dark:text-orange-400 font-black">
                  -{event.attributes.amount}€
                </span>
              )}

              {/* Jika Collision, tampilkan persentase damage dengan Hover Tooltip */}
              {isCollision && damageData && (
                <div className="relative group flex items-center gap-2 cursor-help">
                  <span className="text-red-600 dark:text-red-400 font-black">
                    +{damageData.totalDamageDifference}% Dmg
                  </span>
                  <Info
                    size={16}
                    className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition-colors"
                  />

                  {/* Tooltip Box (Hanya muncul saat di-hover) */}
                  <div className="absolute bottom-full right-0 mb-2 w-48 p-3 bg-slate-800 dark:bg-slate-900 border border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 border-b border-slate-700 pb-1">
                      Damage Breakdown
                    </p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-200">
                        <span>Chassis</span>
                        <span
                          className={
                            damageData.chassisDamage > 0
                              ? "text-red-400 font-bold"
                              : ""
                          }
                        >
                          {damageData.chassisDamage}%
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-200">
                        <span>Trailer</span>
                        <span
                          className={
                            damageData.trailersDamage > 0
                              ? "text-red-400 font-bold"
                              : ""
                          }
                        >
                          {damageData.trailersDamage}%
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-200">
                        <span>Cargo</span>
                        <span
                          className={
                            damageData.cargoDamage > 0
                              ? "text-red-400 font-bold"
                              : ""
                          }
                        >
                          {damageData.cargoDamage}%
                        </span>
                      </div>
                    </div>
                    {/* Panah Bawah Tooltip */}
                    <div className="absolute top-full right-4 w-2 h-2 bg-slate-800 dark:bg-slate-900 border-b border-r border-slate-700 transform rotate-45 -mt-1"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {hasMore && (
        <button
          onClick={() => setVisibleCount((prev) => prev + 5)}
          className="w-full flex items-center justify-center gap-2 py-3 mt-4 text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-colors border border-slate-200 dark:border-white/5"
        >
          Tampilkan Lebih Banyak ({sortedEvents.length - visibleCount} tersisa){" "}
          <ChevronDown size={14} />
        </button>
      )}
    </div>
  );
}
