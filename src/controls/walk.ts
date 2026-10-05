// First-person walking for a 1.70 m person: capsule body for walls, downward rays for the floor,
// so steps up to STEP_MAX are climbed and drops are followed with gravity. Collision runs against
// one merged BVH of all colliders (three-mesh-bvh), on the fixed simulation step.
import * as THREE from 'three';
import { MeshBVH, type ExtendedTriangle } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const AVATAR = { height: 1.7, eye: 1.6, radius: 0.24, stepMax: 0.45, walk: 1.4, run: 3.2, gravity: 9.81 };

export interface WalkInput { fwd: number; strafe: number; run: boolean; lookX: number; lookY: number }

export class Walker {
  readonly feet = new THREE.Vector3();
  yaw = 0; pitch = 0;
  velY = 0;
  onGround = false;
  groundHeight = 0;
  input: WalkInput = { fwd: 0, strafe: 0, run: false, lookX: 0, lookY: 0 };
  private bvh: MeshBVH | null = null;
  private tri = { p: new THREE.Vector3(), c: new THREE.Vector3() };
  private seg = new THREE.Line3();
  private box = new THREE.Box3();
  private ray = new THREE.Ray();

  /** Bake collider meshes (world space) into one BVH. Call again when the scene changes. */
  setColliders(meshes: THREE.Object3D[]) {
    const geos: THREE.BufferGeometry[] = [];
    for (const root of meshes) root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh) return;
      m.updateWorldMatrix(true, false);
      // GLB positions may be quantized/interleaved: read through the accessor into plain floats
      const src = m.geometry.getAttribute('position'), arr = new Float32Array(src.count * 3);
      for (let i = 0; i < src.count; i++) { arr[i * 3] = src.getX(i); arr[i * 3 + 1] = src.getY(i); arr[i * 3 + 2] = src.getZ(i); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      if (m.geometry.index) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(m.geometry.index.array as ArrayLike<number>), 1));
      g.applyMatrix4(m.matrixWorld);
      geos.push(g.index ? g.toNonIndexed() : g);
    });
    const merged = mergeGeometries(geos, false);
    this.bvh = merged ? new MeshBVH(merged) : null;
  }

  teleport(x: number, y: number, z: number, yaw = this.yaw) {
    this.feet.set(x, y, z); this.yaw = yaw; this.velY = 0;
    this.snapToFloor(1.0);
  }

  get eyePosition() { return new THREE.Vector3(this.feet.x, this.feet.y + AVATAR.eye, this.feet.z); }

  applyTo(camera: THREE.PerspectiveCamera) {
    camera.position.copy(this.eyePosition);
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  step(dt: number) {
    const inp = this.input;
    this.yaw -= inp.lookX; this.pitch = THREE.MathUtils.clamp(this.pitch - inp.lookY, -1.45, 1.45);
    inp.lookX = inp.lookY = 0;
    const speed = inp.run ? AVATAR.run : AVATAR.walk;
    const f = THREE.MathUtils.clamp(inp.fwd, -1, 1), s = THREE.MathUtils.clamp(inp.strafe, -1, 1);
    const mag = Math.min(1, Math.hypot(f, s));
    if (mag > 0.01) {
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw), k = (speed * dt * mag) / Math.hypot(f, s);
      this.feet.x += (-sin * f + cos * s) * k;
      this.feet.z += (-cos * f - sin * s) * k;
    }
    this.resolveWalls();
    this.velY -= AVATAR.gravity * dt;
    this.feet.y += this.velY * dt;
    this.snapToFloor(0.25);
  }

  /** Push the capsule (from step height to head) out of walls, horizontally only. */
  private resolveWalls() {
    if (!this.bvh) return;
    const r = AVATAR.radius;
    for (let it = 0; it < 3; it++) {
      this.seg.start.set(this.feet.x, this.feet.y + AVATAR.stepMax + r, this.feet.z);
      this.seg.end.set(this.feet.x, this.feet.y + AVATAR.height - r, this.feet.z);
      this.box.makeEmpty(); this.box.expandByPoint(this.seg.start); this.box.expandByPoint(this.seg.end); this.box.expandByScalar(r);
      let moved = false;
      this.bvh.shapecast({
        intersectsBounds: (b) => b.intersectsBox(this.box),
        intersectsTriangle: (t: ExtendedTriangle) => {
          const d = t.closestPointToSegment(this.seg, this.tri.p, this.tri.c);
          if (d < r) {
            const push = this.tri.c.clone().sub(this.tri.p); push.y = 0;
            const l = push.length();
            if (l > 1e-6) { push.multiplyScalar((r - d) / l); this.feet.add(push); this.seg.start.add(push); this.seg.end.add(push); moved = true; }
          }
          return false;
        },
      });
      if (!moved) break;
    }
  }

  /** Stand on the highest floor within step reach under the feet (centre + 4 samples). */
  private snapToFloor(snapDown: number) {
    if (!this.bvh) { if (this.feet.y < 0) { this.feet.y = 0; this.velY = 0; this.onGround = true; } return; }
    const top = this.feet.y + AVATAR.stepMax;
    let best = -Infinity;
    const off = AVATAR.radius * 0.6;
    for (const [dx, dz] of [[0, 0], [off, 0], [-off, 0], [0, off], [0, -off]]) {
      this.ray.origin.set(this.feet.x + dx, top + 0.02, this.feet.z + dz); this.ray.direction.set(0, -1, 0);
      const hit = this.bvh.raycastFirst(this.ray, THREE.DoubleSide);
      if (hit && hit.point.y <= top + 0.001) best = Math.max(best, hit.point.y);
    }
    if (best > -Infinity && this.velY <= 0 && this.feet.y <= best + snapDown && this.feet.y >= best - 2) {
      this.feet.y = best; this.velY = 0; this.onGround = true; this.groundHeight = best;
    } else this.onGround = false;
  }
}
