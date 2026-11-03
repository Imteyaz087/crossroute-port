import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BOX} from './port-textures.js';

// Schematic lattice machinery, merged into a few draw calls. Not an equipment model.
const UP = new THREE.Vector3(0, 1, 0);
export function beam(list, a, b, t = .3, d = t) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), len = dir.length();
  const g = new THREE.BoxGeometry(t, len, d);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  list.push(g);
}
export const block = (list, p, s) => { const g = new THREE.BoxGeometry(...s); g.translate(...p); list.push(g); };
export const merged = (list, material) => { const m = new THREE.Mesh(mergeGeometries(list), material); m.castShadow = m.receiveShadow = true; list.forEach(g => g.dispose()); return m; };

export const STS = Object.freeze({seaLeg: -22, landLeg: -14, boomTip: -47, backreach: -6, boomY: 15.6, trolleyY: 15.2, lane: -18, shipRow: -33.1});
const smooth = k => k * k * (3 - 2 * k);

// Static steel for one ship-to-shore crane, written into shared geometry lists.
export function stsStructure(cx, lists) {
  const {steel, dark, cable, house, lamps} = lists, S = STS;
  for (const lx of [cx - 3, cx + 3]) for (const z of [S.seaLeg, S.landLeg]) {
    beam(steel, [lx, .9, z], [lx, 15.2, z], .9);
    block(dark, [lx, .55, z], [1.6, 1.1, 3.2]);
    for (const dz of [-1.1, 1.1]) block(dark, [lx, .45, z + dz], [1.9, .7, .7]);
  }
  for (const z of [S.seaLeg, S.landLeg]) {
    beam(steel, [cx - 3, 15.2, z], [cx + 3, 15.2, z], .9);
    beam(steel, [cx - 3, 2.4, z], [cx + 3, 13.6, z], .35);
    beam(steel, [cx + 3, 2.4, z], [cx - 3, 13.6, z], .35);
    beam(steel, [cx - 3, 6, z], [cx + 3, 6, z], .45);
  }
  for (const lx of [cx - 3, cx + 3]) {
    beam(steel, [lx, 15.2, S.seaLeg], [lx, 15.2, S.landLeg], .8);
    beam(steel, [lx, 15.2, S.seaLeg], [lx, 27, -17], .6);
    beam(steel, [lx, 15.2, S.landLeg], [lx, 27, -17], .6);
    beam(cable, [lx, 27, -17], [cx + Math.sign(lx - cx) * 1.6, 17.4, S.boomTip + 1], .12);
    beam(cable, [lx, 27, -17], [cx + Math.sign(lx - cx) * 1.6, 17.4, -33], .12);
    beam(cable, [lx, 27, -17], [cx + Math.sign(lx - cx) * 1.6, 17.4, S.backreach - .5], .12);
  }
  beam(steel, [cx - 3, 27, -17], [cx + 3, 27, -17], .55);
  beam(steel, [cx - 3, 22, -17.6], [cx + 3, 22, -17.6], .35);
  // Twin lattice girders: chords, verticals and alternating diagonals.
  const z0 = S.boomTip, z1 = S.backreach, top = S.boomY + 1.8;
  for (const gx of [cx - 1.6, cx + 1.6]) {
    beam(steel, [gx, S.boomY, z0], [gx, S.boomY, z1], .5);
    beam(steel, [gx, top, z0 + 1.5], [gx, top, z1], .45);
    beam(steel, [gx, S.boomY, z0], [gx, top, z0 + 1.5], .3);
    for (let z = z0 + 1.5, k = 0; z < z1 - .5; z += 2.5, k++) {
      beam(steel, [gx, S.boomY, z], [gx, top, z], .16);
      beam(steel, k % 2 ? [gx, S.boomY, z] : [gx, top, z], k % 2 ? [gx, top, z + 2.5] : [gx, S.boomY, z + 2.5], .14);
    }
    for (let z = z0 + 3; z < z1; z += 6) lamps.push([gx, S.boomY - .35, z]);
  }
  for (let z = z0 + 1.5; z < z1; z += 5) { beam(steel, [cx - 1.6, top, z], [cx + 1.6, top, z], .18); beam(dark, [cx - 1.6, S.boomY - .2, z], [cx + 1.6, S.boomY - .2, z], .12); }
  // Machinery house on the backreach and a boom-tip hood.
  block(house, [cx, top + 1.3, -9.5], [3.8, 2.4, 5.2]);
  block(dark, [cx, top + .05, -9.5], [5, .2, 7]);
  block(house, [cx, top + .4, z0 + 1.2], [3.6, .8, 1.4]);
  for (const lx of [cx - 3.2, cx + 3.2]) lamps.push([lx, 14.6, S.lane]);
}

// Moving trolley, ropes and spreader for one crane, plus its dual-cycle motion.
export function stsRig(cx, {shipY, truckY, phase = 0, materials}) {
  const g = new THREE.Group(), {dark, house, spreader: spreaderMat, glass, cable} = materials;
  const trolley = new THREE.Group(); g.add(trolley);
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, .9, 3.2), dark); body.castShadow = true; trolley.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.7, 2), house); cab.position.set(2.3, -1.3, 0); cab.castShadow = true; trolley.add(cab);
  const pane = new THREE.Mesh(new THREE.BoxGeometry(1.84, .8, 1.6), glass); pane.position.set(2.3, -1.25, .22); trolley.add(pane);
  const ropeGeo = [];
  for (const dx of [-.9, .9]) for (const dz of [-.6, .6]) block(ropeGeo, [dx * 3, -.5, dz], [.05, 1, .05]);
  const ropes = merged(ropeGeo, cable); ropes.castShadow = false; g.add(ropes);
  const sp = new THREE.Group(); g.add(sp);
  const spGeo = [];
  for (const dz of [-1.1, 1.1]) block(spGeo, [0, .2, dz], [BOX.l40, .32, .22]);
  for (const dx of [-6, -3, 0, 3, 6]) block(spGeo, [dx, .2, 0], [.22, .28, 2.44]);
  block(spGeo, [0, .55, 0], [3.2, .5, 1.6]);
  const spMesh = merged(spGeo, spreaderMat); sp.add(spMesh);
  const lockGeo = [];
  for (const dx of [-6, 6]) for (const dz of [-1.1, 1.1]) block(lockGeo, [dx, -.05, dz], [.35, .3, .35]);
  sp.add(merged(lockGeo, dark));
  const H = BOX.h, hi = 11.2 + H, {shipRow: pick, lane: drop} = STS;
  const yS = shipY + H, yT = truckY + H;
  // [time, trolley z, spreader-bottom y]; container rides between attach/detach.
  const keys = [[0, pick, yS], [1.5, pick, yS], [5, pick, hi], [10, drop, hi], [13.5, drop, yT], [15.5, drop, yT], [18, drop, yT + 4], [22, drop, yT + 4], [24.5, drop, yT], [25.5, drop, yT], [29, drop, hi], [34, pick, hi], [37.5, pick, yS], [39, pick, yS], [41.5, pick, yS + 3], [43.5, pick, yS + 3], [46, pick, yS]];
  const T = 46, carried = t => (t >= 1.5 && t < 15.5) || (t >= 25.5 && t < 39), onTruck = t => t >= 15.5 && t < 25.5;
  function at(t) {
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, z0, y0] = keys[i - 1], [t1, z1, y1] = keys[i], k = smooth((t - t0) / Math.max(1e-6, t1 - t0)); return [z0 + (z1 - z0) * k, y0 + (y1 - y0) * k]; }
    return [keys[0][1], keys[0][2]];
  }
  let box = null;
  return {
    group: g,
    attach(mesh) { box = mesh; },
    update(time, reduced) {
      const t = reduced ? 8 : ((time + phase) % T + T) % T, [z, y] = at(t), sway = reduced ? 0 : Math.sin(time * 1.3 + phase) * .06;
      trolley.position.set(cx, STS.trolleyY, z);
      sp.position.set(cx, y, z + sway);
      const len = STS.trolleyY - .45 - (y + .7);
      ropes.position.set(cx, STS.trolleyY - .45, z); ropes.scale.set(1, Math.max(.1, len), 1);
      if (box) {
        if (carried(t)) box.position.set(cx, y - H / 2, z + sway);
        else box.position.set(cx, (onTruck(t) ? truckY : shipY) + H / 2, onTruck(t) ? drop : pick);
      }
    },
  };
}

// Rubber-tyred yard gantry straddling container rows; its trolley drifts slowly.
export function rtg(cx, z0, z1, lists) {
  const {paint, dark, stripe, lamps} = lists, top = 13.4;
  for (const z of [z0, z1]) {
    for (const lx of [cx - 3.6, cx + 3.6]) {
      beam(paint, [lx, 1.4, z], [lx, top, z], .7);
      for (const dx of [-.7, .7]) block(dark, [lx + dx, .55, z], [.6, 1.1, .7]);
    }
    beam(paint, [cx - 3.6, 1.2, z], [cx + 3.6, 1.2, z], .6, .8);
    beam(paint, [cx - 3.6, top, z], [cx + 3.6, top, z], .8);
    beam(paint, [cx - 3.6, 3, z], [cx + 3.6, 11.5, z], .25);
  }
  for (const lx of [cx - 3.6, cx + 3.6]) { beam(paint, [lx, top + .3, z0], [lx, top + .3, z1], 1.1); block(stripe, [lx, top + .9, (z0 + z1) / 2], [1.12, .14, Math.abs(z1 - z0)]); lamps.push([lx, top - .5, (z0 + z1) / 2]); }
  block(dark, [cx + 4.6, 3.2, z0 + 1.5], [1.4, 2.4, 2.6]);
}
export function rtgRig(cx, z0, z1, materials, phase = 0) {
  const g = new THREE.Group(), {dark, spreader: spreaderMat, cable} = materials;
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(7.4, .9, 2.6), dark); trolley.castShadow = true; g.add(trolley);
  const ropes = new THREE.Mesh(new THREE.BoxGeometry(.05, 1, 2.2), cable); g.add(ropes);
  const sp = new THREE.Mesh(new THREE.BoxGeometry(BOX.l40, .3, 2.44), spreaderMat); sp.castShadow = true; g.add(sp);
  const spanMid = (z0 + z1) / 2, span = Math.abs(z1 - z0) / 2 - 2;
  return {group: g, update(time, reduced) {
    const z = spanMid + (reduced ? 0 : Math.sin(time * .12 + phase)) * span, y = 9.6 + (reduced ? 0 : Math.sin(time * .21 + phase) * 1.2);
    trolley.position.set(cx, 13.4 + .9, z); sp.position.set(cx, y, z);
    const len = 13.4 - y; ropes.position.set(cx, y + len / 2, z); ropes.scale.set(1, len, 1);
  }};
}
