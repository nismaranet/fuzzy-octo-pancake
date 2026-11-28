export interface LiveDriverJobSummary {
  jobId: string | null;
  sourceCity: string | null;
  destinationCity: string | null;
  cargoName: string | null;
  jobCategory: "truck" | "coach" | string;
  plannedDistanceKm?: number;
  remainingDistanceKm?: number;
}

export interface LiveDriverPacket {
  discordId: string;
  truckyId: string | null;
  driverName: string;
  avatar: string | null;
  truckyRank: string;
  truckyRankColor: string;
  gameId: "1" | "2" | string;
  game: string;
  mapId?: string;
  fleetNumber: string | null;
  jobCategory: "truck" | "coach" | string;
  vehicleType: string;
  passengerSatisfaction?: number | null;
  x: number;
  y: number;
  z: number;
  speed: number;
  heading: number;
  gear: number;
  drivenDistanceKm: number;
  isPaused: boolean;
  serverType: string;
  serverName: string | null;
  nearestCity: string | null;
  locationLabel: string | null;
  lastLocation: string | null;
  jobSummary: LiveDriverJobSummary | null;
  updatedAt: string;
}

export interface MapCityPoint {
  id: string;
  name: string;
  country: string;
  x: number;
  z: number;
}

export type ServerFilter =
  | "all"
  | "truckersmp"
  | "haulmp"
  | "convoy"
  | "singleplayer";

export type CategoryFilter = "all" | "truck" | "coach";

export function normalizeServerBucket(serverType?: string | null): Exclude<ServerFilter, "all"> {
  const s = String(serverType || "").toLowerCase();
  if (s.includes("truckersmp") || s.includes("tmp")) return "truckersmp";
  if (s.includes("haulmp")) return "haulmp";
  if (s.includes("convoy")) return "convoy";
  return "singleplayer";
}

export function getServerAccent(serverType?: string | null, isPaused?: boolean): {
  hex: string;
  label: string;
  badgeClass: string;
} {
  if (isPaused) {
    return {
      hex: "#94a3b8",
      label: serverType || "Paused",
      badgeClass: "bg-slate-500/20 text-slate-300 border-slate-400/40",
    };
  }
  const bucket = normalizeServerBucket(serverType);
  switch (bucket) {
    case "truckersmp":
      return {
        hex: "#f97316",
        label: "TruckersMP",
        badgeClass: "bg-orange-500/20 text-orange-300 border-orange-400/45",
      };
    case "haulmp":
      return {
        hex: "#06b6d4",
        label: "HaulMP",
        badgeClass: "bg-cyan-500/20 text-cyan-300 border-cyan-400/45",
      };
    case "convoy":
      return {
        hex: "#a855f7",
        label: "SCS Convoy",
        badgeClass: "bg-violet-500/20 text-violet-300 border-violet-400/45",
      };
    default:
      return {
        hex: "#10b981",
        label: "Singleplayer",
        badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-400/45",
      };
  }
}

export function formatGearLabel(gear: number): string {
  if (!Number.isFinite(gear) || gear === 0) return "N";
  if (gear < 0) return `R${Math.abs(gear)}`;
  return `D${gear}`;
}
