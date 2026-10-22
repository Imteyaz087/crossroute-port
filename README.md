# CrossRoute cold-chain scenario demo

CrossRoute is an interactive illustrative model for exploring refrigerated-container temperature scenarios. The GitHub Pages site is a product concept demo, not an operating dispatch service or a validated physical digital twin.

**示意情境展示 · Illustrative scenario demo.** Temperatures, cargo properties, energy, fuel, costs, savings, emissions, events, and CAN examples are assumptions or model estimates. They are not port, cargo, vehicle, customer, or driver observations. The interface does not issue dispatch authorization, regulatory/compliance findings, certificates, commercial offers, or guaranteed outcomes.

The main port visual is an original, dependency-free WebGL scene with orbit controls, harbor geometry, a Qijin-side breakwater and fairway cue, two terminal berth banks, a stationary illustrative vessel, cold-hub bays, a bidirectional tunnel, crane motion, and 16 individually labeled deterministic demo vehicles with route tails. The reefer cutaway, heat-ingress cues and cargo color read the same illustrative model state as the dashboard. Geometry, moving vehicles, and all scenario values are demo illustrations, not live telemetry, dispatch authorization, a physical digital twin, or real-world validation. Reduced-motion preferences keep the 3D view static while retaining user-controlled orbit; a 2D Canvas fallback remains available when WebGL is unavailable.

The normal, delay, and recovery controls share one model state across the scenario readout, HUD, WebGL visual, thermal explainer, and unsigned demo report. Recovery uses a clearly labeled 10 kW shore-power assumption. An optional user-triggered weather input may change ambient temperature; it is not port or vehicle telemetry. The lower thermal explainer remains a lightweight native SVG model view.

## Run the checks

```sh
node --test tests/*.test.js
node --check crossroute.bundle.js
node --check crossroute.min.js
node --check thermal-model.js
node --check port-scene.js
```

`crossroute.bundle.js` is the readable browser source; `crossroute.min.js` is its minified counterpart loaded by `index.html`. Rebuild the minified file with the repository's existing esbuild tool when changing the readable bundle.
