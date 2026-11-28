import type { TileMapInfo } from "./liveMapCatalog";

export interface ScsWorldPoint {
  x: number;
  z: number;
}

export interface SimpleLatLng {
  lat: number;
  lng: number;
}

/**
 * Converts SCS Software in-game world coordinates `(x, z)` in meters
 * into Leaflet `L.CRS.Simple` `[lat, lng]` coordinates aligned 1:1 with
 * `ts-map` tile pyramids (`{z}/{x}/{y}`).
 *
 * In `L.CRS.Simple`:
 * - Top-left (`x1, y1`) maps to `lat = 0, lng = 0`
 * - Bottom-right (`x2, y2`) maps to `lat = -tileSize, lng = tileSize`
 */
export function scsToLatLng(
  x: number,
  z: number,
  tileInfo: TileMapInfo
): [number, number] {
  const tileSize = tileInfo.tileSize || 256;
  const spanX = tileInfo.x2 - tileInfo.x1;
  const spanY = tileInfo.y2 - tileInfo.y1;

  if (!Number.isFinite(spanX) || !Number.isFinite(spanY) || spanX === 0 || spanY === 0) {
    return [-tileSize / 2, tileSize / 2];
  }

  const u = (x - tileInfo.x1) / spanX;
  const v = (z - tileInfo.y1) / spanY;

  const lng = u * tileSize || 0;
  const lat = -v * tileSize || 0;
  return [lat, lng];
}

/**
 * Inverse conversion: Leaflet `L.CRS.Simple` `(lat, lng)` back to SCS world `(x, z)` meters.
 */
export function latLngToScs(
  lat: number,
  lng: number,
  tileInfo: TileMapInfo
): ScsWorldPoint {
  const tileSize = tileInfo.tileSize || 256;
  const spanX = tileInfo.x2 - tileInfo.x1;
  const spanY = tileInfo.y2 - tileInfo.y1;

  const u = lng / tileSize;
  const v = -lat / tileSize;

  return {
    x: tileInfo.x1 + u * spanX,
    z: tileInfo.y1 + v * spanY,
  };
}

/**
 * Returns Leaflet `L.CRS.Simple` bounds `[[south, west], [north, east]]`
 * covering the full `ts-map` tile pyramid.
 */
export function getTileMapBounds(
  tileInfo: TileMapInfo
): [[number, number], [number, number]] {
  const tileSize = tileInfo.tileSize || 256;
  return [
    [-tileSize, 0],
    [0, tileSize],
  ];
}

/**
 * Normalizes any degree angle to `[0, 360)`.
 */
export function normalizeDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

/**
 * Shortest-arc angular interpolation between two compass headings (`[0, 360)`).
 * Example: `lerpAngleDeg(355, 5, 0.5)` returns `0` (not `180`).
 */
export function lerpAngleDeg(fromDeg: number, toDeg: number, t: number): number {
  const a = normalizeDeg(fromDeg);
  const b = normalizeDeg(toDeg);
  let delta = ((b - a + 540) % 360) - 180;
  if (delta === -180) delta = 180;
  return normalizeDeg(a + delta * Math.max(0, Math.min(1, t)));
}

/**
 * Validates and normalizes a raw `TileMapInfo.json` response from Cloudflare R2.
 * Supports both lowercase (`x1, x2, y1, y2, minZoom, maxZoom`) and PascalCase (`X1, X2, Y1, Y2, MinZoom, MaxZoom`)
 * generated across different versions of `dariowouters/ts-map`.
 */
export function parseTileMapInfo(
  raw: Record<string, unknown> | null | undefined
): TileMapInfo | null {
  if (!raw || typeof raw !== "object") return null;

  const x1 = Number(raw.x1 ?? raw.X1);
  const x2 = Number(raw.x2 ?? raw.X2);
  const y1 = Number(raw.y1 ?? raw.Y1);
  const y2 = Number(raw.y2 ?? raw.Y2);
  const minZoom = Number(raw.minZoom ?? raw.MinZoom ?? 0);
  const maxZoom = Number(raw.maxZoom ?? raw.MaxZoom ?? 7);
  const tileSize = Number(raw.tileSize ?? raw.TileSize ?? 256);
  const renderTileSize = Number(raw.renderTileSize ?? raw.RenderTileSize ?? tileSize);

  if (
    !Number.isFinite(x1) ||
    !Number.isFinite(x2) ||
    !Number.isFinite(y1) ||
    !Number.isFinite(y2) ||
    x2 === x1 ||
    y2 === y1
  ) {
    return null;
  }

  const safeTileSize = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : 256;
  const safeRenderSize =
    Number.isFinite(renderTileSize) && renderTileSize >= safeTileSize
      ? renderTileSize
      : safeTileSize;

  return {
    x1,
    x2,
    y1,
    y2,
    minZoom: Number.isFinite(minZoom) ? Math.max(0, Math.floor(minZoom)) : 0,
    maxZoom: Number.isFinite(maxZoom) ? Math.max(1, Math.floor(maxZoom)) : 7,
    tileSize: safeTileSize,
    renderTileSize: safeRenderSize,
  };
}

/**
 * Computes how many extra zoom levels beyond `maxZoom` remain 1:1 pixel-sharp
 * when HiDPI tiles (e.g. `renderTileSize = 1024`, `tileSize = 512`) are used.
 */
export function getExtraSharpZoom(tileInfo: TileMapInfo): number {
  const displaySize = tileInfo.tileSize || 256;
  const renderSize = tileInfo.renderTileSize || displaySize;
  if (renderSize <= displaySize) return 0;
  return Math.max(0, Math.floor(Math.log2(renderSize / displaySize)));
}
