// node --check every JS module (no build step).
import {execFileSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
const files = ['app.js', 'port-scene.js', ...readdirSync('scene').filter(f => f.endsWith('.js')).map(f => `scene/${f}`)];
let bad = 0;
for (const f of files) { try { execFileSync(process.execPath, ['--check', f], {stdio: 'pipe'}); console.log(`ok   ${f}`); } catch (e) { bad++; console.log(`FAIL ${f}\n${e.stderr}`); } }
console.log(`${files.length - bad}/${files.length} modules pass node --check`); process.exit(bad ? 1 : 0);
