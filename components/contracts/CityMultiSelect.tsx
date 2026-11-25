"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, X, Plus, Loader2, Check } from "lucide-react";

interface CityOption {
  id: string;
  name: string;
  dlc: string;
  real_name: string;
}

export default function CityMultiSelect({
  gameId,
  value,
  onChange,
}: {
  gameId: string;
  value: string[];
  onChange: (cities: string[]) => void;
}) {
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/cities?gameId=${encodeURIComponent(gameId || "1")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success && Array.isArray(data.cities)) {
          setCities(
            data.cities.map((c: any) => ({
              id: String(c.id),
              name: String(c.name || c.real_name?.split(" (")[0] || "").trim(),
              dlc: String(c.dlc || "Base Game"),
              real_name: String(c.real_name || c.name || ""),
            }))
          );
        }
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  const selectedLower = useMemo(
    () => new Set(value.map((v) => v.toLowerCase())),
    [value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? cities
      : cities.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.dlc.toLowerCase().includes(q)
        );
    return list.slice(0, 60);
  }, [cities, query]);

  const toggleCity = (cityName: string) => {
    const clean = cityName.trim();
    if (!clean) return;
    const exists = value.some((v) => v.toLowerCase() === clean.toLowerCase());
    if (exists) {
      onChange(value.filter((v) => v.toLowerCase() !== clean.toLowerCase()));
    } else {
      onChange([...value, clean]);
    }
  };

  const trimmedQuery = query.trim();
  const canAddCustom =
    trimmedQuery.length >= 2 &&
    !selectedLower.has(trimmedQuery.toLowerCase()) &&
    !cities.some((c) => c.name.toLowerCase() === trimmedQuery.toLowerCase());

  return (
    <div ref={containerRef} className={`space-y-2 relative ${open ? "z-50" : "z-10"}`}>
      {/* Selected city chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((city) => (
            <span
              key={city}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
            >
              <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>{city}</span>
              <button
                type="button"
                aria-label={`Hapus kota ${city}`}
                onClick={() => toggleCity(city)}
                className="rounded hover:bg-emerald-500/20 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search
          className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          placeholder={
            loading
              ? "Memuat daftar kota..."
              : "Cari nama kota atau DLC (misal: Berlin, Base Game, Iberia)..."
          }
          className="w-full min-h-[44px] bg-background border border-input rounded-xl pl-10 pr-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {loading && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
        )}
      </div>

      {/* Dropdown list */}
      {open && (
        <div className="absolute left-0 right-0 mt-1 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden z-50">
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length > 0 ? (
              filtered.map((city) => {
                const active = selectedLower.has(city.name.toLowerCase());
                return (
                  <button
                    key={`${city.id}-${city.name}`}
                    type="button"
                    onClick={() => {
                      toggleCity(city.name);
                      setQuery("");
                    }}
                    className={`w-full min-h-[40px] px-3.5 py-2 text-left text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      active
                        ? "bg-emerald-500/15 text-foreground font-medium"
                        : "hover:bg-accent text-foreground"
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
                      <span className="truncate">{city.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        ({city.dlc})
                      </span>
                    </div>
                    {active && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="px-3.5 py-4 text-center text-xs text-muted-foreground">
                {loading
                  ? "Memuat kota..."
                  : `Tidak ada kota di database yang cocok dengan "${query}".`}
              </div>
            )}

            {canAddCustom && (
              <button
                type="button"
                onClick={() => {
                  toggleCity(trimmedQuery);
                  setQuery("");
                }}
                className="w-full min-h-[40px] px-3.5 py-2 border-t border-border bg-secondary hover:bg-secondary/80 text-left text-xs font-medium text-secondary-foreground flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Tambah nama kota manual: &ldquo;{trimmedQuery}&rdquo;</span>
              </button>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Bisa pilih 1 kota hub atau beberapa kota sekaligus. Job Coach valid jika berangkat, menuju, atau singgah (stops) di salah satu kota target.
      </p>
    </div>
  );
}
