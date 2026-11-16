import { FACILITY_DEFS } from './catalog.js';
// Phase 2: deterministic, headless construction and 4-neighbor corridor connectivity.
import { inBounds } from './geometry.js';
const k=(x,y)=>`${x},${y}`;
const neighbors=(x,y)=>[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>inBounds(a,b));
export const ZONE_COSTS=Object.freeze({northwest:75,northeast:110,southeast:140});
export const BUILD_COSTS=Object.freeze({path:5,...Object.fromEntries(Object.entries(FACILITY_DEFS).map(([k,f])=>[k,f.cost]))});
export const FACILITY_SIZES=Object.freeze(Object.fromEntries(Object.entries(FACILITY_DEFS).map(([k,f])=>[k,f.size])));
export const FACILITY_NAMES=Object.freeze({...Object.fromEntries(Object.entries(FACILITY_DEFS).map(([k,f])=>[k,f.name])),home:'増築住居'});
export function zoneAt(world,x,y){return world.zones?.find(z=>x>=z.x&&x<z.x+z.w&&y>=z.y&&y<z.y+z.h)??null;}
function hasBuilding(world,x,y){return world.buildings.some(b=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h);}
function isOpen(world,x,y){return inBounds(x,y)&&!world.closed.has(k(x,y));}
export function connectedFacilities(world){
  const visited=new Set(),queue=[];
  const exit=world.buildings.find(b=>b.kind==='exit');
  if(exit)for(let x=exit.x;x<exit.x+exit.w;x++)for(let y=exit.y;y<exit.y+exit.h;y++)for(const [nx,ny] of neighbors(x,y)){
    const key=k(nx,ny);if(world.paths.has(key)&&isOpen(world,nx,ny)&&!visited.has(key)){visited.add(key);queue.push([nx,ny]);}
  }
  for(let i=0;i<queue.length;i++)for(const [nx,ny] of neighbors(...queue[i])){
    const key=k(nx,ny);if(world.paths.has(key)&&isOpen(world,nx,ny)&&!visited.has(key)){visited.add(key);queue.push([nx,ny]);}
  }
  return Object.fromEntries(world.buildings.map(b=>{
    if(b.kind==='exit')return [b.id,true];
    let connected=false;
    for(let x=b.x;x<b.x+b.w;x++)for(let y=b.y;y<b.y+b.h;y++)for(const [nx,ny] of neighbors(x,y))if(visited.has(k(nx,ny)))connected=true;
    return [b.id,connected];
  }));
}
/** v3.3: each expansion costs more than the last (×1.4 per opened zone). */
export function zoneCost(world,zone){const opened=(world.zones??[]).filter(z=>z.open).length;return Math.round(zone.cost*Math.pow(1.4,opened)/5)*5;}
export function canUnlock(world,zoneId,money){
  const zone=world.zones?.find(z=>z.id===zoneId);if(!zone)return {ok:false,reason:'区画が見つかりません'};
  if(zone.open)return {ok:false,reason:'この区画は開放済みです'};
  const cost=zoneCost(world,zone);if(money<cost)return {ok:false,reason:`資金不足（必要 ${cost}G）`};
  let adjacent=false;
  for(let x=zone.x;x<zone.x+zone.w;x++)for(let y=zone.y;y<zone.y+zone.h;y++)for(const [a,b] of neighbors(x,y))if(!world.closed.has(k(a,b))){adjacent=true;}
  return adjacent?{ok:true,cost}:{ok:false,reason:'開放済み区画に隣接していません（外側へ順に拡張）'};
}
function footprint(world,x,y,w,h){
  for(let a=x;a<x+w;a++)for(let b=y;b<y+h;b++){
    if(!isOpen(world,a,b))return 'マップ外または閉鎖区画です';
    if(world.paths.has(k(a,b)))return '通路の上には建てられません';
    if(hasBuilding(world,a,b))return '既存の施設と重なっています';
  }
  return null;
}
export function canBuild(world,kind,x,y,money,rotated=false){
  if(!Number.isInteger(x)||!Number.isInteger(y)||!BUILD_COSTS[kind])return {ok:false,reason:'建設対象が不正です'};
  if(money<BUILD_COSTS[kind])return {ok:false,reason:`資金不足（必要 ${BUILD_COSTS[kind]}G）`};
  const [w0,h0]=kind==='path'?[1,1]:FACILITY_SIZES[kind];const [w,h]=rotated?[h0,w0]:[w0,h0];
  const issue=footprint(world,x,y,w,h);if(issue)return {ok:false,reason:issue};
  if(kind==='path'){
    const beside=neighbors(x,y).some(([a,b])=>world.paths.has(k(a,b)));
    const exitAdjacent=world.buildings.filter(b=>b.kind==='exit').some(ex=>neighbors(x,y).some(([a,bb])=>a>=ex.x&&a<ex.x+ex.w&&bb>=ex.y&&bb<ex.y+ex.h));
    if(!beside&&!exitAdjacent)return {ok:false,reason:'既存の通路または出口に隣接させてください'};
  }else{
    let adjacent=false;for(let a=x;a<x+w;a++)for(let b=y;b<y+h;b++)if(neighbors(a,b).some(([nx,ny])=>world.paths.has(k(nx,ny))))adjacent=true;
    if(!adjacent)return {ok:false,reason:'施設を通路に隣接させてください'};
  }
  return {ok:true,cost:BUILD_COSTS[kind]};
}
export function applyConstruction(world,action,money){
  const validation=action.type==='unlock'?canUnlock(world,action.zoneId,money):action.type==='build'?canBuild(world,action.kind,action.x,action.y,money,!!action.rotated):{ok:false,reason:'不明な操作です'};
  if(!validation.ok)return {ok:false,reason:validation.reason,world,money};
  const copy={...world,closed:new Set(world.closed),paths:new Set(world.paths),buildings:world.buildings.map(b=>({...b})),zones:world.zones.map(z=>({...z}))};
  if(action.type==='unlock'){
    const z=copy.zones.find(z=>z.id===action.zoneId);z.open=true;
    for(let x=z.x;x<z.x+z.w;x++)for(let y=z.y;y<z.y+z.h;y++)copy.closed.delete(k(x,y));
  }else if(action.kind==='path')copy.paths.add(k(action.x,action.y));
  else{
    const [w0,h0]=FACILITY_SIZES[action.kind];const [w,h]=action.rotated?[h0,w0]:[w0,h0];
    copy.nextBuildingId=(copy.nextBuildingId??1)+1;
    copy.buildings.push({id:`built-${copy.nextBuildingId}`,name:FACILITY_NAMES[action.kind]??action.kind,kind:action.kind,x:action.x,y:action.y,w,h,...(action.rotated?{rot:1}:{}),description:'通路につながると利用できます。'});
  }
  copy.connectivity=connectedFacilities(copy);
  return {ok:true,world:copy,money:money-validation.cost,cost:validation.cost};
}
