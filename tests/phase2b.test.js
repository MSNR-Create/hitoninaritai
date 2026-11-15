import test from 'node:test';import assert from 'node:assert/strict';
import { makeWorlds } from '../src/world.js';
import { planCorridor,applyCorridor,buildingPreview } from '../src/planning.js';
import { initialResale,buyItem,sellItem,marketIndex } from '../src/resale.js';
import { rentProperty,chargeRent } from '../src/rentals.js';
test('two-tap corridor plans a route, pays exactly once and does not overwrite buildings',()=>{
 const world=makeWorlds().underground;const start={x:8,y:9},end={x:9,y:9};const p=planCorridor(world,start,end,300);assert.equal(p.ok,true);assert.equal(p.cost,5);
 const r=applyCorridor(world,p,300);assert.equal(r.ok,true);assert.equal(r.money,295);assert(r.world.paths.has('9,9'));assert.equal(world.paths.has('9,9'),false);
 assert.equal(planCorridor(r.world,start,end,295).cost,0);
});
test('corridor rejects building footprints and insufficient funds',()=>{
 const world=makeWorlds().underground;assert.equal(planCorridor(world,{x:8,y:9},{x:4,y:5},300).ok,false);
 assert.equal(planCorridor(world,{x:8,y:9},{x:9,y:9},0).ok,false);
});
test('building preview reports exact footprint and collision',()=>{
 const world=makeWorlds().underground;let p=buildingPreview(world,'home',4,5,300);assert.deepEqual([p.w,p.h],[3,2]);assert.equal(p.ok,false);
 p=buildingPreview(world,'shop',10,8,300);assert.deepEqual([p.w,p.h],[2,3]);assert.equal(p.ok,false);
});
test('resale costs, platform fee, packing cost and rating are calculated',()=>{
 const bought=buyItem(initialResale(),200,'book');assert.equal(bought.ok,true);assert.equal(bought.money,182);
 const sold=sellItem(bought.resale,bought.money,0,'standard',1);assert.equal(sold.ok,true);assert.equal(sold.profit,sold.price-sold.fee-sold.packingCost-18);
 assert.equal(sold.money,182+sold.price-sold.fee-sold.packingCost);assert.equal(sold.resale.inventory.length,0);
 assert.equal(buyItem(initialResale(),200,'console').ok,false);
});
test('market pricing is deterministic and changes with day',()=>{
 assert.equal(marketIndex(3),marketIndex(3));assert.notEqual(marketIndex(3),marketIndex(4));
});
test('rentals have upfront cost and a repeat daily charge',()=>{
 const lease=rentProperty([],300,'apartment');assert.equal(lease.money,210);
 assert.equal(chargeRent(lease.rented,210).money,198);
 assert.equal(rentProperty(lease.rented,210,'apartment').ok,false);
});
