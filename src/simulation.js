import { workEfficiency, canGoOutside, hasTrait, OUTSIDE } from './colonists.js';
// Headless deterministic simulation. 1 tick = 1 game second; 120 ticks/day.
// v2.4 part-time jobs: pay shown as hourly wage × shift hours; some unlock by level / stats.
export const SHIFT_HOURS=6;
export const JOBS=Object.freeze({
  clean:{name:'夜間清掃',icon:'🧹',wage:3,pay:18,food:0,fatigue:15,exposure:1},
  warehouse:{name:'倉庫整理',icon:'📦',wage:5,pay:30,food:0,fatigue:27,exposure:3,req:{stats:{str:3}}},
  konbini:{name:'コンビニ深夜',icon:'🏪',wage:6,pay:36,food:0,fatigue:18,exposure:3,req:{level:2,stats:{soc:3}}},
  delivery:{name:'配送仕分け',icon:'🚚',wage:7,pay:42,food:0,fatigue:24,exposure:2,req:{level:3,stats:{dex:4}}},
  guard:{name:'夜間警備',icon:'🔦',wage:8,pay:48,food:0,fatigue:14,exposure:2,req:{level:4,stats:{str:3,res:4}}},
  labassist:{name:'研究所の夜間補助',icon:'🧑‍🔬',wage:10,pay:60,food:0,fatigue:10,exposure:1,req:{level:5,stats:{int:5}}},
  forage:{name:'食料調達',icon:'🍎',pay:0,food:5,fatigue:18,exposure:2},
  salvage:{name:'夜間回収',icon:'🗑️',pay:0,food:0,fatigue:10,exposure:1,salvage:2},
  shopping:{name:'買い出し',icon:'🛒',pay:0,food:0,fatigue:8,exposure:1,shopping:1},
  research:{name:'地下研究',icon:'🧪',pay:0,food:0,fatigue:8,exposure:0},
  process:{name:'素材加工',icon:'🏭',pay:0,food:0,fatigue:8,exposure:0},
  rest:{name:'休息',icon:'🛌',pay:0,food:0,fatigue:-30,exposure:0},
  auto:{name:'夜の稼ぎはおまかせ',icon:'🌙',pay:0,food:0,fatigue:0,exposure:0},
  autoin:{name:'巣穴のお手伝い',icon:'🕯️',pay:0,food:0,fatigue:0,exposure:0}
});
const STAT_LABEL={str:'腕力',dex:'器用',int:'知性',soc:'社交',res:'耐腐敗'};
export function jobEligible(r,id){const req=JOBS[id]?.req;if(!req||!r.level)return true;if((req.level??1)>(r.level??1))return false;return Object.entries(req.stats??{}).every(([k,v])=>(r.stats?.[k]??2)>=v);}
export function jobReqText(id){const req=JOBS[id]?.req;if(!req)return '';return [req.level?`Lv${req.level}`:null,...Object.entries(req.stats??{}).map(([k,v])=>`${STAT_LABEL[k]}${v}`)].filter(Boolean).join('・');}
export const PAID_JOBS=['labassist','guard','delivery','konbini','warehouse','clean'];
export const clamp100=n=>Math.max(0,Math.min(100,n));
const initResidents=[['モグ','clean'],['ロロ','warehouse'],['ネム','forage'],['ミミ','clean'],['シャチク','warehouse']];
export function initialGame(){return {tick:0,day:1,money:300,food:12,alert:15,lastReport:null,events:[],residents:initResidents.map(([name,job],i)=>({id:i+1,name,job,activeJob:'rest',fatigue:i===4?40:20,impulse:12,previousImpulse:12,action:'休息中',strikeDays:0,wellDays:0,relationship:0}))};}
// Deterministic AI priority: survival > communal shortages > safe income.
export function chooseAutoJob(resident,state){
 if(resident.strikeDays>0 || resident.fatigue>=65 || resident.impulse>=70)return 'rest';
 if(resident.level&&!canGoOutside(resident))return 'rest';
 if(state.food<state.residents.length*2)return 'forage';
 const ok=(resident.level?PAID_JOBS:['warehouse','clean']).filter(id=>jobEligible(resident,id));
 if(resident.fatigue>=40)return ok.slice().sort((a,b)=>JOBS[a].fatigue-JOBS[b].fatigue)[0]??'clean';
 if(state.money>=80&&resident.id%3===0)return 'forage';
 return ok[0]??'clean';
}
export function stepGame(old){
  const s={...old,residents:old.residents.map(r=>({...r})),events:old.events.slice(-12)};
  s.tick++;
  const clock=s.tick%120;
  if(clock===60){
    for(const r of s.residents){
      // Lock job at night start. Mid-shift assignment changes affect NEXT night.
      if(r.strikeDays>0){r.activeJob='rest';r.action='ストライキ中';}
      else {r.activeJob=r.fatigue>=85?'rest':r.job==='autoin'?'rest':r.job==='auto'?chooseAutoJob(r,s):(jobEligible(r,r.job)?r.job:'clean');
      if(r.level&&OUTSIDE.has(r.activeJob)&&!canGoOutside(r)){r.activeJob='rest';r.action='腐敗・臭気で外勤不可';continue;}
      r.action=r.activeJob==='rest'?'休息中':'出勤中';}
    }
    // v2.5: お任せ（内部作業） fills facility staff slots by stats (int→research, dex→process).
    {const slots={...(s.internalSlots??{process:0,research:0})};for(const r of s.residents)if(r.job!=='autoin'&&(r.activeJob==='process'||r.activeJob==='research'))slots[r.activeJob]=(slots[r.activeJob]??0)-1;
     const pool=s.residents.filter(r=>r.job==='autoin'&&r.strikeDays===0&&r.fatigue<70);const st=(r,k)=>r.stats?.[k]??2;
     for(const [job,stat] of [['research','int'],['process','dex']]){pool.sort((a,b)=>st(b,stat)-st(a,stat));
      while((slots[job]??0)>0){const r=pool.find(x=>x.activeJob==='rest');if(!r)break;r.activeJob=job;r.action='出勤中';slots[job]--;}}
     for(const r of pool)if(r.activeJob==='rest')r.action='待機（空きポストなし）';}
    // v2.4: shopping list needs carriers — auto residents switch to 買い出し (3 packs each).
    {let need=Math.ceil((s.shoppingPacks??0)/3)-s.residents.filter(r=>r.activeJob==='shopping').length;
     for(const r of s.residents){if(need<=0)break;if(r.job==='auto'&&r.activeJob!=='rest'&&r.activeJob!=='forage'&&(!r.level||canGoOutside(r))){r.activeJob='shopping';r.action='出勤中';need--;}}}
    s.events.push(`第${s.day}日 夜：仕事と調達を開始`);
  }
  if(clock===74)for(const r of s.residents)if(r.activeJob!=='rest')r.action='地上へ移動';
  if(clock===80)for(const r of s.residents)if(r.activeJob!=='rest')r.action=r.activeJob==='forage'?'食料調達中':'外部勤務中';
  if(clock===112)for(const r of s.residents)if(r.activeJob!=='rest')r.action='帰還中';
  if(clock===0){
    let income=0,harvest=0,exposure=0,salvage=0,shoppers=0;
    for(const r of s.residents){
      const job=JOBS[r.activeJob];
      const m=s.mods??{};
      const eff=r.level?workEfficiency(r,r.activeJob):1;
      income+=Math.round(job.pay*(m.payMul??1)*eff);harvest+=job.food;salvage+=job.salvage??0;shoppers+=job.shopping??0;
      exposure+=job.exposure>0?Math.max(0,job.exposure-(m.exposureCut??0)-(hasTrait(r,'friendly')?1:0)):0;
      const traitFat=job.fatigue>0&&OUTSIDE.has(r.activeJob)?(hasTrait(r,'nocturnal')?.85:1)*(hasTrait(r,'timid')?1.1:1):1;
      r.fatigue=clamp100(r.fatigue+(job.fatigue>0?Math.round(job.fatigue*(m.fatigueMul??1)*traitFat):job.fatigue));
      // An exhausted worker is off-duty until recovered; partial daytime recovery cannot cancel a strike.
      if(r.fatigue>=95 && r.strikeDays===0)r.strikeDays=2;
      else if(r.strikeDays>0){r.strikeDays--;if(r.fatigue>55)r.strikeDays=Math.max(1,r.strikeDays);}
      r.action=r.strikeDays>0?'ストライキ中':'帰宅中';
    }
    const eaten=0; // Communal distribution is handled by advanceColony once per day.
    s.money+=income;s.food+=harvest;
    // v2.5 balance: exposure counts half; alert also cools by 10% of its level each day.
    // v3.0: alert drifts toward a baseline set by tonight's exposure, plus daily rumor noise — it lives in the middle range
    // and spikes with incidents instead of pinning at 0 or 100.
    {const base=6+exposure*2.2;const noise=(((s.day*2654435761)>>>0)%9)-3;
     s.alert=clamp100(Math.round(s.alert+(base-s.alert)*.22+noise-((s.mods??{}).alertDecay??0)));}
    s.lastReport={day:s.day,income,harvest,salvage,shoppers,eaten,exposure,food:s.food,money:s.money};
    s.events.push(`第${s.day}日 朝：収入+${income}G、調達+${harvest}、調達品は共同倉庫へ`);
    s.day++;
  }
  if(clock===13)for(const r of s.residents)r.action=r.strikeDays>0?'ストライキ中':'休息中';
  if(clock===43){for(const r of s.residents){r.fatigue=clamp100(r.fatigue-(r.strikeDays>0?16:12)-((s.mods??{}).restBonus??0));r.action=r.strikeDays>0?'ストライキ中':'地下で生活';}}
  return s;
}
export function assignJob(state,id,job){
  if(!JOBS[job])throw new Error('Unknown job');
  if(!state.residents.some(r=>r.id===id))throw new Error('Unknown resident');
  return {...state,residents:state.residents.map(r=>r.id===id?{...r,job}:r)};
}
export function moodOf(state){const avg=state.residents.reduce((a,r)=>a+(100-r.fatigue),0)/Math.max(1,state.residents.length);return Math.round(clamp100(avg-(state.food===0?25:0)));}
