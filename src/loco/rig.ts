// Drives the named moving parts of the engine and tender from the motion and valve-gear solvers.
// Works identically on the live-generated scene and on the GLB-loaded one (same node names).
import * as THREE from 'three';
import { B5 } from '../specs/black5.ts';
import { motionGeometry, valveGearGeometry } from './layout.ts';
import { rodLengths, solveMotion, strokeDir, type MotionGeometry, type MotionState, type SideState, type V2 } from './motion/solver.ts';
import { solveValveGear, valveGearLengths, type ValveGearGeometry, type ValveGearState } from './motion/walschaerts.ts';
import { PLANES, REACH } from './parts/motion.ts';

const aimX = (o: THREE.Object3D, from: V2, to: V2) => { o.rotation.set(Math.atan2(-(to[1] - from[1]), to[0] - from[0]), 0, 0); };
const NAMES = ['rod_cf', 'rod_cr', 'rod_cn', 'xh', 'pr', 'vg_er', 'vg_link', 'vg_rr', 'vg_cl', 'vg_ul', 'vg_vs', 'vg_la', 'vg_ll'];

export class LocoRig {
  readonly geo: MotionGeometry = motionGeometry();
  readonly vg: ValveGearGeometry = valveGearGeometry();
  state: MotionState;
  gear: { left: ValveGearState; right: ValveGearState };
  theta = 0;
  cutoff = 0.65; // reverser: +1 full forward, 0 mid gear, -1 full backward
  private wheelsets: { node: THREE.Object3D; ratio: number }[] = [];
  private nodes = new Map<string, THREE.Object3D>();

  constructor(engine: THREE.Object3D, tender: THREE.Object3D) {
    const rD = B5.driverDia.v / 2;
    const find = (root: THREE.Object3D, name: string) => {
      const n = root.getObjectByName(name);
      if (!n) throw new Error(`rig: missing node ${name}`);
      return n;
    };
    for (const n of ['ws_lead', 'ws_drive', 'ws_trail']) this.wheelsets.push({ node: find(engine, n), ratio: 1 });
    for (const n of ['ws_bogieFront', 'ws_bogieRear']) this.wheelsets.push({ node: find(engine, n), ratio: rD / (B5.bogieWheelDia.v / 2) });
    for (const n of ['ws_t0', 'ws_t1', 'ws_t2']) this.wheelsets.push({ node: find(tender, n), ratio: rD / (B5.tenderWheelDia.v / 2) });
    for (const S of ['L', 'R']) for (const p of NAMES) this.nodes.set(`${p}_${S}`, find(engine, `${p}_${S}`));
    for (const n of ['vg_reach_L', 'vg_ra_L']) this.nodes.set(n, find(engine, n));
    this.state = solveMotion(this.geo, 0);
    this.gear = { left: solveValveGear(this.vg, this.geo.drive, this.state.left, this.cutoff), right: solveValveGear(this.vg, this.geo.drive, this.state.right, this.cutoff) };
    this.setWheelAngle(0);
  }

  setCutoff(c: number) { this.cutoff = Math.max(-1, Math.min(1, c)); this.setWheelAngle(this.theta); }

  /** theta: driving-wheel rotation (rad), positive forward. Distance travelled = theta * driver radius. */
  setWheelAngle(theta: number) {
    this.theta = theta;
    for (const w of this.wheelsets) w.node.rotation.x = theta * w.ratio;
    this.state = solveMotion(this.geo, theta);
    this.gear = {
      left: solveValveGear(this.vg, this.geo.drive, this.state.left, this.cutoff),
      right: solveValveGear(this.vg, this.geo.drive, this.state.right, this.cutoff),
    };
    this.placeSide('L', this.state.left, this.gear.left, 1);
    this.placeSide('R', this.state.right, this.gear.right, -1);
    // reach rod (driver's side): upper arm on the reversing shaft, rod running back to the cab
    const st = this.gear.left, vg = this.vg;
    const ga = Math.atan2(st.liftArmEnd[1] - vg.liftPivot[1], st.liftArmEnd[0] - vg.liftPivot[0]) + REACH.armAngle;
    const p2: V2 = [vg.liftPivot[0] + REACH.armLen * Math.cos(ga), vg.liftPivot[1] + REACH.armLen * Math.sin(ga)];
    const ra = this.nodes.get('vg_ra_L')!, rr = this.nodes.get('vg_reach_L')!, xr = PLANES.reach();
    ra.position.set(xr, vg.liftPivot[1], vg.liftPivot[0]); aimX(ra, vg.liftPivot, p2);
    rr.position.set(xr, p2[1], p2[0]); aimX(rr, p2, [p2[0] + REACH.dir[0], p2[1] + REACH.dir[1]]);
  }

  private placeSide(S: 'L' | 'R', st: SideState, g: ValveGearState, sign: number) {
    const w = strokeDir(this.geo), n = (k: string) => this.nodes.get(`${k}_${S}`)!;
    const put = (k: string, x: number, from: V2, to: V2) => { const o = n(k); o.position.set(sign * x, from[1], from[0]); aimX(o, from, to); };
    put('rod_cf', PLANES.coupling(), st.pins.lead, st.pins.drive);
    put('rod_cr', PLANES.coupling(), st.pins.drive, st.pins.trail);
    put('rod_cn', PLANES.conRod(), st.crosshead, st.pins.drive);
    put('xh', PLANES.conRod(), st.crosshead, [st.crosshead[0] + w[0], st.crosshead[1] + w[1]]);
    put('pr', PLANES.conRod(), st.crosshead, [st.crosshead[0] + w[0], st.crosshead[1] + w[1]]);
    put('vg_er', PLANES.eccentric(), g.returnPin, g.foot);
    const link = n('vg_link'); link.position.set(sign * PLANES.gear(), this.vg.trunnion[1], this.vg.trunnion[0]); link.rotation.set(-g.linkAngle, 0, 0);
    put('vg_rr', PLANES.gear(), g.die, g.leverTop);
    put('vg_cl', PLANES.gear(), g.leverTop, g.leverBottom);
    put('vg_ul', PLANES.union(), g.armPin, g.leverBottom);
    put('vg_vs', PLANES.gear(), g.valvePin, [g.valvePin[0] + w[0], g.valvePin[1] + w[1]]);
    put('vg_la', PLANES.gear(), this.vg.liftPivot, g.liftArmEnd);
    put('vg_ll', PLANES.gear(), g.liftArmEnd, g.liftSlotPin);
  }

  /** Solver-side pin-to-pin lengths (must stay constant through a revolution). */
  measure() {
    const out: Record<string, number> = {};
    for (const S of ['L', 'R'] as const) {
      const st = S === 'L' ? this.state.left : this.state.right, g = S === 'L' ? this.gear.left : this.gear.right;
      const l = rodLengths(st);
      out[`couplingFront_${S}`] = l.couplingFront; out[`couplingRear_${S}`] = l.couplingRear; out[`conRod_${S}`] = l.conRod;
      const vl = valveGearLengths(this.vg, this.geo.drive, st, g) as Record<string, number>;
      for (const k of ['returnCrank', 'eccentricRod', 'linkFoot', 'radiusRod', 'leverTop', 'leverBottom', 'unionLink', 'crossheadArm', 'liftArm', 'liftLink']) out[`${k}_${S}`] = vl[k];
    }
    return out;
  }

  /**
   * Scene-side check, independent of the solvers: where each node actually puts its pins, compared
   * with where the part it joins puts the same pin (side-plane distance, lateral offsets ignored).
   */
  connectionGaps() {
    const cr = B5.crankRadius.v, phiR = this.geo.rightLeads ? -Math.PI / 2 : Math.PI / 2;
    const yz = (p: THREE.Vector3) => new THREE.Vector2(p.z, p.y);
    const at = (name: string, local: THREE.Vector3) => { const o = this.nodes.get(name) ?? this.wheelsets.find((w) => w.node.name === name)!.node; o.updateWorldMatrix(true, false); return yz(local.clone().applyMatrix4(o.matrixWorld)); };
    const L = (len: number) => new THREE.Vector3(0, 0, len);
    const gaps: Record<string, number> = {};
    const vg = this.vg, lever = vg.leverTopToValve + vg.leverValveToBottom;
    for (const [S, sign] of [['L', 1], ['R', -1]] as const) {
      const phi = S === 'L' ? 0 : phiR, x = sign;
      const pin = (ws: string) => at(ws, new THREE.Vector3(x, Math.sin(phi) * cr, Math.cos(phi) * cr));
      const lead = pin('ws_lead'), drive = pin('ws_drive'), trail = pin('ws_trail');
      const rpin = at('ws_drive', new THREE.Vector3(x, Math.sin(phi + vg.returnCrankAngle) * vg.returnCrankThrow, Math.cos(phi + vg.returnCrankAngle) * vg.returnCrankThrow));
      const n = (k: string) => `${k}_${S}`;
      const d = (a: THREE.Vector2, b: THREE.Vector2) => a.distanceTo(b);
      gaps[n('cf')] = Math.max(d(at(n('rod_cf'), L(0)), lead), d(at(n('rod_cf'), L(lead.distanceTo(drive))), drive));
      gaps[n('cr')] = Math.max(d(at(n('rod_cr'), L(0)), drive), d(at(n('rod_cr'), L(drive.distanceTo(trail))), trail));
      gaps[n('cn')] = Math.max(d(at(n('rod_cn'), L(0)), at(n('xh'), L(0))), d(at(n('rod_cn'), L(B5.conRodLength.v)), drive));
      gaps[n('er')] = Math.max(d(at(n('vg_er'), L(0)), rpin), d(at(n('vg_er'), L(vg.eccentricRod)), at(n('vg_link'), new THREE.Vector3(0, -vg.footOffset, 0))));
      this.nodes.get(n('vg_rr'))!.updateWorldMatrix(true, false); this.nodes.get(n('vg_link'))!.updateWorldMatrix(true, false);
      const dieLocal = new THREE.Vector3(0, 0, 0).applyMatrix4(this.nodes.get(n('vg_rr'))!.matrixWorld).applyMatrix4(new THREE.Matrix4().copy(this.nodes.get(n('vg_link'))!.matrixWorld).invert());
      gaps[n('die_on_link')] = Math.abs(dieLocal.z); // the die must sit on the link's axis
      gaps[n('rr_cl')] = d(at(n('vg_rr'), L(vg.radiusRod)), at(n('vg_cl'), L(0)));
      gaps[n('cl_ul')] = d(at(n('vg_cl'), L(lever)), at(n('vg_ul'), L(vg.unionLink)));
      gaps[n('ul_xh')] = d(at(n('vg_ul'), L(0)), at(n('xh'), new THREE.Vector3(0, -vg.crossheadArm, 0)));
      gaps[n('vs_cl')] = d(at(n('vg_vs'), L(0)), at(n('vg_cl'), L(vg.leverTopToValve)));
      gaps[n('la_ll')] = d(at(n('vg_la'), L(vg.liftArm)), at(n('vg_ll'), L(0)));
      const slot = at(n('vg_ll'), L(vg.liftLink)), r0 = at(n('vg_rr'), L(0)), r1 = at(n('vg_rr'), L(vg.radiusRod));
      const dir = r1.clone().sub(r0).normalize(), rel = slot.clone().sub(r0);
      gaps[n('ll_on_rr')] = Math.abs(rel.x * dir.y - rel.y * dir.x); // lifting-link pin on the radius-rod line
    }
    return gaps;
  }
}
export type { V2 };
