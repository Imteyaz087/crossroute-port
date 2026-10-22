import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../port-scene.js");
const scene = globalThis.CrossRoutePortScene;

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const renderer = readFileSync(new URL("../port-scene.js", import.meta.url), "utf8");

test("normal, delay, and recovery renderer states come directly from the shared model result", () => {
    const result = { valid: true, finalC: -18.54, peakC: -18.54, referenceC: -15, state: "within_reference", recoveryMinutes: 0, shorePowerKwAssumption: null };
    const normal = scene.createSceneState("normal", result);
    assert.equal(normal.scenario, "normal");
    assert.equal(normal.finalC, result.finalC);
    assert.equal(normal.withinReference, true);

    const delayed = scene.createSceneState("delay", { ...result, finalC: -17.4, peakC: -17.4, state: "within_reference" });
    assert.equal(delayed.scenario, "delay");
    assert.equal(delayed.finalC, -17.4);
    assert.equal(delayed.recoveryMinutes, 0);

    const recovered = scene.createSceneState("recovery", { ...result, finalC: -18.54, peakC: -17.58, recoveryMinutes: 14, shorePowerKwAssumption: 10 });
    assert.equal(recovered.scenario, "recovery");
    assert.equal(recovered.recoveryMinutes, 14);
    assert.equal(recovered.shorePowerKwAssumption, 10);
});

test("unsafe, invalid, and unsupported renderer inputs fail closed", () => {
    const unsafe = scene.createSceneState("delay", { valid: true, finalC: -10, peakC: -10, referenceC: -15, state: "exceeds_reference" });
    assert.equal(unsafe.withinReference, false);
    assert.equal(scene.createSceneState("recovery", { valid: false, finalC: NaN, peakC: NaN, referenceC: -15 }).valid, false);
    assert.equal(scene.createSceneState("autonomous", { valid: true, finalC: 0, peakC: 0, referenceC: 1 }).valid, false);
});

test("scene manifest covers the requested harbor, crane, cold store, cutaway, shore power, and route", () => {
    for (const part of ["harbor-water", "quay-and-road", "gantry-crane", "cold-warehouse", "container-stacks", "refrigerated-truck", "container-cutaway-and-cargo", "shore-power-unit", "scenario-route"]) {
        assert.ok(scene.SCENE_MANIFEST.includes(part), `missing scene part: ${part}`);
    }
});

test("WebGL remains original, accessible, scenario-driven, and has reduced-motion/2D fallback", () => {
    assert.match(renderer, /getContext\(["']webgl["']/);
    assert.match(renderer, /prefers-reduced-motion/);
    assert.match(renderer, /createSceneState\(next\.scenario,next\.result\)/);
    assert.match(renderer, /pointerdown/);
    assert.match(renderer, /ArrowLeft/);
    assert.doesNotMatch(renderer, /unpkg\.com|jsdelivr\.net|spline\.design/i);
    assert.match(html, /id="portWebGLCanvas"[^>]*tabindex="0"[^>]*aria-label=/);
    assert.match(html, /id="port2dView" hidden/);
    assert.match(html, /showPortView\('2d'\)/);
    assert.match(html, /automatically when WebGL is unavailable or reduced motion is preferred/);
    assert.match(html, /no live telemetry or dispatch connection/);
    assert.match(html, /<script src="crossroute\.min\.js"><\/script>\s*<script src="port-scene\.js"><\/script>/);
    assert.match(renderer, /root\.updatePhysics = function/);
    assert.match(renderer, /renderer\.update\(\{ scenario: state\.scenario, result: state\.modelResult \}\)/);
    assert.match(renderer, /if \(useFallback && !\(query && query\.matches\)\) return originalDrawMap\.apply/);
});
