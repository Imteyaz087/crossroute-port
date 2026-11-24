// Unsigned synthetic snapshot of inputs, outputs, alarms and the event-log head.
// Not an ISO 14083 certificate, compliance finding, sensor observation or signed audit record.
import {registry} from './params.js';
export function createModelRecord(tel, scenario, renderer, createdAt = new Date().toISOString()) {
  const s = tel.state, r = s.readings, rows = registry(), events = tel.log.list();
  return {
    schema: 'crossroute.synthetic-model-record.v2', createdAt,
    provenance: 'SYNTHETIC DEMO · NOT OPERATIONAL',
    disclaimer: 'Not an ISO 14083 certificate, compliance finding, sensor observation, emissions result, financial guarantee or signed audit record. No terminal operator, carrier, OEM, TIPC or Yulon endorses or uses this model.',
    scenario: scenario.id, renderer, simClock: {simulatedSeconds: Math.round(tel.clock.t), scale: tel.clock.scale},
    inputs: {...tel.cfg, unit: s.unit.id, setpointC: s.cargo.prechill, limitC: s.cargo.critical, assumedCargoValueTWD: s.cargo.valueTWD},
    outputs: {
      returnAirC: +r.returnAir.toFixed(2), supplyAirC: +r.supplyAir.toFixed(2), surfaceC: +r.surface.toFixed(2), coreC: +r.core.toFixed(2),
      peakProductC: +s.peakTemp.toFixed(2), withinLimitNow: s.withinRef, priorExceedance: s.breachOccurred, timeAboveLimitS: Math.round(s.timeAboveReferenceSeconds),
      heatLoadW: Math.round(r.Qin), coolingW: Math.round(r.Qref), electricW: Math.round(r.Pel), cop: Number.isFinite(r.COP) ? +r.COP.toFixed(3) : null,
      socPct: +(r.soc * 100).toFixed(2), battUsedKWh: +r.battUsedKWh.toFixed(3), fuelUsedL: +r.fuelUsedL.toFixed(3), queueCost: s.queueCost,
    },
    alarms: s.alarmRows.filter(a => a.state !== 'normal' || a.dm > 0).map(a => ({id: a.id, state: a.state, degreeMinutes: +(a.dm || 0).toFixed(2), clause: a.clause, kind: a.kind})),
    eventLog: {session: tel.log.session, records: events.length, headHash: tel.log.head(), storage: tel.log.backend, algorithm: 'SHA-256 hash chain over canonical JSON'},
    parameters: {count: rows.length, estimates: rows.filter(x => x.estimate).length, note: 'See sources drawer / scene/params.js'},
    emissions: null, signature: null, certified: false,
  };
}
