import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {harness} from './scene-harness.js';

const plain=value=>JSON.parse(JSON.stringify(value));
const result={valid:true,finalC:-19.09,peakC:-19.09,referenceC:-15,state:'within_reference',recoveryMinutes:0};
function project(m,[x,y,z]) {
    const w=m[3]*x+m[7]*y+m[11]*z+m[15];
    return {x:(1+(m[0]*x+m[4]*y+m[8]*z+m[12])/w)/2,y:(1-(m[1]*x+m[5]*y+m[9]*z+m[13])/w)/2};
}
function inRange(value,min,max,label){assert.ok(value>=min&&value<=max,`${label}: ${value} outside ${min}–${max}`);}
function hash(data){return createHash('sha256').update(Buffer.from(new Float32Array(data).buffer)).digest('hex');}

test('overview landmark positions and proportions follow the reference map, not one horizontal strip',()=>{
    const h=harness({reduced:true,width:1250,height:1024}),L=h.scene.OVERVIEW_LAYOUT,m=h.matrices.at(-1);
    assert.deepEqual(plain(L.terminal4.berths.map(b=>b.number)),[63,64,65,66]);
    assert.deepEqual(plain(L.terminal5.berths.map(b=>b.number)),[77,78,79,80,81]);
    const channel=L.channel.map(([x,z])=>project(m,[x,.28,z]));
    for(const p of channel)inRange(p.x,.23,.36,'channel near one-third width');
    assert.ok(channel.at(-1).y-channel[0].y>.90,'channel occupies full map height');
    const north=L.terminal4.berths.map(b=>project(m,[b.x,.55,b.z]));
    for(const p of north){inRange(p.x,.41,.70,'T4 horizontal berth x');inRange(p.y,.05,.20,'T4 near map top');}
    assert.ok(north.every((p,i)=>i===0||p.x>north[i-1].x));
    assert.equal(new Set(north.map(p=>p.y)).size,1,'T4 bays are side by side');
    const west=L.terminal5.berths.map(b=>project(m,[b.x,.45,b.z]));
    for(const p of west){inRange(p.x,.20,.30,'T5 left-middle x');inRange(p.y,.30,.65,'T5 stack y');}
    assert.equal(new Set(west.map(p=>p.x)).size,1,'T5 bays are stacked vertically');
    assert.ok(west.every((p,i)=>i===0||p.y>west[i-1].y));
    const active=L.terminal5.berths.find(b=>b.number===78);
    assert.ok(Math.abs(L.vessel.z-active.z)<1e-9,'ship remains adjacent active berth 78');assert.ok(Math.abs(L.crane.z-active.z)<1e-9);
    const ship=project(m,L.vessel.label);inRange(ship.x,.36,.46,'ship x');inRange(ship.y,.35,.45,'ship y');
    const shipWidth=project(m,[L.vessel.x+L.vessel.length/2+.1,.27,L.vessel.z]).x-project(m,[L.vessel.x-L.vessel.length/2,.27,L.vessel.z]).x;
    inRange(shipWidth,.175,.22,'visible vessel width');
    const hubA=project(m,[L.hub.x-L.hub.width/2,1.1,L.hub.z-L.hub.depth/2]);
    const hubB=project(m,[L.hub.x+L.hub.width/2,1.1,L.hub.z+L.hub.depth/2]);
    inRange(hubA.x,.68,.72,'hub left');inRange(hubA.y,.16,.22,'hub top');inRange(hubB.x,.93,.98,'hub right');inRange(hubB.y,.48,.54,'hub bottom');
    inRange(hubB.x-hubA.x,.24,.29,'hub width');inRange(hubB.y-hubA.y,.29,.34,'hub height');
    assert.equal(L.hub.bays.length,9);assert.equal(new Set(L.hub.bays.map(b=>b.x)).size,3);assert.equal(new Set(L.hub.bays.map(b=>b.z)).size,3);
    h.api.dispose();
});

test('all route progress, lanes and tangents keep the full truck envelope clear of physical buildings and berths',()=>{
    const h=harness({reduced:true}),api=h.scene,L=api.OVERVIEW_LAYOUT;
    const obstacles=[{...L.hub,width:L.hub.width+.18,depth:L.hub.depth+.18},...L.stacks,...L.terminal4.berths,...L.terminal5.berths];
    for(let routeId=0;routeId<L.routes.length;routeId++)for(let lane=0;lane<4;lane++)for(let sample=0;sample<=400;sample++) {
        const progress=sample/400,vehicle={routeId,lane,progress,moving:false,direction:1};
        const pose=api.getDemoFleetPose(vehicle,0),halfX=Math.abs(Math.cos(pose.heading))*.36+Math.abs(Math.sin(pose.heading))*.1725,halfZ=Math.abs(Math.sin(pose.heading))*.36+Math.abs(Math.cos(pose.heading))*.1725;
        for(const obstacle of obstacles) {
            const overlap=pose.x+halfX>obstacle.x-obstacle.width/2&&pose.x-halfX<obstacle.x+obstacle.width/2&&pose.z+halfZ>obstacle.z-obstacle.depth/2&&pose.z-halfZ<obstacle.z+obstacle.depth/2;
            assert.equal(overlap,false,`route ${routeId} lane ${lane} progress ${progress} crosses ${obstacle.number||'building'} at ${obstacle.x},${obstacle.z}`);
        }
        const center=api.getDemoRoutePosition(progress,lane,routeId);
        assert.deepEqual([pose.x,pose.y,pose.z],Array.from(center),'mesh/label position uses the same path as road/trail');
        assert.ok(Number.isFinite(pose.heading));
    }
    h.api.dispose();
});

test('16 visible truck meshes populate four separated routes with 12 moving and 4 docked slots',()=>{
    const h=harness({reduced:true,width:1250,height:1024}),fleet=h.scene.createDemoFleet(),m=h.matrices.at(-1);
    assert.equal(fleet.length,16);assert.equal(fleet.filter(v=>v.moving).length,12);
    assert.deepEqual(plain([0,1,2,3].map(route=>fleet.filter(v=>v.routeId===route).length)),[4,4,4,4]);
    for(const seconds of [0,3,20,60]) {
        const positions=fleet.map(v=>h.scene.getDemoFleetPose(v,seconds)),screen=positions.map(p=>project(m,[p.x,p.y,p.z]));
        assert.ok(Math.max(...screen.map(p=>p.y))-Math.min(...screen.map(p=>p.y))>.60,'fleet spans upper, middle and lower map regions');
        assert.ok(screen.some(p=>p.y<.35)&&screen.some(p=>p.y>.80),'fleet is present both above and below the central landmarks');
        for(const p of screen){inRange(p.x,.04,.96,'truck x visible');inRange(p.y,.04,.96,'truck y visible');}
        for(const [i,v] of fleet.entries()) {
            const start=h.scene.getDemoFleetPose(v,0);
            if(v.moving&&seconds>0)assert.notDeepEqual(positions[i],start);
            if(!v.moving)assert.deepEqual(positions[i],start);
        }
    }
    assert.equal(h.draws.at(-1).count,8808,'all 16 complete truck meshes and 12 fourteen-point trails are submitted');
    h.api.setView('cutaway');h.api.setView('overview');assert.equal(h.draws.at(-1).count,8808);
    h.api.dispose();
});

test('nine hub roofs and every berth are submitted as raised geometry, and overview triangles stay within a mobile budget',()=>{
    const h=harness({reduced:true}),L=h.scene.OVERVIEW_LAYOUT,vertices=h.draws.at(-4).data;
    const topVertices=(x,z,halfX,halfZ,minY)=>{
        let count=0;for(let i=0;i<vertices.length;i+=9)if(Math.abs(vertices[i]-x)<=halfX&&Math.abs(vertices[i+2]-z)<=halfZ&&vertices[i+1]>=minY&&vertices[i+4]>.9)count++;
        return count;
    };
    for(const bay of L.hub.bays)assert.ok(topVertices(bay.x,bay.z,bay.width/2+.05,bay.depth/2+.05,1.05)>=6,'each top-view bay has its own raised roof');
    for(const berth of [...L.terminal4.berths,...L.terminal5.berths])assert.ok(topVertices(berth.x,berth.z,berth.width/2+.01,berth.depth/2+.01,.31)>=6,`berth ${berth.number} has volume`);
    assert.ok(h.draws.slice(-4).reduce((sum,draw)=>sum+draw.count/3,0)<12000,'one scene stays under 12,000 submitted triangles');
    h.api.dispose();
});

test('overview motion changes independently while delay preserves fleet speed and Cutaway static mesh stays exact',()=>{
    const h=harness(),delay=harness();h.api.update({scenario:'normal',result});delay.api.update({scenario:'delay',result});
    h.step(2000);delay.step(2000);
    const staticNormal=hash(h.draws.at(-4).data),motionNormal=hash(h.draws.at(-2).data);
    const fleetPositions=h.draws.at(-1).data.filter((_,i)=>i%9<3);
    assert.deepEqual(delay.draws.at(-1).data.filter((_,i)=>i%9<3),fleetPositions,'delay does not freeze or slow the fleet');
    assert.notEqual(hash(delay.draws.at(-2).data),motionNormal,'six tunnel particles change speed/color in delay');
    assert.equal(hash(delay.draws.at(-4).data),staticNormal,'vessel and port buildings remain stationary');
    h.step(2400);assert.notEqual(hash(h.draws.at(-2).data),motionNormal,'crane/radar/tunnel cues keep moving');
    assert.equal(h.queue.size,1,'only one scene RAF remains active');
    h.api.setView('cutaway');
    assert.equal(h.draws.at(-4).count,7542);
    assert.equal(hash(h.draws.at(-4).data),'4ff554820beb4986b4db56307c25705c719974ca90c1ec5b2dd63a9664eb171a','published 5f72e27 Cutaway static mesh is unchanged');
    h.changeMotion(true);assert.equal(h.queue.size,0);const before=h.draws.length;
    h.api.update({scenario:'recovery',result:{...result,recoveryMinutes:14,shorePowerKwAssumption:10}});
    assert.equal(h.draws.length,before+4,'immediate reduced-motion model redraw remains intact');
    h.api.dispose();delay.api.dispose();
});

test('overview leaves readouts below the viewport and removes the duplicate obscuring canvas HUD only in 3D',()=>{
    const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
    assert.match(html,/#portSceneViewport\[data-view="overview"\] \.radar-hud-pill, #portSceneViewport\[data-view="cutaway"\] \.radar-hud-pill \{ display: none; \}/);
    assert.match(html,/id="hudPrechill"/);assert.match(html,/id="hudSafetyStatus"/);
    assert.match(html,/no live telemetry or dispatch connection/);
});
