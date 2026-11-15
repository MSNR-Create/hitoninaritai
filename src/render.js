import { FACILITY_DEFS } from './catalog.js';
import { visibleResidents } from './agent.js';
import {streetTileKind,vehiclesAt,pedestriansAt} from './surface-city.js';
import { prop } from './sprites.js';
import { surfaceOccupants } from './occupants.js';
import { zombieSprite, humanSprite, furniture, ROOM_LAYOUT, drawTile, tileHash, blit, shade } from './sprites.js';
import { MAP_SIZE, TILE_HEIGHT, TILE_WIDTH, tileToWorld, projectedTile, worldToView, rotateTile } from './geometry.js';

function rotateGridPoint(x,y,rotation=0,size=MAP_SIZE){
  switch(((rotation%4)+4)%4){
    case 1:return {x:size-y,y:x};
    case 2:return {x:size-x,y:size-y};
    case 3:return {x:y,y:size-x};
    default:return {x,y};
  }
}

function projectedBuildingCorners(b,rotation=0){
  const nw=rotateGridPoint(b.x,b.y,rotation);
  const ne=rotateGridPoint(b.x+b.w,b.y,rotation);
  const se=rotateGridPoint(b.x+b.w,b.y+b.h,rotation);
  const sw=rotateGridPoint(b.x,b.y+b.h,rotation);
  // Grid points are tile CORNERS; tileToWorld() expects tile CENTRES, so shift by half a tile.
  const corner=p=>tileToWorld(p.x-0.5,p.y-0.5);
  // After rotation, re-label by screen position so a=top, d=bottom, l=left, r=right.
  const pts=[nw,ne,se,sw].map(corner);
  const by=(f)=>pts.reduce((m,p)=>f(p)<f(m)?p:m);
  return {a:by(p=>p.y), d:by(p=>-p.y), l:by(p=>p.x), r:by(p=>-p.x)};
}

function projectedBuildingAnchor(b,rotation=0){
  const c=rotateGridPoint(b.x+b.w/2,b.y+b.h/2,rotation);
  return tileToWorld(c.x-0.5,c.y-0.5);
}


const PALETTES = {
  underground: { ground1:'#7a6450', ground2:'#836b55', edge:'#3a2c22', seam:'#5e4a3a', selected:'#fff3a0', closed:'#3d3330', path:'#c9b896' },
  surface: { ground1:'#79c35f', ground2:'#82ca66', edge:'#3d7a3a', seam:'#5fa04e', selected:'#fff3a0', closed:'#283d42', path:'#a3a6ab' }
};
function polygon(ctx, points, fill, stroke, lineWidth=1) {
  ctx.beginPath(); ctx.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
  ctx.closePath(); if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}
}
function diamond(ctx,x,y,fill,stroke) {
  polygon(ctx, [[x,y-16],[x+32,y],[x,y+16],[x-32,y]], fill, stroke);
}
function rectTop(ctx,cx,cy,w,h,fill,stroke) {
  polygon(ctx,[[cx,cy-h],[cx+w,cy-h/2],[cx,cy],[cx-w,cy-h/2]],fill,stroke);
}
function tileCenter(tx,ty,rotation=0) { return projectedTile(tx,ty,rotation); }
// Open-dollhouse isometric rooms: rear two walls only, no roof or front walls.
// v1.9.1: a building is emitted as depth-sorted parts (floor, one wall segment per
// tile edge, furniture per tile) so characters correctly pass behind/in front of walls.
const BUILDING_COLORS_OLD={pantry:['#f4e4c4','#d0904a','#f0c080'],storage:['#d8cdb8','#7a8a6a','#b0c098'],wash:['#e6f4f8','#4aa0c8','#8fd0ea'],sorting:['#e2d2b4','#8a7a5a','#bfae8a'],extractor:['#e4e0f4','#5a8a9a','#9ad0d8'],home:['#e9c99a','#6fa8c8','#9fd0e4'],shop:['#f0d2a0','#e07a5a','#f6b07a'],exit:['#bfe6cf','#4fa88a','#8fd6b4'],humanHome:['#f1d6b2','#a07ad0','#cbb0ec'],market:['#f3dcb2','#e2605a','#f6a07a'],warehouse:['#d8d0c0','#5f8fb0','#8fbcd8'],clinic:['#f4f4ee','#5fb8a8','#a8e6d8'],cafe:['#ecc896','#c0784a','#e8a876'],lab:['#dcd8f0','#7a6ad0','#aea2ee']};
const BADGE_OLD={pantry:'🍞',storage:'▦',wash:'♒',sorting:'▤',extractor:'⚛',home:'⌂',shop:'★',exit:'↕',humanHome:'⌂',market:'★',warehouse:'▣',clinic:'✚',cafe:'♨',lab:'⚗'};
const BADGE={...BADGE_OLD,...Object.fromEntries(Object.entries(FACILITY_DEFS).map(([k,f])=>[k,f.icon]))};
const BUILDING_COLORS={...BUILDING_COLORS_OLD,...Object.fromEntries(Object.entries(FACILITY_DEFS).map(([k,f])=>[k,f.color]))};
export function rotatedRect(b,rotation=0){
  const pts=[[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]].map(([x,y])=>rotateGridPoint(x,y,rotation));
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
}
const gp=(x,y)=>tileToWorld(x-.5,y-.5); // rotated grid corner -> world
function wallSegment(ctx,P,Q,H,color,windowed){
  const poly=[[P.x,P.y],[Q.x,Q.y],[Q.x,Q.y-H],[P.x,P.y-H]];
  polygon(ctx,poly,color,null);
  ctx.save();ctx.beginPath();ctx.moveTo(poly[0][0],poly[0][1]);for(const q of poly.slice(1))ctx.lineTo(q[0],q[1]);ctx.closePath();ctx.clip();
  ctx.strokeStyle=shade(color,-26);ctx.lineWidth=1;
  for(let k=4;k<H;k+=4){ctx.beginPath();ctx.moveTo(P.x,P.y-k);ctx.lineTo(Q.x,Q.y-k);ctx.stroke();}
  for(let i=0;i<4;i++)for(let k=0;k<H;k+=4){const t=(i+((k/4)%2)*.5)/4;const x=P.x+(Q.x-P.x)*t,y=P.y+(Q.y-P.y)*t-k;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-4);ctx.stroke();}
  ctx.restore();
  if(windowed){const x=(P.x+Q.x)/2,y=(P.y+Q.y)/2-H+5,sl=(Q.y-P.y)/(Q.x-P.x);
    polygon(ctx,[[x-5,y-5*sl],[x+5,y+5*sl],[x+5,y+5*sl+8],[x-5,y-5*sl+8]],'#f3e3a2','#2b3e47',1);
    polygon(ctx,[[x-3,y-3*sl+1],[x,y+1],[x,y+4],[x-3,y-3*sl+4]],'rgba(255,255,255,.55)',null);}
  ctx.strokeStyle=shade(color,48);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(P.x,P.y-H);ctx.lineTo(Q.x,Q.y-H);ctx.stroke();
  ctx.strokeStyle='#293f4a';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(P.x,P.y-H-1.5);ctx.lineTo(Q.x,Q.y-H-1.5);ctx.stroke();
}
/** Returns {parts:[{depth,sub,draw}], overlay:fn}. depth = rotated tile x+y. */
export function buildingParts(b,connected=true,rotation=0){
  const [floor,wall,trim]=BUILDING_COLORS[b.kind]??BUILDING_COLORS.home;
  const H=b.kind==='exit'?4:6, R=rotatedRect(b,rotation);
  const a=gp(R.x,R.y),r=gp(R.x+R.w,R.y),d=gp(R.x+R.w,R.y+R.h),l=gp(R.x,R.y+R.h);
  const parts=[];
  parts.push({depth:R.x+R.y-1,sub:-1,draw:ctx=>{
    polygon(ctx,[[a.x,a.y+3],[r.x+4,r.y+3],[d.x,d.y+5],[l.x-4,l.y+3]],'rgba(6,14,20,.35)',null);
    const fp=[[a.x,a.y],[r.x,r.y],[d.x,d.y],[l.x,l.y]];polygon(ctx,fp,floor,null);
    ctx.save();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(r.x,r.y);ctx.lineTo(d.x,d.y);ctx.lineTo(l.x,l.y);ctx.closePath();ctx.clip();
    ctx.strokeStyle=shade(floor,-18);ctx.lineWidth=1;const n=R.h*5;
    for(let i=1;i<n;i++){const t=i/n;ctx.beginPath();ctx.moveTo(a.x+(l.x-a.x)*t,a.y+(l.y-a.y)*t);ctx.lineTo(r.x+(d.x-r.x)*t,r.y+(d.y-r.y)*t);ctx.stroke();}
    const g=ctx.createLinearGradient(a.x,a.y,a.x,a.y+14);g.addColorStop(0,'rgba(10,18,24,.35)');g.addColorStop(1,'rgba(10,18,24,0)');ctx.fillStyle=g;ctx.fillRect(l.x,a.y,r.x-l.x,Math.max(l.y,r.y)-a.y);
    ctx.restore();polygon(ctx,fp,null,'#f1eed7',1.4);
  }});
  // back walls: north edge (y=R.y) and west edge (x=R.x) in rotated space
  for(let i=0;i<R.w;i++){const P=gp(R.x+i,R.y),Q=gp(R.x+i+1,R.y);parts.push({depth:R.x+i+R.y-.5,sub:0,draw:ctx=>wallSegment(ctx,P,Q,H,wall,false)});}
  for(let j=0;j<R.h;j++){const P=gp(R.x,R.y+j),Q=gp(R.x,R.y+j+1);parts.push({depth:R.x+R.y+j-.5,sub:0,draw:ctx=>wallSegment(ctx,P,Q,H,trim,false)});}
  parts.push({depth:R.x+R.y-.5,sub:0.5,draw:ctx=>{ctx.strokeStyle='#293f4a';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.x,a.y-H-1.5);ctx.stroke();}});
  for(const [name,lx0,ly0] of ROOM_LAYOUT[b.kind]??[]){
    const [lx,ly]=b.rot?[ly0,lx0]:[lx0,ly0];if(lx>=b.w||ly>=b.h)continue;
    const q=rotateGridPoint(b.x+lx+.5,b.y+ly+.5,rotation),pt=tileToWorld(q.x-.5,q.y-.5);
    parts.push({depth:q.x+q.y-1,sub:1,draw:ctx=>blit(ctx,furniture(name),pt.x,pt.y+6,rotation%2===1)});
  }
  const overlay=ctx=>{
    const px=Math.round((a.x+d.x)/2),py=Math.round(a.y-H-14);
    ctx.fillStyle='#0e1d24';ctx.fillRect(px-11,py-9,22,20);ctx.fillStyle=connected===false?'#a9473f':'#1d3844';ctx.fillRect(px-10,py-10,20,18);
    ctx.fillStyle=connected===false?'#f0a28f':'#7fb7a3';ctx.fillRect(px-10,py-10,20,2);ctx.fillStyle='#0e1d24';ctx.beginPath();ctx.moveTo(px-3,py+8);ctx.lineTo(px+3,py+8);ctx.lineTo(px,py+12);ctx.fill();
    ctx.fillStyle='#f8e9b0';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(connected===false?'!':(BADGE[b.kind]??'•'),px,py);
  };
  return {parts,overlay};
}
// v2.3 isometric 3D car: boxes built on the tile axes (f = forward, sd = side, both in screen px per tile),
// faces painted back-to-front with per-face shading, so it reads as a solid at every view rotation.
function car3d(ctx,c,f,sd,color){
 const P=(u,v,h)=>[c.x+f[0]*u+sd[0]*v,c.y+f[1]*u+sd[1]*v-h];
 const box=(u0,u1,w,h0,h1,top,side,front,back,glass)=>{
  const g=[[u0,-w],[u1,-w],[u1,w],[u0,w]];const faces=[];
  for(let i=0;i<4;i++){const a=g[i],b=g[(i+1)%4];const pts=[P(a[0],a[1],h0),P(b[0],b[1],h0),P(b[0],b[1],h1),P(a[0],a[1],h1)];
   const my=(pts[0][1]+pts[1][1])/2;const kind=i===1?'front':i===3?'back':'side';faces.push({pts,my,kind});}
  faces.sort((p,q)=>p.my-q.my);
  for(const fc of faces){const col=fc.kind==='front'?front:fc.kind==='back'?back:side;polygon(ctx,fc.pts,col,'rgba(20,28,34,.55)',0.8);
   if(glass&&fc.kind==='side'){const [p0,p1,p2,p3]=fc.pts;const L=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    polygon(ctx,[L(p0,p1,.12),L(p0,p1,.88),L(p3,p2,.88).map((v,i)=>i?v+2:v),L(p3,p2,.12).map((v,i)=>i?v+2:v)],glass,null);}}
  polygon(ctx,g.map(([u,v])=>P(u,v,h1)),top,'rgba(20,28,34,.55)',0.8);
 };
 // shadow
 ctx.fillStyle='rgba(8,16,22,.32)';ctx.beginPath();const sh=[[-.5,-.27],[.5,-.27],[.5,.27],[-.5,.27]].map(([u,v])=>P(u*1.06,v*1.15,-1));ctx.moveTo(...sh[0]);for(const q of sh.slice(1))ctx.lineTo(...q);ctx.closePath();ctx.fill();
 // wheels (drawn under the body; only the ones on the near side show)
 for(const [u,v] of [[-.3,-.23],[.3,-.23],[-.3,.23],[.3,.23]]){const w=P(u,v,2);ctx.fillStyle='#151a1e';ctx.beginPath();ctx.ellipse(w[0],w[1],3.4,2.4,0,0,Math.PI*2);ctx.fill();}
 const lit=shade(color,22),mid=color,dark=shade(color,-30),darker=shade(color,-48);
 box(-.46,.46,.22,2,9,lit,dark,mid,darker,null);
 // lights on the body ends
 const fl=[P(.46,-.13,6),P(.46,.13,6)],bl=[P(-.46,-.13,6),P(-.46,.13,6)];
 for(const q of fl){ctx.fillStyle='#ffe39a';ctx.fillRect(Math.round(q[0]-1.5),Math.round(q[1]-1),3,2);}
 for(const q of bl){ctx.fillStyle='#e0473c';ctx.fillRect(Math.round(q[0]-1.5),Math.round(q[1]-1),3,2);}
 box(-.24,.18,.17,9,15,shade(color,34),'#2c4654','#3a5e72','#26404e','#8fc8e0');
}
function carSprite(ctx,pt,axis,color){car3d(ctx,{x:pt.x,y:pt.y},axis==='x'?[24,12]:[-24,12],axis==='x'?[-14,7]:[14,7],color);}
function streetPerson(ctx,pt,index,seconds,flip=index%2===1,activity='walk'){
 const x=Math.round(pt.x),y=Math.round(pt.y+4);
 ctx.fillStyle='rgba(9,19,25,.3)';ctx.beginPath();ctx.ellipse(x,y,7,3,0,0,Math.PI*2);ctx.fill();
 if(activity==='sleep'){ctx.save();ctx.translate(x,y-2);ctx.rotate(-Math.PI/2);blit(ctx,humanSprite(index,0),0,8,false);ctx.restore();ctx.fillStyle='#e6f4ee';const z=(seconds*1.2+index*.3)%1;ctx.fillRect(x+10,y-24-z*6,5,2);ctx.fillRect(x+13,y-22-z*6,2,2);ctx.fillRect(x+10,y-20-z*6,5,2);return;}
 blit(ctx,humanSprite(index,Math.floor(seconds*4+index)),x,y,flip);
}
function speechBubble(ctx,x,y,text){
 ctx.font='bold 10px system-ui';const w=Math.ceil(ctx.measureText?.(text)?.width??text.length*10)+10,h=15,l=Math.round(x-w/2),t=Math.round(y-h-6);
 ctx.fillStyle='#24323a';ctx.fillRect(l-1,t-1,w+2,h+2);ctx.fillStyle='#ffffff';ctx.fillRect(l,t,w,h);ctx.fillStyle='#dbe8f2';ctx.fillRect(l,t+h-3,w,3);
 ctx.fillStyle='#24323a';ctx.fillRect(Math.round(x)-3,t+h+1,6,2);ctx.fillRect(Math.round(x)-1,t+h+3,2,2);ctx.fillStyle='#ffffff';ctx.fillRect(Math.round(x)-2,t+h,4,2);
 ctx.fillStyle='#24323a';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,t+h/2);
}
function zombie(ctx,x,y,t,kind=0,activity='walk'){
  const frame=activity==='sleep'?0:Math.floor(t*(activity==='research'?5:3)+kind);
  const bob=activity==='sleep'||activity==='walk'?0:(frame%2);
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(x,y+1,8,3,0,0,Math.PI*2);ctx.fill();
  blit(ctx,zombieSprite(kind,frame,activity),x,y+1-bob,kind%2===1);
  const top=y-33;
  if(activity==='sleep'){const z=(t*1.2+kind*.3)%1;ctx.globalAlpha=1-z;ctx.fillStyle='#e6f4ee';ctx.fillRect(Math.round(x+8+z*6),Math.round(top-z*10),6,2);ctx.fillRect(Math.round(x+12+z*6),Math.round(top+2-z*10),2,2);ctx.fillRect(Math.round(x+8+z*6),Math.round(top+4-z*10),6,2);ctx.globalAlpha=1;}
  if(activity==='research'){ctx.fillStyle='#1b2a2c';ctx.fillRect(x+9,y-17,6,9);ctx.fillStyle='#7ee0c6';ctx.fillRect(x+10,y-14,4,5);if(frame%2){ctx.fillStyle='#e8ffd8';ctx.fillRect(x+11,y-20,2,2);}}
  if(activity==='strike'){ctx.fillStyle='#1b2a2c';ctx.fillRect(x+7,top-6,14,10);ctx.fillStyle='#f2c69a';ctx.fillRect(x+8,top-5,12,8);ctx.fillStyle='#b8423c';ctx.fillRect(x+10,top-3,8,2);ctx.fillStyle='#6b4c3a';ctx.fillRect(x+13,top+4,2,8);}
}
export function drawScene(ctx, world, view, selected, elapsedSeconds, renderSize, game, placement=null) {
  const {width,height}=renderSize, p=PALETTES[world.id];
  ctx.clearRect(0,0,width,height);
  const bg=ctx.createLinearGradient(0,0,0,height);
  bg.addColorStop(0,world.id==='underground'?'#4a3628':'#6fb7d9');bg.addColorStop(1,world.id==='underground'?'#2a1e16':'#3f8bb0');
  ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  ctx.save(); ctx.imageSmoothingEnabled=false; ctx.translate(view.cx,view.cy); ctx.scale(view.zoom,view.zoom);ctx.translate(view.panX,view.panY);
  try{
  // Render in explicit depth passes. Painting buildings inside the tile loop
  // caused later floor diamonds to overwrite the lower walls of buildings.
  for(let diagonal=0;diagonal<=2*(MAP_SIZE-1);diagonal++){
    for(let x=0;x<MAP_SIZE;x++){
      const y=diagonal-x;if(y<0||y>=MAP_SIZE)continue;
      const {x:wx,y:wy}=tileCenter(x,y,view.rotation??0), k=`${x},${y}`;
      const closed=world.closed.has(k), path=world.paths.has(k), accent=world.accents.has(k);
      const tileKind=world.id==='surface'?streetTileKind(world,x,y):'underground';
      let floor=world.id==='surface'?(tileKind==='road'?'#8e9298':tileKind==='sidewalk'?'#e2d3b0':accent?'#9bd27a':((x+y)%2?p.ground1:p.ground2)):closed?p.closed:path?p.path:accent?'#8c7660':((x+y)%2?p.ground1:p.ground2);
      const lotHere=world.id==='surface'&&world.lotDefs?.some(l=>x>=l.x&&x<l.x+l.w&&y>=l.y&&y<l.y+l.h);
      if(lotHere)floor=(world.lotOpen?.(x,y)?'#c8a87a':'#9a8a70');
      const style=world.id==='surface'?(tileKind==='road'?'stripe':tileKind==='sidewalk'?'brick':'noise'):closed?'rubble':path?'slab':'noise';
      const texBase=floor.startsWith('#')?floor:'#3a4a50';
      if(!drawTile(ctx,wx,wy,texBase,style,Math.floor(tileHash(x,y)*4)))diamond(ctx,wx,wy,floor,null);
      ctx.globalAlpha=.35;diamond(ctx,wx,wy,null,world.id==='surface'&&tileKind==='road'?null:p.seam);ctx.globalAlpha=1;
      if(world.id==='surface'&&tileKind==='road'){
        const vertical=[8,9,15,16].includes(x) && ![8,9,15,16].includes(y), horizontal=[8,9,15,16].includes(y) && ![8,9,15,16].includes(x);
        if((vertical&&[9,16].includes(x))||(horizontal&&[9,16].includes(y))){const half=vertical?[-.5,0]:[0,-.5];const along=vertical?[0,.22]:[.22,0];
          const p1=projectedTile(x+half[0]-along[0],y+half[1]-along[1],view.rotation??0),p2=projectedTile(x+half[0]+along[0],y+half[1]+along[1],view.rotation??0);
          ctx.strokeStyle='#f4f1e6';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();}
        if(!vertical&&!horizontal){ctx.fillStyle='rgba(255,255,255,.55)';for(let i=-2;i<=2;i++)ctx.fillRect(wx-14+i*0,wy-1+i*2,28,1);}
      }
      if(closed){ctx.strokeStyle='#2a221e';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(wx-10,wy-5);ctx.lineTo(wx+10,wy+5);ctx.moveTo(wx+10,wy-5);ctx.lineTo(wx-10,wy+5);ctx.stroke();}
      if(selected?.x===x&&selected?.y===y){diamond(ctx,wx,wy,'rgba(242,228,135,.18)',p.selected);}
    }
  }
  const rot=view.rotation??0, list=[], overlays=[];
  const depthOf=(x,y)=>{const t=rotateTile(x,y,rot);return t.x+t.y;};
  for(const b of [...world.buildings,...(world.cityBuildings??[])]){const {parts,overlay}=buildingParts(b,world.connectivity?.[b.id]??true,rot);list.push(...parts);overlays.push(overlay);}
  if(world.id==='surface'){
    const humanCount=world.humanCount??34,trust=world.humanTrust??55;
    for(const v of vehiclesAt(elapsedSeconds,humanCount,trust)){const pt=projectedTile(v.x,v.y,rot);
      const fx=v.axis==='x'?v.dir??1:0,fy=v.axis==='y'?v.dir??1:0,p1=projectedTile(v.x+fx,v.y+fy,rot),p2=projectedTile(v.x-fy,v.y+fx,rot);
      const fvec=[(p1.x-pt.x)*1.15,(p1.y-pt.y)*1.15],svec=[(p2.x-pt.x)*1.15,(p2.y-pt.y)*1.15];
      list.push({depth:depthOf(v.x,v.y),sub:2,draw:ctx=>car3d(ctx,{x:pt.x,y:pt.y+2},fvec,svec,v.color)});}
    for(const walker of pedestriansAt(elapsedSeconds,humanCount)){const t=projectedTile(walker.x,walker.y,rot);list.push({depth:depthOf(walker.x,walker.y),sub:2,draw:ctx=>streetPerson(ctx,t,walker.id,elapsedSeconds)});}
  }
  // v2.2 underground = solid earth. Every undug tile (not a corridor, not under a facility) is a raised
  // block; corridors and rooms are dug out below it, so tunnel walls hide the feet of passing residents.
  const EARTH=10;
  if(world.id==='underground'){
    const dug=new Set(world.paths);for(const b of world.buildings)for(let x=b.x;x<b.x+b.w;x++)for(let y=b.y;y<b.y+b.h;y++)dug.add(x+','+y);
    const rk=new Set();const blocks=[];
    for(let x=0;x<MAP_SIZE;x++)for(let y=0;y<MAP_SIZE;y++){if(dug.has(x+','+y))continue;const t=rotateTile(x,y,rot);rk.add(t.x+','+t.y);blocks.push({x,y,t,closed:world.closed.has(x+','+y)});}
    for(const bl of blocks){const c=projectedTile(bl.x,bl.y,rot),v=Math.floor(tileHash(bl.x,bl.y)*4);
      const frontL=!rk.has(bl.t.x+','+(bl.t.y+1)),frontR=!rk.has((bl.t.x+1)+','+bl.t.y);
      const top=bl.closed?'#4a3c36':'#9a7e62',side=bl.closed?'#2e2420':'#6a523e',side2=bl.closed?'#3a2e28':'#80664c';
      list.push({depth:bl.t.x+bl.t.y,sub:-1.5,draw:ctx=>{
        if(frontL)polygon(ctx,[[c.x-32,c.y-EARTH],[c.x,c.y+16-EARTH],[c.x,c.y+16],[c.x-32,c.y]],side2,null);
        if(frontR)polygon(ctx,[[c.x,c.y+16-EARTH],[c.x+32,c.y-EARTH],[c.x+32,c.y],[c.x,c.y+16]],side,null);
        if(!drawTile(ctx,c.x,c.y-EARTH,top,bl.closed?'rubble':'noise',v))polygon(ctx,[[c.x,c.y-16-EARTH],[c.x+32,c.y-EARTH],[c.x,c.y+16-EARTH],[c.x-32,c.y-EARTH]],top,null);
        if(frontL||frontR){ctx.strokeStyle='rgba(30,20,14,.55)';ctx.lineWidth=1;ctx.beginPath();if(frontL){ctx.moveTo(c.x-32,c.y-EARTH);ctx.lineTo(c.x,c.y+16-EARTH);}else ctx.moveTo(c.x,c.y+16-EARTH);if(frontR)ctx.lineTo(c.x+32,c.y-EARTH);ctx.stroke();}
      }});}
  }
  // scenery props on empty lots / cave floor
  const occupied=new Set();for(const b of [...world.buildings,...(world.cityBuildings??[])])for(let x=b.x;x<b.x+b.w;x++)for(let y=b.y;y<b.y+b.h;y++)occupied.add(x+','+y);
  if(world.id==='surface')for(const l of world.lotDefs??[]){for(let x=l.x;x<l.x+l.w;x++)for(let y=l.y;y<l.y+l.h;y++)occupied.add(x+','+y);
    const st=world.lotState?.[l.id]??{},cx=l.x+(l.w-1)/2,cy=l.y+(l.h-1)/2,pt=projectedTile(cx,cy,rot),open=world.lotOpen?.(l.x,l.y);
    const spr=st.facility==='leech'?'antenna':st.facility==='router'?'router':st.facility==='fiber'?'hut':st.facility==='vending'?'vending':st.facility==='lockers'?'lockers':st.facility==='garden'?'garden':'sign';
    list.push({depth:depthOf(cx,cy),sub:1.6,draw:ctx=>{blit(ctx,prop(spr),pt.x,pt.y+6);
      if(spr==='sign'){ctx.fillStyle='#4a3424';ctx.font='bold 8px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(open?(st.leased?'契約中':'空き地'):'🔒',pt.x,pt.y-6);}
      if(st.facility==='leech'||st.facility==='router'||st.facility==='fiber'){const t=elapsedSeconds;for(let i=0;i<2;i++){const p=(t*.8+i/2)%1;ctx.strokeStyle=`rgba(120,200,255,${1-p})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(pt.x,pt.y-(spr==='hut'?24:20),5+p*14,-2.5,-.6);ctx.stroke();}}}});}
  for(let x=0;x<MAP_SIZE;x++)for(let y=0;y<MAP_SIZE;y++){const k=x+','+y;if(occupied.has(k))continue;const h=tileHash(x*3+1,y*5+2);let name=null;
    if(world.id==='surface'){const kind=streetTileKind(world,x,y);
      if(kind==='lot')name=h<.16?'tree':h<.24?'flowers':h<.3?'bush':h<.32?'bench':null;
      else if(kind==='sidewalk'&&(x*7+y*3)%9===0)name='lamp';}
    else if(!world.paths.has(k)){name=world.closed.has(k)?(h<.08?'crystal':null):h<.05?'mushroom':h<.08?'lantern':h<.1?'crystal':null;}
    if(!name)continue;const pt0=projectedTile(x,y,rot),pt={x:pt0.x,y:pt0.y-(world.id==='underground'?10:0)},dx=(h*7%1-.5)*12;
    list.push({depth:depthOf(x,y),sub:1.5,draw:ctx=>{ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(pt.x+dx,pt.y+4,10,4,0,0,Math.PI*2);ctx.fill();blit(ctx,prop(name),pt.x+dx,pt.y+5);
      if(name==='lantern'||name==='lamp'){const g=ctx.createRadialGradient?.(pt.x+dx,pt.y-(name==='lamp'?20:10),1,pt.x+dx,pt.y-(name==='lamp'?20:10),26);if(!g?.addColorStop)return;g.addColorStop(0,'rgba(255,230,150,.35)');g.addColorStop(1,'rgba(255,230,150,0)');ctx.fillStyle=g;ctx.fillRect(pt.x+dx-26,pt.y-46,52,52);}}});
  }
  const bubbles=[];
  if(world.id==='surface'){
    const night=game?((game.tick%120)>=60):false;
    for(const o of surfaceOccupants(world,elapsedSeconds,{night,humans:world.humanCount??34})){
      const pt=projectedTile(o.x,o.y,rot);
      list.push({depth:depthOf(o.x,o.y),sub:2,draw:ctx=>{streetPerson(ctx,pt,o.id,o.activity==='walk'?elapsedSeconds:0,o.flip,o.activity);
        if(o.carry){ctx.fillStyle='#3a2a1c';ctx.fillRect(Math.round(pt.x-6),Math.round(pt.y-36),12,9);ctx.fillStyle='#c99a62';ctx.fillRect(Math.round(pt.x-5),Math.round(pt.y-35),10,7);}}});
      if(o.bubble)bubbles.push({x:pt.x,y:pt.y-34,text:o.bubble});
    }
  }
  if(game){
    for(const r of visibleResidents(game,world.id,world)){
      if(r.bubble){const c=projectedTile(r.x,r.y,rot);bubbles.push({x:c.x,y:c.y-30,text:r.bubble});}
      const c=projectedTile(r.x,r.y,rot);
      list.push({depth:depthOf(r.x,r.y),sub:2,draw:ctx=>{zombie(ctx,c.x,c.y+7,elapsedSeconds,r.index,r.activity??'walk');
        if(r.status==='出勤中'||r.status==='帰還中'){ctx.fillStyle='#f8e8af';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText(r.status==='出勤中'?'↑':'↓',c.x,c.y-30);}}});
    }
  }
  list.sort((p,q)=>p.depth-q.depth||p.sub-q.sub);
  for(const item of list)item.draw(ctx);
  for(const o of overlays)o(ctx);
  const shown=[];for(const bb of bubbles){if(shown.some(o=>Math.abs(o.x-bb.x)<70&&Math.abs(o.y-bb.y)<18))continue;shown.push(bb);speechBubble(ctx,bb.x,bb.y,bb.text);}
  if(placement && world.id==='underground'){
    const tiles=placement.tiles??[];
    for(const tile of tiles){const pt=projectedTile(tile.x,tile.y,view.rotation??0);diamond(ctx,pt.x,pt.y,placement.valid?'rgba(129,237,159,.42)':'rgba(248,100,100,.38)',placement.valid?'#b7ffc6':'#ffc1bf');}
    if(FACILITY_DEFS[placement.kind]){
      ctx.fillStyle=placement.valid?'#e1ffcd':'#ffe0d0';ctx.font='bold 14px system-ui';ctx.textAlign='center';
      const pt=projectedTile(placement.x,placement.y,view.rotation??0);ctx.fillText(`${placement.w}×${placement.h}`,pt.x,pt.y-30);
    }
  }
  }finally{ctx.restore();}
  // Informational drawing label; not counted as simulation.
  ctx.fillStyle='rgba(10,28,38,.78)';ctx.fillRect(12,12,144,26);
  ctx.fillStyle='#d7e9e8';ctx.font='600 11px system-ui';ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillText(`${MAP_SIZE} × ${MAP_SIZE} · ${((view.rotation??0)%4)*90}°`,24,25);
}
