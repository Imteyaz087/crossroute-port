import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Per-twin cache: repeat geometry is shared, but no disposed global geometry can
// leak into a later renderer. Fine static hardware is instanced by material/role.
export function meshFactory(materials) {
  const cache=new Map(),unitBox=new THREE.BoxGeometry(1,1,1);
  function geometry(key,create){if(!cache.has(key))cache.set(key,create());return cache.get(key);}
  function rounded(w,h,d,r,material) {
    const key=`rounded:${w}:${h}:${d}:${r}`;
    const mesh=new THREE.Mesh(geometry(key,()=>new RoundedBoxGeometry(w,h,d,2,r)),material);
    mesh.castShadow=mesh.receiveShadow=true;return mesh;
  }
  function part(p,material=materials[p.material]) {
    let g;
    if(p.profile) {
      const bevel=p.role==='cab';
      const key=JSON.stringify([p.profile,p.s[2],bevel]);
      g=geometry(key,()=>{
        const shape=new THREE.Shape();p.profile.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
        const depth=p.s[2]-(bevel?.08:0);
        const geo=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:bevel,bevelSize:.025,bevelThickness:.04,bevelSegments:2});geo.translate(0,0,-depth/2);return geo;
      });
    } else g=geometry(`box:${p.s.join(':')}`,()=>new THREE.BoxGeometry(...p.s));
    const mesh=new THREE.Mesh(g,material);mesh.name=p.name;mesh.position.set(...p.p);if(p.r)mesh.rotation.set(...p.r);mesh.castShadow=mesh.receiveShadow=true;return mesh;
  }
  function batch(parent,parts) {
    const groups=new Map();
    for(const p of parts) {
      if(p.profile){parent.add(part(p));continue;}
      const key=p.material;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);
    }
    for(const [material,items]of groups) {
      const mesh=new THREE.InstancedMesh(unitBox,materials[material],items.length),o=new THREE.Object3D();
      mesh.name=`hardware:${material}`;
      items.forEach((p,i)=>{o.position.set(...p.p);o.scale.set(...p.s);o.rotation.set(...(p.r||[0,0,0]));o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});
      mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);
    }
  }
  return {geometry,rounded,part,batch};
}
