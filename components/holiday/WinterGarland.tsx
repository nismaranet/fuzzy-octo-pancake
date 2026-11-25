"use client";

import React from "react";

interface BulbSpec {
  cx: number;
  cy: number;
  color: string;
  warm: boolean;
  r: number;
  pulseClass: string;
}

const SWAG_BULBS: BulbSpec[] = [
  // Swag 1 (0 -> 400)
  { cx: 65, cy: 19, color: "#F6DFAC", warm: true, r: 3.4, pulseClass: "holiday-bulb-a" },
  { cx: 135, cy: 30, color: "#C64351", warm: false, r: 3.6, pulseClass: "" },
  { cx: 200, cy: 35, color: "#FFEFC9", warm: true, r: 4.1, pulseClass: "holiday-bulb-b" },
  { cx: 265, cy: 30, color: "#2D7560", warm: false, r: 3.4, pulseClass: "" },
  { cx: 335, cy: 19, color: "#E6C27A", warm: true, r: 3.4, pulseClass: "holiday-bulb-c" },
  // Swag 2 (400 -> 800)
  { cx: 465, cy: 19, color: "#FFEFC9", warm: true, r: 3.4, pulseClass: "holiday-bulb-b" },
  { cx: 535, cy: 30, color: "#2D7560", warm: false, r: 3.4, pulseClass: "" },
  { cx: 600, cy: 35, color: "#F6DFAC", warm: true, r: 4.1, pulseClass: "holiday-bulb-c" },
  { cx: 665, cy: 30, color: "#C64351", warm: false, r: 3.6, pulseClass: "" },
  { cx: 735, cy: 19, color: "#FFEFC9", warm: true, r: 3.4, pulseClass: "holiday-bulb-a" },
  // Swag 3 (800 -> 1200)
  { cx: 865, cy: 19, color: "#E6C27A", warm: true, r: 3.4, pulseClass: "holiday-bulb-c" },
  { cx: 935, cy: 30, color: "#C64351", warm: false, r: 3.6, pulseClass: "" },
  { cx: 1000, cy: 35, color: "#FFEFC9", warm: true, r: 4.1, pulseClass: "holiday-bulb-a" },
  { cx: 1065, cy: 30, color: "#2D7560", warm: false, r: 3.4, pulseClass: "" },
  { cx: 1135, cy: 19, color: "#F6DFAC", warm: true, r: 3.4, pulseClass: "holiday-bulb-b" },
  // Swag 4 (1200 -> 1600)
  { cx: 1265, cy: 19, color: "#FFEFC9", warm: true, r: 3.4, pulseClass: "holiday-bulb-a" },
  { cx: 1335, cy: 30, color: "#2D7560", warm: false, r: 3.4, pulseClass: "" },
  { cx: 1400, cy: 35, color: "#E6C27A", warm: true, r: 4.1, pulseClass: "holiday-bulb-b" },
  { cx: 1465, cy: 30, color: "#C64351", warm: false, r: 3.6, pulseClass: "" },
  { cx: 1535, cy: 19, color: "#FFEFC9", warm: true, r: 3.4, pulseClass: "holiday-bulb-c" },
];

const PINE_CLUSTERS = [0, 400, 800, 1200, 1600];
const CENTER_STARS = [200, 600, 1000, 1400];

export default function WinterGarland() {
  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[55] pointer-events-none select-none h-11 sm:h-14 overflow-hidden"
    >
      <svg
        viewBox="0 0 1600 58"
        preserveAspectRatio="xMidYMin slice"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="nordicWarmHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFEFC9" stopOpacity="0.78" />
            <stop offset="45%" stopColor="#D9A94F" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#D9A94F" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Secondary fine champagne filigree wire */}
        <path
          d="M0 3 Q200 42 400 3 Q600 42 800 3 Q1000 42 1200 3 Q1400 42 1600 3"
          stroke="#D9B26F"
          strokeOpacity="0.35"
          strokeWidth="1"
        />

        {/* Primary evergreen pine & antique brass draped wire */}
        <path
          d="M0 3 Q200 52 400 3 Q600 52 800 3 Q1000 52 1200 3 Q1400 52 1600 3"
          stroke="#255E4D"
          strokeOpacity="0.82"
          strokeWidth="2.4"
        />
        <path
          d="M0 3 Q200 52 400 3 Q600 52 800 3 Q1000 52 1200 3 Q1400 52 1600 3"
          stroke="#C89F59"
          strokeOpacity="0.58"
          strokeWidth="1.1"
          strokeDasharray="6 8"
        />

        {/* Rich evergreen pine needle swags & holly clusters at anchor points */}
        {PINE_CLUSTERS.map((x) => (
          <g key={x} transform={`translate(${x}, 2)`}>
            <path
              d="M-36 9 Q-18 3 0 1 Q18 3 36 9"
              stroke="#1E4D3F"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M-26 14 L-8 2 M-18 17 L-4 3 M-10 19 L-1 3 M26 14 L8 2 M18 17 L4 3 M10 19 L1 3 M0 20 L0 2"
              stroke="#2E7560"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            {/* Crimson berries + central brass pearl */}
            <circle cx="-6" cy="8" r="2.3" fill="#C64351" />
            <circle cx="6" cy="8" r="2.3" fill="#C64351" />
            <circle cx="0" cy="11" r="2.1" fill="#A62B38" />
            <circle cx="0" cy="5" r="2.6" fill="#E6C27A" />
            <circle cx="-0.7" cy="4.3" r="0.8" fill="#FFFDF7" />
          </g>
        ))}

        {/* Small suspended 4-point brass stars at the lowest point of each swag */}
        {CENTER_STARS.map((x) => (
          <g key={x} transform={`translate(${x}, 43)`}>
            <line x1="0" y1="-6" x2="0" y2="1" stroke="#D9B26F" strokeOpacity="0.7" strokeWidth="0.9" />
            <path
              d="M0 0 L1.8 4.2 L6 6 L1.8 7.8 L0 12 L-1.8 7.8 L-6 6 L-1.8 4.2 Z"
              fill="#E6C27A"
            />
          </g>
        ))}

        {/* Warm breathing tungsten fairy bulbs & baubles */}
        {SWAG_BULBS.map((b, idx) => (
          <g key={idx} className={b.pulseClass || undefined}>
            {b.warm && (
              <circle
                cx={b.cx}
                cy={b.cy + 3.2}
                r={b.r * 3.8}
                fill="url(#nordicWarmHalo)"
              />
            )}
            <rect
              x={b.cx - 1.6}
              y={b.cy - 2.6}
              width="3.2"
              height="3"
              rx="0.7"
              fill="#B38C4A"
            />
            <circle
              cx={b.cx}
              cy={b.cy + 3}
              r={b.r}
              fill={b.color}
              fillOpacity={b.warm ? "0.98" : "0.92"}
            />
            <circle
              cx={b.cx - b.r * 0.32}
              cy={b.cy + 1.8}
              r={b.r * 0.3}
              fill="#FFFDF7"
              fillOpacity="0.78"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
