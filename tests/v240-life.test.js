import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorlds} from '../src/world.js';
import {applyConstruction,canBuild} from '../src/construction.js';
import {homeAssignments,homeCapacity} from '../src/agent.js';
import {initialGame,stepGame,JOBS,jobEligible,chooseAutoJob} from '../src/simulation.js';
import {ensureColonist} from '../src/colonists.js';
test('residents spread across homes by each home capacity',()=>{let w=makeWorlds().underground;let spot=null;for(let x=1;x<22&&!spot;x++)for(let y=1;y<22&&!spot;y++)if(canBuild(w,'home',x,y,999).ok)spot={x,y};
 w=applyConstruction(w,{type:'build',kind:'home',...spot},999).world;w.connectivity={...w.connectivity,[w.buildings.at(-1).id]:true};
 const g={...initialGame()};g.residents=[...g.residents,...[6,7].map(id=>({...g.residents[0],id,name:'x'+id}))];
 const a=homeAssignments(g,w);const counts={};for(const v of Object.values(a))counts[v.id]=(counts[v.id]??0)+1;
 const homes=w.buildings.filter(b=>b.kind==='home');assert.equal(Object.keys(counts).length,2,'both homes used');for(const h of homes)assert.ok(counts[h.id]<=homeCapacity(w,h));});
test('part-time jobs: hourly wage × 6h = pay; locked jobs need level/stats',()=>{
 for(const j of Object.values(JOBS))if(j.wage)assert.equal(j.wage*6,j.pay);
 const r=ensureColonist({id:3,name:'ネム'});assert.equal(jobEligible(r,'labassist'),false);assert.equal(jobEligible({...r,level:5,stats:{...r.stats,int:5}},'labassist'),true);
 const g=initialGame();const best=chooseAutoJob({...r,level:5,stats:{...r.stats,int:6},fatigue:10},{...g,money:500});assert.ok(['labassist','forage'].includes(best));});
test('ineligible explicit job falls back to cleaning; shopping list drafts auto residents',()=>{let g=initialGame();g={...g,residents:g.residents.map(ensureColonist).map((r,i)=>i===0?{...r,job:'labassist'}:{...r,job:'auto'}),shoppingPacks:4};
 for(let t=0;t<61;t++)g=stepGame({...g,shoppingPacks:4});assert.equal(g.residents[0].activeJob,'clean');assert.equal(g.residents.filter(r=>r.activeJob==='shopping').length,2);
 for(let t=61;t<121;t++)g=stepGame({...g,shoppingPacks:4});assert.equal(g.lastReport.shoppers,2);});
