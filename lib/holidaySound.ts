"use client";

let sharedCtx: AudioContext | null = null;
let sharedNoiseBuffer: AudioBuffer | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedCtx) {
    sharedCtx = new AudioCtx();
  }
  if (sharedCtx.state === "suspended") {
    sharedCtx.resume().catch(() => null);
  }
  return sharedCtx;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (sharedNoiseBuffer && sharedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return sharedNoiseBuffer;
  }
  const length = Math.floor(ctx.sampleRate * 1.4);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  sharedNoiseBuffer = buffer;
  return buffer;
}

/**
 * Harus dipanggil di dalam event handler klik user agar AudioContext unlocked oleh browser.
 */
export function unlockHolidayAudio(): void {
  getAudioContext();
}

/**
 * Suara peluncuran roket kembang api (desis naik + siulan tipis).
 */
export function playFireworkLaunchSound(volume = 0.22): void {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return;

  const now = ctx.currentTime;
  const duration = 0.42;

  // 1. Soft rising whoosh (bandpass noise)
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.Q.setValueAtTime(2.6, now);
  bandpass.frequency.setValueAtTime(520, now);
  bandpass.frequency.exponentialRampToValueAtTime(2400, now + duration);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.001, now);
  noiseGain.gain.linearRampToValueAtTime(volume * 0.55, now + 0.08);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + duration + 0.02);

  // 2. Subtle rocket whistle (sine sweep)
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(420 + Math.random() * 110, now);
  osc.frequency.exponentialRampToValueAtTime(1480 + Math.random() * 240, now + duration * 0.92);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.0001, now);
  oscGain.gain.linearRampToValueAtTime(volume * 0.14, now + 0.06);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/**
 * Suara ledakan kembang api (dentuman bass + letupan udara + gemeretak percikan).
 */
export function playFireworkBurstSound(volume = 0.34): void {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return;

  const now = ctx.currentTime;

  // 1. Deep resonant thump / boom
  const boomOsc = ctx.createOscillator();
  boomOsc.type = "sine";
  boomOsc.frequency.setValueAtTime(142 + Math.random() * 24, now);
  boomOsc.frequency.exponentialRampToValueAtTime(34, now + 0.32);

  const boomGain = ctx.createGain();
  boomGain.gain.setValueAtTime(volume * 0.85, now);
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

  boomOsc.connect(boomGain);
  boomGain.connect(ctx.destination);
  boomOsc.start(now);
  boomOsc.stop(now + 0.38);

  // 2. Explosion air crack (lowpass filtered noise burst)
  const burstNoise = ctx.createBufferSource();
  burstNoise.buffer = getNoiseBuffer(ctx);

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(1850, now);
  lowpass.frequency.exponentialRampToValueAtTime(220, now + 0.58);

  const burstGain = ctx.createGain();
  burstGain.gain.setValueAtTime(volume * 0.72, now);
  burstGain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);

  burstNoise.connect(lowpass);
  lowpass.connect(burstGain);
  burstGain.connect(ctx.destination);
  burstNoise.start(now);
  burstNoise.stop(now + 0.65);

  // 3. Staggered sparkling crackle tails
  const crackleCount = 7;
  for (let i = 0; i < crackleCount; i++) {
    const offset = 0.14 + Math.random() * 0.62;
    const crackLen = 0.035 + Math.random() * 0.035;
    const cSrc = ctx.createBufferSource();
    cSrc.buffer = getNoiseBuffer(ctx);

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(2600 + Math.random() * 1800, now + offset);

    const cGain = ctx.createGain();
    cGain.gain.setValueAtTime(0.0001, now + offset);
    cGain.gain.linearRampToValueAtTime(volume * (0.14 + Math.random() * 0.12), now + offset + 0.005);
    cGain.gain.exponentialRampToValueAtTime(0.0001, now + offset + crackLen);

    cSrc.connect(hp);
    hp.connect(cGain);
    cGain.connect(ctx.destination);
    cSrc.start(now + offset, Math.random() * 0.5, crackLen + 0.01);
  }
}

/**
 * Lonceng hangat kereta Santa saat membuka kado harian.
 */
export function playSantaChimeSound(volume = 0.18): void {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return;

  const now = ctx.currentTime;
  const notes = [783.99, 987.77, 1174.66, 1567.98]; // G5, B5, D6, G6

  notes.forEach((freq, idx) => {
    const start = now + idx * 0.075;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, start);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume * 0.55, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.52);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.55);
  });
}
