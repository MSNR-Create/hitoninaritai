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
test('room interiors render after ground in a dedicated pass',()=>{
 const draws=[];
 const ctx=new Proxy({fillStyle:'#000',strokeStyle:'#000',createLinearGradient:()=>({addColorStop(){}}),fill(){draws.push(this.fillStyle)},measureText:()=>({width:0})},{get(o,k){if(k in o)return o[k];return ()=>{};}});
 drawScene(ctx,makeWorlds().surface,{cx:450,cy:300,panX:0,panY:0,zoom:1,rotation:0},null,0,{width:900,height:600},null);
 const lastGround=Math.max(...draws.flatMap((c,i)=>['#79c35f','#82ca66','#8e9298','#e2d3b0','#9bd27a'].includes(c)?[i]:[]));
 const roomFloor=draws.findIndex(c=>['#f1d6b2','#f3dcb2','#d8d0c0','#f4f4ee','#ecc896'].includes(c));
 assert.ok(lastGround>=0 && roomFloor>lastGround,`room floor must render above ground: ${lastGround}, ${roomFloor}`);
});
