// Three-node lumped reefer model: box air (temperature state) + product surface and
// product core (specific-enthalpy states, so latent heat near freezing is exact and
// energy is conserved by RK4). SI units throughout: °C, W, J, kg, s.
// SYNTHETIC DEMO · NOT OPERATIONAL. Parameters and sources: ./params.js
import {ENV, CONTAINER, UNITS, CARGO, PRODUCT_SPLIT, MOBILE, v} from './params.js';

export const SIGMA = 5.670374419e-8, K0 = 273.15, RHO_AIR = 1.2, CP_AIR = 1006, L_FUSION = 333.6e3, P_ATM = 101325;

// ---------- Refrigeration unit ----------
export function capacityW(unit, TboxC, TcondInC) {
  const xs = v(unit.capTboxC), ys = v(unit.capW);
  const pts = xs.map((x, i) => [x, ys[i]]).sort((a, b) => a[0] - b[0]);
  let i = 0; while (i < pts.length - 2 && TboxC > pts[i + 1][0]) i++;
  const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
  const atRef = y0 + (y1 - y0) * (TboxC - x0) / (x1 - x0);
  const derate = Math.min(1.3, Math.max(0.2, 1 - v(unit.ambientDeratePerK) * (TcondInC - v(unit.refAmbientC))));
  return Math.max(0, atRef * derate);
}
export function cop(unit, TboxC, TcondInC) {
  const Te = TboxC - v(unit.evapApproachK) + K0, Tc = TcondInC + v(unit.condApproachK) + K0;
  return v(unit.etaII) * Te / Math.max(5, Tc - Te);
}

// ---------- Psychrometrics ----------
export function psatPa(T) { return T >= 0 ? 610.94 * Math.exp(17.625 * T / (T + 243.04)) : 611.21 * Math.exp(22.587 * T / (T + 273.86)); }
export function humidityRatio(T, rh) { const pv = rh * psatPa(T); return 0.622 * pv / (P_ATM - pv); }
export function moistAirH(T, w) { return CP_AIR * T + w * (2.501e6 + 1860 * T); }
/** Heat (J/kg dry air) to bring outside air to box condition, including frost formation. */
export function infiltrationDh(Tout, rhOut, Tin) {
  const wo = humidityRatio(Tout, rhOut), wi = Math.min(wo, humidityRatio(Tin, 1));
  const hIce = Tin < 0 ? -L_FUSION + 2100 * Tin : 4186 * Tin;
  return moistAirH(Tout, wo) - moistAirH(Tin, wi) - (wo - wi) * hIce;
}

// ---------- External loads ----------
export function solarW(pr) { const U = pr.UA / pr.meanArea; return U * pr.alpha * pr.G * (pr.roofA + pr.sideA * pr.sideFrac) / pr.hOut; }
export function asphaltW(pr) {
  const Tas = pr.Tamb + pr.asphaltRise * pr.G / 1000, U = pr.UA / pr.meanArea;
  const q = pr.eps * SIGMA * ((Tas + K0) ** 4 - (pr.Tamb + K0) ** 4);
  return U * pr.floorA * q / pr.hOut;
}

// ---------- Product enthalpy (per kg, 0 J at 0 °C liquid reference shifted) ----------
// Below Tf: ice fraction x_ice = xw(1 − Tf/T)  ⇒  c_app = cpF + L·xw·(−Tf)/T²  ⇒  H = cpF·T + L·xw·Tf/T
export function productH(c, T) {
  const Tf = c.Tf;
  if (T <= Tf) return c.cpF * T + c.Lw * Tf / T;
  return c.cpF * Tf + c.Lw + c.cpU * (T - Tf);
}
export function productT(c, H) {
  const Tf = c.Tf, Hf = c.cpF * Tf + c.Lw;
  if (H >= Hf) return Tf + (H - Hf) / c.cpU;
  const a = c.cpF, b = c.Lw * Tf; // a T² − H T + b = 0, negative root
  return (H - Math.sqrt(H * H - 4 * a * b)) / (2 * a);
}

// ---------- Model ----------
export function resolveParams(cfg = {}) {
  const o = cfg.overrides || {};
  const cargo = CARGO[cfg.cargoId || 'frozen_meat'];
  const unit = UNITS[cfg.unitId && cfg.unitId !== 'auto' ? cfg.unitId : cargo.unit];
  const Tamb = (cfg.ambientC ?? v(ENV.ambientC)) + (o.dAmbient || 0);
  const G = (cfg.solarWm2 ?? v(ENV.solarWm2)) * (o.solarScale ?? 1);
  return {
    cargo, unit, Tamb, G, rh: v(ENV.rhOut),
    UA: (unit.UA_W_per_K ? v(unit.UA_W_per_K) : v(CONTAINER.UA_W_per_K)) * (o.UAscale ?? 1),
    meanArea: v(CONTAINER.meanArea_m2), roofA: v(CONTAINER.roofArea_m2), sideA: v(CONTAINER.sideArea_m2), floorA: v(CONTAINER.floorArea_m2),
    alpha: o.alphaRoof ?? v(CONTAINER.alphaRoof), sideFrac: v(CONTAINER.sideIrradianceFrac), hOut: o.hOut ?? v(CONTAINER.hOut_W_m2K),
    eps: v(CONTAINER.emissivity), asphaltRise: v(ENV.asphaltRiseKper1000W),
    TcondIn: Tamb + v(ENV.condenserOffsetSunK) * G / 1000,
    leakM3s: v(CONTAINER.leakTest_m3h) * (o.leakServiceFrac ?? v(CONTAINER.leakServiceFrac)) / 3600,
    Ca: v(CONTAINER.airNodeC_J_per_K), V: v(CONTAINER.airVolume_m3), evapFlow: v(CONTAINER.evapAirflow_m3h) / 3600,
    doorFrac: v(CONTAINER.doorExchangeFrac),
    etaScale: o.etaScale ?? 1,
    hA: v(PRODUCT_SPLIT.hA_air_surface_W_per_K) * (o.hAscale ?? 1), Gsc: v(PRODUCT_SPLIT.G_surface_core_W_per_K),
    ms: v(cargo.massKg) * v(PRODUCT_SPLIT.surfaceFrac), mc: v(cargo.massKg) * (1 - v(PRODUCT_SPLIT.surfaceFrac)),
    prod: {cpF: v(cargo.cpFrozen), cpU: v(cargo.cpUnfrozen), Tf: v(cargo.freezeC), Lw: L_FUSION * v(cargo.waterFrac)},
    respWperKg: v(cargo.respW_per_t) / 1000,
    usableJ: (cfg.usableKWh ?? v(MOBILE.usableKWh)) * 3.6e6, invEff: v(MOBILE.inverterEff), auxW: v(MOBILE.auxW), driveW: v(MOBILE.driveW),
    tankL: v(MOBILE.gensetTankL), idleLph: v(MOBILE.gensetIdleLph), LperKWh: v(MOBILE.gensetLperKWh), cutoff: v(MOBILE.gensetCutoffFrac),
    setpointC: cfg.setpointC ?? v(cargo.setpointC), mobile: cfg.mobile || 'ev',
  };
}

export function controllerSetpoint(pr, sp = pr.setpointC) { return Math.max(sp, v(pr.unit.minSetpointC)); }

/** Instantaneous heat flows (W) for state y = [Ta, Hs, Hc, Ein, Eref, Eel]. */
export function flows(pr, y, inp) {
  const [Ta, Hs, Hc] = y, Ts = productT(pr.prod, Hs), Tc = productT(pr.prod, Hc);
  const Qwall = pr.UA * (pr.Tamb - Ta), Qsol = solarW(pr), Qasph = asphaltW(pr);
  const Qinf = RHO_AIR * pr.leakM3s * infiltrationDh(pr.Tamb, pr.rh, Ta);
  const Qfan = inp.powered ? v(pr.unit.fanW) : 0;
  const cap = inp.powered ? capacityW(pr.unit, Ta, pr.TcondIn) : 0;
  const Qref = cap * Math.min(1, Math.max(0, (Ta - inp.Tset + 0.25) / 0.5));
  const Qas = pr.hA * (Ta - Ts), Qsc = pr.Gsc * (Ts - Tc);
  const q10 = T => 2 ** ((T - 12) / 10);
  const Qrs = pr.respWperKg * pr.ms * q10(Ts), Qrc = pr.respWperKg * pr.mc * q10(Tc);
  const Qdoor = inp.doorW || 0;
  const Qin = Qwall + Qsol + Qasph + Qinf + Qfan + Qdoor + Qrs + Qrc;
  const COP = cop({...pr.unit, etaII: {value: v(pr.unit.etaII) * pr.etaScale}}, Ta, pr.TcondIn);
  const Pel = inp.powered ? Qref / COP + v(pr.unit.fanW) : 0;
  return {Ta, Ts, Tc, Qwall, Qsol, Qasph, Qinf, Qfan, Qdoor, Qref, cap, Qas, Qsc, Qrs, Qrc, Qin, COP, Pel};
}
export function deriv(pr, y, inp) {
  const f = flows(pr, y, inp);
  return [
    (f.Qwall + f.Qsol + f.Qasph + f.Qinf + f.Qfan + f.Qdoor - f.Qref - f.Qas) / pr.Ca,
    (f.Qas - f.Qsc + f.Qrs) / pr.ms,
    (f.Qsc + f.Qrc) / pr.mc,
    f.Qin, f.Qref, f.Pel,
  ];
}
export function rk4(pr, y, dt, inp) {
  const add = (a, b, s) => a.map((x, i) => x + b[i] * s);
  const k1 = deriv(pr, y, inp), k2 = deriv(pr, add(y, k1, dt / 2), inp), k3 = deriv(pr, add(y, k2, dt / 2), inp), k4 = deriv(pr, add(y, k3, dt), inp);
  return y.map((x, i) => x + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}
/** Stored thermal energy relative to 0 (J): Ca·Ta + ms·Hs + mc·Hc. */
export function storedJ(pr, y) { return pr.Ca * y[0] + pr.ms * y[1] + pr.mc * y[2]; }

/**
 * Stateful model driven by custody events. Used by the live engine, the Monte Carlo
 * worker and the node tests, so all three run identical physics.
 */
export function createModel(cfg = {}) {
  const pr = resolveParams(cfg);
  const T0 = cfg.initialC ?? pr.setpointC;
  const m = {
    pr, t: 0,
    y: [controllerSetpoint(pr), productH(pr.prod, T0), productH(pr.prod, T0), 0, 0, 0],
    source: cfg.initialSource || 'plug', setpointC: pr.setpointC,
    battJ: pr.usableJ * (cfg.soc0 ?? 0.82), fuelL: pr.tankL * (cfg.fuel0 ?? 0.6),
    battUsedJ: 0, battReeferJ: 0, battAuxJ: 0, battDriveJ: 0, fuelUsedL: 0, doorUntil: 0, doorW: 0,
    loc: 'Yard reefer rack', custodian: 'Terminal', handling: false, moving: false,
    last: null, notices: [],
  };
  const powered = () => m.source === 'plug' || m.source === 'genset' || m.source === 'ev';
  m.applyEvent = ev => {
    const p = ev.payload || {};
    if (p.loc) m.loc = p.loc; if (p.custodian) m.custodian = p.custodian;
    if ('handling' in p) m.handling = !!p.handling; if ('moving' in p) m.moving = !!p.moving;
    switch (ev.type) {
      case 'plug': m.source = 'plug'; break;
      case 'unplug': m.source = 'off'; break;
      case 'genset_start': m.source = m.fuelL > pr.tankL * pr.cutoff ? 'genset' : 'off'; break;
      case 'ev_supply_start': m.source = m.battJ > 0 ? 'ev' : 'off'; break;
      case 'setpoint_change': if (Number.isFinite(p.setpointC)) m.setpointC = p.setpointC; break;
      case 'door_open': {
        const dur = Math.max(1, p.durationS ?? 120), frac = p.exchangeFrac ?? pr.doorFrac;
        const E = RHO_AIR * pr.V * frac * infiltrationDh(pr.Tamb, pr.rh, m.y[0]);
        m.doorW = E / dur; m.doorUntil = m.t + dur; break;
      }
    }
  };
  m.step = dt => {
    const inp = {powered: powered(), Tset: controllerSetpoint(pr, m.setpointC), doorW: m.t < m.doorUntil ? m.doorW : 0};
    m.y = rk4(pr, m.y, dt, inp);
    const f = flows(pr, m.y, inp);
    if (m.source === 'ev') {
      const Jr = f.Pel / pr.invEff * dt, Ja = pr.auxW * dt, J = Jr + Ja; m.battJ -= J; m.battUsedJ += J; m.battReeferJ += Jr; m.battAuxJ += Ja;
      if (m.battJ <= 0) { m.battJ = 0; m.source = 'off'; m.notices.push({t: m.t, type: 'battery_depleted'}); }
    }
    if (pr.mobile === 'ev' && m.moving) { const J = pr.driveW * dt; m.battJ = Math.max(0, m.battJ - J); m.battUsedJ += J; m.battDriveJ += J; }
    if (m.source === 'genset') {
      const L = (pr.idleLph + pr.LperKWh * f.Pel / 1000) * dt / 3600; m.fuelL -= L; m.fuelUsedL += L;
      if (m.fuelL <= pr.tankL * pr.cutoff) { m.source = 'off'; m.notices.push({t: m.t, type: 'genset_low_fuel_cutoff'}); }
    }
    m.t += dt; m.last = f; return f;
  };
  m.readings = () => {
    const f = m.last || flows(pr, m.y, {powered: powered(), Tset: controllerSetpoint(pr, m.setpointC)});
    return {
      t: m.t, returnAir: m.y[0], supplyAir: m.y[0] - f.Qref / (RHO_AIR * CP_AIR * pr.evapFlow),
      surface: productT(pr.prod, m.y[1]), core: productT(pr.prod, m.y[2]),
      Qref: f.Qref, cap: f.cap, Pel: f.Pel, COP: f.COP, Qin: f.Qin, flows: f,
      soc: m.battJ / pr.usableJ, battUsedKWh: m.battUsedJ / 3.6e6, battReeferKWh: m.battReeferJ / 3.6e6, battAuxKWh: m.battAuxJ / 3.6e6, battDriveKWh: m.battDriveJ / 3.6e6, fuelL: m.fuelL, fuelFrac: m.fuelL / pr.tankL, fuelUsedL: m.fuelUsedL,
      source: m.source, powered: powered(), setpointC: m.setpointC, controllerSetpointC: controllerSetpoint(pr, m.setpointC),
      loc: m.loc, custodian: m.custodian, handling: m.handling, moving: m.moving,
    };
  };
  m.advance = (dtTotal, maxStep = 5) => { let left = dtTotal; while (left > 1e-9) { const h = Math.min(maxStep, left); m.step(h); left -= h; } };
  return m;
}

/** Map a scenario timeline (minutes) to concrete events for the selected mobile power source. */
export function resolveTimeline(timeline, mobile) {
  return timeline.map(e => {
    const type = e.type === 'mobile_power_start' ? (mobile === 'genset' ? 'genset_start' : 'ev_supply_start') : e.type;
    return {tS: e.tMin * 60, type, payload: {...(e.payload || {})}};
  }).sort((a, b) => a.tS - b.tS);
}

/** Run a full scenario headless; returns samples every sampleS seconds. */
export function simulate(cfg, timeline, horizonS, sampleS = 60, dt = 5) {
  const m = createModel(cfg), evs = resolveTimeline(timeline, m.pr.mobile);
  const out = []; let k = 0;
  for (let t = 0; t <= horizonS + 1e-9; t += sampleS) {
    while (k < evs.length && evs[k].tS <= t + 1e-9) m.applyEvent(evs[k++]);
    out.push(m.readings());
    if (t + sampleS <= horizonS + 1e-9) {
      // Step exactly to the next event or sample boundary.
      let tt = t; const tEnd = t + sampleS;
      while (tt < tEnd - 1e-9) {
        const nextEv = k < evs.length ? evs[k].tS : Infinity;
        const target = Math.min(tEnd, nextEv > tt ? nextEv : tEnd);
        m.advance(target - tt, dt); tt = target;
        while (k < evs.length && evs[k].tS <= tt + 1e-9) m.applyEvent(evs[k++]);
      }
    }
  }
  return {samples: out, model: m};
}
