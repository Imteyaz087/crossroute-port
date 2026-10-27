import * as THREE from 'three';
import { createStage } from './scene/stage.js';
import { buildTwin } from './scene/twin.js';
import { createPins } from './scene/pins.js';
import { createNav } from './scene/nav.js';
import { SCENARIOS } from './scene/scenarios.js';
import { createTelemetry, CARGO_CATALOG } from './scene/telemetry.js';

const canvas = document.getElementById('stage') || document.getElementById('portWebGLCanvas');
const { renderer, scene, camera } = createStage(canvas);
const twin = buildTwin();
scene.add(twin.root);
const nav = createNav(camera, renderer.domElement);
const tel = createTelemetry();

const occluders = [];
twin.root.traverse(o => {
  if (o.isMesh && o !== twin.fx.airTint) occluders.push(o);
});

const pinsContainer = document.getElementById('pins') || createDefaultPinsLayer();
const pins = createPins(pinsContainer, twin.anchors, camera, occluders, id => {
  nav.focusObject(twin.anchors[id]);
});

function createDefaultPinsLayer() {
  let el = document.getElementById('pins');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pins';
    document.body.appendChild(el);
  }
  return el;
}

// ---- Stepper drawer orchestration ----
const $ = id => document.getElementById(id);
let idx = 0;

if ($('s-steps')) {
  $('s-steps').innerHTML = SCENARIOS.map((s, i) => `<li data-i="${i}">${i + 1}. ${s.title}</li>`).join('');
  $('s-steps').onclick = e => {
    const li = e.target.closest('li');
    if (li && li.dataset.i !== undefined) go(+li.dataset.i);
  };
}

if ($('prev')) $('prev').onclick = () => go(idx - 1);
if ($('next')) $('next').onclick = () => go(idx + 1);

// ---- Auto-Tour Orchestration for Judges & Evaluators ----
let tourTimer = null;
let isTourRunning = false;

function toggleTour() {
  const btn = $('btnTour');
  if (isTourRunning) {
    clearInterval(tourTimer);
    tourTimer = null;
    isTourRunning = false;
    if (btn) {
      btn.textContent = '▶ 自動導覽 (Auto Tour)';
      btn.classList.remove('active');
    }
  } else {
    isTourRunning = true;
    if (btn) {
      btn.textContent = '⏸ 暫停導覽 (Pause)';
      btn.classList.add('active');
    }
    // If at the end, wrap to start
    if (idx >= SCENARIOS.length - 1) go(0);
    tourTimer = setInterval(() => {
      const nextIdx = (idx + 1) % SCENARIOS.length;
      go(nextIdx);
    }, 5500);
  }
}

if ($('btnTour')) $('btnTour').onclick = toggleTour;

window.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') go(idx + 1);
  if (e.key === 'ArrowLeft') go(idx - 1);
});

const propsState = { cutaway: 0, shore: false, gate: false };

function go(i) {
  if (i < 0 || i >= SCENARIOS.length) return;
  idx = i;
  const sc = SCENARIOS[i];

  if ($('s-idx')) $('s-idx').textContent = i + 1;
  if ($('s-title')) $('s-title').textContent = sc.title;
  if ($('s-body')) $('s-body').textContent = sc.body;
  if ($('s-events')) {
    $('s-events').innerHTML = sc.events.map(e => `<li>${e}</li>`).join('');
  }

  if ($('s-steps')) {
    [...$('s-steps').children].forEach((li, k) => {
      li.className = k === i ? 'active' : k < i ? 'done' : '';
    });
  }

  if ($('prev')) $('prev').disabled = i === 0;
  if ($('next')) $('next').disabled = i === SCENARIOS.length - 1;

  tel.apply(sc);
  propsState.cutaway = sc.props.cutaway ? 1 : 0;
  twin.fx.shoreCable.visible = !!sc.props.shore;
  twin.fx.gate.visible = !!sc.props.gate;

  if (sc.focus === 'overview') {
    nav.focus(nav.home.tgt, nav.home.pos);
  } else if (twin.anchors[sc.focus]) {
    nav.focusObject(twin.anchors[sc.focus], 7);
  }
}

// ---- Commodity & Ambient Slider Dock ----
if ($('cargoSelect')) {
  $('cargoSelect').onchange = e => {
    tel.setCargo(e.target.value);
    if ($('cargoDesc')) $('cargoDesc').textContent = tel.state.cargo.desc;
    updateHUD(tel.state);
  };
}

if ($('ambientSlider')) {
  $('ambientSlider').oninput = e => {
    const degC = parseFloat(e.target.value);
    tel.setAmbient(degC);
    if ($('ambientVal')) $('ambientVal').textContent = `${degC.toFixed(0)}°C`;
    updateHUD(tel.state);
  };
}

// ---- ISO 14083 Modal Orchestration ----
if ($('btnExportIso')) {
  $('btnExportIso').onclick = () => {
    if ($('isoModal')) $('isoModal').classList.add('open');
    updateIsoModalData(tel.state);
  };
}

if ($('btnCloseModal')) {
  $('btnCloseModal').onclick = () => {
    if ($('isoModal')) $('isoModal').classList.remove('open');
  };
}

function updateIsoModalData(s) {
  if ($('m-cargo')) $('m-cargo').textContent = `${s.cargo.name} (${s.cargo.payloadTon} Ton)`;
  if ($('m-temp')) $('m-temp').textContent = `${s.temp.toFixed(2)} °C (HACCP Limit: ${s.cargo.critical}°C)`;
  if ($('m-status')) {
    $('m-status').textContent = s.withinRef ? 'VERIFIED · IN SPEC' : 'BREACH · ATTENTION';
    $('m-status').className = s.withinRef ? 'ok' : 'crit';
  }
  if ($('m-carbon')) $('m-carbon').textContent = `${s.co2eAvoidedKg.toFixed(1)} kgCO₂e Saved (−78% vs Diesel)`;
  if ($('m-roi')) $('m-roi').textContent = `NT$ ${s.spoilageAvoidedTWD.toLocaleString()} Spoilage Avoided`;
}

// ---- HUD & CFO Ticker Updates ----
function updateHUD(s) {
  if ($('k-temp')) $('k-temp').textContent = `${s.temp.toFixed(1)}°C`;
  if ($('k-soc')) $('k-soc').textContent = `${s.soc.toFixed(0)}%`;
  const lvl = Object.values(s.alerts).includes('crit') ? 'crit' : Object.values(s.alerts).length ? 'warn' : 'ok';
  if ($('k-status')) {
    $('k-status').className = lvl;
    $('k-status').textContent = { ok: 'NOMINAL', warn: 'ADVISORY', crit: 'CRITICAL' }[lvl];
  }

  // CFO Financial Ticker
  if ($('k-spoilage')) {
    if (s.withinRef) {
      $('k-spoilage').textContent = `NT$ ${s.spoilageAvoidedTWD.toLocaleString()}`;
      $('k-spoilage').className = 'val ok';
    } else {
      $('k-spoilage').textContent = `NT$ ${s.spoilageAtRiskTWD.toLocaleString()} AT RISK`;
      $('k-spoilage').className = 'val crit';
    }
  }

  if ($('k-demurrage')) {
    $('k-demurrage').textContent = `NT$ ${s.demurrageAvoidedTWD.toLocaleString()}`;
  }

  if ($('k-ingress')) {
    $('k-ingress').textContent = `${s.heatIngressKw.toFixed(2)} kW`;
  }
}

// ---- Visual bindings: telemetry → twin (Zero-Blue Industrial Studio: Silver Frost) ----
const cold = new THREE.Color(0xece9e4);
const amber = new THREE.Color(0xf59e0b);
const crimson = new THREE.Color(0xef4444);
let cut = 0;

function bindVisuals(s, dt, t) {
  const { fx } = twin;
  const cargo = s.cargo;
  const crit = cargo.critical;
  const pre = cargo.prechill;

  // Air Volume Tint
  const warmth = THREE.MathUtils.clamp((s.temp - pre) / Math.max(1, crit - pre + 2), 0, 1);
  const currentTint = cold.clone().lerp(crimson, warmth);
  fx.airTint.material.color.copy(currentTint);
  fx.airTint.material.opacity = 0.04 + warmth * 0.14;

  // Cutaway Panel Slide
  cut += (propsState.cutaway - cut) * (1 - Math.exp(-dt * 4));
  fx.cutaway.position.y = cut * 3.2;
  fx.cutaway.material.opacity = 1 - cut * 0.85;

  // Animate Cold Frost Vapor Particles (revealed during cutaway & open reefer)
  if (fx.frost && fx.frostVel) {
    const pos = fx.frost.geometry.attributes.position.array;
    const isColdOpen = cut > 0.05 && s.temp <= -10;
    fx.frost.material.opacity = isColdOpen ? THREE.MathUtils.clamp(cut * 0.45, 0, 0.45) : 0;
    if (isColdOpen) {
      for (let k = 0; k < fx.frostVel.length; k++) {
        const v = fx.frostVel[k];
        v.life += dt * 0.55;
        if (v.life > 1.0) {
          v.life = 0;
          pos[k * 3]     = v.x0;
          pos[k * 3 + 1] = v.y0;
          pos[k * 3 + 2] = v.z0;
        } else {
          pos[k * 3]     += v.vx * dt;
          pos[k * 3 + 1] += v.vy * dt;
          pos[k * 3 + 2] += v.vz * dt;
        }
      }
      fx.frost.geometry.attributes.position.needsUpdate = true;
    }
  }

  // Powertrain X-Ray Ghosting (Scenario 2: Yard Staging & Smart Tug)
  if (fx.cab) {
    const isXray = idx === 1; // Scenario 2 reveals Yulon EV motor, inverter & battery
    const targetCabOpacity = isXray ? 0.35 : 1.0;
    fx.cab.material.opacity += (targetCabOpacity - fx.cab.material.opacity) * (1 - Math.exp(-dt * 5));
  }

  // 3D Thermal Slice Gradient across all 20 Pallet Stacks
  if (fx.palletLoads) {
    const isPowerOff = s.unitMode.startsWith('OFF');
    fx.palletLoads.forEach(p => {
      // Physical stratification: pallets near rear door (col 0..2) warm up fastest
      // Pallets near Carrier evaporator (col 8..9) stay coldest
      const distFromFront = (9 - p.col) / 9.0;
      const localWarmthDelta = isPowerOff ? distFromFront * 2.8 : distFromFront * 0.35;
      const palletTemp = s.temp + localWarmthDelta;

      let targetColor;
      if (palletTemp >= crit) {
        targetColor = crimson;
      } else if (palletTemp >= crit - 1.5) {
        targetColor = amber;
      } else {
        targetColor = cold;
      }
      p.material.color.lerp(targetColor, Math.min(1.0, dt * 3.0));
    });
  }

  const fanSpeed = s.unitMode.startsWith('OFF') ? 0 : s.unitMode.startsWith('PULL') ? 22 : 9;
  fx.fan.rotation.x += fanSpeed * dt;
  fx.wheels.forEach(w => (w.rotation.z -= s.drive * 3 * dt));
  fx.nodeLed.material.emissiveIntensity = 1 + Math.sin(t * s.canHz * 0.25) * 1.2;
  const arm = fx.gate.userData.arm;
  if (arm) arm.rotation.x = 0;
}

// ---- Animation Loop ----
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  tel.tick(dt);
  nav.update(dt);
  bindVisuals(tel.state, dt, t);
  renderer.render(scene, camera);
  pins.update(tel.state);
  updateHUD(tel.state);
});

// Initialize at scenario 0
go(0);

// Global export for console debugging
window.CrossRouteTwin = {
  stage: { renderer, scene, camera },
  twin,
  nav,
  telemetry: tel,
  setScenario: go
};
