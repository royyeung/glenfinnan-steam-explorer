// Drives the named moving parts of the engine and tender from the motion solver.
// Works identically on the live-generated scene and on the GLB-loaded one (same node names).
import * as THREE from 'three';
import { B5 } from '../specs/black5.ts';
import { motionGeometry } from './layout.ts';
import { rodLengths, solveMotion, strokeDir, type MotionGeometry, type MotionState, type SideState, type V2 } from './motion/solver.ts';

const aimX = (o: THREE.Object3D, from: V2, to: V2) => { o.rotation.set(Math.atan2(-(to[1] - from[1]), to[0] - from[0]), 0, 0); };

export class LocoRig {
  readonly geo: MotionGeometry = motionGeometry();
  state: MotionState;
  theta = 0;
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
    for (const S of ['L', 'R']) for (const p of ['rod_cf', 'rod_cr', 'rod_cn', 'xh', 'pr']) this.nodes.set(`${p}_${S}`, find(engine, `${p}_${S}`));
    this.state = solveMotion(this.geo, 0);
    this.setWheelAngle(0);
  }

  /** theta: driving-wheel rotation (rad), positive forward. Distance travelled = theta * driver radius. */
  setWheelAngle(theta: number) {
    this.theta = theta;
    for (const w of this.wheelsets) w.node.rotation.x = theta * w.ratio;
    this.state = solveMotion(this.geo, theta);
    this.placeSide('L', this.state.left, 1);
    this.placeSide('R', this.state.right, -1);
  }

  private placeSide(S: 'L' | 'R', st: SideState, sign: number) {
    const xc = sign * B5.couplingRodLateral.v, xn = sign * B5.conRodLateral.v, w = strokeDir(this.geo);
    const n = (k: string) => this.nodes.get(`${k}_${S}`)!;
    n('rod_cf').position.set(xc, st.pins.lead[1], st.pins.lead[0]); aimX(n('rod_cf'), st.pins.lead, st.pins.drive);
    n('rod_cr').position.set(xc, st.pins.drive[1], st.pins.drive[0]); aimX(n('rod_cr'), st.pins.drive, st.pins.trail);
    n('rod_cn').position.set(xn, st.crosshead[1], st.crosshead[0]); aimX(n('rod_cn'), st.crosshead, st.pins.drive);
    n('xh').position.set(xn, st.crosshead[1], st.crosshead[0]); aimX(n('xh'), [0, 0], w);
    n('pr').position.set(xn, st.crosshead[1], st.crosshead[0]); aimX(n('pr'), [0, 0], w);
  }

  /** Solver-side pin-to-pin lengths (must stay constant through a revolution). */
  measure() {
    const out: Record<string, number> = {};
    for (const S of ['L', 'R'] as const) {
      const st = S === 'L' ? this.state.left : this.state.right, l = rodLengths(st);
      out[`couplingFront_${S}`] = l.couplingFront; out[`couplingRear_${S}`] = l.couplingRear; out[`conRod_${S}`] = l.conRod;
    }
    return out;
  }

  /**
   * Scene-side check, independent of the solver: where the rotated WHEEL nodes put each crankpin
   * versus where the ROD nodes put their ends. Returns the worst gap in metres.
   */
  connectionGaps() {
    const cr = B5.crankRadius.v, phiR = this.geo.rightLeads ? -Math.PI / 2 : Math.PI / 2;
    const pinWorld = (ws: string, S: 'L' | 'R', x: number) => {
      const node = this.wheelsets.find((w) => w.node.name === ws)!.node, phi = S === 'L' ? 0 : phiR;
      node.updateWorldMatrix(true, false);
      return new THREE.Vector3(x, Math.sin(phi) * cr, Math.cos(phi) * cr).applyMatrix4(node.matrixWorld);
    };
    const rodEnds = (name: string, length: number) => {
      const n = this.nodes.get(name)!; n.updateWorldMatrix(true, false);
      return [new THREE.Vector3(0, 0, 0).applyMatrix4(n.matrixWorld), new THREE.Vector3(0, 0, length).applyMatrix4(n.matrixWorld)];
    };
    const gaps: Record<string, number> = {};
    for (const [S, sign] of [['L', 1], ['R', -1]] as const) {
      const xc = sign * B5.couplingRodLateral.v, xn = sign * B5.conRodLateral.v;
      const lead = pinWorld('ws_lead', S, xc), drive = pinWorld('ws_drive', S, xc), trail = pinWorld('ws_trail', S, xc), driveN = pinWorld('ws_drive', S, xn);
      const [cf0, cf1] = rodEnds(`rod_cf_${S}`, lead.distanceTo(drive));
      const [cr0, cr1] = rodEnds(`rod_cr_${S}`, drive.distanceTo(trail));
      const [cn0, cn1] = rodEnds(`rod_cn_${S}`, B5.conRodLength.v);
      const xh = this.nodes.get(`xh_${S}`)!.getWorldPosition(new THREE.Vector3());
      gaps[`cf_${S}`] = Math.max(cf0.distanceTo(lead), cf1.distanceTo(drive));
      gaps[`cr_${S}`] = Math.max(cr0.distanceTo(drive), cr1.distanceTo(trail));
      gaps[`cn_${S}`] = Math.max(cn0.distanceTo(xh), cn1.distanceTo(driveN));
    }
    return gaps;
  }
}
