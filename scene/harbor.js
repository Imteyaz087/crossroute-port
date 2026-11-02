import * as THREE from 'three';
import {harborLayout, ROUTE, ZONES} from './harbor-layout.js';
export function buildHarbor() {
  const root=new THREE.Group();root.name='Illustrative terminal, not a geographic survey';
  const groups=new Map();for(const b of harborLayout()){if(b.water)continue;if(!groups.has(b.color))groups.set(b.color,[]);groups.get(b.color).push(b);}
  const geometry=new THREE.BoxGeometry(1,1,1), transform=new THREE.Object3D();
  for(const [color,boxes] of groups){
    const material=new THREE.MeshStandardMaterial({color,roughness:.76,metalness:.13});
    const mesh=new THREE.InstancedMesh(geometry,material,boxes.length);
    boxes.forEach((b,i)=>{transform.position.set(...b.p);transform.scale.set(...b.s);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);});
    mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  }
  const routeGeo=new THREE.BufferGeometry().setFromPoints(ROUTE.map(p=>new THREE.Vector3(...p)));
  const route=new THREE.Line(routeGeo,new THREE.LineDashedMaterial({color:0xe4c885,dashSize:1,gapSize:.6}));route.computeLineDistances();root.add(route);
  const anchors={},pickTargets=[];
  for(const zone of ZONES){
    const a=new THREE.Object3D();a.position.set(...zone.position);root.add(a);anchors[zone.id]=a;
    const labelCanvas=document.createElement('canvas');labelCanvas.width=labelCanvas.height=96;const g=labelCanvas.getContext('2d');
    g.fillStyle='#e7d5a4';g.beginPath();g.arc(48,48,42,0,Math.PI*2);g.fill();g.fillStyle='#263024';g.font='500 34px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(zone.name.slice(0,2),48,49);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(labelCanvas),depthTest:false}));sprite.position.copy(a.position);sprite.scale.set(2.8,2.8,1);sprite.userData.zoneId=zone.id;root.add(sprite);pickTargets.push(sprite);
  }
  // Low-cost corrugation lines: a single draw call across stacked containers.
  const ribs=[];for(const b of harborLayout().filter(b=>b.name.includes('container'))){for(let x=-b.s[0]/2+.2;x<b.s[0]/2;x+=.4){for(const side of [-1,1])ribs.push(b.p[0]+x,b.p[1]-b.s[1]/2+.06,b.p[2]+side*(b.s[2]/2+.01),b.p[0]+x,b.p[1]+b.s[1]/2-.06,b.p[2]+side*(b.s[2]/2+.01));}}
  const ribGeo=new THREE.BufferGeometry();ribGeo.setAttribute('position',new THREE.Float32BufferAttribute(ribs,3));root.add(new THREE.LineSegments(ribGeo,new THREE.LineBasicMaterial({color:0x4a5045,transparent:true,opacity:.28})));
  // Cable stays make the crane silhouette read as machinery, not a set of boxes.
  for(const x of [-17,15])for(const end of [[x,16,-44],[x,16,-12]]){
    const a=new THREE.Vector3(x,22,-18),b=new THREE.Vector3(...end),d=b.clone().sub(a);
    const stay=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,d.length(),6),new THREE.MeshStandardMaterial({color:0xb5b095,metalness:.6,roughness:.4}));stay.position.copy(a).add(b).multiplyScalar(.5);stay.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());root.add(stay);
  }
  const waterGeo=new THREE.PlaneGeometry(95,28,36,18);waterGeo.rotateX(-Math.PI/2);
  const water=new THREE.Mesh(waterGeo,new THREE.MeshStandardMaterial({color:0x3e4945,roughness:.3,metalness:.65}));water.position.set(0,-.75,-39);root.add(water);
  const waterPos=waterGeo.attributes.position;
  // A subtle pulsing route beacon is decorative; it is not a live vehicle track.
  const beacon=new THREE.Mesh(new THREE.SphereGeometry(.25,12,8),new THREE.MeshBasicMaterial({color:0xffe6a9}));root.add(beacon);
  return {root,anchors,pickTargets,update(t,reduced){beacon.visible=!reduced;const p=(t*.035)%1;beacon.position.set(-32+p*53,.38,0);if(!reduced){for(let i=0;i<waterPos.count;i++)waterPos.setY(i,Math.sin(waterPos.getX(i)*.28+t*.5)*Math.cos(waterPos.getZ(i)*.38+t*.3)*.1);waterPos.needsUpdate=true;}}};
}
