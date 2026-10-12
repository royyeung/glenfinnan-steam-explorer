// Fixed camera positions used by screenshots, the verification harness and GX.view(name).
// World frame: +X east, +Y up, -Z grid north. The engine faces +Z with its LEFT side towards +X.
// The test-site platform is on the RIGHT (-X) side.
// Engine origin (d = 6.20 m behind the front buffer) is at the world origin.
import { B5, ENGINE_ORIGIN_D } from '../specs/black5.ts';

// frame 'world' (Phase 5): Glenfinnan scene coordinates (x east, z south, y above OS datum); agl: the
// camera height is above the ground there. Views without a frame are in the straight train frame and
// follow the train wherever it stands.
type Frame = { frame?: 'world'; agl?: boolean };
export type View =
  | ({ kind: 'persp'; pos: [number, number, number]; target: [number, number, number]; fov: number } & Frame)
  | ({ kind: 'ortho'; dir: 'left' | 'right' | 'front' | 'top'; centre: [number, number, number]; pxPerM: number } & Frame)
  | ({ kind: 'walk'; feet: [number, number, number]; yaw: number; pitch: number } & Frame);

const front = ENGINE_ORIGIN_D;                     // world z of the front buffer face
const tail = front - B5.lengthOverBuffers.v;       // world z of the tender rear buffer face
const mid = (front + tail) / 2;

export const VIEWS: Record<string, View> = {
  'left-elev': { kind: 'ortho', dir: 'left', centre: [0, 2.0, mid], pxPerM: 80 },
  'right-elev': { kind: 'ortho', dir: 'right', centre: [0, 2.0, mid], pxPerM: 80 },
  'front-end': { kind: 'ortho', dir: 'front', centre: [0, 2.0, 0], pxPerM: 160 },
  'plan': { kind: 'ortho', dir: 'top', centre: [0, 0, mid], pxPerM: 60 }, // 1320 x 300 px = 22 m x 5 m
  'front-34-l': { kind: 'persp', pos: [10.5, 2.4, 15.5], target: [0, 1.9, 0.5], fov: 45 },
  'rear-34-r': { kind: 'persp', pos: [-9.5, 3.4, -26], target: [0, 1.9, -9], fov: 45 },
  'motion-l': { kind: 'persp', pos: [5.2, 1.25, 1.2], target: [0.9, 0.95, 0.6], fov: 50 },
  'site-wide': { kind: 'persp', pos: [32, 11, 34], target: [0, 2.4, -3.5], fov: 50 },
  'human-scale': { kind: 'persp', pos: [-9, 1.6, -2.5], target: [-1.4, 1.7, -4.5], fov: 50 },
  'front-34-r': { kind: 'persp', pos: [-9.5, 2.3, 14.5], target: [0, 1.9, 0.5], fov: 45 },
  'motion-r': { kind: 'persp', pos: [-5.2, 1.3, 0.6], target: [-0.9, 1.0, 0.2], fov: 50 },
  'gear-l': { kind: 'persp', pos: [3.6, 1.45, 1.9], target: [1.0, 1.2, 0.7], fov: 45 },
  'smokebox': { kind: 'persp', pos: [2.4, 2.9, 9.6], target: [0, 2.3, 4.7], fov: 40 },
  'cab-side-l': { kind: 'persp', pos: [5.2, 2.6, -4.4], target: [1.2, 2.4, -4.6], fov: 45 },
  'tender-rear': { kind: 'persp', pos: [-4.5, 2.2, -21.5], target: [0, 1.6, -13], fov: 45 },
  'cab-driver': { kind: 'walk', feet: [0.78, B5.footplateH.v, -5.05], yaw: Math.PI + 0.22, pitch: -0.08 },
  'cab-fireman': { kind: 'walk', feet: [-0.55, B5.footplateH.v, -4.95], yaw: Math.PI - 0.35, pitch: -0.18 },
  'backhead': { kind: 'walk', feet: [0.0, B5.footplateH.v, -5.45], yaw: Math.PI, pitch: 0.02 },
  'firehole': { kind: 'walk', feet: [-0.05, B5.footplateH.v, -4.75], yaw: Math.PI, pitch: -0.62 }, // crouched-eye view down into the open firehole
  'tender-front': { kind: 'walk', feet: [0.0, B5.footplateH.v, -4.75], yaw: 0, pitch: -0.25 },
  'train-wide': { kind: 'persp', pos: [-38, 14, -40], target: [0, 1.5, -55], fov: 50 },
  // coaches (centres at z -23.25 - 20.117 i): 5487 Mk2B, 5453 Mk2B, 5419 Mk2A, 99318 Mk1 buffet, 5229/5239 first
  'coach-ext': { kind: 'persp', pos: [-9.0, 2.0, -18], target: [-1.2, 2.0, -26], fov: 50 },
  'mk2b-door': { kind: 'persp', pos: [-5.2, 1.9, -9.6], target: [-1.4, 1.9, -15.6], fov: 50 },
  'coach-door': { kind: 'walk', feet: [-2.3, 0.915, -64.08], yaw: -Math.PI / 2, pitch: 0.0 },
  'coach-aisle': { kind: 'walk', feet: [0.0, 1.27, -56.43], yaw: 0, pitch: -0.05 },
  'coach-seat': { kind: 'walk', feet: [0.55, 1.27, -59.83], yaw: Math.PI / 2 + 0.35, pitch: -0.2 },
  'coach-vestibule': { kind: 'walk', feet: [0.3, 1.27, -63.53], yaw: -Math.PI / 2, pitch: 0.0 },
  'gangway': { kind: 'walk', feet: [0.0, 1.27, -70.73], yaw: 0, pitch: 0.0 },
  'coach-bogie': { kind: 'persp', pos: [-4.2, 0.9, -13.6], target: [-1.0, 0.6, -16.4], fov: 45 },
  'mk1-mk2': { kind: 'persp', pos: [-6.5, 2.3, -66], target: [-1.3, 2.0, -80], fov: 50 },
  'buffet-ext': { kind: 'persp', pos: [-8.5, 1.6, -80], target: [-1.2, 1.8, -88], fov: 50 },
  'buffet-int': { kind: 'walk', feet: [0.3, 1.27, -85.6], yaw: 0.08, pitch: -0.12 },
  'buffet-shop': { kind: 'walk', feet: [0.95, 1.27, -89.0], yaw: Math.PI / 2 - 0.55, pitch: -0.12 },
  'buffet-counter': { kind: 'walk', feet: [0.95, 1.27, -91.4], yaw: Math.PI / 2 + 0.35, pitch: -0.2 },
  'first-ext': { kind: 'persp', pos: [-4.6, 2.3, -118.5], target: [-1.3, 2.3, -123.5], fov: 50 },
  'first-int': { kind: 'walk', feet: [-0.22, 1.27, -116.6], yaw: 0, pitch: -0.1 },
  'first-seat': { kind: 'persp', pos: [-1.0, 2.42, -119.75], target: [0.7, 2.0, -118.2], fov: 60 },          // seated in a single armchair
  'cab-entry': { kind: 'walk', feet: [-2.15, 0.915, -6.0], yaw: -Math.PI / 2, pitch: 0.05 },
  // Phase 5 landscape (world frame). V01: the camera position of the 2019 Commons photo "Train on
  // Glenfinnan viaduct" (56.875283 N, 5.436089 W), its 4:3 frame is 51 degrees tall
  'v01-classic': { kind: 'persp', frame: 'world', pos: [-226, 63, 74], target: [-10, 34, -42], fov: 51 },   // the knoll is missing from the 50 m data: camera held at its estimated height
  'v01-photo-gps': { kind: 'persp', frame: 'world', pos: [-290, 1.6, 51], agl: true, target: [10, 39, -38], fov: 51 },
  'v01-2014': { kind: 'persp', frame: 'world', pos: [-283, 1.6, 31], agl: true, target: [20, 40, -45], fov: 46 },
  'viaduct-river': { kind: 'persp', frame: 'world', pos: [-52, 1.7, 26], agl: true, target: [10, 26, -40], fov: 70 },
  'loch-head': { kind: 'persp', frame: 'world', pos: [-330, 3.0, 690], agl: true, target: [0, 40, -40], fov: 50 },
  'aerial': { kind: 'persp', frame: 'world', pos: [-1500, 520, 1900], target: [-150, 40, 0], fov: 50 },
  'glen-north': { kind: 'persp', frame: 'world', pos: [180, 60, -620], agl: true, target: [-250, 20, 500], fov: 55 },
  'cab-inside': { kind: 'walk', feet: [0.25, B5.footplateH.v, -5.4], yaw: Math.PI, pitch: -0.12 },
};
