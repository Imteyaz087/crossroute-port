import * as THREE from 'three';
import { M } from './materials.js';
import { TRUCK, truckStructure } from './truck-design.js';
import { meshFactory } from './truck-mesh.js';
import { reeferDecalTexture } from './port-facilities.js';

export const SPEC = {
  truck: 'Illustrative electric drayage tractor — not manufacturer CAD',
  batteryKWh: 350,
  reefer: '40ft High-Cube Reefer (schematic)',
  unit: 'Illustrative refrigeration unit',
  setpoint: -18.5,
  telematics: 'Illustrative CAN-bus node',
  seal: 'Illustrative RFID E-Seal',
};

export function buildTwin() {
  const root=new THREE.Group();root.name='twin';
  const anchors={},fx={},f=meshFactory(M),rbox=f.rounded;
  const {length:L,height:H,width:W,x:X,y:Y}=TRUCK.trailer;
  const parts=truckStructure();
  // Keep the same public fx contract used by the existing thermal/scenario binding.
  for(const [role,name]of [['cab','cab'],['cutaway','cutaway'],['roof','roof']]) {
    const p=parts.find(p=>p.role===role);const mat=M[p.material].clone();
    if(role!=='roof')mat.transparent=true;
    fx[name]=f.part(p,mat);root.add(fx[name]);
  }
  fx.nearRibs=new THREE.Group();root.add(fx.nearRibs);
  f.batch(fx.nearRibs,parts.filter(p=>p.role==='nearRibs'));
  // Livery decals ride outside the ribs; the near one hides with the cutaway ribs.
  const decalMat=new THREE.MeshStandardMaterial({map:reeferDecalTexture(),transparent:true,depthWrite:false,roughness:.5,metalness:.1});
  for(const side of [-1,1]){const d=new THREE.Mesh(new THREE.PlaneGeometry(L-.7,(L-.7)*480/2048),decalMat);d.position.set(X,Y+.1,side*(W/2+.065));if(side<0)d.rotation.y=Math.PI;(side>0?fx.nearRibs:root).add(d);}
  f.batch(root,parts.filter(p=>!['cab','cutaway','roof','nearRibs'].includes(p.role)));
  // Cutaway's y is animated relative to the container, not world zero.
  const cutawayPivot=new THREE.Group();cutawayPivot.position.y=Y;root.add(cutawayPivot);
  cutawayPivot.add(fx.cutaway);fx.cutaway.position.y=0;

  // Low-segment shared tyre/rim geometry; dual tyres on the four non-steering axles.
  const tyreGeo=f.geometry('tyre',()=>new THREE.TorusGeometry(.39,.16,10,28));
  const rimGeo=f.geometry('rim',()=>new THREE.CylinderGeometry(.3,.3,.15,20));
  rimGeo.rotateX(Math.PI/2);
  const hubGeo=f.geometry('hub',()=>new THREE.CylinderGeometry(.12,.12,.08,12));
  hubGeo.rotateX(Math.PI/2);
  fx.wheels=[];
  for(const x of TRUCK.axles)for(const side of [-1,1]) {
    const group=new THREE.Group();group.position.set(x,TRUCK.wheelY,side*1.03);
    const dual=x!==TRUCK.axles.at(-1);
    for(const z of dual?[-.16,.16]:[0]) {
      const tyre=new THREE.Mesh(tyreGeo,M.tyre);tyre.position.z=z;tyre.castShadow=true;group.add(tyre);
    }
    const rim=new THREE.Mesh(rimGeo,M.rim);rim.position.z=side*(dual?.29:.14);rim.castShadow=true;group.add(rim);
    const hub=new THREE.Mesh(hubGeo,M.chassis);hub.position.z=side*(dual?.39:.24);group.add(hub);
    // Five dark recesses produce readable rotation without dense tread meshes.
    const bolts=new THREE.InstancedMesh(hubGeo,M.chassis,5),o=new THREE.Object3D();
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;o.position.set(Math.cos(a)*.21,Math.sin(a)*.21,side*(dual?.38:.23));o.scale.set(.3,.3,.25);o.updateMatrix();bolts.setMatrixAt(i,o.matrix);}
    group.add(bolts);root.add(group);fx.wheels.push(group);
  }
  const fifth=new THREE.Mesh(f.geometry('fifth',()=>new THREE.CylinderGeometry(.55,.55,.12,24)),M.chassis);
  fifth.position.set(3.1,1.22,0);root.add(fifth);
  const inverter=rbox(.9,.55,.8,.04,M.battery);inverter.position.set(6.7,1.65,0);root.add(inverter);
  const motor=new THREE.Mesh(f.geometry('motor',()=>new THREE.CylinderGeometry(.32,.32,.8,20)),M.rim);
  motor.rotation.z=Math.PI/2;motor.position.set(6.1,.72,0);root.add(motor);
  anchors.battery=marker(root,5.65,1.6,1.15);

  // Original 20-pallet layout and live visual materials, unchanged thermal inputs.
  const box=new THREE.Group();box.position.set(X,Y,0);root.add(box);
  const liner=new THREE.Mesh(f.geometry('liner',()=>new THREE.BoxGeometry(L-.3,H-.25,W-.25)),M.interior.clone());
  liner.material.side=THREE.BackSide;box.add(liner);
  fx.palletLoads=[];
  const pallets=[];
  for(let col=0;col<10;col++)for(const z of [-.55,.55]) {
    const x=-5.2+col*1.1;
    pallets.push({name:'pallet',p:[x,-H/2+.15,z],s:[1,.14,1],material:'pallet'});
    const mat=M.cargo.clone(),load=rbox(.95,1.4,.95,.025,mat);
    load.position.set(x,-H/2+.93,z);box.add(load);
    fx.palletLoads.push({mesh:load,material:mat,col,zPos:z,xPos:x});
  }
  f.batch(box,pallets);anchors.core=marker(box,.6,.4,.3);
  fx.airTint=new THREE.Mesh(f.geometry('air',()=>new THREE.BoxGeometry(L-.4,H-.4,W-.4)),new THREE.MeshBasicMaterial({color:0xece9e4,transparent:true,opacity:.06,depthWrite:false}));box.add(fx.airTint);
  // Stable initial particles make source/model comparisons reproducible; dynamics stay the same.
  let seed=73;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const pos=new Float32Array(90*3),vel=[];
  for(let k=0;k<90;k++) {
    pos[k*3]=-L/2+random()*2;pos[k*3+1]=-H/2+random()*H*.7;pos[k*3+2]=(random()-.5)*W*.7;
    vel.push({x0:-L/2+random()*1.5,y0:-H/2+random()*H*.7,z0:(random()-.5)*W*.7,vx:-(.25+random()*.5),vy:-(.08+random()*.22),vz:(random()-.5)*.3,life:random()});
  }
  const frostGeo=new THREE.BufferGeometry();frostGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  fx.frost=new THREE.Points(frostGeo,new THREE.PointsMaterial({color:0xece9e4,size:.16,transparent:true,opacity:0,depthWrite:false}));fx.frostVel=vel;box.add(fx.frost);

  const fanX=X+L/2+.5;
  const fanWell=new THREE.Mesh(f.geometry('fanWell',()=>new THREE.CylinderGeometry(.48,.48,.035,28)),M.carrierGrille);fanWell.rotation.z=Math.PI/2;fanWell.position.set(fanX,2.25,0);root.add(fanWell);
  const ring=new THREE.Mesh(f.geometry('fanRing',()=>new THREE.TorusGeometry(.46,.025,6,28)),M.rim);ring.rotation.y=Math.PI/2;ring.position.set(fanX+.04,2.25,0);root.add(ring);
  fx.fan=new THREE.Group();fx.fan.position.set(fanX+.035,2.25,0);root.add(fx.fan);
  for(let k=0;k<5;k++){const blade=rbox(.035,.35,.12,.015,M.rim);const angle=k*Math.PI*2/5;blade.position.set(0,Math.cos(angle)*.23,Math.sin(angle)*.23);blade.rotation.x=angle;fx.fan.add(blade);}
  anchors.carrier=marker(root,fanX+.1,3.7,0);

  fx.seal=rbox(.06,.18,.1,.02,M.ledOk);fx.seal.position.set(-L/2-.12,-.3,.35);box.add(fx.seal);
  anchors.seal=marker(box,-L/2-.15,-.3,.35);
  const node=rbox(.22,.4,.6,.04,M.node);node.position.set(5.5,2.2,.9);root.add(node);
  fx.nodeLed=rbox(.02,.05,.05,.01,M.ledOk.clone());fx.nodeLed.position.set(-.12,.12,.2);node.add(fx.nodeLed);anchors.canbus=marker(root,5.4,2.5,.9);
  fx.shoreCable=buildCable(new THREE.Vector3(X+L/2,.25,-W/2-.05),new THREE.Vector3(5,0,-4));fx.shoreCable.visible=false;root.add(fx.shoreCable);
  fx.gate=buildGate();fx.gate.position.set(12.8,0,0);fx.gate.visible=false;root.add(fx.gate);
  return {root,anchors,fx,dims:{L,H,W}};
}
function marker(parent, x, y, z) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

function buildCable(a, b) {
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= 0.4;
  const curve = new THREE.CatmullRomCurve3([a, mid, b]);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.05, 8), M.cable);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), M.carrier);
  post.position.copy(b).setY(0.8);
  m.add(post);
  return m;
}

function buildGate() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.4), M.cabAccent);
  post.position.set(0, 0.7, 2.2);
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 4.2),
    new THREE.MeshStandardMaterial({ color: 0xf5b84b, roughness: 0.4 })
  );
  arm.position.set(0, 1.3, 0);
  g.add(post, arm);
  g.userData.arm = arm;
  return g;
}
