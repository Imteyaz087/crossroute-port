import * as THREE from 'three';
import {block, beam, merged} from './port-cranes.js';
import {BOX, rng, windowsTexture, windowsEmissive, hullNameTexture} from './port-textures.js';

// A schematic feeder vessel with an invented name; not a model of any real ship.
export const VESSEL = Object.freeze({name: 'KESTREL STRAIT', z: -37, deck: 1.6, hatch: 1.9, stern: -31.5, bowStart: 22, bow: 30, beam: 10});
export const BAYS = [[-17, 40], [-4, 40], [5.5, 20], [15, 40], [24.3, 20]];
export const ROWS = [-40.9, -38.3, -35.7, -33.1];

function hullShape() {
  const s = new THREE.Shape(), {stern, bowStart, bow, beam: B} = VESSEL, h = B / 2;
  s.moveTo(stern, -h + .6); s.quadraticCurveTo(stern, -h, stern + .8, -h);
  s.lineTo(bowStart, -h); s.quadraticCurveTo(bow - 1.5, -h + .5, bow, 0);
  s.quadraticCurveTo(bow - 1.5, h - .5, bowStart, h); s.lineTo(stern + .8, h);
  s.quadraticCurveTo(stern, h, stern, h - .6); s.closePath();
  return s;
}
const hullSlab = (y0, y1) => { const g = new THREE.ExtrudeGeometry(hullShape(), {depth: y1 - y0, bevelEnabled: false}); g.rotateX(-Math.PI / 2); g.translate(0, y0, VESSEL.z); return g; };

// Deterministic deck stow plan; hero slots are left empty for the animated boxes.
function stackHeights() {
  const rand = rng(11), out = new Map();
  for (const [x] of BAYS) for (const z of ROWS) out.set(`${x}:${z}`, 1 + Math.floor(rand() * (x > 20 ? 2 : x === -17 || x === 15 ? 3 : 4)));
  return out;
}
export function stowPlan(reserved) {
  const rand = rng(12), heights = stackHeights(), slots = [];
  for (const [x, len] of BAYS) for (const z of ROWS) for (let tier = 0; tier < heights.get(`${x}:${z}`); tier++) {
    if (reserved.has(`${x}:${z}:${tier}`)) break;
    slots.push({x, y: VESSEL.hatch + BOX.h / 2 + tier * BOX.h, z, len, livery: 1 + Math.floor(rand() * 9)});
  }
  return slots;
}
// Base height of the top tier of a stack (where an animated box rests), and its key.
export function heroSlot(x, z) {
  const tier = stackHeights().get(`${x}:${z}`) - 1;
  if (!(tier >= 0)) throw new Error('No such deck slot');
  return {y: VESSEL.hatch + tier * BOX.h, key: `${x}:${z}:${tier}`};
}

export function buildVessel(lamps) {
  const root = new THREE.Group(); root.name = 'Schematic vessel';
  const hullLow = new THREE.Mesh(hullSlab(-3, -.45), new THREE.MeshStandardMaterial({color: 0x6e2a20, roughness: .7, metalness: .25}));
  const hullHigh = new THREE.Mesh(hullSlab(-.45, VESSEL.deck), new THREE.MeshStandardMaterial({color: 0x2a2927, roughness: .55, metalness: .4}));
  for (const m of [hullLow, hullHigh]) { m.castShadow = m.receiveShadow = true; root.add(m); }
  const deckGeo = [], darkGeo = [];
  block(deckGeo, [-1, VESSEL.deck + .05, VESSEL.z], [52, .1, 9.4]);
  for (const [x, len] of BAYS) block(darkGeo, [x, (VESSEL.deck + VESSEL.hatch) / 2, VESSEL.z], [len + .4, VESSEL.hatch - VESSEL.deck, 9.8]);
  // Bulwark at the bow and lashing posts between bays.
  block(darkGeo, [26.5, VESSEL.deck + .6, VESSEL.z], [5, 1.2, 8.8]);
  for (const x of [-10.4, 0.8, 9.8, 21.6]) for (const z of [-41.6, -32.4]) block(darkGeo, [x, VESSEL.deck + 2, z], [.25, 4, .25]);
  root.add(merged(deckGeo, new THREE.MeshStandardMaterial({color: 0x6b6a62, roughness: .8})));
  root.add(merged(darkGeo, new THREE.MeshStandardMaterial({color: 0x3c3b37, roughness: .7, metalness: .3})));
  // Accommodation block with lit windows, bridge wings and funnel at the stern.
  const winMat = new THREE.MeshStandardMaterial({map: windowsTexture(), emissiveMap: windowsEmissive(), emissive: 0xffffff, emissiveIntensity: 1.6, roughness: .6});
  const accom = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 6.4), winMat);
  accom.position.set(-26, VESSEL.deck + 6, VESSEL.z); accom.castShadow = true; root.add(accom);
  const whiteGeo = [], funnelGeo = [];
  block(whiteGeo, [-25.6, VESSEL.deck + 12.6, VESSEL.z], [5, 1.2, 10.2]);
  block(whiteGeo, [-26, VESSEL.deck + 13.5, VESSEL.z], [4.4, .3, 6]);
  beam(whiteGeo, [-26.5, VESSEL.deck + 13.6, VESSEL.z], [-26.5, VESSEL.deck + 18, VESSEL.z], .2);
  block(funnelGeo, [-30, VESSEL.deck + 9, VESSEL.z], [2.4, 5, 2.8]);
  root.add(merged(whiteGeo, new THREE.MeshStandardMaterial({color: 0xd9d4c8, roughness: .5})));
  root.add(merged(funnelGeo, new THREE.MeshStandardMaterial({color: 0x26241f, roughness: .6})));
  const band = new THREE.Mesh(new THREE.BoxGeometry(2.45, .7, 2.85), new THREE.MeshStandardMaterial({color: 0xb5562a, roughness: .5}));
  band.position.set(-30, VESSEL.deck + 10.4, VESSEL.z); root.add(band);
  // Painted name on the quay-facing side of the hull.
  const name = new THREE.Mesh(new THREE.PlaneGeometry(16, 2), new THREE.MeshStandardMaterial({map: hullNameTexture(VESSEL.name), transparent: true, roughness: .6, depthWrite: false}));
  name.position.set(12, .55, VESSEL.z + VESSEL.beam / 2 + .03); root.add(name);
  // Deck, mast and navigation lights.
  lamps.push([-26.5, VESSEL.deck + 18.1, VESSEL.z], [-25.6, VESSEL.deck + 13.3, VESSEL.z + 5], [28.5, VESSEL.deck + 1.4, VESSEL.z]);
  for (const x of [-12, -1, 9, 19]) lamps.push([x, VESSEL.deck + .5, VESSEL.z + 4.6]);
  return root;
}
