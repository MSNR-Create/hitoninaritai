// v2.1 production engine. Data lives in catalog.js.
// Rules: inputs are consumed before outputs appear; a batch that can't fully run consumes nothing;
// outputs that wouldn't fit in storage block the batch (never destroy stock).
import { FACILITY_DEFS, RECIPES as CAT_RECIPES, ITEMS } from './catalog.js';
export const FACILITIES=Object.freeze(Object.fromEntries(Object.entries(FACILITY_DEFS).filter(([k])=>!['home','shop','lab'].includes(k)).map(([k,f])=>[k,{name:f.name,size:f.size,cost:f.cost,tech:f.tech,desc:f.desc}])));
export const RECIPES=CAT_RECIPES;
export const ITEM_NAMES=Object.freeze(Object.fromEntries(Object.entries(ITEMS).map(([k,v])=>[k,v.name])));
export const SALVAGE_PACK={qty:2,price:5};
const can=(inv,need)=>Object.entries(need).every(([k,v])=>(inv[k]??0)>=v);
const AUTO_RECIPES=['parts','sort','scrap_to_paper'];
/**
 * workers: [{name, extra}] residents on 'process'. facilities: {kind: connectedCount}.
 * opts: {prefs:{kind:recipeId|'auto'}, caps:{food,goods}, goodsTotal(inv), mods:{kitchenBonus, compostBonus}}
 */
export function runProduction(inventory,money,workers,facilities,opts={}){
 const inv={...inventory};let cash=money;const log=[];const prefs=opts.prefs??{},mods=opts.mods??{};
 const slots={...facilities};
 // power: each generator gives 3 powered batches if it can burn 1 fuel (or 1 battery)
 let power=0,fuelBurned=false;const gens=facilities.generator??0;
 const hasFuel=()=>gens>0&&!fuelBurned&&((inv.fuel??0)>0||(inv.batteries??0)>0);
 const powerUp=()=>{if(power>0)return true;if(!hasFuel())return false;
  if((inv.fuel??0)>=1)inv.fuel--;else inv.batteries--;
  fuelBurned=true;power=3*gens;log.push({worker:'⚡発電所',ok:true,name:'発電',out:{},fee:0});return true;};
 const goodsDelta=r=>Object.entries(r.out).filter(([k])=>k!=='food').reduce((s,[,v])=>s+v,0)-Object.entries(r.in).filter(([k])=>k!=='food').reduce((s,[,v])=>s+v,0);
 const fits=r=>{if(!opts.caps)return true;const food=r.out.food??0;if(food&&(inv.food??0)+food>opts.caps.food)return false;const d=goodsDelta(r);return d<=0||opts.goodsTotal(inv)+d<=opts.caps.goods;};
 const powered=r=>!r.power||power>0||hasFuel();
 const runnable=id=>{const r=CAT_RECIPES[id];return (slots[r.facility]??0)>0&&can(inv,r.in)&&cash>=r.fee&&fits(r)&&powered(r);};
 const order=Object.keys(CAT_RECIPES).filter(id=>{const p=prefs[CAT_RECIPES[id].facility];return !p||p==='auto'||p===id;});
 let curB=null;const exec=(id,who)=>{const r=CAT_RECIPES[id];if(r.power&&!powerUp())return false;if(r.power)power--;
  for(const [k,v] of Object.entries(r.in))inv[k]-=v;const out={...r.out};
  if(r.facility==='kitchen'&&out.food){if((inv.spices??0)>=1){inv.spices--;out.food+=2;}out.food+=mods.kitchenBonus??0;}
  if(id==='composting')out.compost+=mods.compostBonus??0;
  for(const [k,v] of Object.entries(out))inv[k]=(inv[k]??0)+v;cash-=r.fee;slots[r.facility]--;
  log.push({worker:who,ok:true,recipe:id,name:r.name,out,fee:r.fee,building:curB});return true;};
 for(const w of workers){
  const runs=1+(w.extra?1:0);curB=w.building??null;
  for(let i=0;i<runs;i++){
   // v2.5: a worker posted to a facility runs only that facility's chosen recipe (or any of its recipes on おまかせ).
   const ok=id=>{const r=CAT_RECIPES[id];return can(inv,r.in)&&cash>=r.fee&&fits(r)&&powered(r);};
   const id=w.facility?Object.keys(CAT_RECIPES).filter(x=>CAT_RECIPES[x].facility===w.facility&&(!w.recipe||w.recipe==='auto'||w.recipe===x)).find(ok):order.find(runnable);
   if(!id||!exec(id,w.name)){log.push({worker:w.name,ok:false,building:curB,reason:w.facility?'材料・処理費・電力・置き場のいずれかが不足':Object.values(slots).every(v=>!v)?'加工施設がありません':'材料・処理費・電力・置き場のいずれかが不足'});break;}}
 }
 // automation centres: 2 unattended batches each (powered)
 for(let a=0;a<(facilities.automation??0)*2;a++){
  const id=AUTO_RECIPES.find(x=>{const r=CAT_RECIPES[x];return can(inv,r.in)&&cash>=r.fee&&fits(r)&&(power>0||hasFuel());});
  if(!id||!powerUp())break;power--;const r=CAT_RECIPES[id];
  for(const [k,v] of Object.entries(r.in))inv[k]-=v;for(const [k,v] of Object.entries(r.out))inv[k]=(inv[k]??0)+v;cash-=r.fee;
  log.push({worker:'🤖自動仕分け',ok:true,recipe:id,name:r.name,out:r.out,fee:r.fee});}
 return {inventory:inv,money:cash,fees:money-cash,log};
}
