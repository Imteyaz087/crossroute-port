import {partVertices} from './truck-design.js';
import {harborLayout,truckLayout} from './harbor-layout.js';
export const VIEWS = {
  port: { yaw: .67, pitch: .72, distance: 88, target: [0,2,-9] },
  vehicle: { yaw: .72, pitch: .29, distance: 24, target: [-.35,2,0] },
  thermal: { yaw: .18, pitch: .48, distance: 19, target: [-2,2,0] },
};
export const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
export function cameraPosition(view) {
  const {yaw,pitch,distance:d,target:t}=view;
  return [t[0]+Math.sin(yaw)*Math.cos(pitch)*d,t[1]+Math.sin(pitch)*d,t[2]+Math.cos(yaw)*Math.cos(pitch)*d];
}
export function project(point,view,w,h) {
  const c=cameraPosition(view), dx=point[0]-c[0],dy=point[1]-c[1],dz=point[2]-c[2];
  const sy=Math.sin(view.yaw),cy=Math.cos(view.yaw),sp=Math.sin(view.pitch),cp=Math.cos(view.pitch);
  const x=dx*cy-dz*sy, y=-dx*sy*sp+dy*cp-dz*cy*sp, depth=-dx*sy*cp-dy*sp-dz*cy*cp;
  const scale=h*1.18/Math.max(.1,depth);
  return {x:w/2+x*scale,y:h/2-y*scale,depth,visible:depth>.1};
}
export const BOX_FACES=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[0,3,7,4]];
export const boxVertices=partVertices;
export function shade(hex,factor) {
  return '#'+hex.slice(1).match(/../g).map(v=>Math.round(clamp(parseInt(v,16)*factor,0,255)).toString(16).padStart(2,'0')).join('');
}
export function sceneQuality(width,dpr=1,reduced=false) {
  return {pixelRatio:Math.min(dpr,width<700?1.25:1.75),shadows:width>=700, fps:reduced?12:width<700?30:60};
}

// Fit the same scene envelope for both renderers; reserve room for readable captions.
export function fitView(mode,width,height) {
  const v={...VIEWS[mode],target:[...VIEWS[mode].target]};
  const points=(mode==='port'?harborLayout():truckLayout({cutaway:mode==='thermal'})).flatMap(boxVertices);
  for(let i=0;i<45;i++){
    if(points.every(p=>{const q=project(p,v,width,height);return q.visible&&q.x>width*.06&&q.x<width*.94&&q.y>height*.16&&q.y<height*.9;}))break;
    v.distance*=1.055;
  }
  return v;
}

// Both input paths use bounds relative to the current viewport's fitted scene,
// never a fixed world-distance ceiling that can sit inside a portrait fit.
export function zoomBounds(fittedDistance) {
  if (!Number.isFinite(fittedDistance) || fittedDistance <= 0) throw new RangeError('Invalid fitted distance');
  return {min: fittedDistance * .35, max: fittedDistance * 2.5};
}
export function zoomDistance(distance, factor, bounds) {
  if (!Number.isFinite(factor) || factor <= 0) return distance;
  const next = clamp(distance * factor, bounds.min, bounds.max);
  // Preserve direction even if a caller holds a stale out-of-range distance.
  return factor >= 1 ? Math.max(distance, next) : Math.min(distance, next);
}

// Three r169 otherwise only logs a failed program link. Throw synchronously so
// startup or the guarded draw demotes the optional GPU renderer instead of
// announcing a ready canvas after a logged shader failure.
export function configureShaderErrorBoundary(renderer) {
  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = () => { throw new Error('CrossRoute GPU shader compilation/linking failed'); };
}
