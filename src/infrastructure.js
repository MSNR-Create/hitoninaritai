// v3.5 colony infrastructure: daily upkeep, power grid, ration-counter range and facility synergies.
import { FACILITY_DEFS } from './catalog.js';
const conn=(w,b)=>w.connectivity?.[b.id]??true;
/** Daily upkeep in G. Every facility costs something; each additional lab costs more than the last. */
export function upkeepOf(b,labIndex=0){
 if(b.kind==='exit')return 0;if(b.kind==='lab')return 6+labIndex*labIndex*4;
 const f=FACILITY_DEFS[b.kind];return Math.max(1,Math.round((f?.cost??60)*.03))*(b.level??1);}
export const POWER_USE=Object.freeze({farm:2,culture:2,cooler:2,repair:1,automation:3,security:1,theater:2,lab:1,extractor:1,chemical:1,gate:1});
export const BASE_POWER=3; // scavenged car batteries
/** Settles one day: upkeep, power supply/demand (generators burn 1 fuel each), unpowered buildings. */
export function dailyInfrastructure(world,inv){
 const bs=(world.buildings??[]).filter(b=>conn(world,b));let labIdx=0;const lines=[];let upkeep=0;
 for(const b of bs){const c=upkeepOf(b,b.kind==='lab'?labIdx++:0);if(c){upkeep+=c;lines.push({id:b.id,name:b.name,cost:c});}}
 let fuel=inv.fuel??0,batt=inv.batteries??0,supply=BASE_POWER,fuelUsed=0,battUsed=0;
 for(const g of bs.filter(b=>b.kind==='generator')){if(fuel>0){fuel--;fuelUsed++;supply+=6*(g.level??1);}else if(batt>0){batt--;battUsed++;supply+=6*(g.level??1);}}
 let demand=0;const unpowered=new Set();
 // newest buildings lose power first when demand exceeds supply
 for(const b of bs){const u=(POWER_USE[b.kind]??0)*(b.level??1);if(!u)continue;if(demand+u<=supply)demand+=u;else unpowered.add(b.id);}
 const totalDemand=bs.reduce((n,b)=>n+(POWER_USE[b.kind]??0)*(b.level??1),0);
 return {upkeep,lines,supply,demand:totalDemand,unpowered,fuelUsed,battUsed};}
// ---- ration counter range
export const SHOP_RANGE=8;
const rectDist=(a,b)=>Math.max(0,a.x-(b.x+b.w-1),b.x-(a.x+a.w-1))+Math.max(0,a.y-(b.y+b.h-1),b.y-(a.y+a.h-1));
export function shopDistance(world,home){const shops=(world.buildings??[]).filter(b=>b.kind==='shop'&&conn(world,b));if(!shops.length)return Infinity;return Math.min(...shops.map(s=>rectDist(home,s)));}
export function inShopRange(world,home){return shopDistance(world,home)<=SHOP_RANGE;}
export function shopRangeTiles(world,size){const out=new Set();const shops=(world.buildings??[]).filter(b=>b.kind==='shop');
 for(let x=0;x<size;x++)for(let y=0;y<size;y++)if(shops.some(s=>rectDist({x,y,w:1,h:1},s)<=SHOP_RANGE))out.add(x+','+y);return out;}
// ---- synergies between neighbouring facilities (touching, or one corridor tile apart)
export const SYNERGIES=Object.freeze([
 {a:'kitchen',b:'pantry',good:true,label:'食材がすぐ手に入る',effect:'food',n:1,text:'食料+1/日'},
 {a:'lab',b:'archives',good:true,label:'資料がすぐ引ける',effect:'research',n:1,text:'研究pt+1'},
 {a:'lab',b:'extractor',good:true,label:'試料をすぐ分析できる',effect:'research',n:1,text:'研究pt+1'},
 {a:'mushroom',b:'water',good:true,label:'水やりが楽',effect:'food',n:1,text:'食料+1/日'},
 {a:'farm',b:'water',good:true,label:'水やりが楽',effect:'food',n:2,text:'食料+2/日'},
 {a:'home',b:'lounge',good:true,label:'くつろげる',effect:'impulse',n:-1,text:'住民の衝動−1/日'},
 {a:'home',b:'theater',good:true,label:'映画が近い',effect:'impulse',n:-1,text:'住民の衝動−1/日'},
 {a:'wash',b:'cooler',good:true,label:'ケアの動線が良い',effect:'decay',n:-1,text:'全員の腐敗−1/日'},
 {a:'workshop',b:'storage',good:true,label:'資材がすぐ届く',effect:'goods',n:1,text:'部品+1/日'},
 {a:'security',b:'exit',good:true,label:'出入口を見張れる',effect:'alert',n:-1,text:'警戒−1/日'},
 {a:'gate',b:'exit',good:true,label:'入口を固められる',effect:'defense',n:4,text:'防衛力+4'},
 {a:'home',b:'generator',good:false,label:'騒音で眠れない',effect:'impulse',n:2,text:'住民の衝動+2/日'},
 {a:'home',b:'sorting',good:false,label:'ゴミの臭いがする',effect:'alert',n:1,text:'警戒+1/日'},
 {a:'home',b:'recycler',good:false,label:'機械がうるさい',effect:'impulse',n:1,text:'住民の衝動+1/日'},
 {a:'kitchen',b:'wash',good:false,label:'衛生が心配',effect:'food',n:-1,text:'食料−1/日'},
 {a:'lab',b:'generator',good:false,label:'振動で実験が乱れる',effect:'research',n:-1,text:'研究pt−1'}
]);
const near=(a,b)=>rectDist(a,b)<=1&&a!==b;
export function activeSynergies(world){const bs=(world.buildings??[]).filter(b=>conn(world,b)),out=[];
 for(const s of SYNERGIES)for(const A of bs.filter(b=>b.kind===s.a))for(const B of bs.filter(b=>b.kind===s.b))if(near(A,B))out.push({...s,from:A.id,to:B.id});
 // one pair of kinds counts once per building of kind a
 const seen=new Set();return out.filter(x=>{const k=x.a+x.b+x.from;if(seen.has(k))return false;seen.add(k);return true;});}
export function synergyTotals(world){const t={food:0,research:0,impulse:0,decay:0,goods:0,alert:0,defense:0};for(const s of activeSynergies(world))t[s.effect]+=s.n;return t;}
export function synergiesFor(world,b){return activeSynergies(world).filter(s=>s.from===b.id||s.to===b.id);}
/** Preview for a building about to be placed at rect r: which synergies it would create. */
export function previewSynergies(world,kind,r){const bs=(world.buildings??[]),out=[];
 for(const s of SYNERGIES){const other=s.a===kind?s.b:s.b===kind?s.a:null;if(!other)continue;if(bs.some(b=>b.kind===other&&near(r,b)))out.push(s);}return out;}
