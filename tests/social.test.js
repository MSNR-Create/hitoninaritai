import test from 'node:test';
import assert from 'node:assert/strict';
import {initialSocial,advanceSocial,recordDeaths} from '../src/social.js';
import {initialGame} from '../src/simulation.js';
import {initialColony} from '../src/colony.js';
const happy=(g)=>({...g,residents:g.residents.map(r=>({...r,impulse:5,fatigue:10,wellDays:4,lastNeeds:{food:true},strikeDays:0}))});
test('safe daily contact builds named neighbor friendship with an explanatory history',()=>{
 const g=happy(initialGame()), c=initialColony();let s=initialSocial();
 let result=advanceSocial(s,g,c,5);assert.equal(result.social.links[1].affinity,1);
 assert.match(result.social.history[0].reason,/配給/);assert.equal(result.game.residents.length,5);
});
test('conversion requires capacity, food and four days of actual friendly contact',()=>{
 let g=happy(initialGame());let c=initialColony();c.inventory.food=40;let s=initialSocial();
 for(let i=0;i<4;i++){const result=advanceSocial(s,g,c,5);s=result.social;g=result.game;}
 assert.equal(g.residents.length,5);
 const result=advanceSocial(s,g,c,6);assert.equal(result.game.residents.length,6);assert.equal(result.conversion.name,'朝倉ユイ');assert.equal(result.social.neighbors[0].converted,true);
 const again=advanceSocial(result.social,result.game,c,6);assert.equal(again.game.residents.length,6);
});
test('suspicions generate advance warning and police report before reset',()=>{
 let g=initialGame(),c=initialColony(),s=initialSocial();g.residents=g.residents.map(r=>({...r,impulse:80,strikeDays:1}));
 for(let i=0;i<4;i++){const result=advanceSocial(s,g,c,5);s=result.social;g=result.game;}
 assert.ok(s.history.some(e=>e.kind==='warning'));assert.ok(s.history.some(e=>e.kind==='police'));
 assert.ok(g.alert>15);
});
test('death history identifies the person and is bounded',()=>{
 const s=recordDeaths(initialSocial(),4,['モグ']);assert.equal(s.history[0].kind,'loss');assert.match(s.history[0].reason,/危険衝動/);
});
test('no empty population crashes',()=>{
 const g={...initialGame(),residents:[]};const a=advanceSocial(initialSocial(),g,initialColony(),5);assert.equal(a.game.residents.length,0);
});
