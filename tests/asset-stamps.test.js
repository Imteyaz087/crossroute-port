import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { moduleGraph, stampedHtml } from "../scripts/stamp-assets.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("index.html version stamps match the current files", () => {
    assert.equal(html, stampedHtml(html), "run: node scripts/stamp-assets.mjs");
});

test("every local module the page loads is stamped in the import map", () => {
    const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
    for (const file of moduleGraph().filter(f => f !== "app.js")) assert.match(map[`./${file}`] ?? "", /\?v=[a-f0-9]{12}$/, file);
    assert.match(html, /<script type="module" src="\.\/app\.js\?v=[a-f0-9]{12}"><\/script>/);
    assert.match(html, /<link rel="stylesheet" href="\.\/styles\.css\?v=[a-f0-9]{12}">/);
});
