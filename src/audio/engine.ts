// Web Audio engine: master bus with a safety limiter, mute/volume, unlock on the first user
// gesture, and spatial sources whose listener follows the active camera.
import * as THREE from 'three';

export interface SpatialSource { name: string; panner: PannerNode; gain: GainNode }

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  bus!: GainNode; // everything mixes here, before the limiter
  analyser!: AnalyserNode;
  private limiter!: DynamicsCompressorNode;
  private sources: SpatialSource[] = [];
  private builders: ((a: AudioEngine) => void)[] = [];
  volume = 0.8;
  muted = false;
  hrtf = true;

  /** Register a function that creates sound sources once the context exists. */
  onStart(fn: (a: AudioEngine) => void) { this.builders.push(fn); if (this.ctx) fn(this); }

  /** Must be called from a user gesture (browsers block audio until then). */
  async unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: 'interactive' });
      this.bus = this.ctx.createGain();
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -6; this.limiter.knee.value = 6; this.limiter.ratio.value = 12;
      this.limiter.attack.value = 0.003; this.limiter.release.value = 0.25;
      this.master = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 2048;
      this.bus.connect(this.limiter).connect(this.master).connect(this.analyser).connect(this.ctx.destination);
      this.applyVolume();
      for (const b of this.builders) b(this);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  get running() { return !!this.ctx && this.ctx.state === 'running'; }

  setVolume(v: number) { this.volume = v; this.applyVolume(); }
  setMuted(m: boolean) { this.muted = m; this.applyVolume(); }
  private applyVolume() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
  }

  /** A positioned sound: connect your nodes into `gain`. refDistance in metres. */
  spatial(name: string, pos: THREE.Vector3, refDistance = 4, rolloff = 1): SpatialSource {
    const ctx = this.ctx!;
    const panner = new PannerNode(ctx, {
      panningModel: this.hrtf ? 'HRTF' : 'equalpower', distanceModel: 'inverse',
      refDistance, rolloffFactor: rolloff, maxDistance: 2000,
      positionX: pos.x, positionY: pos.y, positionZ: pos.z,
    });
    const gain = ctx.createGain();
    gain.connect(panner).connect(this.bus);
    const s = { name, panner, gain };
    this.sources.push(s);
    return s;
  }

  /** Non-spatial bed (ambience). */
  bed(level = 1) { const g = this.ctx!.createGain(); g.gain.value = level; g.connect(this.bus); return g; }

  moveSource(s: SpatialSource, pos: THREE.Vector3) {
    const t = this.ctx!.currentTime;
    s.panner.positionX.setTargetAtTime(pos.x, t, 0.02); s.panner.positionY.setTargetAtTime(pos.y, t, 0.02); s.panner.positionZ.setTargetAtTime(pos.z, t, 0.02);
  }

  private fwd = new THREE.Vector3(); private up = new THREE.Vector3();
  updateListener(camera: THREE.Camera) {
    if (!this.ctx) return;
    const L = this.ctx.listener, t = this.ctx.currentTime, p = camera.getWorldPosition(new THREE.Vector3());
    camera.getWorldDirection(this.fwd); this.up.set(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    if (L.positionX) {
      L.positionX.setTargetAtTime(p.x, t, 0.02); L.positionY.setTargetAtTime(p.y, t, 0.02); L.positionZ.setTargetAtTime(p.z, t, 0.02);
      L.forwardX.setTargetAtTime(this.fwd.x, t, 0.02); L.forwardY.setTargetAtTime(this.fwd.y, t, 0.02); L.forwardZ.setTargetAtTime(this.fwd.z, t, 0.02);
      L.upX.setTargetAtTime(this.up.x, t, 0.02); L.upY.setTargetAtTime(this.up.y, t, 0.02); L.upZ.setTargetAtTime(this.up.z, t, 0.02);
    } else {
      L.setPosition(p.x, p.y, p.z); L.setOrientation(this.fwd.x, this.fwd.y, this.fwd.z, this.up.x, this.up.y, this.up.z);
    }
  }

  /** RMS and peak of the master output in dBFS (verification harness). */
  levels() {
    if (!this.ctx) return null;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0, peak = 0;
    for (const x of buf) { sum += x * x; peak = Math.max(peak, Math.abs(x)); }
    const db = (v: number) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
    return { rms: db(Math.sqrt(sum / buf.length)), peak: db(peak), state: this.ctx.state };
  }
}
