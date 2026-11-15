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
export function residentVisual(game,resident,world=null){
  const index=game.residents.findIndex(r=>r.id===resident.id);
  if(index<0)throw new Error('Resident absent');
  const homeBuilding=world?.buildings?.find(b=>b.kind==='home');
  const home=homeBuilding?[homeBuilding.x+.45+(index%3)*Math.min(.65,(homeBuilding.w-.7)/3),homeBuilding.y+.4+(index%2)*Math.min(.7,(homeBuilding.h-.6)/2)]:HOMES[index%HOMES.length];
  const clock=game.tick%120;
  // During the day: return from previous shift, rest at home and socialize.
  if(resident.strikeDays>0)return {layer:'underground',x:home[0],y:home[1],status:'ストライキ中',activity:'strike',reason:'疲労または配給不足のため勤務を拒否。休息と配給で回復します'};
  if(clock<60){
    if(clock<13&&game.day>1){return {layer:'underground',...walk(world,HUB,home,clock/12),status:'帰宅中',reason:'夜勤を終え、共同住居へ戻っています'};}
    if(clock<43){const sleepPulse=Math.sin((clock+index*3)*.2)*.035;return {layer:'underground',x:home[0]+sleepPulse,y:home[1],status:'休息中',activity:'sleep',bubble:(clock+index*5)%23===0?'はっ！寝てた':null,reason:'疲労を回復するため住居で休んでいます'};}
    // Daily life: walk to the ration counter, receive food, chat, return home.
    const shop=world?.buildings?.find(b=>b.kind==='shop'&&(world.connectivity?.[b.id]??true));
    if(shop){const slot=[[0,1.55],[.75,1.55],[0,2.25],[.75,2.25],[.38,1.9]][index%5];const counter=[shop.x+Math.min(shop.w-1,slot[0]),shop.y+Math.min(shop.h-.7,slot[1])];const u=(clock-43+index*1.3)/17;
      if(u<.4)return {layer:'underground',...walk(world,home,counter,u/.4),status:'地下で生活',activity:'walk',reason:'配給所へ食事を受け取りに行きます'};
      if(u<.62)return {layer:'underground',x:counter[0],y:counter[1],status:'地下で生活',activity:'idle',bubble:index%2?'ごはん！':'いただきます',reason:'配給所で食料を受け取っています'};
      return {layer:'underground',...walk(world,counter,home,(u-.62)/.38),status:'地下で生活',activity:'walk',reason:'食事を終えて住居へ戻ります'};}
    const move=Math.sin((clock-43)/17*Math.PI)*.85;
    return {layer:'underground',x:home[0]+move,y:home[1]+move*.25,status:'地下で生活',activity:'walk',reason:'次の勤務まで地下で過ごしています'};
  }
  if(resident.activeJob==='process'){const fac=world?.buildings?.filter(b=>b.kind==='extractor'||b.kind==='sorting')??[];const pIdx=game.residents.filter(r=>r.activeJob==='process').findIndex(r=>r.id===resident.id);const b=fac[Math.max(0,pIdx)%Math.max(1,fac.length)];if(b)return {layer:'underground',x:b.x+.1+(pIdx%2)*.8,y:b.y+.55,status:'素材加工中',activity:'research',bubble:(clock+index*4)%16<3?(b.kind==='extractor'?'抽出中…':'仕分け仕分け'):null,reason:'地下の加工施設で作業しています'};}
  if(resident.activeJob==='research'){const lab=world?.buildings?.find(b=>b.kind==='lab');const rIdx=game.residents.filter(r=>r.activeJob==='research').findIndex(r=>r.id===resident.id);const seat=[[.05,.5],[.05,1.45],[1.1,1.45],[1.1,.5]][Math.max(0,rIdx)%4];return {layer:'underground',x:lab?lab.x+seat[0]:9.1,y:lab?lab.y+seat[1]:6.5,status:'研究中',activity:'research',bubble:(clock+index*4)%14<3?'ふむふむ…':null,reason:'地下研究室で研究を進めています'};}
  if(resident.activeJob==='rest')return {layer:'underground',x:home[0],y:home[1],status:'休息中',activity:'sleep',reason:resident.fatigue>=85?'疲労が高いため夜勤より休息を優先':'休息を指示されているため地下にいます'};
  const night=clock-60;
  if(night<14)return {layer:'underground',...walk(world,home,HUB,night/13),status:'出勤中',reason:'割り当てられた夜勤へ向かっています'};
  if(night<20)return {layer:'surface',...along(SURFACE_HUB,SURFACE_STREET,(night-14)/5),status:'地上へ移動',reason:'地下の出口から人間社会へ出ています'};
  if(night<52)return {layer:'outside',x:0,y:0,status:resident.activeJob==='forage'?'食料調達中':resident.activeJob==='salvage'?'夜間回収中':'外部勤務中',reason:'地図の外で勤務しています。翌朝に成果が確定します'};
  return {layer:'surface',...along(SURFACE_STREET,SURFACE_HUB,(night-52)/7),status:'帰還中',reason:'夜勤を終えて地下への入口へ向かっています'};
}
export function visibleResidents(game,layer,world=null){return game.residents.map((resident,index)=>({resident,index,...residentVisual(game,resident,layer==='underground'?world:null)})).filter(r=>r.layer===layer);}
