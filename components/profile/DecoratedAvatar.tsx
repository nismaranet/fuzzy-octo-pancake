"use client";

import React, { useId } from "react";
import {
  isUserStaffRole,
  isUserTopManagerActive,
  resolveActiveDecorationDef,
  type AvatarDecorationDef,
} from "@/lib/avatarDecorations";
import { useAvatarDecorationFromCatalog } from "@/components/profile/AvatarDecorationProvider";

interface DecoratedAvatarProps {
  src?: string | null;
  alt: string;
  /** Inisial/teks fallback saat src kosong (opsional; fallback ke /placeholder-avatar.png jika tidak diisi) */
  fallbackText?: string;
  /** Definisi dekorasi lengkap (opsional; otomatis lookup ke katalog global jika decorationId diisi) */
  decoration?: AvatarDecorationDef | null;
  /** ID/slug dekorasi dari dokumen users (otomatis lookup ke katalog MongoDB global) */
  decorationId?: string | null;
  /** Status kelayakan pemilik avatar */
  isNismaraPlus?: boolean;
  isStaff?: boolean;
  isTopManager?: boolean;
  /** Shorthand otomatis untuk mengecek status Staff & Top Manager */
  userRole?: string | null;
  topManager?: { status?: boolean; expiredAt?: string | Date | null } | null;
  ownedDecorationIds?: string[];
  /** Jika true, tampilkan dekorasi tanpa cek akses/jadwal (khusus pratinjau di Settings/CMS atau sudah di-resolve server) */
  forcePreview?: boolean;
  /** Ukuran kontainer avatar (contoh: "w-32 h-32 md:w-44 md:h-44" atau "w-10 h-10") */
  sizeClass?: string;
  /** Kelas border/ring pada lingkaran avatar bagian dalam */
  frameClass?: string;
  /** Warna border kustom (opsional, misal rankColor) */
  borderColor?: string;
  /** Warna fallback latar belakang avatar */
  fallbackBg?: string;
  className?: string;
}

function DecorationSvgOverlay({
  presetKey,
  uid,
}: {
  presetKey: string;
  uid: string;
}) {
  switch (presetKey) {
    case "nismara-aurora":
      return (
        <svg
          viewBox="0 0 128 128"
          fill="none"
          className="size-full overflow-visible"
        >
          <defs>
            <linearGradient
              id={`${uid}-aur1`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="48%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <linearGradient
              id={`${uid}-aur2`}
              x1="100%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#818cf8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#e879f9" stopOpacity="0.95" />
            </linearGradient>
            <filter
              id={`${uid}-glow`}
              x="-25%"
              y="-25%"
              width="150%"
              height="150%"
            >
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer Aurora Orbit */}
          <g className="avd-spin-slow" filter={`url(#${uid}-glow)`}>
            <circle
              cx="64"
              cy="64"
              r="52"
              stroke={`url(#${uid}-aur1)`}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeDasharray="135 32 95 65"
            />
            <circle
              cx="64"
              cy="64"
              r="56.5"
              stroke={`url(#${uid}-aur2)`}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeDasharray="60 40 90 165"
            />
          </g>

          {/* Counter-rotating Star Glints */}
          <g className="avd-spin-reverse">
            <path
              d="M64 3 L65.8 8.2 L71 10 L65.8 11.8 L64 17 L62.2 11.8 L57 10 L62.2 8.2 Z"
              fill="#e0f2fe"
              className="avd-twinkle"
            />
            <path
              d="M112 88 L113.3 91.5 L116.8 92.8 L113.3 94.1 L112 97.6 L110.7 94.1 L107.2 92.8 L110.7 91.5 Z"
              fill="#ddd6fe"
              className="avd-twinkle-delay"
            />
            <circle
              cx="16"
              cy="40"
              r="2.2"
              fill="#38bdf8"
              className="avd-twinkle-delay"
            />
            <circle
              cx="111"
              cy="36"
              r="1.8"
              fill="#c084fc"
              className="avd-twinkle"
            />
          </g>
        </svg>
      );

    case "golden-laurel":
      return (
        <svg
          viewBox="0 0 128 128"
          fill="none"
          className="size-full overflow-visible"
        >
          <defs>
            <linearGradient
              id={`${uid}-gold`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="45%" stopColor="#f59e0b" />
              <stop offset="80%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#fde047" />
            </linearGradient>
            <linearGradient
              id={`${uid}-goldShine`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="50%" stopColor="#fef9c3" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <filter
              id={`${uid}-gGlow`}
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="1.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Base Gold Rim */}
          <circle
            cx="64"
            cy="64"
            r="51.5"
            stroke={`url(#${uid}-gold)`}
            strokeWidth="3"
          />
          <circle
            cx="64"
            cy="64"
            r="55.5"
            stroke={`url(#${uid}-gold)`}
            strokeWidth="1"
            strokeOpacity="0.5"
          />

          {/* Travelling Shimmer Arc */}
          <g className="avd-spin-slow">
            <circle
              cx="64"
              cy="64"
              r="51.5"
              stroke={`url(#${uid}-goldShine)`}
              strokeWidth="3.6"
              strokeLinecap="round"
              strokeDasharray="46 280"
            />
          </g>

          {/* Left Laurel Leaves */}
          <g fill={`url(#${uid}-gold)`} filter={`url(#${uid}-gGlow)`}>
            <ellipse
              cx="14"
              cy="70"
              rx="4.2"
              ry="2.2"
              transform="rotate(20 14 70)"
            />
            <ellipse
              cx="17"
              cy="82"
              rx="4.4"
              ry="2.2"
              transform="rotate(38 17 82)"
            />
            <ellipse
              cx="24"
              cy="94"
              rx="4.6"
              ry="2.3"
              transform="rotate(52 24 94)"
            />
            <ellipse
              cx="34"
              cy="104"
              rx="4.8"
              ry="2.3"
              transform="rotate(66 34 104)"
            />
            <ellipse
              cx="47"
              cy="111"
              rx="4.6"
              ry="2.2"
              transform="rotate(78 47 111)"
            />
            <ellipse
              cx="14"
              cy="58"
              rx="3.8"
              ry="2"
              transform="rotate(-12 14 58)"
            />
          </g>

          {/* Right Laurel Leaves */}
          <g fill={`url(#${uid}-gold)`} filter={`url(#${uid}-gGlow)`}>
            <ellipse
              cx="114"
              cy="70"
              rx="4.2"
              ry="2.2"
              transform="rotate(-20 114 70)"
            />
            <ellipse
              cx="111"
              cy="82"
              rx="4.4"
              ry="2.2"
              transform="rotate(-38 111 82)"
            />
            <ellipse
              cx="104"
              cy="94"
              rx="4.6"
              ry="2.3"
              transform="rotate(-52 104 94)"
            />
            <ellipse
              cx="94"
              cy="104"
              rx="4.8"
              ry="2.3"
              transform="rotate(-66 94 104)"
            />
            <ellipse
              cx="81"
              cy="111"
              rx="4.6"
              ry="2.2"
              transform="rotate(-78 81 111)"
            />
            <ellipse
              cx="114"
              cy="58"
              rx="3.8"
              ry="2"
              transform="rotate(12 114 58)"
            />
          </g>

          {/* Bottom Laurel Knot Gem */}
          <path
            d="M64 111 L68 115.5 L64 120 L60 115.5 Z"
            fill="#fef08a"
            stroke="#b45309"
            strokeWidth="1"
          />

          {/* Top Minimalist Crown */}
          <g filter={`url(#${uid}-gGlow)`} className="avd-float">
            <path
              d="M52 15 L54.5 6.5 L60.5 11.5 L64 4.5 L67.5 11.5 L73.5 6.5 L76 15 Z"
              fill={`url(#${uid}-gold)`}
              stroke="#78350f"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
            <circle cx="64" cy="4.5" r="1.6" fill="#fef9c3" />
          </g>
        </svg>
      );

    case "highway-tachometer":
      return (
        <svg
          viewBox="0 0 128 128"
          fill="none"
          className="size-full overflow-visible"
        >
          <defs>
            <linearGradient
              id={`${uid}-rpm`}
              x1="0%"
              y1="100%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="62%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <filter
              id={`${uid}-rGlow`}
              x="-25%"
              y="-25%"
              width="150%"
              height="150%"
            >
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Metallic Bezel Ring */}
          <circle cx="64" cy="64" r="52.5" stroke="#334155" strokeWidth="4.2" />
          <circle
            cx="64"
            cy="64"
            r="55"
            stroke="#64748b"
            strokeWidth="1"
            strokeOpacity="0.6"
          />

          {/* Active RPM Arc */}
          <circle
            cx="64"
            cy="64"
            r="52.5"
            stroke={`url(#${uid}-rpm)`}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeDasharray="225 105"
            transform="rotate(135 64 64)"
            filter={`url(#${uid}-rGlow)`}
          />

          {/* Redline Zone Arc (Top-Right) */}
          <circle
            cx="64"
            cy="64"
            r="57.5"
            stroke="#ef4444"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="48 315"
            transform="rotate(-25 64 64)"
            className="avd-twinkle"
            filter={`url(#${uid}-rGlow)`}
          />

          {/* Calibrated Tick Marks around bezel */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = i * 30;
            const isRedline = angle >= 30 && angle <= 90;
            return (
              <line
                key={i}
                x1="64"
                y1="6.5"
                x2="64"
                y2="11"
                stroke={isRedline ? "#ef4444" : "#cbd5e1"}
                strokeWidth={i % 3 === 0 ? "2" : "1.2"}
                strokeLinecap="round"
                transform={`rotate(${angle} 64 64)`}
              />
            );
          })}

          {/* Sweeping Telemetry Pulse Dot */}
          <g className="avd-spin-medium">
            <circle
              cx="64"
              cy="11.5"
              r="2.8"
              fill="#fef08a"
              filter={`url(#${uid}-rGlow)`}
            />
          </g>
        </svg>
      );

    case "sakura-breeze":
      return (
        <svg
          viewBox="0 0 128 128"
          fill="none"
          className="size-full overflow-visible"
        >
          <defs>
            <linearGradient
              id={`${uid}-sak`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#fbcfe8" />
              <stop offset="50%" stopColor="#f472b6" />
              <stop offset="100%" stopColor="#fda4af" />
            </linearGradient>
            <filter
              id={`${uid}-sGlow`}
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="1.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Soft Pink Ring */}
          <circle
            cx="64"
            cy="64"
            r="51.5"
            stroke={`url(#${uid}-sak)`}
            strokeWidth="2.8"
          />
          <circle
            cx="64"
            cy="64"
            r="55.5"
            stroke="#fbcfe8"
            strokeWidth="1.2"
            strokeOpacity="0.6"
            strokeDasharray="12 10"
            className="avd-spin-slow"
          />

          {/* Top-Left Blossom */}
          <g
            transform="translate(22 23)"
            filter={`url(#${uid}-sGlow)`}
            className="avd-float"
          >
            {[0, 72, 144, 216, 288].map((deg) => (
              <ellipse
                key={deg}
                cx="0"
                cy="-6.2"
                rx="3.6"
                ry="5.8"
                fill="#fbcfe8"
                stroke="#f472b6"
                strokeWidth="0.7"
                transform={`rotate(${deg})`}
              />
            ))}
            <circle cx="0" cy="0" r="2.6" fill="#fef08a" />
          </g>

          {/* Bottom-Right Blossom */}
          <g
            transform="translate(105 103) scale(0.92)"
            filter={`url(#${uid}-sGlow)`}
            className="avd-float"
          >
            {[18, 90, 162, 234, 306].map((deg) => (
              <ellipse
                key={deg}
                cx="0"
                cy="-6.2"
                rx="3.6"
                ry="5.8"
                fill="#fce7f3"
                stroke="#f472b6"
                strokeWidth="0.7"
                transform={`rotate(${deg})`}
              />
            ))}
            <circle cx="0" cy="0" r="2.5" fill="#fde047" />
          </g>

          {/* Small Accent Blossom Top-Right */}
          <g transform="translate(104 26) scale(0.55)" className="avd-twinkle">
            {[0, 72, 144, 216, 288].map((deg) => (
              <ellipse
                key={deg}
                cx="0"
                cy="-6"
                rx="3.4"
                ry="5.4"
                fill="#fda4af"
                transform={`rotate(${deg})`}
              />
            ))}
            <circle cx="0" cy="0" r="2.2" fill="#fffbeb" />
          </g>

          {/* Drifting Loose Petals */}
          <g className="avd-spin-reverse">
            <path
              d="M12 86 C15 83, 19 85, 17 89 C15 91, 11 89, 12 86 Z"
              fill="#fbcfe8"
            />
            <path
              d="M74 9 C78 7, 81 10, 78 13 C75 15, 72 12, 74 9 Z"
              fill="#f9a8d4"
            />
            <path
              d="M44 117 C48 115, 51 118, 48 121 C45 122, 42 119, 44 117 Z"
              fill="#fda4af"
            />
          </g>
        </svg>
      );

    case "cyber-prism":
      return (
        <svg
          viewBox="0 0 128 128"
          fill="none"
          className="size-full overflow-visible"
        >
          <defs>
            <linearGradient
              id={`${uid}-cyb`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
            <filter
              id={`${uid}-cGlow`}
              x="-25%"
              y="-25%"
              width="150%"
              height="150%"
            >
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Inner Precision HUD Ring */}
          <circle
            cx="64"
            cy="64"
            r="51.5"
            stroke={`url(#${uid}-cyb)`}
            strokeWidth="2.4"
            filter={`url(#${uid}-cGlow)`}
          />

          {/* Rotating Segmented Arcs */}
          <g className="avd-spin-medium">
            <circle
              cx="64"
              cy="64"
              r="56.5"
              stroke="#22d3ee"
              strokeWidth="2.6"
              strokeDasharray="28 18 10 18 42 240"
              strokeLinecap="butt"
              filter={`url(#${uid}-cGlow)`}
            />
          </g>

          {/* Counter-Rotating Outer Telemetry Ring */}
          <g className="avd-spin-reverse">
            <circle
              cx="64"
              cy="64"
              r="59.5"
              stroke="#ec4899"
              strokeWidth="1.5"
              strokeDasharray="16 24 6 24"
              strokeOpacity="0.85"
            />
          </g>

          {/* 4 Cardinal HUD Nodes */}
          <rect
            x="61.5"
            y="4.5"
            width="5"
            height="5"
            rx="1"
            fill="#22d3ee"
            transform="rotate(45 64 7)"
            className="avd-twinkle"
          />
          <rect
            x="61.5"
            y="118.5"
            width="5"
            height="5"
            rx="1"
            fill="#ec4899"
            transform="rotate(45 64 121)"
            className="avd-twinkle-delay"
          />
          <rect
            x="4.5"
            y="61.5"
            width="5"
            height="5"
            rx="1"
            fill="#818cf8"
            transform="rotate(45 7 64)"
            className="avd-twinkle-delay"
          />
          <rect
            x="118.5"
            y="61.5"
            width="5"
            height="5"
            rx="1"
            fill="#22d3ee"
            transform="rotate(45 121 64)"
            className="avd-twinkle"
          />
        </svg>
      );

    case "solar-eclipse":
      return (
        <svg
          viewBox="0 0 128 128"
          fill="none"
          className="size-full overflow-visible"
        >
          <defs>
            <linearGradient
              id={`${uid}-sol1`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="35%" stopColor="#fb923c" />
              <stop offset="70%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#fde047" />
            </linearGradient>
            <filter
              id={`${uid}-solGlow`}
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feGaussianBlur stdDeviation="2.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Glowing Corona Halo */}
          <circle
            cx="64"
            cy="64"
            r="53"
            stroke={`url(#${uid}-sol1)`}
            strokeWidth="4.2"
            strokeOpacity="0.85"
            filter={`url(#${uid}-solGlow)`}
          />
          {/* Dark Eclipse Rim Contrast */}
          <circle cx="64" cy="64" r="50.2" stroke="#1c1917" strokeWidth="2.2" />

          {/* Sweeping Solar Flare Arcs */}
          <g className="avd-spin-slow" filter={`url(#${uid}-solGlow)`}>
            <path
              d="M24 28 C38 11, 66 5, 92 16"
              stroke="#fef08a"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <path
              d="M106 96 C92 114, 62 122, 34 110"
              stroke="#fb923c"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <circle
              cx="96"
              cy="18"
              r="2.2"
              fill="#fef9c3"
              className="avd-twinkle"
            />
            <circle
              cx="29"
              cy="108"
              r="2"
              fill="#fdba74"
              className="avd-twinkle-delay"
            />
          </g>

          {/* Ember Sparks */}
          <g className="avd-spin-reverse">
            <circle
              cx="115"
              cy="52"
              r="1.8"
              fill="#fde047"
              className="avd-twinkle"
            />
            <circle
              cx="12"
              cy="76"
              r="1.6"
              fill="#fb923c"
              className="avd-twinkle-delay"
            />
            <circle
              cx="52"
              cy="7"
              r="1.4"
              fill="#fef08a"
              className="avd-twinkle-delay"
            />
          </g>
        </svg>
      );

    default:
      return null;
  }
}

export default function DecoratedAvatar({
  src,
  alt,
  fallbackText,
  decoration: decorationProp,
  decorationId,
  isNismaraPlus = false,
  isStaff = false,
  isTopManager = false,
  userRole,
  topManager,
  ownedDecorationIds,
  forcePreview = false,
  sizeClass = "w-12 h-12",
  frameClass = "border-2 border-background",
  borderColor,
  fallbackBg,
  className = "",
}: DecoratedAvatarProps) {
  const rawUid = useId();
  const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, "");
  const catalogDef = useAvatarDecorationFromCatalog(decorationId);

  const rawDef = decorationProp ?? catalogDef;
  const effectiveIsStaff = isStaff || isUserStaffRole(userRole);
  const effectiveIsTopManager =
    isTopManager || isUserTopManagerActive(topManager);

  const decoration = forcePreview
    ? rawDef
    : resolveActiveDecorationDef(rawDef, {
        isNismaraPlus,
        isStaff: effectiveIsStaff,
        isTopManager: effectiveIsTopManager,
        ownedDecorationIds,
      });

  const scale = decoration?.scale ?? 1.28;
  const presetKey = decoration?.svgPresetKey || decoration?.id || "";

  const isCssColor = Boolean(
    fallbackBg && /^(#|rgb|hsl|var\()/i.test(fallbackBg.trim()),
  );
  const fallbackBgClass = fallbackBg && !isCssColor ? fallbackBg : "";

  const frameStyle: React.CSSProperties | undefined =
    (isCssColor && fallbackBg) || borderColor
      ? {
          ...(isCssColor && fallbackBg ? { backgroundColor: fallbackBg } : {}),
          ...(borderColor ? { borderColor } : {}),
        }
      : undefined;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${sizeClass} ${className}`}
    >
      {/* Circular Avatar Base */}
      <div
        className={`w-full h-full rounded-full overflow-hidden shadow-xl ${frameClass} ${!src && fallbackText ? fallbackBgClass : ""}`}
        style={frameStyle}
      >
        {src ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
          />
        ) : fallbackText ? (
          <div className="w-full h-full flex items-center justify-center font-bold uppercase text-xs select-none">
            {fallbackText}
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src="/placeholder-avatar.png"
            alt={alt}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Overhanging Decoration Layer (Discord-style, mendukung GIF/APNG/WebP/PNG & SVG) */}
      {decoration && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none select-none flex items-center justify-center z-10 [&_svg]:size-full"
          style={{ transform: `scale(${scale})` }}
        >
          {decoration.renderType === "image" && decoration.assetUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={decoration.assetUrl}
              alt=""
              className="w-full h-full object-contain"
              draggable={false}
            />
          ) : (
            <DecorationSvgOverlay presetKey={presetKey} uid={uid} />
          )}
        </div>
      )}
    </div>
  );
}
