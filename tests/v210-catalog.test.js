import test from 'node:test';
import assert from 'node:assert/strict';
import {FACILITY_DEFS,ITEMS,RECIPES,BUILD_CATEGORIES,FACILITY_KINDS} from '../src/catalog.js';
import {TECHS,techById} from '../src/research.js';
import {runProduction} from '../src/production.js';
import {dailyFacilityEffects} from '../src/facility-effects.js';
import {BUILD_COSTS,FACILITY_SIZES} from '../src/construction.js';
test('catalog v2.1 counts: 25 facilities, 23 items, 21 recipes, 40 techs',()=>{assert.equal(Object.keys(FACILITY_DEFS).length,25);assert.equal(Object.keys(ITEMS).length,23);assert.equal(Object.keys(RECIPES).length,21);assert.equal(TECHS.length,40);});
test('every reference resolves: facility techs, recipe items/facilities, categories, icons',()=>{
 const cats=new Set(BUILD_CATEGORIES.map(c=>c.id));
 for(const [k,f] of Object.entries(FACILITY_DEFS)){assert.ok(!f.tech||techById(f.tech),k);assert.ok(cats.has(f.cat),k);assert.ok(f.icon&&f.short,k);assert.equal(BUILD_COSTS[k],f.cost);assert.deepEqual(FACILITY_SIZES[k],f.size);assert.ok(FACILITY_KINDS.includes(k));}
 for(const [id,r] of Object.entries(RECIPES)){assert.ok(FACILITY_DEFS[r.facility],id);for(const k of [...Object.keys(r.in),...Object.keys(r.out)])assert.ok(ITEMS[k],`${id}:${k}`);}
 for(const it of Object.values(ITEMS))assert.ok(it.icon&&it.name);});
test('powered recipes need a generator and fuel; fuel is burned once per night',()=>{
 const inv={samples:2,water:2,compost:2,fuel:0};const fac={culture:1};
 assert.equal(runProduction(inv,100,[{name:'a'}],fac).inventory.samples,2,'no generator');
 assert.equal(runProduction(inv,100,[{name:'a'}],{...fac,generator:1}).inventory.samples,2,'no fuel');
 const r=runProduction({...inv,fuel:1},100,[{name:'a'},{name:'b'}],{culture:2,generator:1});assert.equal(r.inventory.samples,2-2+6);assert.equal(r.inventory.fuel,0);});
test('culture needs seed + inputs: cannot grow from nothing',()=>{const r=runProduction({samples:0,water:5,compost:5,fuel:3},100,[{name:'a'}],{culture:1,generator:1});assert.equal(r.inventory.samples,0);});
test('recipe preference is respected and storage caps block overflow',()=>{
 const inv={residue:4};const a=runProduction(inv,100,[{name:'a'}],{recycler:1},{prefs:{recycler:'fuel_refine'}});assert.equal(a.inventory.fuel,2);assert.equal(a.inventory.compost??0,0);
 const full=runProduction({residue:2,food:0},100,[{name:'a'}],{recycler:1},{prefs:{recycler:'composting'},caps:{food:30,goods:2},goodsTotal:i=>Object.entries(i).filter(([k])=>k!=='food').reduce((s,[,v])=>s+v,0)});assert.equal(full.inventory.residue,2,'compost 3 > space');});
test('kitchen uses spices for +2 food; automation runs without workers when powered',()=>{
 const k=runProduction({mushrooms:3,spices:1},10,[{name:'a'}],{kitchen:1});assert.equal(k.inventory.food,8);assert.equal(k.inventory.spices,0);
 const au=runProduction({salvage:6,fuel:1},10,[],{automation:1,generator:1});assert.ok((au.inventory.parts??0)+(au.inventory.residue??0)>0);});
test('facility effects: lounge, cooler, security, sweets as special ration',()=>{
 const rs=[{id:1,name:'a',impulse:50,fatigue:50,decay:60},{id:2,name:'b',impulse:40,fatigue:40,decay:30}];
 const fx=dailyFacilityEffects(rs,{luxury:1,sweets:4},{lounge:1,cooler:1,security:3},{stage:2});
 assert.equal(fx.residents[0].impulse,44);assert.equal(fx.residents[0].decay,57);assert.equal(fx.alertDelta,-2);assert.equal(fx.inventory.luxury,2);assert.equal(fx.inventory.sweets,0);});
