import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGame,stepGame,assignJob} from '../src/simulation.js';
import {residentVisual,visibleResidents} from '../src/agent.js';
const advance=(s,n)=>{for(let i=0;i<n;i++)s=stepGame(s);return s;};
test('agents return home, leave underground, work outside, and return on surface',()=>{
 let s=initialGame();assert.equal(visibleResidents(s,'underground').length,5);
 s=advance(s,65);assert.equal(residentVisual(s,s.residents[0]).status,'出勤中');
 s=advance(s,10);assert.equal(residentVisual(s,s.residents[0]).layer,'surface');
 s=advance(s,8);assert.equal(residentVisual(s,s.residents[0]).layer,'outside');
 s=advance(s,32);assert.equal(residentVisual(s,s.residents[0]).status,'帰還中');
 s=advance(s,5);assert.equal(residentVisual(s,s.residents[0]).status,'帰宅中');
});
test('resting agent stays underground throughout night',()=>{
 let s=advance(assignJob(initialGame(),1,'rest'),105);
 assert.equal(residentVisual(s,s.residents[0]).layer,'underground');
 assert.equal(residentVisual(s,s.residents[0]).status,'休息中');
});
test('job updates after shift start do not alter active payout',()=>{
 let s=advance(initialGame(),60);const active=s.residents[0].activeJob;
 s=assignJob(s,1,'rest');assert.equal(s.residents[0].activeJob,active);
 s=advance(s,60);assert.equal(s.lastReport.income,120);
});
test('visual projection does not mutate simulation and is repeatable',()=>{
 const s=advance(initialGame(),72),before=JSON.stringify(s);
 const a=residentVisual(s,s.residents[2]);assert.deepEqual(a,residentVisual(s,s.residents[2]));
 assert.equal(JSON.stringify(s),before);
});
