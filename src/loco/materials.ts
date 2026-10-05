// Phase 1 blockout materials. Names are stable: the GLB keeps them and the runtime upgrades
// them (textures, weathering) by name in later phases.
import * as THREE from 'three';

export type MatKey =
  | 'paint_black' | 'smokebox' | 'paint_red' | 'steel' | 'wheel' | 'brass'
  | 'cab_inside' | 'coal' | 'blue_plate' | 'lining' | 'rubber' | 'glass';

export function blockoutMaterials(): Record<MatKey, THREE.MeshStandardMaterial> {
  const m = (name: MatKey, color: number, roughness: number, metalness: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    Object.assign(new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }), { name });
  return {
    paint_black: m('paint_black', 0x2a2a2b, 0.42, 0.0), // gloss black paint, albedo ~0.02 linear
    smokebox: m('smokebox', 0x262626, 0.82, 0.0),
    paint_red: m('paint_red', 0x9a1c12, 0.45, 0.0),
    steel: m('steel', 0xc4c6c8, 0.34, 1.0), // F0 ~0.55 linear (steel)
    wheel: m('wheel', 0x242424, 0.6, 0.0),
    brass: m('brass', 0xdcb66e, 0.32, 1.0), // F0 ~(0.72, 0.47, 0.16) linear
    cab_inside: m('cab_inside', 0xd9cdb4, 0.7, 0.0),
    coal: m('coal', 0x0b0b0b, 0.92, 0.0),
    blue_plate: m('blue_plate', 0x1d4fa0, 0.35, 0.0),
    lining: m('lining', 0xc9b98a, 0.5, 0.0),
    rubber: m('rubber', 0x1a1a1a, 0.9, 0.0),
    glass: m('glass', 0x9fb4c0, 0.05, 0.0, { transparent: true, opacity: 0.25 }),
  };
}
