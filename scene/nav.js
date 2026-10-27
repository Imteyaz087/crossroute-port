import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ease = t => 1 - Math.pow(1 - t, 3);

export function createNav(camera, dom) {
  const controls = new OrbitControls(camera, dom);
  Object.assign(controls, {
    enableDamping: true,
    dampingFactor: 0.07,
    minDistance: 5,
    maxDistance: 42,
    maxPolarAngle: Math.PI * 0.48,
    screenSpacePanning: true,
    zoomSpeed: 0.8,
  });
  controls.target.set(1.6, 2.0, 0);
  const home = { pos: camera.position.clone(), tgt: controls.target.clone() };

  const keys = new Set();
  window.addEventListener('keydown', e => {
    keys.add(e.key.toLowerCase());
    if (e.key === 'r') focus(home.tgt, home.pos);
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

  let tween = null;
  function focus(target, camPos, dur = 1.1) {
    tween = {
      t: 0,
      dur,
      p0: camera.position.clone(),
      t0: controls.target.clone(),
      p1: camPos.clone(),
      t1: target.clone()
    };
  }

  function focusObject(obj, dist = 5.5) {
    if (!obj) return;
    const tgt = obj.getWorldPosition(new THREE.Vector3());
    const dir = camera.position.clone().sub(controls.target).normalize();
    dir.y = Math.max(dir.y, 0.25);
    dir.normalize();
    focus(tgt, tgt.clone().addScaledVector(dir, dist));
  }

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function update(dt) {
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / tween.dur);
      const k = ease(tween.t);
      camera.position.lerpVectors(tween.p0, tween.p1, k);
      controls.target.lerpVectors(tween.t0, tween.t1, k);
      if (tween.t === 1) tween = null;
    } else if (keys.size) {
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      right.crossVectors(fwd, up);
      const s = (keys.has('shift') ? 18 : 8) * dt;
      const d = new THREE.Vector3();
      if (keys.has('w')) d.add(fwd);
      if (keys.has('s')) d.sub(fwd);
      if (keys.has('d')) d.add(right);
      if (keys.has('a')) d.sub(right);
      if (keys.has('q')) d.y -= 1;
      if (keys.has('e')) d.y += 1;
      d.multiplyScalar(s);
      camera.position.add(d);
      controls.target.add(d);
    }
    controls.update();
  }

  controls.addEventListener('start', () => (tween = null));      // user input cancels tween
  return { controls, update, focus, focusObject, home };
}
