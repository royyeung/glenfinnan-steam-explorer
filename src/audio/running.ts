// Sounds of the train running (Phase 6): rolling noise from every vehicle, the "di-dum" of each axle
// over the rail joints, flange squeal on the 236 m curve of the viaduct, wind on the open footplate,
// and the rumble you hear inside a coach. Each vehicle has one spatial source that moves with it and
// is pitched by the Doppler shift. All procedural; levels are estimates, kept well below clipping.
// Jointed rail every 60 ft (18.288 m) is an assumption: whether this stretch is jointed or
// continuously welded was not found.
import * as THREE from 'three';
import type { AudioEngine, SpatialSource } from './engine.ts';
import { filt, loop, noiseBuffer } from './sounds.ts';

export const RAIL_LENGTH = 18.288;

interface Voice { src: SpatialSource; roll: GainNode; rollSrc: AudioBufferSourceNode[]; lp: BiquadFilterNode; squeal: GainNode; squealOsc: OscillatorNode[]; squealUntil: number; doppler: number }

export class RunningSounds {
  private a: AudioEngine;
  private voices: Voice[] = [];
  private click: AudioBuffer | null = null;
  private wind: GainNode | null = null; private windLp: BiquadFilterNode | null = null;
  private rumble: GainNode | null = null;
  private rng = 7;
  constructor(a: AudioEngine) { this.a = a; }
  private rand() { this.rng = (this.rng * 16807) % 2147483647; return this.rng / 2147483647; }

  private build(n: number) {
    const ctx = this.a.ctx!;
    const brown = noiseBuffer(ctx, 'brown', 4, 83), pink = noiseBuffer(ctx, 'pink', 4, 89);
    this.click = noiseBuffer(ctx, 'white', 0.5, 97);
    for (let i = 0; i < n; i++) {
      const src = this.a.spatial(`vehicle${i}`, new THREE.Vector3(), 5, 1);
      const roll = ctx.createGain(); roll.gain.value = 0;
      const lp = filt(ctx, 'lowpass', 300);
      const r1 = loop(ctx, i % 2 ? brown : pink), r2 = loop(ctx, i % 2 ? pink : brown);
      r1.connect(lp); r2.connect(filt(ctx, 'bandpass', 900, 0.8)).connect(lp);
      lp.connect(roll).connect(src.gain);
      // flange squeal: two thin partials with a slow wobble
      const squeal = ctx.createGain(); squeal.gain.value = 0; squeal.connect(src.gain);
      const f0 = 2600 + 1800 * this.rand(), osc: OscillatorNode[] = [];
      for (const [k, a] of [[1, 0.5], [2.03, 0.18]] as const) {
        const o = ctx.createOscillator(); o.frequency.value = f0 * k; const g = ctx.createGain(); g.gain.value = a;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 3 + 4 * this.rand(); const lg = ctx.createGain(); lg.gain.value = f0 * 0.012 * k;
        lfo.connect(lg).connect(o.frequency); o.connect(g).connect(squeal); o.start(); lfo.start(); osc.push(o);
      }
      this.voices.push({ src, roll, rollSrc: [r1, r2], lp, squeal, squealOsc: osc, squealUntil: 0, doppler: 1 });
    }
    // wind past your ears on the open footplate (or leaning out): not muffled
    this.wind = ctx.createGain(); this.wind.gain.value = 0; this.windLp = filt(ctx, 'lowpass', 800);
    loop(ctx, pink).connect(filt(ctx, 'highpass', 120)).connect(this.windLp).connect(this.wind).connect(this.a.dry);
    // inside a coach: low body rumble from the bogies, heard through the floor
    this.rumble = ctx.createGain(); this.rumble.gain.value = 0;
    loop(ctx, brown).connect(filt(ctx, 'lowpass', 140)).connect(this.rumble).connect(this.a.dry);
  }

  /** Every frame: vehicle centres and their velocity, the train speed (m/s), the curvature (1/m) under
   *  each vehicle, and where the listener is. */
  update(vehicles: { pos: THREE.Vector3; curvature: number }[], vel: THREE.Vector3, speed: number, where: 'out' | 'coach' | 'cab') {
    const ctx = this.a.ctx; if (!ctx) return;
    if (!this.voices.length) this.build(vehicles.length);
    const t = ctx.currentTime, v = Math.abs(speed);
    vehicles.forEach((veh, i) => {
      const vo = this.voices[i]; if (!vo) return;
      this.a.moveSource(vo.src, veh.pos);
      vo.doppler = this.a.doppler(veh.pos, vel);
      for (const r of vo.rollSrc) r.playbackRate.setTargetAtTime(vo.doppler, t, 0.05);
      // rolling: grows with speed, brighter when faster
      vo.roll.gain.setTargetAtTime(v < 0.05 ? 0 : Math.min(0.32, 0.05 + 0.03 * v), t, 0.2);
      vo.lp.frequency.setTargetAtTime(220 + 60 * v, t, 0.2);
      // squeal on a tight curve at low and moderate speed, now and then
      const tight = veh.curvature > 1 / 330 && v > 1 && v < 12;
      if (tight && t > vo.squealUntil + 2 && this.rand() < 0.012) vo.squealUntil = t + 0.8 + 2.5 * this.rand();
      vo.squeal.gain.setTargetAtTime(tight && t < vo.squealUntil ? 0.03 : 0, t, tight && t < vo.squealUntil ? 0.15 : 0.25);
      for (const o of vo.squealOsc) o.detune.setTargetAtTime(1200 * Math.log2(vo.doppler), t, 0.05);
    });
    this.wind!.gain.setTargetAtTime(where === 'cab' ? Math.min(0.25, 0.0025 * v * v) : 0, t, 0.3);
    this.windLp!.frequency.setTargetAtTime(500 + 90 * v, t, 0.3);
    this.rumble!.gain.setTargetAtTime(where === 'coach' ? Math.min(0.35, 0.03 * v) : 0, t, 0.3);
  }

  /** One wheel over a rail joint at audio time `when`, on vehicle i. */
  joint(i: number, when: number, speed: number) {
    const ctx = this.a.ctx, vo = this.voices[i]; if (!ctx || !vo || !this.click) return;
    const t = Math.max(ctx.currentTime, when), lv = Math.min(0.28, 0.06 + 0.02 * Math.abs(speed));
    const n = ctx.createBufferSource(); n.buffer = this.click; n.playbackRate.value = vo.doppler;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(lv, t + 0.003); e.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    n.connect(filt(ctx, 'bandpass', 450 * vo.doppler, 1.2)).connect(e).connect(vo.src.gain); n.start(t, this.rand() * 0.3, 0.1);
    const o = ctx.createOscillator(), oe = ctx.createGain(); o.frequency.setValueAtTime(95 * vo.doppler, t);
    oe.gain.setValueAtTime(0, t); oe.gain.linearRampToValueAtTime(lv * 0.8, t + 0.004); oe.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(oe).connect(vo.src.gain); o.start(t); o.stop(t + 0.1);
  }
}
