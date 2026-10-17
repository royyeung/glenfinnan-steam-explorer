// The coach rake: clones of the Mk2 GLB levels, coupled behind the tender. Each coach gets its own
// material copies (own running number, own weathering frame), its doors swing open when you walk
// up to them, inner gangway doors are hidden so you can walk through the train, and the interior
// is drawn only when you are close. From inside the train the coaches either side are kept at full
// detail with their interiors (the view down the gangways), and the gangway door beyond them is shown
// closed, so the far coaches never appear as their hollow distant models.
import * as THREE from 'three';
import { MK2, FORMATION, type CoachType, type Vehicle } from '../specs/mk2.ts';
import { coachLayout, type CoachLayout } from './mk2.ts';

export interface Coach { lod: THREE.LOD; number: string; index: number; vehicle: Vehicle; lay: CoachLayout; doors: THREE.Object3D[][]; interiors: THREE.Object3D[]; gangway: { A: THREE.Object3D[]; B: THREE.Object3D[] }; open: Map<THREE.Object3D, number> }

/** Coaches either side of the one you are in that are drawn in full (beyond them a gangway door is closed). */
export const GANGWAY_REACH = 1;

export class Train {
  readonly coaches: Coach[] = [];
  readonly group = new THREE.Group();
  onDoor: (pos: THREE.Vector3, opening: boolean) => void = () => {};

  /** levels: the three LOD roots of each coach type; frontZ: world z of the tender's rear buffer face. */
  constructor(levels: Partial<Record<CoachType, THREE.Object3D[]>>, frontZ: number, lodDist: number[]) {
    this.group.name = 'train';
    const lob = MK2.lengthOverBuffers.v;
    FORMATION.forEach((vehicle, i) => {
      const num = vehicle.num, lod = new THREE.LOD(); lod.name = `coach_${num}`;
      const coach: Coach = { lod, number: num, index: i, vehicle, lay: coachLayout(vehicle.type), doors: [], interiors: [], gangway: { A: [], B: [] }, open: new Map() };
      levels[vehicle.type]!.forEach((src, l) => {
        const root = src.clone(true);
        // own materials per coach (shared programs, separate uniforms and textures)
        const copies = new Map<THREE.Material, THREE.Material>();
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const mat = m.material as THREE.Material;
          if (!copies.has(mat)) copies.set(mat, mat.clone());
          m.material = copies.get(mat)!;
        });
        // gangway doors only at the ends of the train
        const gA = root.getObjectByName('gw_door_A'), gB = root.getObjectByName('gw_door_B');
        if (gA) { gA.visible = i === 0; gA.userData.inner = i !== 0; coach.gangway.A.push(gA); }
        if (gB) { gB.visible = i === FORMATION.length - 1; gB.userData.inner = i !== FORMATION.length - 1; coach.gangway.B.push(gB); }
        const doors: THREE.Object3D[] = [];
        root.traverse((o) => { if (/^coach_door_/.test(o.name) && !(o as THREE.Mesh).isMesh) doors.push(o); });
        coach.doors.push(doors);
        const int = root.getObjectByName('coach_interior'); if (int) coach.interiors.push(int);
        lod.addLevel(root, lodDist[l]);
      });
      lod.position.set(0, 0, frontZ - lob / 2 - i * lob);
      this.group.add(lod);
      this.coaches.push(coach);
    });
  }

  /** The coach the camera is in (-1: none), from the last update. */
  insideIndex = -1;

  /** Door swing and interior visibility, every frame. locked: doors stay shut (central door locking
   *  while the train is moving). */
  update(camera: THREE.Camera, walkerFeet: THREE.Vector3 | null, dt: number, locked = false) {
    const cam = camera.getWorldPosition(new THREE.Vector3());
    const locals = this.coaches.map((c) => c.lod.worldToLocal(cam.clone()));
    // the coach the camera is in (body and its half of the gangway, floor to roof)
    const inside = this.coaches.findIndex((c, i) => Math.abs(locals[i].x) < c.lay.halfW && Math.abs(locals[i].z) < c.lay.L / 2 + 0.5 && locals[i].y > 0.8 && locals[i].y < 4.2);
    const last = this.coaches.length - 1;
    this.insideIndex = inside;
    for (const c of this.coaches) {
      const lay = c.lay, local = locals[c.index];
      const near = Math.abs(local.x) < 5 && Math.abs(local.z) < lay.L / 2 + 4 && local.y > -1 && local.y < 7;
      const full = inside >= 0 && Math.abs(c.index - inside) <= GANGWAY_REACH;
      // full detail while seen down the gangways (the renderer's distance switch would pick the hollow far models)
      c.lod.autoUpdate = !full;
      if (full) c.lod.levels.forEach((l, k) => { l.object.visible = k === 0; });
      for (const it of c.interiors) it.visible = near || full;
      // gangway doors: closed at the ends of the train, and beyond the coaches drawn in full
      for (const g of c.gangway.A) g.visible = c.index === 0 || (full && c.index === inside - GANGWAY_REACH);
      for (const g of c.gangway.B) g.visible = c.index === last || (full && c.index === inside + GANGWAY_REACH);
      // doors open when the walker is within 1.6 m of them (both sides), close when they leave
      const feet = walkerFeet ? c.lod.worldToLocal(walkerFeet.clone()) : null;
      for (const doors of c.doors) for (const d of doors) {
        const k = d.name.split('_')[2], s = d.name.endsWith('_L') ? 1 : -1;
        const dz = lay.z(lay.doors[k]), dx = s * lay.halfW;
        const want = !locked && feet && Math.hypot(feet.x - dx, feet.z - dz) < 1.6 && Math.abs(feet.y - 1.1) < 1.2 ? 1 : 0;
        const prev = c.open.get(d) ?? 0, cur = THREE.MathUtils.clamp(prev + (want ? 1 : -1) * dt * 1.8, 0, 1);
        if ((prev === 0 && cur > 0) || (prev > 0 && cur === 0)) {
          // one sound per physical door (the first LOD's node carries it)
          if (c.doors[0].includes(d)) this.onDoor(c.lod.localToWorld(new THREE.Vector3(dx, 2.0, dz)), cur > 0);
        }
        c.open.set(d, cur);
        d.rotation.y = -s * THREE.MathUtils.smoothstep(cur, 0, 1) * 1.6;
      }
    }
  }

  /** Full-detail roots (for colliders). */
  get closeLevels() { return this.coaches.map((c) => c.lod.levels[0].object); }
}
