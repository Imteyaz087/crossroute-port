// Operations panel renderers: custody swimlane, air-vs-core band chart, energy gauges,
// alarm table, event-log viewer and the sources/estimates drawer. Plain DOM + canvas.
import {CHANNEL_LABEL} from './alarms.js';
import {registry, DMDT_REFERENCE, SOURCES} from './params.js';

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, val] of Object.entries(attrs)) { if (k === 'class') n.className = val; else if (k === 'style') n.style.cssText = val; else if (k.startsWith('on')) n[k] = val; else n.setAttribute(k, val); }
  for (const c of kids.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
};
const fmtMin = s => `${Math.round(s / 60)}′`;
const fmtC = x => Number.isFinite(x) ? `${x.toFixed(1)}°C` : '—';

/** Build custody segments from resolved events. */
export function custodySegments(timeline, horizonS) {
  const lanes = {power: [], custodian: [], location: []}, gaps = [];
  let power = 'off', cust = '—', loc = '—', tP = 0, tC = 0, tL = 0, unplugAt = null, eirAt = null, firstUnplug = null;
  const push = (lane, from, to, label) => { if (to > from) lanes[lane].push({from, to, label}); };
  for (const e of timeline) {
    const p = e.payload || {};
    const np = {plug: 'Plug rack', unplug: 'OFF', genset_start: 'Diesel genset', ev_supply_start: 'EV battery'}[e.type];
    if (np && np !== power) { push('power', tP, e.tS, power); power = np; tP = e.tS; }
    if (p.custodian && p.custodian !== cust) { push('custodian', tC, e.tS, cust); cust = p.custodian; tC = e.tS; }
    if (p.loc && p.loc !== loc) { push('location', tL, e.tS, loc); loc = p.loc; tL = e.tS; }
    if (e.type === 'unplug') { unplugAt = e.tS; firstUnplug ??= e.tS; }
    if (['plug', 'genset_start', 'ev_supply_start'].includes(e.type) && unplugAt != null) { gaps.push({from: unplugAt, to: e.tS, kind: 'unpowered', label: `Unpowered ${fmtMin(e.tS - unplugAt)}`}); unplugAt = null; }
    if (e.type === 'EIR_signed') eirAt = e.tS;
  }
  push('power', tP, horizonS, power); push('custodian', tC, horizonS, cust); push('location', tL, horizonS, loc);
  if (unplugAt != null) gaps.push({from: unplugAt, to: horizonS, kind: 'unpowered', label: 'Unpowered (open)'});
  if (firstUnplug != null && eirAt != null && eirAt > firstUnplug) gaps.push({from: firstUnplug, to: eirAt, kind: 'eir', label: `No EIR coverage ${fmtMin(eirAt - firstUnplug)}`});
  return {lanes, gaps};
}

export function renderSwimlane(root, timeline, horizonS, tNow) {
  const {lanes, gaps} = custodySegments(timeline, horizonS), pct = t => `${Math.min(100, Math.max(0, t / horizonS * 100))}%`;
  const lane = (name, segs, cls) => el('div', {class: 'lane'}, el('span', {class: 'lane-name'}, name),
    el('div', {class: 'lane-track'}, ...segs.map(sg => el('div', {class: `seg ${cls(sg)}`, style: `left:${pct(sg.from)};width:${pct(sg.to - sg.from)}`, title: `${sg.label} · ${fmtMin(sg.from)}–${fmtMin(sg.to)}`}, sg.label))));
  const ticks = el('div', {class: 'lane'}, el('span', {class: 'lane-name'}, 'Events'), el('div', {class: 'lane-track ticks'},
    ...timeline.map(e => el('i', {class: `tick t-${e.type}`, style: `left:${pct(e.tS)}`, title: `${fmtMin(e.tS)} ${e.type}${e.payload?.note ? ' · ' + e.payload.note : ''}`}))));
  root.replaceChildren(
    lane('Power', lanes.power, sg => sg.label === 'OFF' ? 'off' : sg.label === 'Plug rack' ? 'plug' : 'mobile'),
    lane('Custody', lanes.custodian, () => 'cust'),
    lane('Location', lanes.location, () => 'loc'),
    lane('Gaps', gaps, sg => sg.kind === 'eir' ? 'gap-eir' : 'gap-off'),
    ticks,
    el('div', {class: 'lane-cursor', style: `left:calc(96px + (100% - 96px) * ${Math.min(1, tNow / horizonS)})`}),
  );
  return {lanes, gaps};
}

export function drawChart(canvas, {mc, history, horizonS, tNow, lines = [], timeline = []}) {
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1), W = canvas.clientWidth || 600, H = canvas.clientHeight || 260;
  if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const L = 46, R = 10, T = 12, B = 24;
  const vals = [...lines.map(l => l.y)];
  if (mc) vals.push(...mc.returnAir.p95, ...mc.core.p5, ...mc.returnAir.p5);
  history.forEach(h => vals.push(h.returnAir, h.core));
  let lo = Math.min(...vals.filter(Number.isFinite)), hi = Math.max(...vals.filter(Number.isFinite));
  if (!Number.isFinite(lo)) { lo = -25; hi = 0; } lo = Math.floor(lo - 1); hi = Math.ceil(hi + 1);
  const X = t => L + (W - L - R) * t / horizonS, Y = y => T + (H - T - B) * (hi - y) / (hi - lo);
  g.font = '10px ui-monospace,monospace'; g.fillStyle = '#a9b09e'; g.strokeStyle = '#3c4337'; g.lineWidth = 1;
  const step = Math.max(1, Math.round((hi - lo) / 6));
  for (let y = Math.ceil(lo); y <= hi; y += step) { g.beginPath(); g.moveTo(L, Y(y)); g.lineTo(W - R, Y(y)); g.stroke(); g.fillText(`${y}°`, 6, Y(y) + 3); }
  for (let m = 0; m <= horizonS / 60; m += 30) { g.fillText(`${m}′`, X(m * 60) - 8, H - 8); }
  const band = (b, fill, stroke) => {
    if (!b) return; const t = mc.t; g.beginPath(); t.forEach((x, i) => g.lineTo(X(x), Y(b.p95[i]))); for (let i = t.length - 1; i >= 0; i--) g.lineTo(X(t[i]), Y(b.p5[i])); g.closePath(); g.fillStyle = fill; g.fill();
    g.beginPath(); t.forEach((x, i) => (i ? g.lineTo : g.moveTo).call(g, X(x), Y(b.p50[i]))); g.strokeStyle = stroke; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]);
  };
  if (mc) { band(mc.returnAir, 'rgba(229,186,118,.22)', '#e5ba76'); band(mc.core, 'rgba(194,212,172,.25)', '#c2d4ac'); }
  for (const l of lines) { if (l.y < lo || l.y > hi) continue; g.strokeStyle = l.color; g.lineWidth = 1; g.setLineDash(l.dash || []); g.beginPath(); g.moveTo(L, Y(l.y)); g.lineTo(W - R, Y(l.y)); g.stroke(); g.setLineDash([]); g.fillStyle = l.color; g.fillText(l.label, L + 4, Y(l.y) - 3); }
  const trace = (key, color) => { g.strokeStyle = color; g.lineWidth = 2; g.beginPath(); history.forEach((h, i) => (i ? g.lineTo : g.moveTo).call(g, X(h.t), Y(h[key]))); g.stroke(); };
  trace('returnAir', '#f0c27a'); trace('surface', '#9fb7d0'); trace('core', '#d9ecc1');
  for (const e of timeline) { g.fillStyle = e.type === 'unplug' ? '#f3a28a' : e.type === 'EIR_signed' ? '#e2cb91' : '#6f7866'; g.fillRect(X(e.tS) - 1, H - B, 2, 5); }
  g.strokeStyle = '#e2cb91'; g.beginPath(); g.moveTo(X(tNow), T); g.lineTo(X(tNow), H - B); g.stroke();
}

export function renderGauges(root, s) {
  const r = s.readings; if (!r) return;
  const gauge = (label, frac, value, sub, cls = '') => el('div', {class: `gauge ${cls}`}, el('span', {}, label), el('div', {class: 'gauge-bar'}, el('i', {style: `width:${Math.max(0, Math.min(100, frac * 100))}%`})), el('strong', {}, value), el('small', {}, sub));
  const ev = s.cfg.mobile === 'ev';
  root.replaceChildren(
    gauge('EV TRACTOR SoC', r.soc, `${(r.soc * 100).toFixed(1)}%`, `${r.battUsedKWh.toFixed(2)} kWh used (reefer ${r.battReeferKWh.toFixed(2)} · aux ${r.battAuxKWh.toFixed(2)} · drive ${r.battDriveKWh.toFixed(2)}) of ${s.cfg.usableKWh} kWh usable`, ev ? (r.soc < .2 ? 'warn' : '') : 'dim'),
    gauge('DIESEL CLIP-ON FUEL', r.fuelFrac, `${r.fuelL.toFixed(1)} L`, `${r.fuelUsedL.toFixed(2)} L used · cutoff at 5% tank`, ev ? 'dim' : (r.fuelFrac < .1 ? 'warn' : '')),
    gauge('REEFER DRAW', r.Pel / 13000, `${(r.Pel / 1000).toFixed(2)} kW`, `Cooling ${(r.Qref / 1000).toFixed(2)} / cap ${(r.cap / 1000).toFixed(2)} kW · COP ${Number.isFinite(r.COP) ? r.COP.toFixed(2) : '—'}`, r.powered ? '' : 'warn'),
    gauge('QUEUE COST (MODEL)', Math.min(1, s.queueCost.totalTWD / 6000), `NT$${s.queueCost.totalTWD.toLocaleString('en-US')}`, `Plug/unplug ${s.queueCost.plugActions}× NT$${s.queueCost.plugFeesTWD} · energy NT$${s.queueCost.energyTWD} · truck time NT$${s.queueCost.truckTimeTWD}`),
  );
}

const STATE_LABEL = {normal: 'Normal', pending: 'Pending (delay)', active: 'ACTIVE', acked: 'Acked', escalated: 'ESCALATED', cleared_unacked: 'Cleared · ack needed'};
export function renderAlarms(root, rows, onAck) {
  const shown = rows.filter(a => a.state !== 'normal' || a.dm > 0);
  if (!shown.length) { root.replaceChildren(el('p', {class: 'muted'}, 'No active or latched alarms. Rules armed: ', String(rows.length), '.')); return; }
  root.replaceChildren(el('table', {class: 'tbl'}, el('thead', {}, el('tr', {}, ...['Rule', 'Channel', 'State', '°C·min', 'Clause / basis', ''].map(h => el('th', {}, h)))),
    el('tbody', {}, ...shown.map(a => el('tr', {class: `st-${a.state} sev-${a.severity}`},
      el('td', {}, a.id), el('td', {}, a.channel ? CHANNEL_LABEL[a.channel] : '—'), el('td', {}, STATE_LABEL[a.state] || a.state), el('td', {}, (a.dm || 0).toFixed(1)),
      el('td', {class: 'clause'}, `${a.clause}${a.kind === 'practice' ? ' [practice]' : a.kind === 'legal-ref' ? ' [draft-guideline ref]' : a.kind === 'legal' ? ' [regulation]' : ''}`),
      el('td', {}, ['active', 'escalated', 'cleared_unacked'].includes(a.state) ? el('button', {class: 'mini', onclick: () => onAck(a.id)}, 'Ack') : ''))))));
}

export function renderLog(root, events, fmt) {
  const last = events.slice(-60).reverse();
  root.replaceChildren(el('table', {class: 'tbl log'}, el('thead', {}, el('tr', {}, ...['#', 'Sim time', 'Type', 'Detail', 'Hash'].map(h => el('th', {}, h)))),
    el('tbody', {}, ...last.map(e => el('tr', {class: `ev-${e.type}`}, el('td', {}, e.seq), el('td', {}, fmt(e.tSim)), el('td', {}, e.type),
      el('td', {class: 'clause'}, summary(e)), el('td', {class: 'mono', title: `prev ${e.prev}\nhash ${e.hash}`}, e.hash.slice(0, 10) + '…'))))));
}
function summary(e) {
  const p = e.payload || {};
  if (e.type === 'alarm') return `${p.action} ${p.ruleId}${p.value != null ? ` @ ${p.value}` : ''}`;
  if (e.type === 'ack') return `${p.ruleId} by ${p.by}`;
  if (e.type === 'scenario_start') return `${p.scenario} · ${p.cargo} · ${p.unit} · ${p.ambientC}°C · ${p.mobile}`;
  if (e.type === 'EIR_signed') return `${p.sealId || ''} · RA ${p.displayedReturnAirC}°C · ${p.custodian || ''}`;
  return [p.loc, p.custodian, p.note, p.setpointC != null ? `SP ${p.setpointC}°C` : null].filter(Boolean).join(' · ');
}

export function renderSources(root) {
  const rows = registry(), est = rows.filter(r => r.estimate).length;
  root.replaceChildren(
    el('p', {class: 'muted'}, `${rows.length} parameters · ${est} flagged as estimates (calibrate before use). SI units. Sources are public documents; no OEM, carrier, terminal or agency has reviewed this model.`),
    el('table', {class: 'tbl'}, el('thead', {}, el('tr', {}, ...['Group', 'Parameter', 'Value', 'Unit', 'Estimate?', 'Source'].map(h => el('th', {}, h)))),
      el('tbody', {}, ...rows.map(r => el('tr', {class: r.estimate ? 'is-est' : ''}, el('td', {}, r.group), el('td', {}, r.key), el('td', {class: 'mono'}, Array.isArray(r.value) ? r.value.join(' / ') : String(r.value)), el('td', {}, r.unit), el('td', {}, r.estimate ? 'ESTIMATE' : 'sourced'), el('td', {class: 'clause'}, r.sourceText + (r.note ? ` — ${r.note}` : '')))))),
    el('h4', {}, 'Day-based charges (reference only — a 45–90 min queue does not trigger these by itself)'),
    el('table', {class: 'tbl'}, el('tbody', {}, ...DMDT_REFERENCE.map(d => el('tr', {}, el('td', {}, d.kind), el('td', {}, d.free), el('td', {}, d.tiers), el('td', {class: 'clause'}, SOURCES[d.source]))))),
  );
}
