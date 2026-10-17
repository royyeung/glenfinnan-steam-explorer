// First-person walking for a 1.70 m person: capsule body for walls, downward rays for the floor,
// so steps up to STEP_MAX are climbed and drops are followed with gravity. Collision runs against
// one merged BVH of the fixed scene plus one BVH per vehicle in its own frame (three-mesh-bvh), on the
// fixed simulation step. Standing on a vehicle, the walker is carried with it as the train moves.
import * as THREE from 'three';
import { MeshBVH, type ExtendedTriangle } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const AVATAR = { height: 1.7, eye: 1.6, radius: 0.24, stepMax: 0.45, walk: 1.4, run: 3.2, gravity: 9.81 };

export interface WalkInput { fwd: number; strafe: number; run: boolean; lookX: number; lookY: number }

/** A collider: one BVH, either fixed in the world or baked in a moving vehicle's own frame. */
interface Body { bvh: MeshBVH; obj: THREE.Object3D | null; enabled: () => boolean; inv: THREE.Matrix4; rot: THREE.Matrix3 }
export interface Mover { obj: THREE.Object3D; roots: THREE.Object3D[]; enabled?: () => boolean }

export class Walker {
  readonly feet = new THREE.Vector3();
  yaw = 0; pitch = 0;
  velY = 0;
  onGround = false;
  groundHeight = 0;
  input: WalkInput = { fwd: 0, strafe: 0, run: false, lookX: 0, lookY: 0 };
  /** The vehicle under the walker's feet (carried along with it as the train moves). */
  ride: { body: Body; local: THREE.Vector3; yaw0: number } | null = null;
  private bodies: Body[] = [];
  private tri = { p: new THREE.Vector3(), c: new THREE.Vector3() };
  private seg = new THREE.Line3();
  private box = new THREE.Box3();
  private ray = new THREE.Ray();

  /** Bake colliders: fixed meshes (world space) into one BVH, and each moving vehicle into its own
   *  BVH in the vehicle's frame. Call again when the fixed scene changes. */
  setColliders(meshes: THREE.Object3D[], movers: Mover[] = []) {
    this.bodies = [];
    const bake = (roots: THREE.Object3D[], toLocal: THREE.Matrix4 | null) => {
      const geos: THREE.BufferGeometry[] = [], m4 = new THREE.Matrix4();
      for (const root of roots) root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || /^(cab_gate|coach_door)/.test(m.name)) return; // gates and doors swing; not baked
        for (let p: THREE.Object3D | null = m; p; p = p.parent) if (p.userData.inner && /^gw_door/.test(p.name)) return; // gangway doors inside the train (drawn closed only far ahead)
        m.updateWorldMatrix(true, false);
        // GLB positions may be quantized/interleaved: read through the accessor into plain floats
        const src = m.geometry.getAttribute('position'), arr = new Float32Array(src.count * 3);
        for (let i = 0; i < src.count; i++) { arr[i * 3] = src.getX(i); arr[i * 3 + 1] = src.getY(i); arr[i * 3 + 2] = src.getZ(i); }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        if (m.geometry.index) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(m.geometry.index.array as ArrayLike<number>), 1));
        g.applyMatrix4(toLocal ? m4.multiplyMatrices(toLocal, m.matrixWorld) : m.matrixWorld);
        geos.push(g.index ? g.toNonIndexed() : g);
      });
      const merged = geos.length ? mergeGeometries(geos, false) : null;
      return merged ? new MeshBVH(merged, { maxDepth: 64 }) : null;
    };
    const fixed = bake(meshes, null);
    if (fixed) this.bodies.push({ bvh: fixed, obj: null, enabled: () => true, inv: new THREE.Matrix4(), rot: new THREE.Matrix3() });
    for (const mv of movers) {
      mv.obj.updateWorldMatrix(true, false);
      const bvh = bake(mv.roots, mv.obj.matrixWorld.clone().invert());
      if (bvh) this.bodies.push({ bvh, obj: mv.obj, enabled: mv.enabled ?? (() => true), inv: new THREE.Matrix4(), rot: new THREE.Matrix3() });
    }
    this.ride = null;
  }

  teleport(x: number, y: number, z: number, yaw = this.yaw) {
    this.feet.set(x, y, z); this.yaw = yaw; this.velY = 0; this.ride = null;
    this.refresh();
    this.snapToFloor(1.0);
  }

  get eyePosition() { return new THREE.Vector3(this.feet.x, this.feet.y + AVATAR.eye, this.feet.z); }

  applyTo(camera: THREE.PerspectiveCamera) {
    camera.position.copy(this.eyePosition);
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  private static yawOf(o: THREE.Object3D) { const e = o.matrixWorld.elements; return Math.atan2(e[8], e[10]); }
  /** Moving bodies: current world-to-local transforms (call after the vehicles move). */
  private refresh() {
    for (const b of this.bodies) if (b.obj) { b.inv.copy(b.obj.matrixWorld).invert(); b.rot.setFromMatrix4(b.obj.matrixWorld); }
  }

  step(dt: number) {
    this.refresh();
    // carried by the vehicle underfoot: same place in its frame, turned as it turned
    if (this.ride) {
      const o = this.ride.body.obj!, yaw = Walker.yawOf(o);
      this.feet.copy(this.ride.local).applyMatrix4(o.matrixWorld);
      this.yaw += yaw - this.ride.yaw0; this.ride.yaw0 = yaw;
    }
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
    const r = AVATAR.radius, push = new THREE.Vector3();
    for (const b of this.bodies) {
      if (!b.enabled()) continue;
      for (let it = 0; it < 3; it++) {
        this.seg.start.set(this.feet.x, this.feet.y + AVATAR.stepMax + r, this.feet.z);
        this.seg.end.set(this.feet.x, this.feet.y + AVATAR.height - r, this.feet.z);
        if (b.obj) { this.seg.start.applyMatrix4(b.inv); this.seg.end.applyMatrix4(b.inv); }
        this.box.makeEmpty(); this.box.expandByPoint(this.seg.start); this.box.expandByPoint(this.seg.end); this.box.expandByScalar(r);
        let moved = false;
        b.bvh.shapecast({
          intersectsBounds: (bx) => bx.intersectsBox(this.box),
          intersectsTriangle: (t: ExtendedTriangle) => {
            const d = t.closestPointToSegment(this.seg, this.tri.p, this.tri.c);
            if (d < r) {
              push.copy(this.tri.c).sub(this.tri.p);
              if (b.obj) push.applyMatrix3(b.rot);
              push.y = 0;
              const l = push.length();
              if (l > 1e-6) {
                push.multiplyScalar((r - d) / l); this.feet.add(push);
                if (b.obj) push.applyMatrix3(b.rot.clone().transpose());
                this.seg.start.add(push); this.seg.end.add(push); moved = true;
              }
            }
            return false;
          },
        });
        if (!moved) break;
      }
    }
  }

  /** Stand on the highest floor within step reach under the feet (centre + 4 samples). */
  private snapToFloor(snapDown: number) {
    if (!this.bodies.length) { if (this.feet.y < 0) { this.feet.y = 0; this.velY = 0; this.onGround = true; } return; }
    const top = this.feet.y + AVATAR.stepMax;
    let best = -Infinity, on: Body | null = null;
    const off = AVATAR.radius * 0.6, hp = new THREE.Vector3();
    for (const b of this.bodies) {
      if (!b.enabled()) continue;
      for (const [dx, dz] of [[0, 0], [off, 0], [-off, 0], [0, off], [0, -off]]) {
        this.ray.origin.set(this.feet.x + dx, top + 0.02, this.feet.z + dz); this.ray.direction.set(0, -1, 0);
        if (b.obj) { this.ray.origin.applyMatrix4(b.inv); this.ray.direction.applyMatrix3(b.rot.clone().transpose()); }
        const hit = b.bvh.raycastFirst(this.ray, THREE.DoubleSide);
        if (!hit) continue;
        hp.copy(hit.point); if (b.obj) hp.applyMatrix4(b.obj.matrixWorld);
        if (hp.y <= top + 0.001 && hp.y > best) { best = hp.y; on = b; }
      }
    }
    if (best > -Infinity && this.velY <= 0 && this.feet.y <= best + snapDown && this.feet.y >= best - 2) {
      this.feet.y = best; this.velY = 0; this.onGround = true; this.groundHeight = best;
    } else { this.onGround = false; on = null; }
    if (on?.obj) {
      const yaw = Walker.yawOf(on.obj);
      if (this.ride?.body === on) { this.ride.local.copy(this.feet).applyMatrix4(on.inv); this.ride.yaw0 = yaw; }
      else this.ride = { body: on, local: this.feet.clone().applyMatrix4(on.inv), yaw0: yaw };
    } else if (this.onGround) this.ride = null;
  }
}
