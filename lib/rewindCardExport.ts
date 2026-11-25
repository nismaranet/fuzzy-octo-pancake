"use client";

import type { CollectiveRewind2026, PersonalRewind2026 } from "./rewind2026";

export type RewindPosterFormat = "story" | "square";

function loadImageSafe(src?: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const proxied = src.startsWith("/")
      ? src
      : `/api/rewind/image-proxy?url=${encodeURIComponent(src)}`;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = proxied;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 2
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function formatDurationCompact(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds || 0));
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (hours <= 0) return `${Math.max(1, mins)} menit`;
  if (mins === 0) return `${hours.toLocaleString("id-ID")} jam`;
  return `${hours.toLocaleString("id-ID")} jam ${mins} mnt`;
}

export async function downloadRewindPosterPng({
  format,
  collective,
  personal,
}: {
  format: RewindPosterFormat;
  collective: CollectiveRewind2026;
  personal: PersonalRewind2026 | null;
}): Promise<void> {
  const width = 1080;
  const height = format === "story" ? 1920 : 1080;
  const isStory = format === "story";

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const bgPhotoUrl =
    personal?.gallery.topPhoto?.imageUrl ||
    collective.topPhotos[0]?.imageUrl ||
    collective.backdropPhotos[0]?.imageUrl ||
    null;

  const [bgImg, avatarImg, groupLogoImg] = await Promise.all([
    loadImageSafe(bgPhotoUrl),
    loadImageSafe(personal?.driver.avatarUrl),
    loadImageSafe("/images/nismara-group-logo.png"),
  ]);

  // 1. Base midnight gradient
  const baseGrad = ctx.createLinearGradient(0, 0, width, height);
  baseGrad.addColorStop(0, "#090D16");
  baseGrad.addColorStop(0.5, "#111827");
  baseGrad.addColorStop(1, "#0B0F1A");
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Gallery Photo Backdrop (dimmed & editorial)
  if (bgImg) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    drawImageCover(ctx, bgImg, 0, 0, width, height);
    ctx.restore();
  }

  // 3. Ambient Champagne Gold & Warm Amber Glows
  const glowTop = ctx.createRadialGradient(width * 0.82, height * 0.14, 10, width * 0.82, height * 0.14, width * 0.65);
  glowTop.addColorStop(0, "rgba(245, 185, 66, 0.24)");
  glowTop.addColorStop(1, "rgba(245, 185, 66, 0)");
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, width, height);

  const glowBottom = ctx.createRadialGradient(width * 0.15, height * 0.86, 10, width * 0.15, height * 0.86, width * 0.6);
  glowBottom.addColorStop(0, "rgba(56, 189, 248, 0.14)");
  glowBottom.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, 0, width, height);

  // Scrim for guaranteed crisp contrast
  const scrim = ctx.createLinearGradient(0, 0, 0, height);
  scrim.addColorStop(0, "rgba(9, 13, 22, 0.68)");
  scrim.addColorStop(0.5, "rgba(9, 13, 22, 0.52)");
  scrim.addColorStop(1, "rgba(9, 13, 22, 0.88)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, width, height);

  // Outer Editorial Frame
  const pad = 64;
  ctx.strokeStyle = "rgba(245, 197, 106, 0.28)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 32, 32, width - 64, height - 64, 42);
  ctx.stroke();

  // Header Badge
  let y = isStory ? 110 : 88;
  ctx.fillStyle = "#F5C56A";
  ctx.font = "700 24px system-ui, -apple-system, sans-serif";
  ctx.fillText("NISMARA TRANSPORT  •  REWIND 2026", pad, y);

  y += isStory ? 66 : 54;
  ctx.fillStyle = "#F8FAFC";
  ctx.font = isStory
    ? "800 72px system-ui, -apple-system, sans-serif"
    : "800 54px system-ui, -apple-system, sans-serif";
  ctx.fillText("Miles of Memories", pad, y);

  // Divider line
  y += isStory ? 44 : 30;
  ctx.fillStyle = "rgba(245, 197, 106, 0.45)";
  ctx.fillRect(pad, y, 140, 4);

  if (personal) {
    // Driver Profile Header
    y += isStory ? 64 : 38;
    const avatarSize = isStory ? 116 : 86;

    if (avatarImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pad + avatarSize / 2, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      drawImageCover(ctx, avatarImg, pad, y, avatarSize, avatarSize);
      ctx.restore();

      ctx.strokeStyle = "#F5C56A";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pad + avatarSize / 2, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    const textX = avatarImg ? pad + avatarSize + 28 : pad;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = isStory
      ? "800 44px system-ui, -apple-system, sans-serif"
      : "800 36px system-ui, -apple-system, sans-serif";
    ctx.fillText(personal.driver.name, textX, y + (isStory ? 46 : 36));

    ctx.fillStyle = "#F5C56A";
    ctx.font = isStory
      ? "700 28px system-ui, -apple-system, sans-serif"
      : "700 24px system-ui, -apple-system, sans-serif";
    ctx.fillText(personal.persona.title, textX, y + (isStory ? 92 : 72));

    y += avatarSize + (isStory ? 42 : 26);

    // Tagline
    ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
    ctx.font = isStory
      ? "500 26px system-ui, -apple-system, sans-serif"
      : "500 21px system-ui, -apple-system, sans-serif";
    const taglineLines = wrapText(ctx, personal.persona.tagline, width - pad * 2, 2);
    taglineLines.forEach((line) => {
      ctx.fillText(line, pad, y);
      y += isStory ? 38 : 30;
    });

    // Hardcore Badge Pill (if earned)
    if (personal.hardcore.title) {
      y += 14;
      const hcText = `HARDCORE 2026: ${personal.hardcore.title.title.toUpperCase()}  •  ${personal.hardcore.avgRating.toFixed(2)}★ (${personal.hardcore.totalJobs} JOB)`;
      ctx.font = "700 20px system-ui, -apple-system, sans-serif";
      const pillW = Math.min(width - pad * 2, ctx.measureText(hcText).width + 44);
      ctx.fillStyle = "rgba(249, 115, 22, 0.22)";
      ctx.strokeStyle = "rgba(251, 146, 60, 0.65)";
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, pad, y, pillW, 48, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#FDBA74";
      ctx.fillText(hcText, pad + 22, y + 31);
      y += 72;
    } else {
      y += 22;
    }

    // Stat Grid (6 cards for Story, 4 cards for Square)
    const statsCards = [
      {
        label: "TOTAL JARAK TEMPUH",
        value: `${personal.totalKm.toLocaleString("id-ID")} km`,
        accent: "#F5C56A",
      },
      {
        label: "LOGISTICS & COACHES",
        value: `${personal.truckJobs.toLocaleString("id-ID")} Truck · ${personal.coachJobs.toLocaleString("id-ID")} Bus`,
        accent: "#38BDF8",
      },
      {
        label: "DURASI MENGEMUDI 2026",
        value: formatDurationCompact(personal.totalDurationSeconds),
        accent: "#34D399",
      },
      {
        label: "KOTA PENGIRIMAN TERBANYAK",
        value: personal.favoriteCity
          ? `${personal.favoriteCity.name} (${personal.favoriteCity.count}x)`
          : "-",
        accent: "#F8FAFC",
      },
      {
        label: "TOTAL PENGHASILAN",
        value: `${personal.totalNetNc.toLocaleString("id-ID")} NC`,
        accent: "#A78BFA",
      },
      {
        label: "PERINGKAT & DRIVING SCORE",
        value: personal.percentileTop
          ? `Top ${personal.percentileTop}% · Grade ${personal.safety.drivingGrade}`
          : `Grade ${personal.safety.drivingGrade}`,
        accent: "#F472B6",
      },
    ];

    const visibleCards = isStory ? statsCards : statsCards.slice(0, 4);
    const cols = 2;
    const gap = 24;
    const cardW = (width - pad * 2 - gap) / cols;
    const cardH = isStory ? 182 : 140;

    visibleCards.forEach((card, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = pad + col * (cardW + gap);
      const cy = y + row * (cardH + gap);

      ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, cx, cy, cardW, cardH, 26);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(148, 163, 184, 0.95)";
      ctx.font = "700 18px system-ui, -apple-system, sans-serif";
      ctx.fillText(card.label, cx + 28, cy + (isStory ? 52 : 44));

      ctx.fillStyle = card.accent;
      ctx.font =
        card.value.length > 18
          ? "800 28px system-ui, -apple-system, sans-serif"
          : isStory
            ? "800 42px system-ui, -apple-system, sans-serif"
            : "800 36px system-ui, -apple-system, sans-serif";
      const valLines = wrapText(ctx, card.value, cardW - 56, 2);
      valLines.forEach((line, lIdx) => {
        ctx.fillText(line, cx + 28, cy + (isStory ? 114 : 96) + lIdx * 34);
      });
    });

    if (isStory && personal.longestJob) {
      const rows = Math.ceil(visibleCards.length / 2);
      const bannerY = y + rows * (cardH + gap) + 12;
      ctx.fillStyle = "rgba(245, 197, 106, 0.11)";
      ctx.strokeStyle = "rgba(245, 197, 106, 0.35)";
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, pad, bannerY, width - pad * 2, 134, 26);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#F5C56A";
      ctx.font = "700 19px system-ui, -apple-system, sans-serif";
      ctx.fillText("PERJALANAN TERJAUH 2026", pad + 30, bannerY + 46);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "800 32px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        `${personal.longestJob.sourceCity} → ${personal.longestJob.destinationCity} (${personal.longestJob.distanceKm.toLocaleString("id-ID")} km)`,
        pad + 30,
        bannerY + 96
      );
    }
  } else {
    // Collective Community Card
    y += isStory ? 60 : 38;
    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
    ctx.font = isStory
      ? "600 32px system-ui, -apple-system, sans-serif"
      : "600 26px system-ui, -apple-system, sans-serif";
    ctx.fillText("Tahun Pertama Keluarga Besar Nismara Transport", pad, y);
    y += isStory ? 60 : 40;

    const cCards = [
      { label: "TOTAL JARAK BERSAMA", value: `${collective.totalKm.toLocaleString("id-ID")} km`, accent: "#F5C56A" },
      { label: "PERJALANAN SELESAI", value: `${collective.totalJobs.toLocaleString("id-ID")} Job`, accent: "#38BDF8" },
      { label: "HARDCORE SIMULATION", value: `${collective.hardcore.totalJobs.toLocaleString("id-ID")} Job`, accent: "#FB923C" },
      { label: "SPECIAL CONTRACT", value: `${collective.community.totalSpecialContracts.toLocaleString("id-ID")} Selesai`, accent: "#34D399" },
    ];
    const gap = 24;
    const cardW = (width - pad * 2 - gap) / 2;
    const cardH = isStory ? 200 : 155;
    cCards.forEach((card, idx) => {
      const cx = pad + (idx % 2) * (cardW + gap);
      const cy = y + Math.floor(idx / 2) * (cardH + gap);
      ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, cx, cy, cardW, cardH, 26);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(148, 163, 184, 0.95)";
      ctx.font = "700 18px system-ui, -apple-system, sans-serif";
      ctx.fillText(card.label, cx + 28, cy + 52);

      ctx.fillStyle = card.accent;
      ctx.font = "800 42px system-ui, -apple-system, sans-serif";
      ctx.fillText(card.value, cx + 28, cy + 120);
    });
  }

  // Footer: Nismara Group Logo di kiri + #MilesOfMemories2026 di kanan (tanpa URL link)
  const footerCenterY = height - (isStory ? 92 : 76);
  if (groupLogoImg && groupLogoImg.naturalWidth > 0 && groupLogoImg.naturalHeight > 0) {
    const targetH = isStory ? 62 : 48;
    const ratio = groupLogoImg.naturalWidth / groupLogoImg.naturalHeight;
    const targetW = Math.min(340, targetH * ratio);
    const drawH = targetW / ratio;
    ctx.drawImage(groupLogoImg, pad, footerCenterY - drawH / 2, targetW, drawH);
  } else {
    ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
    ctx.font = "800 24px system-ui, -apple-system, sans-serif";
    ctx.fillText("NISMARA GROUP", pad, footerCenterY + 8);
  }

  ctx.fillStyle = "#F5C56A";
  ctx.font = "700 24px system-ui, -apple-system, sans-serif";
  const rightTag = "#MilesOfMemories2026";
  const rightW = ctx.measureText(rightTag).width;
  ctx.fillText(rightTag, width - pad - rightW, footerCenterY + 8);

  // Trigger download
  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  const slugName = (personal?.driver.name || "nismara-community")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  a.download = `miles-of-memories-2026-${slugName}-${format}.png`;
  a.href = dataUrl;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
