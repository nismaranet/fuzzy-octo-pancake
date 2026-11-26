export interface PositionXY {
  x: number;
  y: number;
}

export const DEFAULT_OBJECT_POSITION = "50% 50%";

export function clampPercent(value: number, fallback = 50): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function formatObjectPosition(x: number, y: number): string {
  return `${clampPercent(x)}% ${clampPercent(y)}%`;
}

export function parseObjectPosition(raw?: string | null): PositionXY {
  if (!raw || typeof raw !== "string") {
    return { x: 50, y: 50 };
  }
  const match = raw
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)%?\s+(-?\d+(?:\.\d+)?)%?$/);
  if (!match) {
    return { x: 50, y: 50 };
  }
  return {
    x: clampPercent(parseFloat(match[1])),
    y: clampPercent(parseFloat(match[2])),
  };
}

export function sanitizeObjectPosition(raw?: string | null): string {
  const { x, y } = parseObjectPosition(raw);
  return formatObjectPosition(x, y);
}
