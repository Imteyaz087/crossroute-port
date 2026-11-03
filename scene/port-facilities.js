import * as THREE from 'three';
import {block, beam, merged} from './port-cranes.js';
import {rng, windowsTexture, windowsEmissive} from './port-textures.js';

// Gate, shore-power bays and cold store at the schematic layout positions.
// Original procedural forms; signage uses the demo's own name only.
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const std = (color, roughness, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({color, roughness, metalness, ...extra});
function canvasTexture(w, h, paint, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const stripes = (a, b) => canvasTexture(256, 32, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b; for (let x = -h; x < w; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); } });
const sign = (text, sub, w = 1024, h = 128) => canvasTexture(w, h, (g) => {
  g.fillStyle = '#121210'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2ead8'; g.textBaseline = 'middle';
  g.font = `800 ${h * .46}px ${FONT}`; g.fillText(text, h * .32, h * .42);
  if (sub) { g.fillStyle = '#d9a441'; g.font = `600 ${h * .2}px ${FONT}`; g.fillText(sub, h * .34, h * .82); }
  g.fillStyle = '#10b981'; g.fillRect(w - h * .3, h * .25, h * .12, h * .5);
});
const plane = (w, h, mat) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);

export function buildGate(lamps, pools) {
  const root = new THREE.Group(), steel = [], dark = [], concrete = [], z = 10;
  for (const x of [18.3, 24, 29.7]) {
    block(steel, [x, 2.7, z], [.55, 5.4, .55]);
    block(concrete, [x, .14, z], [1.1, .28, 7.4]);
    block(dark, [x + .45, 4.6, z - 1.6], [.35, .3, .6]); // plate-reader housings
    block(dark, [x + .45, 4.6, z + 1.6], [.35, .3, .6]);
  }
  block(steel, [24, 5.55, z], [12.9, .5, 4.4]);
  block(dark, [24, 5.85, z], [12.6, .12, 4.1]);
  root.add(merged(steel, std(0x8f8b82, .5, .55)), merged(dark, std(0x262522, .6, .4)), merged(concrete, std(0xb9b5ab, .85)));
  const hazard = std(0xffffff, .55, .1, {map: stripes('#d9a441', '#1f1e1b')}); hazard.map.wrapS = THREE.RepeatWrapping; hazard.map.repeat.x = 6;
  for (const s of [-1, 1]) { const band = plane(12.9, .5, hazard); band.position.set(24, 5.55, z + s * 2.21); if (s < 0) band.rotation.y = Math.PI; root.add(band); }
  const signTex = sign('CROSSROUTE GATE', 'LANES 1–2 · DEMO TERMINAL');
  const board = plane(6, .75, new THREE.MeshStandardMaterial({map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: .9, roughness: .6}));
  board.position.set(24, 6.45, z + 2.2); root.add(board);
  const back = board.clone(); back.rotation.y = Math.PI; back.position.z = z - 2.2; root.add(back);
  for (const x of [19.6, 22.6, 25.4, 28.4]) for (const dz of [-1.2, 1.2]) lamps.push([x, 5.22, z + dz]);
  // Lane barriers: striped booms, one raised, plus lane signals.
  const boomMat = std(0xffffff, .5, .1, {map: stripes('#c8402a', '#efe9dc')}); boomMat.map.wrapS = THREE.RepeatWrapping; boomMat.map.repeat.x = 3;
  for (const [x, raised] of [[18.75, false], [24.45, true]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(.4, 1.2, .4), std(0xd9a441, .5, .2)); post.position.set(x, .88, z + 3.2); root.add(post);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(4.9, .14, .14).translate(2.45, 0, 0), boomMat);
    boom.position.set(x, 1.32, z + 3.2); boom.rotation.z = raised ? 1.35 : 0; boom.castShadow = true; root.add(boom);
    const signal = new THREE.Mesh(new THREE.BoxGeometry(.22, .22, .08), new THREE.MeshStandardMaterial({color: raised ? 0x10b981 : 0xff1a5c, emissive: raised ? 0x10b981 : 0xff1a5c, emissiveIntensity: 2.4}));
    signal.position.set(x, 1.62, z + 3.2); root.add(signal);
  }
  // Gate booth with lit windows, replacing the plain kiosk block.
  const booth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.6), new THREE.MeshStandardMaterial({map: windowsTexture(), emissiveMap: windowsEmissive(), emissive: 0xffffff, emissiveIntensity: 1.2, roughness: .6}));
  booth.position.set(31, 1.4, 12); booth.castShadow = true; root.add(booth);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(3.4, .25, 3.4), std(0x262522, .6, .4)); cap.position.set(31, 2.85, 12); root.add(cap);
  pools.push([21.2, z, 6], [26.9, z, 6]);
  return root;
}

export function buildShorePower(lamps, pools) {
  const root = new THREE.Group(), xs = [4, 8.5, 13];
  const bay = canvasTexture(256, 448, (g, w, h) => {
    g.fillStyle = '#2b2c28'; g.fillRect(0, 0, w, h);
    const r = rng(4); for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(255,250,240,${r() * .05})`; g.fillRect(r() * w, r() * h, 2, 2); }
    g.strokeStyle = '#10b981'; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#10b981'; g.beginPath(); g.moveTo(140, 120); g.lineTo(100, 210); g.lineTo(132, 210); g.lineTo(112, 300); g.lineTo(168, 190); g.lineTo(134, 190); g.lineTo(160, 120); g.closePath(); g.fill();
    g.fillStyle = '#e8e2d2'; g.font = `700 30px ${FONT}`; g.textAlign = 'center'; g.fillText('SHORE POWER', w / 2, 370); g.font = `500 18px ${FONT}`; g.fillText('10 kW ASSUMPTION', w / 2, 400);
  });
  const padMat = std(0xffffff, .8, 0, {map: bay});
  const shell = [], dark = [], amber = [];
  for (const x of xs) {
    const pad = plane(3.7, 6.4, padMat); pad.rotation.x = -Math.PI / 2; pad.position.set(x, .075, 14); pad.receiveShadow = true; root.add(pad);
    block(shell, [x, 1, 18], [.85, 2, .6]); block(dark, [x, 2.05, 18], [1, .1, .75]); block(dark, [x, .1, 18], [1.1, .2, .8]);
    for (const dx of [-.75, .75]) { const b = new THREE.CylinderGeometry(.11, .11, .9, 10); b.translate(x + dx, .45, 17.2); amber.push(b); }
    const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x - .2, 1.1, 17.68), new THREE.Vector3(x - .45, .3, 17.2), new THREE.Vector3(x - .3, .06, 16.4), new THREE.Vector3(x, .06, 15.9)]), 16, .05, 6);
    dark.push(cable);
  }
  root.add(merged(shell, std(0xd8d4c8, .45, .15)), merged(dark, std(0x232320, .6, .3)), merged(amber, std(0xd9a441, .5, .2)));
  const screen = new THREE.MeshStandardMaterial({color: 0x0d1a14, emissive: 0x10b981, emissiveIntensity: 1.4, roughness: .3});
  for (const x of xs) { const s = plane(.5, .32, screen); s.position.set(x, 1.45, 17.69); s.rotation.y = Math.PI; root.add(s); }
  pools.push([8.5, 15.5, 8]);
  return root;
}

export function buildColdHub(lamps, pools) {
  const root = new THREE.Group(), cx = -24, front = 17.5;
  const cladding = canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#cbc7bc'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(255,250,240,.12)'; g.fillRect(x, 0, 6, h); g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(x + 10, 0, 4, h); }
    const grd = g.createLinearGradient(0, h * .75, 0, h); grd.addColorStop(0, 'rgba(40,30,20,0)'); grd.addColorStop(1, 'rgba(40,30,20,.3)'); g.fillStyle = grd; g.fillRect(0, h * .75, w, h * .25);
  });
  cladding.wrapS = THREE.RepeatWrapping; cladding.repeat.x = 6;
  const body = new THREE.Mesh(new THREE.BoxGeometry(23, 7, 7), std(0xffffff, .62, .25, {map: cladding})); body.position.set(cx, 3.6, 21); body.castShadow = body.receiveShadow = true; root.add(body);
  const dark = [], grey = [], fans = [];
  block(dark, [cx, 7.3, 21], [23.6, .4, 7.6]); block(dark, [cx, .55, front - .05], [23.2, 1.1, .12]);
  for (const x of [-32, -27.5, -23, -18.5, -14]) {
    block(grey, [x, 7.95, 21], [2.4, 1.1, 1.8]);
    const fan = new THREE.CylinderGeometry(.6, .6, .06, 18); fan.translate(x, 8.53, 21); fans.push(fan);
  }
  // Dock doors: sectional panels inside dark shelters, a lamp and bumpers each.
  const doorTex = canvasTexture(128, 160, (g, w, h) => { g.fillStyle = '#d7d2c4'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, w, 3); } g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(w * .4, h * .5, w * .2, 6); });
  const doorMat = std(0xffffff, .5, .3, {map: doorTex});
  for (const x of [-31, -26.5, -22, -17.5]) {
    const door = plane(3, 3.8, doorMat); door.position.set(x, 2.3, front + .02); root.add(door);
    block(dark, [x - 1.7, 2.3, front + .25], [.4, 4.4, .5]); block(dark, [x + 1.7, 2.3, front + .25], [.4, 4.4, .5]); block(dark, [x, 4.45, front + .25], [3.8, .5, .5]);
    for (const dx of [-1.1, 1.1]) block(dark, [x + dx, 1.25, front + .2], [.3, .4, .4]);
    lamps.push([x, 4.9, front + .5]);
  }
  root.add(merged(dark, std(0x232320, .7, .2)), merged(grey, std(0x8a877e, .55, .4)), merged(fans, std(0x1a1a18, .6, .5)));
  const hubTex = sign('CROSSROUTE COLD HUB', 'ILLUSTRATIVE FACILITY · NOT AN OPERATING SITE');
  const signMat = new THREE.MeshStandardMaterial({map: hubTex, emissiveMap: hubTex, emissive: 0xffffff, emissiveIntensity: .9, roughness: .6});
  const board = plane(9.5, 1.2, signMat); board.position.set(cx, 6.1, front + .03); root.add(board);
  pools.push([cx, 15.5, 10]);
  return root;
}

// Painted CrossRoute livery for the hero reefer's long sides (transparent decal).
export function reeferDecalTexture() {
  return canvasTexture(2048, 480, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#1d2a22'; g.font = `800 150px ${FONT}`; g.textBaseline = 'middle'; g.fillText('CROSSROUTE', 120, h * .42);
    g.fillStyle = '#3d4a42'; g.font = `600 52px ${FONT}`; g.fillText('COLD CHAIN · ILLUSTRATIVE DIGITAL TWIN', 128, h * .66);
    g.fillStyle = '#10b981'; g.fillRect(0, h - 46, w, 18); g.fillStyle = '#d9a441'; g.fillRect(0, h - 22, w, 8);
    g.fillStyle = '#2b2a27'; g.font = `600 30px ${FONT}`; g.fillText('ZCRU 104231 6   45R1', 128, 60);
  });
}
