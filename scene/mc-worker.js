// Module worker: runs the Monte Carlo off the main thread.
import {runMonteCarlo} from './montecarlo.js';
self.onmessage = e => {
  const {id, job} = e.data || {};
  try { const t0 = performance.now(); const res = runMonteCarlo(job); self.postMessage({id, ok: true, res, ms: Math.round(performance.now() - t0)}); }
  catch (err) { self.postMessage({id, ok: false, error: String(err && err.message || err)}); }
};
