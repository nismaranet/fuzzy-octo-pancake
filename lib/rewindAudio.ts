"use client";

/**
 * Miles of Memories — Rewind 2026 Audio Engine
 * 1. Jika Owner menyetel custom MP3/WAV URL (melalui Web Config atau /audio/...),
 *    engine memutar file tersebut secara loop dengan fade-in halus.
 * 2. Jika kosong (atau gagal dimuat), otomatis memutar soundtrack ambient hangat bawaan
 *    berbasis Web Audio API (progresi chord nostalgik Fmaj7 -> Cmaj7/E -> Dm9 -> Bbmaj7).
 */

export type RewindAudioMode = "custom" | "synth";

// Frekuensi nada untuk progresi nostalgic warm electric piano (Hz)
const CHORD_PROGRESSION: number[][] = [
  // Fmaj7 (F3, A3, C4, E4, A4)
  [174.61, 220.0, 261.63, 329.63, 440.0],
  // Cmaj7/E (E3, G3, B3, D4, G4)
  [164.81, 196.0, 246.94, 293.66, 392.0],
  // Dm9 (D3, A3, C4, E4, F4)
  [146.83, 220.0, 261.63, 329.63, 349.23],
  // Bbmaj7 (Bb2, F3, A3, D4, F4)
  [116.54, 174.61, 220.0, 293.66, 349.23],
  // Gm7 (G2, F3, Bb3, D4, G4)
  [98.0, 174.61, 233.08, 293.66, 392.0],
  // C9sus4 (C3, G3, Bb3, D4, F4)
  [130.81, 196.0, 233.08, 293.66, 349.23],
];

const MELODY_NOTES: (number | null)[] = [
  523.25, 587.33, 659.25, null, 587.33, 523.25, 440.0, null,
  493.88, 523.25, 587.33, null, 523.25, 440.0, 392.0, null,
  523.25, 659.25, 698.46, null, 659.25, 587.33, 523.25, null,
];

export class RewindAudioPlayer {
  private customUrl: string;
  private audioEl: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private synthTimer: number | null = null;
  private chordIdx = 0;
  private melodyIdx = 0;
  private isMuted = false;
  private isPlaying = false;
  private mode: RewindAudioMode = "synth";

  constructor(customUrl?: string) {
    this.customUrl = (customUrl || "").trim();
  }

  getMode(): RewindAudioMode {
    return this.mode;
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;
    this.isPlaying = true;

    if (this.customUrl) {
      const ok = await this.tryStartCustomAudio(this.customUrl);
      if (ok) {
        this.mode = "custom";
        return;
      }
    }

    this.mode = "synth";
    this.startSynth();
  }

  private async tryStartCustomAudio(url: string): Promise<boolean> {
    if (typeof window === "undefined") return false;
    try {
      const el = new Audio(url);
      el.loop = true;
      el.volume = 0;
      el.muted = this.isMuted;
      el.crossOrigin = "anonymous";
      this.audioEl = el;
      await el.play();

      // Fade-in halus 1.2 detik
      const targetVol = 0.42;
      const start = performance.now();
      const fade = () => {
        if (!this.audioEl || this.audioEl !== el) return;
        const t = Math.min(1, (performance.now() - start) / 1200);
        el.volume = t * targetVol;
        if (t < 1 && this.isPlaying) {
          requestAnimationFrame(fade);
        }
      };
      requestAnimationFrame(fade);
      return true;
    } catch {
      this.audioEl = null;
      return false;
    }
  }

  private startSynth(): void {
    if (typeof window === "undefined") return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => null);
    }

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(
      this.isMuted ? 0.0001 : 0.24,
      ctx.currentTime + 1.4
    );

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(1650, ctx.currentTime);
    lowpass.Q.setValueAtTime(0.7, ctx.currentTime);

    lowpass.connect(master);
    master.connect(ctx.destination);

    this.ctx = ctx;
    this.masterGain = master;

    const triggerBar = () => {
      if (!this.ctx || !this.isPlaying) return;
      const now = this.ctx.currentTime;
      const chord = CHORD_PROGRESSION[this.chordIdx % CHORD_PROGRESSION.length];
      this.chordIdx++;

      // Warm electric piano + analog pad chord
      chord.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const padGain = this.ctx.createGain();
        osc.type = i === 0 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq, now);
        // Sedikit detune halus agar terasa hangat seperti tape analog
        osc.detune.setValueAtTime((i - 2) * 3.5, now);

        const peak = i === 0 ? 0.22 : 0.095;
        padGain.gain.setValueAtTime(0.0001, now);
        padGain.gain.linearRampToValueAtTime(peak, now + 0.18 + i * 0.04);
        padGain.gain.exponentialRampToValueAtTime(0.0008, now + 3.6);

        osc.connect(padGain);
        padGain.connect(lowpass);
        osc.start(now + i * 0.03);
        osc.stop(now + 3.7);
      });

      // Gentle bell arpeggio accents (4 ketukan per bar)
      for (let step = 0; step < 4; step++) {
        const note = MELODY_NOTES[this.melodyIdx % MELODY_NOTES.length];
        this.melodyIdx++;
        if (!note || !this.ctx) continue;

        const t0 = now + step * 0.85;
        const bell = this.ctx.createOscillator();
        const bellGain = this.ctx.createGain();
        bell.type = "sine";
        bell.frequency.setValueAtTime(note, t0);

        bellGain.gain.setValueAtTime(0.0001, t0);
        bellGain.gain.linearRampToValueAtTime(0.055, t0 + 0.04);
        bellGain.gain.exponentialRampToValueAtTime(0.0005, t0 + 1.3);

        bell.connect(bellGain);
        bellGain.connect(lowpass);
        bell.start(t0);
        bell.stop(t0 + 1.35);
      }
    };

    triggerBar();
    this.synthTimer = window.setInterval(triggerBar, 3400);
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.audioEl) {
      this.audioEl.muted = muted;
    }
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(muted ? 0.0001 : 0.24, now, 0.12);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  stop(): void {
    this.isPlaying = false;
    if (this.synthTimer !== null) {
      clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.src = "";
      } catch {
        // ignore
      }
      this.audioEl = null;
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        // ignore
      }
      this.ctx = null;
      this.masterGain = null;
    }
  }
}
