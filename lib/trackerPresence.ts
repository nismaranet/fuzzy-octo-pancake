export interface DriverPresenceJobSummary {
  jobId: string | null;
  sourceCity: string | null;
  destinationCity: string | null;
  cargoName: string | null;
  jobCategory: "truck" | "coach" | string;
  plannedDistanceKm?: number;
  remainingDistanceKm?: number;
}

export interface DriverPresenceData {
  discordId: string;
  online: boolean;
  inGame: boolean;
  statusLabel: string;
  gameId: string | null;
  game: string | null;
  serverType: string | null;
  serverName: string | null;
  nearestCity: string | null;
  locationLabel: string | null;
  lastLocation: string | null;
  lastOnlineAt: string | null;
  speed: number;
  isPaused: boolean;
  fleetNumber: string | null;
  jobSummary: DriverPresenceJobSummary | null;
}

const DEFAULT_TRACKER_SERVER_URL = "https://companion.nismara.web.id";

function getTrackerServerUrl(): string {
  const raw =
    process.env.TRACKER_SERVER_URL ||
    process.env.NEXT_PUBLIC_TRACKER_SERVER_URL ||
    DEFAULT_TRACKER_SERVER_URL;
  return raw.replace(/\/+$/, "");
}

/**
 * Fetches live driver presence & last-known location directly from Redis-backed
 * `nismara-tracker-server` (0 MongoDB queries). Gracefully returns null on timeout/error.
 */
export async function fetchDriverPresence(
  discordId?: string | number | null
): Promise<DriverPresenceData | null> {
  const cleanId = String(discordId || "").trim();
  if (!cleanId) return null;

  try {
    const res = await fetch(
      `${getTrackerServerUrl()}/api/tracker/telemetry/presence/${encodeURIComponent(cleanId)}`,
      {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(1500),
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.success || !json?.data) return null;
    return json.data as DriverPresenceData;
  } catch {
    return null;
  }
}

/**
 * Formats an ISO timestamp into a concise Indonesian relative time string for "Last Online".
 */
export function formatLastOnlineRelative(isoDate?: string | Date | null): string | null {
  if (!isoDate) return null;
  const dt = isoDate instanceof Date ? isoDate : new Date(isoDate);
  if (Number.isNaN(dt.getTime())) return null;

  const diffMs = Math.max(0, Date.now() - dt.getTime());
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} hari lalu`;

  return dt.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}
