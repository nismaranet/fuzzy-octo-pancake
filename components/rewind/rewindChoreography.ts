"use client";

import {
  animate,
  createScope,
  createTimeline,
  splitText,
  spring,
  stagger,
  svg,
  utils,
  type TextSplitter,
  type Timeline,
} from "animejs";

export interface ChoreographyHandle {
  timeline: Timeline | null;
  pause: () => void;
  play: () => void;
  cleanup: () => void;
}

function formatCounterValue(
  val: number,
  decimals: number,
  prefix: string,
  suffix: string
): string {
  const formatted =
    decimals > 0
      ? val.toLocaleString("id-ID", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(val).toLocaleString("id-ID");
  return `${prefix}${formatted}${suffix}`;
}

/**
 * Anime.js v4 Art-Directed Choreography Engine untuk Miles of Memories 2026.
 * Mendukung berbagai mekanik sinematik unik per scene:
 * - Infinite Marquee Ribbons & Vertical 35mm Filmstrip
 * - SVG Drawable Paths + Motion Path Beacon Traveller (`svg.createMotionPath`)
 * - Cockpit Tachometer Gauge + Tick Cascade
 * - Rubber-Stamp Impact Slam (`Top X%` seal & Hardcore Title)
 * - Horizontal Telemetry Bar Race (`scaleX`)
 * - Boarding-Pass / Waybill Pocket Slide-Up
 * - 35mm Polaroid Exhibition Fan-Out
 * - Giant Grade Letter Reveal & Award Show Starburst Climax
 */
export function runRewindSlideChoreography(
  rootEl: HTMLElement
): ChoreographyHandle {
  const splitters: TextSplitter[] = [];
  let mainTimeline: Timeline | null = null;

  const scope = createScope({ root: rootEl }).add(() => {
    // --- CONTINUOUS AMBIENT MOTIONS ---

    // 1. Drifting gradient orbs
    const orbs = rootEl.querySelectorAll<HTMLElement>('[data-anim="orb"]');
    orbs.forEach((orb, i) => {
      animate(orb, {
        x: i % 2 === 0 ? [-32, 36] : [32, -28],
        y: i % 2 === 0 ? [-22, 28] : [24, -26],
        scale: [0.92, 1.14],
        duration: 5600 + i * 1100,
        ease: "inOutSine",
        loop: true,
        alternate: true,
      });
    });

    // 2. Oversized background watermark drift (e.g., giant "2026" or "S")
    const watermarks = rootEl.querySelectorAll<HTMLElement>('[data-anim="watermark"]');
    if (watermarks.length > 0) {
      animate(watermarks, {
        opacity: [0, 1],
        x: [-45, 0],
        duration: 1400,
        ease: "out(4)",
      });
    }

    // 3. Infinite Horizontal Kinetic Marquee
    const marquees = rootEl.querySelectorAll<HTMLElement>('[data-anim="marquee"]');
    marquees.forEach((el, i) => {
      animate(el, {
        x: i % 2 === 0 ? ["0%", "-50%"] : ["-50%", "0%"],
        duration: 18000 + i * 3000,
        ease: "linear",
        loop: true,
      });
    });

    // 4. Slow Rotating Orbital Ring (Personal Spotlight)
    const orbits = rootEl.querySelectorAll<HTMLElement>('[data-anim="orbit-spin"]');
    if (orbits.length > 0) {
      animate(orbits, {
        rotate: "1turn",
        duration: 18000,
        ease: "linear",
        loop: true,
      });
    }

    // 5. Cinema Photo Gentle Zoom (Personal Gallery Hero)
    const cinemaPhoto = rootEl.querySelector<HTMLElement>('[data-anim="cinema-photo"]');
    if (cinemaPhoto) {
      animate(cinemaPhoto, {
        scale: [1.14, 1.0],
        opacity: [0, 1],
        duration: 1600,
        ease: "out(3)",
      });
    }

    // --- DIRECTED MULTI-BEAT TIMELINE ---
    const tl = createTimeline({
      defaults: { ease: "out(3)", duration: 680 },
    });
    mainTimeline = tl;

    // Beat 1: SVG Drawables (Highway Curves & Waybill Route)
    const drawPaths = rootEl.querySelectorAll<SVGGeometryElement>(
      '[data-anim="draw-path"]'
    );
    if (drawPaths.length > 0) {
      const drawables = svg.createDrawable(drawPaths);
      tl.add(
        drawables,
        {
          draw: ["0 0", "0 1"],
          duration: 1450,
          ease: "inOut(3)",
          delay: stagger(140),
        },
        60
      );
    }

    // Beat 1B: Glowing Beacon Travelling Along Highway SVG Path!
    const motionPathTarget = rootEl.querySelector<SVGGeometryElement>(
      '[data-anim="motion-track"]'
    );
    const motionBeacon = rootEl.querySelector<HTMLElement>(
      '[data-anim="motion-beacon"]'
    );
    if (motionPathTarget && motionBeacon) {
      try {
        const motionProps = svg.createMotionPath(motionPathTarget);
        tl.add(
          motionBeacon,
          {
            ...motionProps,
            opacity: [0, 1, 1],
            duration: 1650,
            ease: "inOut(3)",
          },
          100
        );
      } catch {
        // fallback jika SVG belum siap ukurannya
      }
    }

    // Beat 1C: Tachometer Gauge Arc (Hardcore Simulation)
    const drawGauges = rootEl.querySelectorAll<SVGGeometryElement>(
      '[data-anim="draw-gauge"]'
    );
    drawGauges.forEach((gaugeEl) => {
      const targetRatio = Math.max(
        0.04,
        Math.min(1, Number(gaugeEl.dataset.gaugeTarget || "0.85"))
      );
      const [drawable] = svg.createDrawable(gaugeEl);
      tl.add(
        drawable,
        {
          draw: ["0 0", `0 ${targetRatio}`],
          duration: 1650,
          ease: "out(4)",
        },
        200
      );
    });

    // Beat 1D: Tachometer Tick Cascade
    const ticks = rootEl.querySelectorAll<SVGElement>('[data-anim="gauge-tick"]');
    if (ticks.length > 0) {
      tl.add(
        ticks,
        {
          opacity: [0.1, 1],
          duration: 320,
          delay: stagger(32),
          ease: "out(2)",
        },
        120
      );
    }

    // Beat 1E: Shockwave Rings (Persona / Climax)
    const rings = rootEl.querySelectorAll<HTMLElement>('[data-anim="ring-burst"]');
    if (rings.length > 0) {
      tl.add(
        rings,
        {
          scale: [0.2, 2.1],
          opacity: [0.9, 0],
          duration: 1550,
          ease: "out(3)",
          delay: stagger(210),
        },
        150
      );
    }

    // Beat 2: Eyebrow Pill / Section Tag
    const pills = rootEl.querySelectorAll<HTMLElement>('[data-anim="pill"]');
    if (pills.length > 0) {
      tl.add(
        pills,
        {
          opacity: [0, 1],
          y: [-20, 0],
          scale: [0.84, 1],
          ease: spring({ bounce: 0.4, duration: 640 }),
        },
        40
      );
    }

    // Beat 2B: Avatar Portrait Pop
    const avatars = rootEl.querySelectorAll<HTMLElement>('[data-anim="avatar"]');
    if (avatars.length > 0) {
      tl.add(
        avatars,
        {
          opacity: [0, 1],
          scale: [0.4, 1],
          rotate: [-12, 0],
          ease: spring({ bounce: 0.48, duration: 780 }),
        },
        80
      );
    }

    // Beat 3A: Kinetic Editorial Headline (Words Masked Clip)
    const headlines = rootEl.querySelectorAll<HTMLElement>(
      '[data-anim="headline"]'
    );
    headlines.forEach((el) => {
      const split = splitText(el, { words: { wrap: "clip" } });
      splitters.push(split);
      if (split.words.length > 0) {
        tl.add(
          split.words,
          {
            y: ["118%", "0%"],
            opacity: [0, 1],
            rotate: [2.5, 0],
            duration: 760,
            ease: "out(4)",
            delay: stagger(52),
          },
          160
        );
      }
    });

    // Beat 3B: Grand Reveal Headline (Character Slam)
    const charHeadlines = rootEl.querySelectorAll<HTMLElement>(
      '[data-anim="headline-chars"]'
    );
    charHeadlines.forEach((el) => {
      const split = splitText(el, { words: { wrap: "clip" }, chars: true });
      splitters.push(split);
      if (split.chars.length > 0) {
        tl.add(
          split.chars,
          {
            y: ["125%", "0%"],
            opacity: [0, 1],
            scale: [0.68, 1],
            rotate: [-8, 0],
            duration: 840,
            ease: "out(4)",
            delay: stagger(26),
          },
          220
        );
      }
    });

    // Beat 4: Subcopy & Hero Number Container
    const subcopies = rootEl.querySelectorAll<HTMLElement>('[data-anim="subcopy"]');
    if (subcopies.length > 0) {
      tl.add(
        subcopies,
        {
          opacity: [0, 1],
          y: [18, 0],
          duration: 600,
          ease: "out(3)",
          delay: stagger(85),
        },
        360
      );
    }

    const heroNums = rootEl.querySelectorAll<HTMLElement>('[data-anim="hero-num"]');
    if (heroNums.length > 0) {
      tl.add(
        heroNums,
        {
          opacity: [0, 1],
          scale: [0.76, 1],
          y: [26, 0],
          ease: spring({ bounce: 0.34, duration: 820 }),
        },
        320
      );
    }

    // Beat 4B: Giant Grade Letter Emblem (Driving Score Slide)
    const gradeEmblem = rootEl.querySelector<HTMLElement>(
      '[data-anim="grade-emblem"]'
    );
    if (gradeEmblem) {
      tl.add(
        gradeEmblem,
        {
          opacity: [0, 1],
          scale: [0.4, 1],
          rotate: [-16, 0],
          ease: spring({ bounce: 0.48, duration: 880 }),
        },
        240
      );
    }

    // Beat 5: Odometer Number Count-Ups
    const counters = rootEl.querySelectorAll<HTMLElement>("[data-counter]");
    counters.forEach((el, idx) => {
      const target = Number(el.dataset.counter || "0");
      const decimals = Number(el.dataset.decimals || "0");
      const prefix = el.dataset.prefix || "";
      const suffix = el.dataset.suffix || "";

      if (!Number.isFinite(target) || target === 0) {
        el.textContent = formatCounterValue(0, decimals, prefix, suffix);
        return;
      }

      const state = { val: 0 };
      el.textContent = formatCounterValue(0, decimals, prefix, suffix);
      tl.add(
        state,
        {
          val: target,
          duration: 1450,
          ease: "out(4)",
          modifier: utils.round(decimals),
          onUpdate: () => {
            el.textContent = formatCounterValue(
              state.val,
              decimals,
              prefix,
              suffix
            );
          },
        },
        360 + idx * 65
      );
    });

    // Beat 5B: Rubber-Stamp Slam Seal (Top X% / Hardcore Stamp)
    const stamps = rootEl.querySelectorAll<HTMLElement>('[data-anim="stamp"]');
    if (stamps.length > 0) {
      tl.add(
        stamps,
        {
          opacity: [0, 1],
          scale: [2.3, 1],
          rotate: [-22, -6],
          duration: 540,
          ease: "out(4)",
        },
        780
      );
    }

    // Beat 6A: Staggered Cards & Receipt Lines
    const cards = rootEl.querySelectorAll<HTMLElement>('[data-anim="card"]');
    if (cards.length > 0) {
      tl.add(
        cards,
        {
          opacity: [0, 1],
          y: [32, 0],
          scale: [0.92, 1],
          ease: spring({ bounce: 0.32, duration: 700 }),
          delay: stagger(75, { from: "first" }),
        },
        500
      );
    }

    const receiptRows = rootEl.querySelectorAll<HTMLElement>(
      '[data-anim="receipt-row"]'
    );
    if (receiptRows.length > 0) {
      tl.add(
        receiptRows,
        {
          opacity: [0, 1],
          x: [-20, 0],
          duration: 420,
          ease: "out(3)",
          delay: stagger(75),
        },
        420
      );
    }

    // Beat 6B: Horizontal Bar Race (Hardcore / Top Favorites & Real Miles Fill)
    const hBars = rootEl.querySelectorAll<HTMLElement>('[data-anim="hbar"]');
    if (hBars.length > 0) {
      tl.add(
        hBars,
        {
          scaleX: [0, 1],
          opacity: [0, 1],
          duration: 820,
          ease: "out(4)",
          delay: stagger(95),
        },
        440
      );
    }

    // Beat 6C: Vertical 12-Month Equalizer Bars
    const vBars = rootEl.querySelectorAll<HTMLElement>('[data-anim="bar"]');
    if (vBars.length > 0) {
      tl.add(
        vBars,
        {
          scaleY: [0, 1],
          opacity: [0, 1],
          ease: spring({ bounce: 0.34, duration: 780 }),
          delay: stagger(50),
        },
        440
      );
    }

    const peakBar = rootEl.querySelector<HTMLElement>('[data-anim="bar-peak"]');
    if (peakBar) {
      animate(peakBar, {
        filter: [
          "drop-shadow(0 0 6px rgba(250,204,21,0.4))",
          "drop-shadow(0 0 22px rgba(250,204,21,0.95))",
        ],
        duration: 1300,
        ease: "inOutSine",
        loop: true,
        alternate: true,
      });
    }

    // Beat 6D: Waybill / Boarding Pass Pocket Slide-Up
    const ticket = rootEl.querySelector<HTMLElement>('[data-anim="waybill"]');
    if (ticket) {
      tl.add(
        ticket,
        {
          opacity: [0, 1],
          y: [95, 0],
          rotate: [-3, 0],
          ease: spring({ bounce: 0.32, duration: 920 }),
        },
        240
      );
    }

    // Beat 6E: 35mm Polaroid Exhibition Fan-Out
    const polaroids = rootEl.querySelectorAll<HTMLElement>(
      '[data-anim="polaroid"]'
    );
    if (polaroids.length > 0) {
      const restAngles = [-4, 1.5, 4.5];
      polaroids.forEach((cardEl, i) => {
        tl.add(
          cardEl,
          {
            opacity: [0, 1],
            y: [90, 0],
            scale: [0.74, 1],
            rotate: [i % 2 === 0 ? -18 : 18, restAngles[i % restAngles.length]],
            ease: spring({ bounce: 0.42, duration: 900 }),
          },
          400 + i * 140
        );
      });
    }

    // Beat 6F: Radial Celebration Sparks (Persona Climax)
    const sparks = rootEl.querySelectorAll<HTMLElement>('[data-anim="spark"]');
    if (sparks.length > 0) {
      sparks.forEach((spark, i) => {
        const angle = (i / sparks.length) * Math.PI * 2;
        const dist = 115 + (i % 3) * 60;
        tl.add(
          spark,
          {
            x: [0, Math.cos(angle) * dist],
            y: [0, Math.sin(angle) * dist],
            scale: [0, 1.3, 0],
            opacity: [0, 1, 0],
            rotate: [0, 180 + (i % 2 ? 90 : -90)],
            duration: 1550,
            ease: "out(3)",
          },
          320 + (i % 4) * 40
        );
      });
    }

    // Beat 6G: Collector Poster Card Final Reveal
    const posterCard = rootEl.querySelector<HTMLElement>(
      '[data-anim="poster-card"]'
    );
    if (posterCard) {
      tl.add(
        posterCard,
        {
          opacity: [0, 1],
          y: [48, 0],
          scale: [0.88, 1],
          rotate: [-2, 0],
          ease: spring({ bounce: 0.34, duration: 860 }),
        },
        300
      );
    }
  });

  return {
    timeline: mainTimeline,
    pause: () => mainTimeline?.pause(),
    play: () => mainTimeline?.play(),
    cleanup: () => {
      splitters.forEach((s) => {
        try {
          s.revert();
        } catch {
          // ignore
        }
      });
      scope.revert();
    },
  };
}

/**
 * Koreografi layar Splash Intro (dengan vertical 35mm filmstrip galeri) & Locked Teaser.
 */
export function runSplashChoreography(rootEl: HTMLElement): () => void {
  const splitters: TextSplitter[] = [];

  const scope = createScope({ root: rootEl }).add(() => {
    const orbs = rootEl.querySelectorAll<HTMLElement>('[data-anim="orb"]');
    orbs.forEach((orb, i) => {
      animate(orb, {
        x: i % 2 === 0 ? [-32, 32] : [28, -28],
        y: i % 2 === 0 ? [-22, 24] : [24, -22],
        scale: [0.9, 1.15],
        duration: 5800 + i * 1000,
        ease: "inOutSine",
        loop: true,
        alternate: true,
      });
    });

    const filmstrip = rootEl.querySelector<HTMLElement>('[data-anim="filmstrip"]');
    if (filmstrip) {
      animate(filmstrip, {
        y: ["0%", "-50%"],
        duration: 24000,
        ease: "linear",
        loop: true,
      });
    }

    const tl = createTimeline({
      defaults: { ease: "out(3)", duration: 700 },
    });

    const drawPaths = rootEl.querySelectorAll<SVGGeometryElement>(
      '[data-anim="draw-path"]'
    );
    if (drawPaths.length > 0) {
      tl.add(
        svg.createDrawable(drawPaths),
        {
          draw: ["0 0", "0 1"],
          duration: 1400,
          ease: "inOut(3)",
        },
        0
      );
    }

    const pills = rootEl.querySelectorAll<HTMLElement>('[data-anim="pill"]');
    if (pills.length > 0) {
      tl.add(
        pills,
        {
          opacity: [0, 1],
          y: [-18, 0],
          scale: [0.85, 1],
          ease: spring({ bounce: 0.4, duration: 650 }),
        },
        80
      );
    }

    const charTitles = rootEl.querySelectorAll<HTMLElement>(
      '[data-anim="headline-chars"]'
    );
    charTitles.forEach((el) => {
      const split = splitText(el, { words: { wrap: "clip" }, chars: true });
      splitters.push(split);
      if (split.chars.length > 0) {
        tl.add(
          split.chars,
          {
            y: ["120%", "0%"],
            opacity: [0, 1],
            rotate: [-6, 0],
            duration: 850,
            ease: "out(4)",
            delay: stagger(28),
          },
          200
        );
      }
    });

    const subcopies = rootEl.querySelectorAll<HTMLElement>('[data-anim="subcopy"]');
    if (subcopies.length > 0) {
      tl.add(
        subcopies,
        {
          opacity: [0, 1],
          y: [20, 0],
          duration: 650,
          delay: stagger(100),
        },
        500
      );
    }

    const cards = rootEl.querySelectorAll<HTMLElement>('[data-anim="card"]');
    if (cards.length > 0) {
      tl.add(
        cards,
        {
          opacity: [0, 1],
          y: [28, 0],
          scale: [0.9, 1],
          ease: spring({ bounce: 0.35, duration: 720 }),
          delay: stagger(75),
        },
        600
      );
    }
  });

  return () => {
    splitters.forEach((s) => {
      try {
        s.revert();
      } catch {
        // ignore
      }
    });
    scope.revert();
  };
}
