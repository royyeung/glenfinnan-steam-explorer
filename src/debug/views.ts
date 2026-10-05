// Fixed camera positions used by screenshots, the verification harness and GX.view(name).
// World frame: +X east, +Y up, -Z grid north. The engine faces +Z with its LEFT side towards +X.
// The test-site platform is on the RIGHT (-X) side.
// Engine origin (d = 6.20 m behind the front buffer) is at the world origin.
import { B5, ENGINE_ORIGIN_D } from '../specs/black5.ts';

export type View =
  | { kind: 'persp'; pos: [number, number, number]; target: [number, number, number]; fov: number }
  | { kind: 'ortho'; dir: 'left' | 'right' | 'front' | 'top'; centre: [number, number, number]; pxPerM: number }
  | { kind: 'walk'; feet: [number, number, number]; yaw: number; pitch: number };

const front = ENGINE_ORIGIN_D;                     // world z of the front buffer face
const tail = front - B5.lengthOverBuffers.v;       // world z of the tender rear buffer face
const mid = (front + tail) / 2;

export const VIEWS: Record<string, View> = {
  'left-elev': { kind: 'ortho', dir: 'left', centre: [0, 2.0, mid], pxPerM: 80 },
  'right-elev': { kind: 'ortho', dir: 'right', centre: [0, 2.0, mid], pxPerM: 80 },
  'front-end': { kind: 'ortho', dir: 'front', centre: [0, 2.0, 0], pxPerM: 160 },
  'plan': { kind: 'ortho', dir: 'top', centre: [0, 0, mid], pxPerM: 60 },
  'front-34-l': { kind: 'persp', pos: [10.5, 2.4, 15.5], target: [0, 1.9, 0.5], fov: 45 },
  'rear-34-r': { kind: 'persp', pos: [-9.5, 3.4, -26], target: [0, 1.9, -9], fov: 45 },
  'motion-l': { kind: 'persp', pos: [5.2, 1.25, 1.2], target: [0.9, 0.95, 0.6], fov: 50 },
  'site-wide': { kind: 'persp', pos: [32, 11, 34], target: [0, 2.4, -3.5], fov: 50 },
  'human-scale': { kind: 'persp', pos: [-9, 1.6, -2.5], target: [-1.4, 1.7, -4.5], fov: 50 },
  'cab-entry': { kind: 'walk', feet: [-2.15, 0.915, -6.0], yaw: -Math.PI / 2, pitch: 0.05 },
  'cab-inside': { kind: 'walk', feet: [0.25, B5.footplateH.v, -5.4], yaw: Math.PI, pitch: -0.12 },
};
