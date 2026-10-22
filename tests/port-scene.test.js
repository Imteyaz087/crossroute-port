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
    assert.equal(fleet.filter(vehicle => !vehicle.moving).length, 4);
    assert.equal(fleet.filter(vehicle => vehicle.direction === 1).length, 8);
    assert.equal(fleet.filter(vehicle => vehicle.direction === -1).length, 8);
    assert.ok(fleet.every(vehicle => vehicle.trailLength === 14));
    assert.deepEqual(fleet, scene.createDemoFleet());
    for (const element of ["illustrative-16-vehicle-fleet", "individual-vehicle-trails", "animated-tunnel-cues", "animated-crane-trolley", "qijin-breakwater", "navigational-channel"]) {
        assert.ok(scene.SCENE_MANIFEST.includes(element));
    }
    assert.match(renderer, /for\(let k=0;k<3;k\+\+\)/);
    assert.match(renderer, /for\(const direction of \[1,-1\]\)/);
    assert.match(renderer, /const timeSeconds=motionOkay\(\)\?now\/1000:0/);
    assert.match(renderer, /modelState\.scenario==="delay"\?4000:1600/);
    assert.match(renderer, /const path=routePoints\.map\(\(\[x,z\]\)=>\[x,0\.235,z\]\)/);
    assert.match(renderer, /const routePoints=DEMO_ROUTE_POINTS/);
    assert.match(renderer, /orientedBox\(fleetData,[\s\S]*?heading\)/);
    assert.match(renderer, /ahead=getDemoRoutePosition\(motion\.progress\+motion\.direction\*0\.001/);
    assert.match(renderer, /for\(let i=0;i<12;i\+\+\)/);
    assert.match(renderer, /for\(let i=0;i<9;i\+\+\)/);
    assert.match(renderer, /heatColor=!modelState\.valid/);
    assert.match(html, /scene motion\/highlights represent the selected model scenario only/i);
    assert.match(html, /CMC-ET35-100–115/);
});

test("shared illustrative route stays outside the cold-store footprint and turns vehicles with its tangent", () => {
    const fleet=scene.createDemoFleet();
    const warehouse={minX:2.4,maxX:6.1,minZ:3.175,maxZ:5.225};
    for(const seconds of [0,3,20,60]) for(const vehicle of fleet) {
        const pose=scene.getDemoFleetPose(vehicle,seconds);
        const halfX=Math.abs(Math.cos(pose.heading))*0.36+Math.abs(Math.sin(pose.heading))*0.135;
        const halfZ=Math.abs(Math.sin(pose.heading))*0.36+Math.abs(Math.cos(pose.heading))*0.135;
        const overlaps=pose.x+halfX>=warehouse.minX&&pose.x-halfX<=warehouse.maxX&&pose.z+halfZ>=warehouse.minZ&&pose.z-halfZ<=warehouse.maxZ;
        assert.equal(overlaps,false,`${vehicle.id} intersects the illustrative warehouse at t=${seconds}s`);
    }
    const atBend=scene.getDemoFleetPose({moving:false,progress:0.70,lane:1,direction:1},0);
    assert.ok(Math.abs(atBend.heading)>0.1,"vehicle heading follows the bent route tangent");
    assert.match(renderer,/function orientedBox\(/);
    assert.match(renderer,/function orientedWheel\(/);
});

test("model updates force a reduced-motion redraw and radar sweep clears quay and road surfaces", () => {
    assert.match(renderer,/if\(!force&&now-lastFrame<33\) return/);
    assert.match(renderer,/function renderOnce\(\)\{draw\(performance\.now\(\)\+40,true\);\}/);
    assert.match(renderer,/sweepEnd=\[-4\.6\+Math\.cos\(sweepAngle\)\*1\.4,0\.24,/);
    assert.match(renderer,/ribbon\(motionData,\[-4\.6,0\.24,4\.45\]/);
    assert.match(renderer,/wheel\(staticData,x,0\.30,z,0\.27,0\.15,C\.rubber,14\)/);
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
    assert.match(renderer, /createSceneState\(next\.scenario,next\.result,next\.cargo\)/);
    assert.match(renderer, /pointerdown/);
    assert.match(renderer, /ArrowLeft/);
    assert.doesNotMatch(renderer, /unpkg\.com|jsdelivr\.net|spline\.design/i);
    assert.match(html, /id="portWebGLCanvas"[^>]*tabindex="0"[^>]*aria-label=/);
    assert.match(html, /id="port2dView" hidden/);
    assert.match(html, /canvas#portWebGLCanvas\[hidden\], canvas#portCanvas\[hidden\] \{ display: none !important; \}/);
    assert.match(html, /showPortView\('2d'\)/);
    assert.match(html, /when WebGL is unavailable/);
    assert.match(html, /no live telemetry or dispatch connection/);
    assert.match(html, /<script src="crossroute\.min\.js"><\/script>\s*<script src="port-scene\.js\?v=[a-f0-9]{64}"><\/script>/);
    assert.match(renderer, /root\.updatePhysics = function/);
    assert.match(renderer, /renderer\.update\(next\)/);
    assert.match(renderer, /if \(useFallback && !\(query && query\.matches\)\) return originalDrawMap\.apply/);
    assert.match(renderer, /if\(fleetLabels\)fleetLabels\.hidden=useFallback/);
});
