import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGame,stepGame,assignJob,chooseAutoJob} from '../src/simulation.js';
import {initialColony,advanceColony} from '../src/colony.js';
const night=s=>{for(let i=0;i<120;i++)s=stepGame(s);return s;};
test('automatic choices prioritize shortage and exhaustion',()=>{
 const g=initialGame();assert.equal(chooseAutoJob({...g.residents[0],fatigue:80},g),'rest');
 assert.equal(chooseAutoJob({...g.residents[0],fatigue:20},{...g,food:0}),'forage');
 assert.ok(['clean','warehouse','forage','rest'].includes(chooseAutoJob(g.residents[0],g)));
});
test('max exhaustion triggers extended strike, not immediate work next morning',()=>{
 let g=initialGame();g.residents[0].fatigue=80;g=assignJob(g,1,'warehouse');
 g=night(g);assert.equal(g.residents[0].strikeDays,2);
 for(let i=0;i<60;i++)g=stepGame(g);
 assert.equal(g.residents[0].activeJob,'rest');assert.ok(g.residents[0].strikeDays>0);
 g=night(g);assert.ok(g.residents[0].fatigue<95);
});
test('starvation can trigger strike without forcing night work',()=>{
 let g=initialGame(),c={...initialColony(),inventory:{...initialColony().inventory,food:0}};
 for(let i=0;i<4;i++){g=night(g);({game:g,colony:c}=advanceColony(g,c,false));}
 assert.ok(g.residents.some(r=>r.strikeDays>0)||g.residents.length<5);
});
test('repeated warned incidents cause real population loss and no duplicate death',()=>{
 let g=initialGame(),c={...initialColony(),inventory:{...initialColony().inventory,food:0,care:0}};
 for(let i=0;i<18;i++){g=night(g);({game:g,colony:c}=advanceColony(g,c,false));}
 assert.ok(c.lossCount>0);assert.equal(g.residents.length+c.lossCount,5);
 assert.equal(new Set(g.residents.map(r=>r.id)).size,g.residents.length);
});
test('communal provisioning no longer creates anonymous followers',()=>{
 let g=initialGame(),c=initialColony();g.day=6;for(const r of g.residents){r.wellDays=3;r.fatigue=0;r.impulse=0;r.previousImpulse=0;r.activeJob='rest';}
 c.inventory.food=30;c.inventory.care=20;c.inventory.luxury=10;const a=advanceColony(g,c,false,7);assert.equal(a.game.residents.length,5);assert.equal(a.colony.conversionCount,0);
});
test('zero living residents never divides by zero or creates followers',()=>{
 const g={...initialGame(),residents:[]};const c=initialColony();const a=advanceColony(g,c,false,10);assert.equal(a.game.residents.length,0);
});
