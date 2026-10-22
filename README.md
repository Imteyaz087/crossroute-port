# CrossRoute cold-chain scenario demo

CrossRoute is an interactive illustrative model for exploring refrigerated-container temperature scenarios. The GitHub Pages site is a product concept demo, not an operating dispatch service or a validated physical digital twin.

**示意情境展示 · Illustrative scenario demo.** Temperatures, cargo properties, energy, fuel, costs, savings, emissions, events, and CAN examples are assumptions or model estimates. They are not port, cargo, vehicle, customer, or driver observations. The interface does not issue dispatch authorization, regulatory/compliance findings, certificates, commercial offers, or guaranteed outcomes.

The main port visual is an original, dependency-free WebGL scene with orbit controls, harbor geometry, a container cutaway, and a 2D Canvas fallback. The route and thermal highlight read the same illustrative scenario result as the dashboard. Geometry, moving markers, and all scenario values are demo illustrations, not live telemetry, dispatch authorization, a physical digital twin, or real-world validation. Reduced-motion preferences select the static 2D fallback.

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
