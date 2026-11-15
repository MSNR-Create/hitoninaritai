// Deterministic communal provisioning and first research milestone.
export const SUPPLIES=Object.freeze({food:{name:'食料',price:7,pack:5},care:{name:'生活用品',price:12,pack:3},luxury:{name:'嗜好品',price:20,pack:2},samples:{name:'研究資材',price:24,pack:1}});
export const STAGE2_DAY=10,INCIDENT_COST=30;
export const RESEARCH=Object.freeze({id:'impulse',name:'衝動抑制',cost:60,samples:2,work:3});
const cap=n=>Math.max(0,Math.min(100,n));
export function initialColony(){return {inventory:{food:15,care:6,luxury:0,samples:0},stage:1,completedResearch:[],research:{progress:0,started:false},incidentCount:0,lossCount:0,conversionCount:0,nextResidentId:6,report:null};}
export function buySupply(colony,money,id,packs=1,mods={}){const s=SUPPLIES[id];if(!s||!Number.isInteger(packs)||packs<1||packs>20)return {ok:false,reason:'仕入れ内容が不正です'};const total=Math.ceil(s.price*(mods.supplyMul??1))*packs;const pack=id==='food'?(mods.foodPack??s.pack):s.pack;if(money<total)return {ok:false,reason:`資金不足（必要${total}G）`};return {ok:true,money:money-total,colony:{...colony,inventory:{...colony.inventory,[id]:colony.inventory[id]+pack*packs}},cost:total,quantity:pack*packs};}
export function beginResearch(colony,money,hasLab){if(!hasLab)return {ok:false,reason:'通路に接続した研究室が必要です'};if(colony.completedResearch.includes(RESEARCH.id))return {ok:false,reason:'研究完了済みです'};if(colony.research.started)return {ok:false,reason:'研究中です'};if(money<RESEARCH.cost||colony.inventory.samples<RESEARCH.samples)return {ok:false,reason:`研究費${RESEARCH.cost}G・研究資材${RESEARCH.samples}個が必要です`};return {ok:true,money:money-RESEARCH.cost,colony:{...colony,inventory:{...colony.inventory,samples:colony.inventory.samples-RESEARCH.samples},research:{progress:0,started:true}}};}
// Exactly once per game-day boundary. Day-to-day supply shortage persists per resident.
export function advanceColony(game,colony,hasLab,capacity=5,mods={}){
 let residents=game.residents.map(r=>({...r}));const inventory={...colony.inventory};const stage=(game.day>=STAGE2_DAY||colony.completedResearch.length>0)?2:1;let shortage=0;
 let careConsumed=0,luxuryConsumed=0;
 for(const r of residents){
  const fed=inventory.food>0;if(fed)inventory.food--; else shortage++;
  const needsCare=stage>=2 && (r.id%2===0);const cared=!needsCare||inventory.care>0;if(needsCare&&cared){inventory.care--;careConsumed++}
  const wantsLuxury=stage>=2 && r.id===5;const indulged=!wantsLuxury||inventory.luxury>0;if(wantsLuxury&&indulged){inventory.luxury--;luxuryConsumed++}
  const relief=mods.impulseRelief??(colony.completedResearch.includes('impulse')?12:0);
  const delta=(fed?-10-(mods.fedRelief??0):28)+(cared?-3:15)+(indulged?-2:Math.round(10*(mods.luxuryPenaltyMul??1)))+Math.round(r.fatigue/30)-relief;
  r.impulse=cap((r.impulse??0)+delta);
  r.lastNeeds={food:fed,care:cared,luxury:indulged};
  const happy=fed&&cared&&indulged&&r.impulse<=25&&r.fatigue<=65;
  r.wellDays=happy?(r.wellDays??0)+1:0;
  if(!fed&&r.impulse>=65)r.strikeDays=Math.max(r.strikeDays??0,2);
 }
 let incidentCount=colony.incidentCount,lossCount=colony.lossCount??0,alert=game.alert,money=game.money;const newIncidents=[],deadIds=[];
 for(const r of residents){if(r.impulse>=90 && (r.previousImpulse??0)>=75){
   incidentCount++;alert=cap(alert+18);money=Math.max(0,money-INCIDENT_COST);newIncidents.push(r.name);
   // After prior warning, sustained high alert or repeated trouble can cause permanent loss.
   const fatal=(alert>=75 && (game.day+r.id)%3===0)||(r.incidentHistory??0)>=2;
   r.incidentHistory=(r.incidentHistory??0)+1;
   if(fatal){deadIds.push(r.id);lossCount++;}else{r.impulse=48;r.strikeDays=Math.max(r.strikeDays??0,1);}
  }r.previousImpulse=r.impulse;
 }
 residents=residents.filter(r=>!deadIds.includes(r.id));
 // Human-neighbor conversion is owned by Social; no anonymous spontaneous follower here.
 let newFollower=null,nextResidentId=colony.nextResidentId??6;
 const research=colony.research,completedResearch=[...colony.completedResearch],researchWork=0;
 const report={day:game.day-1,shortage,careConsumed,luxuryConsumed,incidentNames:newIncidents,deathNames:deadIds.map(id=>game.residents.find(r=>r.id===id)?.name).filter(Boolean),newFollowerName:newFollower?.name??null,researchWork,researchDone:false};
 return {game:{...game,money,alert,residents,events:[...game.events,...newIncidents.map(n=>`${n}による対人トラブルが発生`),...report.deathNames.map(n=>`${n}が人間との衝突で失われた`),...(newFollower?[`${newFollower.name}が仲間になった`]:[])].slice(-12)},colony:{...colony,inventory,stage,research,completedResearch,incidentCount,lossCount,conversionCount:(colony.conversionCount??0)+(newFollower?1:0),nextResidentId,report}};
}
