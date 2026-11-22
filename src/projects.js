// v3.9 grand projects: late-game sinks that need BOTH money and crafted goods, each stage giving a lasting bonus.
export const PROJECTS=Object.freeze([
 {id:'subway',icon:'🚇',name:'地下鉄引き込み線',desc:'地下と街を秘密の線路で結ぶ。地上のバイト枠が増え、買い出しも楽に。',unlock:{districts:3},
  stages:[{money:1200,items:{parts:10}},{money:1800,items:{circuits:4}},{money:2600,items:{toolkit:2}}],effect:'バイト枠+3／段階、完成で買い出し1人5パック'},
 {id:'clinic',icon:'🏥',name:'ゾンビ専門クリニック',desc:'腐敗を根本から遅らせる地下の病院。',unlock:{research:'refrigeration'},
  stages:[{money:1500,items:{cleaner:6}},{money:2200,items:{makeup:4}},{money:3000,items:{toolkit:3}}],effect:'腐敗の進行−15%／段階'},
 {id:'festival',icon:'🎪',name:'人間との交流フェス',desc:'正体を隠したまま街のお祭りを主催し、人間と仲良くなる。',unlock:{districts:2},
  stages:[{money:900,items:{sweets:10}},{money:1600,items:{media:6}},{money:2400,items:{luxury:8}}],effect:'信頼の目標+5／段階、完成で人口の伸び+'},
 {id:'labcity',icon:'🧬',name:'地下研究都市',desc:'研究室群を一つの研究都市にまとめる。',unlock:{research:'archives_research'},
  stages:[{money:2000,items:{samples:10}},{money:3000,items:{circuits:8}},{money:4500,items:{toolkit:4}}],effect:'研究速度+25%／段階'},
 {id:'fortress',icon:'🛡️',name:'地下要塞化',desc:'通路を迷路化し隔壁を張り巡らせる。',unlock:{research:'watch'},
  stages:[{money:1500,items:{parts:12}},{money:2500,items:{batteries:6}},{money:3500,items:{toolkit:4}}],effect:'防衛力+10／段階、警戒−1/日／段階'},
 {id:'humanity',icon:'🌅',name:'人間化計画',desc:'人間化技術を全住民に施す最終計画。完成で未来を選べる。',unlock:{research:'humanization'},
  stages:[{money:6000,items:{toolkit:6,batteries:10}},{money:9000,items:{circuits:15,samples:20}},{money:15000,items:{toolkit:10,makeup:10}}],effect:'完成でエンディング'}
]);
export const projectById=id=>PROJECTS.find(p=>p.id===id);
export function stageOf(colony,id){return colony.projects?.[id]??0;}
export function projectUnlocked(p,{districts,research}){if(p.unlock.districts&&districts<p.unlock.districts)return false;if(p.unlock.research&&!research.includes(p.unlock.research))return false;return true;}
export function unlockText(p){return p.unlock.districts?`街区${p.unlock.districts}つ以上を開発`:`研究「${p.unlock.research}」`;}
/** Try to fund the next stage. Returns {ok, colony, money, inventory} or {ok:false, reason}. */
export function fundStage(colony,money,id,ctx){const p=projectById(id);if(!p)return {ok:false,reason:'不明な計画'};
 if(!projectUnlocked(p,ctx))return {ok:false,reason:'まだ着手できません'};const st=stageOf(colony,id);if(st>=p.stages.length)return {ok:false,reason:'完成済みです'};
 const s=p.stages[st];if(money<s.money)return {ok:false,reason:`資金不足（${s.money}G）`};
 for(const [k,n] of Object.entries(s.items))if((colony.inventory[k]??0)<n)return {ok:false,reason:'資材不足'};
 const inv={...colony.inventory};for(const [k,n] of Object.entries(s.items))inv[k]-=n;
 return {ok:true,cost:s.money,money:money-s.money,stage:st+1,done:st+1>=p.stages.length,colony:{...colony,inventory:inv,projects:{...(colony.projects??{}),[id]:st+1}}};}
/** Aggregate bonuses from funded stages. */
export function projectBonuses(colony){const g=id=>stageOf(colony,id);
 return {townJobs:g('subway')*3,shopPack:g('subway')>=3?5:3,decayMul:1-.15*g('clinic'),trust:g('festival')*5,humansBoost:g('festival')>=3,researchMul:1+.25*g('labcity'),defense:g('fortress')*10,alertCut:g('fortress'),humanity:g('humanity')>=3};}
