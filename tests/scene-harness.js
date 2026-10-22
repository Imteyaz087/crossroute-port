// Deterministic API/DOM/WebGL-command harness: not a GPU visual-acceptance test.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../port-scene.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const model = readFileSync(new URL('../thermal-model.js', import.meta.url), 'utf8');
const bundle = readFileSync(new URL('../crossroute.bundle.js', import.meta.url), 'utf8');

export function harness({ reduced = false, adapter = false, webgl = true, shader = true, width = 900, height = 520, dashboard = false } = {}) {
    let now = 1000, buffer = null, nextId = 0, rafId = 0, fallbackDraws = 0;
    const draws = [], matrices = [], buffers = new Map(), queue = new Map(), nodes = {}, fallbackEvents = [];
    const rect = { width, height };
    function element(svg = false) {
        const listeners = {};
        const e = { style: {}, children: [], attributes: {}, listeners, textContent: '',
            setAttribute(k, v) { this.attributes[k] = String(v); }, getAttribute(k) { return this.attributes[k]; },
            hasAttribute(k) { return Object.hasOwn(this.attributes, k); }, removeAttribute(k) { delete this.attributes[k]; },
            appendChild(e) { this.children.push(e); e.parentElement = this; },
            remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(e => e !== this); this.parentElement = null; },
            getBoundingClientRect() { return rect; }, setPointerCapture() {},
            addEventListener(k, fn) { listeners[k] = fn; }, removeEventListener(k) { delete listeners[k]; },
            dispatch(k, event = {}) { listeners[k]?.(event); }
        };
        // Real HTML hidden reflects an attribute; SVG hidden is only an expando.
        if (svg === true) e.hidden = false;
        else Object.defineProperty(e, 'hidden', { get() { return this.hasAttribute('hidden'); }, set(value) { if (value) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); } });
        return e;
    }
    for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
        const e = nodes[match[1]] = element(/^<svg\b/.test(match[0]));
        if (/\shidden(?:\s|>)/.test(match[0])) e.setAttribute('hidden', '');
        e.value = match[0].match(/\bvalue="([^"]*)"/)?.[1] || '';
    }
    const parent = nodes.portSceneViewport, canvas = nodes.portWebGLCanvas;
    parent.appendChild(canvas);
    const gl = {
        createBuffer() { return ++nextId; }, bindBuffer(_, id) { buffer = id; },
        bufferData(_, data) { buffers.set(buffer, Array.from(data)); },
        drawArrays(_, start, count) { draws.push({ buffer, count, data: buffers.get(buffer).slice() }); },
        uniformMatrix4fv(_, transpose, matrix) { matrices.push(Array.from(matrix)); },
        getShaderParameter() { return shader; }, getProgramParameter() { return shader; },
        getShaderInfoLog() { return 'Mock shader failure'; }, createShader() { return {}; }, createProgram() { return {}; },
        getAttribLocation() { return 0; }, getUniformLocation() { return 0; }
    };
    for (const method of ['shaderSource', 'compileShader', 'attachShader', 'linkProgram', 'enableVertexAttribArray', 'vertexAttribPointer', 'viewport', 'enable', 'cullFace', 'clearColor', 'clear', 'useProgram', 'deleteBuffer', 'deleteProgram']) gl[method] = () => {};
    canvas.getContext = () => webgl ? gl : null;
    const motion = { matches: reduced, listener: null, addEventListener(_, fn) { this.listener = fn; }, removeEventListener() { this.listener = null; } };
    const documentListeners = {};
    const document = { readyState: 'loading', createElement: element, getElementById(id) { return adapter ? nodes[id] || null : null; }, querySelector() { return parent.children.find(e => e.className === 'port-fleet-label-overlay') || null; }, addEventListener(k, fn) { documentListeners[k] = fn; } };
    const matchMedia = () => motion;
    const window = { innerWidth: width, devicePixelRatio: 1, matchMedia, addEventListener() {}, removeEventListener() {} };
    const state = { scenario: 'normal', cargoKey: 'sample', temp: 32, payload: 20, duration: 38, leakRate: 45, modelRevision: 0, modelResult: { valid: false } };
    const cargo = { name: 'Shared cargo · 測試貨物', prechill: -19.5, critical: -15, cp: 1800 };
    const context = vm.createContext({ document, window, matchMedia, state, CARGO_DB: { sample: cargo }, drawMap() { fallbackDraws++; }, updatePhysics() {}, renderHud() {}, updateChartData() {}, performance: { now: () => now }, requestAnimationFrame(fn) { queue.set(++rafId, fn); return rafId; }, cancelAnimationFrame(id) { queue.delete(id); }, Float32Array, Math, console });
    vm.runInContext(model, context);
    window.CrossRouteThermalModel = context.CrossRouteThermalModel;
    if (dashboard) {
        // Run the exact production updatePhysics + renderThermalExplainer against our DOM,
        // stubbing only unrelated HUD/chart rendering. This catches broken legacy IDs.
        const start = bundle.indexOf('        function updatePhysics() {');
        const end = bundle.indexOf('        function renderHud(', start);
        if (start < 0 || end < 0) throw new Error('Dashboard update functions not found');
        vm.runInContext(bundle.slice(start, end), context);
        nodes.sliderTemp.value = '32'; nodes.sliderPayload.value = '20'; nodes.sliderDuration.value = '38';
        context.updatePhysics();
    }
    vm.runInContext(source, context);
    const api = adapter ? (documentListeners.DOMContentLoaded(), null) : context.CrossRoutePortScene.mount(canvas, nodes.portCanvas, (active, reason) => fallbackEvents.push({ active, reason }));
    return { api, draws, matrices, queue, parent, context, nodes, cargo, state, motion, fallbackEvents, scene: context.CrossRoutePortScene,
        get fallbackDraws() { return fallbackDraws; },
        step(t) { now = t; const work = [...queue]; queue.clear(); for (const [, fn] of work) fn(now); },
        key(key) { let prevented = false; canvas.dispatch('keydown', { key, preventDefault() { prevented = true; } }); return prevented; },
        changeMotion(matches) { motion.matches = matches; motion.listener?.({ matches }); },
        loseContext() { canvas.dispatch('webglcontextlost', { preventDefault() {} }); }
    };
}
