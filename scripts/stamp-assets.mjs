// Stamps every local file the page loads with a hash of its contents, so a browser
// fetches a changed file at once instead of reusing its cached copy (GitHub Pages
// lets browsers keep files for 10 minutes). Unchanged files keep their stamp and stay cached.
//
//   node scripts/stamp-assets.mjs           rewrite index.html
//   node scripts/stamp-assets.mjs --check   exit 1 if any stamp is out of date
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, normalize, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'index.html');
const CDN = {
  three: 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js',
  'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/',
};

const stamp = file => createHash('sha256').update(readFileSync(join(ROOT, file))).digest('hex').slice(0, 12);
const IMPORT = /\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]|\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)|^\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/gm;

// Every local module reachable from the entry, as root-relative paths.
export function moduleGraph(entry = 'app.js') {
  const seen = new Set(), queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const m of readFileSync(join(ROOT, file), 'utf8').matchAll(IMPORT)) {
      const spec = m[1] || m[2] || m[3];
      queue.push(relative(ROOT, normalize(join(ROOT, dirname(file), spec))));
    }
  }
  return [...seen].sort();
}

export function stampedHtml(html = readFileSync(INDEX, 'utf8')) {
  const modules = moduleGraph();
  const imports = {...CDN};
  for (const file of modules) if (file !== 'app.js') imports[`./${file}`] = `./${file}?v=${stamp(file)}`;
  const map = `<script type="importmap">${JSON.stringify({imports})}</script>`;
  const out = html
    .replace(/<script type="importmap">[\s\S]*?<\/script>/, map)
    .replace(/(<link rel="stylesheet" href="\.\/styles\.css)(\?v=[a-f0-9]+)?"/, `$1?v=${stamp('styles.css')}"`)
    .replace(/(<script type="module" src="\.\/app\.js)(\?v=[a-f0-9]+)?"/, `$1?v=${stamp('app.js')}"`);
  for (const [name, re] of [['import map', /type="importmap"/], ['styles.css link', /styles\.css\?v=/], ['app.js script', /app\.js\?v=/]])
    if (!re.test(out)) throw new Error(`index.html: could not find the ${name}`);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = readFileSync(INDEX, 'utf8'), next = stampedHtml(html);
  if (process.argv.includes('--check')) {
    if (html !== next) { console.error('index.html stamps are out of date: run node scripts/stamp-assets.mjs'); process.exit(1); }
    console.log('index.html stamps are current');
  } else {
    if (html !== next) writeFileSync(INDEX, next);
    console.log(html === next ? 'index.html already current' : 'index.html stamped');
  }
}
