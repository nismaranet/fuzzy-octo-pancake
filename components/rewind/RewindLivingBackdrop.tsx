"use client";

import React, { useEffect, useRef } from "react";

export type RewindBackdropMotif =
  | "highway"
  | "topography"
  | "constellation"
  | "embers"
  | "aurora"
  | "bokeh";

interface Props {
  motif: RewindBackdropMotif;
  lightMode?: boolean;
  paused?: boolean;
}

/**
 * Living 60fps HTML5 Canvas Backdrop khusus "Miles of Memories 2026".
 * Memberi kehidupan sinematik yang berbeda di tiap babak tanpa mengganggu keterbacaan teks:
 * - highway: garis jalan tol perspektif malam + kilatan lampu bokeh bergerak maju
 * - topography: kontur peta topografi melayang halus + partikel debu emas (support light/dark)
 * - constellation: jaringan rute kota & paket cahaya yang mengalir antar titik
 * - embers: percikan bara api hangat naik ke atas (Hardcore / Climax)
 * - aurora: pita gelombang aurora lembut yang mengalun
 * - bokeh: refleksi bokeh lampu kota hangat (Pameran Galeri / Cinema / Finale)
 */
export default function RewindLivingBackdrop({
  motif,
  lightMode = false,
  paused = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let t = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Deterministic-feel seeded particles per motif
    const particles = Array.from({ length: 42 }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: 1.5 + Math.random() * 3.5,
      phase: (i / 42) * Math.PI * 2,
      speed: 0.4 + Math.random() * 1.1,
      hue: i % 3 === 0 ? "gold" : i % 3 === 1 ? "sky" : "rose",
    }));

    // Highway stars/streaks radiating from vanishing point
    const streaks = Array.from({ length: 34 }, () => ({
      angle: Math.random() * Math.PI * 2,
      dist: Math.random(),
      speed: 0.0025 + Math.random() * 0.0045,
      warm: Math.random() > 0.35,
    }));

    // Constellation city nodes
    const nodes = Array.from({ length: 24 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      r: 2 + Math.random() * 2.5,
    }));

    let lastNow = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(50, Math.max(0, now - lastNow));
      lastNow = now;
      const speedScale = pausedRef.current ? 0.12 : 1;
      t += (dt / 1000) * speedScale;

      ctx.clearRect(0, 0, width, height);

      if (motif === "highway") {
        // Perspective Autobahn Road Grid + Rushing Headlight Streaks
        const vpX = width * 0.5;
        const vpY = height * 0.42;

        // Subtle perspective radial road lines
        ctx.save();
        ctx.strokeStyle = "rgba(245, 197, 106, 0.09)";
        ctx.lineWidth = 1;
        for (let i = -5; i <= 5; i++) {
          ctx.beginPath();
          ctx.moveTo(vpX + i * 18, vpY);
          ctx.lineTo(vpX + i * width * 0.26, height);
          ctx.stroke();
        }

        // Moving horizontal highway distance markers
        for (let i = 0; i < 9; i++) {
          const prog = ((t * 0.32 + i / 9) % 1);
          const eased = prog * prog;
          const y = vpY + eased * (height - vpY);
          ctx.strokeStyle = `rgba(56, 189, 248, ${eased * 0.14})`;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // Speed light streaks radiating out
        for (const s of streaks) {
          s.dist += s.speed * (dt / 16) * speedScale;
          if (s.dist > 1) {
            s.dist = 0.04;
            s.angle = Math.random() * Math.PI * 2;
          }
          const r1 = s.dist * Math.max(width, height) * 0.58;
          const r2 = (s.dist + 0.055) * Math.max(width, height) * 0.58;
          const x1 = vpX + Math.cos(s.angle) * r1;
          const y1 = vpY + Math.sin(s.angle) * r1;
          const x2 = vpX + Math.cos(s.angle) * r2;
          const y2 = vpY + Math.sin(s.angle) * r2;
          const alpha = Math.sin(s.dist * Math.PI) * 0.45;
          ctx.strokeStyle = s.warm
            ? `rgba(245, 197, 106, ${alpha})`
            : `rgba(56, 189, 248, ${alpha * 0.85})`;
          ctx.lineWidth = 1.2 + s.dist * 1.8;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.restore();
      } else if (motif === "topography") {
        // Animated Topographic Contour Waves
        ctx.save();
        const lineCount = 8;
        for (let i = 0; i < lineCount; i++) {
          const baseY = (height / (lineCount + 1)) * (i + 1);
          ctx.beginPath();
          for (let x = 0; x <= width; x += 28) {
            const wave =
              Math.sin(x * 0.0045 + t * 0.55 + i * 0.7) * 26 +
              Math.cos(x * 0.0022 - t * 0.35 + i) * 18;
            const y = baseY + wave;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = lightMode
            ? `rgba(17, 17, 17, ${0.06 + (i % 3) * 0.02})`
            : `rgba(245, 197, 106, ${0.07 + (i % 3) * 0.025})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Gentle drifting coordinate motes
        for (const p of particles.slice(0, 22)) {
          p.x = (p.x + p.vx * speedScale + width) % width;
          p.y = (p.y + p.vy * speedScale + height) % height;
          ctx.fillStyle = lightMode
            ? "rgba(180, 83, 9, 0.22)"
            : "rgba(245, 197, 106, 0.28)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (motif === "constellation") {
        // Connected City Route Constellation
        ctx.save();
        for (const n of nodes) {
          n.x += n.vx * (dt / 16) * speedScale;
          n.y += n.vy * (dt / 16) * speedScale;
          if (n.x < 0 || n.x > width) n.vx *= -1;
          if (n.y < 0 || n.y > height) n.vy *= -1;
        }

        const maxDist = Math.min(220, width * 0.24);
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            const d = Math.hypot(dx, dy);
            if (d < maxDist) {
              const alpha = (1 - d / maxDist) * 0.22;
              ctx.strokeStyle = `rgba(245, 197, 106, ${alpha})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(nodes[i].x, nodes[i].y);
              ctx.lineTo(nodes[j].x, nodes[j].y);
              ctx.stroke();
            }
          }
        }

        for (const n of nodes) {
          ctx.fillStyle = "rgba(253, 224, 71, 0.55)";
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (motif === "embers") {
        // Rising Glowing Embers & Sparks (Hardcore / Persona Climax)
        ctx.save();
        for (const p of particles) {
          p.y -= p.speed * 0.9 * (dt / 16) * speedScale;
          p.x += Math.sin(t * 1.4 + p.phase) * 0.45 * speedScale;
          if (p.y < -20) {
            p.y = height + 20;
            p.x = Math.random() * width;
          }
          const alpha = 0.2 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3 + p.phase));
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3.2);
          grad.addColorStop(
            0,
            p.hue === "gold"
              ? `rgba(253, 224, 71, ${alpha})`
              : `rgba(251, 146, 60, ${alpha})`
          );
          grad.addColorStop(1, "rgba(251, 146, 60, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (motif === "aurora") {
        // Flowing Silk Aurora Ribbons
        ctx.save();
        const bands = [
          { yFrac: 0.34, amp: 48, freq: 0.0032, color: "rgba(245, 197, 106, 0.11)" },
          { yFrac: 0.52, amp: 60, freq: 0.0026, color: "rgba(52, 211, 153, 0.11)" },
          { yFrac: 0.68, amp: 42, freq: 0.0038, color: "rgba(244, 114, 182, 0.1)" },
        ];
        bands.forEach((b, idx) => {
          ctx.beginPath();
          const base = height * b.yFrac;
          ctx.moveTo(0, height);
          for (let x = 0; x <= width; x += 24) {
            const y =
              base +
              Math.sin(x * b.freq + t * (0.55 + idx * 0.15) + idx * 1.4) * b.amp;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(width, height);
          ctx.closePath();
          ctx.fillStyle = b.color;
          ctx.fill();
        });
        ctx.restore();
      } else {
        // Soft Warm City Bokeh Lights (Gallery / Cinema / Collector)
        ctx.save();
        for (const p of particles.slice(0, 24)) {
          p.x = (p.x + p.vx * 0.7 * speedScale + width) % width;
          p.y = (p.y + p.vy * 0.7 * speedScale + height) % height;
          const radius = 14 + p.r * 9;
          const alpha = 0.07 + 0.07 * (0.5 + 0.5 * Math.sin(t * 1.2 + p.phase));
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
          const rgb =
            p.hue === "gold"
              ? "245, 197, 106"
              : p.hue === "rose"
                ? "244, 114, 182"
                : "56, 189, 248";
          grad.addColorStop(0, `rgba(${rgb}, ${alpha * 1.8})`);
          grad.addColorStop(0.55, `rgba(${rgb}, ${alpha * 0.55})`);
          grad.addColorStop(1, `rgba(${rgb}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [motif, lightMode]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}
