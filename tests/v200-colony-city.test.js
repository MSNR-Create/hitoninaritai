import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/colonists.js';
import * as CITY from '../src/city.js';
import {runProduction} from '../src/production.js';
import {initialGame,stepGame} from '../src/simulation.js';
import {makeWorlds} from '../src/world.js';
const base=()=>initialGame().residents.map(C.ensureColonist);
test('fixed starting crew: 5 stats, one strength + one weakness, decay 10–18, Lv1',()=>{
 for(const r of base()){assert.equal(r.level,1);assert.equal(r.sp,0);assert.equal(Object.keys(r.stats).length,5);assert.ok(C.TRAITS[r.traits[0]].good&&!C.TRAITS[r.traits[1]].good);assert.ok(r.decay>=10&&r.decay<=18);}
 assert.deepEqual(C.ensureColonist({id:9,name:'x'}),C.ensureColonist({id:9,name:'x'}));});
test('XP caps per day; levels never exceed 10; SP total 9',()=>{let rs=base().map(r=>({...r,activeJob:'clean'}));
 for(let d=0;d<400;d++)rs=C.dailyColonists(rs).residents.map(r=>({...r,activeJob:'clean',decay:10}));
 for(const r of rs){assert.equal(r.level,10);assert.equal(r.sp,9);}});
test('allocation respects SP and the 10 cap',()=>{const r={...C.ensureColonist({id:1,name:'a'}),sp:1};const a=C.allocate(r,'int');assert.ok(a.ok);assert.equal(C.allocate(a.resident,'int').ok,false);assert.equal(C.allocate({...r,stats:{...r.stats,str:10}},'str').ok,false);});
test('decay grows without care; washing keeps it in check and uses care',()=>{let rs=base().map(r=>({...r,activeJob:'clean'}));let raw=rs;
 for(let d=0;d<20;d++){raw=C.dailyColonists(raw).residents;const w=C.dailyColonists(rs,{washSlots:4,care:4});rs=w.residents;assert.ok(w.careUsed<=4);}
 const avg=a=>a.reduce((n,r)=>n+r.decay,0)/a.length;assert.ok(avg(raw)>avg(rs)+20);assert.ok(avg(raw)>45);});
test('odor blocks outside work at 70; decay 85 blocks too; simulation sends them to rest',()=>{let g=initialGame();g={...g,residents:g.residents.map(C.ensureColonist).map((r,i)=>i===0?{...r,decay:90}:r)};
 assert.equal(C.canGoOutside(g.residents[0]),false);for(let t=0;t<61;t++)g=stepGame(g);assert.equal(g.residents[0].activeJob,'rest');});
test('stats/traits change pay: strong & high STR earn more cleaning',()=>{const r=C.ensureColonist({id:1,name:'モグ'});assert.ok(C.workEfficiency(r,'clean')>1);assert.ok(C.workEfficiency({...r,decay:70},'clean')<C.workEfficiency(r,'clean'));});
test('production consumes inputs before outputs; no inputs = nothing',()=>{
 const none=runProduction({salvage:1},50,[{name:'a'}],{sorting:1,extractor:1});assert.equal(none.inventory.salvage,1);assert.equal(none.money,50);
 let inv={salvage:4,residue:0,labwaste:0,samples:0},money=50;
 for(let i=0;i<3;i++){const r=runProduction(inv,money,[{name:'a'}],{sorting:1,extractor:1});inv=r.inventory;money=r.money;}
 assert.equal(inv.samples,1);assert.equal(inv.salvage,0);assert.equal(inv.residue,0);assert.equal(inv.labwaste,1);assert.equal(money,50-1-1-3);});
test('city grows toward housing cap, unlocks districts irreversibly',()=>{let s={humans:34,trust:60,city:CITY.initialCity()};let unlocked=[];
 for(let d=1;d<120;d++){const r=CITY.advanceCity(s,10,d,{businesses:2});s=r.surface;unlocked.push(...r.events.filter(e=>e.kind==='district').map(e=>e.id));assert.ok(s.humans<=CITY.housingCapacity(s.city));}
 assert.ok(unlocked.includes('commerce'));assert.ok(s.humans>45);const back=CITY.advanceCity({...s,trust:5},95,200);assert.deepEqual(back.surface.city.districts.slice(0,s.city.districts.length),s.city.districts);});
test('lots: leech is free but gets caught; router needs lease & upgrade path; effects feed flea',()=>{let c=CITY.initialCity();
 const lot='lot-a';assert.equal(CITY.buildOnLot(c,100,lot,'router').ok,false);let r=CITY.buildOnLot(c,100,lot,'leech');assert.ok(r.ok);c=r.city;
 assert.ok(CITY.lotEffects(c).fleaViewMul>1);assert.equal(CITY.buildOnLot(c,100,lot,'router').ok,false,'needs lease');
 c=CITY.leaseLot(c,100,lot).city;r=CITY.buildOnLot(c,100,lot,'router');assert.ok(r.ok);assert.equal(CITY.lotEffects(r.city).freePhoto,true);
 let caught=0;for(let d=1;d<200;d++){const x=CITY.advanceCity({humans:34,trust:55,city:{...CITY.initialCity(),lots:{'lot-b':{facility:'leech'}}}},20,d);if(x.events.some(e=>e.kind==='wifi_caught'))caught++;}assert.ok(caught>5&&caught<40);});
test('lots sit on grass, never on roads/sidewalks/buildings',()=>{const w=makeWorlds().surface;const occ=new Set();for(const b of [...w.buildings,...w.cityBuildings])for(let x=b.x;x<b.x+b.w;x++)for(let y=b.y;y<b.y+b.h;y++)occ.add(x+','+y);
 for(const l of CITY.LOTS)for(let x=l.x;x<l.x+l.w;x++)for(let y=l.y;y<l.y+l.h;y++){assert.ok(!occ.has(x+','+y),l.id);assert.ok(![7,8,9,10,14,15,16,17].includes(x)&&![7,8,9,10,14,15,16,17].includes(y),l.id);}});
