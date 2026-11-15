import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorlds} from '../src/world.js';
import {connectedFacilities,canUnlock,canBuild,applyConstruction,zoneAt} from '../src/construction.js';
const fresh=()=>makeWorlds().underground;
test('initial structures are connected to the exit through 4-neighbor corridors',()=>{
 const c=connectedFacilities(fresh());assert.equal(c.exit,true);assert.equal(c.home,true);assert.equal(c.shop,true);
});
test('closed zones require funds and adjacency and unlock exactly their tiles',()=>{
 let w=fresh();assert.equal(canUnlock(w,'northwest',74).ok,false);
 assert.equal(canUnlock(w,'northwest',75).ok,true);
 const result=applyConstruction(w,{type:'unlock',zoneId:'northwest'},300);
 assert.equal(result.money,225);assert.equal(result.world.closed.has('0,0'),false);assert.equal(w.closed.has('0,0'),true);
 assert.equal(result.world.closed.has('11,1'),true);
 assert.equal(zoneAt(result.world,1,1).open,true);
 assert.equal(canUnlock(result.world,'northwest',999).ok,false);
});
test('overlapping, closed or disconnected placements are refused without money changes',()=>{
 const w=fresh();for(const [kind,x,y] of [['home',4,5],['shop',0,0],['path',15,0],['home',15,14]]){
  const result=applyConstruction(w,{type:'build',kind,x,y},300);
  assert.equal(result.ok,false);assert.equal(result.money,300);assert.equal(result.world,w);
 }
});
test('corridors cost money once and cannot be placed twice',()=>{
 const w=fresh(),first=applyConstruction(w,{type:'build',kind:'path',x:6,y:8},100);
 // x6,y8 already part of starting corridor, reject.
 assert.equal(first.ok,false);
 const built=applyConstruction(w,{type:'build',kind:'path',x:6,y:7},100);
 assert.equal(built.ok,true);assert.equal(built.money,95);
 const again=applyConstruction(built.world,{type:'build',kind:'path',x:6,y:7},95);
 assert.equal(again.ok,false);assert.equal(again.money,95);
});
test('isolated corridor segment marks facility unavailable; restoring link restores facility',()=>{
 const w=fresh();w.paths.delete('8,4');
 assert.equal(connectedFacilities(w).home,false);assert.equal(connectedFacilities(w).shop,false);
 const rebuilt=applyConstruction(w,{type:'build',kind:'path',x:8,y:4},100);
 assert.equal(rebuilt.ok,true);assert.equal(rebuilt.world.connectivity.home,true);
});
test('new buildings need an open unobstructed  footprint adjoining a corridor',()=>{
 let w=fresh();assert.equal(canBuild(w,'home',9,6,300).ok,true);
 const built=applyConstruction(w,{type:'build',kind:'home',x:9,y:6},300);
 assert.equal(built.ok,true);assert.equal(built.money,200);
 assert.equal(built.world.buildings.length,4);assert.equal(Object.values(built.world.connectivity).every(Boolean),true);
 assert.equal(canBuild(built.world,'home',9,6,300).ok,false);
});
