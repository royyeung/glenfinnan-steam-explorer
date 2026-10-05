// Procedural sound sources (no samples yet). Phase 1: Highland ambience (wind, a burn, birds)
// and a locomotive standing in steam (blower roar at the chimney, safety valves feathering,
// air pump beats, a low firebox roar heard in the cab). All levels are kept well below clipping.
import * as THREE from 'three';
import type { AudioEngine, SpatialSource } from './engine.ts';

type Noise = 'white' | 'pink' | 'brown';

function noiseBuffer(ctx: AudioContext, kind: Noise, seconds = 4, seed = 1) {
  const n = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s / 2147483647) * 2 - 1; };
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = rnd();
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    // crossfade the loop seam
    const f = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < f; i++) { const k = i / f; d[n - f + i] = d[n - f + i] * (1 - k) + d[i] * k; }
  }
  return buf;
}

function loop(ctx: AudioContext, buf: AudioBuffer) {
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  src.loopStart = 0.05; src.loopEnd = buf.duration - 0.05; src.start(ctx.currentTime, Math.random() * buf.duration * 0.5);
  return src;
}

const filt = (ctx: AudioContext, type: BiquadFilterType, freq: number, Q = 0.7) => new BiquadFilterNode(ctx, { type, frequency: freq, Q });

export interface LocoSoundPoints { chimney: THREE.Vector3; safetyValves: THREE.Vector3; airPump: THREE.Vector3; firehole: THREE.Vector3 }

export class Soundscape {
  private a: AudioEngine;
  private timers: number[] = [];
  private loco: Record<string, SpatialSource> = {};
  private rng = 1;

  constructor(a: AudioEngine) { this.a = a; }
  private rand() { this.rng = (this.rng * 16807) % 2147483647; return this.rng / 2147483647; }

  /** Wind bed with slow gusts, a burn (stream) at a fixed spot, occasional small birds. */
  ambience(burnAt: THREE.Vector3) {
    const ctx = this.a.ctx!;
    const brown = noiseBuffer(ctx, 'brown', 6, 3), pink = noiseBuffer(ctx, 'pink', 5, 7), white = noiseBuffer(ctx, 'white', 3, 11);
    // wind: brown noise through a moving low-pass, plus a faint pink "air" band
    const windGain = this.a.bed(0.0);
    const lp = filt(ctx, 'lowpass', 500, 0.5);
    loop(ctx, brown).connect(lp).connect(windGain);
    const air = ctx.createGain(); air.gain.value = 0.04;
    loop(ctx, pink).connect(filt(ctx, 'bandpass', 1800, 0.4)).connect(air).connect(windGain);
    const gust = () => {
      const t = ctx.currentTime, g = 0.10 + 0.12 * this.rand(), f = 300 + 700 * this.rand();
      windGain.gain.setTargetAtTime(g, t, 1.5 + 2 * this.rand());
      lp.frequency.setTargetAtTime(f, t, 2.0);
    };
    gust(); this.timers.push(window.setInterval(gust, 4000));
    // burn
    const burn = this.a.spatial('burn', burnAt, 6, 1);
    burn.gain.gain.value = 0.22;
    loop(ctx, white).connect(filt(ctx, 'bandpass', 2600, 0.6)).connect(filt(ctx, 'lowpass', 6000)).connect(burn.gain);
    loop(ctx, pink).connect(filt(ctx, 'bandpass', 700, 0.8)).connect(burn.gain);
    // birds: short frequency-swept chirps from random directions
    const chirp = () => {
      const t = ctx.currentTime + 0.05, n = 2 + Math.floor(this.rand() * 5);
      const pos = new THREE.Vector3((this.rand() - 0.5) * 160, 4 + this.rand() * 10, (this.rand() - 0.5) * 160);
      const s = this.a.spatial('bird', pos, 8, 1.2); s.gain.gain.value = 0.05;
      const base = 3200 + this.rand() * 2400;
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(), e = ctx.createGain(), t0 = t + i * (0.09 + this.rand() * 0.05);
        o.frequency.setValueAtTime(base, t0); o.frequency.exponentialRampToValueAtTime(base * (1.25 + this.rand() * 0.4), t0 + 0.05);
        e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(1, t0 + 0.008); e.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
        o.connect(e).connect(s.gain); o.start(t0); o.stop(t0 + 0.08);
      }
      window.setTimeout(() => s.gain.disconnect(), 2000);
    };
    const schedule = () => { chirp(); this.timers.push(window.setTimeout(schedule, 3500 + this.rand() * 9000)); };
    this.timers.push(window.setTimeout(schedule, 2000));
  }

  /** A locomotive standing in steam. */
  locoIdle(p: LocoSoundPoints) {
    const ctx = this.a.ctx!;
    const pink = noiseBuffer(ctx, 'pink', 5, 21), white = noiseBuffer(ctx, 'white', 4, 23), brown = noiseBuffer(ctx, 'brown', 5, 29);
    // blower: rough roar from the chimney
    const blower = this.loco.blower = this.a.spatial('blower', p.chimney, 5, 1);
    blower.gain.gain.value = 0.32;
    loop(ctx, pink).connect(filt(ctx, 'bandpass', 380, 0.6)).connect(blower.gain);
    loop(ctx, brown).connect(filt(ctx, 'lowpass', 160)).connect(blower.gain);
    // safety valves feathering: a thin high hiss that swells now and then
    const sv = this.loco.safety = this.a.spatial('safety', p.safetyValves, 5, 1);
    sv.gain.gain.value = 0.0;
    loop(ctx, white).connect(filt(ctx, 'highpass', 2500)).connect(filt(ctx, 'peaking', 5200, 1)).connect(sv.gain);
    const feather = () => {
      const t = ctx.currentTime, on = this.rand() < 0.45;
      sv.gain.gain.setTargetAtTime(on ? 0.05 + 0.1 * this.rand() : 0.012, t, on ? 0.6 : 1.2);
    };
    feather(); this.timers.push(window.setInterval(feather, 5000));
    // air pump: double beat while pumping, then rests
    const pump = this.loco.pump = this.a.spatial('pump', p.airPump, 4, 1);
    pump.gain.gain.value = 0.5;
    let pumping = true, phaseEnd = ctx.currentTime + 18;
    const beat = (t0: number, strong: number) => {
      const src = ctx.createBufferSource(); src.buffer = pink;
      const e = ctx.createGain(), lpf = filt(ctx, 'lowpass', 900);
      e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(0.35 * strong, t0 + 0.012); e.gain.exponentialRampToValueAtTime(0.002, t0 + 0.22);
      src.connect(lpf).connect(e).connect(pump.gain); src.start(t0, this.rand() * 3, 0.3);
      const o = ctx.createOscillator(), oe = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(72, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.15);
      oe.gain.setValueAtTime(0, t0); oe.gain.linearRampToValueAtTime(0.25 * strong, t0 + 0.01); oe.gain.exponentialRampToValueAtTime(0.002, t0 + 0.18);
      o.connect(oe).connect(pump.gain); o.start(t0); o.stop(t0 + 0.2);
    };
    const tick = () => {
      const t = ctx.currentTime;
      if (t > phaseEnd) { pumping = !pumping; phaseEnd = t + (pumping ? 14 + 10 * this.rand() : 20 + 15 * this.rand()); }
      if (pumping) { beat(t + 0.05, 1); beat(t + 0.62, 0.8); }
    };
    this.timers.push(window.setInterval(tick, 1300));
    // firebox: a low roar that you only really hear on the footplate
    const fire = this.loco.fire = this.a.spatial('firebox', p.firehole, 1.2, 2.2);
    fire.gain.gain.value = 0.22;
    loop(ctx, brown).connect(filt(ctx, 'lowpass', 220)).connect(fire.gain);
    loop(ctx, pink).connect(filt(ctx, 'bandpass', 900, 0.5)).connect(filt(ctx, 'lowpass', 1500)).connect(fire.gain);
  }

  /** Keep loco sources attached to the moving engine. */
  moveLoco(p: LocoSoundPoints) {
    const m: [string, THREE.Vector3][] = [['blower', p.chimney], ['safety', p.safetyValves], ['pump', p.airPump], ['fire', p.firehole]];
    for (const [k, v] of m) if (this.loco[k]) this.a.moveSource(this.loco[k], v);
  }

  dispose() { for (const t of this.timers) { clearInterval(t); clearTimeout(t); } this.timers = []; }
}
