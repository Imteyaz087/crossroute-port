import test from 'node:test';
import assert from 'node:assert/strict';
import {createAlarmEngine, buildRules} from '../scene/alarms.js';
import {CARGO, UNITS} from '../scene/params.js';

const base = {supplyAir: -22, returnAir: -20, surface: -20, core: -20, controllerSetpointC: -20};
function run(engine, seq, ctx = {handling: false, powered: true}) { for (const [t, rd] of seq) engine.evaluate({...base, ...rd, t}, 10, ctx); }

test('frozen rules cite GHP Art.4 Annex 1 (not "Annex 2") and Art.8 −12 °C handling', () => {
  const rules = buildRules(CARGO.frozen_meat, UNITS.primeline);
  assert.ok(rules.find(r => r.id === 'GHP_A1_FROZEN_AIR' && r.threshold === -18 && /附件一 \(Annex 1\)/.test(r.clause)));
  assert.ok(rules.find(r => r.id === 'GHP_A8_HANDLING_AIR' && r.threshold === -12 && r.when === 'handling'));
  assert.ok(!rules.some(r => /Annex 2/.test(r.clause)));
});

test('chilled rules use 7 °C and the above-freezing floor', () => {
  const rules = buildRules(CARGO.chilled_seafood, UNITS.primeline);
  assert.ok(rules.find(r => r.id === 'GHP_A1_CHILLED_AIR' && r.threshold === 7));
  assert.ok(rules.find(r => r.id === 'PRODUCT_CHILLED_FREEZE' && r.dir === 'low'));
});

test('tuna −50/−55 °C is labelled practice, and a standard unit raises the super-freezer diagnostic', () => {
  const rules = buildRules(CARGO.sashimi_tuna, UNITS.primeline);
  assert.ok(rules.filter(r => r.id.startsWith('PRACTICE_TUNA')).every(r => r.kind === 'practice' && /Not law/.test(r.clause)));
  assert.ok(rules.find(r => r.id === 'UNIT_CANNOT_REACH_SETPOINT'));
  assert.ok(!buildRules(CARGO.sashimi_tuna, UNITS.superfreezer).find(r => r.id === 'UNIT_CANNOT_REACH_SETPOINT'));
});

test('on-delay, 0.5 K hysteresis, degree-minutes and latching ack', () => {
  const events = [];
  const e = createAlarmEngine({cargo: CARGO.frozen_meat, unit: UNITS.primeline, emit: (type, p) => events.push([type, p.action, p.ruleId])});
  const get = id => e.all().find(a => a.id === id);
  run(e, [[0, {surface: -17.5}], [30, {surface: -17.5}]]);
  assert.equal(get('PRODUCT_FROZEN_SURFACE').state, 'pending', '60 s delay not yet elapsed');
  run(e, [[70, {surface: -17.5}]]);
  assert.equal(get('PRODUCT_FROZEN_SURFACE').state, 'active');
  run(e, [[80, {surface: -17.8}]]);
  assert.equal(get('PRODUCT_FROZEN_SURFACE').state, 'active', 'inside hysteresis band (−18.5…−18) does not clear');
  run(e, [[90, {surface: -18.3}]]);
  assert.equal(get('PRODUCT_FROZEN_SURFACE').state, 'active', 'still within 0.5 K of the limit');
  run(e, [[100, {surface: -18.6}]]);
  assert.equal(get('PRODUCT_FROZEN_SURFACE').state, 'cleared_unacked', 'clears only below limit − 0.5 K, latched until ack');
  assert.ok(get('PRODUCT_FROZEN_SURFACE').dm > 0, 'degree-minutes accumulated');
  assert.ok(e.ack('PRODUCT_FROZEN_SURFACE', 110));
  assert.equal(get('PRODUCT_FROZEN_SURFACE').state, 'normal');
  assert.deepEqual(events.filter(x => x[2] === 'PRODUCT_FROZEN_SURFACE').map(x => x[0] + ':' + (x[1] || '')), ['alarm:raise', 'alarm:clear', 'ack:']);
});

test('unacknowledged alarms escalate after 15 min', () => {
  const e = createAlarmEngine({cargo: CARGO.frozen_meat, unit: UNITS.primeline});
  const seq = []; for (let t = 0; t <= 1200; t += 10) seq.push([t, {core: -17}]);
  run(e, seq);
  assert.equal(e.all().find(a => a.id === 'PRODUCT_FROZEN_CORE').state, 'escalated');
});

test('handling rule only applies while handling', () => {
  const e = createAlarmEngine({cargo: CARGO.frozen_meat, unit: UNITS.primeline});
  const seq = []; for (let t = 0; t <= 300; t += 10) seq.push([t, {returnAir: -11}]);
  run(e, seq, {handling: false, powered: false});
  assert.notEqual(e.all().find(a => a.id === 'GHP_A8_HANDLING_AIR').state, 'active');
  const h = createAlarmEngine({cargo: CARGO.frozen_meat, unit: UNITS.primeline}); run(h, seq, {handling: true, powered: false});
  assert.equal(h.all().find(a => a.id === 'GHP_A8_HANDLING_AIR').state, 'active');
});

test('rate-of-rise and stuck-sensor diagnostics', () => {
  const e = createAlarmEngine({cargo: CARGO.frozen_meat, unit: UNITS.primeline});
  const seq = []; for (let t = 0; t <= 700; t += 10) seq.push([t, {returnAir: -20 + t / 200, supplyAir: -22 + t / 200}]);
  run(e, seq, {handling: false, powered: false});
  assert.ok(['active', 'escalated'].includes(e.all().find(a => a.id === 'ROR_RETURN_AIR')?.state), 'ROR raised for > 2 K / 10 min');
  const s = createAlarmEngine({cargo: CARGO.frozen_meat, unit: UNITS.primeline});
  s.injectFault('returnAir', 'stuck');
  const seq2 = []; for (let t = 0; t <= 1900; t += 10) seq2.push([t, {returnAir: -20 + t / 600, supplyAir: -22 + t / 600}]);
  run(s, seq2);
  assert.ok(['active', 'escalated'].includes(s.all().find(a => a.id === 'STUCK_returnAir')?.state), 'stuck return-air detected');
});
