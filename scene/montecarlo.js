// Small seeded Monte Carlo over the uncertain (estimate-flagged) parameters.
// Produces P5/P50/P95 bands for return air, product surface and product core.
import {simulate} from './physics.js';

export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function percentile(sorted, q) { if (!sorted.length) return NaN; const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); }

export const UNCERTAINTY = {
  UAscale: [0.9, 1.2, 'Insulation ageing'], alphaRoof: [0.3, 0.6, 'Roof absorptance'], hOut: [17, 25, 'Outside film coefficient'],
  leakServiceFrac: [0.1, 0.5, 'In-service infiltration'], etaScale: [0.9, 1.1, 'COP Carnot fraction'], hAscale: [0.7, 1.3, 'Air–product film'],
  solarScale: [0.7, 1.0, 'Cloud / shading'], dAmbient: [-1, 1, 'Ambient ±1 K'],
};

export function runMonteCarlo({cfg, timeline, horizonS, n = 120, seed = 7, sampleS = 60, thresholds = {}}) {
  const rnd = mulberry32(seed), runs = [];
  for (let i = 0; i < n; i++) {
    const overrides = {};
    for (const [k, [lo, hi]] of Object.entries(UNCERTAINTY)) overrides[k] = lo + (hi - lo) * rnd();
    runs.push(simulate({...cfg, overrides}, timeline, horizonS, sampleS).samples);
  }
  const T = runs[0].length, t = runs[0].map(r => r.t);
  const col = key => runs.map(r => r.map(x => x[key]));
  const bands = {returnAir: bandOf(col('returnAir')), surface: bandOf(col('surface')), core: bandOf(col('core'))};
  const prob = (key, thr) => thr == null ? null : runs.filter(r => r.some(x => x[key] > thr)).length / n;
  return {
    n, seed, t, ...bands,
    pReturnAirOver: prob('returnAir', thresholds.returnAir), pSurfaceOver: prob('surface', thresholds.product), pCoreOver: prob('core', thresholds.product),
    thresholds, uncertainty: UNCERTAINTY,
  };
  function bandOf(series) {
    const p5 = [], p50 = [], p95 = [];
    for (let j = 0; j < T; j++) { const c = series.map(s => s[j]).sort((a, b) => a - b); p5.push(percentile(c, .05)); p50.push(percentile(c, .5)); p95.push(percentile(c, .95)); }
    return {p5, p50, p95};
  }
}
