"use client";

import React, { useEffect, useRef } from "react";

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  driftAmp: number;
  driftFreq: number;
  phase: number;
  alpha: number;
  kind: "dot" | "bokeh" | "crystal";
  rotation: number;
  rotSpeed: number;
  warm: boolean;
}

function drawCrystal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rotation: number,
  strokeStyle: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = Math.max(0.9, radius * 0.14);
  ctx.lineCap = "round";

  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -radius);
    // Tiny crystal side branches at 60% length
    const branchY = -radius * 0.6;
    const branchLen = radius * 0.34;
    ctx.moveTo(0, branchY);
    ctx.lineTo(-branchLen * 0.72, branchY - branchLen * 0.65);
    ctx.moveTo(0, branchY);
    ctx.lineTo(branchLen * 0.72, branchY - branchLen * 0.65);
    ctx.stroke();
  }
  ctx.restore();
}

export default function WinterSnowCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const speedFactor = prefersReduced ? 0.55 : 1;

    let animId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let isDark = document.documentElement.classList.contains("dark");
    let paused = document.hidden;

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

    const count = width < 640 ? 32 : width < 1024 ? 50 : 68;
    const flakes: Snowflake[] = Array.from({ length: count }, (_, idx) => {
      const isCrystal = idx % 5 === 0;
      const isBokeh = !isCrystal && idx % 3 === 0;
      const kind: Snowflake["kind"] = isCrystal ? "crystal" : isBokeh ? "bokeh" : "dot";

      return {
        x: Math.random() * width,
        y: Math.random() * height,
        radius:
          kind === "crystal"
            ? 5.5 + Math.random() * 4.5
            : kind === "bokeh"
              ? 2.6 + Math.random() * 1.8
              : 1.4 + Math.random() * 1.1,
        speedY:
          (kind === "crystal"
            ? 0.55 + Math.random() * 0.45
            : kind === "bokeh"
              ? 0.8 + Math.random() * 0.55
              : 0.45 + Math.random() * 0.35) * speedFactor,
        driftAmp: (0.28 + Math.random() * 0.65) * speedFactor,
        driftFreq: 0.005 + Math.random() * 0.007,
        phase: Math.random() * Math.PI * 2,
        alpha:
          kind === "crystal"
            ? 0.52 + Math.random() * 0.28
            : kind === "bokeh"
              ? 0.55 + Math.random() * 0.3
              : 0.42 + Math.random() * 0.26,
        kind,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.014 * speedFactor,
        warm: idx % 8 === 0,
      };
    });

    const themeObserver = new MutationObserver(() => {
      isDark = document.documentElement.classList.contains("dark");
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const handleVisibility = () => {
      paused = document.hidden;
    };

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", handleVisibility);

    let tick = 0;
    const render = () => {
      animId = requestAnimationFrame(render);
      if (paused) return;

      tick += 1;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        f.y += f.speedY;
        f.x += Math.sin(tick * f.driftFreq + f.phase) * f.driftAmp;
        f.rotation += f.rotSpeed;

        if (f.y > height + 16) {
          f.y = -16;
          f.x = Math.random() * width;
        }
        if (f.x > width + 16) f.x = -16;
        else if (f.x < -16) f.x = width + 16;

        const colorStr = isDark
          ? f.warm
            ? `rgba(232, 198, 132, ${f.alpha.toFixed(3)})`
            : `rgba(248, 250, 252, ${f.alpha.toFixed(3)})`
          : f.warm
            ? `rgba(154, 106, 29, ${(f.alpha * 0.72).toFixed(3)})`
            : `rgba(92, 120, 152, ${(f.alpha * 0.78).toFixed(3)})`;

        if (f.kind === "crystal") {
          drawCrystal(ctx, f.x, f.y, f.radius, f.rotation, colorStr);
        } else if (f.kind === "bokeh") {
          const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius * 1.45);
          grad.addColorStop(0, colorStr);
          grad.addColorStop(1, "rgba(255,255,255,0)");
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.radius * 1.45, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
          ctx.fillStyle = colorStr;
          ctx.fill();
        }
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      themeObserver.disconnect();
      ctx.clearRect(0, 0, width, height);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-[60] pointer-events-none"
    />
  );
}
