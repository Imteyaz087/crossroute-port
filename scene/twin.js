import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { M } from './materials.js';

export const SPEC = {
  truck: 'Yulon CMC-ET35 (EV drayage tractor)',
  batteryKWh: 350,
  reefer: '40ft High-Cube Reefer',
  unit: 'Carrier Transicold (Eco mode)',
  setpoint: -18.5,
  telematics: 'VoltEdge CAN-bus node',
  seal: 'RFID E-Seal',
};

const rbox = (w, h, d, r, mat) => {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat);
  m.castShadow = m.receiveShadow = true;
  return m;
};

export function buildTwin() {
  const root = new THREE.Group();
  root.name = 'twin';
  const anchors = {};            // id -> Object3D (pin + focus target)
  const fx = {};                 // animated parts

  // ---------- TRACTOR (+X is forward) ----------
  const tractor = new THREE.Group();
  tractor.position.set(7.2, 0, 0);
  root.add(tractor);

  const frame = rbox(6.2, 0.35, 1.1, 0.05, M.chassis);
  frame.position.set(-0.6, 0.95, 0);
  tractor.add(frame);

  const cab = rbox(2.3, 2.6, 2.45, 0.18, M.cabPaint);
  cab.position.set(1.4, 2.55, 0);
  tractor.add(cab);

  const wind = rbox(0.08, 1.05, 2.1, 0.04, M.glass);
  wind.position.set(2.56, 3.1, 0);
  wind.rotation.z = -0.06;
  tractor.add(wind);

  const bumper = rbox(0.25, 0.55, 2.4, 0.08, M.cabAccent);
  bumper.position.set(2.6, 1.15, 0);
  tractor.add(bumper);

  const stripe = rbox(2.32, 0.12, 2.47, 0.02, M.cabAccent);
  stripe.position.set(1.4, 1.9, 0);
  tractor.add(stripe);

  // Battery packs either side of frame
  const battery = new THREE.Group();
  tractor.add(battery);
  [-1, 1].forEach(s => {
    const p = rbox(2.4, 0.9, 0.45, 0.06, M.battery);
    p.position.set(-0.6, 1.0, s * 0.82);
    battery.add(p);
  });
  anchors.battery = marker(tractor, -0.6, 1.6, 1.15);

  // Fifth wheel
  const fifth = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 32), M.chassis);
  fifth.position.set(-2.6, 1.2, 0);
  tractor.add(fifth);

  // Wheels
  fx.wheels = [];
  [[1.5], [-2.1], [-3.3]].forEach(([x]) => [-1, 1].forEach(s => {
    const w = wheel();
    w.position.set(x, 0.52, s * 1.05);
    tractor.add(w);
    fx.wheels.push(w);
  }));

  // ---------- REEFER CONTAINER (40ft HC ≈ 12.19 × 2.90 × 2.44 m) ----------
  const L = 12.19, H = 2.9, W = 2.44;
  const box = new THREE.Group();
  box.position.set(-1.5, 1.35 + H / 2, 0);
  root.add(box);

  // Shell with cutaway: build 5 panels; near-side (+Z) panel as sliding cutaway
  const panel = (w, h, d, x, y, z) => {
    const p = rbox(w, h, d, 0.02, M.reeferSkin);
    p.position.set(x, y, z);
    box.add(p);
    return p;
  };
  panel(L, 0.08, W, 0, H / 2, 0);                 // roof
  panel(L, 0.08, W, 0, -H / 2, 0);                // floor
  panel(L, H, 0.06, 0, 0, -W / 2);                // far wall
  panel(0.08, H, W, -L / 2, 0, 0);                // rear doors
  fx.cutaway = panel(L, H, 0.06, 0, 0, W / 2);    // near wall (animated)
  fx.cutaway.material = M.reeferSkin.clone();
  fx.cutaway.material.transparent = true;

  // Corrugation ribs (instanced for cheap detail)
  const ribGeo = new THREE.BoxGeometry(0.06, H * 0.92, 0.05);
  const ribs = new THREE.InstancedMesh(ribGeo, M.reeferRib, 120);
  const t = new THREE.Object3D();
  let i = 0;
  for (let k = 0; k < 60; k++) for (const s of [-1, 1]) {
    t.position.set(-L / 2 + 0.2 + k * (L - 0.4) / 59, 0, s * (W / 2 + 0.035));
    t.updateMatrix();
    ribs.setMatrixAt(i++, t.matrix);
  }
  ribs.castShadow = true;
  box.add(ribs);
  fx.ribs = ribs;

  // Interior liner + pallets
  const liner = new THREE.Mesh(new THREE.BoxGeometry(L - 0.3, H - 0.25, W - 0.25), M.interior);
  liner.material = M.interior.clone();
  liner.material.side = THREE.BackSide;
  box.add(liner);

  const cargo = new THREE.Group();
  box.add(cargo);
  fx.palletLoads = [];
  for (let k = 0; k < 10; k++) {
    for (const z of [-0.55, 0.55]) {
      const pal = rbox(1.0, 0.14, 1.0, 0.01, M.pallet);
      pal.position.set(-5.2 + k * 1.1, -H / 2 + 0.15, z);
      const loadMat = M.cargo.clone();
      const load = rbox(0.95, 1.4, 0.95, 0.03, loadMat);
      load.position.set(0, 0.78, 0);
      pal.add(load);
      cargo.add(pal);
      fx.palletLoads.push({ mesh: load, material: loadMat, col: k, zPos: z, xPos: -5.2 + k * 1.1 });
    }
  }
  anchors.core = marker(box, 0.6, 0.4, 0.3);      // core temperature probe in cargo mass

  // Cold-air volume tint (shows thermal state: Silver Frost 0xece9e4, Zero-Blue)
  fx.airTint = new THREE.Mesh(
    new THREE.BoxGeometry(L - 0.4, H - 0.4, W - 0.4),
    new THREE.MeshBasicMaterial({ color: 0xece9e4, transparent: true, opacity: 0.06, depthWrite: false })
  );
  box.add(fx.airTint);

  // Carrier Transicold unit on front face (+X end)
  const unit = new THREE.Group();
  unit.position.set(L / 2 + 0.12, 0, 0);
  box.add(unit);
  unit.add(rbox(0.25, H - 0.1, W - 0.1, 0.04, M.carrier));
  const grille = rbox(0.06, 1.0, 1.9, 0.03, M.carrierGrille);
  grille.position.set(0.14, 0.65, 0);
  unit.add(grille);
  fx.fan = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 6, 1), M.rim);
  fx.fan.rotation.z = Math.PI / 2;
  fx.fan.position.set(0.17, -0.55, 0.4);
  unit.add(fx.fan);
  anchors.carrier = marker(unit, 0.25, 0.9, 0);

  // RFID E-seal on rear door
  const seal = rbox(0.06, 0.18, 0.1, 0.02, M.ledOk);
  seal.position.set(-L / 2 - 0.06, -0.3, 0.35);
  box.add(seal);
  fx.seal = seal;
  anchors.seal = marker(box, -L / 2 - 0.1, -0.3, 0.35);

  // VoltEdge CAN-bus node on the tractor back-of-cab
  const node = rbox(0.22, 0.4, 0.6, 0.04, M.node);
  node.position.set(0.18, 2.2, 0.9);
  tractor.add(node);
  fx.nodeLed = rbox(0.02, 0.05, 0.05, 0.01, M.ledOk.clone());
  fx.nodeLed.position.set(-0.12, 0.12, 0.2);
  node.add(fx.nodeLed);
  anchors.canbus = marker(tractor, 0.1, 2.5, 0.9);

  // Trailer chassis + rear bogie
  const tChassis = rbox(L - 0.6, 0.25, 1.0, 0.04, M.chassis);
  tChassis.position.set(-1.5, 1.22, 0);
  root.add(tChassis);
  [-5.4, -6.6].forEach(x => [-1, 1].forEach(s => {
    const w = wheel();
    w.position.set(x, 0.52, s * 1.05);
    root.add(w);
    fx.wheels.push(w);
  }));

  // Scenario props (hidden until needed)
  fx.shoreCable = buildCable(new THREE.Vector3(L / 2 - 1.5, 0.25, -W / 2 - 0.05), new THREE.Vector3(5, 0, -4));
  fx.shoreCable.visible = false;
  root.add(fx.shoreCable);

  fx.gate = buildGate();
  fx.gate.position.set(14, 0, 0);
  fx.gate.visible = false;
  root.add(fx.gate);

  root.position.x = -1.2;      // centre the rig
  return { root, anchors, fx, dims: { L, H, W } };
}

function wheel() {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.17, 18, 40), M.tyre);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.32, 24), M.rim);
  rim.rotation.x = Math.PI / 2;
  tyre.castShadow = rim.castShadow = true;
  g.add(tyre, rim);
  return g;
}

function marker(parent, x, y, z) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

function buildCable(a, b) {
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= 0.4;
  const curve = new THREE.CatmullRomCurve3([a, mid, b]);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.05, 8), M.cable);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), M.carrier);
  post.position.copy(b).setY(0.8);
  m.add(post);
  return m;
}

function buildGate() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.4), M.cabAccent);
  post.position.set(0, 0.7, 2.2);
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 4.2),
    new THREE.MeshStandardMaterial({ color: 0xf5b84b, roughness: 0.4 })
  );
  arm.position.set(0, 1.3, 0);
  g.add(post, arm);
  g.userData.arm = arm;
  return g;
}
