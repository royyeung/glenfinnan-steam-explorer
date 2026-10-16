// Paints the livery decals with canvas drawings (no copied artwork): cab numbers, BR "lion and
// wheel" emblem (simplified), arched nameplate with a simplified crest, headboard, smokebox
// numberplate and shed plate. Assigned by material name to the decal panels in the models.
import * as THREE from 'three';

const CREAM = '#e8ddb5', BR_RED = '#a3241a', GOLD = '#d9b24c', PLATE_BLUE = '#1f4f9e';
const FONT = '"Gill Sans", "Gill Sans MT", "Gill Sans Nova", Calibri, "Segoe UI", "Trebuchet MS", sans-serif';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return { c, g: c.getContext('2d')! };
}

function cabNumber() {
  const { c, g } = canvas(1024, 534); // panel 1.15 x 0.60 m; numerals about 0.26 m tall as on S33
  g.fillStyle = CREAM; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `600 66px ${FONT}`; g.fillText('5MT', 512, 150);
  g.font = `600 300px ${FONT}`; g.fillText('45407', 512, 420);
  return c;
}

/** Simplified BR early emblem: lion over a spoked wheel with a "BRITISH RAILWAYS" bar. */
function emblem(mirror: boolean) {
  const { c, g } = canvas(660, 600);
  const cx = 330, cy = 390, R = 150;
  g.save();
  // wheel
  g.fillStyle = BR_RED; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.strokeStyle = GOLD; g.lineWidth = 18; g.beginPath(); g.arc(cx, cy, R - 9, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 7; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (R - 16), cy + Math.sin(a) * (R - 16)); g.stroke(); }
  g.fillStyle = GOLD; g.beginPath(); g.arc(cx, cy, 22, 0, Math.PI * 2); g.fill();
  // lettering bar
  g.fillStyle = '#111'; g.fillRect(cx - 230, cy - 34, 460, 68);
  g.strokeStyle = CREAM; g.lineWidth = 5; g.strokeRect(cx - 230, cy - 34, 460, 68);
  g.fillStyle = CREAM; g.font = `600 44px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BRITISH RAILWAYS', cx, cy + 2);
  g.restore();
  // lion standing on the wheel, facing the front of the engine (canvas right; mirrored for the left side)
  g.save();
  if (mirror) { g.translate(660, 0); g.scale(-1, 1); }
  g.fillStyle = GOLD; g.strokeStyle = '#8a6a1c'; g.lineWidth = 4;
  g.beginPath();
  g.moveTo(190, 240); g.bezierCurveTo(210, 190, 330, 185, 400, 200);        // back
  g.bezierCurveTo(430, 150, 470, 120, 500, 130);                            // neck to mane
  g.bezierCurveTo(545, 110, 575, 150, 560, 185);                            // head top
  g.bezierCurveTo(585, 200, 575, 225, 545, 222);                            // muzzle
  g.bezierCurveTo(520, 240, 470, 240, 455, 255);                            // jaw to chest
  g.lineTo(470, 300); g.lineTo(445, 302); g.lineTo(430, 262);               // front leg
  g.bezierCurveTo(380, 270, 300, 270, 260, 262);                            // belly
  g.lineTo(255, 300); g.lineTo(230, 302); g.lineTo(225, 255);               // hind leg
  g.bezierCurveTo(200, 250, 185, 248, 190, 240);
  g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(195, 238); g.bezierCurveTo(130, 220, 120, 150, 165, 130); g.bezierCurveTo(150, 165, 160, 205, 205, 222); g.closePath(); g.fill(); g.stroke(); // tail
  g.fillStyle = '#5a3e0c'; g.beginPath(); g.arc(535, 165, 6, 0, Math.PI * 2); g.fill();
  g.restore();
  return c;
}

/** Arched nameplate: black ground, polished border and raised letters following the arch. */
function nameplate() {
  const { c, g } = canvas(1170, 300), text = 'THE LANCASHIRE FUSILIER';
  const cx = 585, cy = 1600, rOut = 1580, rIn = 1440;
  const a0 = Math.asin(560 / rOut);
  g.beginPath(); g.arc(cx, cy, rOut, -Math.PI / 2 - a0, -Math.PI / 2 + a0); g.arc(cx, cy, rIn, -Math.PI / 2 + a0 * 0.99, -Math.PI / 2 - a0 * 0.99, true); g.closePath();
  g.fillStyle = '#121212'; g.fill(); g.lineWidth = 14; g.strokeStyle = GOLD; g.stroke();
  g.fillStyle = GOLD; g.font = `700 92px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const rText = (rOut + rIn) / 2, span = a0 * 1.62;
  for (let i = 0; i < text.length; i++) {
    const a = -Math.PI / 2 - span / 2 + (span * (i + 0.5)) / text.length;
    g.save(); g.translate(cx + Math.cos(a) * rText, cy + Math.sin(a) * rText); g.rotate(a + Math.PI / 2); g.fillText(text[i], 0, 0); g.restore();
  }
  return c;
}

/** Simplified regimental crest (not a reproduction of the badge): red roundel, gold grenade and flame. */
function crest() {
  const { c, g } = canvas(200, 240);
  g.fillStyle = BR_RED; g.beginPath(); g.ellipse(100, 135, 80, 95, 0, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.strokeStyle = GOLD; g.stroke();
  g.fillStyle = GOLD; g.beginPath(); g.arc(100, 160, 38, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(80, 128); g.quadraticCurveTo(100, 40, 120, 128); g.closePath(); g.fill();
  return c;
}

function headboard() {
  const { c, g } = canvas(950, 320);
  g.fillStyle = PLATE_BLUE; g.strokeStyle = '#f2f2ee'; g.lineWidth = 12;
  g.beginPath(); g.moveTo(20, 300); g.lineTo(20, 120); g.quadraticCurveTo(475, -40, 930, 120); g.lineTo(930, 300); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#f2f2ee'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 64px ${FONT}`; g.fillText('THE', 475, 105);
  g.font = `700 140px ${FONT}`; g.fillText('JACOBITE', 475, 225);
  return c;
}

function numberplate() {
  const { c, g } = canvas(540, 130);
  g.fillStyle = PLATE_BLUE; g.fillRect(0, 0, 540, 130);
  g.strokeStyle = '#e9e9e4'; g.lineWidth = 8; g.strokeRect(8, 8, 524, 114);
  g.fillStyle = '#f2f2ee'; g.font = `700 104px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('45407', 270, 70);
  return c;
}

function shedplate() {
  const { c, g } = canvas(256, 170);
  g.fillStyle = PLATE_BLUE; g.beginPath(); g.ellipse(128, 85, 122, 80, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#e9e9e4'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#f2f2ee'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 70px ${FONT}`; g.fillText('65J', 128, 68);
  g.font = `600 34px ${FONT}`; g.fillText('SC', 128, 128);
  return c;
}

/** Gauge dial: 270° sweep from bottom-left (0) clockwise to bottom-right (max). */
function dial(title: string, max: number, major: number, minor: number, unit: string, redFrom?: number) {
  const { c, g } = canvas(512, 512), cx = 256, cy = 256, R = 236;
  g.fillStyle = '#f3ecd9'; g.beginPath(); g.arc(cx, cy, R + 14, 0, Math.PI * 2); g.fill();
  const ang = (v: number) => ((-135 + 270 * (v / max)) * Math.PI) / 180 - Math.PI / 2;
  if (redFrom !== undefined) { g.strokeStyle = '#b3261e'; g.lineWidth = 18; g.beginPath(); g.arc(cx, cy, R - 26, ang(redFrom), ang(max)); g.stroke(); }
  g.strokeStyle = '#141414'; g.fillStyle = '#141414'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let v = 0; v <= max + 1e-6; v += minor) {
    const a = ang(v), big = Math.abs(v / major - Math.round(v / major)) < 1e-6, r0 = big ? R - 46 : R - 30;
    g.lineWidth = big ? 6 : 3; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8)); g.stroke();
    if (big) { g.font = `600 40px ${FONT}`; g.fillText(String(Math.round(v)), cx + Math.cos(a) * (R - 82), cy + Math.sin(a) * (R - 82)); }
  }
  g.font = `600 34px ${FONT}`; g.fillText(title, cx, cy + 92);
  g.font = `500 26px ${FONT}`; g.fillText(unit, cx, cy + 132);
  g.beginPath(); g.arc(cx, cy, 16, 0, Math.PI * 2); g.fill();
  return c;
}

function waterPlate() {
  const { c, g } = canvas(160, 280);
  g.fillStyle = '#1c1c1c'; g.fillRect(0, 0, 160, 280); g.strokeStyle = '#cfc8b4'; g.lineWidth = 6; g.strokeRect(6, 6, 148, 268);
  g.fillStyle = '#e8e2cf'; g.textAlign = 'center'; g.font = `700 34px ${FONT}`;
  g.fillText('OPEN', 80, 60); g.fillText('WATER', 80, 145); g.fillText('SHUT', 80, 230);
  g.beginPath(); g.moveTo(80, 82); g.lineTo(70, 100); g.lineTo(90, 100); g.fill();
  g.beginPath(); g.moveTo(80, 198); g.lineTo(70, 180); g.lineTo(90, 180); g.fill();
  return c;
}

function fireBed() {
  // a bright bed of burning coal: yellow-white where hottest (centre-back), orange elsewhere,
  // individual lumps outlined by darker red seams and a few dull spots at the edges
  const { c, g } = canvas(256, 256);
  const gr = g.createRadialGradient(128, 60, 8, 128, 110, 200);
  gr.addColorStop(0, '#fff4c8'); gr.addColorStop(0.3, '#ffc24a'); gr.addColorStop(0.65, '#ff8a1c'); gr.addColorStop(1, '#c2400c');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  g.lineWidth = 2.2;
  for (let i = 0; i < 140; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 7 + rnd() * 13;
    g.strokeStyle = `rgba(${150 + rnd() * 60},${30 + rnd() * 30},0,0.7)`;
    g.beginPath(); g.ellipse(x, y, r, r * 0.75, rnd() * 3, 0, Math.PI * 2); g.stroke();
  }
  for (let i = 0; i < 18; i++) {
    const x = rnd() * 256, y = 150 + rnd() * 106, r = 5 + rnd() * 9;
    g.fillStyle = `rgba(${90 + rnd() * 40},${20 + rnd() * 15},0,0.55)`;
    g.beginPath(); g.ellipse(x, y, r, r * 0.7, rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  return c;
}

function cutoffScale() {
  const { c, g } = canvas(96, 416);
  g.fillStyle = '#c9a85a'; g.fillRect(0, 0, 96, 416); g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.font = `700 24px ${FONT}`;
  g.fillText('FORE', 48, 26); g.fillText('MID', 48, 212); g.fillText('BACK', 48, 400);
  for (let i = 0; i <= 14; i++) { const y = 48 + i * 23; g.fillRect(i % 7 === 0 ? 14 : 30, y, i % 7 === 0 ? 68 : 36, 3); }
  return c;
}

function seatFabric() {
  // blue moquette with a turquoise check (S40)
  const { c, g } = canvas(128, 128);
  g.fillStyle = '#1d3170'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? 'rgba(70,170,200,0.55)' : 'rgba(40,90,170,0.5)'; g.fillRect(i * 16, 0, 5, 128); g.fillRect(0, i * 16, 128, 5); }
  return c;
}

function westCoast() {
  const { c, g } = canvas(500, 200);
  g.fillStyle = GOLD; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `600 64px ${FONT}`;
  g.fillText('WEST', 250, 62); g.fillText('COAST', 250, 140);
  return c;
}

/** Class 47 bodyside lettering: "WEST COAST" with "RAILWAYS" between two rules beneath (S64). */
function westCoastLoco() {
  const { c, g } = canvas(760, 192);
  g.fillStyle = GOLD; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 96px ${FONT}`; g.fillText('WEST COAST', 380, 70);
  g.font = `600 40px ${FONT}`; g.fillText('RAILWAYS', 380, 152);
  g.fillRect(70, 148, 180, 6); g.fillRect(510, 148, 180, 6);
  return c;
}

function coachNumberCanvas(num: string) {
  const { c, g } = canvas(620, 200);
  g.fillStyle = GOLD; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 150px ${FONT}`; g.fillText(num, 310, 104);
  return c;
}

/** Shop shelves in the buffet coach: rows of generic goods (no real products or brands). */
function goods() {
  const { c, g } = canvas(1024, 256);
  g.fillStyle = '#3a2618'; g.fillRect(0, 0, 1024, 256);
  const cols = ['#b8322a', '#1f4f9e', '#2f6b3a', '#d9b24c', '#e8ddb5', '#6a2a5a', '#ffffff', '#202020', '#c8702a'];
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const [y0, y1] of [[8, 80], [92, 164], [176, 248]]) {
    let x = 4;
    while (x < 1018) {
      const kind = rnd(), wd = kind < 0.3 ? 18 + rnd() * 14 : kind < 0.6 ? 34 + rnd() * 30 : 22 + rnd() * 10;
      const ht = (y1 - y0) * (kind < 0.3 ? 0.9 : kind < 0.6 ? 0.55 + rnd() * 0.3 : 0.45);
      g.fillStyle = cols[Math.floor(rnd() * cols.length)];
      if (kind >= 0.6) { g.beginPath(); g.ellipse(x + wd / 2, y1 - ht / 2, wd / 2, ht / 2, 0, 0, Math.PI * 2); g.fill(); } // mugs and tins
      else g.fillRect(x, y1 - ht, wd, ht);                                                                     // books, boxes, tea towels
      if (kind < 0.6) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 2, y1 - ht + 4, wd - 4, 3); }
      x += wd + 2 + rnd() * 3;
    }
  }
  return c;
}

function buffetSign() {
  const { c, g } = canvas(450, 120);
  g.fillStyle = '#5a1416'; g.fillRect(0, 0, 450, 120);
  g.strokeStyle = GOLD; g.lineWidth = 4; g.strokeRect(6, 6, 438, 108);
  g.fillStyle = CREAM; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `600 52px ${FONT}`; g.fillText('BUFFET  ·  SHOP', 225, 62);
  return c;
}

/** First-class armchair fabric: gold damask on navy, half-drop repeat (a generic pattern after S52/S53). */
function damask() {
  const { c, g } = canvas(256, 256), GOLDD = '#cdbb8a', NAVY = '#20203a';
  g.fillStyle = NAVY; g.fillRect(0, 0, 256, 256);
  const motif = (cx: number, cy: number, s: number) => {
    g.save(); g.translate(cx, cy); g.scale(s / 100, s / 100);
    g.fillStyle = GOLDD; g.strokeStyle = GOLDD; g.lineCap = 'round';
    // ogee frame
    g.lineWidth = 5; g.beginPath(); g.moveTo(0, -48);
    g.bezierCurveTo(22, -36, 34, -14, 30, 4); g.bezierCurveTo(27, 22, 12, 34, 0, 48);
    g.bezierCurveTo(-12, 34, -27, 22, -30, 4); g.bezierCurveTo(-34, -14, -22, -36, 0, -48); g.stroke();
    // palmette: a fan of leaves rising from a small cup
    for (let k = -2; k <= 2; k++) { g.save(); g.translate(0, 18); g.rotate(k * 0.42); g.beginPath(); g.ellipse(0, -18, 5.5 - Math.abs(k), 17 - 2 * Math.abs(k), 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    g.beginPath(); g.moveTo(-10, 18); g.quadraticCurveTo(0, 32, 10, 18); g.closePath(); g.fill();
    g.fillRect(-1.5, 28, 3, 12);
    // scrolls and sprigs outside the frame, top and sides
    for (const k of [1, -1]) {
      g.lineWidth = 3.5; g.beginPath(); g.arc(k * 40, -30, 9, 0, Math.PI * 1.5); g.stroke();
      g.beginPath(); g.arc(k * 40, 30, 9, Math.PI * 0.5, Math.PI * 2); g.stroke();
      g.beginPath(); g.ellipse(k * 46, 0, 4, 10, k * 0.3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(k * 12, -56, 3.5, 8, k * 0.8, 0, Math.PI * 2); g.fill();
    }
    g.beginPath(); g.arc(0, -58, 4.5, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  for (const [x, y] of [[128, 128], [0, 0], [256, 0], [0, 256], [256, 256]]) motif(x, y, 118);
  return c;
}

/** Black-and-white tartan with grey bands (curtains and lamp shades, S52/S53); generic sett. */
function tartan() {
  const { c, g } = canvas(256, 256);
  g.fillStyle = '#ecebe6'; g.fillRect(0, 0, 256, 256);
  const sett: [number, number, string][] = [[0, 46, '#151515'], [58, 8, '#151515'], [76, 30, '#8c8c8a'], [118, 4, '#151515'], [140, 46, '#151515'], [200, 24, '#8c8c8a'], [236, 6, '#151515']];
  g.globalAlpha = 0.62;
  for (const [p, w, col] of sett) { g.fillStyle = col; g.fillRect(p, 0, w, 256); }
  for (const [p, w, col] of sett) { g.fillStyle = col; g.fillRect(0, p, 256, w); }
  g.globalAlpha = 0.12; g.fillStyle = '#000';                                          // twill diagonal
  for (let i = -256; i < 256; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.lineTo(i + 257, 256); g.lineTo(i + 1, 0); g.fill(); }
  g.globalAlpha = 1;
  return c;
}

function firstClassCover() {
  const { c, g } = canvas(256, 128);
  g.fillStyle = '#f3f1ec'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#7d1f2c'; g.lineWidth = 5; g.strokeRect(3, 3, 250, 122);
  g.fillStyle = '#9a2433'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '500 34px Georgia, "Times New Roman", serif';
  g.fillText('FIRST CLASS', 128, 70);
  return c;
}

function carpetFirst() {
  const { c, g } = canvas(128, 128);
  g.fillStyle = '#1c2148'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < 128; x += 16) { g.fillStyle = '#8f8a6a'; g.fillRect(x + 6, y + 6, 3, 3); }
  return c;
}

/** Seat-direction labels: "F" (facing forward) on the left half, "B" (backward) on the right half. */
function seatDir() {
  const { c, g } = canvas(128, 64);
  for (const [i, ch] of [[0, 'F'], [1, 'B']] as const) {
    g.fillStyle = '#f4f4f0'; g.fillRect(i * 64, 0, 64, 64); g.strokeStyle = '#222'; g.lineWidth = 3; g.strokeRect(i * 64 + 3, 3, 58, 58);
    g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 44px ${FONT}`; g.fillText(ch, i * 64 + 32, 35);
  }
  return c;
}

function buffetLabel() {
  const { c, g } = canvas(500, 120);
  g.fillStyle = GOLD; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `600 84px ${FONT}`; g.fillText('BUFFET', 250, 64);
  return c;
}

function coachLetterCanvas(letter: string) {
  const { c, g } = canvas(128, 128);
  g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(6, 6, 116, 116);
  g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 92px ${FONT}`; g.fillText(letter, 64, 70);
  return c;
}

/** Each coach carries its own letter card in the end windows. */
export function paintCoachLetter(root: THREE.Object3D, letter: string, anisotropy: number) {
  const t = new THREE.CanvasTexture(coachLetterCanvas(letter)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy;
  root.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.name === 'decal_coachletter') { m.map = t; m.needsUpdate = true; } });
}

/** Each coach carries its own running number (materials are per coach). */
export function paintCoachNumber(root: THREE.Object3D, num: string, anisotropy: number) {
  const t = new THREE.CanvasTexture(coachNumberCanvas(num)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy;
  root.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.name === 'decal_coachnum') { m.map = t; m.needsUpdate = true; } });
}

const PAINTERS: Record<string, () => HTMLCanvasElement> = {
  decal_seatfabric: seatFabric, decal_westcoast: westCoast, decal_coachnum: () => coachNumberCanvas(''),
  decal_goods: goods, decal_buffetsign: buffetSign, decal_coachletter: () => coachLetterCanvas(''),
  decal_damask: damask, decal_firstclass: firstClassCover, decal_carpetfc: carpetFirst, decal_seatdir: seatDir, decal_buffetlabel: buffetLabel, decal_wcr47: westCoastLoco,
  curtain: tartan, lamp_shade: tartan,
  decal_gauge_pressure: () => dial('BOILER', 300, 50, 10, 'LBS PER SQ IN', 225),
  decal_gauge_vacuum: () => dial('VACUUM', 30, 5, 1, 'INS. OF MERCURY'),
  decal_gauge_air: () => dial('AIR', 150, 25, 5, 'LBS PER SQ IN'),
  decal_gauge_heat: () => dial('CARRIAGE WARMING', 100, 20, 5, 'LBS PER SQ IN'),
  decal_waterplate: waterPlate, decal_fire: fireBed, decal_cutoff: cutoffScale,
  decal_cabnum: cabNumber, decal_emblem: () => emblem(false), decal_emblem_l: () => emblem(true),
  decal_nameplate: nameplate, decal_crest: crest, decal_headboard: headboard,
  decal_numberplate: numberplate, decal_shedplate: shedplate,
};

/** Assign canvas textures to every decal material under root. */
export function paintDecals(root: THREE.Object3D, anisotropy: number) {
  const cache = new Map<string, THREE.Texture>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as THREE.MeshStandardMaterial;
    const paint = PAINTERS[m.name];
    if (!paint) return;
    let t = cache.get(m.name);
    if (!t) { t = new THREE.CanvasTexture(paint()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy; cache.set(m.name, t); }
    // glTF export keeps only base colour/roughness/metalness: restore the emissive part here
    if (m.name === 'decal_seatfabric') { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.5, 1.5); m.map = t; m.color.set(0xffffff); m.transparent = false; m.needsUpdate = true; return; }
    // tiled fabrics on UVs in metres (repeats per metre)
    const tile: Record<string, number> = { decal_damask: 5, curtain: 5, lamp_shade: 5, decal_carpetfc: 2 };
    if (tile[m.name]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(tile[m.name], tile[m.name]);
      m.map = t; m.color.set(0xffffff); m.transparent = false; m.side = m.name === 'curtain' || m.name === 'lamp_shade' ? THREE.DoubleSide : THREE.FrontSide;
      if (m.name === 'lamp_shade') m.emissiveMap = t;   // the lit shade glows through its own tartan
      m.needsUpdate = true; return;
    }
    if (m.name === 'decal_fire') { m.emissiveMap = t; m.emissive.set(0xffffff); m.map = null; m.color.set(0x000000); m.needsUpdate = true; return; }
    m.map = t; m.color.set(0xffffff);
    m.transparent = !['decal_numberplate', 'decal_nameplate', 'decal_waterplate', 'decal_cutoff', 'decal_goods', 'decal_buffetsign', 'decal_coachletter', 'decal_firstclass', 'decal_seatdir'].includes(m.name) && !m.name.startsWith('decal_gauge');
    m.alphaTest = m.transparent ? 0.02 : 0;
    m.depthWrite = !m.transparent;
    m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
    if (m.name === 'decal_nameplate') { m.transparent = true; m.alphaTest = 0.02; m.metalness = 0.55; m.roughness = 0.35; }
    m.needsUpdate = true;
  });
}
