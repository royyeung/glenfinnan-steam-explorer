// The coach rake: clones of the Mk2 GLB levels, coupled behind the tender. Each coach gets its own
// material copies (own running number, own weathering frame), its doors swing open when you walk
// up to them, inner gangway doors are hidden so you can walk through the train, and the interior
// is drawn only when you are close.
import * as THREE from 'three';
import { MK2, FORMATION } from '../specs/mk2.ts';
import { mk2Layout } from './mk2.ts';

export interface Coach { lod: THREE.LOD; number: string; index: number; doors: THREE.Object3D[][]; interiors: THREE.Object3D[]; open: Map<THREE.Object3D, number> }

export class Train {
  readonly coaches: Coach[] = [];
  readonly group = new THREE.Group();
  onDoor: (pos: THREE.Vector3, opening: boolean) => void = () => {};

  /** levels: the three LOD roots of the coach model; frontZ: world z of the tender's rear buffer face. */
  constructor(levels: THREE.Object3D[], frontZ: number, lodDist: number[]) {
    this.group.name = 'train';
    const lob = MK2.lengthOverBuffers.v;
    FORMATION.forEach((num, i) => {
      const lod = new THREE.LOD(); lod.name = `coach_${num}`;
      const coach: Coach = { lod, number: num, index: i, doors: [], interiors: [], open: new Map() };
      levels.forEach((src, l) => {
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
        if (gA) gA.visible = i === 0;
        if (gB) gB.visible = i === FORMATION.length - 1;
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

  /** Door swing and interior visibility, every frame. */
  update(camera: THREE.Camera, walkerFeet: THREE.Vector3 | null, dt: number) {
    const cam = camera.getWorldPosition(new THREE.Vector3()), lay = mk2Layout();
    for (const c of this.coaches) {
      const local = c.lod.worldToLocal(cam.clone());
      const near = Math.abs(local.x) < 5 && Math.abs(local.z) < lay.L / 2 + 4 && local.y > -1 && local.y < 7;
      for (const it of c.interiors) it.visible = near;
      // doors open when the walker is within 1.6 m of them (both sides), close when they leave
      const feet = walkerFeet ? c.lod.worldToLocal(walkerFeet.clone()) : null;
      for (const doors of c.doors) for (const d of doors) {
        const k = d.name.split('_')[2] as 'A' | 'C' | 'B', s = d.name.endsWith('_L') ? 1 : -1;
        const dz = lay.z(lay.doors[k]), dx = s * lay.halfW;
        const want = feet && Math.hypot(feet.x - dx, feet.z - dz) < 1.6 && Math.abs(feet.y - 1.1) < 1.2 ? 1 : 0;
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
