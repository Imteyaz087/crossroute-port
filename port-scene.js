/* Original lightweight WebGL harbor illustration. It consumes the shared model result;
 * geometry and motion are illustrative, not operational telemetry or a digital twin. */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.CrossRoutePortScene = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const SCENARIOS = new Set(["normal", "delay", "recovery"]);

    function createSceneState(scenario, result) {
        if (!SCENARIOS.has(scenario) || !result || result.valid !== true ||
            !Number.isFinite(result.finalC) || !Number.isFinite(result.peakC) ||
            !Number.isFinite(result.referenceC)) {
            return { valid: false, scenario: SCENARIOS.has(scenario) ? scenario : "invalid" };
        }
        return {
            valid: true,
            scenario,
            finalC: result.finalC,
            peakC: result.peakC,
            referenceC: result.referenceC,
            withinReference: result.state === "within_reference",
            recoveryMinutes: Number.isFinite(result.recoveryMinutes) ? result.recoveryMinutes : 0,
            shorePowerKwAssumption: Number.isFinite(result.shorePowerKwAssumption) ? result.shorePowerKwAssumption : null
        };
    }

    const SCENE_MANIFEST = Object.freeze([
        "harbor-water", "quay-and-road", "gantry-crane", "cold-warehouse", "container-stacks",
        "refrigerated-truck", "container-cutaway-and-cargo", "shore-power-unit", "scenario-route"
    ]);

    function mount(canvas, fallbackCanvas, onFallback) {
        const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
        const notifyFallback = (active, reason) => {
            if (typeof onFallback === "function") onFallback(active, reason);
        };
        if (!canvas || !fallbackCanvas || (reducedMotion && reducedMotion.matches)) {
            notifyFallback(true, "reduced-motion");
            return { available: false, update() {}, dispose() {} };
        }

        let gl;
        try { gl = canvas.getContext("webgl", { alpha: false, antialias: true, powerPreference: "low-power" }); }
        catch (_) { gl = null; }
        if (!gl) {
            notifyFallback(true, "webgl-unavailable");
            return { available: false, update() {}, dispose() {} };
        }
        notifyFallback(false, "webgl-ready");

        const vertexSource = `
            attribute vec3 aPosition;
            attribute vec3 aNormal;
            attribute vec3 aColor;
            uniform mat4 uViewProjection;
            varying vec3 vColor;
            varying float vLight;
            void main() {
                gl_Position = uViewProjection * vec4(aPosition, 1.0);
                vec3 light = normalize(vec3(-0.45, 0.84, 0.38));
                vLight = 0.38 + 0.62 * max(dot(normalize(aNormal), light), 0.0);
                vColor = aColor;
            }`;
        const fragmentSource = `
            precision mediump float;
            varying vec3 vColor;
            varying float vLight;
            void main() { gl_FragColor = vec4(vColor * vLight, 1.0); }`;

        function compile(type, source) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
            return shader;
        }
        function makeProgram() {
            const program = gl.createProgram();
            gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
            gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
            return program;
        }
        let program;
        try { program = makeProgram(); }
        catch (_) {
            notifyFallback(true, "shader-unavailable");
            return { available: false, update() {}, dispose() {} };
        }

        const locations = {
            position: gl.getAttribLocation(program, "aPosition"),
            normal: gl.getAttribLocation(program, "aNormal"),
            color: gl.getAttribLocation(program, "aColor"),
            viewProjection: gl.getUniformLocation(program, "uViewProjection")
        };
        const staticData = [];
        const dynamicData = [];
        function vertex(target, p, n, c) { target.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2]); }
        function quad(target, a, b, c, d, normal, color) {
            vertex(target, a, normal, color); vertex(target, b, normal, color); vertex(target, c, normal, color);
            vertex(target, a, normal, color); vertex(target, c, normal, color); vertex(target, d, normal, color);
        }
        function triangle(target, a, b, c, normal, color) {
            vertex(target, a, normal, color); vertex(target, b, normal, color); vertex(target, c, normal, color);
        }
        function box(target, x, y, z, sx, sy, sz, color) {
            const X = sx / 2, Y = sy / 2, Z = sz / 2;
            const p = [
                [x-X,y-Y,z+Z],[x+X,y-Y,z+Z],[x+X,y+Y,z+Z],[x-X,y+Y,z+Z],
                [x+X,y-Y,z-Z],[x-X,y-Y,z-Z],[x-X,y+Y,z-Z],[x+X,y+Y,z-Z],
                [x-X,y+Y,z+Z],[x+X,y+Y,z+Z],[x+X,y+Y,z-Z],[x-X,y+Y,z-Z],
                [x-X,y-Y,z-Z],[x+X,y-Y,z-Z],[x+X,y-Y,z+Z],[x-X,y-Y,z+Z],
                [x+X,y-Y,z+Z],[x+X,y-Y,z-Z],[x+X,y+Y,z-Z],[x+X,y+Y,z+Z],
                [x-X,y-Y,z-Z],[x-X,y-Y,z+Z],[x-X,y+Y,z+Z],[x-X,y+Y,z-Z]
            ];
            [[0,1,2,3,[0,0,1]],[4,5,6,7,[0,0,-1]],[8,9,10,11,[0,1,0]],
                [12,13,14,15,[0,-1,0]],[16,17,18,19,[1,0,0]],[20,21,22,23,[-1,0,0]]]
                .forEach(f => quad(target,p[f[0]],p[f[1]],p[f[2]],p[f[3]],f[4],color));
        }
        function cylinderY(target, x, y, z, radius, depth, color, sides) {
            const count = sides || 12;
            for (let i = 0; i < count; i++) {
                const a = i * Math.PI * 2 / count, b = (i + 1) * Math.PI * 2 / count;
                const p0 = [x + Math.cos(a)*radius, y-depth/2, z + Math.sin(a)*radius];
                const p1 = [x + Math.cos(b)*radius, y-depth/2, z + Math.sin(b)*radius];
                const p2 = [x + Math.cos(b)*radius, y+depth/2, z + Math.sin(b)*radius];
                const p3 = [x + Math.cos(a)*radius, y+depth/2, z + Math.sin(a)*radius];
                const normal = [Math.cos((a+b)/2), 0, Math.sin((a+b)/2)];
                quad(target,p0,p3,p2,p1,normal,color);
                triangle(target,[x,y-depth/2,z],p1,p0,[0,-1,0],color);
                triangle(target,[x,y+depth/2,z],p2,p3,[0,1,0],color);
            }
        }
        const C = {
            water:[0.025,0.16,0.23], waterLight:[0.04,0.29,0.38], quay:[0.20,0.27,0.32], road:[0.09,0.14,0.18],
            line:[0.22,0.43,0.49], steel:[0.40,0.62,0.68], crane:[0.80,0.56,0.20], craneDark:[0.34,0.30,0.23],
            warehouse:[0.16,0.28,0.34], warehouseRoof:[0.25,0.42,0.46], window:[0.12,0.65,0.74],
            containers:[[0.04,0.48,0.50],[0.08,0.31,0.46],[0.46,0.36,0.23],[0.13,0.43,0.36]],
            truck:[0.10,0.58,0.57], cab:[0.72,0.81,0.79], rubber:[0.035,0.055,0.065], cargo:[0.19,0.70,0.69], shore:[0.08,0.48,0.42]
        };
        // Harbor basin, raised quay, service road, bollards and water-side edge.
        box(staticData,0,-0.32,-1.0,15,0.34,11,C.water);
        box(staticData,0,-0.06,3.15,13,0.42,4.6,C.quay);
        box(staticData,0,0.18,1.02,12.8,0.08,0.12,C.waterLight);
        box(staticData,0,0.17,4.55,12.4,0.06,1.25,C.road);
        for (let x=-5.5;x<=5.5;x+=1.1) box(staticData,x,0.22,4.50,0.48,0.012,0.035,C.line);
        for (let x=-5.4;x<=5.4;x+=1.8) cylinderY(staticData,x,0.34,1.35,0.10,0.28,C.steel,10);
        // Warehouse, cold-room doors and container stacks.
        box(staticData,4.25,1.08,4.05,3.7,2.15,2.05,C.warehouse);
        box(staticData,4.25,2.19,4.05,3.86,0.12,2.18,C.warehouseRoof);
        for (let x=2.95;x<=5.45;x+=0.84) box(staticData,x,0.75,2.995,0.62,1.15,0.045,C.window);
        box(staticData,4.0,0.60,2.92,0.82,1.05,0.08,C.steel);
        [[5.95,0.52,2.55],[5.95,1.60,2.55],[6.95,0.52,2.55],[6.95,1.60,2.55],
            [5.9,0.52,3.35],[6.9,0.52,3.35]].forEach((p,i)=>{
            const c=C.containers[i%C.containers.length]; box(staticData,p[0],p[1],p[2],0.90,0.98,0.72,c);
            for(let rib=-3;rib<=3;rib++) box(staticData,p[0]+rib*0.11,p[1],p[2]+0.37,0.018,0.84,0.018,C.steel);
        });
        // Gantry crane: portal legs, crossbeam, trolley, suspended spreader and hoist lines.
        box(staticData,-3.15,4.02,2.80,0.30,0.30,5.2,C.crane);
        box(staticData,-4.95,2.04,0.42,0.28,4.0,0.28,C.craneDark);
        box(staticData,-1.35,2.04,0.42,0.28,4.0,0.28,C.craneDark);
        box(staticData,-4.95,2.04,5.15,0.28,4.0,0.28,C.craneDark);
        box(staticData,-1.35,2.04,5.15,0.28,4.0,0.28,C.craneDark);
        box(staticData,-3.15,0.22,0.42,1.0,0.18,0.72,C.steel);
        box(staticData,-1.35,0.22,0.42,1.0,0.18,0.72,C.steel);
        box(staticData,-3.15,0.22,5.15,1.0,0.18,0.72,C.steel);
        box(staticData,-1.35,0.22,5.15,1.0,0.18,0.72,C.steel);
        box(staticData,-3.15,3.67,2.70,0.68,0.44,0.82,C.craneDark);
        for(let x=-3.42;x<=-2.88;x+=0.54) box(staticData,x,3.36,2.70,0.035,0.62,0.035,C.steel);
        box(staticData,-3.15,3.04,2.70,1.12,0.08,1.25,C.crane);
        // Tractor, reefer chassis, ribbed container cutaway and visible cargo.
        box(staticData,-0.95,0.38,1.72,3.80,0.18,0.92,C.steel);
        box(staticData,-2.65,0.69,1.72,0.95,0.68,0.82,C.truck);
        box(staticData,-2.88,1.02,1.72,0.46,0.25,0.84,C.cab);
        box(staticData,-2.64,0.72,2.145,0.40,0.26,0.018,C.window);
        for(const x of [-2.45,-1.10,0.15]) for(const z of [1.18,2.26]) cylinderY(staticData,x,0.30,z,0.27,0.15,C.rubber,14);
        // Container shell is intentionally open along the near side to show cargo inside.
        box(staticData,-0.62,0.95,1.72,2.55,0.11,1.18,[0.07,0.36,0.41]);
        box(staticData,-0.62,1.68,1.72,2.55,0.11,1.18,[0.08,0.44,0.48]);
        box(staticData,-0.62,1.31,1.10,2.55,0.68,0.10,[0.06,0.34,0.39]);
        box(staticData,-1.90,1.31,1.72,0.11,0.68,1.18,C.steel);
        box(staticData,0.66,1.31,1.72,0.11,0.68,1.18,C.steel);
        for(let x=-1.68;x<=0.43;x+=0.28) {
            box(staticData,x,1.31,1.045,0.025,0.50,0.018,C.steel);
            box(staticData,x,1.31,2.395,0.025,0.50,0.018,C.steel);
        }
        for(let x=-1.48;x<=0.10;x+=0.56) {
            box(staticData,x,1.23,1.52,0.46,0.44,0.54,C.cargo);
            box(staticData,x,1.23,1.52,0.48,0.025,0.56,C.steel);
        }
        // Shore-power cabinet and a parked cable guide near the reefer container.
        box(staticData,1.65,0.56,1.38,0.58,1.00,0.46,C.shore);
        box(staticData,1.65,0.57,1.145,0.34,0.34,0.025,[0.11,0.23,0.24]);
        box(staticData,1.65,0.58,1.12,0.16,0.025,0.012,[0.30,0.86,0.68]);
        for(let x=-5.7;x<=5.8;x+=0.7) box(staticData,x,0.145,3.15,0.025,0.018,4.55,[0.25,0.33,0.37]);

        const staticBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, staticBuffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(staticData),gl.STATIC_DRAW);
        const staticVertices = staticData.length/9;
        let dynamicBuffer=gl.createBuffer(),dynamicVertices=0,motionBuffer=gl.createBuffer(),motionVertices=0;
        let modelState=createSceneState("normal",{valid:false});
        let yaw=0.70,pitch=0.48,distance=15.8,drag=null,raf=0,lastFrame=0,disposed=false,visible=true;
        let apiRef=null;
        const isSmall=()=>window.innerWidth<700;
        const motionOkay=()=>!(reducedMotion&&reducedMotion.matches);
        function ribbon(target,a,b,width,color) {
            const dx=b[0]-a[0], dz=b[2]-a[2], len=Math.hypot(dx,dz)||1;
            const ox=-dz/len*width/2, oz=dx/len*width/2;
            quad(target,[a[0]+ox,a[1],a[2]+oz],[b[0]+ox,b[1],b[2]+oz],[b[0]-ox,b[1],b[2]-oz],[a[0]-ox,a[1],a[2]-oz],[0,1,0],color);
        }
        function updateDynamic() {
            dynamicData.length=0;
            const color=!modelState.valid?[0.75,0.53,0.38]:modelState.scenario==="delay"?[0.92,0.25,0.37]:modelState.scenario==="recovery"?[0.20,0.88,0.63]:[0.14,0.72,0.82];
            const path=[[-5.2,0.235,1.72],[-3.0,0.235,1.72],[-0.9,0.235,1.72],[1.55,0.235,1.72],[3.4,0.235,2.4],[4.0,0.235,3.0]];
            for(let i=1;i<path.length;i++) ribbon(dynamicData,path[i-1],path[i],0.075,color);
            // Temperature indicator is explicitly a model estimate against the selected reference.
            const exceeds=modelState.valid&&!modelState.withinReference;
            const tempColor=!modelState.valid?[0.75,0.53,0.38]:exceeds?[0.95,0.30,0.32]:[0.28,0.84,0.70];
            const t=Math.max(0,Math.min(1,modelState.valid?(modelState.finalC-modelState.peakC+8)/16:0.5));
            box(dynamicData,-0.62,1.88,1.73,2.18,0.055,0.055,[0.035,0.12,0.15]);
            box(dynamicData,-1.71+1.09*t,1.88,1.69,2.18*t,0.075,0.075,tempColor);
            if(modelState.scenario==="recovery"&&modelState.recoveryMinutes>0) {
                // Highlight the assumed shore-power lead; this does not indicate a connected real plug.
                ribbon(dynamicData,[1.65,0.255,1.38],[0.76,0.255,1.38],0.09,[0.28,0.93,0.65]);
                ribbon(dynamicData,[0.76,0.255,1.38],[0.76,0.255,1.70],0.09,[0.28,0.93,0.65]);
            }
            gl.bindBuffer(gl.ARRAY_BUFFER,dynamicBuffer);
            gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(dynamicData),gl.DYNAMIC_DRAW);
            dynamicVertices=dynamicData.length/9;
        }
        function perspective(fov,aspect,near,far) {
            const f=1/Math.tan(fov/2),nf=1/(near-far);
            return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
        }
        function lookAt(eye,center,up) {
            let zx=eye[0]-center[0],zy=eye[1]-center[1],zz=eye[2]-center[2];
            let l=Math.hypot(zx,zy,zz)||1; zx/=l;zy/=l;zz/=l;
            let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;
            l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
            const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
            return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*eye[0]+xy*eye[1]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-(zx*eye[0]+zy*eye[1]+zz*eye[2]),1]);
        }
        function multiply(a,b) {
            const out=new Float32Array(16);
            for(let c=0;c<4;c++) for(let r=0;r<4;r++) out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
            return out;
        }
        function bindBuffer(buffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
            const stride=9*4;
            gl.enableVertexAttribArray(locations.position);gl.vertexAttribPointer(locations.position,3,gl.FLOAT,false,stride,0);
            gl.enableVertexAttribArray(locations.normal);gl.vertexAttribPointer(locations.normal,3,gl.FLOAT,false,stride,3*4);
            gl.enableVertexAttribArray(locations.color);gl.vertexAttribPointer(locations.color,3,gl.FLOAT,false,stride,6*4);
        }
        function draw(now,force) {
            if(disposed||!visible||(!motionOkay()&&!force)) return;
            if(motionOkay()&&!force) raf=requestAnimationFrame(draw);
            if(now-lastFrame<33) return;
            lastFrame=now;
            const rect=canvas.getBoundingClientRect();
            if(rect.width<4||rect.height<4) return;
            const dpr=Math.min(window.devicePixelRatio||1,isSmall()?1.15:1.5);
            const w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
            if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
            gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
            gl.clearColor(0.018,0.055,0.083,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
            const target=[0,1.35,2.0],cp=Math.cos(pitch);
            const eye=[target[0]+Math.sin(yaw)*distance*cp,target[1]+Math.sin(pitch)*distance,target[2]+Math.cos(yaw)*distance*cp];
            const vp=multiply(perspective(0.72,w/h,0.1,60),lookAt(eye,target,[0,1,0]));
            gl.useProgram(program);gl.uniformMatrix4fv(locations.viewProjection,false,vp);
            bindBuffer(staticBuffer);gl.drawArrays(gl.TRIANGLES,0,staticVertices);
            bindBuffer(dynamicBuffer);gl.drawArrays(gl.TRIANGLES,0,dynamicVertices);
            const motionData=[];
            const progress=modelState.scenario==="delay" ? 0.48+Math.sin(now*0.0008)*0.018 : (now*0.00006)%1;
            const markerX=-5.2+progress*10.2;
            const markerColor=!modelState.valid?[0.75,0.53,0.38]:modelState.scenario==="delay"?[0.96,0.28,0.39]:modelState.scenario==="recovery"?[0.25,0.95,0.68]:[0.18,0.78,0.93];
            box(motionData,markerX,0.31,1.72,0.40,0.10,0.22,markerColor);
            box(motionData,markerX-0.02,0.38,1.72,0.20,0.06,0.18,[0.78,0.91,0.89]);
            gl.bindBuffer(gl.ARRAY_BUFFER,motionBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(motionData),gl.DYNAMIC_DRAW);
            motionVertices=motionData.length/9;
            bindBuffer(motionBuffer);gl.drawArrays(gl.TRIANGLES,0,motionVertices);
        }
        function onPointerDown(event){drag={x:event.clientX,y:event.clientY,id:event.pointerId};canvas.setPointerCapture(event.pointerId);}
        function onPointerMove(event){if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.x=event.clientX;drag.y=event.clientY;yaw-=dx*0.007;pitch=Math.max(0.12,Math.min(1.15,pitch+dy*0.006));if(!motionOkay())renderOnce();}
        function onPointerUp(){drag=null;}
        function onWheel(event){event.preventDefault();distance=Math.max(10,Math.min(23,distance+event.deltaY*0.012));if(!motionOkay())renderOnce();}
        function onKey(event){const step=0.10;if(event.key==="ArrowLeft")yaw-=step;else if(event.key==="ArrowRight")yaw+=step;else if(event.key==="ArrowUp")pitch=Math.min(1.15,pitch+step);else if(event.key==="ArrowDown")pitch=Math.max(0.12,pitch-step);else if(event.key==="+"||event.key==="=")distance=Math.max(10,distance-0.8);else if(event.key==="-")distance=Math.min(23,distance+0.8);else return;event.preventDefault();if(!motionOkay())renderOnce();}
        function renderOnce(){draw(performance.now()+40,true);}
        function onMotionChange(event){if(event.matches){if(raf)cancelAnimationFrame(raf);raf=0;notifyFallback(true,"reduced-motion");}else{lastFrame=0;notifyFallback(false,"webgl-ready");if(typeof onFallback!=="function")draw(performance.now());}}
        function onContextLost(event){event.preventDefault();disposed=true;if(apiRef)apiRef.available=false;if(raf)cancelAnimationFrame(raf);notifyFallback(true,"webgl-context-lost");}
        canvas.addEventListener("pointerdown",onPointerDown);canvas.addEventListener("pointermove",onPointerMove);canvas.addEventListener("pointerup",onPointerUp);canvas.addEventListener("pointercancel",onPointerUp);canvas.addEventListener("wheel",onWheel,{passive:false});canvas.addEventListener("keydown",onKey);canvas.addEventListener("webglcontextlost",onContextLost,false);
        const resizeObserver=window.ResizeObserver?new ResizeObserver(()=>{if(!motionOkay())renderOnce();}):null;
        if(resizeObserver&&canvas.parentElement)resizeObserver.observe(canvas.parentElement);
        window.addEventListener("resize",onResize);function onResize(){if(!motionOkay())renderOnce();}
        if(reducedMotion&&reducedMotion.addEventListener)reducedMotion.addEventListener("change",onMotionChange);
        function update(next){if(disposed)return;modelState=createSceneState(next.scenario,next.result);updateDynamic();if(!motionOkay())renderOnce();}
        update({scenario:"normal",result:{valid:false}});
        if(motionOkay())draw(performance.now());
        apiRef={
            available:true,
            update,
            setVisible(next){if(disposed)return;const nextVisible=Boolean(next);if(nextVisible===visible)return;visible=nextVisible;if(!visible&&raf){cancelAnimationFrame(raf);raf=0;}else if(visible){if(motionOkay())draw(performance.now());else renderOnce();}},
            dispose(){disposed=true;if(raf)cancelAnimationFrame(raf);if(resizeObserver)resizeObserver.disconnect();window.removeEventListener("resize",onResize);if(reducedMotion&&reducedMotion.removeEventListener)reducedMotion.removeEventListener("change",onMotionChange);canvas.removeEventListener("pointerdown",onPointerDown);canvas.removeEventListener("pointermove",onPointerMove);canvas.removeEventListener("pointerup",onPointerUp);canvas.removeEventListener("pointercancel",onPointerUp);canvas.removeEventListener("wheel",onWheel);canvas.removeEventListener("keydown",onKey);canvas.removeEventListener("webglcontextlost",onContextLost);gl.deleteBuffer(staticBuffer);gl.deleteBuffer(dynamicBuffer);gl.deleteBuffer(motionBuffer);gl.deleteProgram(program);notifyFallback(true,"disposed");}
        };
        return apiRef;
    }

    return { createSceneState, SCENE_MANIFEST, mount };
});

// The readable/minified CrossRoute dashboard bundle stays byte-for-byte in sync.
// This optional classic-script adapter binds the independent renderer to that bundle's
// existing global model state and pauses its Canvas radar loop while WebGL is visible.
(function (root, sceneApi) {
    if (!root || !root.document || !sceneApi) return;
    const webglCanvas = root.document.getElementById("portWebGLCanvas");
    const fallbackView = root.document.getElementById("port2dView");
    const fallbackCanvas = root.document.getElementById("portCanvas");
    if (!webglCanvas || !fallbackView || !fallbackCanvas) return;

    let renderer = null;
    let useFallback = false;
    const originalDrawMap = root.drawMap;
    const originalUpdatePhysics = root.updatePhysics;
    if (typeof originalDrawMap === "function") {
        root.drawMap = function () {
            const query = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)");
            if (useFallback && !(query && query.matches)) return originalDrawMap.apply(this, arguments);
        };
    }

    function setFallback(active, reason) {
        useFallback = Boolean(active);
        webglCanvas.hidden = useFallback;
        fallbackView.hidden = !useFallback;
        root.document.getElementById("btnPortView2D").setAttribute("aria-pressed", String(useFallback));
        root.document.getElementById("btnPortView3D").setAttribute("aria-pressed", String(!useFallback));
        root.document.getElementById("portSceneStatus").textContent = useFallback
            ? `Illustrative 2D fallback active (${reason || "selected"}); simulated view only.`
            : "Illustrative native WebGL scene active; no live port feed is connected.";
        if (renderer && renderer.setVisible) renderer.setVisible(!useFallback);
        if (useFallback && typeof originalDrawMap === "function") {
            const query = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)");
            if (query && query.matches) originalDrawMap.apply(root, []);
            else root.drawMap();
        }
    }

    root.showPortView = function (mode) {
        if (mode === "2d") { setFallback(true, "user selected"); return; }
        if (!renderer || !renderer.available) { setFallback(true, "WebGL unavailable or reduced motion"); return; }
        setFallback(false, "user selected");
    };

    const mountScene = function () {
        renderer = sceneApi.mount(webglCanvas, fallbackCanvas, setFallback);
        if (typeof originalUpdatePhysics === "function") {
            root.updatePhysics = function () {
                const result = originalUpdatePhysics.apply(this, arguments);
                try { renderer.update({ scenario: state.scenario, result: state.modelResult }); }
                catch (_) { /* Keep the illustrative fallback available if model access fails. */ }
                return result;
            };
            try { renderer.update({ scenario: state.scenario, result: state.modelResult }); }
            catch (_) { /* The dashboard's first updatePhysics call will retry after initialization. */ }
        } else {
            setFallback(true, "dashboard model unavailable");
        }
    };
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", mountScene, { once: true });
    else mountScene();
})(typeof globalThis !== "undefined" ? globalThis : this,
    typeof globalThis !== "undefined" ? globalThis.CrossRoutePortScene : null);
