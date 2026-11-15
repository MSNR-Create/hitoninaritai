// v1.9 data-driven research tree. Deterministic, headless, save-compatible with
// v1.8 ids ('impulse', 'adaptation'); the final node 'humanization' unlocks endings.
export const BRANCHES=Object.freeze({
  life:{name:'生活',icon:'🛏️'},
  work:{name:'労働',icon:'🧹'},
  build:{name:'建築',icon:'🏗️'},
  society:{name:'社会',icon:'🤝'},
  final:{name:'最終',icon:'🌅'}
});
// work = 研究ポイント。研究担当1体の夜勤で1pt×知性・特性補正、接続済み研究室2棟目以降は1棟につき+1pt（担当者がいる夜のみ）。
export const TECHS=Object.freeze([
  {id:'sanitation',name:'衛生管理Ⅰ',branch:'life',tier:1,req:[],cost:35,samples:1,work:2,desc:'簡易洗浄台が建設可能に。'},
  {id:'impulse',name:'衝動抑制',branch:'life',tier:1,req:[],cost:60,samples:2,work:4,desc:'全住民の衝動を毎日−12。'},
  {id:'sleep',name:'安眠カプセル',branch:'life',tier:2,req:['impulse'],cost:90,samples:2,work:6,desc:'昼の休養回復 +8。'},
  {id:'preserve',name:'防腐保存食',branch:'life',tier:2,req:['impulse'],cost:100,samples:2,work:6,desc:'食料の仕入れ量 1回5→8個。'},
  {id:'hobby',name:'地下サークル活動',branch:'life',tier:3,req:['sleep'],cost:140,samples:3,work:8,desc:'嗜好品が足りない日の衝動悪化を半減。'},
  {id:'shiftplan',name:'夜勤の段取り術',branch:'work',tier:1,req:[],cost:40,samples:1,work:3,desc:'夜勤報酬 +20%。'},
  {id:'stretch',name:'防腐ストレッチ',branch:'work',tier:2,req:['shiftplan'],cost:90,samples:2,work:6,desc:'勤務による疲労 −25%。'},
  {id:'makeup',name:'人間メイク術',branch:'work',tier:2,req:['shiftplan'],cost:120,samples:2,work:7,desc:'勤務1回の露見リスク −1。'},
  {id:'foreman',name:'現場リーダー制',branch:'work',tier:3,req:['stretch','makeup'],cost:220,samples:3,work:10,desc:'夜勤報酬 さらに +25%。'},
  {id:'research_base',name:'研究基盤Ⅰ',branch:'build',tier:1,req:[],cost:75,samples:2,work:4,desc:'研究試料抽出装置が建設可能に（試料の自給）。'},
  {id:'bunk',name:'二段ベッド設計',branch:'build',tier:1,req:[],cost:80,samples:1,work:4,desc:'共同住居1棟あたり定員 +2。'},
  {id:'logistics',name:'地下物流網',branch:'build',tier:2,req:['bunk'],cost:150,samples:2,work:7,desc:'物資の仕入れ価格 −20%。'},
  {id:'labnet',name:'研究ネットワーク',branch:'build',tier:3,req:['logistics'],cost:200,samples:3,work:9,desc:'研究担当がいる夜、研究ポイント +1。'},
  {id:'adaptation',name:'社会適応',branch:'society',tier:2,req:['impulse'],cost:180,samples:3,work:8,desc:'警戒度が毎日 −1、隣人の疑惑が上がりにくい。'},
  {id:'wordofmouth',name:'口コミ研究',branch:'society',tier:3,req:['adaptation'],cost:160,samples:3,work:8,desc:'地上事業の売上 +15%。'},
  {id:'appraisal',name:'目利き術',branch:'society',tier:3,req:['adaptation'],cost:120,samples:2,work:6,desc:'フリマ販売手数料を実質4%還元。'},
  {id:'humanization',name:'人間化技術',branch:'final',tier:4,req:['adaptation','foreman','wordofmouth'],cost:600,samples:6,work:18,desc:'3つの未来から進路を選べる。'}
]);
export const techById=id=>TECHS.find(t=>t.id===id);
export function researchState(colony){
  const r=colony.research??{};
  // v1.8 migration: started without explicit id meant the first node.
  const active=r.active??(r.started?'impulse':null);
  return {active,progress:r.progress??0};
}
export function techStatus(colony,id){
  const done=colony.completedResearch??[];const t=techById(id);
  if(done.includes(id))return 'done';
  if(researchState(colony).active===id)return 'active';
  return t.req.every(q=>done.includes(q))?'available':'locked';
}
export function startTech(colony,money,id,hasLab){
  const t=techById(id);if(!t)return {ok:false,reason:'不明な研究です'};
  if(!hasLab)return {ok:false,reason:'通路に接続した研究室が必要です'};
  const st=techStatus(colony,id);
  if(st==='done')return {ok:false,reason:'研究完了済みです'};
  if(st==='locked')return {ok:false,reason:`前提研究（${t.req.map(q=>techById(q).name).join('・')}）が必要です`};
  if(researchState(colony).active)return {ok:false,reason:'別の研究が進行中です'};
  if(money<t.cost||(colony.inventory.samples??0)<t.samples)return {ok:false,reason:`研究費${t.cost}G・研究資材${t.samples}個が必要です`};
  return {ok:true,cost:t.cost,money:money-t.cost,colony:{...colony,inventory:{...colony.inventory,samples:colony.inventory.samples-t.samples},research:{active:id,progress:0,started:true}}};
}
export function cancelTech(colony){return {...colony,research:{active:null,progress:0,started:false}};}
/** Nightly research progress. Returns {colony, points, completed:id|null}. */
export function advanceResearch(colony,researchers,labCount){
  const {active,progress}=researchState(colony);
  if(!active||labCount<1||!(researchers>0))return {colony,points:0,completed:null};
  const done=colony.completedResearch??[];
  const points=Math.round((researchers+Math.max(0,labCount-1)+(done.includes('labnet')?1:0))*100)/100;
  const t=techById(active);const next=progress+points;
  if(next>=t.work)return {colony:{...colony,completedResearch:[...done,active],research:{active:null,progress:0,started:false}},points,completed:active};
  return {colony:{...colony,research:{active,progress:Math.round(next*100)/100,started:true}},points,completed:null};
}
/** Aggregated numeric modifiers consumed by simulation, colony, economy and UI. */
export function researchMods(completed=[]){
  const has=id=>completed.includes(id);
  return {
    payMul:(has('shiftplan')?1.2:1)*(has('foreman')?1.25:1),
    fatigueMul:has('stretch')?0.75:1,
    exposureCut:has('makeup')?1:0,
    restBonus:has('sleep')?8:0,
    impulseRelief:has('impulse')?12:0,
    luxuryPenaltyMul:has('hobby')?0.5:1,
    foodPack:has('preserve')?8:5,
    supplyMul:has('logistics')?0.8:1,
    homeBonus:has('bunk')?2:0,
    alertDecay:has('adaptation')?1:0,
    surfaceMul:has('wordofmouth')?1.15:1,
    fleaRebate:has('appraisal')?0.04:0
  };
}
