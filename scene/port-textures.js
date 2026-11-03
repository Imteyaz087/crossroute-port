import * as THREE from 'three';
// Procedural artwork generated once at startup: no image downloads.
// Every brand and vessel name here is invented for this demo.
export const BOX = Object.freeze({h: 2.59, w: 2.44, l40: 12.19, l20: 6.06});
// Zero-blue liveries: warm oxides, ochres, greens and neutrals only.
export const LIVERIES = Object.freeze([
  {id: 'crossroute', base: '#e2dfd5', ink: '#1d2a22', brand: 'CROSSROUTE', sub: 'COLD CHAIN · REEFER', code: 'ZCRU 104231 6', reefer: true},
  {id: 'halcyon', base: '#9a3a28', ink: '#efe6d6', brand: 'HALCYON', code: 'ZHLU 552190 4'},
  {id: 'northwind', base: '#3f5a3c', ink: '#ece5d4', brand: 'NORTHWIND', code: 'ZNWU 781442 0'},
  {id: 'ochre', base: '#b8862f', ink: '#2a211a', brand: 'TALLOWAY', code: 'ZTLU 330918 2'},
  {id: 'oriole', base: '#b5562a', ink: '#f1e8d8', brand: 'ORIOLE', code: 'ZORU 615077 9'},
  {id: 'solenne', base: '#8d8a82', ink: '#1f1f1d', brand: 'SOLENNE', code: 'ZSLU 209633 1'},
  {id: 'pelorus', base: '#6e2b28', ink: '#e8dccb', brand: 'PELORUS', code: 'ZPLU 448020 7'},
  {id: 'verdant', base: '#1f6e52', ink: '#eae4d4', brand: 'VERDANT', code: 'ZVDU 903314 5'},
  {id: 'brass', base: '#cfc8b8', ink: '#5a2c1e', brand: 'BRASSWORKS', code: 'ZBWU 127756 3'},
  {id: 'charcoal', base: '#3a3835', ink: '#d9a441', brand: 'KESTREL', code: 'ZKSU 670281 8'},
]);
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const texture = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

// Atlas: long side = top half, door end = bottom-left quarter, roof = bottom-right.
const REGION = {side: [0, .5, 1, 1], end: [0, 0, .25, .5], roof: [.25, 0, 1, .5]};
const FACE_REGION = ['end', 'end', 'roof', 'roof', 'side', 'side']; // BoxGeometry order: +x -x +y -y +z -z
export function containerGeometry(length) {
  const g = new THREE.BoxGeometry(length, BOX.h, BOX.w), uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const [u0, v0, u1, v1] = REGION[FACE_REGION[f]];
    for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  }
  return g;
}

function paintSide(g, liv, length, rand, bump) {
  const W = 1024, H = 256, ribs = Math.round(length / (liv.reefer ? .5 : .28)), pitch = W / ribs;
  if (!bump) { g.fillStyle = liv.base; g.fillRect(0, 0, W, H); } else { g.fillStyle = '#808080'; g.fillRect(0, 0, W, H); }
  for (let i = 0; i < ribs; i++) {
    const x = i * pitch;
    g.fillStyle = bump ? '#b0b0b0' : 'rgba(255,248,235,.08)'; g.fillRect(x, 0, pitch * .42, H);
    g.fillStyle = bump ? '#505050' : 'rgba(0,0,0,.13)'; g.fillRect(x + pitch * .62, 0, pitch * .26, H);
  }
  g.fillStyle = bump ? '#d0d0d0' : 'rgba(0,0,0,.28)';
  g.fillRect(0, 0, W, 12); g.fillRect(0, H - 14, W, 14); g.fillRect(0, 0, 16, H); g.fillRect(W - 16, 0, 16, H);
  if (bump) return;
  // Weathering: rust runs from the top rail, grime at the base, a few scuffs.
  for (let i = 0; i < 46; i++) {
    const x = rand() * W, len = 20 + rand() * 120;
    const grd = g.createLinearGradient(0, 12, 0, 12 + len);
    grd.addColorStop(0, `rgba(96,48,22,${.25 + rand() * .3})`); grd.addColorStop(1, 'rgba(96,48,22,0)');
    g.fillStyle = grd; g.fillRect(x, 12, 1 + rand() * 3, len);
  }
  const base = g.createLinearGradient(0, H * .7, 0, H);
  base.addColorStop(0, 'rgba(36,26,16,0)'); base.addColorStop(1, 'rgba(36,26,16,.42)');
  g.fillStyle = base; g.fillRect(0, H * .7, W, H * .3);
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${rand() > .5 ? '255,250,240' : '30,22,14'},${.05 + rand() * .1})`; g.fillRect(rand() * W, rand() * H, 4 + rand() * 30, 2 + rand() * 10); }
  // Brand lettering, pre-squeezed so it reads at the container's real proportions.
  const sx = (W / H) / (length / BOX.h);
  g.save(); g.translate(W / 2, H * .5); g.scale(sx, 1);
  let size = liv.sub ? 84 : 104; g.font = `800 ${size}px ${FONT}`;
  while (g.measureText(liv.brand).width * sx > W * .78) { size -= 4; g.font = `800 ${size}px ${FONT}`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = liv.ink; g.globalAlpha = .9;
  g.fillText(liv.brand, 0, liv.sub ? -16 : 4);
  if (liv.sub) { g.font = `600 ${Math.round(size * .32)}px ${FONT}`; g.fillText(liv.sub, 0, size * .5 + 4); }
  g.restore(); g.globalAlpha = 1;
  // Paint wear over the lettering.
  for (let i = 0; i < 220; i++) { g.fillStyle = liv.base; g.globalAlpha = .35 + rand() * .5; g.fillRect(W * .15 + rand() * W * .7, H * .2 + rand() * H * .6, 1 + rand() * 3, 1 + rand() * 2); }
  g.globalAlpha = 1; g.fillStyle = liv.ink; g.font = `600 20px ${FONT}`; g.textAlign = 'left';
  g.save(); g.translate(26, 34); g.scale(sx, 1); g.fillText(liv.code, 0, 0); g.fillText(liv.reefer ? '45R1' : length > 10 ? '45G1' : '22G1', 0, 24); g.restore();
}
function paintEnd(g, liv, rand, bump) {
  const x0 = 0, y0 = 256, S = 256;
  g.fillStyle = bump ? '#808080' : liv.base; g.fillRect(x0, y0, S, S);
  g.fillStyle = bump ? '#c8c8c8' : 'rgba(0,0,0,.3)';
  g.fillRect(x0, y0, S, 10); g.fillRect(x0, y0 + S - 12, S, 12); g.fillRect(x0, y0, 12, S); g.fillRect(x0 + S - 12, y0, 12, S); g.fillRect(x0 + S / 2 - 2, y0, 4, S);
  for (let i = 1; i < 9; i++) { g.fillStyle = bump ? (i % 2 ? '#a0a0a0' : '#606060') : (i % 2 ? 'rgba(255,248,235,.06)' : 'rgba(0,0,0,.08)'); g.fillRect(x0 + 12, y0 + i * 27, S - 24, 12); }
  for (const f of [.2, .38, .62, .8]) {
    g.fillStyle = bump ? '#ffffff' : '#9a968c'; g.fillRect(x0 + S * f - 3, y0 + 14, 6, S - 28);
    g.fillStyle = bump ? '#e0e0e0' : '#57534c'; g.fillRect(x0 + S * f - 8, y0 + S * .55, 16, 7);
  }
  if (bump) return;
  g.fillStyle = liv.ink; g.font = `600 13px ${FONT}`; g.fillText(liv.code, x0 + S * .54, y0 + 30);
  const grd = g.createLinearGradient(0, y0 + S * .7, 0, y0 + S); grd.addColorStop(0, 'rgba(36,26,16,0)'); grd.addColorStop(1, 'rgba(36,26,16,.45)');
  g.fillStyle = grd; g.fillRect(x0, y0 + S * .7, S, S * .3);
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(96,48,22,${.2 + rand() * .3})`; g.fillRect(x0 + rand() * S, y0 + 10, 2, 20 + rand() * 60); }
}
function paintRoof(g, liv, length, rand, bump) {
  const x0 = 256, y0 = 256, W = 768, H = 256, n = Math.round(length / .45);
  g.fillStyle = bump ? '#808080' : liv.base; g.fillRect(x0, y0, W, H);
  for (let i = 0; i < n; i++) { g.fillStyle = bump ? '#a8a8a8' : 'rgba(255,248,235,.07)'; g.fillRect(x0 + i * W / n, y0, W / n * .45, H); }
  if (bump) return;
  for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(30,22,14,${.08 + rand() * .14})`; g.beginPath(); g.ellipse(x0 + rand() * W, y0 + rand() * H, 10 + rand() * 60, 6 + rand() * 30, 0, 0, Math.PI * 2); g.fill(); }
}

const cache = new Map();
export function containerMaterial(liveryIndex, length) {
  const key = `${liveryIndex}:${length}`;
  if (cache.has(key)) return cache.get(key);
  const liv = LIVERIES[liveryIndex], seed = liveryIndex * 97 + Math.round(length);
  const [c, g] = canvas(1024, 512), [b, bg] = canvas(1024, 512);
  for (const [ctx, bump] of [[g, false], [bg, true]]) {
    const rand = rng(seed);
    paintSide(ctx, liv, length, rand, bump); paintEnd(ctx, liv, rand, bump); paintRoof(ctx, liv, length, rand, bump);
  }
  const m = new THREE.MeshStandardMaterial({map: texture(c), bumpMap: texture(b, false), bumpScale: 1.6, roughness: liv.reefer ? .42 : .64, metalness: liv.reefer ? .2 : .32});
  m.name = `container:${liv.id}`;
  cache.set(key, m);
  return m;
}
export function disposeContainerCache() { for (const m of cache.values()) { m.map.dispose(); m.bumpMap.dispose(); m.dispose(); } cache.clear(); }

export function asphaltTexture() {
  const [c, g] = canvas(512, 512), rand = rng(7);
  g.fillStyle = '#3b3a37'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const v = 40 + rand() * 40 | 0; g.fillStyle = `rgba(${v + 6},${v + 4},${v},${.25 + rand() * .4})`; g.fillRect(rand() * 512, rand() * 512, 1 + rand() * 2, 1 + rand() * 2); }
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(14,13,12,${.12 + rand() * .2})`; g.beginPath(); g.ellipse(rand() * 512, rand() * 512, 20 + rand() * 80, 10 + rand() * 40, rand() * 3, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = 'rgba(16,15,14,.5)'; g.lineWidth = 1.2;
  for (let i = 0; i < 10; i++) { g.beginPath(); let x = rand() * 512, y = rand() * 512; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (rand() - .5) * 40; y += (rand() - .5) * 40; g.lineTo(x, y); } g.stroke(); }
  const t = texture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// Soft radial falloff for floodlight pools, lamp halos and water glints.
export function glowTexture() {
  const [c, g] = canvas(128, 128), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.35, 'rgba(255,255,255,.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128); return texture(c);
}
export function streakTexture() {
  const [c, g] = canvas(32, 256), grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(.25, 'rgba(255,255,255,.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 256);
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 32, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h; g.fillRect(0, 0, 32, 256); return texture(c);
}
// Accommodation block: warm lit and dark windows on off-white steel.
export function windowsTexture() {
  const [c, g] = canvas(256, 256), rand = rng(31);
  g.fillStyle = '#d7d2c6'; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 7; r++) for (let k = 0; k < 9; k++) {
    const lit = rand() > .45; g.fillStyle = lit ? '#f4d79a' : '#2a2925'; g.fillRect(10 + k * 27, 14 + r * 34, 17, 14);
  }
  return texture(c);
}
export function windowsEmissive() {
  const [c, g] = canvas(256, 256), rand = rng(31);
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 7; r++) for (let k = 0; k < 9; k++) { if (rand() > .45) { g.fillStyle = '#ffcf7a'; g.fillRect(10 + k * 27, 14 + r * 34, 17, 14); } }
  return texture(c);
}
export function hullNameTexture(name) {
  const [c, g] = canvas(1024, 128);
  g.clearRect(0, 0, 1024, 128); g.fillStyle = '#e6e0d2'; g.font = `700 78px ${FONT}`; g.textBaseline = 'middle'; g.fillText(name, 12, 66);
  return texture(c);
}
export function skyTexture() {
  const [c, g] = canvas(4, 256), grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#060606'); grd.addColorStop(.42, '#0d0c0b'); grd.addColorStop(.5, '#2a2219'); grd.addColorStop(.56, '#120f0d'); grd.addColorStop(1, '#070706');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256); return texture(c);
}
