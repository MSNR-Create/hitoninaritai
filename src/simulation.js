// Headless deterministic simulation. 1 tick = 1 game second; 120 ticks/day.
export const JOBS=Object.freeze({
  clean:{name:'夜間清掃',pay:18,food:0,fatigue:15,exposure:1},
  warehouse:{name:'倉庫整理',pay:30,food:0,fatigue:27,exposure:3},
  forage:{name:'食料調達',pay:0,food:5,fatigue:18,exposure:2},
  rest:{name:'休息',pay:0,food:0,fatigue:-30,exposure:0},
  research:{name:'地下研究',pay:0,food:0,fatigue:8,exposure:0},
  auto:{name:'お任せ',pay:0,food:0,fatigue:0,exposure:0}
});
export const clamp100=n=>Math.max(0,Math.min(100,n));
const initResidents=[['モグ','clean'],['ロロ','warehouse'],['ネム','forage'],['ミミ','clean'],['シャチク','warehouse']];
export function initialGame(){return {tick:0,day:1,money:300,food:12,alert:15,lastReport:null,events:[],residents:initResidents.map(([name,job],i)=>({id:i+1,name,job,activeJob:'rest',fatigue:i===4?40:20,impulse:12,previousImpulse:12,action:'休息中',strikeDays:0,wellDays:0,relationship:0}))};}
// Deterministic AI priority: survival > communal shortages > safe income.
export function chooseAutoJob(resident,state){
 if(resident.strikeDays>0 || resident.fatigue>=65 || resident.impulse>=70)return 'rest';
 if(state.food<state.residents.length*2)return 'forage';
 if(state.money<80)return resident.fatigue<40?'warehouse':'clean';
 if(resident.fatigue>=40)return 'clean';
 return resident.id%3===0?'forage':resident.id%2===0?'warehouse':'clean';
}
export function stepGame(old){
  const s={...old,residents:old.residents.map(r=>({...r})),events:old.events.slice(-12)};
  s.tick++;
  const clock=s.tick%120;
  if(clock===60){
    for(const r of s.residents){
      // Lock job at night start. Mid-shift assignment changes affect NEXT night.
      if(r.strikeDays>0){r.activeJob='rest';r.action='ストライキ中';}
      else {r.activeJob=r.fatigue>=85?'rest':r.job==='auto'?chooseAutoJob(r,s):r.job;
      r.action=r.activeJob==='rest'?'休息中':'出勤中';}
    }
    s.events.push(`第${s.day}日 夜：仕事と調達を開始`);
  }
  if(clock===74)for(const r of s.residents)if(r.activeJob!=='rest')r.action='地上へ移動';
  if(clock===80)for(const r of s.residents)if(r.activeJob!=='rest')r.action=r.activeJob==='forage'?'食料調達中':'外部勤務中';
  if(clock===112)for(const r of s.residents)if(r.activeJob!=='rest')r.action='帰還中';
  if(clock===0){
    let income=0,harvest=0,exposure=0;
    for(const r of s.residents){
      const job=JOBS[r.activeJob];
      income+=job.pay;harvest+=job.food;exposure+=job.exposure;
      r.fatigue=clamp100(r.fatigue+job.fatigue);
      // An exhausted worker is off-duty until recovered; partial daytime recovery cannot cancel a strike.
      if(r.fatigue>=95 && r.strikeDays===0)r.strikeDays=2;
      else if(r.strikeDays>0){r.strikeDays--;if(r.fatigue>55)r.strikeDays=Math.max(1,r.strikeDays);}
      r.action=r.strikeDays>0?'ストライキ中':'帰宅中';
    }
    const eaten=0; // Communal distribution is handled by advanceColony once per day.
    s.money+=income;s.food+=harvest;
    s.alert=clamp100(s.alert+exposure-3);
    s.lastReport={day:s.day,income,harvest,eaten,exposure,food:s.food,money:s.money};
    s.events.push(`第${s.day}日 朝：収入+${income}G、調達+${harvest}、調達品は共同倉庫へ`);
    s.day++;
  }
  if(clock===13)for(const r of s.residents)r.action=r.strikeDays>0?'ストライキ中':'休息中';
  if(clock===43){for(const r of s.residents){r.fatigue=clamp100(r.fatigue-(r.strikeDays>0?16:12));r.action=r.strikeDays>0?'ストライキ中':'地下で生活';}s.alert=clamp100(s.alert-2);}
  return s;
}
export function assignJob(state,id,job){
  if(!JOBS[job])throw new Error('Unknown job');
  if(!state.residents.some(r=>r.id===id))throw new Error('Unknown resident');
  return {...state,residents:state.residents.map(r=>r.id===id?{...r,job}:r)};
}
export function moodOf(state){const avg=state.residents.reduce((a,r)=>a+(100-r.fatigue),0)/Math.max(1,state.residents.length);return Math.round(clamp100(avg-(state.food===0?25:0)));}
