// Original schematic geometry, in metres; not manufacturer CAD or an equipment specification.
// One source for the native mesh builder, software projection and camera envelope.
export const TRUCK = Object.freeze({
  trailer: Object.freeze({length:12.19,height:2.9,width:2.44,x:-2.7,y:2.8}),
  cab: Object.freeze({x:6.75,y:2.65,width:2.45}),
  wheelRadius:.55, wheelY:.56,
  axles:Object.freeze([-7.8,-6.55,3.35,4.6,7.05]),
});
export const PALETTE = Object.freeze({
  cabPaint:'#e9e6de',cabAccent:'#373c37',glass:'#30453f',chassis:'#343934',
  tyre:'#222622',rim:'#aaa99f',battery:'#70766a',reeferSkin:'#e5e4d9',
  reeferRib:'#b7bcaf',interior:'#b4b9ab',carrier:'#515c54',carrierGrille:'#29312d',
  pallet:'#a88f6e',cargo:'#c9b79c',node:'#424a42',ledOk:'#64b88d',
  lamp:'#eee4c8',tailLamp:'#b5523f',reflector:'#c5a775',cable:'#292e29',
});
const CAB_PROFILE=[[-1.21,-1.3],[1.21,-1.3],[1.21,.25],[1.0,1.12],[.75,1.3],[-1.08,1.3],[-1.21,1.1]];

export function truckStructure({cutaway=false}={}) {
  const a=[];
  const add=(name,p,s,material,extra={})=>a.push({name,p,s,material,color:PALETTE[material],...extra});
  const {length:L,height:H,width:W,x:X,y:Y}=TRUCK.trailer;
  add('trailer chassis',[X,1.2,0],[L-.4,.26,1.08],'chassis');
  add('tractor chassis',[4.9,.98,0],[6.1,.28,1.04],'chassis');
  add('tractor cab',[TRUCK.cab.x,TRUCK.cab.y,0],[2.42,2.6,2.45],'cabPaint',{profile:CAB_PROFILE,role:'cab'});
  add('roof air deflector',[6.53,4.02,0],[2.1,.4,2.2],'cabPaint',{
    profile:[[-1.05,-.1],[1.05,-.1],[.55,.02],[-1.05,.25]],
  });
  add('windshield',[7.91,3.15,0],[.06,.97,2.1],'glass',{r:[0,0,.23]});
  add('windscreen centre mullion',[7.95,3.15,0],[.06,.97,.045],'cabAccent',{r:[0,0,.23]});
  add('sun visor',[7.77,3.72,0],[.3,.09,2.15],'cabAccent');
  add('front bumper',[8.02,1.14,0],[.25,.38,2.4],'cabAccent');
  add('lower air intake',[8.045,1.85,0],[.07,.55,1.78],'carrierGrille');
  for(let i=0;i<5;i++)add('intake slat',[8.09,1.65+i*.095,0],[.045,.025,1.62],'rim');
  for(const side of [-1,1]) {
    add('side glazing',[6.74,3.2,side*1.24],[1.95,1.04,.035],'glass',{
      profile:[[-.95,-.48],[.98,-.48],[.76,.48],[-.94,.48]],
    });
    add('door rear seam',[5.73,2.57,side*1.244],[.025,1.75,.025],'cabAccent');
    add('door lower seam',[6.6,2.02,side*1.244],[1.74,.025,.025],'cabAccent');
    add('door handle',[6.02,2.48,side*1.265],[.27,.07,.045],'cabAccent');
    add('mirror stay',[7.52,3.03,side*1.42],[.055,.055,.38],'chassis');
    add('mirror housing',[7.57,3.1,side*1.63],[.22,.5,.16],'cabAccent');
    add('mirror glass',[7.445,3.1,side*1.63],[.025,.4,.12],'rim');
    add('headlamp housing',[8.12,1.37,side*.92],[.055,.19,.47],'carrierGrille');
    add('headlamp strip',[8.153,1.4,side*.92],[.025,.055,.4],'lamp');
    add('indicator',[8.153,1.29,side*1.04],[.025,.035,.16],'reflector');
    for(let k=0;k<2;k++)add('cab step',[5.98,.72+k*.28,side*1.18],[.72,.07,.5-k*.12],'rim');
    add('battery enclosure',[5.65,1,side*.83],[1.25,.65,.48],'battery');
    for(let k=0;k<5;k++)add('battery cooling fin',[5.16+k*.24,1,side*1.085],[.025,.48,.035],'chassis');
    for(const x of [3.35,4.6]) {
      add('drive mudguard',[x,1.19,side*1.01],[1.16,.095,.66],'cabAccent');
      add('mudflap',[x-.58,.59,side*1.01],[.05,.59,.64],'tyre');
    }
    add('side underrun rail',[X,.84,side*1.12],[7.3,.16,.1],'rim');
    for(const x of [-5.5,-2.5,.5])add('underrun bracket',[x,1.05,side*1.08],[.08,.4,.1],'chassis');
    add('retracted landing leg',[1.4,.91,side*.82],[.14,.74,.14],'chassis');
    add('landing foot',[1.4,.5,side*.82],[.38,.12,.32],'rim');
  }
  add('trailer floor',[X,1.36,0],[L,.1,W],'interior');
  add('trailer far wall',[X,Y,-W/2],[L,H,.06],'reeferSkin');
  add('rear door left',[X-L/2,Y,-.615],[.08,H,1.2],'reeferSkin');
  add('rear door right',[X-L/2,Y,.615],[.08,H,1.2],'reeferSkin');
  if(!cutaway) {
    add('reefer near side',[X,Y,W/2],[L,H,.06],'reeferSkin',{role:'cutaway'});
    add('reefer roof',[X,Y+H/2,0],[L,.08,W],'reeferSkin',{role:'roof'});
  }
  for(const side of [-1,1]) {
    if(side===-1||!cutaway)for(let k=0;k<48;k++)add('corrugation',[X-L/2+.23+k*(L-.46)/47,Y,side*(W/2+.035)],[.046,H*.91,.04],'reeferRib',{role:side===1?'nearRibs':'farRibs'});
    for(const y of [Y-H/2+.03,Y+H/2-.03])add('container perimeter rail',[X,y,side*(W/2+.015)],[L,.1,.11],'rim');
    for(const x of [X-L/2+.055,X+L/2-.055]) {
      add('container corner post',[x,Y,side*(W/2+.015)],[.13,H,.12],'rim');
      for(const y of [Y-H/2+.1,Y+H/2-.1])add('corner casting',[x,y,side*W/2],[.23,.22,.23],'carrier');
    }
    for(let k=0;k<6;k++)add('side reflector',[X-5+k*2,1.53,side*1.29],[.25,.045,.025],'reflector');
  }
  const rear=X-L/2-.07;
  add('rear door seal',[rear,Y,0],[.025,H-.2,.045],'carrierGrille');
  for(const z of [-.92,-.34,.34,.92]) {
    add('door locking bar',[rear-.035,Y,z],[.04,H-.3,.04],'rim');
    add('door locking handle',[rear-.065,2.17,z+.08],[.05,.055,.23],'chassis');
  }
  for(const z of [-1.13,1.13])for(const y of [1.75,2.8,3.85])add('door hinge',[rear-.035,y,z],[.07,.13,.18],'rim');
  add('rear bumper',[rear,.6,0],[.18,.16,2.4],'rim');
  for(const z of [-.93,.93])add('rear lamp',[rear-.09,1.12,z],[.04,.14,.35],'tailLamp');
  add('refrigeration unit',[X+L/2+.22,Y,0],[.44,H-.12,W-.13],'carrier');
  add('refrigeration upper grille',[X+L/2+.46,3.35,0],[.05,.85,1.97],'carrierGrille');
  for(let i=0;i<9;i++)add('refrigeration louvre',[X+L/2+.495,3.02+i*.08,0],[.025,.025,1.88],'rim');
  add('refrigeration lower service panel',[X+L/2+.46,1.63,0],[.05,.32,1.97],'cabAccent');
  return a;
}

export function truckWheelLayout({dual=true}={}) {
  const wheels=[];
  for(const x of TRUCK.axles)for(const side of [-1,1]) {
    const offsets=dual&&x!==TRUCK.axles.at(-1)?[.83,1.15]:[1.02];
    for(const z of offsets)wheels.push({x,y:TRUCK.wheelY,z:side*z,side,radius:TRUCK.wheelRadius,width:.28});
  }
  return wheels;
}

export function truckProjection({cutaway=false,warmth=0}={}) {
  // The Canvas painter sorts individual faces by depth. Subdivide long thin
  // panels so an entire 12 m wall cannot incorrectly overpaint its own ribs.
  // This changes tessellation only, not the shared physical envelope.
  const parts=truckStructure({cutaway}).flatMap(p=>{
    if(p.profile||p.s[0]<=4||(p.s[1]>=.3&&p.s[2]>=.3))return [p];
    const n=Math.ceil(p.s[0]);return Array.from({length:n},(_,i)=>({...p,p:[p.p[0]-p.s[0]/2+(i+.5)*p.s[0]/n,p.p[1],p.p[2]],s:[p.s[0]/n,p.s[1],p.s[2]],outline:false}));
  });
  for(const w of truckWheelLayout({dual:false})) {
    parts.push({name:'tyre',p:[w.x,w.y,w.z],s:[w.radius*2,w.radius*2,.38],color:PALETTE.tyre,radial:16});
    parts.push({name:'wheel hub',p:[w.x,w.y,w.z+w.side*.2],s:[.61,.61,.025],color:PALETTE.rim,radial:12});
  }
  if(cutaway)for(let col=0;col<10;col++)for(const z of [-.55,.55]) {
    parts.push({name:'pallet',p:[-7.9+col*1.1,1.5,z],s:[1,.14,1],color:PALETTE.pallet});
    parts.push({name:'pallet cargo',p:[-7.9+col*1.1,2.28,z],s:[.95,1.4,.95],color:warmth>.65?'#cb785b':warmth>.3?'#ccaf6d':'#b9d0b2'});
  }
  return parts;
}

// Convex prism/cylinder topology for honest software geometry, not a bitmap substitute.
// The box API remains backward compatible for the harbor and existing tests.
export function partVertices(part) {
  let vs;
  if(part.profile||part.radial) {
    const ring=part.profile||Array.from({length:part.radial},(_,i)=>{const a=i*Math.PI*2/part.radial;return [Math.cos(a)*part.s[0]/2,Math.sin(a)*part.s[1]/2];});
    vs=[-1,1].flatMap(side=>ring.map(([x,y])=>[x,y,side*part.s[2]/2]));
  } else vs=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(v=>v.map((n,i)=>n*part.s[i]/2));
  return vs.map(v=>{
    if(part.r) {
      const [rx,ry,rz]=part.r;let [x,y,z]=v;
      [y,z]=[y*Math.cos(rx)-z*Math.sin(rx),y*Math.sin(rx)+z*Math.cos(rx)];
      [x,z]=[x*Math.cos(ry)+z*Math.sin(ry),-x*Math.sin(ry)+z*Math.cos(ry)];
      [x,y]=[x*Math.cos(rz)-y*Math.sin(rz),x*Math.sin(rz)+y*Math.cos(rz)];v=[x,y,z];
    }
    return v.map((n,i)=>n+part.p[i]);
  });
}
export function partFaces(part) {
  const n=part.profile?.length||part.radial;
  if(!n)return [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[0,3,7,4]];
  return [Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>2*n-1-i),...Array.from({length:n},(_,i)=>[i,i+n,(i+1)%n+n,(i+1)%n])];
}
