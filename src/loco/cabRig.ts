// Applies control values and the footplate simulation to the cab nodes (controls, needles,
// water-gauge columns, cut-off indicator, fire glow). Nodes exist only in the close-up model.
import * as THREE from 'three';
import { CAB } from '../specs/cab.ts';
import { CONTROLS, GAUGES } from './cabControls.ts';
import type { Footplate } from '../sim/footplate.ts';

export class CabRig {
  private ctl = new Map<string, THREE.Object3D>();
  private needles = new Map<string, THREE.Object3D>();
  private water: THREE.Object3D[] = [];
  private ind: THREE.Object3D | null = null;
  private fireMats: THREE.MeshStandardMaterial[] = [];
  readonly fireLight = new THREE.PointLight(0xff7a2a, 0, 4.5, 2);
  readonly cabLamp = new THREE.PointLight(0xffd9a0, 0, 3.5, 2);
  readonly available: boolean;

  constructor(engine: THREE.Object3D, tender: THREE.Object3D) {
    for (const k of CONTROLS) { const n = (k.on === 'engine' ? engine : tender).getObjectByName(`ctl_${k.id}`); if (n) this.ctl.set(k.id, n); }
    for (const g of GAUGES) for (let i = 0; i < g.needles; i++) { const n = engine.getObjectByName(`needle_${g.id}_${i}`); if (n) this.needles.set(`${g.id}_${i}`, n); }
    for (const S of ['L', 'R']) { const n = engine.getObjectByName(`wg_water_${S}`); if (n) this.water.push(n); }
    this.ind = engine.getObjectByName('ind_cutoff') ?? null;
    engine.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.name === 'decal_fire' && !this.fireMats.includes(m)) this.fireMats.push(m); });
    this.available = this.ctl.size > 0;
    const fh = CAB.fireholeH.v, bh = CAB.backheadD.v;
    this.fireLight.position.set(0, fh, 0); this.fireLight.userData.d = bh - 0.12; // just inside the firebox: shines out through the firehole
    this.cabLamp.position.set(0, 3.45, 0); this.cabLamp.userData.d = 11.2;
  }

  apply(fp: Footplate, time: number) {
    for (const k of CONTROLS) {
      const n = this.ctl.get(k.id); if (!n) continue;
      const v = fp.c[k.id], t = (v - k.min) / (k.max - k.min), a = k.at0 + (k.at1 - k.at0) * t;
      if (k.id === 'fireDoors') { const l = n.getObjectByName('door_L'), r = n.getObjectByName('door_R'); if (l) l.position.x = a; if (r) r.position.x = -a; continue; }
      if (k.id === 'coalDoors') { const l = n.getObjectByName('door_L'), r = n.getObjectByName('door_R'); if (l) l.rotation.y = -a; if (r) r.rotation.y = a; continue; }
      if (k.kind === 'button') { n.position.z = n.userData.z0 ??= n.position.z; n.position.z = n.userData.z0 + a; continue; }
      n.rotation.set(0, 0, 0); n.rotation[k.axis] = a;
    }
    const dial = (id: string, i: number, val: number, max: number) => { const n = this.needles.get(`${id}_${i}`); if (n) n.rotation.z = THREE.MathUtils.degToRad(-135 + 270 * Math.min(1.02, Math.max(0, val / max))); };
    dial('pressure', 0, fp.pressure, 300);
    dial('vacuum', 0, fp.vacTrain, 30); dial('vacuum', 1, fp.vacRes, 30);
    dial('air', 0, fp.mainRes, 150); dial('air', 1, fp.brakePipe, 150);
    dial('heat', 0, 0, 100);
    const hGlass = CAB.gaugeGlassH1.v - CAB.gaugeGlassH0.v - 0.04;
    for (const w of this.water) { const bob = 1 + 0.015 * Math.sin(time * 7) * Math.min(1, Math.abs(fp.wheelOmega)); w.scale.y = Math.max(0.001, fp.water * bob); w.visible = fp.water > 0.01; void hGlass; }
    if (this.ind) this.ind.position.y = (this.ind.userData.y0 ??= this.ind.position.y) + fp.c.reverser * 0.11;
    // fire: flicker, brighter with draught; light spills out when the doors are open
    const flick = 0.82 + 0.1 * Math.sin(time * 13.1) + 0.06 * Math.sin(time * 29.7 + 1.3) + 0.04 * Math.sin(time * 51.3);
    // exposure is 0.3 (sky-calibrated); with a bright fire texture ~4x gives a glowing but saturated bed
    for (const m of this.fireMats) m.emissiveIntensity = (1.5 + 3.5 * fp.fire) * flick;
    this.fireLight.intensity = (0.6 + 9 * fp.c.fireDoors) * fp.fire * flick;
    this.cabLamp.intensity = fp.c.cabLight > 0.5 ? 1.6 : 0;
  }

  get controlNodes() { return this.ctl; }
}
