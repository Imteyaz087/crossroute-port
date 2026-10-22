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
        "refrigerated-truck", "container-cutaway-and-cargo", "shore-power-unit", "scenario-route",
        "illustrative-16-vehicle-fleet", "individual-vehicle-trails", "animated-tunnel-cues", "animated-crane-trolley",
        "qijin-breakwater", "navigational-channel"
    ]);

    // A reproducible illustration of the original radar's 16 vehicle slots, not a
    // claim about live fleet size, identity, location, or dispatch state.
    function createDemoFleet() {
        return Array.from({ length: 16 }, (_, index) => ({
            id: `CMC-ET35-${100 + index}`,
            moving: index % 4 !== 0,
            progress: ((index * 37) % 97) / 97,
            lane: index % 4,
            trailLength: 14
        }));
    }

    function mount(canvas, fallbackCanvas, onFallback) {
        const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
        const notifyFallback = (active, reason) => {
            if (typeof onFallback === "function") onFallback(active, reason);
        };
        if (!canvas || !fallbackCanvas) {
            notifyFallback(true, "canvas-unavailable");
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
        const labelOverlay=document.createElement("div");
        labelOverlay.className="port-fleet-label-overlay";
        labelOverlay.setAttribute("aria-hidden","true");
        Object.assign(labelOverlay.style,{position:"absolute",inset:"0",pointerEvents:"none",overflow:"hidden"});
        const fleetLabels=createDemoFleet().map(vehicle=>{
            const label=document.createElement("span");
            label.textContent=vehicle.id;
            Object.assign(label.style,{position:"absolute",padding:"1px 3px",borderRadius:"3px",font:"8px ui-monospace,monospace",color:vehicle.moving?"#a7f3d0":"#7dd3fc",background:"rgba(5,17,28,.82)",whiteSpace:"nowrap",transform:"translate(-50%,-100%)"});
            labelOverlay.appendChild(label);
            return label;
        });
        const sceneTags=[
            ["TERMINAL 4 · 63–66",[-4.6,0.45,2.38]],["TERMINAL 5 · 77–81",[-1.9,0.45,2.38]],
            ["BERTH 78 · ACTIVE",[-2.2,0.58,2.38]],["WAN HAI 315",[-0.2,0.65,-2.25]],
            ["QIANZHEN COLD HUB",[4.1,2.35,4.05]],["HARBOR TUNNEL",[0,0.65,3.35]]
        ].map(([text,point])=>{
            const label=document.createElement("span");label.textContent=text;
            Object.assign(label.style,{position:"absolute",padding:"2px 4px",borderRadius:"3px",font:"700 8px ui-monospace,monospace",color:"#b6f5e4",background:"rgba(5,17,28,.84)",whiteSpace:"nowrap",transform:"translate(-50%,-50%)"});
            labelOverlay.appendChild(label);return {label,point};
        });
        if(canvas.parentElement) canvas.parentElement.appendChild(labelOverlay);
        function updateFleetLabels(vp,rect) {
            const parentRect=canvas.parentElement?canvas.parentElement.getBoundingClientRect():rect;
            function project(point) {
                const clipX=vp[0]*point[0]+vp[4]*point[1]+vp[8]*point[2]+vp[12],clipY=vp[1]*point[0]+vp[5]*point[1]+vp[9]*point[2]+vp[13],clipW=vp[3]*point[0]+vp[7]*point[1]+vp[11]*point[2]+vp[15];
                const visible=clipW>0&&Math.abs(clipX/clipW)<0.98&&Math.abs(clipY/clipW)<0.98;
                return {visible,x:((clipX/clipW+1)/2)*parentRect.width,y:((1-clipY/clipW)/2)*parentRect.height};
            }
            demoFleet.forEach((vehicle,index)=>{
                const speed=vehicle.moving?0.025:0;
                const progress=vehicle.moving?((vehicle.progress+(motionOkay()?performance.now()/1000:0)*speed)%1):vehicle.progress;
                const [x,y,z]=routePosition(progress,vehicle.lane);
                const position=project([x,y+0.30,z]);
                fleetLabels[index].hidden=!position.visible;
                if(position.visible){fleetLabels[index].style.left=`${position.x}px`;fleetLabels[index].style.top=`${position.y}px`;}
            });
            for(const tag of sceneTags) {
                const position=project(tag.point);tag.label.hidden=!position.visible;
                if(position.visible){tag.label.style.left=`${position.x}px`;tag.label.style.top=`${position.y}px`;}
            }
        }

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
        function wheel(target,x,y,z,radius,depth,color,sides) {
            const count=sides||10;
            for(let i=0;i<count;i++) {
                const a=i*Math.PI*2/count,b=(i+1)*Math.PI*2/count;
                const p0=[x+Math.cos(a)*radius,y+Math.sin(a)*radius,z-depth/2];
                const p1=[x+Math.cos(b)*radius,y+Math.sin(b)*radius,z-depth/2];
                const p2=[x+Math.cos(b)*radius,y+Math.sin(b)*radius,z+depth/2];
                const p3=[x+Math.cos(a)*radius,y+Math.sin(a)*radius,z+depth/2];
                const normal=[Math.cos((a+b)/2),Math.sin((a+b)/2),0];
                quad(target,p0,p1,p2,p3,normal,color);
                triangle(target,[x,y,z-depth/2],p0,p1,[0,0,-1],color);
                triangle(target,[x,y,z+depth/2],p3,p2,[0,0,1],color);
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
        // Qijin-side breakwater and a separate navigational fairway cue.
        box(staticData,-6.95,0.18,-2.20,0.72,0.72,7.8,[0.16,0.23,0.29]);
        ribbon(staticData,[-5.95,-0.105,-5.5],[-5.95,-0.105,0.72],0.11,[0.18,0.58,0.72]);
        box(staticData,0,-0.06,3.15,13,0.42,4.6,C.quay);
        box(staticData,0,0.18,1.02,12.8,0.08,0.12,C.waterLight);
        box(staticData,0,0.17,4.55,12.4,0.06,1.25,C.road);
        for (let x=-5.5;x<=5.5;x+=1.1) box(staticData,x,0.22,4.50,0.48,0.012,0.035,C.line);
        for (let x=-5.4;x<=5.4;x+=1.8) cylinderY(staticData,x,0.34,1.35,0.10,0.28,C.steel,10);
        // Warehouse, cold-room doors and container stacks.
        box(staticData,4.25,1.08,4.05,3.7,2.15,2.05,C.warehouse);
        box(staticData,4.25,2.19,4.05,3.86,0.12,2.18,C.warehouseRoof);
        for(let row=0;row<3;row++) for(let column=0;column<3;column++) {
            box(staticData,3.05+column*0.78,0.52+row*0.50,2.995,0.55,0.36,0.045,C.window);
        }
        // Illustrative terminal berths, stationary WAN HAI 315 and its twelve deck boxes.
        for(let i=0;i<9;i++) {
            const x=i<4?-5.35+i*0.52:-2.75+(i-4)*0.52;
            const berthColor=i===5?[0.12,0.70,0.48]:i<4?[0.24,0.34,0.39]:[0.21,0.38,0.39];
            box(staticData,x,0.18,2.38,0.44,0.12,0.72,berthColor);
        }
        box(staticData,-0.25,-0.04,-2.25,5.4,0.34,1.35,[0.12,0.25,0.32]);
        for(let i=0;i<12;i++) {
            const x=-2.25+(i%6)*0.76,y=0.20+Math.floor(i/6)*0.28;
            box(staticData,x,y,-2.25,0.68,0.22,0.54,C.containers[i%C.containers.length]);
        }
        box(staticData,2.16,0.24,-2.25,0.52,0.50,0.66,C.steel);
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
        // Trolley, hoist and spreader are drawn dynamically below.
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
        // Tunnel portal frames mark the two ends of the bidirectional simulated corridor.
        for(const x of [-4.7,4.2]) {
            box(staticData,x-0.24,0.78,3.35,0.12,1.35,0.18,C.steel);
            box(staticData,x+0.24,0.78,3.35,0.12,1.35,0.18,C.steel);
            box(staticData,x,1.40,3.35,0.58,0.12,0.18,C.steel);
        }

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
        const demoFleet=createDemoFleet();
        const routePoints=[[-5.25,4.48],[1.55,4.48],[3.40,3.85],[4.00,3.05],[4.00,2.65]];
        const routeLengths=routePoints.slice(1).map((point,index)=>Math.hypot(point[0]-routePoints[index][0],point[1]-routePoints[index][1]));
        const routeLength=routeLengths.reduce((sum,length)=>sum+length,0);
        function routePosition(progress,lane) {
            let distance=(((progress%1)+1)%1)*routeLength;
            for(let i=0;i<routeLengths.length;i++) {
                const length=routeLengths[i];
                if(distance<=length||i===routeLengths.length-1) {
                    const part=length?distance/length:0, a=routePoints[i],b=routePoints[i+1];
                    return [a[0]+(b[0]-a[0])*part,0.34,a[1]+(b[1]-a[1])*part+(lane-1.5)*0.16];
                }
                distance-=length;
            }
            return [routePoints[0][0],0.34,routePoints[0][1]];
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
            updateFleetLabels(vp,rect);
            gl.useProgram(program);gl.uniformMatrix4fv(locations.viewProjection,false,vp);
            bindBuffer(staticBuffer);gl.drawArrays(gl.TRIANGLES,0,staticVertices);
            bindBuffer(dynamicBuffer);gl.drawArrays(gl.TRIANGLES,0,dynamicVertices);
            const motionData=[];
            const markerColor=!modelState.valid?[0.75,0.53,0.38]:modelState.scenario==="delay"?[0.96,0.28,0.39]:modelState.scenario==="recovery"?[0.25,0.95,0.68]:[0.18,0.78,0.93];
            const pathColor=modelState.scenario==="delay"?[0.92,0.25,0.37]:modelState.scenario==="recovery"?[0.20,0.88,0.63]:[0.14,0.72,0.82];
            const tunnelA=[-4.7,0.25,3.35],tunnelB=[4.2,0.25,3.35];
            if(motionOkay()) for(let k=0;k<3;k++) {
                const forward=((now/(modelState.scenario==="delay"?4000:1600)+k/3)%1);
                for(const direction of [1,-1]) {
                    const progress=direction===1?forward:1-forward;
                    const x=tunnelA[0]+(tunnelB[0]-tunnelA[0])*progress;
                    box(motionData,x,0.30,3.35+(direction*0.16),0.10,0.08,0.08,pathColor);
                }
            }
            // The original radar animated the crane trolley and sweep independently.
            const trolleyX=-3.15+(motionOkay()?Math.sin(now/700)*0.78:0);
            box(motionData,trolleyX,3.67,2.70,0.55,0.18,0.56,C.craneDark);
            box(motionData,trolleyX,3.30,2.70,0.035,0.58,0.035,C.steel);
            box(motionData,trolleyX,3.00,2.70,0.78,0.08,0.94,C.crane);
            const sweepAngle=motionOkay()?((now*0.00035)% (Math.PI*2)):0;
            const sweepEnd=[-4.6+Math.cos(sweepAngle)*1.4,0.055,4.45+Math.sin(sweepAngle)*1.4];
            ribbon(motionData,[-4.6,0.055,4.45],sweepEnd,0.035,[0.16,0.66,0.72]);
            const fleetData=[];
            const timeSeconds=motionOkay()?now/1000:0;
            const heatColor=!modelState.valid?[0.52,0.57,0.55]:modelState.withinReference?[0.14,0.72,0.64]:[0.92,0.27,0.30];
            for(let i=0;i<3;i++) box(motionData,-1.48+i*0.56,1.46,1.52,0.44,0.035,0.52,heatColor);
            // Static heat-ingress cues frame the cutaway; color follows the illustrative model only.
            box(motionData,-2.12,1.30,1.06,0.36,0.035,0.035,heatColor);
            triangle(motionData,[-1.92,1.30,1.06],[-1.78,1.39,1.06],[-1.78,1.21,1.06],[0,0,1],heatColor);
            box(motionData,0.88,1.30,1.06,0.36,0.035,0.035,heatColor);
            triangle(motionData,[0.68,1.30,1.06],[0.54,1.39,1.06],[0.54,1.21,1.06],[0,0,1],heatColor);
            for(const vehicle of demoFleet) {
                const direction=vehicle.lane%2===0?1:-1;
                const speed=vehicle.moving?0.025:0;
                const progress=vehicle.moving?((vehicle.progress+timeSeconds*speed)%1):vehicle.progress;
                const [x,y,laneZ]=routePosition(progress,vehicle.lane);
                const color=vehicle.moving?markerColor:[0.12,0.52,0.78];
                // Each vehicle gets its own tractor, cab and refrigerated box.
                box(fleetData,x,y,laneZ,0.72,0.12,0.27,color);
                box(fleetData,x-direction*0.25,y+0.14,laneZ,0.22,0.18,0.25,[0.72,0.84,0.84]);
                box(fleetData,x+direction*0.13,y+0.16,laneZ,0.39,0.25,0.25,vehicle.moving?[0.06,0.40,0.45]:[0.10,0.25,0.37]);
                for(const wx of [x-0.22,x+0.23]) wheel(fleetData,wx,y-0.07,laneZ-0.15,0.075,0.045,C.rubber,8);
                if(vehicle.moving) {
                    // Short route-tail segments are deterministic per vehicle and scenario colored.
                    const tailSteps=vehicle.trailLength;
                    const tailEnd=Math.max(0,progress-0.045);
                    for(let step=1;step<tailSteps;step++) {
                        const p0=Math.max(0,tailEnd-(step-1)*0.0032),p1=Math.max(0,tailEnd-step*0.0032);
                        const q0=routePosition(p0,vehicle.lane),q1=routePosition(p1,vehicle.lane);
                        ribbon(fleetData,[q0[0],0.245,q0[2]],[q1[0],0.245,q1[2]],0.018,pathColor);
                    }
                }
            }
            gl.bindBuffer(gl.ARRAY_BUFFER,motionBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(motionData),gl.DYNAMIC_DRAW);
            motionVertices=motionData.length/9;
            bindBuffer(motionBuffer);gl.drawArrays(gl.TRIANGLES,0,motionVertices);
            gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(fleetData),gl.DYNAMIC_DRAW);
            gl.drawArrays(gl.TRIANGLES,0,fleetData.length/9);
        }
        function onPointerDown(event){drag={x:event.clientX,y:event.clientY,id:event.pointerId};canvas.setPointerCapture(event.pointerId);}
        function onPointerMove(event){if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.x=event.clientX;drag.y=event.clientY;yaw-=dx*0.007;pitch=Math.max(0.12,Math.min(1.15,pitch+dy*0.006));if(!motionOkay())renderOnce();}
        function onPointerUp(){drag=null;}
        function onWheel(event){event.preventDefault();distance=Math.max(10,Math.min(23,distance+event.deltaY*0.012));if(!motionOkay())renderOnce();}
        function onKey(event){const step=0.10;if(event.key==="ArrowLeft")yaw-=step;else if(event.key==="ArrowRight")yaw+=step;else if(event.key==="ArrowUp")pitch=Math.min(1.15,pitch+step);else if(event.key==="ArrowDown")pitch=Math.max(0.12,pitch-step);else if(event.key==="+"||event.key==="=")distance=Math.max(10,distance-0.8);else if(event.key==="-")distance=Math.min(23,distance+0.8);else return;event.preventDefault();if(!motionOkay())renderOnce();}
        function renderOnce(){draw(performance.now()+40,true);}
        function onMotionChange(event){if(event.matches){if(raf)cancelAnimationFrame(raf);raf=0;notifyFallback(false,"reduced-motion-static");renderOnce();}else{lastFrame=0;notifyFallback(false,"webgl-ready");if(visible)draw(performance.now());}}
        function onContextLost(event){event.preventDefault();disposed=true;if(apiRef)apiRef.available=false;if(raf)cancelAnimationFrame(raf);notifyFallback(true,"webgl-context-lost");}
        canvas.addEventListener("pointerdown",onPointerDown);canvas.addEventListener("pointermove",onPointerMove);canvas.addEventListener("pointerup",onPointerUp);canvas.addEventListener("pointercancel",onPointerUp);canvas.addEventListener("wheel",onWheel,{passive:false});canvas.addEventListener("keydown",onKey);canvas.addEventListener("webglcontextlost",onContextLost,false);
        const resizeObserver=window.ResizeObserver?new ResizeObserver(()=>{if(!motionOkay())renderOnce();}):null;
        if(resizeObserver&&canvas.parentElement)resizeObserver.observe(canvas.parentElement);
        window.addEventListener("resize",onResize);function onResize(){if(!motionOkay())renderOnce();}
        if(reducedMotion&&reducedMotion.addEventListener)reducedMotion.addEventListener("change",onMotionChange);
        function update(next){if(disposed)return;modelState=createSceneState(next.scenario,next.result);updateDynamic();if(!motionOkay())renderOnce();}
        update({scenario:"normal",result:{valid:false}});
        if(motionOkay())draw(performance.now());else renderOnce();
        apiRef={
            available:true,
            update,
            setVisible(next){if(disposed)return;const nextVisible=Boolean(next);if(nextVisible===visible)return;visible=nextVisible;if(!visible&&raf){cancelAnimationFrame(raf);raf=0;}else if(visible){if(motionOkay())draw(performance.now());else renderOnce();}},
            dispose(){disposed=true;if(raf)cancelAnimationFrame(raf);if(resizeObserver)resizeObserver.disconnect();window.removeEventListener("resize",onResize);if(reducedMotion&&reducedMotion.removeEventListener)reducedMotion.removeEventListener("change",onMotionChange);canvas.removeEventListener("pointerdown",onPointerDown);canvas.removeEventListener("pointermove",onPointerMove);canvas.removeEventListener("pointerup",onPointerUp);canvas.removeEventListener("pointercancel",onPointerUp);canvas.removeEventListener("wheel",onWheel);canvas.removeEventListener("keydown",onKey);canvas.removeEventListener("webglcontextlost",onContextLost);if(labelOverlay.parentElement)labelOverlay.remove();gl.deleteBuffer(staticBuffer);gl.deleteBuffer(dynamicBuffer);gl.deleteBuffer(motionBuffer);gl.deleteProgram(program);notifyFallback(true,"disposed");}
        };
        return apiRef;
    }

    return { createSceneState, createDemoFleet, SCENE_MANIFEST, mount };
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
        const fleetLabels=root.document.querySelector(".port-fleet-label-overlay");
        if(fleetLabels)fleetLabels.hidden=useFallback;
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
