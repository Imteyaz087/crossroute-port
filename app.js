import {createTelemetry} from './scene/telemetry.js';
import {SCENARIOS} from './scene/scenarios.js';
import {ZONES} from './scene/harbor-layout.js';
import {createSoftwareStage} from './scene/software-stage.js';
import {sceneQuality} from './scene/observatory-model.js';
import {createModelRecord} from './scene/model-record.js';

const $=id=>document.getElementById(id);
const tel=createTelemetry(),motion=matchMedia('(prefers-reduced-motion: reduce)');
let idx=0,view='port',component='core',elapsed=0,paused=motion.matches,touring=false,tourTime=0,last=0,lastHUD=0,record=null;
let software=null,gpu=null,active=null,disposed=false;
const componentInfo={
  core:{title:'CARGO CORE / MODEL',value:s=>`${s.temp.toFixed(1)}°C`,desc:'Core estimate from a lumped heat-capacity model. Thermal cutaway colors are illustrative, not individual sensor readings.'},
  carrier:{title:'REFRIGERATION / ASSUMPTION',value:s=>s.unitMode.startsWith('OFF')?'0 kW':s.unitMode.startsWith('PULL')?'10 kW':'7.5 kW',desc:'Assumed cooling capacity, not measured electrical draw. Select power interruption and shore recovery to compare the modeled response.'},
  battery:{title:'TRACTOR BATTERY / SCRIPTED',value:s=>`${s.soc.toFixed(0)}%`,desc:'Scenario-driven state of charge. This value is interpolated, not derived from a validated battery or drivetrain model.'},
  canbus:{title:'CAN NODE / DEMO SIGNAL',value:s=>`${s.canHz} Hz`,desc:'A scripted sample-rate label. No vehicle CAN bus, customer system or port feed is connected.'},
  seal:{title:'E-SEAL / DEMO EVENT',value:()=> 'SIMULATED',desc:'Illustrative electronic-seal event. No real seal verification, customs release or access authorization is performed.'}
};
const shortTitles=['Transit','Power interruption','Gate queue','Shore recovery','Model record'];
$('s-steps').replaceChildren(...SCENARIOS.map((s,i)=>{const li=document.createElement('li'),b=document.createElement('button'),n=document.createElement('b'),title=document.createElement('span');n.textContent=String(i+1).padStart(2,'0');title.textContent=shortTitles[i];b.append(n,title);b.onclick=()=>go(i,true);b.setAttribute('aria-label',`Scenario ${i+1}: ${s.title}`);li.append(b);return li;}));
function stopTour(){touring=false;tourTime=0;$('btnTour').textContent='▷ Auto tour';$('btnTour').setAttribute('aria-pressed','false');}
function setPause(value){paused=value;$('btnPause').textContent=paused?'▷ Resume model':'Ⅱ Pause model';$('btnPause').setAttribute('aria-pressed',String(paused));}
function go(i,manual=false){
  if(!Number.isInteger(i)||i<0||i>=SCENARIOS.length)return;
  if(manual)stopTour();idx=i;const sc=SCENARIOS[i];tel.apply(sc);
  $('s-idx').textContent=i+1;$('s-title').textContent=sc.title;$('s-body').textContent=sc.body;
  $('s-events').replaceChildren(...sc.events.map(e=>{const li=document.createElement('li');li.textContent=e;return li;}));
  [...$('s-steps').children].forEach((li,k)=>{const b=li.firstElementChild;if(k===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  $('prev').disabled=i===0;$('next').disabled=i===SCENARIOS.length-1;
  updateScenes('setScenario',sc);updateHUD();
}
function setView(mode){
  if(!['port','vehicle','thermal'].includes(mode))return;view=mode;updateScenes('setView',mode);
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===mode)));
  const copy={port:['A terminal, connected.','Schematic geometry · no live port connection'],vehicle:['Every component has a role.','Tractor + 40ft reefer · illustrative engineering model'],thermal:['Look inside the cold chain.','20-pallet cutaway · colors are not sensor readings']};
  $('view-title').textContent=copy[mode][0];$('view-caption').textContent=copy[mode][1];
}
function inspect(id){
  if(!componentInfo[id])return;component=id;setView(id==='core'?'thermal':'vehicle');updateScenes('focus',id);
  document.querySelectorAll('[data-component]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.component===id)));updateHUD();
}
function inspectZone(id){
  const zone=ZONES.find(z=>z.id===id);if(!zone)return;$('zone-readout').textContent=zone.detail;
  document.querySelectorAll('[data-zone]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.zone===id)));
  if(id==='vehicle')setView('vehicle');else setView('port');
}
function updateHUD(){
  const s=tel.state;$('k-temp').textContent=`${s.temp.toFixed(1)}°C`;$('k-soc').textContent=`${s.soc.toFixed(0)}%`;$('k-ingress').textContent=`${s.heatIngressKw.toFixed(2)} kW`;
  const lvl=Object.values(s.alerts).includes('crit')?'crit':Object.values(s.alerts).length?'warn':'ok';
  $('k-status').className=lvl;$('k-status').textContent=s.breachOccurred&&s.withinRef?'REVIEW':{ok:'NOMINAL',warn:'ADVISORY',crit:'CRITICAL'}[lvl];if(s.breachOccurred&&s.withinRef)$('k-status').className='warn';
  $('margin-readout').textContent=s.marginC>=0?`${s.marginC.toFixed(1)}°C to reference upper limit`:`${Math.abs(s.marginC).toFixed(1)}°C above reference upper limit`;
  $('mode-readout').textContent=s.breachOccurred&&s.withinRef?'Recovered estimate · prior exceedance retained':s.unitMode;$('k-spoilage').textContent=`NT$${s.cargo.valueTWD.toLocaleString('en-US')}`;$('k-demurrage').textContent=`NT$${s.demurrageAvoidedTWD.toLocaleString('en-US')}`;
  const info=componentInfo[component];$('inspect-label').textContent=info.title;$('inspect-value').textContent=info.value(s);$('inspect-desc').textContent=info.desc+(component==='core'&&s.breachOccurred?` Prior simulated exceedance retained; peak ${s.peakTemp.toFixed(1)}°C. Recovery does not establish cargo acceptability.`:'');
  const secs=Math.floor(elapsed*120);$('sim-clock').textContent=`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;
}
$('prev').onclick=()=>go(idx-1,true);$('next').onclick=()=>go(idx+1,true);
$('cargoSelect').onchange=e=>{tel.setCargo(e.target.value);$('cargoDesc').textContent=tel.state.cargo.desc;go(idx);software?.invalidate();};
$('ambientSlider').oninput=e=>{tel.setAmbient(Number(e.target.value));$('ambientVal').textContent=`${tel.state.ambientC}°C`;updateHUD();};
$('btnPause').onclick=()=>{setPause(!paused);if(paused)stopTour();};
$('btnTour').onclick=()=>{if(touring){stopTour();return;}setPause(false);touring=true;tourTime=0;if(idx===SCENARIOS.length-1)go(0);$('btnTour').textContent='Ⅱ Stop tour';$('btnTour').setAttribute('aria-pressed','true');};
$('btnReset').onclick=()=>{stopTour();elapsed=0;tel.setCargo($('cargoSelect').value);tel.state.soc=82;tel.state.drive=1;go(0);setView('port');setPause(motion.matches);};
$('btnCameraReset').onclick=()=>setView(view);
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);
for(const b of document.querySelectorAll('[data-component]'))b.onclick=()=>inspect(b.dataset.component);
for(const b of document.querySelectorAll('[data-zone]'))b.onclick=()=>inspectZone(b.dataset.zone);
// No global arrow-key shortcut: native select/range keys must remain native.
let previousFocus=null;
function openRecord(){
  record=createModelRecord(tel.state,SCENARIOS[idx],elapsed,active?.kind||'unavailable');previousFocus=document.activeElement;
  $('m-cargo').textContent=tel.state.cargo.name;$('m-temp').textContent=`${record.outputs.coreEstimateC}°C`;
  $('m-status').textContent=record.outputs.priorReferenceExceedance?(record.outputs.withinReferenceUpper?'Current within upper; prior exceedance retained':'Above upper; exceedance retained'):'Currently within illustrative upper reference';
  $('m-carbon').textContent='Not calculated or verified';$('m-roi').textContent=`NT$${record.inputs.assumedCargoValueTWD.toLocaleString('en-US')} · input, not avoided loss`;
  $('isoModal').hidden=false;document.body.classList.add('modal-open');$('btnCloseModal').focus();
}
function closeRecord(){$('isoModal').hidden=true;document.body.classList.remove('modal-open');previousFocus?.focus();}
$('btnExportIso').onclick=openRecord;$('btnCloseModal').onclick=closeRecord;$('btnCloseRecord').onclick=closeRecord;
$('isoModal').onclick=e=>{if(e.target===$('isoModal'))closeRecord();};
$('isoModal').onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();closeRecord();}if(e.key==='Tab'){const items=[...$('isoModal').querySelectorAll('button')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
$('btnDownload').onclick=()=>{if(!record)return;const blob=new Blob([JSON.stringify(record,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='crossroute-synthetic-model-record.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
motion.addEventListener('change',()=>{if(motion.matches){setPause(true);stopTour();}gpu?.setReduced?.(motion.matches);});
function retireSoftware(reason,error) {
  const failed=software;software=null;if(active===failed)active=null;
  try{failed?.dispose();}catch(cleanupError){console.warn('Software cleanup failed:',cleanupError.message);}
  $('software-stage').hidden=true;
  if(!gpu){active=null;$('renderer-mode').textContent='3D unavailable · controls usable';$('renderer-mode').title=reason;}
  if(error)console.warn('Software rendering retired:',error.message);
}
function useSoftware(reason) {
  active=software;$('stage').hidden=true;$('stage').style.visibility='';$('software-stage').hidden=!software;
  if(software){try{software.setView(view);software.setScenario(SCENARIOS[idx]);}catch(error){retireSoftware(reason,error);}}
  $('renderer-mode').textContent=software?'Software 3D · reduced detail':'3D unavailable · controls usable';$('renderer-mode').title=reason;
}
function failGPU(reason,error) {
  const failed=gpu;gpu=null; // Clear first: cleanup/context-loss callbacks cannot re-promote it.
  try{failed?.dispose();}catch(cleanupError){console.warn('GPU cleanup failed:',cleanupError.message);}
  useSoftware(reason);
  if(error)console.warn('GPU rendering retired:',error.message);
}
function updateScenes(method,...args) {
  if(software){try{software[method](...args);}catch(error){retireSoftware('Software update failed',error);}}
  if(gpu){try{gpu[method](...args);}catch(error){failGPU('GPU update failed',error);}}
}
try{software=createSoftwareStage($('software-stage'),inspectZone);active=software;$('renderer-mode').textContent='Software 3D · loading GPU';}catch(error){$('renderer-mode').textContent='3D unavailable · controls still work';console.warn('Software scene unavailable:',error.message);}
go(0);setPause(paused);$('cargoDesc').textContent=tel.state.cargo.desc;
// CDN dependency and WebGL errors cannot interrupt controls, telemetry or export.
import('./port-scene.js').then(({createPortStage})=>{
  if(disposed)return;
  // Keep the software scene visible. The hidden GPU canvas participates in layout
  // so its first draw uses the real viewport rather than a 0×0 hidden element.
  $('stage').hidden=false;$('stage').style.visibility='hidden';
  gpu=createPortStage($('stage'),{reduced:motion.matches,onInspect:inspectZone,onLost:()=>failGPU('GPU context lost')});
  gpu.setView(view);gpu.setScenario(SCENARIOS[idx]);
  // Promotion happens only after a successful draw in frame().
}).catch(error=>{failGPU('GPU unavailable',error);});
let frameId=0,lastRender=0;
function frame(now){
  if(disposed)return;frameId=requestAnimationFrame(frame);const dt=Math.min((now-(last||now))/1000,.1);last=now;
  if(document.hidden)return;
  if(!paused){elapsed+=dt;tel.tick(dt);if(touring){tourTime+=dt;if(tourTime>=8){tourTime=0;go((idx+1)%SCENARIOS.length);}}}
  if(now-lastHUD>200){updateHUD();lastHUD=now;}
  const fps=sceneQuality(innerWidth,1,motion.matches).fps;
  if(now-lastRender>=1000/fps){
    const args=[tel.state,elapsed,(now-(lastRender||now))/1000,!paused&&!motion.matches];
    if(gpu){
      const pending=gpu;
      try{
        pending.render(...args);
        if(gpu===pending){active=pending;$('stage').hidden=false;$('stage').style.visibility='';$('software-stage').hidden=true;$('renderer-mode').textContent='WebGL · PBR 3D';$('renderer-mode').title='A GPU draw completed successfully';}
      }catch(error){failGPU('GPU draw failed',error);}
    }
    if(!gpu&&software){try{software.render(...args);}catch(error){retireSoftware('Software draw failed',error);}}
    lastRender=now;
  }
}
frameId=requestAnimationFrame(frame);
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frameId);try{gpu?.dispose();}catch{}try{software?.dispose();}catch{}},{once:true});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
window.CrossRouteTwin={telemetry:tel,setScenario:i=>go(i,true),get rendererMode(){return active?.kind||'unavailable';},get stage(){return gpu?.debug;}};
