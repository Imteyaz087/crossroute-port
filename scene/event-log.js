// Tamper-evident, append-only custody event log.
// Each record hashes (SHA-256, WebCrypto) its canonical body including the previous
// record's hash, so editing, deleting or reordering any record breaks verifyChain().
// Storage: IndexedDB when available, in-memory otherwise. Records are not signed:
// a hash chain detects tampering after the fact; it does not prove who wrote a record.
export const EVENT_TYPES = ['plug', 'unplug', 'genset_start', 'ev_supply_start', 'door_open', 'gate_in', 'gate_out', 'EIR_signed', 'setpoint_change', 'alarm', 'ack', 'scenario_start', 'note'];
export const GENESIS = '0'.repeat(64);

export function canonical(x) {
  if (x === null || typeof x !== 'object') return JSON.stringify(x ?? null);
  if (Array.isArray(x)) return `[${x.map(canonical).join(',')}]`;
  return `{${Object.keys(x).filter(k => x[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}`;
}
export async function sha256Hex(text) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const bodyOf = r => ({session: r.session, seq: r.seq, tSim: r.tSim, tWall: r.tWall, type: r.type, source: r.source, payload: r.payload, prev: r.prev});
export const hashRecord = r => sha256Hex(canonical(bodyOf(r)));

export async function verifyChain(events) {
  let prev = GENESIS;
  for (let i = 0; i < events.length; i++) {
    const r = events[i];
    if (r.seq !== i) return {ok: false, checked: i, firstBadSeq: i, reason: `sequence gap: expected ${i}, found ${r.seq}`};
    if (r.prev !== prev) return {ok: false, checked: i, firstBadSeq: i, reason: 'prev-hash link broken'};
    if (!EVENT_TYPES.includes(r.type)) return {ok: false, checked: i, firstBadSeq: i, reason: `unknown type ${r.type}`};
    const h = await hashRecord(r);
    if (h !== r.hash) return {ok: false, checked: i, firstBadSeq: i, reason: 'hash mismatch (record content altered)'};
    prev = r.hash;
  }
  return {ok: true, checked: events.length, firstBadSeq: null, reason: 'chain intact', head: prev};
}
export const toNDJSON = events => events.map(e => canonical(e)).join('\n') + (events.length ? '\n' : '');
export const parseNDJSON = text => text.split('\n').filter(Boolean).map(l => JSON.parse(l));

function deepFreeze(o) { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; }

function openIDB() {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open('crossroute-event-log', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('events', {keyPath: ['session', 'seq']});
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}

export function createEventLog({persist = true, session = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, now = () => new Date().toISOString()} = {}) {
  const events = [], listeners = new Set();
  let queue = Promise.resolve(), db = null, backend = 'memory';
  const ready = persist ? openIDB().then(d => { db = d; if (d) backend = 'indexeddb'; }) : Promise.resolve();
  const store = rec => new Promise(res => {
    if (!db) return res();
    try { const tx = db.transaction('events', 'readwrite'); tx.objectStore('events').add(rec); tx.oncomplete = res; tx.onerror = () => { backend = 'memory (IndexedDB write failed)'; res(); }; } catch { backend = 'memory (IndexedDB unavailable)'; res(); }
  });
  const log = {
    session,
    get backend() { return backend; },
    append(type, payload = {}, {tSim = 0, source = 'sim'} = {}) {
      if (!EVENT_TYPES.includes(type)) return Promise.reject(new TypeError(`Unknown event type: ${type}`));
      queue = queue.then(() => ready).then(async () => {
        const rec = {session, seq: events.length, tSim: Math.round(tSim), tWall: now(), type, source, payload: JSON.parse(JSON.stringify(payload)), prev: events.length ? events.at(-1).hash : GENESIS};
        rec.hash = await hashRecord(rec);
        deepFreeze(rec); events.push(rec); await store(rec);
        listeners.forEach(fn => { try { fn(rec); } catch {} });
        return rec;
      });
      return queue;
    },
    flush: () => queue,
    list: () => events.slice(),
    head: () => events.length ? events.at(-1).hash : GENESIS,
    verify: () => queue.then(() => verifyChain(events)),
    exportNDJSON: () => toNDJSON(events),
    onAppend(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  return log;
}
