"use client";

import React, { useEffect, useRef } from "react";
import {
  playFireworkLaunchSound,
  playFireworkBurstSound,
} from "@/lib/holidaySound";

interface Rocket {
  x: number;
  y: number;
  targetY: number;
  vx: number;
  vy: number;
  palette: string[];
  sparkCount: number;
  trail: Array<{ x: number; y: number }>;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
  size: number;
  color: string;
  twinkle: boolean;
  trail: Array<{ x: number; y: number }>;
}

interface Flash {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: string;
}

const DARK_PALETTES = [
  ["#FFF8E6", "#F5D99B", "#D9A94F"], // Royal Champagne Gold
  ["#FFF4DC", "#E05263", "#E6C27A"], // Winter Crimson & Champagne
  ["#FFF8E6", "#42B892", "#E6C27A"], // Nordic Emerald & Gold
  ["#FFFFFF", "#F8E3B4", "#C9963B"], // Grand Willow Gold
];

const LIGHT_PALETTES = [
  ["#8A5D18", "#C49133", "#6B4510"], // Deep Antique Brass
  ["#9E2A35", "#C43B49", "#8A5D18"], // Deep Crimson & Brass
  ["#1B4D3E", "#2E7D63", "#8A5D18"], // Evergreen Pine & Brass
];

export default function NewYearFireworksCanvas({
  burstSignal,
  soundEnabled = true,
  onComplete,
}: {
  burstSignal: number;
  soundEnabled?: boolean;
  onComplete?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  useEffect(() => {
    if (burstSignal <= 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const isDark = document.documentElement.classList.contains("dark");
    const palettes = isDark ? DARK_PALETTES : LIGHT_PALETTES;
    const isMobile = width < 640;

    const launchPlan = [
      { delayMs: 0, startX: 0.24, targetY: 0.26, palette: palettes[0], sparks: isMobile ? 55 : 85 },
      { delayMs: 240, startX: 0.74, targetY: 0.23, palette: palettes[1], sparks: isMobile ? 55 : 85 },
      { delayMs: 520, startX: 0.5, targetY: 0.19, palette: palettes[palettes.length - 1], sparks: isMobile ? 70 : 110 },
      { delayMs: 860, startX: 0.36, targetY: 0.32, palette: palettes[2], sparks: isMobile ? 50 : 80 },
      { delayMs: 1120, startX: 0.64, targetY: 0.29, palette: palettes[0], sparks: isMobile ? 55 : 88 },
      { delayMs: 1480, startX: 0.2, targetY: 0.34, palette: palettes[1], sparks: isMobile ? 50 : 76 },
      { delayMs: 1620, startX: 0.8, targetY: 0.27, palette: palettes[palettes.length - 1], sparks: isMobile ? 65 : 100 },
    ];

    const rockets: Rocket[] = [];
    const sparks: Spark[] = [];
    const flashes: Flash[] = [];
    const timeouts: number[] = [];
    let allLaunched = false;

    const explode = (rocket: Rocket) => {
      if (soundEnabledRef.current) {
        playFireworkBurstSound(0.34);
      }

      flashes.push({
        x: rocket.x,
        y: rocket.y,
        radius: isMobile ? 85 : 135,
        alpha: isDark ? 0.32 : 0.2,
        color: rocket.palette[0],
      });

      // Outer chrysanthemum ring + inner golden core ring
      for (let i = 0; i < rocket.sparkCount; i++) {
        const isInnerRing = i % 3 === 0;
        const angle = (Math.PI * 2 * i) / rocket.sparkCount + (Math.random() - 0.5) * 0.16;
        const baseSpeed = isInnerRing
          ? (isMobile ? 1.6 : 2.3) + Math.random() * 1.8
          : (isMobile ? 3.2 : 4.6) + Math.random() * (isMobile ? 2.6 : 3.8);

        sparks.push({
          x: rocket.x,
          y: rocket.y,
          vx: Math.cos(angle) * baseSpeed,
          vy: Math.sin(angle) * baseSpeed,
          alpha: 1,
          decay: isInnerRing ? 0.015 + Math.random() * 0.008 : 0.01 + Math.random() * 0.009,
          size: isInnerRing ? 1.8 + Math.random() * 1.1 : 2.1 + Math.random() * 1.6,
          color: rocket.palette[i % rocket.palette.length],
          twinkle: i % 4 === 0,
          trail: [{ x: rocket.x, y: rocket.y }],
        });
      }
    };

    launchPlan.forEach((plan, idx) => {
      const t = window.setTimeout(() => {
        const startX = width * plan.startX + (Math.random() - 0.5) * 30;
        const startY = height + 10;
        const targetY = height * plan.targetY;
        const travelFrames = 26;
        rockets.push({
          x: startX,
          y: startY,
          targetY,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -(startY - targetY) / travelFrames,
          palette: plan.palette,
          sparkCount: plan.sparks,
          trail: [{ x: startX, y: startY }],
        });
        if (soundEnabledRef.current) {
          playFireworkLaunchSound(0.2);
        }
        if (idx === launchPlan.length - 1) {
          allLaunched = true;
        }
      }, plan.delayMs);
      timeouts.push(t);
    });

    window.addEventListener("resize", resize);

    let animId = 0;
    let tick = 0;
    const render = () => {
      tick += 1;
      ctx.clearRect(0, 0, width, height);

      // 1. Subtle radial sky flash at detonation points
      for (let i = flashes.length - 1; i >= 0; i--) {
        const fl = flashes[i];
        fl.alpha -= 0.028;
        fl.radius += 2.5;
        if (fl.alpha <= 0.01) {
          flashes.splice(i, 1);
          continue;
        }
        const grad = ctx.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, fl.radius);
        grad.addColorStop(0, fl.color);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.save();
        ctx.globalAlpha = fl.alpha;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(fl.x, fl.y, fl.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. Rising champagne rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.x += r.vx;
        r.y += r.vy;
        r.vy *= 0.985;
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 9) r.trail.shift();

        if (r.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(r.trail[0].x, r.trail[0].y);
          for (let j = 1; j < r.trail.length; j++) {
            ctx.lineTo(r.trail[j].x, r.trail[j].y);
          }
          ctx.strokeStyle = isDark ? "#F5D99B" : "#9A6A1D";
          ctx.lineWidth = 2.2;
          ctx.lineCap = "round";
          ctx.globalAlpha = 0.85;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "#FFFDF7" : "#8A5D18";
        ctx.globalAlpha = 1;
        ctx.fill();

        if (r.y <= r.targetY || r.vy >= -2.5) {
          explode(r);
          rockets.splice(i, 1);
        }
      }

      // 3. Burst sparks & willow trails
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > 8) s.trail.shift();

        s.vx *= 0.976;
        s.vy = s.vy * 0.976 + 0.062;
        s.x += s.vx;
        s.y += s.vy;
        s.alpha -= s.decay;

        if (s.alpha <= 0.02) {
          sparks.splice(i, 1);
          continue;
        }

        const flicker = s.twinkle && tick % 4 < 2 ? 0.55 : 1;

        if (s.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(s.trail[0].x, s.trail[0].y);
          for (let j = 1; j < s.trail.length; j++) {
            ctx.lineTo(s.trail[j].x, s.trail[j].y);
          }
          ctx.strokeStyle = s.color;
          ctx.globalAlpha = s.alpha * 0.55 * flicker;
          ctx.lineWidth = s.size * 0.9;
          ctx.lineCap = "round";
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = s.alpha * flicker;
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      if (allLaunched && rockets.length === 0 && sparks.length === 0 && flashes.length === 0) {
        ctx.clearRect(0, 0, width, height);
        onCompleteRef.current?.();
        return;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      timeouts.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, width, height);
    };
  }, [burstSignal]);

  if (burstSignal <= 0) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-[90] pointer-events-none"
    />
  );
}
