import test from 'node:test';
import assert from 'node:assert/strict';
import * as ST from '../src/storage.js';
import {homeCapacity} from '../src/agent.js';
test('upgraded storage and homes hold more',()=>{const mk=lv=>({buildings:[{id:'a',kind:'storage',x:0,y:0,w:2,h:2,level:lv},{id:'h',kind:'home',x:3,y:0,w:2,h:2,level:lv}],connectivity:{a:true,h:true}});
 assert.ok(ST.capacities(mk(2)).goods>ST.capacities(mk(1)).goods);const w=mk(3);assert.equal(homeCapacity(w,w.buildings[1]),(()=>{const w1=mk(1);return homeCapacity(w1,w1.buildings[1]);})()+4);});
