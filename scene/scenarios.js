// Scripted custody timelines (minutes). Every event is a demonstration, not a port
// observation. Terminal 7 geometry and procedures are schematic: confirm with the
// operator before treating any step as real practice. 'mobile_power_start' becomes
// genset_start or ev_supply_start depending on the selected mobile power source.
const YARD = {loc: 'Yard reefer rack', custodian: 'Terminal (yard)'};
const XFER = {loc: 'Truck transfer zone', custodian: 'Terminal → trucker (no EIR yet)'};
const QUEUE = {loc: 'Out-gate queue', custodian: 'Trucker (EIR pending)'};
const pickup = (queueMin, extra = []) => [
  {tMin: 0, type: 'plug', payload: {...YARD, handling: false, moving: false, note: 'Reefer on yard plug rack'}},
  {tMin: 20, type: 'unplug', payload: {...YARD, handling: true, note: 'Unplugged for yard-crane move to transfer zone'}},
  {tMin: 30, type: 'note', payload: {...XFER, handling: true, note: 'Box landed on chassis'}},
  {tMin: 32, type: 'mobile_power_start', payload: {...XFER, handling: false, note: 'Mobile reefer power connected'}},
  {tMin: 35, type: 'gate_in', payload: {...QUEUE, moving: false, note: `Joined out-gate queue (${queueMin} min, scenario input)`}},
  ...extra,
  {tMin: 35 + queueMin, type: 'gate_out', payload: {loc: 'Smart out-gate', custodian: 'Trucker (EIR pending)', handling: false, moving: true}},
  {tMin: 36 + queueMin, type: 'EIR_signed', payload: {loc: 'Smart out-gate', custodian: 'Trucker (EIR signed)', sealId: 'SIM-SEAL-000123'}},
  {tMin: 40 + queueMin, type: 'note', payload: {loc: 'Left terminal', custodian: 'Trucker', moving: false, note: 'Left terminal · road leg not modelled (traction energy stops here)'}},
];

export const SCENARIOS = [
  {id: 'transit', title: 'Import pickup · 45-min gate queue', short: 'Pickup 45 min',
    body: 'Yard rack → unplug → transfer zone → mobile power → 45-min out-gate queue → EIR. Watch the unpowered gap and the custody window the EIR does not cover.',
    horizonMin: 180, focus: 'overview', props: {gate: true}, timeline: pickup(45),
    events: ['Unpowered gap: unplug → mobile power (12 min)', 'EIR covers the gate moment only', 'Mobile power: EV battery or diesel clip-on (select in panel)']},
  {id: 'crane', title: 'Inspection move · missed re-plug', short: 'Missed re-plug',
    body: 'Box unplugged for an inspection move, doors opened, then left on the rack without power for ~2 h before re-plug. Return air crosses −12 °C and −18 °C long before the product core moves.',
    horizonMin: 240, focus: 'core', props: {cutaway: true}, timeline: [
      {tMin: 0, type: 'plug', payload: {...YARD, handling: false}},
      {tMin: 20, type: 'unplug', payload: {...YARD, handling: true, note: 'Unplugged for inspection move'}},
      {tMin: 35, type: 'door_open', payload: {loc: 'Inspection bay', custodian: 'Inspection (broker present)', handling: true, durationS: 600, exchangeFrac: 0.6}},
      {tMin: 50, type: 'note', payload: {...YARD, handling: false, note: 'Returned to rack · re-plug missed'}},
      {tMin: 165, type: 'plug', payload: {...YARD, handling: false, note: 'Re-plugged after alarm'}},
    ], events: ['Door opening: 10 min, 60% air exchange (estimate)', 'Return-air alarms vs product alarms', 'Degree-minutes accumulate while above limit']},
  {id: 'gate', title: 'Gate-queue stress · 90 min', short: 'Queue 90 min',
    body: 'Same pickup with a 90-minute out-gate queue. Compare EV tractor battery drain (inverter + aux) with a diesel clip-on genset (fuel), using the selector in the panel.',
    horizonMin: 200, focus: 'battery', props: {gate: true}, timeline: pickup(90),
    events: ['ΔSoC = E / usable kWh', 'Genset fuel: idle + L/kWh (estimate)', 'Queue minutes do not trigger day-based demurrage by themselves']},
  {id: 'shore', title: 'Plug-rack recovery after 60-min gap', short: 'Re-plug recovery',
    body: 'One hour unpowered on the rack, then re-plugged. Recovery is computed from the capacity map; prior exceedances stay in the log.',
    horizonMin: 240, focus: 'carrier', props: {shore: true, cutaway: true}, timeline: [
      {tMin: 0, type: 'plug', payload: {...YARD}},
      {tMin: 10, type: 'unplug', payload: {...YARD, handling: false, note: 'Power lost at rack (scenario)'}},
      {tMin: 70, type: 'plug', payload: {...YARD, note: 'Re-plugged'}},
    ], events: ['Capacity map: PrimeLINE 6.6 kW @ −18 °C / 38 °C', 'COP falls with condenser-air temperature', 'Exceedance history is never erased']},
  {id: 'esg', title: 'Seal check at gate · record review', short: 'Seal check + record',
    body: 'Pickup with a 5-minute door opening for a seal check at the gate. Then verify the hash-chained event log and export NDJSON or the model record.',
    horizonMin: 180, focus: 'canbus', props: {}, timeline: pickup(45, [{tMin: 60, type: 'door_open', payload: {loc: 'Out-gate inspection lane', custodian: 'Trucker (EIR pending)', handling: true, durationS: 300, exchangeFrac: 0.4}}]),
    events: ['SHA-256 hash chain · verify / tamper test', 'Unsigned: detects edits, does not prove authorship', 'Not an ISO 14083 certificate or compliance finding']},
];
