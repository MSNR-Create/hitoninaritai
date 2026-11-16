import test from 'node:test';import assert from 'node:assert/strict';
import {tileToWorld,worldToTile,hitTile,zoomAround,worldToView,viewToWorld,MAP_SIZE} from '../src/geometry.js';
import {makeWorlds,buildingAt,describeTile} from '../src/world.js';

test('24x24 tile centers roundtrip through inverse isometric transform',()=>{
 for(let x=0;x<MAP_SIZE;x++)for(let y=0;y<MAP_SIZE;y++){
  const w=tileToWorld(x,y);assert.deepEqual(worldToTile(w.x,w.y),{x,y});
 }
});
test('tile picking is correct after camera translation and zoom',()=>{
 const view={cx:185,cy:310,panX:-23,panY:-210,zoom:1.8};
 for(const pair of [[0,0],[0,15],[15,0],[15,15],[8,7]]){
  const w=tileToWorld(...pair),p=worldToView(w.x,w.y,view);
  assert.deepEqual(hitTile(p.x,p.y,view),{x:pair[0],y:pair[1]});
 }
 const p=worldToView(...Object.values(tileToWorld(-1,-1)),view);assert.equal(hitTile(p.x,p.y,view),null);
});
test('zoom keeps the world point beneath pointer fixed',()=>{
 const view={cx:160,cy:250,panX:20,panY:-80,zoom:.7};
 const before=viewToWorld(110,220,view),next=zoomAround(view,1.4,110,220);
 assert.deepEqual(viewToWorld(110,220,next),before);
 assert.equal(zoomAround(view,100,0,0).zoom,2.5);
 assert.equal(zoomAround(view,.01,0,0).zoom,.45);
});
test('surface and underground worlds are separate and have map bounds',()=>{
 const worlds=makeWorlds();assert.equal(worlds.underground.buildings.length,3);assert.equal(worlds.surface.buildings.length,7);
 assert.equal(buildingAt(worlds.underground,4,5).name,'共同住居');
 assert.equal(buildingAt(worlds.surface,4,5).name,'人間の住宅');
 assert.equal(describeTile(worlds.underground,0,0).type,'閉鎖');
 assert.equal(describeTile(worlds.underground,8,8).type,'通路');
 assert.equal(describeTile(worlds.underground,32,0),null);
});
