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

export interface LocoSoundPoints { chimney: THREE.Vector3; safetyValves: THREE.Vector3; airPump: THREE.Vector3; firehole: THREE.Vector3; cylL: THREE.Vector3; cylR: THREE.Vector3; injector: THREE.Vector3; motionL: THREE.Vector3; motionR: THREE.Vector3 }

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

  // ---------------------------------------------------------------- Phase 5: the glen
  private windBed: GainNode | null = null; private windHi: GainNode | null = null;
  private hourOf: () => number = () => 11;

  /** Glenfinnan: wind (stronger and whistling on the viaduct), the River Finnan along its bed,
   *  small waves on Loch Shiel's shore, birds by day and owls at night, echo under the arches. */
  landscape(world: { json: { water: { kind: string; hole: boolean; ring: [number, number][]; y: number[] }[]; lochLevel: number; landmarks: { monument: [number, number, number] } } }, hour: () => number) {
    const ctx = this.a.ctx!; this.hourOf = hour;
    const brown = noiseBuffer(ctx, 'brown', 6, 3), pink = noiseBuffer(ctx, 'pink', 5, 7), white = noiseBuffer(ctx, 'white', 3, 11);
    // wind bed with gusts; a high whistle band rises with exposure (see landscapeUpdate)
    const wind = this.windBed = this.a.bed(0.0), lp = filt(ctx, 'lowpass', 500, 0.5);
    loop(ctx, brown).connect(lp).connect(wind);
    const hi = this.windHi = ctx.createGain(); hi.gain.value = 0;
    loop(ctx, pink).connect(filt(ctx, 'bandpass', 2300, 3)).connect(hi).connect(wind);
    const gust = () => { const t = ctx.currentTime; wind.gain.setTargetAtTime((0.09 + 0.12 * this.rand()) * this.exposure, t, 1.5 + 2 * this.rand()); lp.frequency.setTargetAtTime(300 + 700 * this.rand() + 400 * (this.exposure - 1), t, 2.0); };
    gust(); this.timers.push(window.setInterval(gust, 4000));
    // the river: rushing water at points along the River Finnan near the viaduct
    const river = world.json.water.filter((w) => w.kind === 'river' && !w.hole);
    const pts: THREE.Vector3[] = [];
    for (const r of river) for (let i = 0; i < r.ring.length; i += 6) { const [x, z] = r.ring[i]; if (Math.hypot(x, z + 40) < 700) pts.push(new THREE.Vector3(x, r.y[i] + 0.3, z)); }
    const chosen: THREE.Vector3[] = [];
    for (const p of pts) if (chosen.every((c) => c.distanceTo(p) > 90)) chosen.push(p);
    for (const [i, p] of chosen.slice(0, 7).entries()) {
      const s = this.a.spatial('river', p, 9, 1.1); s.gain.gain.value = 0.16;
      loop(ctx, white).connect(filt(ctx, 'bandpass', 1800 + 500 * (i % 3), 0.5)).connect(filt(ctx, 'lowpass', 7000)).connect(s.gain);
      loop(ctx, pink).connect(filt(ctx, 'bandpass', 500 + 120 * i, 0.7)).connect(s.gain);
    }
    // the loch: slow waves breaking on the shingle by the monument
    const [mx, , mz] = world.json.landmarks.monument;
    for (const [dx, dz] of [[-60, 25], [70, 40], [0, 70]]) {
      const s = this.a.spatial('loch', new THREE.Vector3(mx + dx, world.json.lochLevel + 0.2, mz + dz), 7, 1.2); s.gain.gain.value = 0;
      const env = ctx.createGain(); env.gain.value = 0;
      loop(ctx, pink).connect(filt(ctx, 'lowpass', 1200, 0.6)).connect(env).connect(s.gain);
      s.gain.gain.value = 0.22;
      const wave = () => { const t = ctx.currentTime, a = 0.4 + 0.6 * this.rand(); env.gain.setTargetAtTime(a, t, 0.5); env.gain.setTargetAtTime(0.05, t + 1.2 + this.rand(), 0.9); };
      wave(); this.timers.push(window.setInterval(wave, 3800 + Math.floor(this.rand() * 2400)));
    }
    // wildlife: song birds by day (busiest at dawn), a curlew over the moor now and then, owls at night
    const call = () => {
      const h = this.hourOf(), day = h > 5 && h < 21.5, dawn = Math.max(0, 1 - Math.abs(h - 6) / 2);
      if (day) {
        this.chirp(ctx, new THREE.Vector3((this.rand() - 0.5) * 300, 40 + this.rand() * 30, (this.rand() - 0.5) * 300));
        if (this.rand() < 0.08) this.curlew(ctx, new THREE.Vector3((this.rand() - 0.5) * 900, 120, (this.rand() - 0.5) * 900));
      } else if (this.rand() < 0.35) this.owl(ctx, new THREE.Vector3((this.rand() - 0.5) * 400, 40, (this.rand() - 0.5) * 400));
      this.timers.push(window.setTimeout(call, (day ? 2500 + this.rand() * 7000 : 7000 + this.rand() * 12000) / (1 + 2 * dawn)));
    };
    this.timers.push(window.setTimeout(call, 1500));
  }

  private exposure = 1;
  /** Per frame: wind exposure from the height above the ground below; echo near the viaduct. */
  landscapeUpdate(listener: THREE.Vector3, world: { data: { height: (x: number, z: number) => number; track: { viaduct: [number, number]; nearest: (x: number, z: number) => number; at: (s: number) => THREE.Vector3 } } }) {
    if (!this.windBed) return;
    const above = listener.y - world.data.height(listener.x, listener.z);
    this.exposure = 1 + THREE.MathUtils.clamp((above - 4) / 22, 0, 1) * 0.9;
    const t = this.a.ctx!.currentTime;
    this.windHi!.gain.setTargetAtTime(THREE.MathUtils.clamp((above - 10) / 20, 0, 1) * 0.05, t, 0.8);
    const tr = world.data.track, s = tr.nearest(listener.x, listener.z), [sW, sE] = tr.viaduct;
    const p = tr.at(s), d = Math.hypot(p.x - listener.x, p.z - listener.z);
    const near = s > sW - 5 && s < sE + 5 && d < 45 && listener.y < p.y - 3 ? 1 - d / 45 : 0;   // below the deck, beside or under the arches
    this.a.setEcho(near);
  }

  private chirp(ctx: AudioContext, pos: THREE.Vector3) {
    const t = ctx.currentTime + 0.05, n = 2 + Math.floor(this.rand() * 5);
    const s = this.a.spatial('bird', pos, 14, 1.0); s.gain.gain.value = 0.05;
    const base = 3200 + this.rand() * 2400;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), e = ctx.createGain(), t0 = t + i * (0.09 + this.rand() * 0.05);
      o.frequency.setValueAtTime(base, t0); o.frequency.exponentialRampToValueAtTime(base * (1.25 + this.rand() * 0.4), t0 + 0.05);
      e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(1, t0 + 0.008); e.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
      o.connect(e).connect(s.gain); o.start(t0); o.stop(t0 + 0.08);
    }
    window.setTimeout(() => s.gain.disconnect(), 2000);
  }
  /** Curlew-like rising "cur-lee" whistles (synthesised). */
  private curlew(ctx: AudioContext, pos: THREE.Vector3) {
    const s = this.a.spatial('curlew', pos, 40, 1.0); s.gain.gain.value = 0.06;
    let t = ctx.currentTime + 0.05;
    for (let i = 0; i < 3 + Math.floor(this.rand() * 3); i++) {
      const o = ctx.createOscillator(), e = ctx.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(1, t + 0.06); e.gain.setTargetAtTime(0, t + 0.3, 0.06);
      o.connect(e).connect(s.gain); o.start(t); o.stop(t + 0.6); t += 0.55;
    }
    window.setTimeout(() => s.gain.disconnect(), 4000);
  }
  /** Tawny owl: a hoot, a pause, then a wavering hoo-hoo-hooo (synthesised). */
  private owl(ctx: AudioContext, pos: THREE.Vector3) {
    const s = this.a.spatial('owl', pos, 25, 1.0); s.gain.gain.value = 0.07;
    const note = (t0: number, d: number, f: number, vib = 0) => {
      const o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.setValueAtTime(f, t0);
      if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vib; lg.gain.value = 18; l.connect(lg).connect(o.frequency); l.start(t0); l.stop(t0 + d); }
      e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(1, t0 + 0.05); e.gain.setTargetAtTime(0, t0 + d - 0.1, 0.05);
      o.connect(filt(ctx, 'lowpass', 1200)).connect(e).connect(s.gain); o.start(t0); o.stop(t0 + d + 0.2);
    };
    const t = ctx.currentTime + 0.05;
    note(t, 0.6, 720); note(t + 2.4, 0.25, 700); note(t + 2.9, 1.1, 690, 9);
    window.setTimeout(() => s.gain.disconnect(), 6000);
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
      if (this.driven) return; // the footplate simulation controls the safety valves
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

  private motionSrc: Record<string, SpatialSource> = {};
  private driven = false;
  private injGain: GainNode | null = null;
  private whistleGain: GainNode | null = null;
  private ejectorGain: GainNode | null = null;
  private exhaust: SpatialSource | null = null;

  /**
   * Phase 3: footplate-driven sounds, called every frame. blower 0..1, safety 0..1 (valves lifting),
   * ejector 0..1, whistle 0..1, injectors 0..2 (number running). Whistle: a deep Stanier-type
   * "hooter" approximation (tone unverified against a recording of 45407).
   */
  footplate(s: { blower: number; safety: number; ejector: number; whistle: number; injectors: number }, p: LocoSoundPoints) {
    const ctx = this.a.ctx;
    if (!ctx || !this.loco.blower) return;
    this.driven = true;
    const t = ctx.currentTime;
    if (!this.whistleGain) {
      const src = this.a.spatial('whistle', new THREE.Vector3(p.safetyValves.x, p.safetyValves.y + 0.3, p.safetyValves.z + 0.75), 6, 1);
      const g = ctx.createGain(); g.gain.value = 0; g.connect(src.gain);
      const bp = filt(ctx, 'bandpass', 520, 0.9);
      for (const [f, a] of [[196, 0.5], [247, 0.32], [294, 0.22]] as const) { // a soft chord gives the hooter its hollow tone
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const og = ctx.createGain(); og.gain.value = a * 0.25; o.connect(og).connect(bp); o.start();
      }
      const breath = ctx.createGain(); breath.gain.value = 0.12;
      loop(ctx, noiseBuffer(ctx, 'pink', 3, 61)).connect(filt(ctx, 'bandpass', 900, 0.7)).connect(breath).connect(g);
      bp.connect(g);
      this.whistleGain = g;
      const ej = this.a.spatial('ejector', new THREE.Vector3(p.chimney.x, p.chimney.y, p.chimney.z), 4, 1);
      const eg = ctx.createGain(); eg.gain.value = 0; eg.connect(ej.gain);
      loop(ctx, noiseBuffer(ctx, 'white', 3, 67)).connect(filt(ctx, 'bandpass', 3000, 0.8)).connect(eg);
      this.ejectorGain = eg;
    }
    this.loco.blower.gain.gain.setTargetAtTime(0.08 + 0.45 * s.blower, t, 0.25);
    this.loco.safety.gain.gain.setTargetAtTime(0.008 + 0.22 * s.safety, t, s.safety > 0 ? 0.15 : 0.6);
    this.whistleGain.gain.setTargetAtTime(0.32 * s.whistle, t, s.whistle > 0 ? 0.04 : 0.08);
    this.ejectorGain!.gain.setTargetAtTime(0.06 * s.ejector, t, 0.3);
    if (this.injGain) this.injGain.gain.setTargetAtTime(0.14 * Math.min(1, s.injectors), t, 0.4);
  }

  /** Footstep at the listener: softer and duller on carpet, ringing on steel and boards. */
  footstep(surface: 'ground' | 'platform' | 'steel' | 'carpet', pos: THREE.Vector3) {
    const ctx = this.a.ctx; if (!ctx) return;
    const src = this.a.spatial('step', pos, 1.5, 1), t = ctx.currentTime + 0.005;
    const n = ctx.createBufferSource(); n.buffer = this.stepNoise ??= noiseBuffer(ctx, 'white', 1, 71);
    const e = ctx.createGain(), f = { ground: 600, platform: 1400, steel: 2200, carpet: 350 }[surface];
    const lv = { ground: 0.12, platform: 0.16, steel: 0.2, carpet: 0.07 }[surface] * (0.8 + 0.4 * this.rand());
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(lv, t + 0.006); e.gain.exponentialRampToValueAtTime(0.001, t + (surface === 'steel' ? 0.16 : 0.09));
    n.connect(filt(ctx, 'bandpass', f, 0.9)).connect(e).connect(src.gain); n.start(t, this.rand() * 0.8, 0.2);
    if (surface === 'steel') { const o = ctx.createOscillator(), oe = ctx.createGain(); o.frequency.value = 900 + 300 * this.rand(); oe.gain.setValueAtTime(0.02, t); oe.gain.exponentialRampToValueAtTime(0.0005, t + 0.25); o.connect(oe).connect(src.gain); o.start(t); o.stop(t + 0.26); }
    window.setTimeout(() => src.gain.disconnect(), 800);
  }
  private stepNoise: AudioBuffer | null = null;

  /** Slam door: opening = latch click + creak; closing = heavy slam. Central door locking beeps first. */
  door(pos: THREE.Vector3, opening: boolean) {
    const ctx = this.a.ctx; if (!ctx) return;
    const src = this.a.spatial('door', pos, 3, 1.2), t = ctx.currentTime + 0.01;
    if (opening) {
      for (const dt of [0, 0.18]) { const o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.value = 2400; e.gain.setValueAtTime(0, t + dt); e.gain.linearRampToValueAtTime(0.06, t + dt + 0.01); e.gain.setValueAtTime(0.06, t + dt + 0.1); e.gain.linearRampToValueAtTime(0, t + dt + 0.12); o.connect(e).connect(src.gain); o.start(t + dt); o.stop(t + dt + 0.13); }
      this.clank(pos, 2.2);
    } else {
      const n = ctx.createBufferSource(); n.buffer = this.stepNoise ??= noiseBuffer(ctx, 'white', 1, 71);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + 0.3); e.gain.linearRampToValueAtTime(0.22, t + 0.305); e.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      n.connect(filt(ctx, 'lowpass', 500)).connect(e).connect(src.gain); n.start(t + 0.3, 0, 0.4);
      const o = ctx.createOscillator(), oe = ctx.createGain(); o.frequency.setValueAtTime(110, t + 0.3); o.frequency.exponentialRampToValueAtTime(55, t + 0.5);
      oe.gain.setValueAtTime(0, t + 0.3); oe.gain.linearRampToValueAtTime(0.16, t + 0.305); oe.gain.exponentialRampToValueAtTime(0.001, t + 0.55); o.connect(oe).connect(src.gain); o.start(t + 0.3); o.stop(t + 0.6);
    }
    window.setTimeout(() => src.gain.disconnect(), 1500);
  }

  /** One-shot clank (firehole doors, gates, levers) at a position. */
  clank(pos: THREE.Vector3, pitch = 1) {
    const ctx = this.a.ctx; if (!ctx) return;
    const src = this.a.spatial('clank', pos, 2, 1.5), t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator(), e = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(180 * pitch, t); o.frequency.exponentialRampToValueAtTime(90 * pitch, t + 0.12);
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.08, t + 0.004); e.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(filt(ctx, 'lowpass', 1400)).connect(e).connect(src.gain); o.start(t); o.stop(t + 0.22);
    window.setTimeout(() => src.gain.disconnect(), 600);
  }
  private white: AudioBuffer | null = null;
  private lastQuarter = 0;
  private cocksUntil = 0;
  private wasMoving = false;

  /** Phase 2: sounds of the motion. Call every simulation step with the driving-wheel angle (rad) and rate (rad/s). */
  motion(theta: number, omega: number, p: LocoSoundPoints, sim?: { steam: number; cocks: number }) {
    const ctx = this.a.ctx;
    if (!ctx) return;
    if (!this.white) {
      this.white = noiseBuffer(ctx, 'white', 3, 41);
      for (const k of ['cylL', 'cylR', 'motionL', 'motionR', 'injector'] as const) this.motionSrc[k] = this.a.spatial(k, p[k], 3, 1.2);
      // leaks: a faint constant hiss near the cylinders; injector sings now and then
      for (const k of ['cylL', 'cylR'] as const) { const g = ctx.createGain(); g.gain.value = 0.025; loop(ctx, this.white).connect(filt(ctx, 'highpass', 3500)).connect(g).connect(this.motionSrc[k].gain); }
      const inj = this.motionSrc.injector, ig = ctx.createGain(); ig.gain.value = 0; ig.connect(inj.gain); this.injGain = ig;
      this.exhaust = this.a.spatial('exhaust', p.chimney, 6, 1);
      loop(ctx, this.white).connect(filt(ctx, 'bandpass', 2300, 3)).connect(ig);
      const o = ctx.createOscillator(); o.frequency.value = 1870; const og = ctx.createGain(); og.gain.value = 0.04; o.connect(og).connect(ig); o.start();
      const sing = () => { if (this.driven) return; const t = ctx.currentTime; ig.gain.setTargetAtTime(0.25, t, 0.4); ig.gain.setTargetAtTime(0, t + 7, 0.6); };
      this.timers.push(window.setInterval(sing, 47000)); window.setTimeout(sing, 9000);
    }
    const moving = Math.abs(omega) > 0.05;
    if (moving && !this.wasMoving && !sim) this.cocksUntil = ctx.currentTime + 15; // demo: cocks open for 15 s after starting
    if (sim) this.cocksUntil = sim.cocks > 0.5 ? ctx.currentTime + 1 : 0;
    this.wasMoving = moving;
    const quarter = Math.floor(theta / (Math.PI / 2));
    if (moving && quarter !== this.lastQuarter) {
      const t = ctx.currentTime + 0.01, side = ((quarter % 2) + 2) % 2 === 0 ? 'L' : 'R';
      // clank of the rods reversing at dead centre: short ring plus a thud
      const src = this.motionSrc[`motion${side}`], o = ctx.createOscillator(), e = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(240 + 40 * this.rand(), t);
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.12, t + 0.004); e.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(e).connect(src.gain); o.start(t); o.stop(t + 0.14);
      // exhaust beat ("chuff") when working under steam: one per quarter turn (two per cylinder per revolution)
      if (sim && sim.steam > 0.02 && this.exhaust) {
        const n = ctx.createBufferSource(); n.buffer = this.white; const ne = ctx.createGain(), dur = Math.min(0.35, 0.6 / Math.max(0.6, Math.abs(omega)));
        const level = Math.min(0.9, 0.25 + 1.2 * sim.steam);
        ne.gain.setValueAtTime(0, t); ne.gain.linearRampToValueAtTime(level, t + 0.015); ne.gain.exponentialRampToValueAtTime(0.002, t + dur);
        n.connect(filt(ctx, 'lowpass', 700)).connect(ne).connect(this.exhaust.gain); n.start(t, this.rand() * 2, dur + 0.05);
        const o2 = ctx.createOscillator(), e2 = ctx.createGain(); o2.frequency.setValueAtTime(70, t); o2.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        e2.gain.setValueAtTime(0, t); e2.gain.linearRampToValueAtTime(level * 0.6, t + 0.01); e2.gain.exponentialRampToValueAtTime(0.002, t + 0.16);
        o2.connect(e2).connect(this.exhaust.gain); o2.start(t); o2.stop(t + 0.18);
      }
      if (ctx.currentTime < this.cocksUntil) {
        const n = ctx.createBufferSource(); n.buffer = this.white; const ne = ctx.createGain(), dur = Math.min(0.5, 0.9 / Math.max(0.5, Math.abs(omega)));
        ne.gain.setValueAtTime(0, t); ne.gain.linearRampToValueAtTime(0.5, t + 0.02); ne.gain.exponentialRampToValueAtTime(0.002, t + dur);
        n.connect(filt(ctx, 'bandpass', 1600, 0.6)).connect(ne).connect(this.motionSrc[`cyl${side}`].gain); n.start(t, this.rand() * 2, dur + 0.05);
      }
    }
    this.lastQuarter = quarter;
  }

  /** Keep loco sources attached to the moving engine. */
  moveLoco(p: LocoSoundPoints) {
    const m: [string, THREE.Vector3][] = [['blower', p.chimney], ['safety', p.safetyValves], ['pump', p.airPump], ['fire', p.firehole]];
    for (const [k, v] of m) if (this.loco[k]) this.a.moveSource(this.loco[k], v);
  }

  dispose() { for (const t of this.timers) { clearInterval(t); clearTimeout(t); } this.timers = []; }
}
