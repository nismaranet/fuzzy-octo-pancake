"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  getTileInfoUrl,
  getTileLayerTemplate,
  type LiveMapDefinition,
  type TileMapInfo,
} from "@/lib/liveMapCatalog";
import {
  getExtraSharpZoom,
  getTileMapBounds,
  latLngToScs,
  lerpAngleDeg,
  normalizeDeg,
  parseTileMapInfo,
  scsToLatLng,
} from "@/lib/scsMapProjection";
import {
  getServerAccent,
  type LiveDriverPacket,
  type MapCityPoint,
} from "./types";

const TRANSPARENT_TILE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const INTERP_DURATION_MS = 3200;
const TELEPORT_SNAP_METERS = 10000;

interface AnimatedDriver {
  driver: LiveDriverPacket;
  marker: L.Marker;
  fromX: number;
  fromZ: number;
  fromHeading: number;
  toX: number;
  toZ: number;
  toHeading: number;
  startMs: number;
  currentX: number;
  currentZ: number;
  currentHeading: number;
}

interface LiveMapCanvasProps {
  mapDef: LiveMapDefinition;
  drivers: LiveDriverPacket[];
  cities: MapCityPoint[];
  selectedDriverId: string | null;
  followDriverId: string | null;
  showCities: boolean;
  resetSignal: number;
  flyToDriverSignal: { discordId: string; nonce: number } | null;
  flyToPointSignal?: { x: number; z: number; zoom?: number; nonce: number } | null;
  onSelectDriver: (discordId: string | null) => void;
  onStopFollow: () => void;
  onTileStatusChange?: (status: "loading" | "r2-tiles" | "tactical-grid") => void;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildDriverMarkerHtml(
  driver: LiveDriverPacket,
  isSelected: boolean,
  isFollowed: boolean
): string {
  const accent = getServerAccent(driver.serverType, driver.isPaused);
  const isCoach = driver.jobCategory === "coach";
  const speedInt = Math.max(0, Math.round(driver.speed || 0));
  const heading = normalizeDeg(driver.heading || 0);
  const displayName = escapeHtml(driver.driverName || "Driver");
  const speedText = driver.isPaused ? "PAUSED" : `${speedInt} km/h`;

  // Distinct compact vector icon for Truck vs Coach/Bus
  const vehicleIcon = isCoach
    ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>`
    : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;

  const ringGlow = isSelected || isFollowed
    ? `0 0 0 4px ${accent.hex}44, 0 0 18px ${accent.hex}aa`
    : `0 0 12px ${accent.hex}66`;

  const labelBorder = isSelected
    ? `border-color: ${accent.hex}; background: rgba(9, 13, 22, 0.95);`
    : `border-color: rgba(255,255,255,0.14); background: rgba(9, 13, 22, 0.82);`;

  return `
    <div class="nismara-driver-pin" style="position:relative;display:flex;flex-direction:column;align-items:center;pointer-events:auto;">
      <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
        <div class="nismara-marker-heading" style="position:absolute;inset:-6px;transform:rotate(${heading}deg);transition:none;pointer-events:none;">
          <svg viewBox="0 0 48 48" width="48" height="48">
            <polygon points="24,0 30,10 18,10" fill="${accent.hex}" />
          </svg>
        </div>
        <div style="
          width:30px;height:30px;border-radius:9999px;
          background:#090d16;
          border:2.5px solid ${accent.hex};
          color:#ffffff;
          display:flex;align-items:center;justify-content:center;
          box-shadow:${ringGlow};
          position:relative;z-index:2;
        ">
          ${vehicleIcon}
        </div>
      </div>
      <div style="
        margin-top:3px;
        padding:2px 7px;
        border-radius:9999px;
        border:1px solid;
        ${labelBorder}
        color:#f8fafc;
        font-size:10px;
        font-weight:700;
        line-height:1.25;
        white-space:nowrap;
        display:flex;
        align-items:center;
        gap:5px;
        box-shadow:0 4px 12px rgba(0,0,0,0.45);
      ">
        <span>${displayName}</span>
        <span style="color:${accent.hex};font-weight:800;">${speedText}</span>
      </div>
    </div>
  `;
}

export default function LiveMapCanvas({
  mapDef,
  drivers,
  cities,
  selectedDriverId,
  followDriverId,
  showCities,
  resetSignal,
  flyToDriverSignal,
  flyToPointSignal,
  onSelectDriver,
  onStopFollow,
  onTileStatusChange,
}: LiveMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const gridLayerRef = useRef<L.LayerGroup | null>(null);
  const cityLayerRef = useRef<L.LayerGroup | null>(null);
  const landmarkLayerRef = useRef<L.LayerGroup | null>(null);
  const animatedDriversRef = useRef<Map<string, AnimatedDriver>>(new Map());
  const tileInfoRef = useRef<TileMapInfo>(mapDef.defaultTileInfo);
  const followDriverIdRef = useRef<string | null>(followDriverId);
  const selectedDriverIdRef = useRef<string | null>(selectedDriverId);
  const onStopFollowRef = useRef(onStopFollow);
  const onSelectDriverRef = useRef(onSelectDriver);
  const onTileStatusChangeRef = useRef(onTileStatusChange);

  const [activeTileInfo, setActiveTileInfo] = useState<TileMapInfo>(
    mapDef.defaultTileInfo
  );
  const [tileMode, setTileMode] = useState<"loading" | "r2-tiles" | "tactical-grid">(
    "loading"
  );
  const [cursorCoords, setCursorCoords] = useState<{ x: number; z: number } | null>(
    null
  );
  const [zoomLevel, setZoomLevel] = useState<number>(mapDef.defaultZoom);

  useEffect(() => {
    followDriverIdRef.current = followDriverId;
  }, [followDriverId]);

  useEffect(() => {
    selectedDriverIdRef.current = selectedDriverId;
  }, [selectedDriverId]);

  useEffect(() => {
    onStopFollowRef.current = onStopFollow;
    onSelectDriverRef.current = onSelectDriver;
    onTileStatusChangeRef.current = onTileStatusChange;
  }, [onStopFollow, onSelectDriver, onTileStatusChange]);

  // 1. Initialize Leaflet map & fetch TileMapInfo.json whenever mapDef changes
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    setTileMode("loading");
    onTileStatusChangeRef.current?.("loading");

    // Clean up any existing map instance
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    animatedDriversRef.current.clear();

    const initMap = async () => {
      let resolvedInfo: TileMapInfo = mapDef.defaultTileInfo;
      let resolvedExt: "webp" | "png" = mapDef.tileExtension;
      let hasR2Tiles = false;

      try {
        const res = await fetch(getTileInfoUrl(mapDef), {
          method: "GET",
          cache: "no-cache",
          signal: AbortSignal.timeout(3500),
        });
        if (res.ok) {
          const rawJson = (await res.json()) as Record<string, unknown>;
          const parsed = parseTileMapInfo(rawJson);
          if (parsed) {
            resolvedInfo = parsed;
            if (rawJson.tileExtension === "png" || rawJson.tileExtension === "webp") {
              resolvedExt = rawJson.tileExtension;
            }
            hasR2Tiles = true;
          }
        }
      } catch {
        // Tiles not uploaded yet on R2 -> fall back cleanly to Tactical Radar Grid
      }

      if (cancelled || !containerRef.current) return;

      tileInfoRef.current = resolvedInfo;
      setActiveTileInfo(resolvedInfo);

      const bounds = getTileMapBounds(resolvedInfo);
      const centerLatLng = scsToLatLng(
        mapDef.defaultCenter[0],
        mapDef.defaultCenter[1],
        resolvedInfo
      );
      const extraSharpZoom = getExtraSharpZoom(resolvedInfo);
      const effectiveMaxZoom = resolvedInfo.maxZoom + extraSharpZoom;
      const initialZoom = Math.max(
        resolvedInfo.minZoom,
        Math.min(effectiveMaxZoom, mapDef.defaultZoom)
      );

      const map = L.map(containerRef.current, {
        crs: L.CRS.Simple,
        center: centerLatLng,
        zoom: initialZoom,
        minZoom: resolvedInfo.minZoom,
        maxZoom: effectiveMaxZoom,
        zoomControl: false,
        attributionControl: false,
        maxBounds: L.latLngBounds(bounds).pad(0.25),
        maxBoundsViscosity: 0.75,
        preferCanvas: true,
      });

      mapRef.current = map;
      setZoomLevel(initialZoom);

      // Always prepare tactical grid layer; display it prominently when R2 tiles aren't available
      const gridGroup = L.layerGroup().addTo(map);
      gridLayerRef.current = gridGroup;

      if (hasR2Tiles) {
        // Automatic cache-bust version derived from TileMapInfo so browser 7-day disk cache
        // immediately refreshes whenever tiles are re-exported with new resolution or DLC bounds.
        const tileVersion = `${resolvedInfo.tileSize || 256}x${resolvedInfo.renderTileSize || resolvedInfo.tileSize || 256}-${Math.round(resolvedInfo.x1)}`;
        const tileUrl = `${getTileLayerTemplate(mapDef, resolvedExt)}?v=${encodeURIComponent(tileVersion)}`;
        const tileLayer = L.tileLayer(tileUrl, {
          tileSize: resolvedInfo.tileSize || 256,
          minZoom: resolvedInfo.minZoom,
          maxZoom: effectiveMaxZoom,
          maxNativeZoom: resolvedInfo.maxZoom,
          noWrap: true,
          bounds,
          errorTileUrl: TRANSPARENT_TILE_PNG,
          crossOrigin: "anonymous",
        });
        tileLayer.addTo(map);
        tileLayerRef.current = tileLayer;
        setTileMode("r2-tiles");
        onTileStatusChangeRef.current?.("r2-tiles");
      } else {
        // Draw subtle tactical dispatch coordinate grid across world bounds
        const stepMeters = 20000;
        const startX = Math.ceil(resolvedInfo.x1 / stepMeters) * stepMeters;
        const startZ = Math.ceil(resolvedInfo.y1 / stepMeters) * stepMeters;

        for (let x = startX; x <= resolvedInfo.x2; x += stepMeters) {
          const isAxis = x === 0;
          L.polyline(
            [
              scsToLatLng(x, resolvedInfo.y1, resolvedInfo),
              scsToLatLng(x, resolvedInfo.y2, resolvedInfo),
            ],
            {
              color: isAxis ? "rgba(56, 189, 248, 0.22)" : "rgba(148, 163, 184, 0.08)",
              weight: isAxis ? 1.5 : 1,
              interactive: false,
            }
          ).addTo(gridGroup);
        }

        for (let z = startZ; z <= resolvedInfo.y2; z += stepMeters) {
          const isAxis = z === 0;
          L.polyline(
            [
              scsToLatLng(resolvedInfo.x1, z, resolvedInfo),
              scsToLatLng(resolvedInfo.x2, z, resolvedInfo),
            ],
            {
              color: isAxis ? "rgba(56, 189, 248, 0.22)" : "rgba(148, 163, 184, 0.08)",
              weight: isAxis ? 1.5 : 1,
              interactive: false,
            }
          ).addTo(gridGroup);
        }

        // Outer map frame rectangle
        L.rectangle(bounds, {
          color: "rgba(56, 189, 248, 0.2)",
          weight: 1,
          fill: false,
          dashArray: "6 6",
          interactive: false,
        }).addTo(gridGroup);

        setTileMode("tactical-grid");
        onTileStatusChangeRef.current?.("tactical-grid");
      }

      const cityGroup = L.layerGroup().addTo(map);
      cityLayerRef.current = cityGroup;

      const landmarkGroup = L.layerGroup().addTo(map);
      landmarkLayerRef.current = landmarkGroup;

      map.on("dragstart", () => {
        if (followDriverIdRef.current) {
          onStopFollowRef.current();
        }
      });

      map.on("click", () => {
        onSelectDriverRef.current(null);
      });

      map.on("zoomend", () => {
        setZoomLevel(map.getZoom());
      });

      map.on("mousemove", (ev: L.LeafletMouseEvent) => {
        const scs = latLngToScs(ev.latlng.lat, ev.latlng.lng, tileInfoRef.current);
        setCursorCoords({ x: Math.round(scs.x), z: Math.round(scs.z) });
      });

      map.on("mouseout", () => {
        setCursorCoords(null);
      });
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      tileLayerRef.current = null;
      gridLayerRef.current = null;
      cityLayerRef.current = null;
      landmarkLayerRef.current = null;
      animatedDriversRef.current.clear();
    };
  }, [mapDef]);

  // 2. Render zoom-aware de-cluttered city labels layer (works with 400+ Cities.json from R2!)
  useEffect(() => {
    const map = mapRef.current;
    const cityGroup = cityLayerRef.current;
    if (!map || !cityGroup) return;
    cityGroup.clearLayers();

    if (!showCities && tileMode === "r2-tiles") return;
    if (!cities.length) return;

    const info = activeTileInfo;
    // Screen-pixel spacing threshold so dense areas (Germany/Benelux) stay clean at low zoom
    const minDistPx = zoomLevel <= 1 ? 82 : zoomLevel <= 2 ? 64 : zoomLevel <= 3 ? 48 : 28;
    const minDistSq = minDistPx * minDistPx;
    const placedPoints: { x: number; y: number }[] = [];

    for (const city of cities) {
      if (
        city.x < info.x1 ||
        city.x > info.x2 ||
        city.z < info.y1 ||
        city.z > info.y2
      ) {
        continue;
      }
      const latLng = scsToLatLng(city.x, city.z, info);
      const pt = map.project(latLng, zoomLevel);

      let collides = false;
      for (const prev of placedPoints) {
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        if (dx * dx + dy * dy < minDistSq) {
          collides = true;
          break;
        }
      }
      if (collides) continue;
      placedPoints.push({ x: pt.x, y: pt.y });

      const cityIcon = L.divIcon({
        className: "nismara-city-label",
        iconSize: [0, 0],
        html: `
          <div style="
            transform:translate(-50%, -50%);
            display:inline-flex;
            align-items:center;
            gap:4px;
            pointer-events:none;
            white-space:nowrap;
          ">
            <span style="
              width:5px;height:5px;border-radius:9999px;
              background:${tileMode === "tactical-grid" ? "rgba(56,189,248,0.85)" : "rgba(56,189,248,0.75)"};
              box-shadow:0 0 6px rgba(56,189,248,0.55);
              flex-shrink:0;
            "></span>
            <span style="
              font-size:${zoomLevel >= 5 ? "11px" : "10px"};
              font-weight:700;
              color:${tileMode === "tactical-grid" ? "rgba(226,232,240,0.82)" : "rgba(241,245,249,0.86)"};
              text-shadow:0 1px 4px rgba(0,0,0,0.98), 0 0 8px rgba(8,12,20,0.95);
              letter-spacing:0.015em;
            ">${escapeHtml(city.name)}</span>
          </div>
        `,
      });
      L.marker(latLng, { icon: cityIcon, interactive: false, zIndexOffset: -200 }).addTo(
        cityGroup
      );
    }
  }, [cities, showCities, activeTileInfo, tileMode, zoomLevel]);

  // 2b. Render branded custom landmarks (e.g. Nismara HQ in Hanover)
  useEffect(() => {
    const map = mapRef.current;
    const landmarkGroup = landmarkLayerRef.current;
    if (!map || !landmarkGroup) return;
    landmarkGroup.clearLayers();

    const landmarks = mapDef.landmarks || [];
    if (!landmarks.length) return;

    const info = activeTileInfo;
    for (const lm of landmarks) {
      const latLng = scsToLatLng(lm.x, lm.z, info);
      const isHq = lm.kind === "hq";
      const icon = L.divIcon({
        className: "nismara-landmark-pin",
        iconSize: [34, 52],
        iconAnchor: [17, 17],
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;">
            <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
              <span style="
                position:absolute;inset:-4px;border-radius:9999px;
                background:radial-gradient(circle, rgba(168,85,247,0.45) 0%, rgba(56,189,248,0) 70%);
                animation:pulse 2.4s cubic-bezier(0.4,0,0.6,1) infinite;
              "></span>
              <div style="
                position:relative;z-index:2;
                width:28px;height:28px;border-radius:10px;
                background:linear-gradient(135deg, #7c3aed 0%, #38bdf8 100%);
                border:2px solid rgba(255,255,255,0.9);
                box-shadow:0 0 16px rgba(124,58,237,0.65), 0 4px 10px rgba(0,0,0,0.6);
                display:flex;align-items:center;justify-content:center;
                color:#ffffff;font-weight:900;font-size:13px;letter-spacing:-0.04em;
              ">
                ${isHq ? "N" : "★"}
              </div>
            </div>
            <div style="
              margin-top:4px;
              padding:2px 8px;
              border-radius:9999px;
              background:rgba(9,13,22,0.92);
              border:1px solid rgba(168,85,247,0.75);
              color:#f8fafc;
              font-size:10px;
              font-weight:800;
              letter-spacing:0.04em;
              text-transform:uppercase;
              white-space:nowrap;
              box-shadow:0 4px 14px rgba(0,0,0,0.6);
            ">
              ${escapeHtml(lm.name)}
            </div>
          </div>
        `,
      });

      const marker = L.marker(latLng, { icon, zIndexOffset: 250 }).addTo(landmarkGroup);
      marker.bindPopup(
        `<div style="min-width:170px;padding:2px 0;color:#f8fafc;font-family:inherit;">
          <div style="font-size:12px;font-weight:900;letter-spacing:0.03em;color:#c084fc;text-transform:uppercase;">${escapeHtml(lm.name)}</div>
          ${lm.subtitle ? `<div style="font-size:11px;color:#cbd5e1;margin-top:3px;line-height:1.35;">${escapeHtml(lm.subtitle)}</div>` : ""}
          <div style="font-size:10px;color:#94a3b8;margin-top:5px;font-family:monospace;">X: ${Math.round(lm.x)} • Z: ${Math.round(lm.z)}</div>
        </div>`,
        { className: "nismara-dark-popup", offset: [0, -14] }
      );
      marker.on("click", (ev) => {
        L.DomEvent.stopPropagation(ev);
        const targetZoom = Math.max(map.getZoom(), Math.min(info.maxZoom + getExtraSharpZoom(info), 7));
        map.flyTo(latLng, targetZoom, { duration: 0.7 });
      });
    }
  }, [mapDef, activeTileInfo]);

  // 3. Reconcile live driver markers & schedule smooth interpolation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const info = tileInfoRef.current;
    const now = performance.now();
    const activeIds = new Set<string>();

    for (const driver of drivers) {
      activeIds.add(driver.discordId);
      const existing = animatedDriversRef.current.get(driver.discordId);
      const isSelected = selectedDriverId === driver.discordId;
      const isFollowed = followDriverId === driver.discordId;

      if (!existing) {
        const latLng = scsToLatLng(driver.x, driver.z, info);
        const icon = L.divIcon({
          className: "nismara-driver-icon",
          iconSize: [36, 52],
          iconAnchor: [18, 18],
          html: buildDriverMarkerHtml(driver, isSelected, isFollowed),
        });
        const marker = L.marker(latLng, {
          icon,
          zIndexOffset: isSelected ? 900 : 300,
        }).addTo(map);

        marker.on("click", (ev) => {
          L.DomEvent.stopPropagation(ev);
          onSelectDriverRef.current(driver.discordId);
        });

        animatedDriversRef.current.set(driver.discordId, {
          driver,
          marker,
          fromX: driver.x,
          fromZ: driver.z,
          fromHeading: normalizeDeg(driver.heading || 0),
          toX: driver.x,
          toZ: driver.z,
          toHeading: normalizeDeg(driver.heading || 0),
          startMs: now,
          currentX: driver.x,
          currentZ: driver.z,
          currentHeading: normalizeDeg(driver.heading || 0),
        });
      } else {
        const dx = driver.x - existing.currentX;
        const dz = driver.z - existing.currentZ;
        const distMeters = Math.hypot(dx, dz);

        if (distMeters > TELEPORT_SNAP_METERS) {
          existing.fromX = driver.x;
          existing.fromZ = driver.z;
          existing.currentX = driver.x;
          existing.currentZ = driver.z;
        } else {
          existing.fromX = existing.currentX;
          existing.fromZ = existing.currentZ;
        }

        existing.fromHeading = existing.currentHeading;
        existing.toX = driver.x;
        existing.toZ = driver.z;
        existing.toHeading = normalizeDeg(driver.heading || 0);
        existing.startMs = now;
        existing.driver = driver;

        // Refresh marker HTML if speed/name/status/selection changed
        const icon = L.divIcon({
          className: "nismara-driver-icon",
          iconSize: [36, 52],
          iconAnchor: [18, 18],
          html: buildDriverMarkerHtml(driver, isSelected, isFollowed),
        });
        existing.marker.setIcon(icon);
        existing.marker.setZIndexOffset(isSelected ? 900 : 300);
      }
    }

    // Remove drivers no longer in filtered list
    for (const [id, item] of animatedDriversRef.current.entries()) {
      if (!activeIds.has(id)) {
        item.marker.remove();
        animatedDriversRef.current.delete(id);
      }
    }
  }, [drivers, selectedDriverId, followDriverId, activeTileInfo]);

  // 4. 60 FPS requestAnimationFrame interpolation loop for smooth movement + Follow-Cam
  useEffect(() => {
    let rafId = 0;

    const tick = (now: number) => {
      const map = mapRef.current;
      const info = tileInfoRef.current;

      if (map && animatedDriversRef.current.size > 0) {
        for (const [id, anim] of animatedDriversRef.current.entries()) {
          const elapsed = now - anim.startMs;
          const t = Math.min(1, Math.max(0, elapsed / INTERP_DURATION_MS));
          // Smooth ease-out curve so trucks glide cleanly between 4s telemetry pings
          const eased = 1 - Math.pow(1 - t, 2);

          const curX = anim.fromX + (anim.toX - anim.fromX) * eased;
          const curZ = anim.fromZ + (anim.toZ - anim.fromZ) * eased;
          const curHeading = lerpAngleDeg(anim.fromHeading, anim.toHeading, eased);

          anim.currentX = curX;
          anim.currentZ = curZ;
          anim.currentHeading = curHeading;

          const latLng = scsToLatLng(curX, curZ, info);
          anim.marker.setLatLng(latLng);

          const el = anim.marker.getElement();
          if (el) {
            const headingEl = el.querySelector<HTMLElement>(".nismara-marker-heading");
            if (headingEl) {
              headingEl.style.transform = `rotate(${curHeading.toFixed(1)}deg)`;
            }
          }

          if (followDriverIdRef.current === id) {
            map.panTo(latLng, { animate: false });
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // 5. Reset view handler
  useEffect(() => {
    if (resetSignal === 0) return;
    const map = mapRef.current;
    if (!map) return;
    const center = scsToLatLng(
      mapDef.defaultCenter[0],
      mapDef.defaultCenter[1],
      tileInfoRef.current
    );
    map.flyTo(center, mapDef.defaultZoom, { duration: 0.7 });
  }, [resetSignal, mapDef]);

  // 6. Fly-to selected driver signal
  useEffect(() => {
    if (!flyToDriverSignal) return;
    const map = mapRef.current;
    if (!map) return;
    const anim = animatedDriversRef.current.get(flyToDriverSignal.discordId);
    if (!anim) return;
    const latLng = scsToLatLng(anim.currentX, anim.currentZ, tileInfoRef.current);
    const targetZoom = Math.max(map.getZoom(), Math.min(tileInfoRef.current.maxZoom, 5));
    map.flyTo(latLng, targetZoom, { duration: 0.85 });
  }, [flyToDriverSignal]);

  // 7. Fly-to arbitrary SCS world point (e.g. Nismara HQ button)
  useEffect(() => {
    if (!flyToPointSignal) return;
    const map = mapRef.current;
    if (!map) return;
    const info = tileInfoRef.current;
    const latLng = scsToLatLng(flyToPointSignal.x, flyToPointSignal.z, info);
    const maxZ = info.maxZoom + getExtraSharpZoom(info);
    const targetZoom = Math.min(maxZ, flyToPointSignal.zoom ?? 7);
    map.flyTo(latLng, targetZoom, { duration: 0.9 });
  }, [flyToPointSignal]);

  return (
    <div
      className="relative w-full h-full select-none"
      style={{ backgroundColor: mapDef.bgColor }}
    >
      <div
        ref={containerRef}
        className="w-full h-full z-0"
        style={{ backgroundColor: mapDef.bgColor }}
      />

      {/* Subtle bottom-right telemetry coordinates & map mode indicator */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-[400] hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/80 px-3 py-1.5 text-[11px] font-medium text-zinc-300 backdrop-blur-md shadow-lg">
        <span
          className={`h-2 w-2 rounded-full ${
            tileMode === "r2-tiles"
              ? "bg-emerald-400"
              : tileMode === "tactical-grid"
              ? "bg-sky-400"
              : "bg-amber-400 animate-pulse"
          }`}
        />
        <span>
          {tileMode === "r2-tiles"
            ? `${mapDef.shortName} R2 Tiles`
            : tileMode === "tactical-grid"
            ? `${mapDef.shortName} Radar Grid`
            : "Memuat Peta..."}
        </span>
        <span className="text-zinc-600">•</span>
        <span className="font-mono text-zinc-400">Z{zoomLevel}</span>
        {cursorCoords && (
          <>
            <span className="text-zinc-600">•</span>
            <span className="font-mono text-zinc-400">
              X:{cursorCoords.x.toLocaleString("id-ID")} Z:{cursorCoords.z.toLocaleString("id-ID")}
            </span>
          </>
        )}
      </div>

      <style jsx global>{`
        .leaflet-container {
          background: ${mapDef.bgColor} !important;
          font-family: inherit;
        }
        .nismara-driver-icon,
        .nismara-city-label,
        .nismara-landmark-pin {
          background: transparent !important;
          border: none !important;
        }
        .nismara-dark-popup .leaflet-popup-content-wrapper,
        .nismara-dark-popup .leaflet-popup-tip {
          background: rgba(9, 13, 22, 0.95) !important;
          border: 1px solid rgba(168, 85, 247, 0.45);
          color: #f8fafc !important;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.65);
        }
        .nismara-dark-popup .leaflet-popup-close-button {
          color: #94a3b8 !important;
        }
      `}</style>
    </div>
  );
}
