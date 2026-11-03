import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {block} from './port-cranes.js';
import {BOX, containerGeometry, containerMaterial} from './port-textures.js';

// Generic drayage tractors on a looping illustrative route; not tracked vehicles.
export const TRAILER_DECK = 1.35, BOX_OFFSET = -1.8;
const CAB_COLORS = [0x2f302d, 0x9a3b22, 0xd9d4c8, 0x3c4a33, 0xb8862f];

export function fleetKit() {
  const chassis = [], wheels = [], lights = [], tails = [], glass = [];
  block(chassis, [-1.9, 1.15, 0], [12.4, .3, 1.1]);
  for (const s of [-1, 1]) block(chassis, [-1.9, 1.15, s * 1.05], [12.4, .2, .14]);
  block(chassis, [4.4, .95, 0], [5.4, .32, 1]);
  block(chassis, [3.4, 1.18, 0], [1.4, .16, 1.4]);
  for (const x of [-7.3, -6.1, 3, 4.2, 6.6]) for (const s of [-1, 1]) {
    const w = new THREE.CylinderGeometry(.52, .52, .48, 16); w.rotateX(Math.PI / 2); w.translate(x, .52, s * 1.02); wheels.push(w);
  }
  block(glass, [7.92, 3.1, 0], [.06, 1, 2.1]);
  for (const s of [-1, 1]) { block(lights, [7.96, 1.45, s * .95], [.06, .22, .4]); block(tails, [-8.12, 1.2, s * 1], [.06, .16, .32]); }
  const cabGeo = new THREE.BoxGeometry(2.4, 2.7, 2.45); cabGeo.translate(6.7, 2.55, 0);
  const deflector = new THREE.BoxGeometry(1.6, .5, 2.2); deflector.translate(6.4, 4.1, 0);
  return {
    chassis: mergeGeometries(chassis),
    wheels: mergeGeometries(wheels),
    glass: mergeGeometries(glass),
    lights: mergeGeometries(lights),
    tails: mergeGeometries(tails),
    cab: cabGeo, deflector,
    mats: {
      chassis: new THREE.MeshStandardMaterial({color: 0x2b2c29, roughness: .65, metalness: .45}),
      tyre: new THREE.MeshStandardMaterial({color: 0x191a18, roughness: .9}),
      glass: new THREE.MeshStandardMaterial({color: 0x1c1f1c, roughness: .12, metalness: .6}),
      head: new THREE.MeshStandardMaterial({color: 0xfff1d6, emissive: 0xfff1d6, emissiveIntensity: 3}),
      tail: new THREE.MeshStandardMaterial({color: 0xb5402c, emissive: 0xd0442a, emissiveIntensity: 2.2}),
      cabs: CAB_COLORS.map(c => new THREE.MeshPhysicalMaterial({color: c, roughness: .38, metalness: .2, clearcoat: .6})),
    },
    box40: containerGeometry(BOX.l40),
  };
}

export function makeTruck(kit, cabIndex, livery = null) {
  const g = new THREE.Group(), add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  add(kit.chassis, kit.mats.chassis); add(kit.wheels, kit.mats.tyre); add(kit.glass, kit.mats.glass);
  add(kit.cab, kit.mats.cabs[cabIndex % kit.mats.cabs.length]); add(kit.deflector, kit.mats.cabs[cabIndex % kit.mats.cabs.length]);
  add(kit.lights, kit.mats.head); add(kit.tails, kit.mats.tail);
  if (livery !== null) { const b = add(kit.box40, containerMaterial(livery, BOX.l40)); b.position.set(BOX_OFFSET, TRAILER_DECK + BOX.h / 2, 0); }
  return g;
}

// Rounded rectangle loop: eastbound on the road, westbound on the apron lane.
export function loopPath({xW = -34, xE = 34, zE = 2.7, zW = -9, r = 4.5} = {}) {
  const v = (x, z) => new THREE.Vector3(x, 0, z), p = new THREE.CurvePath();
  const line = (a, b) => p.add(new THREE.LineCurve3(a, b)), turn = (a, c, b) => p.add(new THREE.QuadraticBezierCurve3(a, c, b));
  line(v(xW + r, zE), v(xE - r, zE)); turn(v(xE - r, zE), v(xE, zE), v(xE, zE - r));
  line(v(xE, zE - r), v(xE, zW + r)); turn(v(xE, zW + r), v(xE, zW), v(xE - r, zW));
  line(v(xE - r, zW), v(xW + r, zW)); turn(v(xW + r, zW), v(xW, zW), v(xW, zW + r));
  line(v(xW, zW + r), v(xW, zE - r)); turn(v(xW, zE - r), v(xW, zE), v(xW + r, zE));
  return p;
}

export function buildFleet(kit) {
  const root = new THREE.Group(), path = loopPath(), length = path.getLength();
  const trucks = [[0, 1], [3, 4], [2, null]].map(([cab, liv], i) => ({mesh: makeTruck(kit, cab, liv), offset: i / 3}));
  trucks.forEach(t => root.add(t.mesh));
  const p = new THREE.Vector3(), d = new THREE.Vector3();
  return {root, update(time, reduced) {
    for (const t of trucks) {
      const u = ((reduced ? 0 : time * 5.5 / length) + t.offset) % 1;
      path.getPointAt(u, p); path.getTangentAt(u, d);
      t.mesh.position.set(p.x, 0, p.z); t.mesh.rotation.y = Math.atan2(-d.z, d.x);
    }
  }};
}
