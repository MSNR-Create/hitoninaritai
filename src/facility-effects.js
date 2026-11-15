// v2.1 daily effects of non-production facilities (lounge, theater, cooler, repair, security,
// disguise items, coffee, sweets as special rations). Pure; consumes only what it uses.
import { odorOf } from './colonists.js';
export function dailyFacilityEffects(residents,inventory,counts,{outsideWorkers=0,stage=1}={}){
 const inv={...inventory};const notes=[];let alert=0;
 let rs=residents.map(r=>({...r}));const all=f=>{rs=rs.map(f);};
 const clamp=v=>Math.max(0,Math.min(100,v));
 for(let i=0;i<(counts.lounge??0);i++){if((inv.luxury??0)>=1){inv.luxury--;all(r=>({...r,impulse:clamp((r.impulse??0)-6)}));notes.push('🎲娯楽ホール：嗜好品で全員の衝動−6');}else{all(r=>({...r,impulse:clamp((r.impulse??0)-3)}));notes.push('🎲娯楽ホール：交流で全員の衝動−3');}}
 if((counts.theater??0)>0&&(inv.media??0)>=1){inv.media--;all(r=>({...r,impulse:clamp((r.impulse??0)-5),fatigue:clamp(r.fatigue-3)}));notes.push('🎬上映会：衝動−5・疲労−3');}
 if((inv.coffee??0)>=1&&rs.length){inv.coffee--;all(r=>({...r,fatigue:clamp(r.fatigue-4)}));notes.push('☕コーヒー：全員の疲労−4');}
 const relieve=(n,amount,costKey,label)=>{const order=[...rs].sort((a,b)=>(b.decay??0)-(a.decay??0));let done=0;
  for(const t of order){if(done>=n||(t.decay??0)<15)break;if(costKey){const key=(inv[costKey]??0)>0?costKey:(costKey==='cleaner'&&(inv.care??0)>0?'care':null);if(!key)break;inv[key]--;}
   rs=rs.map(r=>r.id===t.id?{...r,decay:Math.max(0,Math.round(((r.decay??0)-amount)*10)/10)}:r);done++;}
  if(done)notes.push(`${label}：${done}人`);};
 relieve((counts.cooler??0)*4,3,null,'❄️低温保存室で腐敗−3');
 relieve((counts.repair??0)*2,12,'cleaner','🩹身体修復室で腐敗−12');
 alert-=Math.min(2,counts.security??0);
 if(outsideWorkers>0&&(inv.makeup??0)>0){const used=Math.min(outsideWorkers,inv.makeup);inv.makeup-=used;alert-=Math.round(used*.5);notes.push(`💄偽装クリーム${used}個使用`);}
 // special ration: sweets stand in for luxury in stage 2 (2 sweets = 1 luxury)
 if(stage>=2&&(inv.luxury??0)<2&&(inv.sweets??0)>=2){const n=Math.floor(inv.sweets/2);inv.sweets-=n*2;inv.luxury=(inv.luxury??0)+n;notes.push(`🍬お菓子を嗜好品として配給（${n}）`);}
 rs=rs.map(r=>({...r,odor:odorOf(r)}));
 return {residents:rs,inventory:inv,alertDelta:alert,notes};
}
