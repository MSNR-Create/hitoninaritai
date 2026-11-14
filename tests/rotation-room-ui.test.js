import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAP_SIZE,rotateTile,unrotateTile,projectedTile,projectedFootprint,hitTile,worldToView} from '../src/geometry.js';
import {drawScene} from '../src/render.js';
import {makeWorlds} from '../src/world.js';
const text=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('all four rotations are bijections across 24x24 grid',()=>{
 for(let r=0;r<4;r++)for(let x=0;x<MAP_SIZE;x++)for(let y=0;y<MAP_SIZE;y++){
  const t=rotateTile(x,y,r);assert.ok(t.x>=0&&t.x<MAP_SIZE&&t.y>=0&&t.y<MAP_SIZE);
  assert.deepEqual(unrotateTile(t.x,t.y,r),{x,y});
 }
});
test('tap projection and hit tile round-trip for each rotation',()=>{
 for(let r=0;r<4;r++)for(const [x,y] of [[0,0],[7,13],[23,3],[23,23]]){
  const p=projectedTile(x,y,r);const v={cx:300,cy:220,panX:-50,panY:-100,zoom:.85,rotation:r};
  const s=worldToView(p.x,p.y,v);assert.deepEqual(hitTile(s.x,s.y,v),{x,y});
 }
});
test('rotated building footprints keep area and dimensions',()=>{
 const b={x:4,y:5,w:3,h:2};for(let r=0;r<4;r++){
 const f=projectedFootprint(b,r);assert.equal(f.w*f.h,6);
 assert.deepEqual([f.w,f.h],r%2?[2,3]:[3,2]);
 }
});
test('rendering all rotations is safe for both maps',()=>{
 const ctx=new Proxy({fillStyle:'#000',createLinearGradient:()=>({addColorStop(){}})},{get(o,k){if(k in o)return o[k];return ()=>{};}});
 for(const world of Object.values(makeWorlds()))for(let r=0;r<4;r++){
  assert.doesNotThrow(()=>drawScene(ctx,world,{cx:250,cy:250,panX:0,panY:0,zoom:1,rotation:r},null,0,{width:500,height:500},null));
 }
});
test('UI has explicit rotation control, accessible disabled and contrast styles',()=>{
 assert.match(text('index.html'),/id="rotateView"/);
 assert.match(text('src/main.js'),/rotateView.*addEventListener/);
 const css=text('styles.css');assert.match(css,/\.map-sheet button:disabled/);assert.match(css,/--ui-button-border/);
 assert.match(text('src/render.js'),/Open-dollhouse/);
});
