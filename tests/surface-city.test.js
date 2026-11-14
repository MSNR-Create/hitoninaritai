import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorlds,describeTile,buildingAt} from '../src/world.js';
import {createCityInfrastructure,streetTileKind,vehiclesAt,pedestriansAt} from '../src/surface-city.js';
import {rotateTile} from '../src/geometry.js';
import {initialGame} from '../src/simulation.js';
import {visibleResidents} from '../src/agent.js';
const surface=()=>makeWorlds().surface;
test('human surface starts with extensive prebuilt carriageways and sidewalks',()=>{const s=surface();assert.ok(s.paths.size>100);assert.ok(s.sidewalks.size>50);assert.equal(streetTileKind(s,8,2),'road');assert.equal(streetTileKind(s,7,3),'sidewalk');});
test('roads and sidewalks never overwrite buildings, including underground exit',()=>{const s=surface();for(const b of s.buildings)for(let x=b.x;x<b.x+b.w;x++)for(let y=b.y;y<b.y+b.h;y++){assert.equal(s.paths.has(`${x},${y}`),false);assert.equal(s.sidewalks.has(`${x},${y}`),false);assert.equal(buildingAt(s,x,y)?.id,b.id);}});
test('street inspection shows separate ground types',()=>{const s=surface();assert.equal(describeTile(s,8,2).type,'道路');assert.equal(describeTile(s,7,3).type,'歩道');});
test('traffic density increases with population and traffic remains on road axis',()=>{const few=vehiclesAt(42,22,50),many=vehiclesAt(42,130,80);assert.ok(many.length>few.length);for(const v of many)assert.ok(v.x>=0&&v.x<24&&v.y>=0&&v.y<24);});
test('pedestrians animate deterministically and grow with population',()=>{const a=pedestriansAt(42,34);assert.deepEqual(a,pedestriansAt(42,34));assert.ok(pedestriansAt(42,100).length>a.length);});
test('street vehicles and roads remain map-invariant under quarter turns',()=>{for(let r=0;r<4;r++){const s=surface();for(const v of vehiclesAt(1,50,60)){const p=rotateTile(v.x,v.y,r);assert.ok(p.x>=0&&p.x<=24&&p.y>=0&&p.y<=24)}assert.ok(s.paths.size>100)}});
test('underground residents visibly occupy home footprint when passing a world',()=>{const w=makeWorlds().underground,g=initialGame();const home=w.buildings.find(b=>b.kind==='home');for(const v of visibleResidents(g,'underground',w)){assert.ok(v.x>=home.x&&v.x<home.x+home.w);assert.ok(v.y>=home.y&&v.y<home.y+home.h);}});

test('moving vehicles avoid residential and commercial footprints',()=>{const city=surface();for(const seconds of [0,2,7,12,18,23,40])for(const v of vehiclesAt(seconds,140,95)){const x=Math.floor(v.x),y=Math.floor(v.y);assert.equal(buildingAt(city,x,y),null,`vehicle overlaps building: ${x},${y}`);assert.equal(city.paths.has(`${x},${y}`),true,`vehicle off road: ${x},${y}`);}});
