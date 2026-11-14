import { MAP_SIZE } from './geometry.js';
import { canBuild, applyConstruction, FACILITY_SIZES } from './construction.js';
const k=(x,y)=>`${x},${y}`;
const within=(x,y)=>x>=0&&y>=0&&x<MAP_SIZE&&y<MAP_SIZE;
const occupied=(w,x,y)=>w.buildings.some(b=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h);
// Dijkstra route: prefer existing corridors, never cross buildings or closed zones.
export function planCorridor(world,start,end,money){
 if(!start||!end||![start,end].every(p=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&within(p.x,p.y)))return {ok:false,reason:'マップ上の始点と終点を指定してください'};
 const valid=(p)=>!world.closed.has(k(p.x,p.y))&&!occupied(world,p.x,p.y);
 if(!valid(start)||!valid(end))return {ok:false,reason:'建物・閉鎖区画には通路を通せません'};
 const isNetwork=p=>world.paths.has(k(p.x,p.y))||world.buildings.some(b=>b.kind==='exit'&&[[p.x-1,p.y],[p.x+1,p.y],[p.x,p.y-1],[p.x,p.y+1]].some(([x,y])=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h));
 if(!isNetwork(start))return {ok:false,reason:'始点は既存の通路または出口の隣にしてください'};
 const costs=new Map([[k(start.x,start.y),0]]),prev=new Map(),open=[start],visited=new Set();
 while(open.length){open.sort((a,b)=>(costs.get(k(a.x,a.y))-costs.get(k(b.x,b.y)))||(a.y-b.y)||(a.x-b.x));const p=open.shift(),pk=k(p.x,p.y);if(visited.has(pk))continue;visited.add(pk);if(p.x===end.x&&p.y===end.y)break;
  for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){const n={x:p.x+dx,y:p.y+dy};if(!within(n.x,n.y)||!valid(n))continue;const nk=k(n.x,n.y),price=world.paths.has(nk)?0:5,score=costs.get(pk)+price+0.001;
   if(score<(costs.get(nk)??Infinity)){costs.set(nk,score);prev.set(nk,pk);open.push(n)}}}
 const endKey=k(end.x,end.y);if(!costs.has(endKey))return {ok:false,reason:'到達できる通路がありません'};
 let route=[],cur=endKey;while(cur){const [x,y]=cur.split(',').map(Number);route.push({x,y});cur=prev.get(cur)}route.reverse();const fresh=route.filter(p=>!world.paths.has(k(p.x,p.y))),cost=fresh.length*5;
 if(cost>money)return {ok:false,reason:`資金不足（必要 ${cost}G）`,route,cost};return {ok:true,route,cost,newTiles:fresh};
}
export function applyCorridor(world,plan,money){
 if(!plan?.ok||money<plan.cost)return {ok:false,reason:'通路を設置できません',world,money};
 const copy={...world,paths:new Set(world.paths),closed:new Set(world.closed),buildings:world.buildings.map(b=>({...b})),zones:world.zones.map(z=>({...z}))};
 for(const p of plan.newTiles){if(!within(p.x,p.y)||copy.closed.has(k(p.x,p.y))||occupied(copy,p.x,p.y))return {ok:false,reason:'設置先が変更されました',world,money};copy.paths.add(k(p.x,p.y))}
 return {ok:true,world:copy,money:money-plan.cost,cost:plan.cost};
}
export function buildingPreview(world,kind,x,y,money){const size=FACILITY_SIZES[kind];if(!size)return {ok:false,reason:'不正な施設です'};return {...canBuild(world,kind,x,y,money),x,y,w:size[0],h:size[1]};}
