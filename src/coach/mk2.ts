// The coaches of the 2026 set, all from one parametric builder (coach frame: origin at rail top,
// mid-length; +Z = A end, +X = left side):
//   tso2     Mk2/2A Tourist Standard Open, maroon WCR (S39, S40)
//   tso2b    Mk2B TSO: no centre door, wide doors at the very ends, one toilet at each end (5455, E5482)
//   fo2      Mk2 open coach used as first class: 2+1 seats, tablecloths, lamps, curtains (S4, 5236)
//   buffet1  Mk1 TSO with a buffet/shop at one end (99318): Mk1 windows, roof vents, trussed underframe
// Node names used by the app:
//   coach_door_<A|C|B>_<L|R>  hinged slam doors (pivot at the hinge)
//   gw_door_<A|B>             gangway end doors (shown only at the ends of the train)
//   cws_<0..3>                wheelsets (for rotation in Phase 6)
//   coach_interior            interior group (drawn only when near)
import * as THREE from 'three';
import { MK1, MK2, MK2B, type CoachType } from '../specs/mk2.ts';
import { Batch, DETAIL, boxMinMax, cylBetween, cylX, cylZ, extrudeSection, extrudeSide, latheY, roundBox, roundedRect } from '../loco/geom.ts';
import { arc } from '../loco/parts/wheels.ts';
import type { MatKey } from '../loco/materials.ts';

const v = (k: keyof typeof MK2) => MK2[k].v;
type Mats = Record<MatKey, THREE.Material>;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export interface CoachLayout {
  type: CoachType; mk1: boolean; first: boolean;
  L: number; z: (a: number) => number; halfW: number;
  bays: number[]; bayPitch: number; winW: number; ventDepth: number;
  doors: Record<string, number>; doorWidth: number;
  /** a of the saloon-end screens */
  partitions: number[];
  saloons: [number, number][];
  /** side 0: two cubicles flanking the gangway passage; ±1: one cubicle on that side */
  toilets: { a0: number; a1: number; side: 0 | 1 | -1; window: boolean }[];
  /** counter and shop (a range), buffet coach only */
  buffet: [number, number] | null;
  /** where the running number and the "West Coast" lettering go */
  numA: number; wcA: number;
}

/** Layout along the coach (a = metres from the A-end body face). */
export function coachLayout(type: CoachType = 'tso2'): CoachLayout {
  const L = v('bodyLength'), z = (a: number) => L / 2 - a, halfW = v('bodyWidth') / 2;
  if (type === 'tso2b') {
    const ep = MK2B.endPanel.v, dw = MK2B.doorWidth.v, tl = MK2B.toiletLength.v, n = MK2B.bays.v;
    const vest = ep + dw + 0.1, s0 = vest + tl, s1 = L - s0, bp = (s1 - s0) / n;
    return {
      type, mk1: false, first: false, L, z, halfW,
      bays: [...Array(n).keys()].map((k) => s0 + (k + 0.5) * bp), bayPitch: bp, winW: MK2B.windowWidth.v, ventDepth: v('ventDepth'),
      doors: { A: ep + dw / 2, B: L - ep - dw / 2 }, doorWidth: dw,
      partitions: [s0, L / 2, s1], saloons: [[s0, L / 2], [L / 2, s1]],
      toilets: [{ a0: vest, a1: s0, side: -1, window: false }, { a0: s1, a1: L - vest, side: 1, window: false }],
      buffet: null, numA: vest + tl / 2, wcA: L - vest - tl / 2,
    };
  }
  const t = v('toiletLength'), vb = v('vestibuleLength'), bp = v('bayPitch'), n = v('baysPerSaloon');
  const vestA = t, sal1 = vestA + vb, vestC = sal1 + n * bp, sal2 = vestC + vb, vestB = sal2 + n * bp;
  const mk1 = type === 'buffet1';
  return {
    type, mk1, first: type === 'fo2', L, z, halfW,
    bays: [...Array(n).keys()].flatMap((k) => [sal1 + (k + 0.5) * bp, sal2 + (k + 0.5) * bp]).sort((p, q) => p - q), bayPitch: bp,
    winW: mk1 ? MK1.windowWidth.v : v('windowWidth'), ventDepth: mk1 ? MK1.ventDepth.v : v('ventDepth'),
    doors: { A: vestA + vb / 2, C: vestC + vb / 2, B: vestB + (L - vestB) / 2 }, doorWidth: v('doorWidth'),
    partitions: [sal1, vestC, sal2, vestB], saloons: [[sal1, vestC], [sal2, vestB]],
    toilets: [{ a0: 0, a1: vestA, side: 0, window: true }],
    buffet: mk1 ? [vestB - MK1.buffetBays.v * bp, vestB] : null, numA: 0.6, wcA: L - 1.3,
  };
}

/** Roof arc from the cantrail to the ridge (x, y). */
function roofArc(dr: number, half: number, n = 22): [number, number][] {
  const { R, yc } = roofCircle(), a = Math.asin(Math.min(1, half / R));
  return arc(R + dr, Math.PI / 2 + a, Math.PI / 2 - a, n).map(([x, y]) => [x, y + yc] as [number, number]);
}
function roofCircle() {
  const cw = v('bodyWidth') / 2 - 0.04, top = v('height'), sag = top - v('cantrailH'), R = (cw * cw + sag * sag) / (2 * sag);
  return { R, yc: top - R };
}
const roofY = (x: number) => { const { R, yc } = roofCircle(); return yc + Math.sqrt(R * R - x * x); };

/** Outer cross-section (x, y) of the body, for the end walls. */
function bodySection(): [number, number][] {
  const w = v('bodyWidth') / 2, bot = v('bodyBottomH'), cant = v('cantrailH');
  // counter-clockwise: bottom, right side up, roof right-to-left, left side down
  return [[-w + 0.06, bot], [w - 0.06, bot], [w, bot + 0.6], [w, cant - 0.1], ...roofArc(0, w - 0.04).reverse(), [-w, cant - 0.1], [-w, bot + 0.6]];
}

/** Far levels of detail use few materials (each material is a draw call per coach). */
function lodMats(mats: Mats, detail: number): Mats {
  if (detail >= 1) return mats;
  const far = detail < 0.4;
  const map: Partial<Record<MatKey, MatKey>> = {
    steel: 'underframe', rubber: 'underframe', spring_red: 'underframe', axle_yellow: 'underframe', wheel: 'underframe',
    frosted: 'glass', cdl_light: 'coach_maroon', wood_panel: 'coach_maroon', decal_coachletter: 'glass',
    ...(far ? { lining_gold: 'coach_maroon', decal_coachnum: 'coach_maroon', decal_westcoast: 'coach_maroon', glass: 'underframe' } as const : {}),
  };
  return new Proxy(mats, { get: (t, k: string) => t[(map[k as MatKey] ?? k) as MatKey] }) as Mats;
}

export function buildCoach(matsIn: Mats, type: CoachType = 'tso2'): THREE.Group {
  const detail = DETAIL, mats = lodMats(matsIn, detail);
  const C = new THREE.Group(); C.name = `coach_${type}`;
  const b = new Batch(), lay = coachLayout(type), { L, z, halfW: w, mk1, winW } = lay;
  const bot = v('bodyBottomH'), cant = v('cantrailH'), floor = v('floorH');
  const wTop = v('windowTopH'), wBot = v('windowBottomH'), dw = lay.doorWidth, dTop = v('doorTopH');
  const winR = mk1 ? 0.06 : 0.08, rim = mk1 ? 'steel' : 'rubber';   // Mk1: aluminium frames; Mk2: black rubber

  // ---- body sides with window, door and toilet-window openings
  const winRect = (a: number) => roundedRect(z(a + winW / 2), wBot, z(a - winW / 2), wTop, winR);
  const winHoles = lay.bays.map(winRect);
  const doorHoles = Object.values(lay.doors).map((a) => [[z(a + dw / 2), bot + 0.03], [z(a - dw / 2), bot + 0.03], [z(a - dw / 2), dTop], [z(a + dw / 2), dTop]] as [number, number][]);
  const toiletHoles = lay.toilets.filter((t) => t.window).map(() => roundedRect(z(0.85), 2.2, z(0.3), 2.8, 0.05));
  const side: [number, number][] = [[z(L), bot], [z(0), bot], [z(0), cant], [z(L), cant]];
  for (const s of [1, -1]) {
    b.add('coach_maroon', extrudeSide(side, s * w, s * (w - 0.035), [...winHoles, ...doorHoles, ...toiletHoles]));
    for (const a of lay.bays) {
      const z0 = z(a + winW / 2), z1 = z(a - winW / 2), vt = wTop - lay.ventDepth;
      b.add('glass', extrudeSide(winRect(a), s * (w - 0.012), s * (w - 0.016)));
      b.add(rim, boxMinMax(s * (w - 0.006), vt - 0.02, z1, s * (w + 0.004), vt + 0.02, z0));                  // vent rail
      if (mk1) b.add('steel', boxMinMax(s * (w - 0.004), vt, z(a) - 0.015, s * (w + 0.006), wTop, z(a) + 0.015)); // Mk1: two sliding panes meet in the middle
      else for (const zz of [z0 + 0.38, z1 - 0.38]) b.add('rubber', boxMinMax(s * (w - 0.006), vt, zz - 0.015, s * (w + 0.004), wTop, zz + 0.015)); // Mk2: hinged top vent
      b.add(rim, extrudeSide(roundedRect(z0 - 0.025, wBot - 0.025, z1 + 0.025, wTop + 0.025, winR + 0.02), s * (w + 0.002), s * (w - 0.004), [winRect(a)]));
    }
    for (const h of toiletHoles) b.add('frosted', extrudeSide(h, s * (w - 0.012), s * (w - 0.016)));
    // gold-black-gold lining at the waist and cantrail
    // the waist lining breaks at the doors (each door carries its own piece); the cantrail line runs above them
    const cuts = Object.values(lay.doors).map((a) => [a - dw / 2 - 0.01, a + dw / 2 + 0.01]).sort((p, q) => p[0] - q[0]);
    const runs: [number, number][] = []; let from = 0;
    for (const [c0, c1] of cuts) { if (c0 > from) runs.push([from, c0]); from = c1; }
    if (from < L) runs.push([from, L]);
    for (const dy of [-0.018, 0.018]) {
      for (const [a0, a1] of runs) b.add('lining_gold', boxMinMax(s * w, v('waistH') + dy - 0.006, z(a1), s * (w + 0.003), v('waistH') + dy + 0.006, z(a0)));
      b.add('lining_gold', boxMinMax(s * w, cant - 0.06 + dy - 0.006, z(L), s * (w + 0.003), cant - 0.06 + dy + 0.006, z(0)));
    }
    // CDL indicator above each door, grab handles beside the doors; Mk1: rain strip over each door
    for (const a of Object.values(lay.doors)) {
      b.add('cdl_light', boxMinMax(s * w, dTop + 0.03, z(a) - 0.04, s * (w + 0.02), dTop + 0.08, z(a) + 0.04));
      for (const dz of [dw / 2 + 0.06, -(dw / 2 + 0.06)]) b.add('steel', cylBetween(V(s * (w + 0.03), 1.6, z(a) + dz), V(s * (w + 0.03), 2.4, z(a) + dz), 0.012, 6));
      if (mk1) b.add('coach_maroon', boxMinMax(s * w, dTop + 0.1, z(a + dw / 2 + 0.08), s * (w + 0.03), dTop + 0.13, z(a - dw / 2 - 0.08)));
    }
    // running number and "West Coast" lettering
    const num = new THREE.PlaneGeometry(0.62, 0.2); num.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2); num.translate(s * (w + 0.005), 1.5, z(lay.numA));
    b.add('decal_coachnum', num);
    const wc = new THREE.PlaneGeometry(0.5, 0.2); wc.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2); wc.translate(s * (w + 0.005), v('waistH') - 0.2, z(lay.wcA));
    b.add('decal_westcoast', wc);
    // coach letter card in the corner of the end windows (as on WCR coaches, e.g. 5236)
    for (const a of [lay.bays[0] - winW / 2 + 0.16, lay.bays[lay.bays.length - 1] + winW / 2 - 0.16]) {
      const lt = new THREE.PlaneGeometry(0.17, 0.17); lt.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2); lt.translate(s * (w - 0.022), wTop - lay.ventDepth - 0.16, z(a));
      b.add('decal_coachletter', lt);
    }
  }
  // roof: Mk2 pressure-ventilation domes along the middle; Mk1 shell vents in two rows; rain strips
  b.add('roof_black', extrudeSection([...roofArc(0, w - 0.04), ...roofArc(-0.03, w - 0.04).reverse()], z(L), z(0)));
  if (mk1) {
    for (let i = 0; i < 8; i++) for (const x of [-0.62, 0.62]) {
      const a = 1.8 + i * ((L - 3.6) / 7), y = roofY(x);
      b.add('roof_black', roundBox(x - 0.07, y - 0.03, x + 0.07, y + 0.08, z(a) - 0.2, z(a) + 0.2, 0.05));
    }
  } else {
    for (let i = 0; i < 9; i++) {
      const a = 1.6 + i * ((L - 3.2) / 8), x = (i % 2 ? 0.42 : -0.42);
      b.add('roof_black', latheY([[0, 0], [0.13, 0], [0.12, 0.05], [0.08, 0.1], [0, 0.12]], x, v('height') - 0.06, z(a), 12));
    }
  }
  for (const s of [1, -1]) b.add('roof_black', boxMinMax(s * (w - 0.06), cant + 0.02, z(L), s * (w - 0.02), cant + 0.05, z(0)));

  // ---- ends: end wall with gangway opening, Pullman gangway frame, bridge plate, buffers, buckeye
  const gwHole: [number, number][] = [[-0.36, floor], [0.36, floor], [0.36, floor + 1.95], [-0.36, floor + 1.95]];
  const over = (v('lengthOverBuffers') - L) / 2;
  for (const [zz, dir] of [[z(0), 1], [z(L), -1]] as const) {
    b.add('coach_maroon', extrudeSection(bodySection(), zz - (dir > 0 ? 0.04 : 0), zz + (dir > 0 ? 0 : 0.04), [gwHole]));
    const frame: [number, number][] = [[-0.55, floor - 0.12], [0.55, floor - 0.12], [0.55, floor + 2.1], [-0.55, floor + 2.1]];
    b.add('rubber', extrudeSection(frame, zz, zz + dir * (over - 0.02), [gwHole]));
    b.add('steel', boxMinMax(-0.36, floor - 0.02, Math.min(zz, zz + dir * over), 0.36, floor, Math.max(zz, zz + dir * over)));
    for (const s of [1, -1]) {
      const x = s * v('bufferCentres') / 2, face = zz + dir * over;
      b.add('underframe', cylZ(0.13, 0.13, zz, face - dir * 0.16, x, v('bufferH'), 16));
      b.add('steel', cylZ(0.17, 0.17, face - dir * 0.04, face, x, v('bufferH'), 20));
    }
    b.add('underframe', boxMinMax(-0.12, v('bufferH') - 0.12, Math.min(zz, zz + dir * (over - 0.05)), 0.12, v('bufferH') + 0.1, Math.max(zz, zz + dir * (over - 0.05)))); // buckeye coupler (lowered)
  }

  // ---- underframe: solebars, equipment boxes (Mk1: deeper solebar and queen-post trussing), B4 bogies
  const bc = v('bogieCentres') / 2, wb = v('bogieWheelbase') / 2, r = v('wheelDia') / 2;
  const sole = mk1 ? MK1.solebarDepth.v : 0.18;
  for (const s of [1, -1]) b.add('underframe', boxMinMax(s * (w - 0.12), bot - sole, z(L), s * (w - 0.04), bot, z(0)));
  for (const [a0, a1, h, xa, xb] of [[5.3, 6.9, 0.45, -1.15, -0.35], [8.0, 9.6, 0.5, 0.3, 1.15], [10.4, 11.4, 0.4, -1.1, -0.3], [12.6, 14.2, 0.45, 0.35, 1.1]] as const) {
    b.add('underframe', boxMinMax(xa, bot - 0.18 - h, z(a1), xb, bot - 0.18, z(a0)));
  }
  if (mk1) for (const s of [1, -1]) {
    const x = s * (w - 0.2), yb = bot - 0.85, zA = bc - 1.6, zB = 2.6;
    for (const k of [1, -1]) b.add('underframe', cylBetween(V(x, bot - sole, k * zA), V(x, yb, k * zB), 0.035, 6), cylBetween(V(x, yb, k * zB), V(x, bot - sole, k * zB), 0.03, 6));
    b.add('underframe', cylBetween(V(x, yb, zB), V(x, yb, -zB), 0.035, 6));
  }
  for (const zc of [bc, -bc]) {
    for (const s of [1, -1]) {
      b.add('underframe', boxMinMax(s * 0.92, r - 0.05, zc - wb - 0.45, s * 1.02, r + 0.22, zc + wb + 0.45));       // side frame
      for (const za of [zc - wb, zc + wb]) {
        b.add('underframe', boxMinMax(s * 0.9, r - 0.14, za - 0.16, s * 1.08, r + 0.14, za + 0.16));            // axlebox
        b.add('axle_yellow', cylX(0.1, 0.03, s * 1.1, r, za, 16));                                               // end cover
        if (detail >= 0.5) for (const dz of [-0.24, 0.24]) b.add('spring_red', coil(s * 0.98, r + 0.22, za + dz, 0.09, 0.24));
      }
      b.add('underframe', boxMinMax(s * 0.25, r + 0.15, zc - 0.25, s * 0.92, r + 0.38, zc + 0.25));               // bolster
      if (detail >= 0.5) b.add('spring_red', coil(s * 1.05, r + 0.38, zc, 0.12, 0.3));                          // secondary spring
    }
    b.add('underframe', boxMinMax(-0.6, r + 0.25, zc - 0.3, 0.6, bot - 0.18, zc + 0.3));                          // centre pivot
  }
  // wheelsets: separate nodes on the close-up model (they turn in Phase 6); merged into the body far away
  const near = detail >= 1;
  [bc + wb, bc - wb, -bc + wb, -bc - wb].forEach((za, i) => {
    const wbat = near ? new Batch() : b, oy = near ? 0 : r, oz = near ? 0 : za;
    for (const s of [1, -1] as const) { wbat.add('wheel', cylX(r, 0.14, s * 0.7175, oy, oz, 28), cylX(r + 0.03, 0.025, s * 0.66, oy, oz, 28)); } // disc wheels with flanges
    wbat.add('wheel', cylX(0.07, 1.6, 0, oy, oz, 12));
    if (!near) return;
    const g = new THREE.Group(); g.name = `cws_${i}`;
    for (const m of wbat.build(g.name, mats)) g.add(m);
    g.position.set(0, r, za); C.add(g);
  });

  // doors (hinged slam doors with drop-light windows): swinging nodes close up, fixed and closed far away
  const dropBot = mk1 ? MK1.dropBottomH.v : 2.2, inset = dw > 0.7 ? 0.14 : mk1 ? 0.1 : 0.12;
  for (const [k, a] of Object.entries(lay.doors)) for (const [S, s] of [['L', 1], ['R', -1]] as const) {
    const db = near ? new Batch() : b, h0 = bot + 0.04, h1 = dTop - 0.01;
    const ox = near ? 0 : s * w, oz = near ? 0 : z(a - dw / 2);
    const drop = roundedRect(-dw + inset + oz, dropBot, -inset + oz, 2.86, 0.05);
    db.add('coach_maroon', extrudeSide([[-dw + 0.005 + oz, h0], [-0.005 + oz, h0], [-0.005 + oz, h1], [-dw + 0.005 + oz, h1]], ox, ox - s * 0.035, [drop]));
    db.add('glass', extrudeSide(drop, ox - s * 0.012, ox - s * 0.016));
    if (near) {
      db.add('lining_gold', boxMinMax(Math.min(0, s * 0.04), 1.95, -dw + 0.05, Math.max(0, s * 0.04), 2.0, -dw + 0.15)); // handle (brass)
      for (const y of [v('waistH') - 0.018, v('waistH') + 0.018]) db.add('lining_gold', boxMinMax(0, y - 0.006, -dw + 0.005, s * 0.003, y + 0.006, -0.005));
      const g = new THREE.Group(); g.name = `coach_door_${k}_${S}`;
      for (const m of db.build(g.name, mats)) g.add(m);
      g.position.set(s * w, 0, z(a - dw / 2)); // hinge on the A-side edge
      C.add(g);
    }
  }
  for (const m of b.build('coach_static', mats)) C.add(m);

  // gangway end doors (closed); the app shows them only at the ends of the train
  for (const [e, zz, dir] of [['A', z(0), 1], ['B', z(L), -1]] as const) {
    const gb = new Batch();
    gb.add('wood_panel', boxMinMax(-0.36, floor, zz - dir * 0.03, 0.36, floor + 1.95, zz - dir * 0.01));
    const g = new THREE.Group(); g.name = `gw_door_${e}`;
    for (const m of gb.build(g.name, mats)) g.add(m);
    C.add(g);
  }

  if (detail >= 1) C.add(buildInterior(mats, lay));
  return C;
}

/** Helical spring (coil) standing on (x, y, z). */
function coil(x: number, y: number, z: number, r: number, h: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2 * 4; pts.push(V(x + Math.cos(a) * r, y - h + (i / 48) * h, z + Math.sin(a) * r)); }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.018, 5, false);
  return g;
}

// ------------------------------------------------------------------------------------ interior

function buildInterior(mats: Mats, lay: CoachLayout): THREE.Group {
  const G = new THREE.Group(); G.name = 'coach_interior';
  const b = new Batch(), { L, z, halfW, winW } = lay;
  const floor = v('floorH'), w = halfW - v('wallThickness'), cant = v('cantrailH');
  const wTop = v('windowTopH'), wBot = v('windowBottomH'), dw = lay.doorWidth;
  const inBuffet = (a: number) => !!lay.buffet && a > lay.buffet[0] && a < lay.buffet[1];

  // floor, ceiling, side lining with window reveals
  b.add('carpet', boxMinMax(-w, floor - 0.03, z(L), w, floor, z(0)));
  b.add('ceiling', extrudeSection([...roofArc(-0.08, w), ...roofArc(-0.095, w).reverse()], z(L) + 0.04, z(0) - 0.04));
  b.add('ceiling', boxMinMax(-0.18, v('height') - 0.17, z(L) + 0.05, 0.18, v('height') - 0.13, z(0) - 0.05)); // ventilation duct
  const winHoles = lay.bays.map((a) => roundedRect(z(a + winW / 2), wBot, z(a - winW / 2), wTop, 0.08));
  const doorHoles = Object.values(lay.doors).map((a) => [[z(a + dw / 2), floor], [z(a - dw / 2), floor], [z(a - dw / 2), v('doorTopH')], [z(a + dw / 2), v('doorTopH')]] as [number, number][]);
  for (const s of [1, -1]) {
    b.add('wood_panel', extrudeSide([[z(L) + 0.04, floor], [z(0) - 0.04, floor], [z(0) - 0.04, cant], [z(L) + 0.04, cant]], s * (w + 0.02), s * w, [...winHoles, ...doorHoles]));
    // heater grille (saloons only, and not in the buffet) and window sills and frames
    for (const [a0, a1] of lay.saloons) {
      const e = lay.buffet && a1 > lay.buffet[0] ? Math.min(a1, lay.buffet[0]) : a1;
      b.add('steel', boxMinMax(s * (w - 0.08), floor + 0.05, z(e) + 0.05, s * w, floor + 0.25, z(a0) - 0.05));
    }
    for (const a of lay.bays) {
      const z0 = z(a + winW / 2), z1 = z(a - winW / 2);
      b.add('table_top', boxMinMax(s * (w - 0.1), wBot - 0.03, z0, s * w, wBot, z1));
      b.add('steel', extrudeSide(roundedRect(z0 - 0.03, wBot - 0.03, z1 + 0.03, wTop + 0.03, 0.1), s * (w - 0.002), s * (w - 0.02), [roundedRect(z0, wBot, z1, wTop, 0.08)])); // aluminium frames
      b.add('steel', boxMinMax(s * (w - 0.02), wTop - lay.ventDepth - 0.015, z1, s * w, wTop - lay.ventDepth + 0.015, z0));
    }
  }

  // seats: standard = two facing double seats each side of the aisle with a table between;
  // first = doubles (table for 4) on the left, singles (table for 2) on the right (S4)
  const sw = v('seatWidth'), aisle = v('aisleWidth') / 2, bp = lay.bayPitch, off = bp / 2 - 0.36 * (bp / 1.98);
  const seat = (x0: number, x1: number, zc: number, facing: 1 | -1) => {
    const back = zc - facing * 0.32;
    b.add('seat_vinyl', roundBox(x0, floor + 0.12, x1, floor + 0.36, zc - 0.26, zc + 0.26, 0.03));                 // base
    b.add('decal_seatfabric', roundBox(x0 + 0.02, floor + 0.36, x1 - 0.02, floor + 0.46, zc - 0.25, zc + 0.24, 0.04)); // cushion
    const bz0 = Math.min(back, back - facing * 0.12), bz1 = Math.max(back, back - facing * 0.12);
    b.add('decal_seatfabric', roundBox(x0 + 0.02, floor + 0.44, x1 - 0.02, floor + 0.98, bz0, bz1, 0.04));          // back
    b.add('seat_vinyl', roundBox(x0, floor + 0.95, x1, floor + 1.22, bz0 - 0.02, bz1 + 0.02, 0.07));                  // headrest roll
    for (const xa of [x0, x1]) b.add('seat_vinyl', roundBox(xa - 0.03, floor + 0.42, xa + 0.03, floor + 0.62, zc - 0.22, zc + 0.18, 0.02)); // armrests
    for (const xa of [x0 - 0.012, x1 + 0.012]) b.add('ceiling', roundBox(xa - 0.012, floor + 0.36, xa + 0.012, floor + 1.18, bz0 - 0.03, bz1 + 0.04, 0.01)); // pale plastic seat shells (S40)
    b.add('steel', boxMinMax(x0 + 0.05, floor, zc - 0.2, x1 - 0.05, floor + 0.12, zc + 0.15));                         // frame
    // first class: white antimacassar over the front of the headrest
    if (lay.first) { const f = facing > 0 ? bz1 + 0.03 : bz0 - 0.03; b.add('tablecloth', roundBox(x0 + 0.06, floor + 1.0, x1 - 0.06, floor + 1.2, f - 0.006, f + 0.006, 0.005)); }
  };
  const table = (x0: number, x1: number, zc: number, s: number) => {
    b.add('table_top', roundBox(x0 + 0.04, floor + 0.7, x1 - 0.04, floor + 0.74, zc - 0.32, zc + 0.32, 0.03));
    b.add('steel', cylBetween(V((x0 + x1) / 2 + s * 0.2, floor, zc), V((x0 + x1) / 2 + s * 0.2, floor + 0.7, zc), 0.025, 8));
    if (!lay.first) return;
    // first class: white cloth with a drop on the aisle side, and a table lamp by the window
    b.add('tablecloth', roundBox(x0 + 0.02, floor + 0.74, x1 - 0.02, floor + 0.746, zc - 0.34, zc + 0.34, 0.002));
    const xa = s > 0 ? x0 + 0.02 : x1 - 0.02;
    b.add('tablecloth', boxMinMax(xa - 0.004, floor + 0.6, zc - 0.34, xa + 0.004, floor + 0.746, zc + 0.34));
    const xl = s > 0 ? x1 - 0.14 : x0 + 0.14;
    b.add('brass', latheY([[0, 0], [0.06, 0], [0.05, 0.02], [0.012, 0.03], [0.012, 0.2], [0, 0.2]], xl, floor + 0.746, zc, 12));
    b.add('lamp_shade', latheY([[0.085, 0], [0.05, 0.12], [0.035, 0.12]], xl, floor + 0.9, zc, 14));
  };
  for (const a of lay.bays) {
    if (inBuffet(a)) continue;
    const zc = z(a);
    for (const s of [1, -1]) {
      const single = lay.first && s < 0;
      const xIn = single ? s * (aisle + 2 * sw - 0.64) : s * aisle, xOut = s * (aisle + 2 * sw);
      const [x0, x1] = s > 0 ? [xIn, xOut] : [xOut, xIn];
      seat(x0, x1, zc + off, -1); // faces back towards the table
      seat(x0, x1, zc - off, 1);
      table(x0, x1, zc, s);
      // luggage rack above the windows with reading-light strip underneath
      b.add('steel', boxMinMax(s > 0 ? w - 0.36 : -w, 3.02, zc - bp / 2 + 0.05, s > 0 ? w : -w + 0.36, 3.05, zc + bp / 2 - 0.05));
      b.add('steel', boxMinMax(s > 0 ? w - 0.37 : -w + 0.35, 3.02, zc - bp / 2 + 0.05, s > 0 ? w - 0.35 : -w + 0.37, 3.1, zc + bp / 2 - 0.05));
      b.add('coach_light', boxMinMax(s > 0 ? w - 0.3 : -w + 0.05, 3.0, zc - bp / 2 + 0.2, s > 0 ? w - 0.05 : -w + 0.3, 3.015, zc + bp / 2 - 0.2));
    }
    // first class: tie-back curtains at both sides of each window, gathered in folds at the tie
    if (lay.first) for (const s of [1, -1]) for (const e of [1, -1]) {
      const zz = zc + e * (winW / 2 - 0.02), xc = s * (w - 0.05), yTie = wBot + 0.32;
      for (let f = 0; f < 5; f++) {
        const u = f / 4 - 0.5, x = xc + s * 0.012 * (f % 2);
        const top = V(x, wTop + 0.12, zz + e * u * 0.2 - e * 0.05), tie = V(x, yTie, zz + e * u * 0.05), low = V(x, wBot - 0.02, zz + e * u * 0.1);
        b.add('curtain', cylBetween(top, tie, 0.022, 6), cylBetween(tie, low, 0.02, 6));
      }
      b.add('curtain', boxMinMax(xc - 0.035, yTie - 0.02, zz - 0.07, xc + 0.035, yTie + 0.02, zz + 0.07));   // tie-back band
    }
  }
  // saloon end partitions: wood lower panels, glazed upper panels, open doorway on the aisle
  const part = (zz: number) => {
    const outline: [number, number][] = [[-w, floor], [w, floor], [w, cant + 0.2], [-w, cant + 0.2]];
    const doorway: [number, number][] = [[-0.42, floor], [0.42, floor], [0.42, floor + 2.0], [-0.42, floor + 2.0]];
    const lites = [-1, 1].map((s) => roundedRect(s > 0 ? 0.55 : -w + 0.12, floor + 1.0, s > 0 ? w - 0.12 : -0.55, floor + 1.85, 0.04));
    b.add('wood_panel', extrudeSection(outline, zz - 0.03, zz + 0.03, [doorway, ...lites]));
    for (const lt of lites) b.add('glass', extrudeSection(lt, zz - 0.005, zz + 0.005));
  };
  for (const a of lay.partitions) part(z(a));
  // toilets: two cubicles flanking the passage (Mk2/Mk1 TSO, A end) or one beside it (Mk2B, each end)
  for (const t of lay.toilets) {
    for (const s of t.side === 0 ? [1, -1] : [t.side]) {
      const xi = s * 0.42, xo = s * w;
      b.add('wood_panel', boxMinMax(xi - 0.02, floor, z(t.a1), xi + 0.02, cant + 0.2, z(t.a0) - 0.06));                    // wall on the passage
      for (const a of [t.a0, t.a1]) if (a > 0.1) b.add('wood_panel', boxMinMax(Math.min(xi, xo), floor, z(a) - 0.03, Math.max(xi, xo), cant + 0.2, z(a) + 0.03)); // end walls
      const zc = z((t.a0 + t.a1) / 2);
      b.add('table_top', boxMinMax(xi - 0.025, floor + 0.05, zc - 0.35, xi + 0.025, floor + 1.95, zc + 0.35));                // toilet door
    }
  }
  // ceiling light diffusers down the centre of the saloons
  for (const a of lay.bays) b.add('coach_light', boxMinMax(-0.12, v('height') - 0.18, z(a) - 0.5, 0.12, v('height') - 0.175, z(a) + 0.5));
  // grab poles in the vestibules
  for (const a of Object.values(lay.doors)) for (const s of [1, -1]) b.add('steel', cylBetween(V(s * (w - 0.1), floor, z(a) + dw / 2 + 0.11), V(s * (w - 0.1), cant, z(a) + dw / 2 + 0.11), 0.015, 8));
  if (lay.buffet) buffetEnd(b, lay, w, floor);
  for (const m of b.build('coach_int', mats)) G.add(m);
  return G;
}

/** Buffet and shop at the B end of the Mk1 coach (99318). The real fit-out is not published, so this
 * is an estimate (REFERENCE §6): servery on the right (counter facing the aisle, staff behind it),
 * shop shelves under the windows on the left, a tall display and a sign where the saloon ends. */
function buffetEnd(b: Batch, lay: CoachLayout, w: number, floor: number) {
  const [a0, a1] = lay.buffet!, z = lay.z, wBot = v('windowBottomH'), cant = v('cantrailH');
  const cx0 = -0.8, cx1 = -0.36, ca0 = a0 + 0.3, ca1 = a1 - 1.1, at = (d: number) => z(ca0 + d);
  b.add('wood_panel', boxMinMax(cx0, floor, z(ca1), cx1, floor + 0.98, z(ca0)));                     // counter front and ends
  b.add('table_top', boxMinMax(cx0, floor + 0.98, z(ca1), cx1 + 0.04, floor + 1.02, z(ca0)));         // worktop
  b.add('glass', boxMinMax(cx1 - 0.34, floor + 1.02, at(0.9), cx1 - 0.02, floor + 1.3, at(0.15)));    // cake display
  b.add('steel', boxMinMax(cx0 + 0.04, floor + 1.02, at(1.5), cx1 - 0.12, floor + 1.42, at(1.1)));    // coffee machine
  b.add('steel', cylBetween(V(cx0 + 0.2, floor + 1.02, at(1.85)), V(cx0 + 0.2, floor + 1.44, at(1.85)), 0.13, 14)); // hot-water urn
  b.add('underframe', boxMinMax(cx1 - 0.3, floor + 1.02, at(2.45), cx1 - 0.05, floor + 1.15, at(2.2))); // till
  b.add('steel', boxMinMax(-w, floor, z(a1 - 0.05), cx0 - 0.04, floor + 1.75, z(a1 - 0.62)));        // fridge in the corner
  // shop: shelves under the windows on the left with goods on them, a tall display facing the shop
  const sz0 = z(a0 + 0.42), sz1 = z(a1 - 0.05);
  b.add('wood_panel', boxMinMax(w - 0.42, floor, sz1, w, floor + 0.04, sz0));
  for (const y of [0.3, 0.55, wBot - floor - 0.06]) b.add('wood_panel', boxMinMax(w - 0.42, floor + y, sz1, w, floor + y + 0.025, sz0));
  const goods = (wd: number, ht: number, x: number, y: number, zz: number, ry: number) => { const g = new THREE.PlaneGeometry(wd, ht); g.rotateY(ry); g.translate(x, y, zz); return g; };
  b.add('decal_goods', goods(sz0 - sz1, wBot - floor - 0.1, w - 0.425, floor + (wBot - floor) / 2 - 0.02, (sz0 + sz1) / 2, -Math.PI / 2));
  const tz = z(a0) - 0.02;
  b.add('wood_panel', boxMinMax(0.5, floor, tz - 0.36, w, floor + 1.95, tz));
  b.add('decal_goods', goods(w - 0.54, 1.8, (0.5 + w) / 2, floor + 1.0, tz - 0.365, Math.PI));
  // sign hanging over the aisle, facing the seats
  b.add('decal_buffetsign', goods(0.9, 0.24, 0.1, cant - 0.02, z(a0), 0));
  b.add('decal_buffetsign', goods(0.9, 0.24, 0.1, cant - 0.02, z(a0) - 0.004, Math.PI));
  for (const x of [-0.3, 0.5]) b.add('steel', cylBetween(V(x, cant + 0.1, z(a0)), V(x, roofY(x) - 0.1, z(a0)), 0.008, 6));
}
