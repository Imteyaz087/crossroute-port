import * as THREE from 'three';

export const PIN_DEFS = [
  { id: 'core',    label: 'Core Probe',         fmt: s => `${s.temp.toFixed(1)}°C` },
  { id: 'carrier', label: 'Carrier Transicold', fmt: s => s.unitMode },
  { id: 'battery', label: 'Battery SoC',        fmt: s => `${s.soc.toFixed(0)}% · 350kWh` },
  { id: 'canbus',  label: 'VoltEdge CAN-Bus',   fmt: s => `${s.canHz} Hz` },
  { id: 'seal',    label: 'RFID E-Seal',        fmt: s => s.seal },
];

export function createPins(layer, anchors, camera, occluders, onPick) {
  const v = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const camPos = new THREE.Vector3();
  let frame = 0;

  const pins = PIN_DEFS.map(def => {
    const el = document.createElement('button');
    el.className = 'pin';
    el.innerHTML = `<span class="dot"></span><span class="k">${def.label}</span><span class="v"></span>`;
    el.addEventListener('click', () => onPick(def.id));
    layer.appendChild(el);
    return { def, el, val: el.querySelector('.v'), anchor: anchors[def.id] };
  });

  return {
    update(state) {
      frame++;
      camera.getWorldPosition(camPos);
      const w = window.innerWidth;
      const h = window.innerHeight;

      for (const p of pins) {
        if (!p.anchor) continue;
        p.anchor.getWorldPosition(v);
        const world = v.clone();
        v.project(camera);
        const visible = v.z < 1;
        p.el.style.display = visible ? '' : 'none';
        p.el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
        p.el.style.top = `${(-v.y * 0.5 + 0.5) * h - 18}px`;
        p.val.textContent = p.def.fmt(state);
        p.el.classList.remove('warn', 'crit');
        const lvl = state.alerts[p.def.id];
        if (lvl) p.el.classList.add(lvl);

        if (frame % 6 === 0) {                                        // occlusion check
          const dir = world.clone().sub(camPos);
          const dist = dir.length();
          ray.set(camPos, dir.normalize());
          ray.far = dist - 0.15;
          p.el.classList.toggle('hidden', ray.intersectObjects(occluders, true).length > 0);
        }
      }
    },
  };
}
