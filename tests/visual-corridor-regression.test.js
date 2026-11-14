import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorlds} from '../src/world.js';
import {planCorridor,applyCorridor} from '../src/planning.js';
import {drawScene} from '../src/render.js';

const underground=()=>makeWorlds().underground;
test('corridor can start on free land away from network, costs once',()=>{
 const world=underground();
 const plan=planCorridor(world,{x:20,y:10},{x:21,y:10},300);
 assert.equal(plan.ok,true,plan.reason);
 assert.equal(plan.cost,10);
 const result=applyCorridor(world,plan,300);
 assert.equal(result.ok,true);
 assert.deepEqual([result.world.paths.has('20,10'),result.world.paths.has('21,10')],[true,true]);
 assert.equal(result.money,290);
});
test('corridor rejects closed zones and building cells even after relaxed network rule',()=>{
 const world=underground();
 assert.equal(planCorridor(world,{x:1,y:1},{x:5,y:1},300).ok,false);
 assert.equal(planCorridor(world,{x:4,y:5},{x:8,y:8},300).ok,false);
});
test('initial corridor tiles never under building footprints',()=>{
 const world=underground();
 for(const b of world.buildings){for(let x=b.x;x<b.x+b.w;x++)for(let y=b.y;y<b.y+b.h;y++)assert.equal(world.paths.has(`${x},${y}`),false,`${b.name} overlaps ${x},${y}`);}
});
test('all ground tiles are rendered before any building roof or wall',()=>{
 const draws=[];
 const ctx=new Proxy({fillStyle:'#000',strokeStyle:'#000',createLinearGradient:()=>({addColorStop(){}}),fill(){draws.push(this.fillStyle)},measureText:()=>({width:0})}, {get(o,k){if(k in o)return o[k];return ()=>{};}});
 const world=makeWorlds().surface;
 const view={cx:450,cy:300,panX:0,panY:0,zoom:1};
 drawScene(ctx,world,view,null,0,{width:900,height:600},null);
 const floorColors=new Set(['#455b59','#4b635f','#283d42','#72847c','#60736e']);
 const wallColors=new Set(['#796b92','#6a587c','#9d665d','#80535a','#526b7d','#3e5667','#85a9a1','#648d8c','#a77652','#815c49']);
 const lastGround=Math.max(...draws.flatMap((c,i)=>floorColors.has(c)?[i]:[]));
 const firstWall=draws.findIndex(c=>wallColors.has(c));
 assert.ok(firstWall>lastGround,`ground painted after building: ${lastGround}, ${firstWall}`);
});
