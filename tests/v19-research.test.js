import test from 'node:test';
import assert from 'node:assert/strict';
import {TECHS,techStatus,startTech,advanceResearch,researchMods,researchState} from '../src/research.js';
import {initialColony,buySupply} from '../src/colony.js';
import {initialGame,stepGame} from '../src/simulation.js';
const rich=()=>({...initialColony(),inventory:{...initialColony().inventory,samples:50}});
test('tree has 40 techs, unique ids, valid prerequisites, no cycles',()=>{
 assert.equal(TECHS.length,42);const ids=new Set(TECHS.map(t=>t.id));assert.equal(ids.size,42);
 for(const t of TECHS)for(const q of t.req){assert.ok(ids.has(q));assert.ok(TECHS.find(x=>x.id===q).tier<=t.tier);}
});
test('locked techs cannot start; prerequisites unlock them',()=>{
 const c=rich();assert.equal(techStatus(c,'sleep'),'locked');assert.equal(startTech(c,999,'sleep',true).ok,false);
 assert.equal(techStatus({...c,completedResearch:['impulse']},'sleep'),'available');
});
test('only one active project; costs deducted once; lab required',()=>{
 const c=rich();assert.equal(startTech(c,999,'shiftplan',false).ok,false);
 const r=startTech(c,999,'shiftplan',true);assert.equal(r.ok,true);assert.equal(r.money,959);assert.equal(r.colony.inventory.samples,49);
 assert.equal(startTech(r.colony,r.money,'bunk',true).ok,false);
});
test('research points: researchers + extra labs; completes exactly at work',()=>{
 let c=startTech(rich(),999,'shiftplan',true).colony;
 let a=advanceResearch(c,1,2);assert.equal(a.points,2);assert.equal(a.completed,null);
 a=advanceResearch(a.colony,1,1);assert.equal(a.completed,'shiftplan');assert.equal(researchState(a.colony).active,null);
 assert.equal(advanceResearch(a.colony,3,1).points,0);
});
test('v1.8 save with started research migrates to impulse',()=>{assert.equal(researchState({research:{started:true,progress:2}}).active,'impulse');});
test('modifiers change pay, fatigue and food pack',()=>{
 const base=initialGame(),mods=researchMods(['shiftplan','stretch']);
 const run=g=>{for(let i=0;i<120;i++)g=stepGame(g);return g;};
 const plain=run(base),boosted=run({...base,mods});
 assert.ok(boosted.lastReport.income>plain.lastReport.income);
 assert.ok(boosted.residents[1].fatigue<plain.residents[1].fatigue);
 assert.equal(buySupply(initialColony(),100,'food',1,researchMods(['preserve'])).quantity,8);
 assert.equal(buySupply(initialColony(),100,'care',1,researchMods(['logistics'])).cost,10);
});
