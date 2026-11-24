// Live engine: SimClock + three-node physics + custody timeline + alarms + event log.
// Keeps the state fields the 3D renderers read (temp, unitMode, drive, canHz, cargo.prechill,
// cargo.critical). Removed: energySavedPerTripTWD, co2eAvoidedKg, spoilageAtRiskTWD
// (unsupported claims). demurrageAvoidedTWD → queueCost (fees + energy + time, itemised).
// SYNTHETIC DEMO · NOT OPERATIONAL.
import {CARGO, UNITS, COSTS, v} from './params.js';
import {createModel, resolveTimeline} from './physics.js';
import {createAlarmEngine} from './alarms.js';
import {createSimClock} from './sim-clock.js';
import {createEventLog} from './event-log.js';

export const CARGO_CATALOG = CARGO;
const ALARM_EVAL_S = 10, SAMPLE_S = 60;

export function limitFor(cargo) {
  if (cargo.regime === 'frozen') return cargo.practiceUpperC ?? -18;
  if (cargo.regime === 'chilled') return 7;
  return cargo.bandC ? cargo.bandC[1] : v(cargo.setpointC) + 3;
}
export function thresholdsFor(cargo) {
  if (cargo.regime === 'frozen') return {returnAir: -12, product: -18, practice: cargo.practiceUpperC ?? null, transportAir: -18};
  if (cargo.regime === 'chilled') return {returnAir: 7, product: 7, transportAir: 7};
  return {returnAir: null, product: cargo.bandC?.[1] ?? null, low: cargo.bandC?.[0] ?? null};
}

export function createTelemetry({log = createEventLog(), clock = createSimClock(300)} = {}) {
  const cfg = {cargoId: 'frozen_meat', unitId: 'auto', ambientC: 38, solarWm2: 1000, mobile: 'ev', usableKWh: 282};
  let model, alarms, timeline = [], k = 0, scenario = null, nextAlarm = 0, nextSample = 0;
  const s = {
    cargo: null, ambientC: cfg.ambientC, temp: 0, peakTemp: -Infinity, breachOccurred: false, timeAboveReferenceSeconds: 0,
    soc: 82, unitMode: 'ECO · PLUG', canHz: 1, seal: 'SIMULATED', drive: 0, alerts: {}, heatIngressKw: 0, marginC: 0, withinRef: true,
    readings: null, history: [], alarmRows: [], level: 'ok', cfg, unit: null, queueCost: null, plugActions: 0, gateInAt: null, gateOutAt: null, notices: [],
  };
  const emit = (type, payload) => log.append(type, payload, {tSim: model ? model.t : 0});

  function cargoView() {
    const c = CARGO[cfg.cargoId];
    return {...c, prechill: v(c.setpointC), critical: limitFor(c), valueTWD: v(c.valueTWD), payloadTon: v(c.massKg) / 1000, cp: v(c.cpFrozen) / 1000};
  }
  function dispatch(ev) {
    model.applyEvent(ev);
    const r = model.readings(), p = {...ev.payload};
    if (ev.type === 'plug' || ev.type === 'unplug') s.plugActions++;
    if (ev.type === 'gate_in') s.gateInAt = model.t;
    if (ev.type === 'gate_out') s.gateOutAt = model.t;
    if (ev.type === 'EIR_signed') Object.assign(p, {setpointC: r.setpointC, displayedReturnAirC: +r.returnAir.toFixed(1), powerSource: r.source, note: 'EIR is a snapshot; it does not cover the unplug→EIR window'});
    if (ev.type === 'genset_start' || ev.type === 'ev_supply_start') p.powerSource = model.source;
    emit(ev.type, p);
  }
  function update() {
    const r = model.readings(), c = s.cargo;
    s.readings = r; s.temp = r.core; s.peakTemp = Math.max(s.peakTemp, r.core, r.surface);
    s.soc = r.soc * 100; s.drive = r.moving ? 1 : 0; s.heatIngressKw = r.Qin / 1000;
    const warm = Math.max(r.core, r.surface); s.marginC = c.critical - warm; s.withinRef = warm <= c.critical;
    s.unitMode = !r.powered ? 'OFF · NO POWER' : `${r.Qref > 0.9 * r.cap ? 'PULL-DOWN' : 'ECO'} · ${r.source.toUpperCase()}`;
    s.alarmRows = alarms.all(); s.level = alarms.level();
    const active = s.alarmRows.filter(a => ['active', 'escalated', 'acked'].includes(a.state));
    s.alerts = {};
    if (active.some(a => ['surface', 'core'].includes(a.channel))) s.alerts.core = active.some(a => ['surface', 'core'].includes(a.channel) && a.severity === 'crit') ? 'crit' : 'warn';
    if (!r.powered || active.some(a => ['returnAir', 'supplyAir'].includes(a.channel))) s.alerts.carrier = r.powered ? 'warn' : 'crit';
    if (r.soc < 0.2) s.alerts.battery = 'warn';
    const energyTWD = r.fuelUsedL * v(COSTS.dieselTWDperL) + (cfg.mobile === 'ev' ? r.battUsedKWh * v(COSTS.electricityTWDperKWh) : 0);
    const queueH = s.gateInAt == null ? 0 : ((s.gateOutAt ?? model.t) - s.gateInAt) / 3600;
    const plugFees = s.plugActions * v(COSTS.plugUnplugTWD), truck = queueH * v(COSTS.truckTWDperHour);
    s.queueCost = {plugActions: s.plugActions, plugFeesTWD: Math.round(plugFees), energyTWD: Math.round(energyTWD), truckTimeTWD: Math.round(truck), totalTWD: Math.round(plugFees + energyTWD + truck), queueHours: queueH};
  }
  function restart(sc = scenario) {
    scenario = sc; clock.reset(); k = 0; nextAlarm = 0; nextSample = 0;
    s.cargo = cargoView(); s.unit = UNITS[cfg.unitId === 'auto' ? s.cargo.unit : cfg.unitId];
    model = createModel({...cfg, initialSource: 'off'});
    alarms = createAlarmEngine({cargo: CARGO[cfg.cargoId], unit: s.unit, emit});
    timeline = resolveTimeline(sc.timeline, cfg.mobile);
    Object.assign(s, {history: [], peakTemp: -Infinity, breachOccurred: false, timeAboveReferenceSeconds: 0, plugActions: 0, gateInAt: null, gateOutAt: null, ambientC: cfg.ambientC, notices: []});
    emit('scenario_start', {scenario: sc.id, cargo: cfg.cargoId, unit: s.unit.id, ambientC: cfg.ambientC, solarWm2: cfg.solarWm2, mobile: cfg.mobile, usableKWh: cfg.usableKWh, setpointC: v(CARGO[cfg.cargoId].setpointC), clockScale: clock.scale});
    advanceTo(0);
  }
  function advanceTo(tTarget) {
    while (true) {
      while (k < timeline.length && timeline[k].tS <= model.t + 1e-9) dispatch(timeline[k++]);
      if (model.t >= nextAlarm - 1e-9) {
        const r = model.readings(); alarms.evaluate(r, ALARM_EVAL_S, {handling: r.handling, powered: r.powered}); nextAlarm = model.t + ALARM_EVAL_S;
      }
      if (model.t >= nextSample - 1e-9) { const r = model.readings(); s.history.push({t: r.t, returnAir: r.returnAir, supplyAir: r.supplyAir, surface: r.surface, core: r.core, soc: r.soc, fuelL: r.fuelL, source: r.source}); nextSample = model.t + SAMPLE_S; }
      if (model.t >= tTarget - 1e-9) break;
      const nextEv = k < timeline.length ? timeline[k].tS : Infinity;
      const h = Math.min(5, tTarget - model.t, nextEv - model.t, nextAlarm - model.t, nextSample - model.t);
      model.step(Math.max(h, 1e-6));
      while (model.notices.length) { const n = model.notices.shift(); s.notices.push(n); emit('alarm', {action: 'raise', ruleId: n.type.toUpperCase(), kind: 'diagnostic', severity: 'crit', clause: 'Mobile power lost'}); }
      const warm = Math.max(model.readings().core, model.readings().surface);
      if (warm > s.cargo.critical) { s.breachOccurred = true; s.timeAboveReferenceSeconds += h; }
    }
    update();
  }
  const api = {
    state: s, clock, log, cfg,
    get scenario() { return scenario; },
    get timeline() { return timeline; },
    apply(sc) { restart(sc); },
    tick(dtWall) { const d = clock.tick(dtWall); if (d > 0) advanceTo(model.t + d); },
    setCargo(id) { if (!CARGO[id] || id === cfg.cargoId) return; const from = cfg.cargoId; cfg.cargoId = id; log.append('setpoint_change', {from: v(CARGO[from].setpointC), setpointC: v(CARGO[id].setpointC), cargo: id}, {tSim: model ? model.t : 0, source: 'operator'}); if (scenario) restart(); },
    setAmbient(c) { if (Number.isFinite(c)) { cfg.ambientC = Math.min(42, Math.max(25, c)); if (scenario) restart(); } },
    setConfig(patch) { Object.assign(cfg, patch); if (scenario) restart(); },
    ack(id, by) { return alarms.ack(id, model.t, by); },
    ackAll(by) { const n = alarms.ackAll(model.t, by); update(); return n; },
    injectFault(ch, kind) { alarms.injectFault(ch, kind); },
    get faults() { return alarms.faults; },
    mcJob(n = 120) { return {cfg: {...cfg, initialSource: 'off'}, timeline: scenario.timeline, horizonS: scenario.horizonMin * 60, n, seed: 7, sampleS: 60, thresholds: thresholdsFor(CARGO[cfg.cargoId])}; },
  };
  return api;
}
