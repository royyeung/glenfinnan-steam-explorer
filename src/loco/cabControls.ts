// Every operable control in the cab: what it is, what it does, where it sits and how it moves.
// Positions: d (behind front buffer), h (above rail), x (+ left / driver's side). Layout sources:
// S41 (Black Five backhead photo), 44871 footplate photo, S27 labelled control list for
// 45407/44871/45212. Modern safety items (M8 air valve, AWS) are listed by S27 only: their exact
// form and position on 45407 are unconfirmed.

export type Axis = 'x' | 'y' | 'z';
export type ControlKind = 'wheel' | 'lever' | 'button' | 'slide' | 'toggle' | 'doors';

export interface CabControl {
  id: string;
  name: string;
  what: string;
  does: string;
  kind: ControlKind;
  on: 'engine' | 'tender';
  d: number; h: number; x: number;
  axis: Axis;
  /** value range and the node rotation (rad) or travel (m) at each end */
  min: number; max: number; at0: number; at1: number;
  init: number;
  step?: number;
  momentary?: boolean; // springs back when released (whistle, AWS button)
  labels?: [string, string];
  confirmed: 'class-photo' | 'S27-list' | 'estimate';
}

export const CONTROLS: CabControl[] = [
  { id: 'regulator', name: 'Regulator', what: 'The long handle across the top of the backhead.', does: 'Opens the main steam valve in the dome: the further it is pulled, the more steam goes to the cylinders.',
    kind: 'lever', on: 'engine', d: 10.47, h: 3.3, x: 0.05, axis: 'z', min: 0, max: 1, at0: -0.12, at1: 1.1, init: 0, labels: ['Shut', 'Full'], confirmed: 'class-photo' },
  { id: 'reverser', name: 'Reverser', what: 'The handwheel on the pedestal by the driver\'s window, with the cut-off scale.', does: 'Sets the valve gear: forward, back or mid gear, and how early steam is cut off in each stroke. Watch the valve gear outside move as you turn it.',
    kind: 'wheel', on: 'engine', d: 10.9, h: 2.66, x: 1.02, axis: 'y', min: -1, max: 1, at0: -8 * Math.PI, at1: 8 * Math.PI, init: 0.65, labels: ['Full back', 'Full forward'], confirmed: 'S27-list' },
  { id: 'brake', name: 'Driver\'s brake valve', what: 'Combination valve for the vacuum brake and the engine\'s steam brake.', does: 'Lets air into the train pipe to brake every vehicle, and applies the engine\'s own steam brake at the same time.',
    kind: 'lever', on: 'engine', d: 10.5, h: 2.56, x: 0.62, axis: 'z', min: 0, max: 1, at0: 0, at1: -1.25, init: 0, labels: ['Release', 'Full brake'], confirmed: 'class-photo' },
  { id: 'ejectorLarge', name: 'Large ejector', what: 'Brass handwheel on the driver\'s side of the backhead.', does: 'Blows a jet of steam to suck air out of the train pipe quickly, releasing the brakes.',
    kind: 'wheel', on: 'engine', d: 10.47, h: 2.98, x: 0.74, axis: 'z', min: 0, max: 1, at0: 0, at1: 3 * Math.PI, init: 0, labels: ['Off', 'On'], confirmed: 'S27-list' },
  { id: 'ejectorSmall', name: 'Small ejector', what: 'Smaller handwheel beside the large ejector.', does: 'Keeps the vacuum up while running, against small leaks.',
    kind: 'wheel', on: 'engine', d: 10.47, h: 2.98, x: 0.53, axis: 'z', min: 0, max: 1, at0: 0, at1: 2.5 * Math.PI, init: 1, labels: ['Off', 'On'], confirmed: 'S27-list' },
  { id: 'airBrake', name: 'Air brake valve (M8)', what: 'Modern air-brake valve on a pedestal by the driver\'s window (fitted in preservation).', does: 'Controls the air brakes of modern air-braked coaches such as the Mk2s, and the vacuum brake through a proportional valve.',
    kind: 'lever', on: 'engine', d: 10.3, h: 2.72, x: 1.12, axis: 'y', min: 0, max: 1, at0: 0, at1: -1.9, init: 0, labels: ['Release', 'Emergency'], confirmed: 'S27-list' },
  { id: 'whistle', name: 'Whistle', what: 'Handle above the driver\'s side of the backhead.', does: 'Sounds the whistle. Pull and hold.',
    kind: 'lever', on: 'engine', d: 10.5, h: 3.5, x: 0.38, axis: 'x', min: 0, max: 1, at0: 0, at1: 0.55, init: 0, momentary: true, labels: ['Off', 'Blowing'], confirmed: 'class-photo' },
  { id: 'drainCocks', name: 'Cylinder drain cocks', what: 'Lever on the floor by the driver\'s seat.', does: 'Opens small valves on the cylinders to blow out water when starting off from cold.',
    kind: 'lever', on: 'engine', d: 10.62, h: 1.62, x: 1.14, axis: 'x', min: 0, max: 1, at0: 0, at1: -0.75, init: 0, labels: ['Shut', 'Open'], confirmed: 'S27-list' },
  { id: 'sander', name: 'Steam sanding valve', what: 'Small lever on the driver\'s side of the backhead.', does: 'Blows sand under the driving wheels when they slip.',
    kind: 'lever', on: 'engine', d: 10.5, h: 2.62, x: 0.36, axis: 'z', min: 0, max: 1, at0: 0, at1: 0.7, init: 0, labels: ['Off', 'On'], confirmed: 'S27-list' },
  { id: 'compressor', name: 'Air-pump steam valve', what: 'Handwheel on the steam manifold.', does: 'Turns on the steam-driven air pump that supplies the air brakes.',
    kind: 'wheel', on: 'engine', d: 10.48, h: 3.42, x: 0.22, axis: 'z', min: 0, max: 1, at0: 0, at1: 2 * Math.PI, init: 1, labels: ['Off', 'On'], confirmed: 'S27-list' },
  { id: 'injL', name: 'Left injector steam valve', what: 'Handwheel on the left of the manifold.', does: 'Starts the left injector, which forces water from the tender into the boiler (the tender water valve must be open).',
    kind: 'wheel', on: 'engine', d: 10.48, h: 3.24, x: 0.4, axis: 'z', min: 0, max: 1, at0: 0, at1: 2.5 * Math.PI, init: 0, labels: ['Shut', 'Open'], confirmed: 'S27-list' },
  { id: 'injR', name: 'Right injector steam valve', what: 'Handwheel on the fireman\'s side of the manifold.', does: 'Starts the right injector (the tender water valve must be open).',
    kind: 'wheel', on: 'engine', d: 10.48, h: 3.22, x: -0.56, axis: 'z', min: 0, max: 1, at0: 0, at1: 2.5 * Math.PI, init: 0, labels: ['Shut', 'Open'], confirmed: 'S27-list' },
  { id: 'blower', name: 'Blower', what: 'Handwheel low on the fireman\'s side of the backhead.', does: 'Blows steam up the chimney to draw air through the fire when the regulator is shut. It livens the fire and keeps smoke out of the cab.',
    kind: 'wheel', on: 'engine', d: 10.48, h: 2.92, x: -0.32, axis: 'z', min: 0, max: 1, at0: 0, at1: 2.5 * Math.PI, init: 0.25, labels: ['Shut', 'Full'], confirmed: 'class-photo' },
  { id: 'fireDoors', name: 'Firehole doors', what: 'Two sliding doors over the firehole.', does: 'Opened to fire the coal (and to let air over the fire); kept shut otherwise to keep the heat in.',
    kind: 'doors', on: 'engine', d: 10.46, h: 2.18, x: 0, axis: 'x', min: 0, max: 1, at0: 0, at1: 0.2, init: 0, labels: ['Shut', 'Open'], confirmed: 'class-photo' },
  { id: 'deflector', name: 'Firehole deflector flap', what: 'Plate below the firehole, inside the doors.', does: 'Turned up to direct the air coming in through the doors down onto the fire.',
    kind: 'lever', on: 'engine', d: 10.47, h: 1.94, x: 0, axis: 'x', min: 0, max: 1, at0: 0, at1: -1.1, init: 0, labels: ['Down', 'Up'], confirmed: 'class-photo' },
  { id: 'damperF', name: 'Front damper', what: 'Lever on the floor, fireman\'s side.', does: 'Opens the front of the ashpan to let air under the fire.',
    kind: 'lever', on: 'engine', d: 10.62, h: 1.62, x: -1.1, axis: 'x', min: 0, max: 1, at0: 0, at1: -0.7, init: 0.5, labels: ['Shut', 'Open'], confirmed: 'S27-list' },
  { id: 'damperR', name: 'Rear damper', what: 'Second damper lever beside the first.', does: 'Opens the back of the ashpan.',
    kind: 'lever', on: 'engine', d: 10.78, h: 1.62, x: -1.1, axis: 'x', min: 0, max: 1, at0: 0, at1: -0.7, init: 0, labels: ['Shut', 'Open'], confirmed: 'S27-list' },
  { id: 'aws', name: 'AWS acknowledgement', what: 'Modern train-protection indicator and button by the driver\'s window (fitted in preservation).', does: 'The driver presses it to acknowledge a warning horn at a caution signal; otherwise the brakes go on automatically.',
    kind: 'button', on: 'engine', d: 10.25, h: 3.15, x: 1.08, axis: 'z', min: 0, max: 1, at0: 0, at1: 0.02, init: 0, momentary: true, labels: ['', 'Pressed'], confirmed: 'S27-list' },
  { id: 'cabLight', name: 'Cab light', what: 'Switch for the small cab and gauge lamps.', does: 'Lights the gauges at night.',
    kind: 'toggle', on: 'engine', d: 10.25, h: 3.3, x: -1.08, axis: 'z', min: 0, max: 1, at0: -0.4, at1: 0.4, init: 0, labels: ['Off', 'On'], confirmed: 'S27-list' },
  { id: 'waterL', name: 'Left tender water valve', what: '"OPEN – WATER – SHUT" lever on the tender front, driver\'s side.', does: 'Lets water from the tender tank flow to the left injector.',
    kind: 'lever', on: 'tender', d: 12.47, h: 1.95, x: 0.72, axis: 'z', min: 0, max: 1, at0: 0, at1: 1.3, init: 1, labels: ['Shut', 'Open'], confirmed: 'class-photo' },
  { id: 'waterR', name: 'Right tender water valve', what: '"OPEN – WATER – SHUT" lever on the tender front, fireman\'s side.', does: 'Lets water flow to the right injector.',
    kind: 'lever', on: 'tender', d: 12.47, h: 1.95, x: -0.72, axis: 'z', min: 0, max: 1, at0: 0, at1: -1.3, init: 1, labels: ['Shut', 'Open'], confirmed: 'class-photo' },
  { id: 'handbrake', name: 'Tender handbrake', what: 'Handle on top of the column on the tender front.', does: 'Screws the tender brake blocks onto the wheels; used when the engine is parked.',
    kind: 'wheel', on: 'tender', d: 12.42, h: 2.62, x: 0.95, axis: 'y', min: 0, max: 1, at0: 0, at1: 10 * Math.PI, init: 0, labels: ['Off', 'On'], confirmed: 'S27-list' },
  { id: 'coalDoors', name: 'Coal doors', what: 'Two small doors in the tender front above the shovelling plate.', does: 'Opened to let coal down onto the shovelling plate for the fireman.',
    kind: 'doors', on: 'tender', d: 12.47, h: 2.12, x: 0, axis: 'y', min: 0, max: 1, at0: 0, at1: 1.5, init: 1, labels: ['Shut', 'Open'], confirmed: 'class-photo' },
];

export const controlById = (id: string) => CONTROLS.find((c) => c.id === id)!;

export interface GaugeDef { id: string; name: string; what: string; d: number; h: number; x: number; r: number; max: number; needles: number; confirmed: CabControl['confirmed'] }
export const GAUGES: GaugeDef[] = [
  { id: 'pressure', name: 'Boiler pressure gauge', what: 'Steam pressure in the boiler, pounds per square inch. Working pressure is 225; the safety valves lift above that.', d: 10.47, h: 3.47, x: -0.18, r: 0.13, max: 300, needles: 1, confirmed: 'class-photo' },
  { id: 'vacuum', name: 'Vacuum gauge', what: 'Two needles: train pipe and reservoir, inches of mercury. About 21 in. means brakes off; zero means full brake.', d: 10.47, h: 3.47, x: 0.62, r: 0.12, max: 30, needles: 2, confirmed: 'class-photo' },
  { id: 'air', name: 'Air brake gauge', what: 'Two needles: main reservoir and brake pipe, psi (modern air brake).', d: 10.32, h: 3.0, x: 1.12, r: 0.08, max: 150, needles: 2, confirmed: 'S27-list' },
  { id: 'heat', name: 'Steam heat gauge', what: 'Pressure of steam sent back to warm the coaches (unused with the Mk2 set).', d: 10.47, h: 3.35, x: -0.68, r: 0.07, max: 100, needles: 1, confirmed: 'class-photo' },
];
