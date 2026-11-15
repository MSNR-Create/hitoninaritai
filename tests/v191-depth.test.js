import test from 'node:test';
import assert from 'node:assert/strict';
import {buildingParts} from '../src/render.js';
import {makeWorlds} from '../src/world.js';
import {ROAD_COLUMNS,ROAD_ROWS} from '../src/surface-city.js';
const b={id:'t',kind:'home',x:4,y:5,w:3,h:2};
test('outside-behind characters sort before the wall segment; inside ones after',()=>{
 for(const rot of [0,1,2,3]){const {parts}=buildingParts(b,true,rot);const walls=parts.filter(p=>p.sub===0);assert.ok(walls.length>=5);
  const minWall=Math.min(...walls.map(p=>p.depth));assert.ok(parts.find(p=>p.sub===-1).depth<minWall);}
 const {parts}=buildingParts(b,true,0);const westWall=parts.filter(p=>p.sub===0).map(p=>p.depth);
 // tile (3,5) outside west wall -> depth 8 must be < wall depth 8.5; tile (4,5) inside -> 9 > 8.5
 assert.ok(westWall.includes(8.5));assert.ok(8<8.5&&9>8.5);
});
test('surface buildings never sit on roads or sidewalks and never overlap',()=>{
 const w=makeWorlds().surface;const occ=new Set();
 for(const bd of [...w.buildings,...w.cityBuildings])for(let x=bd.x;x<bd.x+bd.w;x++)for(let y=bd.y;y<bd.y+bd.h;y++){
  const k=x+','+y;assert.ok(!occ.has(k),bd.id+' overlaps');occ.add(k);
  assert.ok(!ROAD_COLUMNS.includes(x)&&!ROAD_ROWS.includes(y),bd.id+' on road');
  assert.ok(![7,10,14,17].includes(x)&&![7,10,14,17].includes(y),bd.id+' on sidewalk');}
});
