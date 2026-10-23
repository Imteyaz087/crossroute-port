import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { harness } from './scene-harness.js';

const plain = value => JSON.parse(JSON.stringify(value));
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../port-scene.js', import.meta.url));
const baseResult = { valid: true, finalC: -18.54, peakC: -18.54, referenceC: -15, state: 'within_reference', recoveryMinutes: 0, shorePowerKwAssumption: null, heatIngressW: 6787.5 };
function project(matrix, [x,y,z]) {
    const cx=matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12];
    const cy=matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13];
    const cw=matrix[3]*x+matrix[7]*y+matrix[11]*z+matrix[15];
    return { x:cx/cw, y:cy/cw, w:cw };
}

test('default Overview is a north-oriented orthographic bird’s-eye view framing the complete harbor on desktop and portrait screens', () => {
    for (const [width,height] of [[900,520],[320,390]]) {
        const h=harness({ reduced:true,width,height });
        const camera=h.api.getViewState(),matrix=h.matrices.at(-1);
        assert.equal(camera.view,'overview');
        assert.equal(camera.yaw,0,'world X stays horizontal for a stable north-like map orientation');
        assert.ok(camera.pitch>1.30&&camera.pitch<Math.PI/2-.1,'near overhead but not singular straight down');
        assert.equal(matrix[11],0,'orthographic projection keeps camera distance from creating perspective skew');
        assert.equal(matrix[15],1,'orthographic clip w remains constant');
        const west=project(matrix,[-1,0,0]),east=project(matrix,[1,0,0]);
        const north=project(matrix,[0,0,-1]),south=project(matrix,[0,0,1]);
        assert.ok(west.x<east.x,'east-west map axis stays horizontal');
        assert.ok(north.y>south.y,'north-like negative Z stays at the top of the screen');
        const L=h.scene.OVERVIEW_LAYOUT;
        const points=[...L.channel.map(([x,z])=>[x,.28,z]),...L.terminal4.berths.map(b=>[b.x,.8,b.z]),...L.terminal5.berths.map(b=>[b.x,.5,b.z]),
            ...L.hub.bays.map(b=>[b.x,1.2,b.z]),L.vessel.label,L.terminal4.label,L.terminal5.label,L.hub.label,
            ...L.routes.flatMap(route=>route.points.map(([x,z])=>[x,.39,z]))];
        for(const point of points) {
            const p=project(matrix,point);
            assert.ok(p.w>0&&Math.abs(p.x)<0.96&&Math.abs(p.y)<0.96,`${width}x${height} harbor point ${point} remains framed: ${JSON.stringify(p)}`);
        }
        h.api.setView('cutaway');
        assert.notDeepEqual(h.matrices.at(-1),matrix,'Cutaway remains an independent perspective camera preset');
        h.api.setView('overview');
        assert.deepEqual(h.matrices.at(-1),matrix,'reset restores the same stable top-down composition');
        h.key('ArrowUp');
        assert.ok(h.api.getViewState().pitch<Math.PI/2,'orbit clamp avoids lookAt singularity');
        assert.ok(h.matrices.at(-1).every(Number.isFinite),'extreme near-overhead orbit remains numerically stable');
        h.api.dispose();
    }
    assert.match(html,/Bird’s-eye overview · 港區鳥瞰/);
    assert.match(html,/Bird’s-eye port overview · 港區鳥瞰/);
});

test('label decluttering preserves landmark priority, stays near anchors, and hides IDs only when crowded', () => {
    const h=harness({reduced:true}),layout=h.scene.layoutSceneLabels;
    const landmarks=[
        {id:'terminal-4',kind:'essential',x:50,y:50,width:100,height:14},
        {id:'terminal-5',kind:'essential',x:95,y:50,width:100,height:14},
        {id:'berth-78',kind:'essential',x:75,y:58,width:105,height:14},
        {id:'ship',kind:'essential',x:140,y:150,width:80,height:14},
        {id:'cold-hub',kind:'essential',x:235,y:80,width:110,height:14},
        {id:'tunnel',kind:'context',x:80,y:300,width:80,height:14}
    ];
    const essential=landmarks.slice(0,5).map(item=>item.id),limit={essential:40,context:32,vehicle:24};
    function vehiclesFor(width) {
        return Array.from({length:16},(_,index)=>({
            id:`CMC-ET35-${100+index}`,kind:'vehicle',
            x:width>500?70+(index%8)*100:40+(index%4)*76,
            y:width>500?390+Math.floor(index/8)*38:250+Math.floor(index/4)*28,
            width:64,height:12
        }));
    }
    function assertNoCollisions(result,width,height) {
        const visible=result.filter(item=>item.visible);
        for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++) {
            const a=visible[i],b=visible[j];
            const separated=Math.abs(a.x-b.x)>=(a.width+b.width)/2+4||Math.abs(a.y-b.y)>=(a.height+b.height)/2+4;
            assert.ok(separated,`${a.id} and ${b.id} overlap at ${width}x${height}`);
        }
        for(const item of visible)assert.ok(item.displacement<=limit[item.kind],`${item.id} moved too far from its anchor: ${item.displacement}px`);
    }
    let desktopFleetVertexCount=0;
    for(const [width,height] of [[900,520],[320,390]]) {
        const proposals=[...landmarks,...vehiclesFor(width)];
        const result=layout(proposals,width,height),again=layout(proposals,width,height);
        assert.deepEqual(result,again,'same ordered inputs always produce the same placements');
        const byId=new Map(result.map(item=>[item.id,item]));
        for(const id of essential)assert.equal(byId.get(id).visible,true,`${id} remains prioritized`);
        assert.equal(byId.get('tunnel').visible,true,'secondary harbor context follows required tags');
        assertNoCollisions(result,width,height);
        const fleetVisible=result.filter(item=>item.id.startsWith('CMC-ET35-')&&item.visible).length;
        if(width===900)assert.equal(fleetVisible,16,'distinct projected labels return when the wide view provides room');
        else assert.ok(fleetVisible>0&&fleetVisible<=16,'portrait layout keeps only fleet IDs that fit nearby');
        assert.equal(h.scene.createDemoFleet().length,16,'decluttering affects labels only, never the 16 vehicle meshes');
        const mounted=harness({reduced:true,width,height}),overlay=mounted.parent.children.find(element=>element.className==='port-fleet-label-overlay');
        assert.equal(overlay.children.length,30,'all 9 berth tags, landmark tags and 16 vehicle label nodes stay mounted');
        const fleetVertexCount=mounted.draws.at(-1).count;
        assert.ok(fleetVertexCount>0,'all vehicle geometry is submitted independently from its labels');
        if(width===900)desktopFleetVertexCount=fleetVertexCount;
        else assert.equal(fleetVertexCount,desktopFleetVertexCount,'portrait label decluttering never removes or changes vehicle meshes');
        const mountedLabels=overlay.children.filter(label=>!label.hidden).map(label=>{
            const vehicle=label.textContent.startsWith('CMC-ET35-');
            const w=Math.ceil([...label.textContent].length*4.82+(vehicle?6:8)),heightPx=vehicle?12:14;
            const x=parseFloat(label.style.left),y=parseFloat(label.style.top);
            return {id:label.textContent,x,y,w,height:heightPx};
        });
        for(const id of ['TERMINAL 4 · 63–66','TERMINAL 5 · 77–81','BERTH 78 · ACTIVE','WAN HAI 315','QIANZHEN COLD HUB'])assert.ok(mountedLabels.some(label=>label.id===id),`${id} remains visible`);
        for(let i=0;i<mountedLabels.length;i++)for(let j=i+1;j<mountedLabels.length;j++) {
            const a=mountedLabels[i],b=mountedLabels[j];
            const separated=Math.abs(a.x-b.x)>=(a.w+b.w)/2+4||Math.abs(a.y-b.y)>=(a.height+b.height)/2+4;
            assert.ok(separated,`mounted labels ${a.id} and ${b.id} do not overlap at ${width}x${height}`);
        }
        mounted.api.dispose();
    }
    const clustered=[...landmarks,...Array.from({length:16},(_,index)=>({id:`CMC-ET35-${100+index}`,kind:'vehicle',x:160,y:350,width:64,height:12}))];
    const crowded=layout(clustered,320,390);
    assert.deepEqual(crowded,layout(clustered,320,390));
    assert.ok(crowded.filter(item=>item.id.startsWith('CMC-ET35-')&&item.visible).length<16,'coincident anchors hide excess IDs instead of scattering them away');
    assertNoCollisions(crowded,320,390);
    assert.match(renderer.toString('utf8'),/for\(const vehicle of demoFleet\)\s*\{\s*const pose=getDemoFleetPose/,'all fleet geometry remains independent from label visibility');
    h.api.dispose();
});

test('cutaway changes the actual camera matrix/target, supports keyboard/reset and view-specific zoom without RAF in reduced motion', () => {
    const h = harness({ reduced: true });
    const overview = h.matrices.at(-1);
    assert.equal(h.api.setView('cutaway'), true);
    assert.deepEqual(plain(h.api.getViewState().target), [-0.62, 1.25, 1.72]);
    assert.notDeepEqual(h.matrices.at(-1), overview);
    assert.equal(h.queue.size, 0);
    const cutaway = h.api.getViewState(), before = h.draws.length;
    assert.equal(h.key('+'), true);
    assert.equal(h.api.getViewState().distance, cutaway.distance - 0.8);
    assert.equal(h.draws.length, before + 4);
    h.key('ArrowRight'); assert.ok(h.api.getViewState().yaw > cutaway.yaw);
    assert.equal(h.key('Escape'), true);
    assert.deepEqual(h.matrices.at(-1), overview);
    assert.equal(h.api.setView('bogus'), false);
    assert.equal(h.api.setView('__proto__'), false);
    assert.equal(h.key('2'), true); assert.equal(h.api.getViewState().view, 'cutaway');
    assert.equal(h.key('1'), true); assert.equal(h.api.getViewState().view, 'overview');
    h.api.dispose();
});

test('portrait cutaway projection keeps cab, cargo and power cabinet inside the visible viewport', () => {
    for (const [width, height] of [[900, 520], [320, 390]]) {
        const h = harness({ reduced: true, width, height }); h.api.setView('cutaway');
        const m = h.matrices.at(-1);
        for (const p of [[-3.15, 1.1, 1.72], [-.62, 1.4, 2.3], [1.94, 1.1, 1.62]]) {
            const x = m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], y = m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], w = m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];
            assert.ok(w > 0 && Math.abs(x/w) < .96 && Math.abs(y/w) < .55, `${width}px framing ${p}`);
        }
        h.api.dispose();
    }
});

test('real shared-model dashboard updates feed docked scene-panel cargo/temp/reference/recovery readouts and preserve hidden SVG IDs', () => {
    const h = harness({ reduced: true, adapter: true, dashboard: true });
    const { context, nodes, state } = h;
    assert.equal(nodes.portCargoName.textContent, h.cargo.name);
    assert.equal(nodes.portCargoTemp.textContent, state.modelResult.finalC.toFixed(2) + ' °C');
    assert.equal(nodes.portCargoReference.textContent, '-15.00 °C');
    assert.equal(nodes.thermalFallbackIllustration.hasAttribute('hidden'), true);
    assert.ok(nodes.thermalCargoText.textContent.includes(nodes.portCargoTemp.textContent));
    assert.match(nodes.portCargoRecovery.textContent, /^0 min/);
    context.showPortFocus('cutaway');
    state.scenario = 'recovery'; nodes.sliderDuration.value = '104'; context.updatePhysics();
    assert.equal(nodes.portCargoRecovery.textContent, '14 min · 10 kW assumed');
    assert.equal(nodes.portCargoPeak.textContent, state.modelResult.peakC.toFixed(2) + ' °C');
    assert.equal(nodes.portCargoHeat.textContent, (state.modelResult.heatIngressW / 1000).toFixed(2) + ' kW estimated ingress');
    assert.equal(nodes.btnPortCutaway.getAttribute('aria-pressed'), 'true');
    assert.match(nodes.thermalPhaseLabel.textContent, /14 min/);
    h.cargo.name = '<b>Different cargo</b>'; h.cargo.critical = -22;
    context.updatePhysics();
    assert.equal(nodes.portCargoName.textContent, '<b>Different cargo</b>', 'literal text, not HTML injection');
    assert.equal(nodes.portCargoReference.textContent, '-22.00 °C');
    assert.equal(nodes.portCargoStatus.textContent, 'Exceeds selected reference');
    nodes.sliderPayload.value = '0'; context.updatePhysics();
    assert.equal(nodes.portCargoTemp.textContent, '—');
    assert.equal(nodes.portCargoRecovery.textContent, 'Recovery unavailable');
    assert.equal(nodes.portCargoName.textContent, 'Invalid model input');
});

test('cargo geometry is model-colored and recovery lead appears only for valid modeled recovery', () => {
    const h = harness({ reduced: true }); h.api.setView('cutaway');
    const cargoColor = () => {
        const data = h.draws.at(-3).data;
        for (let i = 0; i < data.length; i += 9) if (Math.abs(data[i] + 1.71) < .001 && Math.abs(data[i+1] - 1.01) < .001 && Math.abs(data[i+2] - 1.79) < .001) return data.slice(i+6, i+9);
        assert.fail('colored cargo body not submitted to WebGL');
    };
    h.api.update({ scenario: 'normal', result: baseResult });
    const normalCount = h.draws.at(-3).count, normalColor = cargoColor();
    h.api.update({ scenario: 'delay', result: { ...baseResult, finalC: -10, peakC: -10, state: 'exceeds_reference' } });
    assert.notDeepEqual(cargoColor(), normalColor);
    h.api.update({ scenario: 'recovery', result: { ...baseResult, recoveryMinutes: 14, shorePowerKwAssumption: 10 } });
    assert.deepEqual(cargoColor(), normalColor);
    assert.equal(h.draws.at(-3).count, normalCount + 18, 'three cable ribbons reach near side');
    h.api.update({ scenario: 'recovery', result: { valid: false } });
    assert.equal(h.draws.at(-3).count, normalCount);
    h.api.dispose();
});

test('3D→2D→3D preserves focus, toggles only redundant illustration, and preference changes never override chosen 2D', () => {
    const h = harness({ adapter: true, dashboard: true });
    const { nodes, context } = h;
    context.showPortFocus('cutaway');
    for (let i = 0; i < 3; i++) {
        context.showPortView('2d');
        assert.equal(nodes.portWebGLCanvas.hidden, true); assert.equal(nodes.port2dView.hidden, false);
        assert.equal(nodes.thermalFallbackIllustration.hasAttribute('hidden'), false); assert.equal(nodes.portThermalReadout.hidden, true);
        assert.equal(nodes.thermalModelState.hidden, false); assert.equal(nodes.btnPortCutaway.disabled, true);
        assert.equal(h.queue.size, 0);
        h.changeMotion(true); h.changeMotion(false);
        assert.equal(nodes.portWebGLCanvas.hidden, true); assert.equal(h.queue.size, 0);
        context.showPortView('3d');
        assert.equal(nodes.thermalFallbackIllustration.hasAttribute('hidden'), true); assert.equal(nodes.portThermalReadout.hidden, false);
        assert.equal(nodes.btnPortCutaway.getAttribute('aria-pressed'), 'true');
        assert.equal(nodes.btnPortCutaway.disabled, false); assert.equal(h.queue.size, 1);
    }
    h.loseContext();
    assert.equal(h.queue.size, 0); assert.equal(nodes.thermalFallbackIllustration.hasAttribute('hidden'), false);
    assert.equal(nodes.btnPortCutaway.disabled, true);
    context.showPortView('3d'); h.changeMotion(true); h.changeMotion(false);
    assert.equal(nodes.portWebGLCanvas.hidden, true); assert.equal(h.queue.size, 0);
    assert.ok(h.fallbackDraws > 0);
});

test('WebGL and shader failures retain readable 2D thermal content and never announce 3D ready', () => {
    for (const options of [{ webgl: false }, { shader: false }]) {
        const h = harness({ ...options, adapter: true, dashboard: true });
        assert.equal(h.nodes.portWebGLCanvas.hidden, true);
        assert.equal(h.nodes.thermalFallbackIllustration.hasAttribute('hidden'), false);
        assert.equal(h.nodes.portThermalReadout.hidden, true);
        assert.equal(h.nodes.btnPortOverview.disabled, true);
        assert.equal(h.parent.children.filter(e => e.className === 'port-fleet-label-overlay').length, 0);
        assert.equal(h.queue.size, 0);
        h.context.showPortView('3d'); assert.equal(h.nodes.thermalFallbackIllustration.hasAttribute('hidden'), false);
        const direct = harness(options);
        assert.equal(direct.api.available, false);
        assert.ok(direct.fallbackEvents.every(event => event.active));
    }
});

test('shipped scene script URL resolves to this exact renderer byte hash and follows the dashboard bundle', () => {
    const srcs = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]);
    const sceneSrc = srcs.find(src => src.startsWith('port-scene.js'));
    const url = new URL(sceneSrc, 'https://example.invalid/crossroute-port/');
    assert.equal(url.pathname, '/crossroute-port/port-scene.js');
    assert.equal(url.searchParams.get('v'), createHash('sha256').update(renderer).digest('hex'));
    assert.ok(srcs.indexOf(sceneSrc) > srcs.indexOf('crossroute.min.js'));
    assert.ok(html.includes('.thermal-explainer [hidden] { display: none !important; }'));
});


test('fallback layout contract fills the viewport and production fitHiDPICanvas sizes from its noncollapsed wrapper', async () => {
    const { default: vm } = await import('node:vm');
    const bundle = readFileSync(new URL('../crossroute.bundle.js', import.meta.url), 'utf8');
    const rule = html.match(/\.port-scene-layer\s*\{([^}]+)\}/)?.[1];
    assert.ok(rule, 'fallback wrapper has its own layout rule');
    const declarations = Object.fromEntries(rule.split(';').filter(part => part.includes(':')).map(part => part.split(':').map(value => value.trim())));
    assert.equal(declarations.position, 'absolute');
    assert.equal(declarations.inset, '0', 'all four edges fill the positioned viewport');
    assert.match(html, /\.port-scene-layer\[hidden\][^{]*\{\s*display:\s*none !important;/);
    const start = bundle.indexOf('        function fitHiDPICanvas(c) {');
    const end = bundle.indexOf('        function resizeCanvases()', start);
    assert.ok(start >= 0 && end > start);
    const context = vm.createContext({ window: { devicePixelRatio: 2 } });
    vm.runInContext(bundle.slice(start, end), context);
    // This is a CSS layout-contract test, not a browser layout engine. Given the
    // absolute/inset contract above, exercise the real production sizing helper
    // with the wrapper's filled dimensions, including hidden -> shown recovery.
    for (const [width, height] of [[900, 520], [320, 390]]) {
        let hidden = true;
        const canvas = { width: 0, height: 0, parentElement: { getBoundingClientRect() { return hidden ? { width: 0, height: 0 } : { width, height }; } } };
        context.fitHiDPICanvas(canvas);
        assert.equal(canvas.height, 2, 'hidden parent reproduces the tiny backing-store failure');
        hidden = false;
        const fitted = context.fitHiDPICanvas(canvas);
        assert.deepEqual(plain(fitted), { w: width, h: height, dpr: 2 });
        assert.equal(canvas.width, width * 2);
        assert.equal(canvas.height, height * 2);
        assert.ok(fitted.w >= 40 && fitted.h >= 40, 'original drawMap no longer takes its undersized-canvas early return');
    }
});

test('SVG fallback visibility uses the hidden attribute even when its hidden property does not reflect', () => {
    const h = harness({ adapter: true, dashboard: true });
    const svg = h.nodes.thermalFallbackIllustration;
    assert.equal(svg.hidden, false, 'mock SVG property is deliberately independent of attributes');
    assert.equal(svg.hasAttribute('hidden'), true, 'active 3D sets the CSS-visible attribute');
    for (let i = 0; i < 3; i++) {
        h.context.showPortView('2d');
        assert.equal(svg.hasAttribute('hidden'), false, 'fallback removes rather than sets hidden="false"');
        assert.equal(h.nodes.portThermalReadout.hasAttribute('hidden'), true);
        h.context.showPortView('3d');
        assert.equal(svg.hasAttribute('hidden'), true);
        assert.equal(h.nodes.portThermalReadout.hasAttribute('hidden'), false);
        assert.equal(svg.hidden, false, 'no ineffective SVG expando writes');
    }
    h.loseContext();
    assert.equal(svg.hasAttribute('hidden'), false, 'context loss restores the SVG');
    assert.equal(h.nodes.portThermalReadout.hasAttribute('hidden'), true);
});

test('thermal readout is the next normal-flow sibling below the canvas viewport, never a geometry overlay', () => {
    // Structural HTML/CSS contract; native browser appearance is checked separately.
    const stack = [], byId = new Map(), root = { children: [] };
    const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    for (const match of html.matchAll(/<(\/?)([a-z][\w-]*)\b[^>]*>/gi)) {
        const tag = match[2].toLowerCase();
        if (match[1]) {
            const index = stack.findLastIndex(node => node.tag === tag);
            if (index >= 0) stack.length = index;
        } else {
            const parent = stack.at(-1) || root, node = { tag, parent, children: [] };
            parent.children.push(node);
            const id = match[0].match(/\bid="([^"]+)"/)?.[1];
            if (id) byId.set(id, node);
            if (!voidTags.has(tag) && !match[0].endsWith('/>')) stack.push(node);
        }
    }
    const viewport = byId.get('portSceneViewport'), readout = byId.get('portThermalReadout');
    assert.equal(readout.parent, viewport.parent, 'readout remains inside the same scene panel');
    assert.equal(viewport.parent.children.indexOf(readout), viewport.parent.children.indexOf(viewport) + 1);
    const rule = html.match(/\.port-thermal-readout\s*\{([^}]+)\}/)?.[1];
    const declarations = Object.fromEntries(rule.split(';').filter(part => part.includes(':')).map(part => part.split(':').map(value => value.trim())));
    assert.ok(!declarations.position || declarations.position === 'static');
    assert.equal(declarations.inset, undefined);
    assert.equal(declarations['pointer-events'], undefined, 'values remain selectable and readable');
    for (const id of ['portCargoName', 'portCargoTemp', 'portCargoReference', 'portCargoRecovery']) {
        let node = byId.get(id);
        while (node && node !== readout) node = node.parent;
        assert.equal(node, readout, `${id} stays inside the docked card`);
    }
});
