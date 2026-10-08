// Phase 1 blockout materials. Names are stable: the GLB keeps them and the runtime upgrades
// them (textures, weathering) by name in later phases.
import * as THREE from 'three';

export type MatKey =
  | 'paint_black' | 'smokebox' | 'paint_red' | 'steel' | 'wheel' | 'brass'
  | 'cab_inside' | 'coal' | 'blue_plate' | 'lining' | 'lining_red' | 'rubber' | 'glass' | 'lamp_lens'
  | 'coach_maroon' | 'roof_black' | 'lining_gold' | 'underframe' | 'spring_red' | 'axle_yellow' | 'wood_panel' | 'ceiling' | 'carpet'
  | 'seat_vinyl' | 'decal_seatfabric' | 'table_top' | 'coach_light' | 'decal_coachnum' | 'decal_westcoast' | 'frosted' | 'cdl_light'
  | 'copper' | 'wood' | 'chequer' | 'water' | 'backhead'
  | 'decal_gauge_pressure' | 'decal_gauge_vacuum' | 'decal_gauge_air' | 'decal_gauge_heat' | 'decal_waterplate' | 'decal_fire' | 'decal_cutoff'
  | 'decal_cabnum' | 'decal_emblem' | 'decal_emblem_l' | 'decal_numberplate' | 'decal_shedplate' | 'decal_headboard' | 'decal_nameplate' | 'decal_crest';

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
    lining: m('lining', 0xd9cba0, 0.45, 0.0),       // BR cream lining
    lining_red: m('lining_red', 0xa3241a, 0.45, 0.0),  // BR red lining
    rubber: m('rubber', 0x1a1a1a, 0.9, 0.0),
    glass: m('glass', 0x9fb4c0, 0.05, 0.0, { transparent: true, opacity: 0.25 }),
    coach_maroon: m('coach_maroon', 0x5a1414, 0.38, 0.0),  // BR maroon (WCR)
    roof_black: m('roof_black', 0x1c1c1c, 0.75, 0.0),
    lining_gold: m('lining_gold', 0xd6b04a, 0.45, 0.0),
    underframe: m('underframe', 0x161616, 0.7, 0.0),
    spring_red: m('spring_red', 0xb0201a, 0.5, 0.0),
    axle_yellow: m('axle_yellow', 0xe0b21c, 0.5, 0.0),
    wood_panel: m('wood_panel', 0x5e3a22, 0.55, 0.0),    // wood-grain laminate between the windows
    ceiling: m('ceiling', 0xc9ccd0, 0.6, 0.0),
    carpet: m('carpet', 0x4a4644, 0.95, 0.0),
    seat_vinyl: m('seat_vinyl', 0x1f3f8c, 0.42, 0.0),     // blue vinyl backs (S40)
    decal_seatfabric: m('decal_seatfabric', 0xffffff, 0.9, 0.0),
    table_top: m('table_top', 0x2a2a2a, 0.4, 0.0),
    coach_light: m('coach_light', 0xf4f1e8, 0.4, 0.0, { emissive: 0xfff6e0, emissiveIntensity: 0 }),
    decal_coachnum: m('decal_coachnum', 0xffffff, 0.45, 0.0, { transparent: true }),
    decal_westcoast: m('decal_westcoast', 0xffffff, 0.45, 0.0, { transparent: true }),
    frosted: m('frosted', 0xdfe3e6, 0.6, 0.0, { transparent: true, opacity: 0.85 }),
    cdl_light: m('cdl_light', 0x3a2a10, 0.3, 0.0, { emissive: 0xffa020, emissiveIntensity: 0 }),
    copper: m('copper', 0xc07a52, 0.38, 1.0),            // copper pipework (grimy)
    wood: m('wood', 0x6b4a30, 0.75, 0.0),                // floorboards, seats, window frames
    chequer: m('chequer', 0x3a3b3c, 0.55, 0.8),          // chequer-plate floor
    water: m('water', 0x9fb7c4, 0.05, 0.0, { transparent: true, opacity: 0.55 }),
    backhead: m('backhead', 0x1d1d1e, 0.5, 0.0),         // black backhead (hot, oily)
    decal_gauge_pressure: m('decal_gauge_pressure', 0xffffff, 0.3, 0.0),
    decal_gauge_vacuum: m('decal_gauge_vacuum', 0xffffff, 0.3, 0.0),
    decal_gauge_air: m('decal_gauge_air', 0xffffff, 0.3, 0.0),
    decal_gauge_heat: m('decal_gauge_heat', 0xffffff, 0.3, 0.0),
    decal_waterplate: m('decal_waterplate', 0xffffff, 0.5, 0.3),
    decal_fire: m('decal_fire', 0x000000, 0.9, 0.0, { emissive: 0xffffff, emissiveIntensity: 1 }),
    decal_cutoff: m('decal_cutoff', 0xffffff, 0.45, 0.4),
    lamp_lens: m('lamp_lens', 0xfff4dc, 0.1, 0.0, { emissive: 0xfff1d0, emissiveIntensity: 0 }),
    // decals: plain placeholders here; the app paints canvas textures onto them by material name
    decal_cabnum: m('decal_cabnum', 0xffffff, 0.5, 0.0, { transparent: true }),
    decal_emblem: m('decal_emblem', 0xffffff, 0.45, 0.0, { transparent: true }),
    decal_emblem_l: m('decal_emblem_l', 0xffffff, 0.45, 0.0, { transparent: true }), // mirrored lion for the left side
    decal_numberplate: m('decal_numberplate', 0xffffff, 0.4, 0.0),
    decal_shedplate: m('decal_shedplate', 0xffffff, 0.4, 0.0, { transparent: true }),
    decal_headboard: m('decal_headboard', 0xffffff, 0.45, 0.0, { transparent: true }),
    decal_nameplate: m('decal_nameplate', 0xffffff, 0.35, 0.6),
    decal_crest: m('decal_crest', 0xffffff, 0.4, 0.2, { transparent: true }),
  };
}
