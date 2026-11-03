import {partFaces} from './truck-design.js';
import {harborLayout, truckLayout, ROUTE, ZONES} from './harbor-layout.js';
import {VIEWS, project, boxVertices, shade, clamp, fitView, zoomBounds, zoomDistance} from './observatory-model.js';
// A true perspective-projected, orbitable low-poly scene. Deliberately labeled
// Software 3D: this path is not evidence that WebGL/PBR rendering works.
export function createSoftwareStage(canvas,onInspect) {
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas 2D is unavailable');
  let mode='port', view={...VIEWS.port,target:[...VIEWS.port.target]},drag=null,dirty=true,last=0,cutaway=false,thermal=0;
  const harbor=harborLayout(); let w=0,h=0,boxes=[],labels=[],bounds=zoomBounds(view.distance);
  const resize=()=>{const r=canvas.getBoundingClientRect();if(r.width<=0||r.height<=0)return;w=r.width;h=r.height; const d=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);view=fitView(mode,w,h);bounds=zoomBounds(view.distance);dirty=true;};
  const ro=new ResizeObserver(resize);ro.observe(canvas);resize();
  const down=e=>{drag={x:e.clientX,y:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);};
  const move=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved ||= Math.abs(dx)+Math.abs(dy)>3;view.yaw-=dx*.007;view.pitch=clamp(view.pitch+dy*.006,.12,1.35);drag.x=e.clientX;drag.y=e.clientY;dirty=true;};
  const up=e=>{if(drag&&!drag.moved){const r=canvas.getBoundingClientRect();const hit=labels.find(l=>Math.hypot(l.x-(e.clientX-r.left),l.y-(e.clientY-r.top))<34);if(hit)onInspect(hit.id);}drag=null;};
  const zoom=factor=>{view.distance=zoomDistance(view.distance,factor,bounds);dirty=true;};
  const wheel=e=>{e.preventDefault();const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?h:1);zoom(Math.exp(clamp(pixels,-1000,1000)*.001));};
  const cancel=()=>{drag=null;};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('wheel',wheel,{passive:false});
  const key=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','r','R'].includes(e.key))return;e.preventDefault();if(e.key==='r'||e.key==='R')setView(mode);if(e.key==='ArrowLeft')view.yaw-=.12;if(e.key==='ArrowRight')view.yaw+=.12;if(e.key==='ArrowUp')view.pitch=clamp(view.pitch+.08,.12,1.35);if(e.key==='ArrowDown')view.pitch=clamp(view.pitch-.08,.12,1.35);if(e.key==='+')zoom(1/1.1);if(e.key==='-')zoom(1.1);dirty=true;};
  canvas.addEventListener('keydown',key);
  function setView(next){mode=next;view=fitView(next,w,h);bounds=zoomBounds(view.distance);dirty=true;}
  function render(s,t=0) {
    const warmth=clamp((s.temp-s.cargo.prechill)/Math.max(1,s.cargo.critical-s.cargo.prechill),0,1);
    if(Math.abs(warmth-thermal)>.03){thermal=warmth;dirty=true;}
    if(!dirty&&t-last<1)return;last=t;dirty=false;
    ctx.clearRect(0,0,w,h); const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#171e1a');sky.addColorStop(1,'#343b31');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    boxes=[...(mode==='port'?harbor:[{name:'studio ground',p:[0,-.13,0],s:[42,.2,24],color:'#41463d',outline:false}]),...truckLayout({cutaway:cutaway||mode==='thermal',warmth})];
    const faces=[];
    for(const box of boxes){const vs=boxVertices(box).map(p=>project(p,view,w,h));const topology=partFaces(box);for(let i=0;i<topology.length;i++){const poly=topology[i].map(j=>vs[j]);if(poly.some(v=>!v.visible))continue;const [a,b,c]=poly; if((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)<0)continue;faces.push({poly,outline:box.outline!==false,depth:box.name==='studio ground'?Infinity:poly.reduce((sum,p)=>sum+p.depth,0)/poly.length,color:shade(box.color,box.profile||box.radial?(i===0?.68:i===1?.95:.7+.3*Math.max(0,Math.sin((i-2)/Math.max(1,topology.length-2)*Math.PI*2))):[.68,.95,.62,1.13,.8,.88][i])});}}
    faces.sort((a,b)=>b.depth-a.depth);
    for(const f of faces){ctx.beginPath();f.poly.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=f.color;ctx.fill();if(f.outline){ctx.strokeStyle='rgba(7,15,10,.16)';ctx.lineWidth=.6;ctx.stroke();}}
    labels=[];
    if(mode==='port') {
      ctx.beginPath();ROUTE.forEach((p,i)=>{const q=project(p,view,w,h);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.strokeStyle='#e4c885';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);
      for(const zone of ZONES){const p=project(zone.position,view,w,h);if(!p.visible)continue;labels.push({...p,id:zone.id});ctx.fillStyle='#e7d5a4';ctx.beginPath();ctx.arc(p.x,p.y,11,0,Math.PI*2);ctx.fill();ctx.fillStyle='#222a21';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText(zone.name.slice(0,2),p.x,p.y+3);}
    }
  }
  return {kind:'software',setView,render,setScenario(sc){cutaway=!!sc.props.cutaway;dirty=true;},focus(id){setView(id==='core'?'thermal':'vehicle');},focusZone(){},invalidate(){dirty=true;},dispose(){ro.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',key);}};
}
