import test from 'node:test';
import assert from 'node:assert/strict';
import {TECHS,BRANCHES,startTech,techStatus,researchMods} from '../src/research.js';
import {FACILITIES,RECIPES,runProduction} from '../src/production.js';
import {BUILD_COSTS,FACILITY_SIZES,FACILITY_NAMES,applyConstruction} from '../src/construction.js';
import {makeWorlds} from '../src/world.js';
import {GOODS,room} from '../src/storage.js';
import {initialColony,SUPPLIES,distributeSpecial} from '../src/colony.js';
import {initialGame} from '../src/simulation.js';
import {validateSession} from '../src/persistence.js';
import fs from 'node:fs';

const file=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('all v2.1 content is consistently registered, with no duplicate names or broken tech requirements',()=>{
 assert.equal(TECHS.length,40); assert.equal(Object.keys(FACILITIES).length,22);
 assert.equal(Object.keys(RECIPES).length,21); assert.equal(Object.keys(GOODS).length,22);
 assert.equal(new Set(TECHS.map(t=>t.id)).size,TECHS.length);
 for(const tech of TECHS){assert.ok(BRANCHES[tech.branch]);assert.ok(tech.cost>0&&tech.samples>0&&tech.work>0);for(const q of tech.req)assert.ok(TECHS.some(t=>t.id===q&&t.tier<=tech.tier),tech.id+' -> '+q);}
 for(const [id,fac] of Object.entries(FACILITIES)){
  assert.equal(BUILD_COSTS[id],fac.cost);assert.deepEqual(FACILITY_SIZES[id],fac.size);assert.equal(FACILITY_NAMES[id],fac.name);
  if(fac.tech)assert.ok(TECHS.some(t=>t.id===fac.tech),id+' missing tech');
  assert.match(file('index.html'),new RegExp(`data-tool="${id}"`));
  assert.match(file('src/persistence.js'),new RegExp(`'${id}'`));
 }
 for(const [id,r] of Object.entries(RECIPES)){
  assert.ok(FACILITIES[r.facility],id+' no facility');
  for(const key of [...Object.keys(r.in),...Object.keys(r.out)])assert.ok(GOODS[key]||key==='food',id+' unknown '+key);
 }
});
test('food production consumes materials, pays processing fees and respects storage capacity',()=>{
 const inv={food:3,mushrooms:3,salvage:0};
 const r=runProduction(inv,30,[{name:'シェフ'}],{kitchen:1},'food_prep',{food:20,goods:30});
 assert.equal(r.log[0].ok,true);assert.equal(r.inventory.food,9);assert.equal(r.inventory.mushrooms,0);assert.equal(r.money,28);
 const full=runProduction(inv,30,[{name:'シェフ'}],{kitchen:1},'food_prep',{food:8,goods:30});
 assert.equal(full.log[0].ok,false);assert.equal(full.inventory.food,3);assert.equal(full.money,30);
});
test('production can be directed; recipes do not run when missing materials',()=>{
 const inv={salvage:4,compost:2,samples:0};
 const choose=runProduction(inv,30,[{name:'担当'}],{mushroom:1,sorting:1},'mushroom_crop');
 assert.equal(choose.log[0].recipe,'mushroom_crop');assert.equal(choose.inventory.mushrooms,4);
 const cannot=runProduction(inv,30,[{name:'担当'}],{mushroom:1},'sample_culture');
 assert.equal(cannot.log[0].ok,false);assert.equal(cannot.inventory.salvage,4);
});
test('technology gates new buildings and modifiers include decay / stealth / logistics',()=>{
 const colony={...initialColony(),inventory:{...initialColony().inventory,samples:100}};
 assert.equal(techStatus(colony,'mycology'),'available');
 assert.equal(techStatus(colony,'hydroponics'),'locked');
 const start=startTech(colony,1000,'mycology',true);
 assert.equal(start.ok,true);
 const w=makeWorlds().underground;
 const r=applyConstruction(w,{type:'build',kind:'mushroom',x:1,y:6},1000);
 assert.equal(r.ok,true);
 const mod=researchMods(['refrigeration','health_protocol','undercover','transport']);
 assert.ok(mod.decayReduction>=.35);assert.ok(mod.exposureCut>0);assert.ok(mod.surfaceMul>1);
});
test('special rations give different benefits, require inventory and consume exactly one unit',()=>{
 const c={...initialColony(),inventory:{...initialColony().inventory,coffee:1,sweets:1,media:1,makeup:1}};
 const g=initialGame(); const tired={...g,residents:g.residents.map(r=>({...r,fatigue:35,impulse:20,fresh:0,odor:20}))};
 const a=distributeSpecial(c,tired,'coffee');assert.equal(a.ok,true);assert.equal(a.colony.inventory.coffee,0);assert.equal(a.game.residents[0].fatigue,28);
 const b=distributeSpecial(c,tired,'sweets');assert.equal(b.game.residents[0].impulse,12);
 const m=distributeSpecial(c,tired,'makeup');assert.equal(m.game.residents[0].odor,6);
 assert.equal(distributeSpecial(a.colony,a.game,'coffee').ok,false);
});
test('v2.1 interface exposes both recipe controls and dedicated categories',()=>{
 const html=file('index.html'),main=file('src/main.js');
 assert.match(html,/id="productionPlan"/);assert.match(html,/category-heading/);
 for(const key of ['sweets','coffee','media','makeup'])assert.match(html,new RegExp(`data-treat="${key}"`));
 assert.match(main,/runProduction\(colony\.inventory,game\.money,workers,facs,colony\.productionPlan/);
 assert.match(main,/connectedKind\('automation'\)/);
});
