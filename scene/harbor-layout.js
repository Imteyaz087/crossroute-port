// Original, procedural demo geometry. Not a survey or a model of an actual terminal.
export const ZONES = [
  { id: 'quay', name: '01 · Quayside transfer', position: [-17, 3, -18], detail: 'A simulated crane hand-off: compare a disconnected reefer with powered recovery.' },
  { id: 'vehicle', name: '02 · Cold-chain vehicle', position: [0, 4.8, 0], detail: 'Inspect the existing electric tractor, battery, refrigeration unit and 20-pallet cargo bay.' },
  { id: 'gate', name: '03 · Gate queue', position: [24, 3, 10], detail: 'Illustrative queue and battery-load scenario. No terminal dispatch connection.' },
  { id: 'shore', name: '04 · Shore-power bay', position: [10, 3, 15], detail: '10 kW cooling-capacity assumption. This is not an electrical installation specification.' },
];
export const ROUTE = [[-32, .06, 0], [21, .06, 0], [21, .06, 14], [5, .06, 14]];
export function harborLayout() {
  const boxes = [];
  const add = (name, p, s, color, extra = {}) => boxes.push({name, p, s, color, ...extra});
  add('terminal island', [0,-.55,-1], [78,1,48], '#45433e');
  add('quay edge', [0,0,-25], [78,.35,1], '#c7b991');
  add('harbor water', [0,-.8,-39], [95,.2,28], '#343b3b', {water:true});
  add('main road', [0,.015,0], [76,.04,8], '#292c2a');
  add('gate approach', [22,.02,7], [8,.05,21], '#292c2a');
  add('service lane', [9,.02,14], [30,.05,8], '#292c2a');
  for(let x=-35; x<36; x+=5) add('lane marking', [x,.07,0], [2.4,.025,.1], '#cec7af');
  for(let x=-34; x<36; x+=4) {
    add('quay safety stripe', [x,.22,-24.4], [1.5,.035,.3], '#d1b577');
    add('mooring bollard',[x,.48,-23.2],[.35,.8,.35],'#2a2d2c');
  }
  // A legible container ship silhouette, deliberately schematic rather than branded.
  add('ship hull', [-2,-.05,-37], [59,2,10], '#222927');
  add('ship deck', [-2,1.05,-37], [56,.35,9], '#aaa89b');
  add('bow', [29,-.2,-37], [3,1.6,7], '#222927');
  add('bridge', [-24,3.2,-37], [5,4,6], '#ddd9cb');
  add('bridge glazing', [-23.95,4.45,-33.94], [4.7,.7,.08], '#4f625d');
  add('mast',[-25,7,-37],[.22,4,.22],'#d4cbb7');
  for(let x=-17;x<=23;x+=6.5)for(let z=-39.7;z<=-34;z+=2.8)for(let y=0;y<2;y++)
    add('vessel container',[x,2.15+y*1.65,z],[5.9,1.6,2.5], ['#b6b4a5','#806d51','#71827a'][(Math.round(x+17)+y)%3]);
  // STS cranes: columns, portals, long outreach and hanging spreader.
  for(const x of [-17,15]) {
    for(const dx of [-3,3])for(const z of [-22,-14]) {
      add('crane column',[x+dx,8.5,z],[.65,17,.65],'#c4a66c');
      add('crane foot',[x+dx,.8,z],[1.8,1,3],'#565650');
    }
    add('crane crossbeam',[x,17,-18],[7.5,1,1.2],'#d0b377');
    add('crane outreach',[x,16,-29],[1.5,1.2,32],'#d0b377');
    add('crane top',[x,19,-18],[.65,6,.65],'#c4a66c');
    for(const dx of [-.6,.6]) add('hoist cable',[x+dx,10.5,-30],[.045,10,.045],'#bdbba8');
    add('spreader',[x,5.6,-30],[6.2,.35,2.5],'#d8bd80');
  }
  // Stacked yard containers: shared geometry is instanced in the WebGL renderer.
  for(let row=0;row<3;row++)for(let col=0;col<4;col++)for(let level=0;level<2;level++) {
    const colors=['#8e9b8d','#b1aa94','#a48b65','#777b70'];
    add('yard container',[-31+col*6.4,1.3+level*2.6,8+row*3.1],[6.05,2.5,2.55],colors[(row+col)%4]);
  }
  add('cold hub',[-24,3.6,21],[23,7,7],'#b6b5a9');
  add('hub roof',[-24,7.25,21],[24,.35,8],'#5d655f');
  for(let x=-31;x<=-17;x+=4.5)add('loading door',[x,2.2,17.44],[3,4,.07],'#56635e');
  for(let x=4;x<=13;x+=4.5) {
    add('shore bay',[x,.08,14],[3.7,.07,6.4],'#657269');
    add('power pedestal',[x,.9,18],[.7,1.8,.7],'#d8d7c9');
    add('power light',[x,1.4,17.62],[.4,.22,.06],'#a6d0ab');
  }
  add('gate gantry',[24,5,10],[12,.7,.6],'#bdb8a6');
  for(const x of [18.3,29.7])add('gate post',[x,2.5,10],[.55,5,.55],'#a9aa9d');
  add('gate kiosk',[31,1.4,12],[3,2.8,3],'#babdb0');
  for(const x of [-36,0,33]) {
    add('light mast',[x,5,20],[.2,10,.2],'#b5b6aa');
    add('luminaire',[x,10,20],[2,.2,.5],'#e3d9b4');
  }
  return boxes;
}
export {truckProjection as truckLayout} from './truck-design.js';
