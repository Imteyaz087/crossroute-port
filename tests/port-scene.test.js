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

test("3D parity keeps 16 reproducible per-vehicle instances, original IDs, states, and trail depth", () => {
    const fleet = scene.createDemoFleet();
    assert.equal(fleet.length, 16);
    assert.equal(fleet[0].id, "CMC-ET35-100");
    assert.equal(fleet[15].id, "CMC-ET35-115");
    assert.equal(fleet.filter(vehicle => vehicle.moving).length, 12);
    assert.ok(fleet.every(vehicle => vehicle.trailLength === 14));
    assert.deepEqual(fleet, scene.createDemoFleet());
    for (const element of ["illustrative-16-vehicle-fleet", "individual-vehicle-trails", "animated-tunnel-cues", "animated-crane-trolley", "qijin-breakwater", "navigational-channel"]) {
        assert.ok(scene.SCENE_MANIFEST.includes(element));
    }
    assert.match(renderer, /for\(let k=0;k<3;k\+\+\)/);
    assert.match(renderer, /for\(const direction of \[1,-1\]\)/);
    assert.match(renderer, /const speed=vehicle\.moving\?0\.025:0/);
    assert.match(renderer, /modelState\.scenario==="delay"\?4000:1600/);
    assert.match(renderer, /routePoints=\[\[-5\.25,4\.48\],\[1\.55,4\.48\],\[3\.40,3\.85\],\[4\.00,3\.05\],\[4\.00,2\.65\]\]/);
    assert.match(renderer, /for\(let i=0;i<12;i\+\+\)/);
    assert.match(renderer, /for\(let i=0;i<9;i\+\+\)/);
    assert.match(renderer, /heatColor=!modelState\.valid/);
    assert.match(html, /scene motion\/highlights represent the selected model scenario only/i);
    assert.match(html, /CMC-ET35-100–115/);
});

test("reduced motion retains an explicitly selectable static 3D view", () => {
    assert.doesNotMatch(renderer, /reducedMotion && reducedMotion\.matches\)\)\s*\{/);
    assert.match(renderer, /reduced-motion-static/);
    assert.match(renderer, /else renderOnce\(\)/);
    assert.match(html, /reduced-motion preference keeps the 3D view static/);
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
    assert.match(html, /canvas#portWebGLCanvas\[hidden\], canvas#portCanvas\[hidden\] \{ display: none !important; \}/);
    assert.match(html, /showPortView\('2d'\)/);
    assert.match(html, /when WebGL is unavailable/);
    assert.match(html, /no live telemetry or dispatch connection/);
    assert.match(html, /<script src="crossroute\.min\.js"><\/script>\s*<script src="port-scene\.js"><\/script>/);
    assert.match(renderer, /root\.updatePhysics = function/);
    assert.match(renderer, /renderer\.update\(\{ scenario: state\.scenario, result: state\.modelResult \}\)/);
    assert.match(renderer, /if \(useFallback && !\(query && query\.matches\)\) return originalDrawMap\.apply/);
});
