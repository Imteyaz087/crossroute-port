// Single source of simulated time. Replaces the hard-coded 120× that was repeated in
// telemetry.js, app.js and model-record.js. Units: seconds.
export const SPEEDS = [60, 120, 300, 900];
export function createSimClock(scale = 300) {
  const c = {
    t: 0, scale,
    setScale(x) { if (SPEEDS.includes(x)) c.scale = x; },
    /** Advance by a wall-clock delta (s); returns the simulated delta (s). */
    tick(dtWall) { if (!Number.isFinite(dtWall) || dtWall <= 0) return 0; const d = Math.min(dtWall, 0.25) * c.scale; c.t += d; return d; },
    reset() { c.t = 0; },
    format(t = c.t) { const s = Math.max(0, Math.floor(t)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`; },
  };
  return c;
}
