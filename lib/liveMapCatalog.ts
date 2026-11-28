export interface TileMapInfo {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  minZoom: number;
  maxZoom: number;
  tileSize?: number;
  renderTileSize?: number;
}

export interface LiveMapLandmark {
  id: string;
  name: string;
  subtitle?: string;
  x: number;
  z: number;
  kind: "hq" | "hub" | "convoy";
}

export interface LiveMapDefinition {
  id: string;
  gameId: "1" | "2";
  name: string;
  shortName: string;
  subtitle: string;
  category: "official" | "mod";
  tileExtension: "webp" | "png";
  tileBasePath: string;
  defaultTileInfo: TileMapInfo;
  defaultCenter: [number, number]; // [x, z] in-game SCS meters
  defaultZoom: number;
  bgColor: string;
  accentColor: string;
  landmarks?: LiveMapLandmark[];
  enabled: boolean;
}

export const DEFAULT_TILES_BASE_URL = "https://tiles.nismara.my.id";
export const DEFAULT_TRACKER_API_URL = "https://companion.nismara.web.id";

export function getLiveMapTilesBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_LIVEMAP_TILES_BASE_URL || DEFAULT_TILES_BASE_URL;
  return raw.replace(/\/+$/, "");
}

export function getTrackerPublicApiUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_TRACKER_SERVER_URL || DEFAULT_TRACKER_API_URL;
  return raw.replace(/\/+$/, "");
}

/**
 * Central Map Registry for Nismara Live Map.
 * - Phase 1 (Active): ETS2 & ATS (Vanilla + Official DLCs)
 * - Phase 4 (Future): Add Mod Maps (ProMods, Map Indonesia / JRR, etc.) as new entries here
 *   after uploading `ts-map` tiles + `TileMapInfo.json` to `https://tiles.nismara.my.id/<mapId>/`.
 */
export const LIVE_MAP_CATALOG: LiveMapDefinition[] = [
  {
    id: "ets2",
    gameId: "1",
    name: "Euro Truck Simulator 2",
    shortName: "ETS2",
    subtitle: "Europe & Official DLCs",
    category: "official",
    tileExtension: "png",
    tileBasePath: "ets2",
    // Fallback bounds (square) used automatically when TileMapInfo.json is not yet uploaded on R2
    defaultTileInfo: {
      x1: -105000,
      x2: 95000,
      y1: -95000,
      y2: 105000,
      minZoom: 0,
      maxZoom: 7,
      tileSize: 256,
    },
    defaultCenter: [0, 5000],
    defaultZoom: 2,
    bgColor: "#080c14",
    accentColor: "#38bdf8",
    landmarks: [
      {
        id: "nismara-hq-ets2",
        name: "Nismara HQ",
        subtitle: "Hanover, Germany • Markas Pusat Nismara Transport",
        x: -829,
        z: -9284,
        kind: "hq",
      },
    ],
    enabled: true,
  },
  {
    id: "ats",
    gameId: "2",
    name: "American Truck Simulator",
    shortName: "ATS",
    subtitle: "United States & Official DLCs",
    category: "official",
    tileExtension: "png",
    tileBasePath: "ats",
    // Fallback bounds (square) used automatically when TileMapInfo.json is not yet uploaded on R2
    defaultTileInfo: {
      x1: -135000,
      x2: 45000,
      y1: -85000,
      y2: 95000,
      minZoom: 0,
      maxZoom: 7,
      tileSize: 256,
    },
    defaultCenter: [-55000, 5000],
    defaultZoom: 2,
    bgColor: "#080c14",
    accentColor: "#f59e0b",
    enabled: true,
  },
];

export function getEnabledLiveMaps(): LiveMapDefinition[] {
  return LIVE_MAP_CATALOG.filter((m) => m.enabled);
}

export function getLiveMapById(id?: string | null): LiveMapDefinition {
  const clean = String(id || "").trim().toLowerCase();
  const matched = LIVE_MAP_CATALOG.find((m) => m.enabled && m.id === clean);
  return matched || LIVE_MAP_CATALOG[0];
}

export function getTileInfoUrl(mapDef: LiveMapDefinition): string {
  return `${getLiveMapTilesBaseUrl()}/${mapDef.tileBasePath}/TileMapInfo.json`;
}

export function getCitiesJsonUrl(mapDef: LiveMapDefinition): string {
  return `${getLiveMapTilesBaseUrl()}/${mapDef.tileBasePath}/Cities.json`;
}

export function getTileLayerTemplate(
  mapDef: LiveMapDefinition,
  extOverride?: "webp" | "png"
): string {
  const ext = extOverride || mapDef.tileExtension;
  // Matches exact default folder output of `TsMap.Canvas.exe`: `<exportPath>/Tiles/{z}/{x}/{y}.png`
  return `${getLiveMapTilesBaseUrl()}/${mapDef.tileBasePath}/Tiles/{z}/{x}/{y}.${ext}`;
}
