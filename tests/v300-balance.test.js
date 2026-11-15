import test from 'node:test';
import assert from 'node:assert/strict';
import {initialSocial,advanceSocial} from '../src/social.js';
import {initialGame,stepGame} from '../src/simulation.js';
import * as S from '../src/surface-economy.js';
test('new neighbors keep moving in after conversions',()=>{let s=initialSocial();for(const n of s.neighbors)n.converted=true;
 const g=initialGame();const r=advanceSocial(s,g,{inventory:{food:0},nextResidentId:9},5);assert.ok(r.social.neighbors.filter(n=>!n.converted).length>=3);});
test('alert settles in a middle band with normal night work',()=>{let g={...initialGame(),alert:0};const seen=[];for(let t=0;t<120*30;t++){g=stepGame(g);if(g.tick%120===1)seen.push(g.alert);}
 const tail=seen.slice(-15);assert.ok(Math.max(...tail)<90&&Math.min(...tail)>3,tail.join(','));});
test('trust is mean-reverting, not pinned',()=>{let s=S.initialSurfaceEconomy();for(let d=1;d<40;d++)s=S.advanceSurfaceEconomy(s,{alert:50},[],[],d).surface;assert.ok(s.trust>20&&s.trust<70,String(s.trust));});
test('a rented shop is only modestly profitable after rent',()=>{let s=S.initialSurfaceEconomy(),net=0;for(let d=1;d<=30;d++){const r=S.advanceSurfaceEconomy(s,{alert:15},[],['market'],d);s=r.surface;net+=r.net;}
 assert.ok(net/30-22<20,`profit/day ${net/30-22}`);});
