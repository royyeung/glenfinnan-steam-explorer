// Assembles the engine and tender from the part modules (Phase 2). Moving parts keep the node
// names the rig expects; static parts are merged per material.
import * as THREE from 'three';
import { B5, zTender } from '../specs/black5.ts';
import { Batch, DETAIL } from './geom.ts';
import { engineLayout, motionGeometry, valveGearGeometry } from './layout.ts';
import { boiler } from './parts/boiler.ts';
import { cab, cabGates } from './parts/cab.ts';
import { cabInterior, controlNodes, instrumentNodes, tenderFront } from './parts/cabInterior.ts';
import { engineLivery, tenderLivery } from './parts/livery.ts';
import { PLANES, buildMotionParts, motionStatic } from './parts/motion.ts';
import { running } from './parts/running.ts';
import { tenderBody, tenderWheelsets } from './parts/tender.ts';
import { wheelset } from './parts/wheels.ts';
import type { MatKey } from './materials.ts';

type Mats = Record<MatKey, THREE.Material>;

function group(name: string, b: Batch, mats: Mats) {
  const g = new THREE.Group(); g.name = name;
  for (const m of b.build(name, mats)) g.add(m);
  return g;
}

export function buildEngine(mats: Mats): THREE.Group {
  const E = new THREE.Group(); E.name = 'engine';
  const b = new Batch();
  running(b); boiler(b); cab(b); cabInterior(b); motionStatic(b); engineLivery(b);
  for (const m of b.build('engine_static', mats)) E.add(m);

  const lay = engineLayout(), geo = motionGeometry(), vg = valveGearGeometry();
  const crankL = 0, crankR = geo.rightLeads ? -Math.PI / 2 : Math.PI / 2;
  const sets: [string, typeof lay.axles.lead, Batch][] = [
    ['ws_bogieFront', lay.axles.bogieFront, wheelset(lay.axles.bogieFront.r, 10, null, null, 0)],
    ['ws_bogieRear', lay.axles.bogieRear, wheelset(lay.axles.bogieRear.r, 10, null, null, 0)],
    ['ws_lead', lay.axles.lead, wheelset(lay.axles.lead.r, B5.driverSpokes.v, crankL, crankR, PLANES.coupling() + 0.04)],
    ['ws_drive', lay.axles.drive, wheelset(lay.axles.drive.r, B5.driverSpokes.v, crankL, crankR, PLANES.conRod() + 0.06,
      { throw: vg.returnCrankThrow, angle: vg.returnCrankAngle, lateral: PLANES.eccentric() })],
    ['ws_trail', lay.axles.trail, wheelset(lay.axles.trail.r, B5.driverSpokes.v, crankL, crankR, PLANES.coupling() + 0.04)],
  ];
  for (const [name, a, wb] of sets) { const g = group(name, wb, mats); g.position.set(0, a.y, a.z); E.add(g); }
  for (const g of buildMotionParts(mats)) E.add(g);
  for (const g of cabGates(mats)) E.add(g);
  if (DETAIL >= 1) for (const g of [...controlNodes(mats, 'engine'), ...instrumentNodes(mats)]) E.add(g);
  return E;
}

export function buildTender(mats: Mats): THREE.Group {
  const T = new THREE.Group(); T.name = 'tender';
  const b = new Batch();
  tenderBody(b); tenderLivery(b); tenderFront(b);
  for (const m of b.build('tender_static', mats)) T.add(m);
  tenderWheelsets(T, mats);
  if (DETAIL >= 1) for (const g of controlNodes(mats, 'tender')) T.add(g);
  void zTender;
  return T;
}
