// v1.10 building occupants: humans inside surface buildings act according to the
// building's role (staff at counters, shoppers, diners, patients, sleepers, porters).
// Pure & deterministic: positions depend only on (building, seconds, context).
// Coordinates are tile-centre coords (same space as projectedTile()).

/** Walk a closed loop of stops with a dwell at each stop. */
export function walkLoop(stops,t,{speed=.9,dwell=1.6,phase=0}={}){
  const segs=stops.map((p,i)=>{const q=stops[(i+1)%stops.length];return {p,q,len:Math.hypot(q[0]-p[0],q[1]-p[1])/speed};});
  const total=segs.reduce((n,s)=>n+s.len+dwell,0);
  let u=((t+phase)%total+total)%total;
  for(let i=0;i<segs.length;i++){const s=segs[i];
    if(u<dwell)return {x:s.p[0],y:s.p[1],moving:false,stop:i,dx:0,dwellT:u};
    u-=dwell;
    if(u<s.len){const k=u/s.len;return {x:s.p[0]+(s.q[0]-s.p[0])*k,y:s.p[1]+(s.q[1]-s.p[1])*k,moving:true,stop:-1,dx:s.q[0]-s.p[0]-(s.q[1]-s.p[1])};}
    u-=s.len;
  }
  return {x:stops[0][0],y:stops[0][1],moving:false,stop:0,dx:0,dwellT:0};
}
const L=(b,lx,ly)=>[b.x+lx,b.y+ly];
const door=b=>[b.x+Math.floor(b.w/2),b.y+b.h-1+.35];
function hashId(s){let h=7;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return Math.abs(h);}

/** Returns [{x,y,kind:'human',id,activity,bubble,flip,carry}] for one building. */
export function occupantsFor(b,t,{night=false,humans=34}={}){
  const out=[],seed=hashId(b.id),crowd=1+Math.min(2,Math.floor(humans/40));
  const cx=v=>Math.max(b.x-.35,Math.min(b.x+b.w-.65,v)),cy=v=>Math.max(b.y-.35,Math.min(b.y+b.h-.65,v));
  const push=(o)=>out.push({kind:'human',activity:'idle',...o,x:cx(o.x),y:cy(o.y),id:(seed+out.length*7)%24});
  const shopper=(stops,i,line)=>{const w=walkLoop(stops,t,{phase:i*5.3+seed%7,dwell:1.8});push({x:w.x,y:w.y,activity:w.moving?'walk':'idle',flip:w.dx<0,bubble:!w.moving&&w.stop===1&&w.dwellT<1.4?line:null});};
  switch(b.kind){
    case 'market':{
      const staff=L(b,1,.62);const greet=Math.floor(t/4+seed)%3===0;
      push({x:staff[0],y:staff[1],bubble:greet?'いらっしゃいませ':null});
      for(let i=0;i<crowd;i++)shopper([door(b),L(b,i%2,.5),L(b,1,1.45),door(b)],i,i%2?'これ下さい':'お会計！');
      break;}
    case 'cafe':{
      push({x:b.x+.05,y:b.y+.55,bubble:Math.floor(t/5+seed)%3===0?'いらっしゃいませ':null});
      const seats=[L(b,1,1.5),L(b,2,2.4)];
      seats.slice(0,crowd).forEach((s,i)=>push({x:s[0],y:s[1],bubble:Math.floor(t/3+i*2+seed)%4===0?'おいしい♪':null}));
      shopper([door(b),L(b,0,.55),L(b,1,1.5),door(b)],1,'コーヒー1つ');
      break;}
    case 'clinic':{
      push({x:b.x+1,y:b.y+.5,bubble:Math.floor(t/5+seed)%4===0?'お大事に':null});
      push({x:b.x+.05,y:b.y+.2,activity:'sleep'});
      if(b.h>1)push({x:b.x+.05,y:b.y+1.2,activity:'sleep',bubble:Math.floor(t/6)%3===1?'はっ！寝てた':null});
      shopper([door(b),L(b,1,.95),door(b)],0,'先生…');
      break;}
    case 'humanHome':{
      if(night){push({x:b.x+.1,y:b.y+.2,activity:'sleep'});
        const w=walkLoop([L(b,1,1.45),L(b,Math.min(2,b.w-1),.6)],t,{dwell:3,phase:seed});push({x:w.x,y:w.y,activity:w.moving?'walk':'idle',flip:w.dx<0,bubble:!w.moving&&w.stop===1?'夜食…':null});}
      else{const w=walkLoop([L(b,1,1.45),L(b,1,.6),L(b,0,.4)],t,{dwell:2.5,phase:seed});push({x:w.x,y:w.y,activity:w.moving?'walk':'idle',flip:w.dx<0,bubble:!w.moving&&w.stop===2&&w.dwellT<1.5?'ふぁ〜':null});
        push({x:b.x+1.2,y:b.y+1.45,bubble:Math.floor(t/7+seed)%4===0?'いい天気':null});}
      break;}
    case 'warehouse':{
      for(let i=0;i<Math.min(2,crowd+1);i++){const w=walkLoop([L(b,0,.55),L(b,2,2.45),L(b,1,1.4)],t,{phase:i*4,dwell:1.2,speed:1.1});push({x:w.x,y:w.y,activity:w.moving?'walk':'idle',flip:w.dx<0,carry:w.moving&&w.stop!==0,bubble:!w.moving&&w.stop===1&&i===0?'よいしょ':null});}
      break;}
  }
  return out;
}
export function surfaceOccupants(world,t,ctx){
  return [...world.buildings,...(world.cityBuildings??[])].flatMap(b=>occupantsFor(b,t,ctx).map(o=>({...o,building:b.id})));
}
