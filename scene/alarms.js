// Alarm engine: four temperature channels (supply air, return air, product surface,
// product core), rules tied to the clause they come from, on-delay, 0.5 K hysteresis,
// degree-minutes, rate-of-rise, stuck-sensor detection and a latching
// ack/escalate state machine (ISA-18.2 style). Model output only: not a compliance finding.
//
// Regulatory references (verified 2026-11 against the MOHW/TFDA text):
//  • 食品良好衛生規範準則 (GHP) Art.4 附件一 (Annex 1) §3(1): frozen storage/transport
//    equipment ≤ −18 °C; chilled ≤ 7 °C and above freezing point.
//    NOTE: the request said "GHP Annex 2". That is not the right reference: the
//    temperature rule is in Annex 1 (附件一) of Art.4 (older versions: 附表一).
//  • GHP Art.8 items 6–7: box air spot-checked at receiving/loading/sorting/unloading
//    must not exceed −12 °C (frozen) or 7 °C (chilled).
//  • Product 品溫 −18 °C / 7 °C: TFDA 2023 draft cold-chain logistics guideline definitions.
//  • Tuna −55 °C (≤ −50 °C holding): industry practice (JARW), NOT a legal requirement.
//    It needs a super-freezer profile; standard reefers stop at −30…−35 °C.
import {v} from './params.js';

export const CHANNELS = ['supplyAir', 'returnAir', 'surface', 'core'];
export const CHANNEL_LABEL = {supplyAir: 'Supply air', returnAir: 'Return air', surface: 'Product surface', core: 'Product core'};
export const HYSTERESIS_K = 0.5;
export const ESCALATE_AFTER_S = 900;
export const RESOLUTION_K = 0.1; // logger resolution (estimate)

const A1 = 'GHP Art.4 附件一 (Annex 1) §3(1)';
const A8 = 'GHP Art.8 items 6–7';
const PROD = 'Product 品溫 definition, TFDA 2023 draft cold-chain guideline (draft, not law)';

export function buildRules(cargo, unit) {
  const r = [];
  const add = x => r.push({dir: 'high', delayS: 60, ...x});
  if (cargo.regime === 'frozen') {
    add({id: 'GHP_A1_FROZEN_AIR', channel: 'returnAir', threshold: -18, when: 'transport', delayS: 900, kind: 'legal', severity: 'crit', clause: `${A1}: frozen equipment ≤ −18 °C`, note: '15 min delay tolerates defrost cycles (estimate)'});
    add({id: 'GHP_A8_HANDLING_AIR', channel: 'returnAir', threshold: -12, when: 'handling', delayS: 120, kind: 'legal', severity: 'crit', clause: `${A8}: frozen box air ≤ −12 °C during handling`});
    add({id: 'PRODUCT_FROZEN_SURFACE', channel: 'surface', threshold: -18, when: 'always', kind: 'legal-ref', severity: 'crit', clause: `${PROD}: 冷凍食品 ≤ −18 °C`});
    add({id: 'PRODUCT_FROZEN_CORE', channel: 'core', threshold: -18, when: 'always', kind: 'legal-ref', severity: 'crit', clause: `${PROD}: 冷凍食品 ≤ −18 °C`});
  }
  if (cargo.regime === 'chilled') {
    add({id: 'GHP_A1_CHILLED_AIR', channel: 'returnAir', threshold: 7, when: 'transport', delayS: 900, kind: 'legal', severity: 'crit', clause: `${A1}: chilled equipment ≤ 7 °C`});
    add({id: 'GHP_A8_HANDLING_AIR', channel: 'returnAir', threshold: 7, when: 'handling', delayS: 120, kind: 'legal', severity: 'crit', clause: `${A8}: chilled box air ≤ 7 °C during handling`});
    add({id: 'PRODUCT_CHILLED_CORE', channel: 'core', threshold: 7, when: 'always', kind: 'legal-ref', severity: 'crit', clause: `${PROD}: 冷藏食品 ≤ 7 °C`});
    add({id: 'PRODUCT_CHILLED_FREEZE', channel: 'surface', dir: 'low', threshold: v(cargo.freezeC), when: 'always', kind: 'legal', severity: 'warn', clause: `${A1}: chilled above freezing point`});
  }
  if (cargo.practiceUpperC != null) {
    add({id: 'PRACTICE_TUNA_SURFACE', channel: 'surface', threshold: cargo.practiceUpperC, when: 'always', kind: 'practice', severity: 'warn', clause: 'Industry practice ≤ −50 °C (JARW). Not law.'});
    add({id: 'PRACTICE_TUNA_CORE', channel: 'core', threshold: cargo.practiceUpperC, when: 'always', kind: 'practice', severity: 'warn', clause: 'Industry practice ≤ −50 °C (JARW). Not law.'});
  }
  if (cargo.bandC) {
    add({id: 'QUALITY_HIGH', channel: 'core', threshold: cargo.bandC[1], when: 'always', kind: 'quality', severity: 'warn', clause: 'Commodity quality band (estimate); not a GHP limit'});
    add({id: 'QUALITY_CHILL_INJURY', channel: 'surface', dir: 'low', threshold: cargo.bandC[0], when: 'always', kind: 'quality', severity: 'warn', clause: 'Chilling-injury floor (estimate); not a GHP limit'});
  }
  add({id: 'SUPPLY_NOT_COOLING', channel: 'supplyAir', threshold: null, offsetFromSetpoint: 3, when: 'powered', delayS: 600, kind: 'diagnostic', severity: 'warn', clause: 'Supply air > controller setpoint + 3 K while powered (unit fault or overload)'});
  if (v(unit.minSetpointC) > v(cargo.setpointC)) {
    r.push({id: 'UNIT_CANNOT_REACH_SETPOINT', channel: null, static: true, kind: 'diagnostic', severity: 'crit', clause: `${unit.name} minimum ${v(unit.minSetpointC)} °C > cargo setpoint ${v(cargo.setpointC)} °C: super-freezer profile required`});
  }
  return r;
}

export function createAlarmEngine({cargo, unit, emit = () => {}, rorK = 2, rorWindowS = 600, stuckS = 1800}) {
  const rules = buildRules(cargo, unit);
  const st = new Map(rules.map(r => [r.id, {state: 'normal', since: 0, condSince: null, dm: 0, peakExcess: 0, raisedAt: null}]));
  const extra = new Map(); // dynamic diagnostics (ROR, STUCK_*)
  const hist = []; // [t, readings] for ROR / stuck
  const faults = {};
  let last = null;

  const quant = x => Math.round(x / RESOLUTION_K) / Math.round(1 / RESOLUTION_K);
  function sense(rd) {
    const out = {};
    for (const ch of CHANNELS) out[ch] = faults[ch] === 'stuck' && last ? last[ch] : quant(rd[ch]);
    return out;
  }
  function transition(id, rule, s, cond, clear, t, value) {
    const prevState = s.state;
    switch (s.state) {
      case 'normal': if (cond) { s.state = 'pending'; s.condSince = t; } break;
      case 'pending':
        if (!cond) { s.state = 'normal'; s.condSince = null; }
        else if (t - s.condSince >= (rule.delayS || 0)) { s.state = 'active'; s.raisedAt = t; emit('alarm', {action: 'raise', ruleId: id, channel: rule.channel, value, threshold: rule.threshold, clause: rule.clause, kind: rule.kind, severity: rule.severity}); }
        break;
      case 'active':
        if (clear) { s.state = 'cleared_unacked'; emit('alarm', {action: 'clear', ruleId: id, value, degreeMinutes: +s.dm.toFixed(2)}); }
        else if (t - s.raisedAt >= ESCALATE_AFTER_S) { s.state = 'escalated'; emit('alarm', {action: 'escalate', ruleId: id, value, unackedForS: Math.round(t - s.raisedAt)}); }
        break;
      case 'escalated': if (clear) { s.state = 'cleared_unacked'; emit('alarm', {action: 'clear', ruleId: id, value, degreeMinutes: +s.dm.toFixed(2)}); } break;
      case 'acked': if (clear) { s.state = 'normal'; emit('alarm', {action: 'clear', ruleId: id, value, degreeMinutes: +s.dm.toFixed(2)}); } break;
      case 'cleared_unacked': if (cond) { s.state = 'active'; s.raisedAt = t; emit('alarm', {action: 'raise', ruleId: id, channel: rule.channel, value, threshold: rule.threshold, clause: rule.clause, kind: rule.kind, severity: rule.severity, reoccurrence: true}); } break;
    }
    if (prevState !== s.state) s.since = t;
  }

  function evaluate(rd, dt, ctx) {
    const t = rd.t, s = sense(rd);
    for (const rule of rules) {
      const S = st.get(rule.id);
      if (rule.static) { transition(rule.id, rule, S, true, false, t, null); continue; }
      const thr = rule.threshold ?? (rd.controllerSetpointC + rule.offsetFromSetpoint);
      const applies = rule.when === 'always' || (rule.when === 'handling' && ctx.handling) || (rule.when === 'transport' && !ctx.handling) || (rule.when === 'powered' && ctx.powered);
      const val = s[rule.channel];
      const excess = rule.dir === 'low' ? thr - val : val - thr;
      if (applies && excess > 0) { S.dm += excess * dt / 60; S.peakExcess = Math.max(S.peakExcess, excess); }
      const cond = applies && excess > 0, clear = !applies || excess < -HYSTERESIS_K;
      transition(rule.id, {...rule, threshold: thr}, S, cond, clear, t, val);
    }
    // Rate of rise on return air and stuck sensors.
    hist.push([t, s, rd]); while (hist.length && t - hist[0][0] > Math.max(rorWindowS, stuckS)) hist.shift();
    const dyn = (id, cond, clause, value) => {
      if (!extra.has(id)) extra.set(id, {rule: {id, channel: id.startsWith('STUCK_') ? id.slice(6) : 'returnAir', delayS: 0, kind: 'diagnostic', severity: 'warn', clause}, s: {state: 'normal', since: t, condSince: null, dm: 0, peakExcess: 0, raisedAt: null}});
      const e = extra.get(id); transition(id, e.rule, e.s, cond, !cond, t, value);
    };
    const old = hist.find(h => t - h[0] <= rorWindowS);
    if (old && t - old[0] >= rorWindowS * 0.9) {
      const rise = s.returnAir - old[1].returnAir;
      dyn('ROR_RETURN_AIR', rise > rorK, `Return air rising > ${rorK} K per ${rorWindowS / 60} min`, +rise.toFixed(2));
    }
    // Stuck-sensor check on the two air probes: a reading that stays flat for stuckS
    // while its sibling air probe moved > 1 K is implausible (supply and return air move
    // together whenever the unit cycles or loses power). Product probes are not checked:
    // a frozen core can legitimately stay flat for hours.
    if (hist.length && t - hist[0][0] >= stuckS * 0.98) {
      const first = hist[0], pair = {supplyAir: 'returnAir', returnAir: 'supplyAir'};
      for (const ch of ['supplyAir', 'returnAir']) {
        const flat = hist.every(h => h[1][ch] === first[1][ch]);
        const sib = pair[ch], sibMoved = Math.max(...hist.map(h => h[1][sib])) - Math.min(...hist.map(h => h[1][sib])) > 1.0;
        dyn(`STUCK_${ch}`, flat && sibMoved, `${CHANNEL_LABEL[ch]} reading flat ${stuckS / 60} min while ${CHANNEL_LABEL[sib].toLowerCase()} moved > 1 K (sensor stuck?)`, s[ch]);
      }
    }
    last = s;
    return s;
  }
  function all() {
    const rows = rules.map(r => ({...r, ...st.get(r.id)}));
    for (const [, e] of extra) rows.push({...e.rule, ...e.s});
    return rows;
  }
  function ack(id, t, by = 'operator') {
    const S = st.get(id) || extra.get(id)?.s; if (!S) return false;
    if (S.state === 'active' || S.state === 'escalated') { S.state = 'acked'; S.since = t; emit('ack', {ruleId: id, by}); return true; }
    if (S.state === 'cleared_unacked') { S.state = 'normal'; S.since = t; emit('ack', {ruleId: id, by, cleared: true}); return true; }
    return false;
  }
  return {
    rules, evaluate, all, ack,
    ackAll: (t, by) => all().filter(a => ['active', 'escalated', 'cleared_unacked'].includes(a.state)).map(a => ack(a.id, t, by)).filter(Boolean).length,
    injectFault(ch, kind) { if (kind) faults[ch] = kind; else delete faults[ch]; },
    faults,
    level() {
      const act = all().filter(a => ['active', 'escalated', 'acked', 'cleared_unacked'].includes(a.state) && a.state !== 'cleared_unacked');
      return act.some(a => a.severity === 'crit') ? 'crit' : act.length ? 'warn' : 'ok';
    },
  };
}
