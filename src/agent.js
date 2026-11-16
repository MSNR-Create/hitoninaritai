import { homeLayout } from './home-layout.js';
// Pure, deterministic visual projection from simulation state to map coordinates.
// No economic logic and no animation randomness here.
const HOMES=[[4.7,5.5],[5.1,5.8],[5.5,6.1],[5.9,5.7],[6.3,6.2]];
const HUB=[8.0,3.6];
const SURFACE_HUB=[5.5,6.2];const SURFACE_STREET=[7.0,7.0];
function lerp(a,b,t){return a+(b-a)*Math.max(0,Math.min(1,t));}
function along(a,b,t){return {x:lerp(a[0],b[0],t),y:lerp(a[1],b[1],t)};}
// v2.2: underground is solid earth; residents walk only through dug tiles (corridors + facility floors).
const routeCache=new WeakMap();
function walkable(world){const set=new Set(world.paths);for(const b of world.buildings)for(let x=b.x;x<b.x+b.w;x++)for(let y=b.y;y<b.y+b.h;y++)set.add(`${x},${y}`);return set;}
export function tunnelRoute(world,a,b){
 if(!world?.paths)return [a,b];
 let per=routeCache.get(world.paths);if(!per){per={walk:walkable(world),routes:new Map(),n:world.buildings.length};routeCache.set(world.paths,per);}
 if(per.n!==world.buildings.length){per.walk=walkable(world);per.routes.clear();per.n=world.buildings.length;}
 const key=`${a}|${b}`;if(per.routes.has(key))return per.routes.get(key);
 const W=per.walk,snap=p=>{const k=`${Math.round(p[0])},${Math.round(p[1])}`;if(W.has(k))return k;let best=null,bd=1e9;for(const t of W){const [x,y]=t.split(',').map(Number);const d=(x-p[0])**2+(y-p[1])**2;if(d<bd){bd=d;best=t;}}return best;};
 const s0=snap(a),s1=snap(b);let pts=[a,b];
 if(s0&&s1&&s0!==s1){const prev=new Map([[s0,null]]),q=[s0];
  while(q.length){const c=q.shift();if(c===s1)break;const [x,y]=c.split(',').map(Number);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=`${x+dx},${y+dy}`;if(W.has(n)&&!prev.has(n)){prev.set(n,c);q.push(n);}}}
  if(prev.has(s1)){const tiles=[];for(let c=s1;c;c=prev.get(c))tiles.unshift(c.split(',').map(Number));pts=[a,...tiles.slice(1,-1),b];}}
 per.routes.set(key,pts);return pts;
}
function walk(world,a,b,t){const pts=tunnelRoute(world,a,b);if(pts.length<=2)return along(a,b,t);
 const seg=pts.slice(1).map((p,i)=>Math.hypot(p[0]-pts[i][0],p[1]-pts[i][1]));const total=seg.reduce((s,v)=>s+v,0);let d=Math.max(0,Math.min(1,t))*total;
 for(let i=0;i<seg.length;i++){if(d<=seg[i]||i===seg.length-1)return along(pts[i],pts[i+1],seg[i]?Math.min(1,d/seg[i]):1);d-=seg[i];}return along(a,b,1);}
// v2.4 each resident belongs to one home; homes fill evenly up to their own capacity.
export function homeCapacity(world,b){const homes=world.buildings.filter(x=>x.kind==='home');return (homes[0]===b?5:2)+((b.level??1)-1)*2+(world.homeBonus??0);}
export function homeAssignments(game,world){
 const homes=(world?.buildings??[]).filter(b=>b.kind==='home'&&(world.connectivity?.[b.id]??true));if(!homes.length)return {};
 const occ=new Map(homes.map(h=>[h.id,0])),caps=new Map(homes.map(h=>[h.id,homeCapacity(world,h)]));const out={};
 for(const r of game.residents){let best=null;for(const h of homes){const o=occ.get(h.id),c=caps.get(h.id);if(o>=c)continue;if(!best||o/c<occ.get(best.id)/caps.get(best.id))best=h;}
  best??=homes[0];out[r.id]={id:best.id,slot:occ.get(best.id)};occ.set(best.id,occ.get(best.id)+1);}
 return out;}
// v3.4: each resident sleeps in their own bed from homeLayout (bunks when the room is full); overflow gets a futon.
function homeSpot(game,resident,world){const a=homeAssignments(game,world)[resident.id];if(!a)return null;const b=world.buildings.find(x=>x.id===a.id);const j=a.slot;
 const L=homeLayout(b,homeCapacity(world,b));const s=L.slots[j];if(s)return [b.x+s.lx,b.y+s.ly,true,s.upper];
 const d=L.decor[(j-L.slots.length)%Math.max(1,L.decor.length)]??{lx:0,ly:0};return [b.x+d.lx+.2,b.y+d.ly,false,false];}
// v2.4 role workplace: the facility kind each processing resident used last night (world.workPlaces), else any.
function workSpot(game,resident,world,kinds,idx){const fac=(world?.buildings??[]).filter(b=>kinds.includes(b.kind));if(!fac.length)return null;
 const want=world.workPlaces?.[resident.name];const pool=want!=null?fac.filter(b=>b.id===want||b.kind===want):fac;const b=(pool.length?pool:fac)[Math.max(0,idx)%(pool.length||fac.length)];
 // v2.6: posted workers stand at their own spot INSIDE the assigned building's footprint.
 const mates=want!=null?game.residents.filter(r=>world.workPlaces?.[r.name]===want&&r.activeJob===resident.activeJob):[];const k=Math.max(0,mates.findIndex(r=>r.id===resident.id));
 const spots=[[.3,.35],[.7,.65],[.7,.3],[.3,.7]];const s=want!=null?spots[k%4]:[(idx%2)?.7:.3,.5];
 return {b,pt:[b.x+.15+s[0]*Math.max(.2,b.w-.3),b.y+.15+s[1]*Math.max(.2,b.h-.3)]};}
// v3.2: each facility gets its own work motion and chatter.
const WORK_ACT={kitchen:['cook','🍳ジュウ…'],mushroom:['farm','🍄すくすく'],farm:['farm','💧じょうろ'],water:['pump','💧ギコギコ'],extractor:['pump','⚙️ギコギコ'],sorting:['sort','♻️よいしょ'],recycler:['sort','♻️ガシャン'],
 chemical:['brew','🧪ぶくぶく'],culture:['brew','🧫ふむ…'],workshop:['craft','🔨トンテン'],disguise:['craft','🎭ぬりぬり'],archives:['read','📚ぱらぱら'],lounge:['read','🎲わいわい'],lab:['research','🔬ふむふむ']};
const PROCESS_KINDS=['sorting','extractor','mushroom','kitchen','farm','water','chemical','culture','recycler','workshop','disguise','archives','lounge'];
export function residentVisual(game,resident,world=null){
  const index=game.residents.findIndex(r=>r.id===resident.id);
  if(index<0)throw new Error('Resident absent');
  const home=homeSpot(game,resident,world)??HOMES[index%HOMES.length];
  const clock=game.tick%120;
  // During the day: return from previous shift, rest at home and socialize.
  if(resident.strikeDays>0)return {layer:'underground',x:home[0],y:home[1],status:'ストライキ中',activity:'strike',reason:'疲労または配給不足のため勤務を拒否。休息と配給で回復します'};
  if(clock<60){
    if(clock<13&&game.day>1){return {layer:'underground',...walk(world,HUB,home,clock/12),status:'帰宅中',reason:'夜勤を終え、共同住居へ戻っています'};}
    if(clock<43){return {layer:'underground',x:home[0],y:home[1],futon:home[2]===false,upper:!!home[3],status:'休息中',activity:'sleep',bubble:(clock+index*5)%23===0?'はっ！寝てた':null,reason:'疲労を回復するため住居で休んでいます'};}
    // v2.7: care-facility users (wash/cooler/repair) visit their station during the day.
    {const fid=world?.facilityUsers?.[resident.name];const fb=fid!=null&&world.buildings.find(b=>b.id===fid);
     if(fb){const u=(clock-43)/17,pt=[fb.x+.3+((index%2)?.45:0)*Math.max(.2,fb.w-.6),fb.y+.35+((index>>1)%2?.45:0)*Math.max(.2,fb.h-.6)];const bub={wash:'🚿ゴシゴシ',cooler:'❄️ひんやり',repair:'🩹ぬいぬい'}[fb.kind]??'…';
      if(u<.3)return {layer:'underground',...walk(world,home,pt,u/.3),status:'施設へ移動',activity:'walk',reason:`${fb.name}を使いに行きます`};
      if(u<.8)return {layer:'underground',x:pt[0],y:pt[1],status:`${fb.name}を利用中`,activity:'idle',bubble:(clock+index)%5<3?bub:null,reason:`${fb.name}で腐敗を抑えています`};
      return {layer:'underground',...walk(world,pt,home,(u-.8)/.2),status:'地下で生活',activity:'walk',reason:'住居へ戻ります'};}}
    // Daily life: walk to the ration counter, receive food, chat, return home.
    const shop=world?.buildings?.find(b=>b.kind==='shop'&&(world.connectivity?.[b.id]??true));
    if(shop){const slot=[[0,1.55],[.75,1.55],[0,2.25],[.75,2.25],[.38,1.9]][index%5];const counter=[shop.x+Math.min(shop.w-1,slot[0]),shop.y+Math.min(shop.h-.7,slot[1])];const u=(clock-43+index*1.3)/17;
      if(u<.4)return {layer:'underground',...walk(world,home,counter,u/.4),status:'地下で生活',activity:'walk',reason:'配給所へ食事を受け取りに行きます'};
      if(u<.62)return {layer:'underground',x:counter[0],y:counter[1],status:'地下で生活',activity:'idle',bubble:index%2?'ごはん！':'いただきます',reason:'配給所で食料を受け取っています'};
      return {layer:'underground',...walk(world,counter,home,(u-.62)/.38),status:'地下で生活',activity:'walk',reason:'食事を終えて住居へ戻ります'};}
    // v3.2: free time differs per resident — reading, chatting, napping or pacing.
    const hobby=['read','chat','sleep','wander'][index%4];
    if(hobby==='wander'){const move=Math.sin((clock-43)/17*Math.PI)*.85;return {layer:'underground',x:home[0]+move,y:home[1]+move*.25,status:'地下で生活',activity:'walk',reason:'次の勤務まで地下をうろうろしています'};}
    return {layer:'underground',x:home[0]+(hobby==='chat'?.35:0),y:home[1],futon:hobby==='sleep'&&home[2]===false,upper:hobby==='sleep'&&!!home[3],status:'地下で生活',activity:hobby,bubble:hobby==='chat'&&(clock+index)%6<2?['それでね…','へぇ〜','ウゥ…（笑）'][index%3]:null,reason:{read:'住居で本を読んでいます',chat:'仲間とおしゃべり中',sleep:'昼寝をしています'}[hobby]};
  }
  // v3.5 patrol: watch the exit tunnel through the night, pacing back and forth.
  if(resident.activeJob==='patrol'){const ex=world?.buildings?.find(b=>b.kind==='exit');const base=ex?[ex.x+(index%2?ex.w+.2:-.6),ex.y+ex.h+.2]:HUB;const night=clock-60;
    if(night>=0&&night<10)return {layer:'underground',...walk(world,home,base,night/9),status:'見張りへ移動',activity:'walk',reason:'出入口の見張りに向かっています'};
    if(night>=10){const sw=Math.sin((clock+index*5)*.35)*.9;return {layer:'underground',x:base[0]+sw,y:base[1],status:'見張り中',activity:'walk',bubble:(clock+index*3)%14<2?'👀異常なし':null,reason:'人間の侵入に備えて出入口を見張っています'};}}
  if(resident.activeJob==='process'||resident.activeJob==='research'){
    const idx=game.residents.filter(r=>r.activeJob===resident.activeJob).findIndex(r=>r.id===resident.id);
    const spot=resident.activeJob==='research'?workSpot(game,resident,world,['lab'],idx):workSpot(game,resident,world,PROCESS_KINDS,idx);
    const dest=spot?.pt??[9.1,6.5],night=clock-60;
    if(night>=0&&night<12)return {layer:'underground',...walk(world,home,dest,night/11),status:resident.activeJob==='research'?'研究室へ移動':'作業場へ移動',activity:'walk',reason:'担当の施設へ向かっています'};
    const research=resident.activeJob==='research';const nm=spot?.b?.name??'';
    const wa=WORK_ACT[spot?.b?.kind]??['craft','作業中…'];
    return {layer:'underground',x:dest[0],y:dest[1],status:research?'研究中':'素材加工中',activity:wa[0],bubble:(clock+index*4)%15<3?wa[1]:null,reason:research?'地下研究室で研究を進めています':`${nm}で作業しています`};}
  if(resident.activeJob==='rest')return {layer:'underground',x:home[0],y:home[1],futon:home[2]===false,upper:!!home[3],status:'休息中',activity:'sleep',reason:resident.fatigue>=85?'疲労が高いため夜勤より休息を優先':'休息を指示されているため地下にいます'};
  const night=clock-60;
  if(night<14)return {layer:'underground',...walk(world,home,HUB,night/13),status:'出勤中',reason:'割り当てられた夜勤へ向かっています'};
  if(night<20)return {layer:'surface',...along(SURFACE_HUB,SURFACE_STREET,(night-14)/5),status:'地上へ移動',reason:'地下の出口から人間社会へ出ています'};
  if(night<52)return {layer:'outside',x:0,y:0,status:resident.activeJob==='forage'?'食料調達中':resident.activeJob==='salvage'?'夜間回収中':resident.activeJob==='shopping'?'買い出し中':'アルバイト中',reason:'地図の外で勤務しています。翌朝に成果が確定します'};
  return {layer:'surface',...along(SURFACE_STREET,SURFACE_HUB,(night-52)/7),status:'帰還中',reason:'夜勤を終えて地下への入口へ向かっています'};
}
export function visibleResidents(game,layer,world=null){return game.residents.map((resident,index)=>({resident,index,...residentVisual(game,resident,layer==='underground'?world:null)})).filter(r=>r.layer===layer);}
