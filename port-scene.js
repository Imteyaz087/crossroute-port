import * as THREE from 'three';
import {createStage} from './scene/stage.js';
import {buildTwin} from './scene/twin.js';
import {buildHarbor} from './scene/harbor.js';
import {createNav} from './scene/nav.js';
import {VIEWS,cameraPosition,fitView,zoomBounds} from './scene/observatory-model.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// Port view is a night scene; Vehicle and Thermal keep the neutral studio rig.
const MOOD={
  port:{env:.3,key:[1.1,0xd9cfbb],fill:.75,rim:.4,fog:0x0b0a09,exposure:1.3,sun:[40,70,30],shadow:[55,45,200]},
  // Vehicle/Thermal: the same night port, with a showroom key and rim on the truck.
  hero:{env:.4,key:[1.35,0xfff1de],fill:.42,rim:1.05,fog:0x0b0a09,exposure:1,sun:[9,15,11],shadow:[16,12,60]},
};
// Close-up shots for zone pins in the port view (camera position, look-at target).
const SHOTS={quay:{pos:[-1,8.5,-3],tgt:[-17,6,-24]},gate:{pos:[26,7.5,22.5],tgt:[21,4,-2]},shore:{pos:[19,7.5,21.5],tgt:[6,1.5,12]}};

// Imported dynamically after the independent controller is fully usable.
export function createPortStage(canvas,{onLost,onInspect,reduced=false}={}) {
const {renderer,scene,camera,key,fill,rim,dispose:disposeStage}=createStage(canvas);
let composer=null,bloomSize='';
function setMood(m){
  scene.environmentIntensity=m.env;key.intensity=m.key[0];key.color.set(m.key[1]);fill.intensity=m.fill;rim.intensity=m.rim;
  scene.fog.color.set(m.fog);renderer.toneMappingExposure=m.exposure;key.position.set(...m.sun);
  const c=key.shadow.camera,[x,y,far]=m.shadow;Object.assign(c,{left:-x,right:x,top:y,bottom:-y,far});c.updateProjectionMatrix();
}
// Bloom only where shadows run (wider viewports); phones keep the plain render.
function draw(){
  if(!renderer.shadowMap.enabled){renderer.render(scene,camera);return;}
  if(!composer){composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(256,256),.42,.45,.9));composer.addPass(new OutputPass());}
  const size=renderer.getSize(new THREE.Vector2()),key2=`${size.x}x${size.y}@${renderer.getPixelRatio()}`;
  if(key2!==bloomSize){bloomSize=key2;composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(size.x,size.y);}
  composer.render();
}
const twin=buildTwin(), harbor=buildHarbor();scene.add(harbor.root,twin.root);
const nav=createNav(camera,canvas);let viewMode='port',activeScenario='transit';
const propsState={cutaway:0};let currentScenario=null;
function setView(mode){
  viewMode=mode;harbor.setStudio(mode!=='port');
  const r=canvas.getBoundingClientRect();const v=fitView(mode,r.width||800,r.height||470);if(mode==='port')v.distance*=.64;const bounds=zoomBounds(v.distance);nav.controls.minDistance=bounds.min;nav.controls.maxDistance=bounds.max;camera.far=Math.max(350,bounds.max+150);camera.updateProjectionMatrix();scene.fog.near=v.distance*1.6;scene.fog.far=bounds.max+100;
  setMood(mode==='port'?MOOD.port:MOOD.hero);if(mode==='port')nav.controls.minDistance=8;
  nav.home.tgt.set(...v.target);nav.home.pos.set(...cameraPosition(v));nav.focus(nav.home.tgt,nav.home.pos,reduced?.001:1.05);
  propsState.cutaway=(mode==='thermal'||currentScenario?.props.cutaway)?1:0;
}
function setScenario(sc){currentScenario=sc;activeScenario=sc.id;propsState.cutaway=(viewMode==='thermal'||sc.props.cutaway)?1:0;twin.fx.shoreCable.visible=!!sc.props.shore;twin.fx.gate.visible=!!sc.props.gate;}
const cold = new THREE.Color(0xece9e4);
const amber = new THREE.Color(0xf59e0b);
const crimson = new THREE.Color(0xef4444);
let cut = 0;let animate=true;

function bindVisuals(s, dt, t) {
  const { fx } = twin;
  const cargo = s.cargo;
  const crit = cargo.critical;
  const pre = cargo.prechill;

  // Air Volume Tint
  const warmth = THREE.MathUtils.clamp((s.temp - pre) / Math.max(1, crit - pre + 2), 0, 1);
  const currentTint = cold.clone().lerp(crimson, warmth);
  fx.airTint.material.color.copy(currentTint);
  fx.airTint.material.opacity = 0.04 + warmth * 0.14;

  // Cutaway Panel Slide
  cut += (propsState.cutaway - cut) * (1 - Math.exp(-dt * 4));
  fx.cutaway.position.y = cut * 3.2;
  fx.cutaway.visible = cut < .98; // retire the ghost panel once the cutaway is fully open
  fx.cutaway.material.depthWrite = cut < .05;
  if (fx.nearRibs) fx.nearRibs.visible = cut < 0.15;
  if (fx.roof) fx.roof.visible = cut < 0.15;
  fx.cutaway.material.opacity = 1 - cut * 0.85;

  // Animate Cold Frost Vapor Particles (revealed during cutaway & open reefer)
  if (fx.frost && fx.frostVel) {
    const pos = fx.frost.geometry.attributes.position.array;
    const isColdOpen = cut > 0.05 && s.temp <= -10;
    fx.frost.material.opacity = isColdOpen ? THREE.MathUtils.clamp(cut * 0.45, 0, 0.45) : 0;
    if (isColdOpen && animate) {
      for (let k = 0; k < fx.frostVel.length; k++) {
        const v = fx.frostVel[k];
        v.life += dt * 0.55;
        if (v.life > 1.0) {
          v.life = 0;
          pos[k * 3]     = v.x0;
          pos[k * 3 + 1] = v.y0;
          pos[k * 3 + 2] = v.z0;
        } else {
          pos[k * 3]     += v.vx * dt;
          pos[k * 3 + 1] += v.vy * dt;
          pos[k * 3 + 2] += v.vz * dt;
        }
      }
      fx.frost.geometry.attributes.position.needsUpdate = true;
    }
  }

  // Powertrain X-Ray Ghosting (Scenario 2: Yard Staging & Smart Tug)
  if (fx.cab) {
    const isXray = viewMode === 'vehicle' && activeScenario === 'gate'; // Scenario 2 reveals Yulon EV motor, inverter & battery
    const targetCabOpacity = isXray ? 0.35 : 1.0;
    fx.cab.material.opacity += (targetCabOpacity - fx.cab.material.opacity) * (1 - Math.exp(-dt * 5));
  }

  // 3D Thermal Slice Gradient across all 20 Pallet Stacks
  if (fx.palletLoads) {
    const isPowerOff = s.unitMode.startsWith('OFF');
    fx.palletLoads.forEach(p => {
      // Physical stratification: pallets near rear door (col 0..2) warm up fastest
      // Pallets near Carrier evaporator (col 8..9) stay coldest
      const distFromFront = (9 - p.col) / 9.0;
      const localWarmthDelta = isPowerOff ? distFromFront * 2.8 : distFromFront * 0.35;
      const palletTemp = s.temp + localWarmthDelta;

      let targetColor;
      if (palletTemp >= crit) {
        targetColor = crimson;
      } else if (palletTemp >= crit - 1.5) {
        targetColor = amber;
      } else {
        targetColor = cold;
      }
      p.material.color.lerp(targetColor, Math.min(1.0, dt * 3.0));
    });
  }

  const fanSpeed = s.unitMode.startsWith('OFF') ? 0 : s.unitMode.startsWith('PULL') ? 22 : 9;
  fx.fan.rotation.x += fanSpeed * (animate?dt:0);
  fx.wheels.forEach(w => (w.rotation.z -= s.drive * 3 * (animate?dt:0)));
  fx.nodeLed.material.emissiveIntensity = 1 + Math.sin(t * s.canHz * 0.25) * 1.2;
  const arm = fx.gate.userData.arm;
  if (arm) arm.rotation.x = 0;
}


const raycaster=new THREE.Raycaster();let pointerStart=null;
function pointerDown(e){pointerStart=[e.clientX,e.clientY];}
function pointerUp(e){if(viewMode!=='port'||!pointerStart)return;const moved=Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1]);pointerStart=null;if(moved>6)return;const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hit=raycaster.intersectObjects(harbor.pickTargets)[0];if(hit)onInspect?.(hit.object.userData.zoneId);}
canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',pointerUp);
function lost(e){e.preventDefault();onLost?.();}canvas.addEventListener('webglcontextlost',lost);
const resizeObserver=new ResizeObserver(()=>setView(viewMode));resizeObserver.observe(canvas);
setView('port');
return {kind:'webgl',setView,setScenario,setReduced(value){reduced=value;},
  focusZone(id){const shot=SHOTS[id];if(viewMode!=='port'||!shot)return;nav.focus(new THREE.Vector3(...shot.tgt),new THREE.Vector3(...shot.pos),reduced?.001:1.6);},
  focus(id){if(id==='core'){setView('thermal');return;}if(twin.anchors[id]){harbor.setStudio(true);const aspect=Math.max(.4,camera.aspect);nav.focusObject(twin.anchors[id],Math.max(9,9/aspect));}},
  render(s,t,dt,moving=true){animate=moving&&!reduced;if(!animate)cut=propsState.cutaway;nav.update(dt);bindVisuals(s,dt,reduced?0:t);harbor.update(t,reduced,camera);draw();},
  dispose(){resizeObserver.disconnect();canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('webglcontextlost',lost);nav.dispose();composer?.dispose();scene.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else {o.material?.map?.dispose();o.material?.dispose();}});disposeStage();},
  debug:{renderer,scene,camera,twin,nav}
};
}
