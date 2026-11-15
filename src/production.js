// v2.0-A production chain (ZDL-SD-021 §7, first slice):
// 夜間回収 → 未選別回収物 → 回収物選別台 → 有機残渣＋実験廃材 → 研究試料抽出装置 → 研究試料
// Inputs are consumed before outputs appear; missing inputs = no batch, nothing consumed.
export const FACILITIES=Object.freeze({
 pantry:{name:'食料庫',size:[2,2],cost:90,tech:null,desc:'食料の保管枠+40'},
 storage:{name:'資材置き場',size:[3,2],cost:110,tech:null,desc:'資材（生活用品・嗜好品・研究資材・回収物など）の保管枠+60'},
 wash:{name:'簡易洗浄台',size:[2,2],cost:70,tech:'sanitation',desc:'毎朝2人まで腐敗−8・臭気ケア（衛生用品1/人）'},
 sorting:{name:'回収物選別台',size:[2,2],cost:90,tech:null,desc:'素材加工担当が 回収物2 → 有機残渣1＋実験廃材1（1G）'},
 extractor:{name:'研究試料抽出装置',size:[3,2],cost:170,tech:'research_base',desc:'素材加工担当が 有機残渣2＋実験廃材1 → 研究試料1（3G）'}
});
export const RECIPES=Object.freeze({
 sort:{facility:'sorting',in:{salvage:2},out:{residue:1,labwaste:1},fee:1,name:'選別'},
 extract:{facility:'extractor',in:{residue:2,labwaste:1},out:{samples:1},fee:3,name:'試料抽出'}
});
export const ITEM_NAMES=Object.freeze({salvage:'未選別回収物',residue:'有機残渣',labwaste:'実験廃材',samples:'研究試料'});
export const SALVAGE_PACK={qty:2,price:5};
const can=(inv,need)=>Object.entries(need).every(([k,v])=>(inv[k]??0)>=v);
/**
 * workers: [{name, bonus}] residents on 'process' job. facilities: {sorting:n, extractor:n} (connected).
 * Each worker runs one batch per night, preferring the extractor (later stage) so the chain flows.
 */
export function runProduction(inventory,money,workers,facilities){
 const inv={salvage:0,residue:0,labwaste:0,...inventory};let cash=money;const log=[];
 const slots={sorting:facilities.sorting??0,extractor:facilities.extractor??0};
 for(const w of workers){
  const runs=1+(w.extra?1:0);
  for(let i=0;i<runs;i++){
   const pick=['extract','sort'].find(id=>{const r=RECIPES[id];return slots[r.facility]>0&&can(inv,r.in)&&cash>=r.fee;});
   if(!pick){log.push({worker:w.name,ok:false,reason:slots.sorting+slots.extractor===0?'加工施設がありません':'材料または処理費が不足'});break;}
   const r=RECIPES[pick];for(const [k,v] of Object.entries(r.in))inv[k]-=v;for(const [k,v] of Object.entries(r.out))inv[k]=(inv[k]??0)+v;cash-=r.fee;slots[r.facility]--;
   log.push({worker:w.name,ok:true,recipe:pick,name:r.name,out:r.out,fee:r.fee});
  }
 }
 return {inventory:inv,money:cash,fees:money-cash,log};
}
