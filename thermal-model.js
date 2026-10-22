/* Shared illustrative thermal model. This is not operational or compliance evidence. */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.CrossRouteThermalModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const SHORE_POWER_KW_ASSUMPTION = 10;
    const RECOVERY_MINUTES = 14;
    const SOLAR_LOAD_W_ASSUMPTION = 4470;
    const TARE_HEAT_CAPACITY_J_PER_C = 2058000;

    function snapshotKey(input) {
        return JSON.stringify({
            scenario: input.scenario,
            cargoKey: input.cargoKey,
            ambientC: input.ambientC,
            payloadTon: input.payloadTon,
            durationMin: input.durationMin,
            leakRateWPerK: input.leakRateWPerK
        });
    }

    function evaluate(input, cargo) {
        const values = [input.ambientC, input.payloadTon, input.durationMin, input.leakRateWPerK,
            cargo && cargo.prechill, cargo && cargo.critical, cargo && cargo.cp];
        if (!cargo || !["normal", "delay", "recovery"].includes(input.scenario) ||
            values.some(value => !Number.isFinite(value)) || input.payloadTon <= 0 ||
            input.durationMin <= 0 || input.leakRateWPerK < 0 || cargo.cp <= 0) {
            return { valid: false, state: "invalid", reason: "Inputs are missing or outside the model's numeric domain." };
        }

        const disconnectedMinutes = input.scenario === "recovery"
            ? Math.min(input.durationMin, 90)
            : input.durationMin;
        const recoveryMinutes = input.scenario === "recovery"
            ? Math.max(0, input.durationMin - disconnectedMinutes)
            : 0;
        const heatIngressW = input.leakRateWPerK * (input.ambientC - cargo.prechill) + SOLAR_LOAD_W_ASSUMPTION;
        if (!Number.isFinite(heatIngressW) || heatIngressW < 0) {
            return { valid: false, state: "invalid", reason: "Calculated heat ingress is outside the model's numeric domain." };
        }

        const heatCapacityJPerC = input.payloadTon * 1000 * cargo.cp + TARE_HEAT_CAPACITY_J_PER_C;
        const ingressJ = heatIngressW * disconnectedMinutes * 60;
        const peakC = cargo.prechill + ingressJ / heatCapacityJPerC;
        const recoveryNetW = Math.max(0, SHORE_POWER_KW_ASSUMPTION * 1000 - heatIngressW);
        const removedJ = recoveryNetW * recoveryMinutes * 60;
        const finalC = peakC - removedJ / heatCapacityJPerC;
        const withinReference = finalC <= cargo.critical;

        return {
            valid: true,
            state: withinReference ? "within_reference" : "exceeds_reference",
            scenario: input.scenario,
            initialC: cargo.prechill,
            peakC,
            finalC,
            referenceC: cargo.critical,
            marginC: cargo.critical - finalC,
            heatIngressW,
            heatIngressJ: ingressJ,
            heatRemovedJ: removedJ,
            heatCapacityJPerC,
            disconnectedMinutes,
            recoveryMinutes,
            shorePowerKwAssumption: recoveryMinutes > 0 ? SHORE_POWER_KW_ASSUMPTION : null,
            scenarioKey: snapshotKey(input),
            evidenceType: "illustrative_model_estimate",
            complianceClaim: false
        };
    }

    function isSnapshotCurrent(snapshot, currentInput) {
        return Boolean(snapshot && snapshot.scenarioKey && snapshot.scenarioKey === snapshotKey(currentInput));
    }

    return { evaluate, isSnapshotCurrent, snapshotKey };
});
