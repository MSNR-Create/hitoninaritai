// v2.0-A production chain (ZDL-SD-021 §7, first slice):
// 夜間回収 → 未選別回収物 → 回収物選別台 → 有機残渣＋実験廃材 → 研究試料抽出装置 → 研究試料
// Inputs are consumed before outputs appear; missing inputs = no batch, nothing consumed.
export const FACILITIES=Object.freeze({
 pantry:{name:'食料庫',size:[2,2],cost:90,tech:null,desc:'食料の保管枠+40'},
 storage:{name:'資材置き場',size:[3,2],cost:110,tech:null,desc:'資材（生活用品・嗜好品・研究資材・回収物など）の保管枠+60'},
 wash:{name:'簡易洗浄台',size:[2,2],cost:70,tech:'sanitation',desc:'毎朝2人まで腐敗−8・臭気ケア（衛生用品1/人）'},
 sorting:{name:'回収物選別台',size:[2,2],cost:90,tech:null,desc:'素材加工担当が 回収物2 → 有機残渣1＋実験廃材1（1G）'},
 extractor:{name:'研究試料抽出装置',size:[3,2],cost:170,tech:'research_base',desc:'素材加工担当が 有機残渣2＋実験廃材1 → 研究試料1（3G）'},
 mushroom:{name:'地下キノコ栽培室',size:[3,2],cost:145,tech:'mycology',desc:'培地2→キノコ4を栽培'},
 kitchen:{name:'地下調理場',size:[2,2],cost:125,tech:'cooking',desc:'キノコ・食材を保存食へ加工'},
 lounge:{name:'娯楽ホール',size:[3,2],cost:180,tech:'leisure',desc:'嗜好品と交流によりストレス軽減'},
 cooler:{name:'低温保存室',size:[2,3],cost:230,tech:'refrigeration',desc:'住民の腐敗を毎朝抑える'},
 generator:{name:'小型発電所',size:[2,2],cost:155,tech:'electricity',desc:'高度な加工施設の電源を供給'},
 recycler:{name:'資材再生工房',size:[3,2],cost:190,tech:'recycling',desc:'ジャンク部品と建設資材を製造'},
 chemical:{name:'薬品合成室',size:[2,2],cost:270,tech:'chemistry',desc:'消臭液と洗浄用品を生産'},
 disguise:{name:'偽装メイク工房',size:[2,2],cost:185,tech:'camouflage',desc:'潜伏用の化粧品を生産'},
 culture:{name:'培養研究槽',size:[3,3],cost:390,tech:'bioculture',desc:'研究試料を増殖'},
 farm:{name:'地下水耕農園',size:[3,3],cost:340,tech:'hydroponics',desc:'栽培用培地・野菜を生産'},
 repair:{name:'身体修復室',size:[3,2],cost:320,tech:'regeneration',desc:'ゾンビの腐敗を重点ケア'},
 theater:{name:'地下シアター',size:[3,2],cost:245,tech:'entertainment',desc:'娯楽メディアを活用する娯楽施設'},
 workshop:{name:'機械組立室',size:[3,2],cost:330,tech:'mechanization',desc:'電子部品と精密工具を生産'},
 automation:{name:'自動仕分けセンター',size:[3,3],cost:460,tech:'sorting_ai',desc:'回収物の加工を自動化'},
 water:{name:'浄水設備',size:[2,2],cost:135,tech:'watercycle',desc:'汚水を再生水へ加工'},
 security:{name:'防音・警備室',size:[2,2],cost:225,tech:'soundproof',desc:'地下の騒音と警戒リスクを抑える'},
 archives:{name:'地下図書館',size:[3,2],cost:200,tech:'archives_research',desc:'住民の文化生活と研究拠点'}
});
export const RECIPES=Object.freeze({
 sort:{facility:'sorting',in:{salvage:2},out:{residue:1,labwaste:1},fee:1,name:'選別'},
 extract:{facility:'extractor',in:{residue:2,labwaste:1},out:{samples:1},fee:3,name:'試料抽出'},
 mushroom_crop:{facility:'mushroom',in:{compost:2},out:{mushrooms:4},fee:2,name:'キノコ栽培'},
 food_prep:{facility:'kitchen',in:{mushrooms:3},out:{food:6},fee:2,name:'キノコ定食'},
 food_preserve:{facility:'kitchen',in:{vegetables:2,mushrooms:1},out:{food:7},fee:3,name:'保存食加工'},
 composting:{facility:'recycler',in:{residue:2},out:{compost:3},fee:1,name:'培地生成'},
 parts:{facility:'recycler',in:{salvage:3},out:{parts:2,labwaste:1},fee:2,name:'ジャンク解体'},
 medicinal:{facility:'chemical',in:{labwaste:2,water:1},out:{cleaner:3},fee:5,name:'洗浄液合成'},
 care_prep:{facility:'chemical',in:{cleaner:2},out:{care:3},fee:3,name:'衛生用品製造'},
 makeup_prep:{facility:'disguise',in:{cleaner:1,parts:1},out:{makeup:2},fee:3,name:'偽装クリーム調合'},
 media_prep:{facility:'archives',in:{paper:2},out:{media:2},fee:1,name:'娯楽メディア編集'},
 scrap_to_paper:{facility:'recycler',in:{salvage:2},out:{paper:3},fee:1,name:'紙資源再生'},
 water_purify:{facility:'water',in:{residue:1},out:{water:3},fee:2,name:'再生水精製'},
 vegetables:{facility:'farm',in:{water:2,compost:1},out:{vegetables:4},fee:3,name:'水耕栽培'},
 sample_culture:{facility:'culture',in:{samples:1,water:1,compost:1},out:{samples:3},fee:6,name:'研究試料培養'},
 circuit:{facility:'workshop',in:{parts:2,labwaste:1},out:{circuits:1},fee:4,name:'電子基板組立'},
 battery:{facility:'workshop',in:{circuits:1,fuel:1},out:{batteries:2},fee:3,name:'蓄電池組立'},
 toolkit:{facility:'workshop',in:{parts:2,circuits:1},out:{toolkit:1},fee:5,name:'精密工具組立'},
 recreation:{facility:'lounge',in:{media:1,sweets:1},out:{luxury:3},fee:2,name:'娯楽セット準備'},
 fuel_refine:{facility:'recycler',in:{residue:2},out:{fuel:2},fee:2,name:'燃料精製'},
 sweets_prep:{facility:'kitchen',in:{vegetables:2},out:{sweets:3},fee:3,name:'菓子製造'}
});
export const ITEM_NAMES=Object.freeze({salvage:'未選別回収物',residue:'有機残渣',labwaste:'実験廃材',samples:'研究試料',mushrooms:'地下キノコ',vegetables:'地下野菜',compost:'培養用培地',parts:'ジャンク部品',cleaner:'洗浄液',makeup:'偽装クリーム',media:'娯楽メディア',paper:'再生紙',water:'再生水',circuits:'電子基板',toolkit:'精密工具',fuel:'精製燃料',sweets:'お菓子',coffee:'コーヒー',spices:'調味料',batteries:'バッテリー'});
export const SALVAGE_PACK={qty:2,price:5};
const can=(inv,need)=>Object.entries(need).every(([k,v])=>(inv[k]??0)>=v);
/**
 * workers: [{name, bonus}] residents on 'process' job. facilities: {sorting:n, extractor:n} (connected).
 * Each worker runs one batch per night, preferring the extractor (later stage) so the chain flows.
 */
export function runProduction(inventory,money,workers,facilities,plan='auto',caps=null){
 const inv={salvage:0,residue:0,labwaste:0,...inventory};let cash=money;const log=[];
 const slots=Object.fromEntries(Object.values(RECIPES).map(r=>[r.facility,facilities[r.facility]??0]));
 const priorities=['extract','sample_culture','food_prep','food_preserve','care_prep','mushroom_crop','vegetables','composting','parts','medicinal','makeup_prep','recreation','sweets_prep','water_purify','circuit','toolkit','battery','fuel_refine','media_prep','scrap_to_paper','sort'];
 for(const w of workers){
  const runs=1+(w.extra?1:0);
  for(let i=0;i<runs;i++){
   const candidates=plan==='auto'?priorities:[plan];
   const pick=candidates.find(id=>{const r=RECIPES[id];if(!r||!slots[r.facility]||!can(inv,r.in)||cash<r.fee)return false;
    if(!caps)return true;const next={...inv};for(const [k,v] of Object.entries(r.in))next[k]-=v;for(const [k,v] of Object.entries(r.out))next[k]=(next[k]??0)+v;const goods=Object.entries(next).reduce((n,[k,v])=>n+(k==='food'?0:v),0);return (next.food??0)<=caps.food&&goods<=caps.goods;});
   if(!pick){log.push({worker:w.name,ok:false,reason:Object.values(slots).every(n=>n===0)?'加工施設がありません':'材料・処理費・空き容量が不足'});break;}
   const r=RECIPES[pick];for(const [k,v] of Object.entries(r.in))inv[k]-=v;for(const [k,v] of Object.entries(r.out))inv[k]=(inv[k]??0)+v;cash-=r.fee;slots[r.facility]--;
   log.push({worker:w.name,ok:true,recipe:pick,name:r.name,out:r.out,fee:r.fee});
  }
 }
 return {inventory:inv,money:cash,fees:money-cash,log};
}
