import test from 'node:test';
import assert from 'node:assert/strict';
import {runMonteCarlo} from '../scene/montecarlo.js';
import {SCENARIOS} from '../scene/scenarios.js';

test('Monte Carlo bands are ordered P5 ≤ P50 ≤ P95 and deterministic for a seed', () => {
  const sc = SCENARIOS.find(s => s.id === 'crane');
  const job = {cfg: {cargoId: 'frozen_meat', initialSource: 'off'}, timeline: sc.timeline, horizonS: sc.horizonMin * 60, n: 16, seed: 3, thresholds: {returnAir: -12, product: -18}};
  const a = runMonteCarlo(job), b = runMonteCarlo(job);
  for (const k of ['returnAir', 'surface', 'core']) a[k].p5.forEach((x, i) => assert.ok(x <= a[k].p50[i] + 1e-9 && a[k].p50[i] <= a[k].p95[i] + 1e-9));
  assert.deepEqual(a.core.p50, b.core.p50);
  assert.ok(a.pReturnAirOver > 0.5, 'missed re-plug drives return air over −12 °C in most runs');
});
