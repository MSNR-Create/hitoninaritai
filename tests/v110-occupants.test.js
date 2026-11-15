import test from 'node:test';
import assert from 'node:assert/strict';
import {occupantsFor,surfaceOccupants,walkLoop} from '../src/occupants.js';
import {makeWorlds} from '../src/world.js';
test('every surface occupant stays inside its own building footprint',()=>{
 const w=makeWorlds().surface;const all=[...w.buildings,...w.cityBuildings];
 for(let t=0;t<60;t+=0.37)for(const night of [false,true])for(const b of all)for(const o of occupantsFor(b,t,{night,humans:90})){
  assert.ok(o.x>=b.x-.5&&o.x<=b.x+b.w-.5&&o.y>=b.y-.5&&o.y<=b.y+b.h-.5,`${b.id} ${o.x},${o.y}`);}
});
test('role behaviour: shops have a clerk, clinics have patients in bed, deterministic',()=>{
 const w=makeWorlds().surface;const market=w.buildings.find(b=>b.kind==='market');
 assert.ok(occupantsFor(market,3).length>=2);
 const clinic=w.buildings.find(b=>b.kind==='clinic');assert.ok(occupantsFor(clinic,1).some(o=>o.activity==='sleep'));
 assert.deepEqual(surfaceOccupants(w,12.3,{}),surfaceOccupants(w,12.3,{}));
});
test('walkLoop dwells then moves',()=>{const a=walkLoop([[0,0],[2,0]],0.1,{dwell:1});assert.equal(a.moving,false);const b=walkLoop([[0,0],[2,0]],1.5,{dwell:1});assert.equal(b.moving,true);});
test('initial underground facilities sit beside corridors, never on them',()=>{
 const w=makeWorlds().underground;
 for(const b of w.buildings)for(let x=b.x;x<b.x+b.w;x++)for(let y=b.y;y<b.y+b.h;y++)assert.ok(!w.paths.has(x+','+y),b.id);
 assert.ok(['10,8','11,8'].every(k=>w.paths.has(k)),'corridor row y=8 is continuous');
});
