# CrossRoute cold-chain scenario demo

CrossRoute is an interactive illustrative model for exploring refrigerated-container temperature scenarios. The GitHub Pages site is a product concept demo, not an operating dispatch service or a validated physical digital twin.

**示意情境展示 · Illustrative scenario demo.** Temperatures, cargo properties, energy, fuel, costs, savings, emissions, events, and CAN examples are assumptions or model estimates. They are not port, cargo, vehicle, customer, or driver observations. The interface does not issue dispatch authorization, regulatory/compliance findings, certificates, commercial offers, or guaranteed outcomes.

The main port visual is an original, dependency-free WebGL scene with orbit controls, harbor geometry, a Qijin-side breakwater and fairway cue, two terminal berth banks, a stationary illustrative vessel, cold-hub bays, a bidirectional tunnel, crane motion, and 16 individually labeled deterministic demo vehicles with route tails. The reefer cutaway, heat-ingress cues and cargo color read the same illustrative model state as the dashboard. Geometry, moving vehicles, and all scenario values are demo illustrations, not live telemetry, dispatch authorization, a physical digital twin, or real-world validation. Reduced-motion preferences keep the 3D view static while retaining user-controlled orbit; a 2D Canvas fallback remains available when WebGL is unavailable.

The normal, delay, and recovery controls share one model state across the scenario readout, HUD, WebGL visual, thermal explainer, and unsigned demo report. Recovery uses a clearly labeled 10 kW shore-power assumption. An optional user-triggered weather input may change ambient temperature; it is not port or vehicle telemetry. The default Overview is a north-oriented, high-angle orthographic bird's-eye camera: it frames the channel, both terminal banks, stationary vessel, cold hub and deterministic demo fleet on wide and portrait screens, while retaining visible 3D height and shading. Drag orbit remains available. Cutaway frames the open reefer, model-colored cargo, near-side heat-ingress cues and assumed recovery-power lead. A readable model card docked immediately below the canvas, within the same scene panel, shows the selected cargo, final/peak temperature, reference, heat estimate and recovery duration/power from the dashboard's shared model; it does not calculate separate thermal values. The redundant lower SVG is hidden only while 3D is active and is restored for selected/unavailable/context-lost 2D fallback. All legacy thermal IDs and dashboard updates remain mounted; charts and controls stay in the normal readable dashboard.

Use the Bird's-eye Overview/Cutaway buttons or, with the canvas focused, 1/2 (Escape resets Overview), arrow keys to orbit and +/− to zoom. Focus changes are immediate even with reduced motion. Switching 2D/3D preserves the selected focus. The `port-scene.js?v=…` URL uses the SHA-256 of the exact renderer bytes; refresh that value after editing the renderer.

Runtime tests use a deterministic WebGL/DOM mock to exercise camera matrices, model binding, visibility, reduced motion, context loss and cache-version identity. They do not establish GPU/browser visual acceptance; inspect the public page on a WebGL-capable browser after deployment.

## Run the checks

```sh
node --test tests/*.test.js
node --check crossroute.bundle.js
node --check crossroute.min.js
node --check thermal-model.js
node --check port-scene.js
```

`crossroute.bundle.js` is the readable browser source; `crossroute.min.js` is its minified counterpart loaded by `index.html`. Rebuild the minified file with the repository's existing esbuild tool when changing the readable bundle.
