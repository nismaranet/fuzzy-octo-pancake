"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCitiesJsonUrl,
  getEnabledLiveMaps,
  getLiveMapById,
  getTrackerPublicApiUrl,
} from "@/lib/liveMapCatalog";
import LiveMapControls from "./LiveMapControls";
import DriverListDrawer from "./DriverListDrawer";
import DriverTelemetryCard from "./DriverTelemetryCard";
import {
  normalizeServerBucket,
  type CategoryFilter,
  type LiveDriverPacket,
  type MapCityPoint,
  type ServerFilter,
} from "./types";

const LiveMapCanvas = dynamic(() => import("./LiveMapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#080c14] text-zinc-400 text-xs font-semibold">
      Memuat mesin peta Nismara Live Map...
    </div>
  ),
});

const POLL_INTERVAL_MS = 3000;

export default function LiveMapClient() {
  const enabledMaps = useMemo(() => getEnabledLiveMaps(), []);

  const [activeMapId, setActiveMapId] = useState<string>("ets2");
  const [allDrivers, setAllDrivers] = useState<LiveDriverPacket[]>([]);
  const [citiesByMap, setCitiesByMap] = useState<Record<string, MapCityPoint[]>>({});
  const [serverFilter, setServerFilter] = useState<ServerFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [followDriverId, setFollowDriverId] = useState<string | null>(null);
  const [showCities, setShowCities] = useState<boolean>(true);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);
  const [resetSignal, setResetSignal] = useState<number>(0);
  const [flyToDriverSignal, setFlyToDriverSignal] = useState<{
    discordId: string;
    nonce: number;
  } | null>(null);
  const [flyToPointSignal, setFlyToPointSignal] = useState<{
    x: number;
    z: number;
    zoom?: number;
    nonce: number;
  } | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [isPollingPaused, setIsPollingPaused] = useState<boolean>(false);
  const [tileStatus, setTileStatus] = useState<
    "loading" | "r2-tiles" | "tactical-grid"
  >("loading");

  const initialQueryAppliedRef = useRef(false);
  const activeMap = useMemo(() => getLiveMapById(activeMapId), [activeMapId]);

  // Read initial URL query (?map=ets2|ats&driver=<discordId>) once on client mount
  useEffect(() => {
    if (initialQueryAppliedRef.current) return;
    initialQueryAppliedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const paramMap = params.get("map");
    const paramDriver = params.get("driver");
    if (paramMap) {
      setActiveMapId(getLiveMapById(paramMap).id);
    }
    if (paramDriver) {
      setSelectedDriverId(paramDriver);
      setFollowDriverId(paramDriver);
    }
    // Collapse sidebar by default on narrow mobile screens
    if (window.innerWidth < 768) {
      setDrawerOpen(false);
    }
  }, []);

  // Sync URL query params cleanly without triggering Next.js route reload
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("map", activeMap.id);
    if (selectedDriverId) {
      url.searchParams.set("driver", selectedDriverId);
    } else {
      url.searchParams.delete("driver");
    }
    window.history.replaceState({}, "", url.toString());
  }, [activeMap.id, selectedDriverId]);

  // Fetch city coordinates directly from Cloudflare R2 `Cities.json` (includes all DLCs & future Mod Maps!)
  // Falls back cleanly to VPS `/api/tracker/telemetry/cities` if R2 Cities.json is not yet uploaded.
  useEffect(() => {
    const mapKey = activeMap.id;
    if (citiesByMap[mapKey]) return;

    let cancelled = false;
    const loadCities = async () => {
      // 1. Primary source: R2 `https://tiles.nismara.my.id/<mapId>/Cities.json`
      try {
        const r2Res = await fetch(`${getCitiesJsonUrl(activeMap)}?v=2`, {
          method: "GET",
          cache: "no-cache",
          signal: AbortSignal.timeout(4000),
        });
        if (r2Res.ok) {
          const raw = await r2Res.json();
          if (!cancelled && Array.isArray(raw)) {
            const parsed: MapCityPoint[] = [];
            for (const c of raw) {
              const x = Number(c?.X ?? c?.x);
              const z = Number(c?.Y ?? c?.z);
              const name = String(
                c?.LocalizedNames?.en_gb ||
                  c?.LocalizedNames?.en_us ||
                  c?.Name ||
                  c?.name ||
                  ""
              ).trim();
              if (!name || !Number.isFinite(x) || !Number.isFinite(z)) continue;
              parsed.push({
                id: `${mapKey}_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
                name,
                country: String(c?.Country ?? c?.country ?? ""),
                x,
                z,
              });
            }
            if (parsed.length > 0) {
              setCitiesByMap((prev) => ({ ...prev, [mapKey]: parsed }));
              return;
            }
          }
        }
      } catch {
        // Fallback to VPS endpoint below
      }

      // 2. Fallback source: VPS in-memory cities endpoint
      try {
        const apiBase = getTrackerPublicApiUrl();
        const vpsRes = await fetch(
          `${apiBase}/api/tracker/telemetry/cities?gameId=${activeMap.gameId}`,
          {
            method: "GET",
            signal: AbortSignal.timeout(4000),
          }
        );
        if (vpsRes.ok) {
          const json = await vpsRes.json();
          if (!cancelled && json?.success && Array.isArray(json.data)) {
            setCitiesByMap((prev) => ({ ...prev, [mapKey]: json.data }));
          }
        }
      } catch {
        // Non-blocking
      }
    };

    loadCities();
    return () => {
      cancelled = true;
    };
  }, [activeMap, citiesByMap]);

  // Direct browser polling to VPS nismara-tracker-server (0 Vercel invocations, 0 MongoDB queries)
  // Automatically pauses when tab is hidden
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const apiBase = getTrackerPublicApiUrl();

    const fetchLiveDrivers = async () => {
      if (document.visibilityState === "hidden") {
        setIsPollingPaused(true);
        return;
      }
      setIsPollingPaused(false);
      try {
        const res = await fetch(`${apiBase}/api/tracker/telemetry/live-map`, {
          method: "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return;
        const json = await res.json();
        if (active && json?.success && Array.isArray(json.data)) {
          setAllDrivers(json.data as LiveDriverPacket[]);
          setLastUpdatedAt(
            new Date().toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          );
        }
      } catch {
        // Keep last valid state during brief network hiccups
      }
    };

    fetchLiveDrivers();
    timer = setInterval(fetchLiveDrivers, POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setIsPollingPaused(false);
        fetchLiveDrivers();
      } else {
        setIsPollingPaused(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Count drivers per enabled map for top switcher badges
  const mapDriverCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of enabledMaps) counts[m.id] = 0;
    for (const d of allDrivers) {
      const driverMap = d.mapId || (String(d.gameId) === "2" ? "ats" : "ets2");
      if (counts[driverMap] !== undefined) {
        counts[driverMap] += 1;
      }
    }
    return counts;
  }, [allDrivers, enabledMaps]);

  // Drivers filtered to the active map + server + vehicle category
  const visibleDrivers = useMemo(() => {
    return allDrivers.filter((d) => {
      const driverMap = d.mapId || (String(d.gameId) === "2" ? "ats" : "ets2");
      if (driverMap !== activeMap.id) return false;

      if (serverFilter !== "all") {
        if (normalizeServerBucket(d.serverType) !== serverFilter) return false;
      }

      if (categoryFilter !== "all") {
        const cat = d.jobCategory === "coach" ? "coach" : "truck";
        if (cat !== categoryFilter) return false;
      }

      return true;
    });
  }, [allDrivers, activeMap.id, serverFilter, categoryFilter]);

  const selectedDriver = useMemo(() => {
    if (!selectedDriverId) return null;
    return (
      visibleDrivers.find((d) => d.discordId === selectedDriverId) ||
      allDrivers.find((d) => d.discordId === selectedDriverId) ||
      null
    );
  }, [selectedDriverId, visibleDrivers, allDrivers]);

  const handleSelectMap = useCallback((mapId: string) => {
    setActiveMapId(mapId);
    setSelectedDriverId(null);
    setFollowDriverId(null);
  }, []);

  const handleSelectAndFly = useCallback((discordId: string) => {
    setSelectedDriverId(discordId);
    setFlyToDriverSignal({ discordId, nonce: Date.now() });
    if (window.innerWidth < 768) {
      setDrawerOpen(false);
    }
  }, []);

  const handleToggleFollow = useCallback(() => {
    if (!selectedDriverId) return;
    setFollowDriverId((prev) =>
      prev === selectedDriverId ? null : selectedDriverId
    );
  }, [selectedDriverId]);

  const handleStopFollow = useCallback(() => {
    setFollowDriverId(null);
  }, []);

  const handleSelectFromMap = useCallback((discordId: string | null) => {
    setSelectedDriverId(discordId);
    if (!discordId) {
      setFollowDriverId(null);
    }
  }, []);

  const activeHqLandmark = useMemo(
    () => activeMap.landmarks?.find((l) => l.kind === "hq") || activeMap.landmarks?.[0] || null,
    [activeMap]
  );

  const handleFlyToHq = useCallback(() => {
    if (!activeHqLandmark) return;
    setFollowDriverId(null);
    setFlyToPointSignal({
      x: activeHqLandmark.x,
      z: activeHqLandmark.z,
      zoom: 7,
      nonce: Date.now(),
    });
  }, [activeHqLandmark]);

  return (
    <main className="relative isolate z-0 w-full h-[calc(100dvh-5rem)] overflow-hidden bg-[#080c14]">
      <LiveMapCanvas
        mapDef={activeMap}
        drivers={visibleDrivers}
        cities={citiesByMap[activeMap.id] || []}
        selectedDriverId={selectedDriverId}
        followDriverId={followDriverId}
        showCities={showCities}
        resetSignal={resetSignal}
        flyToDriverSignal={flyToDriverSignal}
        flyToPointSignal={flyToPointSignal}
        onSelectDriver={handleSelectFromMap}
        onStopFollow={handleStopFollow}
        onTileStatusChange={setTileStatus}
      />

      <LiveMapControls
        maps={enabledMaps}
        activeMap={activeMap}
        mapDriverCounts={mapDriverCounts}
        serverFilter={serverFilter}
        categoryFilter={categoryFilter}
        showCities={showCities}
        drawerOpen={drawerOpen}
        totalVisibleDrivers={visibleDrivers.length}
        tileStatus={tileStatus}
        onSelectMap={handleSelectMap}
        onServerFilterChange={setServerFilter}
        onCategoryFilterChange={setCategoryFilter}
        onToggleCities={() => setShowCities((v) => !v)}
        onFlyToHq={handleFlyToHq}
        hasHq={Boolean(activeHqLandmark)}
        onResetView={() => {
          setFollowDriverId(null);
          setResetSignal((n) => n + 1);
        }}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
      />

      <DriverListDrawer
        open={drawerOpen}
        drivers={visibleDrivers}
        selectedDriverId={selectedDriverId}
        followDriverId={followDriverId}
        lastUpdatedAt={lastUpdatedAt}
        isPollingPaused={isPollingPaused}
        mapName={activeMap.name}
        onSelectAndFly={handleSelectAndFly}
        onClose={() => setDrawerOpen(false)}
      />

      <DriverTelemetryCard
        driver={selectedDriver}
        isFollowed={Boolean(selectedDriver && followDriverId === selectedDriver.discordId)}
        onToggleFollow={handleToggleFollow}
        onClose={() => {
          setSelectedDriverId(null);
          setFollowDriverId(null);
        }}
      />
    </main>
  );
}
