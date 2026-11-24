import {createTelemetry, thresholdsFor} from './scene/telemetry.js';
import {SCENARIOS} from './scene/scenarios.js';
import {ZONES} from './scene/harbor-layout.js';
import {createSoftwareStage} from './scene/software-stage.js';
import {sceneQuality} from './scene/observatory-model.js';
import {createModelRecord} from './scene/model-record.js';
import {CARGO} from './scene/params.js';
import {CHANNELS, CHANNEL_LABEL} from './scene/alarms.js';
import {verifyChain} from './scene/event-log.js';
import {runMonteCarlo} from './scene/montecarlo.js';
import {renderSwimlane, drawChart, renderGauges, renderAlarms, renderLog, renderSources} from './scene/ops-ui.js';

const $=id=>document.getElementById(id);
const tel=createTelemetry(),motion=matchMedia('(prefers-reduced-motion: reduce)');
let idx=0,view='port',component='core',elapsed=0,paused=motion.matches,touring=false,tourTime=0,last=0,lastHUD=0,lastOps=0,record=null,mc=null,mcJobId=0,logDirty=true;
let software=null,gpu=null,active=null,disposed=false;
const fmt=t=>tel.clock.format(t);
const componentInfo={
  core:{title:'PRODUCT CORE / MODEL',value:s=>`${s.temp.toFixed(1)}°C`,desc:s=>`Three-node heat balance: return air ${s.readings.returnAir.toFixed(1)}°C · surface ${s.readings.surface.toFixed(1)}°C · core ${s.readings.core.toFixed(1)}°C. Cutaway colours are illustrative.`},
  carrier:{title:'REEFER UNIT / CAPACITY MAP',value:s=>`${(s.readings.Pel/1000).toFixed(1)} kW`,desc:s=>`${s.unit.name}. Cooling ${(s.readings.Qref/1000).toFixed(2)} of ${(s.readings.cap/1000).toFixed(2)} kW available at this box/ambient; COP ${Number.isFinite(s.readings.COP)?s.readings.COP.toFixed(2):'—'}. Power source: ${s.readings.source}.`},
  battery:{title:'TRACTOR BATTERY / ENERGY BALANCE',value:s=>`${s.soc.toFixed(1)}%`,desc:s=>`ΔSoC = (P_reefer/η_inv + P_aux + P_drive)·t / usable kWh. Used ${s.readings.battUsedKWh.toFixed(2)} kWh of ${s.cfg.usableKWh} kWh (estimate). ${s.cfg.mobile==='genset'?'Genset selected: battery only drives the tractor.':''}`},
  canbus:{title:'EVENT LOG / HASH CHAIN',value:()=>`${tel.log.list().length} ev`,desc:()=>`Append-only SHA-256 chain, storage: ${tel.log.backend}. Unsigned: detects edits after the fact; it does not prove who wrote a record.`},
  seal:{title:'E-SEAL / EIR (SYNTHETIC)',value:()=>{const e=tel.log.list().filter(x=>x.type==='EIR_signed').at(-1);return e?e.payload.sealId:'—';},desc:()=>'Synthetic seal ID recorded on the EIR event. No real seal verification, customs release or gate authorization is performed.'}
};
const shortTitles=SCENARIOS.map(s=>s.short);
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
  updateScenes('setScenario',sc);updateHUD();runMC();logDirty=true;updateOps(true);
}
function restartWith(patch){tel.setConfig(patch);updateScenes('setScenario',SCENARIOS[idx]);runMC();logDirty=true;updateHUD();updateOps(true);}
function setView(mode){
  if(!['port','vehicle','thermal'].includes(mode))return;view=mode;updateScenes('setView',mode);
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===mode)));
  const copy={port:['A terminal, schematically.','Schematic geometry · not a Terminal 7 survey · no live port connection'],vehicle:['Every component has a role.','Tractor + 40ft reefer · illustrative engineering model'],thermal:['Look inside the cold chain.','20-pallet cutaway · colours are not sensor readings']};
  $('view-title').textContent=copy[mode][0];$('view-caption').textContent=copy[mode][1];
}
function inspect(id){
  if(!componentInfo[id])return;component=id;setView(id==='core'?'thermal':'vehicle');updateScenes('focus',id);
  document.querySelectorAll('[data-component]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.component===id)));updateHUD();
}
function inspectZone(id){
  const zone=ZONES.find(z=>z.id===id);if(!zone)return;$('zone-readout').textContent=zone.detail;
  document.querySelectorAll('[data-zone]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.zone===id)));
  if(id==='vehicle')setView('vehicle');else{setView('port');updateScenes('focusZone',id);}
}
function updateHUD(){
  const s=tel.state,r=s.readings;if(!r)return;
  $('k-temp').textContent=`${s.temp.toFixed(1)}°C`;$('k-soc').textContent=`${s.soc.toFixed(0)}%`;$('k-ingress').textContent=`${s.heatIngressKw.toFixed(2)} kW`;
  const lvl=s.level;$('k-status').className=lvl;$('k-status').textContent={ok:s.breachOccurred?'REVIEW':'NOMINAL',warn:'ADVISORY',crit:'CRITICAL'}[lvl];if(lvl==='ok'&&s.breachOccurred)$('k-status').className='warn';
  const lim=s.cargo.critical;$('margin-readout').textContent=`Return air ${r.returnAir.toFixed(1)}°C · ${s.marginC>=0?`${s.marginC.toFixed(1)} K below`:`${Math.abs(s.marginC).toFixed(1)} K above`} ${lim}°C ${s.cargo.practiceUpperC!=null?'practice':'limit'} (warmest product node)`;
  $('soc-readout').textContent=s.cfg.mobile==='ev'?`Energy balance · ${r.battUsedKWh.toFixed(1)} kWh used`:`Genset selected · fuel ${r.fuelL.toFixed(0)} L`;
  const f=r.flows;$('ingress-readout').textContent=`Wall ${(f.Qwall/1000).toFixed(2)} · sun ${(f.Qsol/1000).toFixed(2)} · asphalt ${(f.Qasph/1000).toFixed(2)} · infil ${(f.Qinf/1000).toFixed(2)}${f.Qdoor?` · door ${(f.Qdoor/1000).toFixed(1)}`:''} kW`;
  $('mode-readout').textContent=s.breachOccurred&&s.withinRef?`${s.unitMode} · prior exceedance retained`:s.unitMode;
  $('k-spoilage').textContent=`NT$${s.cargo.valueTWD.toLocaleString('en-US')}`;$('k-demurrage').textContent=`NT$${s.queueCost.totalTWD.toLocaleString('en-US')}`;
  const info=componentInfo[component];$('inspect-label').textContent=info.title;$('inspect-value').textContent=info.value(s);$('inspect-desc').textContent=info.desc(s)+(component==='core'&&s.breachOccurred?` Prior exceedance retained; peak ${s.peakTemp.toFixed(1)}°C. Recovery does not establish cargo acceptability.`:'');
  $('sim-clock').textContent=fmt(tel.clock.t);$('clock-scale').textContent=`SIM H:M:S · ${tel.clock.scale}×`;
}
function legalLines(){
  const c=CARGO[tel.cfg.cargoId],th=thresholdsFor(c),L=[];
  if(c.regime==='frozen'){L.push({y:-18,label:'−18°C GHP Art.4 附件一 (equipment) / 品溫 product',color:'#f3a28a'});L.push({y:-12,label:'−12°C GHP Art.8 box air during handling',color:'#f3a28a',dash:[6,4]});}
  if(c.regime==='chilled'){L.push({y:7,label:'7°C GHP Art.4 附件一 / Art.8',color:'#f3a28a'});}
  if(th.practice!=null)L.push({y:th.practice,label:'−50°C tuna: industry practice, NOT law',color:'#c9a6e0',dash:[2,3]});
  if(c.bandC){L.push({y:c.bandC[1],label:'Quality band high (estimate)',color:'#c9a6e0',dash:[2,3]});L.push({y:c.bandC[0],label:'Chilling-injury floor (estimate)',color:'#c9a6e0',dash:[2,3]});}
  L.push({y:tel.state.readings?.controllerSetpointC??0,label:`Controller setpoint ${tel.state.readings?.controllerSetpointC}°C`,color:'#6f7866',dash:[1,3]});
  return L;
}
let worker=null;
try{worker=new Worker(new URL('./scene/mc-worker.js',import.meta.url),{type:'module'});worker.onerror=e=>{e.preventDefault?.();console.info('MC worker unavailable, using main thread');worker=null;runMC();};}catch{worker=null;}
function mcDone(res,ms,where){
  mc=res;const th=res.thresholds,pc=x=>x==null?'n/a':`${Math.round(x*100)}%`;
  $('mc-status').textContent=`Monte Carlo: ${res.n} runs · ${ms} ms · ${where}`;
  $('mc-summary').textContent=`P(return air > ${th.returnAir??'—'}°C) ${pc(res.pReturnAirOver)} · P(surface > ${th.product??'—'}°C) ${pc(res.pSurfaceOver)} · P(core > ${th.product??'—'}°C) ${pc(res.pCoreOver)} over the scenario`;
  updateOps(true);
}
function runMC(){
  const id=++mcJobId,job=tel.mcJob(worker?120:60);mc=null;$('mc-status').textContent='Monte Carlo: running…';
  if(worker){worker.onmessage=e=>{if(e.data.id!==mcJobId)return;if(e.data.ok)mcDone(e.data.res,e.data.ms,'Web Worker');else{console.warn('MC failed:',e.data.error);$('mc-status').textContent='Monte Carlo failed';}};worker.postMessage({id,job});}
  else setTimeout(()=>{if(id!==mcJobId)return;const t0=performance.now();const res=runMonteCarlo(job);mcDone(res,Math.round(performance.now()-t0),'main thread');},30);
}
function renderChannels(){
  const r=tel.state.readings;if(!r)return;const f=tel.faults;
  $('channels').replaceChildren(...CHANNELS.map(ch=>{const d=document.createElement('div');d.className='chan'+(f[ch]?' fault':'');d.innerHTML=`<span>${CHANNEL_LABEL[ch]}</span><strong>${r[ch].toFixed(1)}°C</strong>${f[ch]?'<small>FAULT INJECTED: stuck</small>':''}`;return d;}));
}
function updateOps(force=false){
  const sc=SCENARIOS[idx],H=sc.horizonMin*60,s=tel.state;if(!s.readings)return;
  renderSwimlane($('swimlane'),tel.timeline,H,Math.min(tel.clock.t,H));
  drawChart($('bandChart'),{mc,history:s.history,horizonS:H,tNow:Math.min(tel.clock.t,H),lines:legalLines(),timeline:tel.timeline});
  renderGauges($('gauges'),s);renderChannels();
  renderAlarms($('alarmTable'),s.alarmRows,id=>{tel.ack(id,'operator');logDirty=true;updateOps(true);});
  if(logDirty||force){renderLog($('logTable'),tel.log.list(),fmt);$('logBackend').textContent=tel.log.backend;logDirty=false;}
}
tel.log.onAppend(()=>{logDirty=true;});
$('prev').onclick=()=>go(idx-1,true);$('next').onclick=()=>go(idx+1,true);
$('cargoSelect').onchange=e=>{tel.setCargo(e.target.value);$('cargoDesc').textContent=CARGO[e.target.value].desc;go(idx);software?.invalidate();};
$('ambientSlider').oninput=e=>{$('ambientVal').textContent=`${e.target.value}°C`;};
$('ambientSlider').onchange=e=>{tel.setAmbient(Number(e.target.value));restartWith({});};
$('solarSlider').oninput=e=>{$('solarVal').textContent=`${e.target.value} W/m²`;};
$('solarSlider').onchange=e=>restartWith({solarWm2:Number(e.target.value)});
$('unitSelect').onchange=e=>restartWith({unitId:e.target.value});
$('mobileSelect').onchange=e=>restartWith({mobile:e.target.value});
$('battSelect').onchange=e=>restartWith({usableKWh:Number(e.target.value)});
$('speedSelect').onchange=e=>{tel.clock.setScale(Number(e.target.value));updateHUD();};
$('btnFault').onclick=()=>{const on=!tel.faults.returnAir;tel.injectFault('returnAir',on?'stuck':null);$('btnFault').setAttribute('aria-pressed',String(on));$('btnFault').textContent=on?'✓ Clear stuck-sensor fault':'⚠ Inject stuck return-air sensor';tel.log.append('note',{note:on?'Fault injected: return-air sensor stuck (demo)':'Fault cleared: return-air sensor',source:'operator'},{tSim:tel.clock.t,source:'operator'});};
$('btnAckAll').onclick=()=>{tel.ackAll('operator');logDirty=true;updateOps(true);};
$('btnVerify').onclick=async()=>{const r=await tel.log.verify();$('verifyResult').textContent=`${r.ok?'✓ Chain intact':'✗ Chain broken'} · ${r.checked} records · ${r.reason}${r.head?` · head ${r.head.slice(0,16)}…`:''}`;$('verifyResult').className='micro '+(r.ok?'ok':'crit');};
$('btnTamper').onclick=async()=>{await tel.log.flush();const ev=tel.log.list();if(ev.length<3)return;const copy=ev.map(e=>JSON.parse(JSON.stringify(e)));const k=Math.floor(copy.length/2);copy[k].payload={...copy[k].payload,tampered:true};const r=await verifyChain(copy);$('verifyResult').textContent=`Tamper test on a COPY (record #${k} edited): ${r.ok?'NOT detected (bug)':`detected at #${r.firstBadSeq} · ${r.reason}`}. The live log is unchanged.`;$('verifyResult').className='micro '+(r.ok?'crit':'ok');};
$('btnNdjson').onclick=async()=>{await tel.log.flush();const blob=new Blob([tel.log.exportNDJSON()],{type:'application/x-ndjson'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`crossroute-synthetic-events-${tel.log.session}.ndjson`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('btnPause').onclick=()=>{setPause(!paused);if(paused)stopTour();};
$('btnTour').onclick=()=>{if(touring){stopTour();return;}setPause(false);touring=true;tourTime=0;if(idx===SCENARIOS.length-1)go(0);$('btnTour').textContent='Ⅱ Stop tour';$('btnTour').setAttribute('aria-pressed','true');};
$('btnReset').onclick=()=>{stopTour();elapsed=0;go(idx);setView('port');setPause(motion.matches);};
$('btnCameraReset').onclick=()=>setView(view);
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);
for(const b of document.querySelectorAll('[data-component]'))b.onclick=()=>inspect(b.dataset.component);
for(const b of document.querySelectorAll('[data-zone]'))b.onclick=()=>inspectZone(b.dataset.zone);
// No global arrow-key shortcut: native select/range keys must remain native.
let previousFocus=null;
function openRecord(){
  record=createModelRecord(tel,SCENARIOS[idx],active?.kind||'unavailable');previousFocus=document.activeElement;
  $('m-cargo').textContent=tel.state.cargo.name;$('m-temp').textContent=`${record.outputs.coreC}°C (return air ${record.outputs.returnAirC}°C)`;
  $('m-status').textContent=record.outputs.priorExceedance?(record.outputs.withinLimitNow?'Within limit now; prior exceedance retained':'Above limit; exceedance retained'):'Within limit so far (model)';
  $('m-carbon').textContent='Not calculated or verified';$('m-roi').textContent=`NT$${record.inputs.assumedCargoValueTWD.toLocaleString('en-US')} · input, not avoided loss`;
  $('isoModal').hidden=false;document.body.classList.add('modal-open');$('btnCloseModal').focus();
}
function closeRecord(){$('isoModal').hidden=true;document.body.classList.remove('modal-open');previousFocus?.focus();}
$('btnExportIso').onclick=openRecord;$('btnCloseModal').onclick=closeRecord;$('btnCloseRecord').onclick=closeRecord;
$('isoModal').onclick=e=>{if(e.target===$('isoModal'))closeRecord();};
$('isoModal').onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();closeRecord();}if(e.key==='Tab'){const items=[...$('isoModal').querySelectorAll('button')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
$('btnDownload').onclick=()=>{if(!record)return;const blob=new Blob([JSON.stringify(record,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='crossroute-synthetic-model-record.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
renderSources($('sourcesBody'));
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
go(0);setPause(paused);$('cargoDesc').textContent=CARGO[tel.cfg.cargoId].desc;
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
  if(now-lastOps>500){updateOps();lastOps=now;}
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
