// v2.0-A colonist progression & body maintenance (ZDL-SD-020 §2–3, simplified first slice).
// Level 1–10 / XP / skill points / 5 stats / one strength + one weakness trait /
// decay (腐敗) and odor (臭気) with washing. Pure functions; deterministic.
export const STATS=Object.freeze({str:'腕力',dex:'器用',int:'知性',soc:'社交',res:'耐腐敗'});
export const LEVEL_XP=Object.freeze([0,60,150,280,450,670,940,1260,1640,2100]);
export const DAILY_XP_CAP=24;
export const TRAITS=Object.freeze({
 nocturnal:{name:'夜行性',good:true,desc:'夜勤の疲労−15%'},
 strong:{name:'力持ち',good:true,desc:'清掃・倉庫の報酬+15%'},
 dexterous:{name:'手先が器用',good:true,desc:'素材加工が1回多く動く確率+30%'},
 scholar:{name:'研究肌',good:true,desc:'研究進捗+15%'},
 friendly:{name:'人懐っこい',good:true,desc:'勤務時の露見リスク−1'},
 resilient:{name:'腐敗しにくい',good:true,desc:'腐敗進行−20%'},
 smelly:{name:'臭いやすい',good:false,desc:'臭気+12'},
 clumsy:{name:'不器用',good:false,desc:'倉庫報酬・素材加工−12%'},
 timid:{name:'怖がり',good:false,desc:'外勤の疲労+10%'},
 fragile:{name:'傷みやすい',good:false,desc:'腐敗進行+15%'}
});
const FIXED={1:['strong','smelly',{str:2,res:1}],2:['dexterous','timid',{dex:2,soc:1}],3:['scholar','clumsy',{int:3}],4:['friendly','fragile',{soc:2,dex:1}],5:['nocturnal','fragile',{str:1,res:2}]};
const GOOD=Object.keys(TRAITS).filter(k=>TRAITS[k].good),BAD=Object.keys(TRAITS).filter(k=>!TRAITS[k].good);
const STAT_KEYS=Object.keys(STATS);
const h=(n)=>{const x=Math.sin(n*99.13+7.7)*43758.5453;return x-Math.floor(x);};
/** Fill v2 fields on a v1 resident without touching fatigue/impulse/relationships. */
export function ensureColonist(r){
 if(r.level)return r;
 const f=FIXED[r.id];const good=f?f[0]:GOOD[Math.floor(h(r.id)*GOOD.length)],bad=f?f[1]:BAD[Math.floor(h(r.id+3)*BAD.length)];
 const bonus=f?f[2]:{[STAT_KEYS[Math.floor(h(r.id+5)*5)]]:2,[STAT_KEYS[Math.floor(h(r.id+9)*5)]]:1};
 const stats=Object.fromEntries(STAT_KEYS.map(k=>[k,Math.min(10,2+(bonus[k]??0))]));
 return {...r,level:1,xp:0,sp:0,stats,traits:[good,bad],decay:10+Math.floor(h(r.id+11)*9),fresh:0,odor:0,xpToday:0};
}
export const hasTrait=(r,t)=>(r.traits??[]).includes(t);
export function odorOf(r){return Math.max(0,Math.min(100,Math.round(.8*(r.decay??0)+(hasTrait(r,'smelly')?12:0)-(r.fresh??0))));}
export function decayStage(d){return d>=85?{name:'危機',eff:0,color:'#e05a4a'}:d>=65?{name:'重度',eff:.65,color:'#e08a4a'}:d>=45?{name:'中度',eff:.85,color:'#e0c04a'}:d>=25?{name:'軽度',eff:.95,color:'#c8d070'}:{name:'良好',eff:1,color:'#8ad08a'};}
/** Pay multiplier for a job given stats/traits/decay. */
export function workEfficiency(r,job){
 const s=r.stats??{};let m=decayStage(r.decay??0).eff;
 if(job==='clean')m*=1+.04*((s.str??2)-2)+(hasTrait(r,'strong')?.15:0);
 if(job==='konbini')m*=1+.04*((s.soc??2)-2);
 if(job==='delivery')m*=1+.04*((s.dex??2)-2);
 if(job==='guard')m*=1+.03*((s.str??2)-2);
 if(job==='labassist')m*=1+.05*((s.int??2)-2);
 if(job==='warehouse')m*=1+.04*((s.dex??2)-2)+(hasTrait(r,'strong')?.15:0)-(hasTrait(r,'clumsy')?.12:0);
 return Math.round(m*100)/100;
}
export function researchPower(r){return Math.round((1+.05*((r.stats?.int??2)-2)+(hasTrait(r,'scholar')?.15:0))*decayStage(r.decay??0).eff*100)/100;}
export const OUTSIDE=new Set(['clean','warehouse','forage','salvage','konbini','delivery','guard','labassist','shopping']);
/** Can this resident safely take an outside job tonight? */
export function canGoOutside(r){return (r.decay??0)<85&&odorOf(r)<70;}
export function levelOf(xp){let l=1;for(let i=0;i<LEVEL_XP.length;i++)if(xp>=LEVEL_XP[i])l=i+1;return Math.min(10,l);}
export function allocate(r,stat){if(!(r.sp>0))return {ok:false,reason:'スキルポイントがありません'};if(!STATS[stat])return {ok:false,reason:'不明な能力'};if(r.stats[stat]>=10)return {ok:false,reason:'この能力は上限10です'};
 return {ok:true,resident:{...r,sp:r.sp-1,stats:{...r.stats,[stat]:r.stats[stat]+1}}};}
/**
 * Daily body/progression update after the night shift.
 * ctx: {washSlots, care, decayRelief} → returns {residents, careUsed, alertAdd, levelUps, washed, notes}
 */
export function dailyColonists(residents,{washSlots=0,care=0,decayRelief=0}={}){
 let careLeft=care,alertAdd=0;const levelUps=[],washed=[];
 let next=residents.map(r0=>{const r={...ensureColonist(r0)};const job=r.activeJob??'rest';
  // XP
  const gain=job==='rest'?0:9;r.xp+=Math.min(gain,DAILY_XP_CAP);const lv=levelOf(r.xp);if(lv>r.level){r.sp+=lv-r.level;levelUps.push({name:r.name,level:lv});r.level=lv;}
  // decay
  const resist=Math.min(.4,.04*(r.stats.res-2));const traitMul=(hasTrait(r,'resilient')?.8:1)*(hasTrait(r,'fragile')?1.15:1);
  const load=job==='warehouse'?1.5:OUTSIDE.has(job)?.5:0;
  const inc=Math.max(0,Math.min(10,2*(1-resist)*traitMul+load-decayRelief));
  r.decay=Math.round(Math.min(100,r.decay+inc)*10)/10;r.fresh=Math.max(0,(r.fresh??0)-6);
  // odor → alert, only for residents who went outside
  if(OUTSIDE.has(job)){const o=odorOf(r);alertAdd+=o>=70?4:o>=50?1.5:o>=35?.5:0;}
  return r;});
 // washing: worst decay first, care 1 each
 const order=[...next].sort((a,b)=>b.decay-a.decay);
 for(const r of order){if(washSlots<=0||r.decay<15)break;washSlots--;const withCare=careLeft>0;if(withCare)careLeft--;washed.push(r.name+(withCare?'':'(水洗い)'));
  const amt=withCare?8:4;next=next.map(x=>x.id===r.id?{...x,decay:Math.max(0,Math.round((x.decay-amt)*10)/10),fresh:withCare?18:10}:x);}
 next=next.map(r=>({...r,odor:odorOf(r)}));
 return {residents:next,careUsed:care-careLeft,alertAdd:Math.min(12,Math.round(alertAdd)),levelUps,washed};
}
/** 手作業洗浄（救済）: care1 + 10G, decay −5, fresh +12. */
export function handWash(r,care,money){if(care<1||money<10)return {ok:false,reason:'衛生用品1個と10Gが必要です'};
 return {ok:true,care:care-1,money:money-10,resident:{...r,decay:Math.max(0,Math.round((r.decay-5)*10)/10),fresh:Math.max(r.fresh??0,12),odor:odorOf({...r,decay:Math.max(0,r.decay-5),fresh:12})}};}
