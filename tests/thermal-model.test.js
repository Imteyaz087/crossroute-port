import test from "node:test";
import assert from "node:assert/strict";
import "../thermal-model.js";
const model = globalThis.CrossRouteThermalModel;

const meat = { prechill: -19.5, critical: -15, cp: 1800 };
const base = { scenario: "normal", cargoKey: "frozen_meat", ambientC: 32, payloadTon: 20, durationMin: 38, leakRateWPerK: 45 };

test("normal scenario returns one illustrative estimate within the input reference", () => {
    const result = model.evaluate(base, meat);
    assert.equal(result.valid, true);
    assert.equal(result.state, "within_reference");
    assert.equal(result.complianceClaim, false);
    assert.ok(result.finalC < result.referenceC);
});

test("delay scenario estimates the longer unpowered interval from the same inputs", () => {
    const result = model.evaluate({ ...base, scenario: "delay", durationMin: 90 }, meat);
    assert.equal(result.scenario, "delay");
    assert.equal(result.disconnectedMinutes, 90);
    assert.equal(result.state, "within_reference");
    assert.ok(result.peakC > model.evaluate(base, meat).finalC);
});

test("recovery scenario models delay followed by explicitly assumed shore power", () => {
    const result = model.evaluate({ ...base, scenario: "recovery", durationMin: 104 }, meat);
    assert.equal(result.disconnectedMinutes, 90);
    assert.equal(result.recoveryMinutes, 14);
    assert.equal(result.shorePowerKwAssumption, 10);
    assert.ok(result.finalC < result.peakC);
});

test("unsafe modeled temperature is reported as exceeding the reference, not a compliance verdict", () => {
    const result = model.evaluate({ ...base, scenario: "delay", durationMin: 120, ambientC: 42, payloadTon: 5 }, meat);
    assert.equal(result.state, "exceeds_reference");
    assert.equal(result.complianceClaim, false);
});

test("invalid, non-finite, and unsupported scenario inputs fail closed", () => {
    assert.equal(model.evaluate({ ...base, ambientC: NaN }, meat).state, "invalid");
    assert.equal(model.evaluate({ ...base, payloadTon: 0 }, meat).state, "invalid");
    assert.equal(model.evaluate({ ...base, scenario: "unknown" }, meat).state, "invalid");
    assert.equal(model.evaluate(base, null).state, "invalid");
});

test("report snapshot becomes stale when any modeled input changes", () => {
    const result = model.evaluate(base, meat);
    assert.equal(model.isSnapshotCurrent(result, base), true);
    assert.equal(model.isSnapshotCurrent(result, { ...base, durationMin: 39 }), false);
});
