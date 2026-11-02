import * as THREE from 'three';
import {createStage} from './scene/stage.js';
import {buildTwin} from './scene/twin.js';
import {buildHarbor} from './scene/harbor.js';
import {createNav} from './scene/nav.js';
import {VIEWS,cameraPosition,fitView,zoomBounds} from './scene/observatory-model.js';

// Imported dynamically after the independent controller is fully usable.
export function createPortStage(canvas,{onLost,onInspect,reduced=false}={}) {
const {renderer,scene,camera,dispose:disposeStage}=createStage(canvas);
const twin=buildTwin(), harbor=buildHarbor();scene.add(harbor.root,twin.root);
const nav=createNav(camera,canvas);let viewMode='port',activeScenario='transit';
const propsState={cutaway:0};let currentScenario=null;
function setView(mode){
  viewMode=mode;harbor.root.visible=mode==='port';
  const r=canvas.getBoundingClientRect();const v=fitView(mode,r.width||800,r.height||470);const bounds=zoomBounds(v.distance);nav.controls.minDistance=bounds.min;nav.controls.maxDistance=bounds.max;camera.far=Math.max(350,bounds.max+150);camera.updateProjectionMatrix();scene.fog.near=v.distance*1.6;scene.fog.far=bounds.max+100;
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
  focus(id){if(id==='core'){setView('thermal');return;}if(twin.anchors[id]){harbor.root.visible=false;const aspect=Math.max(.4,camera.aspect);nav.focusObject(twin.anchors[id],Math.max(9,9/aspect));}},
  render(s,t,dt,moving=true){animate=moving&&!reduced;if(!animate)cut=propsState.cutaway;nav.update(dt);bindVisuals(s,dt,reduced?0:t);harbor.update(t,reduced);renderer.render(scene,camera);},
  dispose(){resizeObserver.disconnect();canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('webglcontextlost',lost);nav.dispose();scene.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else {o.material?.map?.dispose();o.material?.dispose();}});disposeStage();},
  debug:{renderer,scene,camera,twin,nav}
};
}
