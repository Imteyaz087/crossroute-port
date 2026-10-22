import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const bundle = readFileSync(new URL("../crossroute.bundle.js", import.meta.url), "utf8");
const minified = readFileSync(new URL("../crossroute.min.js", import.meta.url), "utf8");
const thermalModel = readFileSync(new URL("../thermal-model.js", import.meta.url), "utf8");

test("operational HUD, commercial, health, and emissions claims stay out of shipped assets", () => {
    const shipped = `${html}\n${bundle}\n${minified}`;
    const unsupportedClaims = [
        /AUTONOMOUS SAFETY STATE/i,
        /FSM:\s*NOMINAL/i,
        /PAID PILOT READY/i,
        /SLA\s*99\.95%/i,
        /100%\s*(?:全額|抵扣)/,
        /2\.3\s*[×x].{0,20}氣喘/,
        /(?:85|92|42)\s*dB/i,
        /核准拔除發電機/,
        /零排碳起跑/,
        /ZERO_GENSET/,
        /LFE_FuelRate:\s*0\.00\s*L\/hr/i,
        /GUARANTEED CASH SAVED/i,
        /Zero-Risk Warranty/i,
        /保固無損/,
        /新安東京海上產險背書/,
        /100% 全額無條件退款/
    ];
    for (const claim of unsupportedClaims) assert.doesNotMatch(shipped, claim);
});

test("shipped state and user-facing data are explicitly illustrative and unverified", () => {
    assert.match(html, /ILLUSTRATIVE MODEL STATE/);
    assert.match(html, /DEMO · NOT OPERATIONAL/);
    assert.match(html, /Synthetic planning assumptions only/);
    assert.match(html, /參考草案未核准/);
    assert.doesNotMatch(html, /href="CrossRoute_90Day_Commercial_Pilot_Agreement\.pdf"/);
    assert.match(html, /沒有健康資料 · 不作排放或氣喘成效主張/);
    for (const asset of [bundle, minified]) {
        assert.match(asset, /\[SIMULATED DEMO\]/);
        assert.match(asset, /SYNTHETIC DEMO/);
        assert.match(asset, /NOT OPERATIONAL/);
        assert.match(asset, /not a signature or Merkle root/i);
        assert.match(asset, /shorePowerKwAssumption/);
    }
    assert.match(thermalModel, /SHORE_POWER_KW_ASSUMPTION\s*=\s*10/);
    assert.match(html, /Recovery uses an explicitly illustrative 10 kW shore-power assumption/);
    assert.doesNotMatch(bundle, /Auto fetch weather on load/);
    assert.match(bundle, /Optional user-triggered Open-Meteo input/);
});
