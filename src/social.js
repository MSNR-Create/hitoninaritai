// Deterministic resident–human-neighbor relationships. No wall-clock or Math.random.
export const NEIGHBORS=Object.freeze([
 {id:'neighbor-1',name:'朝倉ユイ'},
 {id:'neighbor-2',name:'田中ソウタ'},
 {id:'neighbor-3',name:'木村ハル'}
]);
const cap=n=>Math.max(0,Math.min(100,n));
export function initialSocial(){return {neighbors:NEIGHBORS.map(n=>({...n,converted:false})),links:{},history:[]};}
export function contactFor(id){return NEIGHBORS[(id-1)%NEIGHBORS.length].id;}
// v3.0: new humans keep moving into the neighborhood, so the pool of potential kin never runs dry.
const SURN=['佐藤','鈴木','高橋','伊藤','渡辺','山本','中村','小林','加藤','吉田','山田','松本','井上','清水','森'],GIVEN=['ミオ','レン','ハナ','タクミ','アオイ','リク','サクラ','カイト','ユウ','メイ','ソラ','ナギ','ツムギ','ハルト','コハル'];
function ensureNeighbors(social){let active=social.neighbors.filter(n=>!n.converted);let k=social.neighbors.length;
 while(active.length<3){const name=SURN[(k*7)%SURN.length]+GIVEN[(k*11+3)%GIVEN.length];const n={id:`neighbor-${k+1}`,name,converted:false};social.neighbors.push(n);active.push(n);k++;}
 return active;}
function append(history,day,kind,message,residentId,reason){history.push({id:`day${day}-${history.length+1}`,day,kind,message,residentId,reason});}
/** Applies once at day boundary, after provisions; explicit favorable/unfavorable feedback. */
export function advanceSocial(old,game,colony,capacity){
 const social={neighbors:old.neighbors.map(n=>({...n})),links:Object.fromEntries(Object.entries(old.links).map(([k,v])=>[k,{...v}])),history:[...old.history]};
 const residents=game.residents.map(r=>({...r}));let alert=game.alert,conversion=null;
 for(const r of residents){
  const active=ensureNeighbors(social);const prev=social.links[r.id];const prevN=prev&&social.neighbors.find(n=>n.id===prev.neighborId);
  const neighbor=prevN&&!prevN.converted?prevN:active[(r.id-1)%active.length];const neighborId=neighbor.id;
  const l=prev&&prev.neighborId===neighborId?prev:{neighborId,affinity:0,suspicion:0,meetings:0};
  const safe=r.impulse<30 && r.fatigue<=65 && r.lastNeeds?.food!==false && r.strikeDays===0;
  const dangerous=r.impulse>=60 || r.strikeDays>0;
  if(safe){l.affinity=Math.min(5,l.affinity+1);l.suspicion=Math.max(0,l.suspicion-12);l.meetings++;
   if(l.meetings===1||l.affinity===3)append(social.history,game.day,'friendship',`${r.name}と${neighbor.name}が親しくなった`,r.id,'配給が足りており、衝動と疲労が低い');
  }else if(dangerous){l.affinity=Math.max(-3,l.affinity-1);l.suspicion=cap(l.suspicion+25);
   if(l.suspicion>=50&&(l.suspicion-25<50))append(social.history,game.day,'warning',`${neighbor.name}が${r.name}の正体を疑い始めた`,r.id,'強い衝動またはストライキ状態で接触した');
  }else{l.suspicion=Math.max(0,l.suspicion-4);}
  if(l.suspicion>=90){alert=cap(alert+12);l.suspicion=48;append(social.history,game.day,'police',`${neighbor.name}から通報が入り警戒度が上昇`,r.id,'不審な接触が複数日にわたり蓄積した');}
  social.links[r.id]=l;
 }
 // Only a willing neighbor with a stable relationship joins. At most one per day.
 if(residents.length<capacity && colony.inventory.food>=residents.length+2){
  for(const r of residents){const l=social.links[r.id],neighbor=l&&social.neighbors.find(n=>n.id===l.neighborId);
   if(!neighbor||neighbor.converted||l.affinity<4||l.meetings<4||l.suspicion>15||r.wellDays<4)continue;
   const newId=colony.nextResidentId;
   conversion={id:newId,name:neighbor.name,from:neighbor.id,by:r.name};
   neighbor.converted=true;residents.push({id:newId,name:neighbor.name,job:'auto',activeJob:'rest',fatigue:15,impulse:16,previousImpulse:16,action:'地下で生活',strikeDays:0,wellDays:0,relationship:1});
   append(social.history,game.day,'conversion',`${neighbor.name}が${r.name}の眷属として加入`,r.id,'4回以上の良好な交流・配給余力・住居の空きが揃った');break;
  }
 }
 social.history=social.history.slice(-60);
 return {social,game:{...game,residents,alert},conversion};
}
export function recordDeaths(social,day,deadNames){if(!deadNames.length)return social;const history=[...social.history];for(const name of deadNames)append(history,day,'loss',`${name}が人間との衝突で死亡`,null,'高い危険衝動が継続して対人事件が起きた');return {...social,history:history.slice(-60)};}
