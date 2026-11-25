"use client";

import React, { useState } from "react";
import { X } from "lucide-react";

const DRIVER_BLESSINGS = [
  "Semoga setiap rute akhir tahunmu bebas hambatan, minim kerusakan, dan penuh cerita seru di jalan.",
  "Salam hangat dari keluarga besar Nismara Transport. Jaga kecepatan dan nikmati kebersamaan akhir tahun.",
  "Satu tahun penuh kilometer bersama telah terlewati. Siapkan armada terbaikmu untuk musim baru.",
  "Terima kasih telah menjadi bagian dari konvoi dan perjalanan Nismara Transport tahun ini.",
];

export default function WinterCornerSprigs({
  onTriggerFireworks,
}: {
  onTriggerFireworks: () => void;
}) {
  const [blessingIdx, setBlessingIdx] = useState<number | null>(null);
  const [swingPulse, setSwingPulse] = useState(false);

  const handleBaubleClick = () => {
    setSwingPulse(true);
    window.setTimeout(() => setSwingPulse(false), 700);
    setBlessingIdx((prev) => (prev === null ? 0 : (prev + 1) % DRIVER_BLESSINGS.length));
    onTriggerFireworks();
  };

  return (
    <>
      {/* 1. Botanical Evergreen Pine & Brass Bough (Bottom-Left Desktop, lifted above edge) */}
      <div
        aria-hidden="true"
        className="hidden lg:block fixed bottom-6 left-0 z-30 pointer-events-none select-none w-60 h-48 opacity-90 dark:opacity-85"
      >
        <svg
          viewBox="0 0 240 190"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            <radialGradient id="baubleGold" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FFF5D6" />
              <stop offset="55%" stopColor="#D9A94F" />
              <stop offset="100%" stopColor="#8C6220" />
            </radialGradient>
            <radialGradient id="baubleCrimson" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#F28A95" />
              <stop offset="55%" stopColor="#B83B47" />
              <stop offset="100%" stopColor="#6E1C26" />
            </radialGradient>
          </defs>

          {/* Main layered evergreen branches */}
          <path
            d="M-10 170 C34 142, 86 128, 162 126"
            stroke="#1B4D3E"
            strokeWidth="3.6"
            strokeLinecap="round"
          />
          <path
            d="M8 168 C32 122, 52 80, 74 36"
            stroke="#245F4D"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M46 144 C78 156, 112 162, 146 164"
            stroke="#245F4D"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Lush pine needles along horizontal bough */}
          <g stroke="#2F7A63" strokeWidth="1.6" strokeLinecap="round">
            <path d="M22 152 L14 130 M34 146 L30 124 M48 140 L48 118 M64 135 L66 114" />
            <path d="M82 132 L86 112 M100 129 L106 110 M118 128 L126 110 M136 127 L148 112" />
            <path d="M36 146 L52 164 M62 136 L80 156 M88 131 L108 148 M116 128 L138 142" />
          </g>

          {/* Lush pine needles along upright bough */}
          <g stroke="#2B705B" strokeWidth="1.5" strokeLinecap="round">
            <path d="M22 142 L6 128 M32 122 L16 106 M42 102 L26 86 M52 82 L36 66 M62 62 L48 46" />
            <path d="M32 122 L54 114 M42 102 L66 94 M52 82 L76 74 M62 62 L84 56" />
          </g>

          {/* Holly berries cluster */}
          <circle cx="42" cy="140" r="4.2" fill="url(#baubleCrimson)" />
          <circle cx="51" cy="146" r="3.6" fill="url(#baubleCrimson)" />
          <circle cx="49" cy="134" r="3.2" fill="#D14B59" />

          {/* Hanging brushed gold bauble */}
          <line x1="110" y1="128" x2="110" y2="146" stroke="#D9B26F" strokeWidth="1.1" />
          <rect x="106.5" y="145" width="7" height="3.5" rx="1" fill="#B5893D" />
          <circle cx="110" cy="158" r="10.5" fill="url(#baubleGold)" />
          <path d="M101 158 Q110 163 119 158" stroke="#FFF4D1" strokeOpacity="0.45" strokeWidth="1" />

          {/* Hanging Nordic brass 4-point star */}
          <line x1="146" y1="126" x2="146" y2="142" stroke="#D9B26F" strokeWidth="1" />
          <path
            d="M146 141 L148.8 147.8 L155.5 150.5 L148.8 153.2 L146 160 L143.2 153.2 L136.5 150.5 L143.2 147.8 Z"
            fill="#E6C27A"
          />
          <circle cx="146" cy="150.5" r="1.5" fill="#FFFDF7" />

          {/* Upper golden star finial */}
          <path
            d="M74 28 L76 33.2 L81.2 35.2 L76 37.2 L74 42.4 L72 37.2 L66.8 35.2 L72 33.2 Z"
            fill="#E6C27A"
          />
        </svg>
      </div>

      {/* 2. Interactive Hanging Champagne Ornament (Top-Right Desktop Easter Egg) */}
      <div className="hidden md:flex fixed top-9 right-7 z-[58] flex-col items-end gap-2 pointer-events-none">
        <button
          type="button"
          onClick={handleBaubleClick}
          title="Klik ornamen untuk menyalakan kembang api dan ucapan akhir tahun"
          aria-label="Klik ornamen Natal untuk menyalakan kembang api"
          className={`pointer-events-auto holiday-ornament-sway group relative flex flex-col items-center p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer transition-transform ${
            swingPulse ? "scale-110" : "hover:scale-105"
          }`}
        >
          <svg
            width="44"
            height="72"
            viewBox="0 0 44 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="hangingGoldBauble" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#FFF7DF" />
                <stop offset="45%" stopColor="#E2B660" />
                <stop offset="100%" stopColor="#8E631D" />
              </radialGradient>
            </defs>
            {/* Delicate golden suspension thread */}
            <line x1="22" y1="0" x2="22" y2="27" stroke="#D9B26F" strokeWidth="1.2" strokeOpacity="0.85" />
            {/* Crown cap */}
            <rect x="17.5" y="26" width="9" height="5" rx="1.4" fill="#B5893D" />
            <circle cx="22" cy="24.5" r="2.2" stroke="#E6C27A" strokeWidth="1.2" />
            {/* Main brushed champagne bauble */}
            <circle cx="22" cy="48" r="17" fill="url(#hangingGoldBauble)" />
            {/* Fine geometric Nordic band around bauble */}
            <path
              d="M6.5 48 Q22 55 37.5 48"
              stroke="#6E1C26"
              strokeOpacity="0.72"
              strokeWidth="2.4"
            />
            <path
              d="M22 41 L23.5 45.5 L28 47 L23.5 48.5 L22 53 L20.5 48.5 L16 47 L20.5 45.5 Z"
              fill="#FFF8E6"
              fillOpacity="0.9"
            />
            {/* Soft specular highlight */}
            <ellipse cx="15.5" cy="41" rx="3.2" ry="5" transform="rotate(-24 15.5 41)" fill="#FFFFFF" fillOpacity="0.38" />
          </svg>
        </button>

        {blessingIdx !== null && (
          <div
            role="status"
            className="pointer-events-auto w-72 rounded-xl border border-[#D9B26F]/45 bg-card text-card-foreground shadow-xl p-3.5 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#8A5D18] dark:text-[#E2BF7D]">
                Ucapan Nismara Transport
              </span>
              <button
                type="button"
                aria-label="Tutup ucapan"
                onClick={() => setBlessingIdx(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {DRIVER_BLESSINGS[blessingIdx]}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
