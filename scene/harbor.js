import * as THREE from 'three';
import {harborLayout, ROUTE, ZONES} from './harbor-layout.js';
import {BOX, containerGeometry, containerMaterial, asphaltTexture, glowTexture, streakTexture, skyTexture, rng} from './port-textures.js';
import {stsStructure, stsRig, rtg, rtgRig, merged, beam, block, STS} from './port-cranes.js';
import {buildVessel, stowPlan, heroSlot} from './port-vessel.js';
import {fleetKit, makeTruck, buildFleet, TRAILER_DECK, BOX_OFFSET} from './port-fleet.js';
import {buildGate, buildShorePower, buildColdHub} from './port-facilities.js';

// The software renderer still draws harborLayout() boxes; the GPU path swaps these
// schematic stand-ins for detailed procedural models at the same positions.
const REPLACED = new Set(['terminal island', 'harbor water', 'ship hull', 'ship deck', 'bow', 'bridge', 'bridge glazing', 'mast', 'vessel container',
  'crane column', 'crane foot', 'crane crossbeam', 'crane outreach', 'crane top', 'hoist cable', 'spreader', 'yard container', 'light mast', 'luminaire',
  'gate gantry', 'gate post', 'gate kiosk', 'shore bay', 'power pedestal', 'power light', 'cold hub', 'hub roof', 'loading door']);
const CRANES = [{x: -17, livery: 0, phase: 0}, {x: 15, livery: 1, phase: 21}]; // west crane carries the CrossRoute reefer
const MASTS = [[-30, -12], [-1, -12], [29, -12], [-37, 5], [-9.5, 5], [17, 5], [37.5, -4], [-37, 19]];
const std = (color, roughness, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({color, roughness, metalness, ...extra});

function instanceBoxes(root, boxes) {
  const groups = new Map();
  for (const b of boxes) { if (!groups.has(b.color)) groups.set(b.color, []); groups.get(b.color).push(b); }
  const geometry = new THREE.BoxGeometry(1, 1, 1), o = new THREE.Object3D();
  for (const [color, list] of groups) {
    const mesh = new THREE.InstancedMesh(geometry, std(color, .76, .13), list.length);
    list.forEach((b, i) => { o.position.set(...b.p); o.scale.set(...b.s); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  }
}
// One InstancedMesh per livery and length; per-box brightness breaks up repetition.
function instanceContainers(root, slots) {
  const groups = new Map(), geos = new Map(), o = new THREE.Object3D(), c = new THREE.Color(), rand = rng(5);
  for (const s of slots) { const k = `${s.livery}:${s.len}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
  for (const [k, list] of groups) {
    const len = list[0].len === 20 ? BOX.l20 : BOX.l40;
    if (!geos.has(len)) geos.set(len, containerGeometry(len));
    const mesh = new THREE.InstancedMesh(geos.get(len), containerMaterial(list[0].livery, len), list.length);
    list.forEach((s, i) => { o.position.set(s.x, s.y, s.z); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); mesh.setColorAt(i, c.setScalar(.8 + rand() * .25)); });
    mesh.castShadow = mesh.receiveShadow = true; mesh.name = `containers:${k}`; root.add(mesh);
  }
}
function yardSlots() {
  const rand = rng(21), slots = [];
  for (const z of [7.4, 10, 12.6, 15.2]) {
    for (const x of [-27.5, -14.7]) for (let t = 0, n = 1 + Math.floor(rand() * 4); t < n; t++) slots.push({x, y: BOX.h / 2 + t * BOX.h, z, len: 40, livery: 1 + Math.floor(rand() * 9)});
    // 20ft empties sit in the east corner, clear of the Vehicle/Thermal camera lines.
    for (let t = 0, n = 1 + Math.floor(rand() * 3); t < n; t++) slots.push({x: 35.6, y: BOX.h / 2 + t * BOX.h, z: z + 5.4, len: 20, livery: 1 + Math.floor(rand() * 9)});
  }
  return slots;
}
// A dark coastal ridge with scattered lights, kept on a camera-centred band.
function ridgeTexture() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 128; const g = c.getContext('2d'), rand = rng(9);
  g.fillStyle = '#0c0b0a'; g.beginPath(); g.moveTo(0, 128); let y = 80;
  for (let x = 0; x <= 2048; x += 16) { y = Math.min(118, Math.max(38, y + (rand() - .5) * 18)); g.lineTo(x, y); }
  g.lineTo(2048, 128); g.closePath(); g.fill();
  for (let i = 0; i < 260; i++) { g.fillStyle = rand() > .2 ? `rgba(255,200,120,${.4 + rand() * .5})` : 'rgba(240,235,220,.7)'; g.fillRect(rand() * 2048, 104 + rand() * 22, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.x = 2; return t;
}

export function buildHarbor() {
  const root = new THREE.Group(); root.name = 'Illustrative terminal, not a geographic survey';
  const layout = harborLayout();
  instanceBoxes(root, layout.filter(b => !b.water && !REPLACED.has(b.name)));
  // Paved terminal island in place of the flat slab.
  const island = layout.find(b => b.name === 'terminal island'), asphalt = asphaltTexture();
  asphalt.repeat.set(island.s[0] / 7, island.s[2] / 7);
  const ground = new THREE.Mesh(new THREE.BoxGeometry(...island.s), std(0xc4c0b6, .72, .05, {map: asphalt}));
  ground.position.set(...island.p); ground.receiveShadow = true; root.add(ground);
  const marks = [];
  for (let x = -36; x <= 36; x += 6) for (const z of [-16.2, -7.4, -19.8, -10.6]) block(marks, [x, .03, z], [3, .02, .14]);
  root.add(merged(marks, std(0xc9a64a, .6)));

  // Cranes: shared steel lists merged into a handful of draw calls.
  const lamps = [], craneLists = {steel: [], dark: [], cable: [], house: [], lamps};
  CRANES.forEach(c => stsStructure(c.x, craneLists));
  const M = {
    steel: std(0xb4421f, .52, .35), dark: std(0x2b2a27, .6, .55), cable: std(0x77736a, .4, .8),
    house: std(0xd8d3c6, .5, .1), spreader: std(0xc9962e, .45, .4), glass: std(0x2a2620, .15, .5, {emissive: 0xffcf8a, emissiveIntensity: .35}),
    rtg: std(0xd6d0c2, .5, .25), stripe: std(0xd9a441, .45, .2),
  };
  root.add(merged(craneLists.steel, M.steel), merged(craneLists.dark, M.dark), merged(craneLists.cable, M.cable), merged(craneLists.house, M.house));
  const rtgLists = {paint: [], dark: [], stripe: [], lamps};
  rtg(-21, 5.2, 17, rtgLists); rtg(-31, 5.2, 17, rtgLists);
  root.add(merged(rtgLists.paint, M.rtg), merged(rtgLists.dark, M.dark), merged(rtgLists.stripe, M.stripe));
  const rtgs = [rtgRig(-21, 5.2, 17, M, 0), rtgRig(-31, 5.2, 17, M, 2.4)];
  rtgs.forEach(r => root.add(r.group));

  // Vessel, deck stow plan and the two boxes the cranes actually move.
  const kit = fleetKit(), reserved = new Set(), rigs = [];
  root.add(buildVessel(lamps));
  for (const c of CRANES) {
    const slot = heroSlot(c.x, STS.shipRow); reserved.add(slot.key);
    const rig = stsRig(c.x, {shipY: slot.y, truckY: TRAILER_DECK, phase: c.phase, materials: M});
    const box = new THREE.Mesh(kit.box40, containerMaterial(c.livery, BOX.l40)); box.castShadow = box.receiveShadow = true;
    rig.attach(box); root.add(rig.group, box); rigs.push(rig);
    const truck = makeTruck(kit, c.livery ? 3 : 2); truck.position.set(c.x - BOX_OFFSET, 0, STS.lane); root.add(truck);
  }
  instanceContainers(root, [...stowPlan(reserved), ...yardSlots()]);
  const fleet = buildFleet(kit); root.add(fleet.root);

  // Floodlight masts: emissive heads, additive ground pools, three real spot lights.
  const poles = [], pools = [];
  root.add(buildGate(lamps, pools), buildShorePower(lamps, pools), buildColdHub(lamps, pools));
  for (const [x, z] of MASTS) {
    beam(poles, [x, 0, z], [x, 20, z], .35); block(poles, [x, 20.2, z], [2.6, .25, .9]);
    for (const dx of [-.9, 0, .9]) lamps.push([x + dx, 19.9, z]);
    pools.push([x, z, 11]);
  }
  for (const c of CRANES) pools.push([c.x, STS.lane, 9]);
  pools.push([0, 0, 9]);
  root.add(merged(poles, std(0x6b685f, .6, .5)));
  const lampMat = new THREE.MeshStandardMaterial({color: 0xfff0d2, emissive: 0xffe2a8, emissiveIntensity: 4.5});
  const lampMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.6, .22, .5), lampMat, lamps.length), o = new THREE.Object3D();
  lamps.forEach((p, i) => { o.position.set(...p); o.updateMatrix(); lampMesh.setMatrixAt(i, o.matrix); });
  root.add(lampMesh);
  const glow = glowTexture();
  const poolMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({map: glow, color: 0xffc98a, transparent: true, opacity: .13, blending: THREE.AdditiveBlending, depthWrite: false}), pools.length);
  pools.forEach(([x, z, r], i) => { o.position.set(x, .08, z); o.scale.set(r * 2, 1, r * 2); o.updateMatrix(); poolMesh.setMatrixAt(i, o.matrix); });
  poolMesh.renderOrder = 1; root.add(poolMesh);
  for (const [x, y, z, tx, tz] of [[-17, 14.5, -16, -17, -18.5], [15, 14.5, -16, 15, -18.5], [0, 22, 8, 0, 0]]) {
    const s = new THREE.SpotLight(0xffd9a0, x === 0 ? 220 : 900, 60, .75, .7, 1.6); s.position.set(x, y, z); s.target.position.set(tx, 0, tz); root.add(s, s.target);
  }

  // Water: dark, low-gloss, with flickering light streaks under over-water lamps.
  const waterGeo = new THREE.PlaneGeometry(95, 28, 36, 18); waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, std(0x161713, .32, .6)); water.position.set(0, -.75, -39); root.add(water);
  const waterPos = waterGeo.attributes.position;
  const glints = lamps.filter(p => p[2] < -26), streakMat = new THREE.MeshBasicMaterial({map: streakTexture(), color: 0xffcf8a, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false});
  const streaks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 10).rotateX(-Math.PI / 2), streakMat, Math.max(1, glints.length));
  glints.forEach((p, i) => { o.position.set(p[0], -.5, p[2] + 4.5); o.scale.set(.9, 1, 1); o.updateMatrix(); streaks.setMatrixAt(i, o.matrix); });
  streaks.count = glints.length; root.add(streaks);

  // Camera-centred night sky and distant ridge (never fogged, never clipped).
  const sky = new THREE.Group(); root.add(sky);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), new THREE.MeshBasicMaterial({map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false}));
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(170, 170, 16, 64, 1, true), new THREE.MeshBasicMaterial({map: ridgeTexture(), transparent: true, side: THREE.DoubleSide, fog: false, depthWrite: false}));
  ridge.position.y = -9; dome.renderOrder = ridge.renderOrder = -10; sky.add(dome, ridge);

  // Route line, zone pins and a decorative beacon, unchanged from the schematic.
  const routeGeo = new THREE.BufferGeometry().setFromPoints(ROUTE.map(p => new THREE.Vector3(...p)));
  const route = new THREE.Line(routeGeo, new THREE.LineDashedMaterial({color: 0xe4c885, dashSize: 1, gapSize: .6})); route.computeLineDistances(); root.add(route);
  const anchors = {}, pickTargets = [];
  for (const zone of ZONES) {
    const a = new THREE.Object3D(); a.position.set(...zone.position); root.add(a); anchors[zone.id] = a;
    const labelCanvas = document.createElement('canvas'); labelCanvas.width = labelCanvas.height = 96; const g = labelCanvas.getContext('2d');
    g.fillStyle = '#e7d5a4'; g.beginPath(); g.arc(48, 48, 42, 0, Math.PI * 2); g.fill(); g.fillStyle = '#263024'; g.font = '500 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(zone.name.slice(0, 2), 48, 49);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: new THREE.CanvasTexture(labelCanvas), depthTest: false, sizeAttenuation: false})); sprite.position.copy(a.position); sprite.scale.set(.042, .042, 1); sprite.userData.zoneId = zone.id; sprite.renderOrder = 5; root.add(sprite); pickTargets.push(sprite);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.25, 12, 8), new THREE.MeshBasicMaterial({color: 0xffe6a9})); root.add(beacon);

  // Vehicle and Thermal views keep the port as a backdrop without pins or traffic.
  const overlays = [route, beacon, fleet.root, ...pickTargets];
  let studio = false;
  return {root, anchors, pickTargets, setStudio(on) { studio = on; overlays.forEach(o => { o.visible = !on; }); }, update(t, reduced, camera) {
    if (camera) sky.position.copy(camera.position);
    beacon.visible = !reduced && !studio; const p = (t * .035) % 1; beacon.position.set(-32 + p * 53, .38, 0);
    rigs.forEach(r => r.update(t, reduced)); rtgs.forEach(r => r.update(t, reduced)); fleet.update(t, reduced);
    if (!reduced) {
      for (let i = 0; i < waterPos.count; i++) waterPos.setY(i, Math.sin(waterPos.getX(i) * .28 + t * .5) * Math.cos(waterPos.getZ(i) * .38 + t * .3) * .1);
      waterPos.needsUpdate = true; streakMat.opacity = .45 + Math.sin(t * 2.3) * .08 + Math.sin(t * 5.1) * .05;
    }
  }};
}
