import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGame,stepGame,assignJob} from '../src/simulation.js';
import {initialColony,buySupply,beginResearch,advanceColony} from '../src/colony.js';
import {advanceResearch,researchState,researchMods} from '../src/research.js';
import {makeWorlds} from '../src/world.js';
import {canBuild,applyConstruction,connectedFacilities} from '../src/construction.js';
const day=s=>{for(let i=0;i<120;i++)s=stepGame(s);return s};
test('buy supply deducts money once and adds only corresponding goods',()=>{
 const a=initialColony(),r=buySupply(a,300,'food');assert.equal(r.money,293);assert.equal(r.colony.inventory.food,20);assert.equal(a.inventory.food,15);
 assert.equal(buySupply(a,0,'food').ok,false);
 assert.equal(buySupply(a,300,'unknown').ok,false);
});
test('all five residents consume exactly five food from communal stock',()=>{
 const s=day(initialGame()),c=initialColony();let stocked={...c,inventory:{...c.inventory,food:c.inventory.food+s.lastReport.harvest}};
 const result=advanceColony(s,stocked,false);
 assert.equal(result.colony.inventory.food,15);assert.equal(result.colony.report.shortage,0);assert.equal(result.game.residents.length,5);
});
test('prolonged hunger triggers visible warning then deterministic incident and bounded alert',()=>{
 let g=initialGame(),c={...initialColony(),inventory:{...initialColony().inventory,food:0,care:0}};
 let warned=false,incident=false;
 for(let i=0;i<12;i++){g=day(g);let r=advanceColony(g,c,false);g=r.game;c=r.colony;warned||=g.residents.some(x=>x.impulse>=60);incident||=c.incidentCount>0;}
 assert.equal(warned,true);assert.equal(incident,true);assert.ok(g.alert<=100);
});
test('a disconnected laboratory cannot start research, and research costs are applied once',()=>{
 const c={...initialColony(),inventory:{...initialColony().inventory,samples:2}};
 assert.equal(beginResearch(c,300,false).ok,false);
 const r=beginResearch(c,300,true);assert.equal(r.ok,true);assert.equal(r.money,240);assert.equal(r.colony.inventory.samples,0);
 assert.equal(beginResearch(r.colony,r.money,true).ok,false);
});
test('four scientist-shifts complete impulse research and lower subsequent impulse',()=>{
 let c={...initialColony(),research:{started:true,progress:0}};let g=initialGame();
 for(let i=0;i<4;i++){g=day(assignJob(g,1,'research'));const ar=advanceResearch(c,g.residents.filter(r=>r.activeJob==='research').length,1);c=ar.colony;const r=advanceColony(g,c,true);g=r.game;c=r.colony;}
 assert.equal(c.completedResearch.includes('impulse'),true);assert.equal(researchState(c).active,null);
 const next=day(g);const withResearch=advanceColony(next,c,true,5,researchMods(c.completedResearch));const withoutResearch=advanceColony(next,{...c,completedResearch:[]},true,5,researchMods([]));assert.ok(withResearch.game.residents[0].impulse<withoutResearch.game.residents[0].impulse);assert.ok(withResearch.game.residents[0].impulse>=0);
});
test('research laboratory uses a 2×2 footprint and can join corridors',()=>{
 const w=makeWorlds().underground;let found=null;
 for(let x=0;x<16&&!found;x++)for(let y=0;y<16&&!found;y++){if(canBuild(w,'lab',x,y,300).ok)found={x,y};}
 assert.ok(found);let r=applyConstruction(w,{type:'build',kind:'lab',...found},300);
 assert.equal(r.ok,true);assert.equal(r.money,180);assert.equal(r.world.buildings.find(b=>b.kind==='lab').w,2);
 assert.equal(Object.values(connectedFacilities(r.world)).at(-1),true);
});
test('luxury requirement emerges only at second stage',()=>{
 let c=initialColony(),g=initialGame();g=day(g);({game:g,colony:c}=advanceColony(g,c,false));
 assert.equal(c.stage,1);assert.equal(g.residents[4].lastNeeds.luxury,true);
 g={...g,day:10};g=day(g);({game:g,colony:c}=advanceColony(g,c,false));
 assert.equal(c.stage,2);assert.equal(g.residents[4].lastNeeds.luxury,false);
});
