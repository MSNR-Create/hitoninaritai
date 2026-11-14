import test from 'node:test';
import assert from 'node:assert/strict';
import {formattedGameClock,ticksUntilNextDay,nextSpeed} from '../src/game-clock.js';
test('朝06時開始、夕方18時に夜へ',()=>{assert.equal(formattedGameClock(1,0).dateTime,'第1日 · 06:00');assert.equal(formattedGameClock(1,60).dateTime,'第1日 · 18:00');assert.equal(formattedGameClock(1,60).phase,'夜')});
test('夜をまたいで翌朝06時まで進む',()=>{assert.equal(formattedGameClock(4,119).dateTime,'第4日 · 05:48');assert.equal(ticksUntilNextDay(119),1);assert.equal(ticksUntilNextDay(0),120)});
test('速度は1→2→5→10→1',()=>{assert.deepEqual([1,2,5,10].map(nextSpeed),[2,5,10,1])});
