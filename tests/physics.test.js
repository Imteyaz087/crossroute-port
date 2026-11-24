import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityW, cop, createModel, storedJ, simulate, productH, productT} from '../scene/physics.js';
import {UNITS, CONTAINER} from '../scene/params.js';
import {SCENARIOS} from '../scene/scenarios.js';

test('PrimeLINE capacity map reproduces the published points at 38 °C ambient', () => {
  const u = UNITS.primeline;
  assert.equal(capacityW(u, 2, 38), 12000);
  assert.equal(capacityW(u, -18, 38), 6600);
  assert.equal(capacityW(u, -29, 38), 4400);
  assert.ok(capacityW(u, -18, 43) < 6600, 'capacity derates with hotter condenser air');
});

test('SuperFreezer capacity points (Thermo King spec) at 37.8 °C', () => {
  const u = UNITS.superfreezer;
  assert.equal(capacityW(u, -30, 37.8), 8250);
  assert.equal(capacityW(u, -60, 37.8), 5850);
  assert.equal(capacityW(u, -70, 37.8), 3880);
});

test('COP falls as condenser air gets hotter, and full-load input matches the spec band', () => {
  const u = UNITS.primeline;
  assert.ok(cop(u, -18, 30) > cop(u, -18, 38));
  assert.ok(cop(u, -18, 38) > cop(u, -18, 43));
  const pelKW = (capacityW(u, -18, 38) / cop(u, -18, 38) + u.fanW.value) / 1000;
  assert.ok(pelKW >= 6.1 && pelKW <= 8.2, `full-load input ${pelKW.toFixed(2)} kW within Triton 6.1–8.2 kW`);
});

test('enthalpy ↔ temperature inversion is exact across the latent zone', () => {
  const c = {cpF: 1800, cpU: 3500, Tf: -1.5, Lw: 333.6e3 * 0.7};
  for (const T of [-60, -30, -18, -5, -2, -1.5, 0, 5, 20]) assert.ok(Math.abs(productT(c, productH(c, T)) - T) < 1e-9, `T=${T}`);
});

test('energy conservation: stored energy change equals net heat in minus refrigeration (RK4)', () => {
  for (const cargoId of ['frozen_meat', 'fresh_produce', 'sashimi_tuna']) {
    const m = createModel({cargoId, ambientC: 38, solarWm2: 1000, initialSource: 'plug'});
    const E0 = storedJ(m.pr, m.y);
    m.advance(1800);
    m.applyEvent({type: 'door_open', payload: {durationS: 300, exchangeFrac: 0.5}});
    m.advance(900);
    m.applyEvent({type: 'unplug'});
    m.advance(3600);
    const dStored = storedJ(m.pr, m.y) - E0, net = m.y[3] - m.y[4];
    const rel = Math.abs(dStored - net) / Math.max(1, Math.abs(m.y[3]) + Math.abs(m.y[4]));
    assert.ok(rel < 1e-9, `${cargoId}: relative imbalance ${rel}`);
  }
});

test('ΔSoC equals energy drawn divided by usable kWh', () => {
  for (const usableKWh of [100, 282, 460]) {
    const m = createModel({cargoId: 'frozen_meat', usableKWh, soc0: 0.82, mobile: 'ev', initialSource: 'ev'});
    m.advance(5400);
    const r = m.readings();
    const dSoc = 0.82 - r.soc;
    assert.ok(Math.abs(dSoc - r.battUsedKWh / usableKWh) < 1e-9, `usable ${usableKWh}`);
    assert.ok(Math.abs(r.battUsedKWh - (r.battReeferKWh + r.battAuxKWh + r.battDriveKWh)) < 1e-9);
  }
});

test('90-min queue on EV supply: reefer energy is consistent with an independent integration of P_el/η', () => {
  const sc = SCENARIOS.find(s => s.id === 'gate');
  const {samples, model} = simulate({cargoId: 'frozen_meat', mobile: 'ev', usableKWh: 282}, sc.timeline, sc.horizonMin * 60, 10, 5);
  let kWh = 0;
  for (let i = 1; i < samples.length; i++) if (samples[i - 1].source === 'ev') kWh += samples[i - 1].Pel / model.pr.invEff * 10 / 3.6e6;
  const r = model.readings();
  assert.ok(Math.abs(kWh - r.battReeferKWh) / r.battReeferKWh < 0.03, `independent ${kWh.toFixed(3)} vs model ${r.battReeferKWh.toFixed(3)}`);
  assert.ok(r.battReeferKWh > 4 && r.battReeferKWh < 20, 'reefer energy in a 4–20 kWh band for ~2.5 h on battery');
});

test('unpowered 90 min at 38 °C: air warms much faster than the product core', () => {
  const m = createModel({cargoId: 'frozen_meat', initialSource: 'off'});
  m.advance(5400);
  const r = m.readings();
  assert.ok(r.returnAir - (-20) > 4, 'return air rises several K');
  assert.ok(r.core - (-20) < 0.2, 'core barely moves');
});

test('a standard reefer cannot hold −55 °C tuna; a super-freezer can', () => {
  const pl = createModel({cargoId: 'sashimi_tuna', unitId: 'primeline', initialSource: 'plug'}); pl.advance(4 * 3600);
  const sf = createModel({cargoId: 'sashimi_tuna', unitId: 'superfreezer', initialSource: 'plug'}); sf.advance(4 * 3600);
  assert.ok(pl.readings().returnAir > -36, 'PrimeLINE floor ≈ −35 °C');
  assert.ok(sf.readings().returnAir < -54, 'super-freezer holds −55 °C');
});

test('container parameters stay within ISO 1496-2 limits', () => {
  assert.ok(CONTAINER.UA_W_per_K.value / CONTAINER.meanArea_m2.value <= 0.4);
  assert.equal(CONTAINER.leakTest_m3h.value, 10);
});
