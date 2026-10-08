// Info mode: plain-language labels for the parts of the engine and tender. Positions use the
// spec coordinates: d = metres behind the front buffer, h = height above rail, x = side offset
// (+ left / - right). Markers on the far side of the vehicle are hidden.
import * as THREE from 'three';
import { B5, zEngine, zTender } from '../specs/black5.ts';
import { CONTROLS, GAUGES } from '../loco/cabControls.ts';
import { mk2Layout } from '../coach/mk2.ts';

export interface Hotspot { id: string; name: string; what: string; does: string; d: number; h: number; x: number; on: 'engine' | 'tender' | 'coach'; near?: boolean; inside?: boolean }

const v = (k: keyof typeof B5) => B5[k].v;

export const HOTSPOTS: Hotspot[] = [
  { id: 'chimney', name: 'Chimney', what: 'The short funnel on top of the smokebox.', does: 'Exhaust steam from the cylinders blasts up through it, pulling air through the fire. That is where the "chuff" comes from.', d: v('chimneyD'), h: 3.75, x: 0, on: 'engine' },
  { id: 'smokebox', name: 'Smokebox', what: 'The black drum at the front of the boiler.', does: 'Collects smoke and ash from the boiler tubes and sends them up the chimney.', d: 2.0, h: 3.0, x: -0.75, on: 'engine' },
  { id: 'door', name: 'Smokebox door', what: 'Round door with a central handle (the "dart").', does: 'Opened at the end of the day to shovel out the ash that collects inside.', d: 1.3, h: 2.6, x: 0.3, on: 'engine' },
  { id: 'plates', name: 'Number and shed plates', what: 'Blue plate "45407" and the small oval plate below.', does: 'Identify the engine. The oval plate shows a shed code (65J, Fort William).', d: 1.27, h: 2.95, x: 0, on: 'engine' },
  { id: 'headboard', name: 'Headboard', what: '"THE JACOBITE" board above the smokebox door.', does: 'Names the train service. It is moved to the back of the tender when the engine runs backwards.', d: 1.45, h: 3.45, x: 0, on: 'engine' },
  { id: 'buffers', name: 'Buffers and buffer beam', what: 'The red beam with two sprung buffers.', does: 'Take the push between vehicles; the coupling hook in the middle takes the pull.', d: 0.3, h: 1.04, x: 0.87, on: 'engine' },
  { id: 'hoses', name: 'Brake hoses', what: 'Rubber pipes hanging from the beams.', does: 'Connect the train brake pipes: a vacuum pipe and air pipes, so the driver can brake every vehicle at once.', d: 0.25, h: 0.6, x: -0.35, on: 'engine' },
  { id: 'lamps', name: 'Lamps', what: 'Lamp irons and electric lamps at the front.', does: 'Show which way the train is going and what kind of train it is.', d: 0.5, h: 1.4, x: -0.98, on: 'engine' },
  { id: 'bogie', name: 'Bogie', what: 'The two small wheel pairs at the front, in a frame that can swivel.', does: 'Guides the engine into curves and carries the weight of the front end.', d: 2.4, h: 0.5, x: 0.7, on: 'engine' },
  { id: 'cylinder', name: 'Cylinder', what: 'The big box on each side (18½ in bore, 28 in stroke).', does: 'Steam pushes a piston back and forth inside: this is the engine itself. The piston valve sits in the upper part.', d: 2.55, h: 1.2, x: 1.26, on: 'engine' },
  { id: 'steampipe', name: 'Steam pipe', what: 'The rounded pipe casing running down beside the smokebox.', does: 'Carries hot steam from the boiler to the valve chest above the cylinder.', d: 2.52, h: 2.3, x: -0.86, on: 'engine' },
  { id: 'crosshead', name: 'Crosshead and slidebars', what: 'The block sliding between two bars behind the cylinder.', does: 'Keeps the piston rod straight while the connecting rod swings up and down.', d: 4.2, h: 1.0, x: 1.0, on: 'engine' },
  { id: 'conrod', name: 'Connecting rod', what: 'The long rod from the crosshead to the middle driving wheel.', does: 'Turns the back-and-forth of the piston into the rotation of the wheels.', d: 5.8, h: 0.95, x: 1.02, on: 'engine' },
  { id: 'couplingrods', name: 'Coupling rods', what: 'Rods linking all three big wheels on each side.', does: 'Make all six driving wheels turn together for better grip.', d: 8.5, h: 0.9, x: 0.92, on: 'engine' },
  { id: 'drivers', name: 'Driving wheels', what: 'Six wheels, 6 ft 0 in (1.83 m) across.', does: 'Push the train along. The sides are set a quarter-turn apart so the engine can always start.', d: 9.73, h: 0.95, x: 0.82, on: 'engine' },
  { id: 'balance', name: 'Balance weights', what: 'The solid crescents between the spokes.', does: 'Counter the weight of the rods so the engine runs smoothly instead of hammering the rails.', d: 7.6, h: 0.5, x: 0.83, on: 'engine' },
  { id: 'returncrank', name: 'Return crank and eccentric rod', what: 'Short arm on the middle wheel and the rod leading back from it.', does: 'Take a small rocking movement from the wheel to drive the valve gear.', d: 7.2, h: 0.95, x: 1.13, on: 'engine' },
  { id: 'link', name: 'Expansion link', what: 'The curved slotted link above the wheels.', does: 'Rocks back and forth. Where the die block sits in it decides forward or reverse, and how much steam is used.', d: v('trunnionD'), h: v('trunnionH'), x: 1.12, on: 'engine' },
  { id: 'radiusrod', name: 'Radius rod', what: 'Rod from the expansion link forward to the combination lever.', does: 'Carries the link movement to the valve. The driver raises or lowers it with the reverser.', d: 4.6, h: 1.5, x: 1.12, on: 'engine' },
  { id: 'lever', name: 'Combination lever and union link', what: 'Upright lever near the cylinder, joined to the crosshead at the bottom.', does: 'Adds the "lap and lead" movement so steam enters at exactly the right moment.', d: v('valveSpindleD'), h: 1.2, x: 1.12, on: 'engine' },
  { id: 'reverser', name: 'Reach rod and lifting link', what: 'Rod running back to the cab and the arm on the reversing shaft.', does: 'Connect the driver\'s reverser to the valve gear: forward, back and "cut-off".', d: 7.8, h: 1.95, x: 1.2, on: 'engine' },
  { id: 'boiler', name: 'Boiler', what: 'The tapered barrel (a Stanier taper boiler) at 225 lb per square inch.', does: 'Water is turned to steam by hot gases passing through tubes inside it.', d: 5.0, h: 3.35, x: 0.7, on: 'engine' },
  { id: 'topfeed', name: 'Top feed', what: 'The small casing on top of the boiler, ahead of the dome.', does: 'Where fresh water from the injectors enters the boiler.', d: v('topFeedD'), h: 3.7, x: 0, on: 'engine' },
  { id: 'dome', name: 'Dome', what: 'The rounded cover on top of the boiler.', does: 'Houses the regulator valve that the driver opens to send steam to the cylinders.', d: v('domeD'), h: 3.8, x: 0, on: 'engine' },
  { id: 'safety', name: 'Safety valves', what: 'Two small brass valves on the firebox.', does: 'Let steam blow off loudly if the pressure gets too high.', d: v('safetyValveD'), h: 3.75, x: 0, on: 'engine' },
  { id: 'whistle', name: 'Whistle', what: 'Brass whistle in front of the cab.', does: 'Warns people on the line and signals to staff.', d: 9.76, h: 3.9, x: 0.18, on: 'engine' },
  { id: 'firebox', name: 'Belpaire firebox', what: 'The square-topped part of the boiler next to the cab.', does: 'Holds the coal fire. Its flat top gives more room for water above the fire.', d: 8.6, h: 3.3, x: -0.85, on: 'engine' },
  { id: 'lubricators', name: 'Mechanical lubricators', what: 'Boxes on the running plate (right side).', does: 'Pump oil to the cylinders and valves, driven by the motion.', d: 7.4, h: 2.05, x: -1.0, on: 'engine' },
  { id: 'sandbox', name: 'Sandboxes', what: 'Filler caps on the running plate, pipes down to the rails.', does: 'Drop sand in front of the wheels when they slip on wet rails.', d: 4.5, h: 1.95, x: 1.1, on: 'engine' },
  { id: 'nameplate', name: 'Nameplate', what: '"The Lancashire Fusilier", with a crest above.', does: 'The name was given in preservation; the engine was never named in British Railways service.', d: 5.08, h: 2.15, x: -0.95, on: 'engine' },
  { id: 'aws', name: 'Safety equipment (AWS/TPWS)', what: 'Modern train-protection receiver and electrical boxes.', does: 'Warn the driver about signals and stop the train automatically if one is passed at danger. Required on today\'s main line.', d: 1.9, h: 2.0, x: 1.1, on: 'engine' },
  { id: 'cab', name: 'Cab', what: 'The crew\'s shelter (inside comes in Phase 3).', does: 'Driver (left side) and fireman work the controls and the fire from here.', d: 11.2, h: 3.0, x: 1.31, on: 'engine' },
  { id: 'number', name: 'Number and power class', what: '"45407" and "5MT" on the cab side.', does: 'British Railways number; 5MT means power class 5, mixed traffic.', d: 10.9, h: 1.97, x: -1.33, on: 'engine' },
  { id: 'injector', name: 'Injector', what: 'Fitting under the cab with pipes up to the boiler.', does: 'Uses a jet of steam to force water into the boiler against its own pressure.', d: 10.6, h: 1.15, x: 0.75, on: 'engine' },
  { id: 'tender', name: 'Tender', what: 'Wagon carrying 9 tons of coal and 4,710 gallons of water (45407\'s larger tank).', does: 'Supplies the fire and the boiler. The engine and tender are coupled together permanently.', d: 15.5, h: 2.4, x: 1.32, on: 'tender' },
  { id: 'coal', name: 'Coal space', what: 'The open top of the tender, heaped with coal.', does: 'The fireman shovels from here into the firebox.', d: 14.5, h: 3.35, x: 0, on: 'tender' },
  { id: 'filler', name: 'Water filler', what: 'The round lid on the rear of the tender.', does: 'Water is filled here from a water column at stations.', d: 18.45, h: 2.85, x: 0.45, on: 'tender' },
  { id: 'emblem', name: 'BR emblem', what: 'The early British Railways "lion and wheel" emblem.', does: 'Marks the livery of the 1950s, which 45407 carries today.', d: 15.66, h: 2.13, x: -1.32, on: 'tender' },
  { id: 'tenderwheels', name: 'Tender wheels and springs', what: 'Three axles with axleboxes and leaf springs on outside frames.', does: 'Carry the heavy tender smoothly; brake blocks act on the wheel treads.', d: 15.7, h: 0.9, x: 1.12, on: 'tender' },
];

// cab controls and gauges appear in Info mode only when you are on the footplate
HOTSPOTS.push(...CONTROLS.map((k) => ({ id: `c_${k.id}`, name: k.name, what: k.what, does: k.does, d: k.d - 0.03, h: k.h, x: k.x, on: k.on, near: true })),
  ...GAUGES.map((g) => ({ id: `g_${g.id}`, name: g.name, what: g.what, does: '', d: g.d - 0.03, h: g.h, x: g.x, on: 'engine' as const, near: true })));

// first coach (d = metres from its A end, towards the engine)
HOTSPOTS.push(
  { id: 'k_coach', name: 'Mark 2 coach (TSO)', what: 'A British Rail Mark 2 "Tourist Standard Open", built in the mid-1960s; this maroon one belongs to West Coast Railways.', does: 'Carries 64 standard-class passengers in two open saloons with seats around tables. In 2026 the Jacobite ran with Mk2s.', d: 6, h: 2.4, x: -1.45, on: 'coach' },
  { id: 'k_num', name: 'Running number', what: 'The coach\'s number (this one is the first of the formation).', does: 'Identifies the vehicle for maintenance and records.', d: 0.6, h: 1.5, x: -1.45, on: 'coach' },
  { id: 'k_door', name: 'Slam door and door light', what: 'Hinged door with a drop-light window; the orange light above is the central door locking (CDL) indicator.', does: 'Since 2024 the doors must lock centrally before the train moves; the light shows when a door is unlocked.', d: 10.42, h: 2.6, x: -1.45, on: 'coach' },
  { id: 'k_vent', name: 'Opening window vent', what: 'The narrow top section of each window tips open.', does: 'Fresh air: these early Mk2s are pressure-ventilated, not air-conditioned, so the windows open (one reason they suit a steam train).', d: 3.03, h: 2.75, x: -1.45, on: 'coach' },
  { id: 'k_roof', name: 'Ventilation domes', what: 'Small domes along the roof.', does: 'Air outlets for the pressure ventilation system.', d: 8, h: 3.95, x: 0, on: 'coach' },
  { id: 'k_gangway', name: 'Gangway', what: 'The rubber-framed connection at each end.', does: 'Lets passengers and staff walk from coach to coach.', d: -0.15, h: 2.3, x: -0.6, on: 'coach' },
  { id: 'k_buffers', name: 'Buffers and buckeye coupler', what: 'Two buffers and a central automatic "buckeye" coupler.', does: 'The coupler joins the coaches together; the buffers take the push and are used when coupled to the engine\'s screw coupling.', d: -0.15, h: 1.04, x: 0.87, on: 'coach' },
  { id: 'k_bogie', name: 'B4 bogie', what: 'The two-axle truck under each end, with coil springs.', does: 'Carries the coach and gives a smooth ride up to 100 mph.', d: 2.75, h: 0.75, x: -1.15, on: 'coach' },
  { id: 'k_toilet', name: 'Toilet window', what: 'Small frosted window at the end.', does: 'The two toilets are at this end of the coach.', d: 0.58, h: 2.5, x: -1.45, on: 'coach' },
  { id: 'k_seats', name: 'Seats and tables', what: '2 + 2 seats facing each other around tables, blue vinyl and moquette.', does: 'Standard class: tables for four on both sides of the aisle.', d: 5.0, h: 1.9, x: 0.6, on: 'coach', near: true, inside: true },
  { id: 'k_racks', name: 'Luggage racks', what: 'Shelves above the windows with lights underneath.', does: 'For bags and coats; the lights also light the seats.', d: 7.0, h: 3.05, x: 1.1, on: 'coach', near: true, inside: true },
  { id: 'k_partition', name: 'Saloon partition', what: 'Wood and glass screen between the saloon and the vestibule.', does: 'Keeps draughts from the doors out of the seating area.', d: 9.96, h: 2.8, x: 0.7, on: 'coach', near: true, inside: true },
);

/** Shown at any distance; the rest appear as you come closer (de-clutters the overview). */
const MAIN = new Set(['chimney', 'smokebox', 'buffers', 'bogie', 'cylinder', 'drivers', 'link', 'boiler', 'dome', 'firebox', 'cab', 'tender', 'coal', 'nameplate']);

export class HotspotLayer {
  private el: HTMLElement;
  private panel: HTMLElement;
  private marks: { h: Hotspot; el: HTMLButtonElement; local: THREE.Vector3 }[] = [];
  visible = false;
  private engine: THREE.Object3D;
  private tender: THREE.Object3D;
  private coach: THREE.Object3D;

  constructor(engine: THREE.Object3D, tender: THREE.Object3D, coach: THREE.Object3D) {
    this.engine = engine; this.tender = tender; this.coach = coach;
    this.el = document.getElementById('hotspots')!;
    this.panel = document.getElementById('infoPanel')!;
    HOTSPOTS.forEach((h, i) => {
      const b = document.createElement('button');
      b.className = 'hs'; b.textContent = String(i + 1); b.title = h.name; b.setAttribute('aria-label', h.name);
      b.onclick = () => this.show(h);
      this.el.appendChild(b);
      const local = new THREE.Vector3(h.x, h.h, h.on === 'engine' ? zEngine(h.d) : h.on === 'tender' ? zTender(h.d) : mk2Layout().z(h.d));
      this.marks.push({ h, el: b, local });
    });
    document.getElementById('infoClose')!.onclick = () => { this.panel.hidden = true; };
  }

  show(h: Hotspot) {
    this.panel.hidden = false;
    this.panel.querySelector('h3')!.textContent = h.name;
    this.panel.querySelector('.what')!.textContent = h.what;
    this.panel.querySelector('.does')!.textContent = h.does;
  }

  setVisible(on: boolean) { this.visible = on; this.el.hidden = !on; if (!on) this.panel.hidden = true; }

  update(camera: THREE.Camera, w: number, h: number) {
    if (!this.visible) return;
    const p = new THREE.Vector3(), camPos = camera.getWorldPosition(new THREE.Vector3());
    const placed: [number, number][] = [];
    const camEng = this.engine.worldToLocal(camPos.clone());
    const inCab = Math.abs(camEng.x) < 1.35 && camEng.y > 1.5 && camEng.y < 3.8 && camEng.z < zEngine(10.0) && camEng.z > zEngine(12.9);
    const camCo = this.coach.worldToLocal(camPos.clone()), lay = mk2Layout();
    const inCoach = Math.abs(camCo.x) < lay.halfW && camCo.y > 1.2 && camCo.y < 4 && Math.abs(camCo.z) < lay.L / 2;
    for (const m of this.marks) {
      const root = m.h.on === 'engine' ? this.engine : m.h.on === 'tender' ? this.tender : this.coach;
      p.copy(m.local); root.localToWorld(p);
      // hide markers on the far side of the vehicle from the camera
      const camLocal = root.worldToLocal(camPos.clone());
      const farSide = Math.abs(m.h.x) > 0.3 && Math.sign(m.h.x) !== Math.sign(camLocal.x) && Math.abs(camLocal.x) > 1.5;
      const dist = p.distanceTo(camPos);
      p.project(camera);
      const sx = ((p.x + 1) / 2) * w, sy = ((1 - p.y) / 2) * h;
      const ok = m.h.inside ? inCoach && dist < 8 : m.h.near ? inCab && dist < 3.2 : !inCab && !inCoach && dist < 45 && (dist < 14 || MAIN.has(m.h.id) || m.h.id === 'k_coach');
      let show = !(farSide && !m.h.inside) && p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && ok;
      if (show && placed.some(([x, y]) => Math.hypot(x - sx, y - sy) < 28)) show = false; // no overlapping markers
      m.el.hidden = !show;
      if (show) { placed.push([sx, sy]); m.el.style.transform = `translate(${sx - 13}px, ${sy - 13}px)`; }
    }
  }
}
