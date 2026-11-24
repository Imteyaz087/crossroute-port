import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventLog, verifyChain, parseNDJSON, GENESIS, EVENT_TYPES} from '../scene/event-log.js';

async function sample() {
  const log = createEventLog({persist: false, session: 'test', now: () => '2026-11-25T00:00:00.000Z'});
  for (const [i, type] of ['plug', 'unplug', 'genset_start', 'gate_in', 'door_open', 'gate_out', 'EIR_signed', 'alarm', 'ack', 'setpoint_change'].entries())
    await log.append(type, {i, note: `event ${type}`}, {tSim: i * 60});
  return log;
}

test('all required custody event types are accepted', () => {
  for (const t of ['plug', 'unplug', 'genset_start', 'door_open', 'gate_in', 'gate_out', 'EIR_signed', 'setpoint_change', 'alarm', 'ack']) assert.ok(EVENT_TYPES.includes(t), t);
});

test('in-memory fallback is used when IndexedDB is absent, and the chain verifies', async () => {
  const log = createEventLog({session: 'nodb'});
  await log.append('plug', {loc: 'rack'});
  assert.equal(log.backend, 'memory');
  const log2 = await sample();
  const r = await log2.verify();
  assert.equal(r.ok, true); assert.equal(r.checked, 10); assert.equal(log2.list()[0].prev, GENESIS);
});

test('records are frozen (append-only in memory)', async () => {
  const log = await sample();
  assert.throws(() => { log.list()[2].payload.i = 99; }, TypeError);
});

test('tamper detection: edited payload, deleted record, reordered records, forged hash', async () => {
  const ev = (await sample()).list().map(e => JSON.parse(JSON.stringify(e)));
  const edited = structuredClone(ev); edited[4].payload.note = 'changed';
  assert.deepEqual([(await verifyChain(edited)).ok, (await verifyChain(edited)).firstBadSeq], [false, 4]);
  const deleted = structuredClone(ev); deleted.splice(3, 1);
  assert.equal((await verifyChain(deleted)).ok, false);
  const swapped = structuredClone(ev); [swapped[5], swapped[6]] = [swapped[6], swapped[5]];
  assert.equal((await verifyChain(swapped)).ok, false);
  const forged = structuredClone(ev); forged[7].payload.value = 1; forged[7].hash = 'f'.repeat(64);
  const r = await verifyChain(forged); assert.equal(r.ok, false); assert.equal(r.firstBadSeq, 7);
});

test('NDJSON export round-trips and still verifies', async () => {
  const log = await sample();
  const back = parseNDJSON(log.exportNDJSON());
  assert.equal(back.length, 10);
  assert.equal((await verifyChain(back)).ok, true);
});

test('unknown event types are rejected', async () => {
  const log = createEventLog({persist: false});
  await assert.rejects(log.append('teleport', {}), TypeError);
});
