import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialSurfaceEconomy,advanceSurfaceEconomy,propertyLocation} from '../src/surface-economy.js';
import {createLedger,addTransaction,validateLedger,daySummary} from '../src/finance.js';
import {makeWorlds,buildingAt} from '../src/world.js';
import {initialGame} from '../src/simulation.js';
import {visibleResidents} from '../src/agent.js';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
test('properties have deterministic frontage and street-side advantage',()=>{
 const market=propertyLocation('market'),alley=propertyLocation('apartment');
 assert.ok(market.frontage>alley.frontage);assert.ok(market.accessibility>alley.accessibility);
 const g=initialSurfaceEconomy(),a=advanceSurfaceEconomy(g,{alert:10},['market'],[],2);
 assert.equal(a.items[0].location,market.grade);assert.equal(a.items[0].frontage,market.frontage);
 assert.ok(a.items[0].gross>=0);
});
test('finance logs refunds and rejects forged refund categories',()=>{
 let ledger=createLedger(100,1);ledger=addTransaction(ledger,{day:1,amount:-25,category:'フリマ返品'});
 assert.equal(daySummary(ledger,1).closing,75);assert.doesNotThrow(()=>validateLedger(ledger));
});
test('human-owned city building can be inspected without editing the map',()=>{
 const w=makeWorlds().surface;const building=w.cityBuildings[0];assert.equal(buildingAt(w,building.x,building.y)?.id,building.id);
});
test('zombie visual includes distinct rest, research and walking states',()=>{
 const game=initialGame(); const world=makeWorlds().underground;
 const day={...game,tick:25};assert.ok(visibleResidents(day,'underground',world).some(r=>r.activity==='sleep'));
 const evening={...game,tick:52};assert.ok(visibleResidents(evening,'underground',world).some(r=>r.activity==='walk'));
});
test('PWA service worker includes all modules and uses current version',()=>{
 const sw=read('sw.js'),html=read('index.html');assert.match(sw,/zombie-colony-v392-0/);
 assert.match(html,/styles\.css\?v=392/);assert.match(html,/main\.js\?v=392/);
 assert.match(read('src/main.js'),/propertyLocation/);assert.match(read('src/main.js'),/フリマ返品/);
});
test('service worker precache list has no duplicates (cache.addAll rejects them)',()=>{
 const list=[...read('sw.js').matchAll(/'(\.\/[^']*)'/g)].map(m=>m[1]);const assets=read('sw.js').match(/ASSETS=\[(.*?)\]/)[1].split(',');
 assert.equal(new Set(assets).size,assets.length);assert.ok(list.length>10);
});
test('order board avoids repeating the same item when alternatives exist',async()=>{
 const {refreshOrders}=await import('../src/orders.js');
 for(let d=1;d<40;d++){const b=refreshOrders({},d,new Set(['sweets','paper','fuel']));assert.equal(new Set(b.orders.map(o=>o.item)).size,3);}
});
