import { visibleResidents } from './agent.js';
import {streetTileKind,vehiclesAt,pedestriansAt} from './surface-city.js';
import { MAP_SIZE, TILE_HEIGHT, TILE_WIDTH, tileToWorld, projectedTile, worldToView } from './geometry.js';

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
  return {a:tileToWorld(nw.x,nw.y), r:tileToWorld(ne.x,ne.y), d:tileToWorld(se.x,se.y), l:tileToWorld(sw.x,sw.y)};
}

function projectedBuildingAnchor(b,rotation=0){
  const c=rotateGridPoint(b.x+b.w/2,b.y+b.h/2,rotation);
  return tileToWorld(c.x,c.y);
}


const PALETTES = {
  underground: { ground1:'#283c49', ground2:'#2d4350', edge:'#172b33', seam:'#416070', selected:'#e9e89a', closed:'#192a33', path:'#586b70' },
  surface: { ground1:'#455b59', ground2:'#4b635f', edge:'#283d42', seam:'#6a827c', selected:'#e9e89a', closed:'#283d42', path:'#72847c' }
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
// All details are drawn from small aligned pixel blocks for a unified sprite scale.
function buildingShape(ctx,b,connected=true,rotation=0) {
  const {a,r,d,l}=projectedBuildingCorners(b,rotation);
  const colors={home:['#9e9477','#6e8892','#92b4bb'],shop:['#ad8867','#ae7562','#e1b987'],exit:['#6c9b8e','#52817d','#b2d9c6'],humanHome:['#807998','#78668b','#baafc8'],market:['#9a795f','#996b60','#dcb38f'],warehouse:['#667a87','#5f7085','#96b3bf'],clinic:['#84a79d','#7f9b9d','#d3ebe2'],cafe:['#ab805d','#a47661','#e7c59e'],lab:['#817ca2','#6c6eaa','#b4b4df']};
  const [floor,wall,trim]=colors[b.kind]??colors.home;
  const height=b.kind==='exit'?10:22;
  const wallBorder='#293f4a';
  const floorBorder='#f1eed7';

  polygon(ctx,[[a.x,a.y],[r.x,r.y],[r.x,r.y-height],[a.x,a.y-height]],wall,wallBorder,1.4);
  polygon(ctx,[[a.x,a.y],[l.x,l.y],[l.x,l.y-height],[a.x,a.y-height]],trim,wallBorder,1.4);
  polygon(ctx,[[a.x,a.y],[r.x,r.y],[d.x,d.y],[l.x,l.y]],floor,floorBorder,1.8);

  // back-wall windows / openings
  const wallPixel=(x,y,w,h,color,stroke=null)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h); if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.strokeRect(Math.round(x)+.5,Math.round(y)+.5,w-1,h-1);}};
  if(b.kind!=='exit'){
    wallPixel(a.x+(r.x-a.x)*0.34-4,a.y+(r.y-a.y)*0.34-height+6,8,5,'#efe8cf');
    wallPixel(a.x+(l.x-a.x)*0.58-4,a.y+(l.y-a.y)*0.58-height+6,8,5,'#efe8cf');
  }

  for(let ix=0;ix<b.w;ix++)for(let iy=0;iy<b.h;iy++){
    const q=rotateGridPoint(b.x+ix+0.5,b.y+iy+0.5,rotation);
    const pt=tileToWorld(q.x,q.y);
    ctx.fillStyle=((ix+iy)&1)?'#ffffff14':'#10212b10';
    ctx.beginPath();ctx.moveTo(pt.x,pt.y-9);ctx.lineTo(pt.x+18,pt.y);ctx.lineTo(pt.x,pt.y+9);ctx.lineTo(pt.x-18,pt.y);ctx.closePath();ctx.fill();
  }

  const center=projectedBuildingAnchor(b,rotation);
  const cx=center.x, cy=center.y;
  const block=(x,y,w,h,color,stroke=null)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h); if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.strokeRect(Math.round(x)+.5,Math.round(y)+.5,w-1,h-1);}};
  if(['home','humanHome'].includes(b.kind)){
    block(cx-28,cy-8,20,12,'#55697c','#d7decb'); block(cx-26,cy-12,16,6,'#dbe2d6');
    block(cx+4,cy-14,16,18,'#6c5448','#d0b08b'); block(cx+6,cy-10,12,5,'#e8c48a');
    block(cx-6,cy-10,5,14,'#85604b'); block(cx-28,cy+8,26,4,'#776556'); block(cx+3,cy+7,16,3,'#41596b');
  }else if(['shop','market','cafe'].includes(b.kind)){
    block(cx-28,cy-10,39,12,'#59483d','#e2bf8d'); block(cx-26,cy-15,35,6,'#d6a567');
    for(let i=0;i<4;i++)block(cx-23+i*8,cy-22,5,6,['#95c4a5','#e5d8a4','#ba9dc6','#c49f85'][i],'#edf0dc');
    block(cx+13,cy-8,14,18,'#4a6763','#cde1d9'); block(cx+15,cy-6,10,7,'#7db3b5'); block(cx-12,cy+7,18,3,'#6d594a');
  }else if(b.kind==='lab'||b.kind==='clinic'){
    block(cx-28,cy-10,36,11,'#546b88','#d7e8ea'); block(cx-25,cy-17,30,7,'#e5f1ec');
    block(cx-19,cy-23,8,8,'#8bdbcf'); block(cx-4,cy-25,8,10,'#9fa5f0'); block(cx+11,cy-23,7,8,'#efb4a9');
    block(cx+10,cy+4,16,10,'#657680','#dfe7e4');
  }else if(b.kind==='warehouse'){
    for(let i=0;i<3;i++){block(cx-27+i*18,cy-8+(i%2)*5,15,14,'#ad8a64','#e4c79f'); block(cx-24+i*18,cy-14+(i%2)*5,10,5,'#d9b887');}
    block(cx+11,cy+3,13,10,'#586a75','#cad5d7');
  }else{
    block(cx-12,cy-9,24,15,'#4b847d','#c4e6d0'); block(cx-6,cy-15,12,7,'#c0e1c2');
  }

  const px=cx, py=cy-34;
  ctx.fillStyle='#1d3844';ctx.fillRect(Math.round(px-10),Math.round(py-10),20,20);
  ctx.strokeStyle=connected===false?'#f0a28f':'#b0d6c4';ctx.lineWidth=1.5;ctx.strokeRect(Math.round(px-10),Math.round(py-10),20,20);
  ctx.fillStyle='#f8e9b0';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(connected===false?'!':(({home:'⌂',shop:'★',exit:'↕',humanHome:'⌂',market:'★',warehouse:'▣',clinic:'✚',cafe:'♨',lab:'⚗'})[b.kind]??'•'),px,py);
}
function carSprite(ctx,pt,axis,color){
 const major=axis==='x'?[13,6]:[-13,6];
 const perp=axis==='x'?[8,-4]:[8,4];
 const x=pt.x,y=pt.y-4;
 const center=(a,b)=>[x+a*major[0]+b*perp[0],y+a*major[1]+b*perp[1]];
 ctx.fillStyle='rgba(9,19,25,.28)';ctx.beginPath();ctx.ellipse(x,y+10,12,5,0,0,Math.PI*2);ctx.fill();
 polygon(ctx,[center(-.82,-.52),center(.82,-.52),center(.82,.52),center(-.82,.52)],'#101c24','#20343f',1.8);
 const bumper=center(.76,0);ctx.fillStyle='#202e35';ctx.fillRect(Math.round(bumper[0]-5),Math.round(bumper[1]+4),10,4);
 polygon(ctx,[center(-.72,-.42),center(.72,-.42),center(.72,.42),center(-.72,.42)],color,'#dfe0cf',1.3);
 polygon(ctx,[center(-.18,-.34),center(.36,-.34),center(.46,.02),center(.10,.34),center(-.24,.34),center(-.32,.02)],'#355264','#e5f1ef',1.0);
 polygon(ctx,[center(-.55,-.33),center(-.12,-.33),center(-.08,.33),center(-.48,.33)],'#2f4654','#d7ece7',0.9);
 polygon(ctx,[center(.40,-.26),center(.62,-.18),center(.62,.18),center(.40,.26)],'#7e9cab','#d7ece7',0.9);
 for(const t of [-.30,.30]){ const c=center(.74,t); ctx.fillStyle='#ffe39a'; ctx.fillRect(c[0]-2,c[1]-2,4,3); }
 for(const t of [-.28,.28]){ const c=center(-.76,t); ctx.fillStyle='#c9595f'; ctx.fillRect(c[0]-2,c[1]-2,4,3); }
 for(const [a,b] of [[-.45,-.54],[-.45,.54],[.45,-.54],[.45,.54]]){ const c=center(a,b); ctx.fillStyle='#1b2328'; ctx.fillRect(c[0]-2,c[1]-2,4,4); }
}
function streetPerson(ctx,pt,index,seconds){
 const x=Math.round(pt.x),y=Math.round(pt.y+Math.sin(seconds*4+index)*1.5);
 ctx.fillStyle='#14232a80';ctx.fillRect(x-5,y+5,11,3);
 ctx.fillStyle=['#f0c5a0','#ad816c','#d9b69b','#a87969'][index%4];ctx.fillRect(x-3,y-12,7,7);
 ctx.fillStyle=['#93acc9','#cd8f76','#b8ad7b','#8daea0','#c8a7ae'][index%5];ctx.fillRect(x-4,y-5,9,9);
 ctx.fillStyle='#273743';ctx.fillRect(x-4,y+4,3,5);ctx.fillRect(x+2,y+4,3,5);
}
function zombie(ctx, x,y,t,kind=0,activity='walk') {
  const bob=activity==='sleep'?0:Math.sin(t*(activity==='research'?4:2)+kind)*1.3;
  ctx.fillStyle='rgba(0,0,0,.26)';ctx.beginPath();ctx.ellipse(x,y+7,9,4,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=['#a0bc92','#a5bfb1','#b3c29c','#98c7ae','#c6b89f'][kind%5];
  ctx.fillRect(x-7,y-13+bob,14,14);
  ctx.fillStyle='#465764';ctx.fillRect(x-6,y+bob,5,7);ctx.fillRect(x+1,y+bob,5,7);
  ctx.fillStyle='#263d41';ctx.fillRect(x-4,y-8+bob,3,3);ctx.fillRect(x+3,y-8+bob,3,3);
  ctx.fillStyle='#d5d7b8';ctx.fillRect(x-2,y-2+bob,5,2);
  ctx.fillStyle='#576e62';ctx.fillRect(x-7,y-10+bob,2,5);ctx.fillRect(x+5,y-10+bob,2,5);
  ctx.fillStyle='#c0d7c4';ctx.fillRect(x-5,y-11+bob,3,2);ctx.fillStyle='#233c3f';ctx.fillRect(x-3,y+7+bob,4,2);ctx.fillRect(x+3,y+7+bob,4,2);
  ctx.fillStyle='#a34d5b';ctx.fillRect(x-6,y-1+bob,3,3);
  if(activity==='sleep'){ctx.fillStyle='#d9ede5';ctx.font='bold 11px monospace';ctx.fillText('z',x+9,y-20+bob);}
  if(activity==='research'){ctx.fillStyle='#92ebd7';ctx.fillRect(x+8,y-5+bob,4,7);ctx.fillStyle='#e8e4b5';ctx.fillRect(x+7,y-9+bob,6,4);}
  if(activity==='strike'){ctx.fillStyle='#e7ab89';ctx.fillRect(x+7,y-21+bob,6,4);}
}
export function drawScene(ctx, world, view, selected, elapsedSeconds, renderSize, game, placement=null) {
  const {width,height}=renderSize, p=PALETTES[world.id];
  ctx.clearRect(0,0,width,height);
  const bg=ctx.createLinearGradient(0,0,0,height);
  bg.addColorStop(0,world.id==='underground'?'#132a36':'#263a48');bg.addColorStop(1,world.id==='underground'?'#091b28':'#1a3036');
  ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  ctx.save(); ctx.translate(view.cx,view.cy); ctx.scale(view.zoom,view.zoom);ctx.translate(view.panX,view.panY);
  // Render in explicit depth passes. Painting buildings inside the tile loop
  // caused later floor diamonds to overwrite the lower walls of buildings.
  for(let diagonal=0;diagonal<=2*(MAP_SIZE-1);diagonal++){
    for(let x=0;x<MAP_SIZE;x++){
      const y=diagonal-x;if(y<0||y>=MAP_SIZE)continue;
      const {x:wx,y:wy}=tileCenter(x,y,view.rotation??0), k=`${x},${y}`;
      const closed=world.closed.has(k), path=world.paths.has(k), accent=world.accents.has(k);
      const tileKind=world.id==='surface'?streetTileKind(world,x,y):'underground';
      const floor=world.id==='surface'?(tileKind==='road'?'#39474d':tileKind==='sidewalk'?'#86918c':accent?'#678476':((x+y)%2?p.ground1:p.ground2)):closed?p.closed:path?p.path:accent?'#60736e':((x+y)%2?p.ground1:p.ground2);
      diamond(ctx,wx,wy,floor,world.id==='surface'?(tileKind==='road'?null:tileKind==='sidewalk'?'#a2aca5':p.seam):p.seam);
      if(world.id==='surface'&&tileKind==='road'){
        const vertical=[8,9,15,16].includes(x) && ![8,9,15,16].includes(y);
        const horizontal=[8,9,15,16].includes(y) && ![8,9,15,16].includes(x);
        if(vertical&&y%4===1){ polygon(ctx,[[wx-3,wy-10],[wx+3,wy-7],[wx+3,wy+7],[wx-3,wy+10]],'#d7cfac',null); }
        else if(horizontal&&x%4===1){ polygon(ctx,[[wx-12,wy],[wx,wy-6],[wx+12,wy],[wx,wy+6]],'#d7cfac',null); }
      }
      if(world.id==='surface'&&tileKind==='sidewalk'&&((x*7+y*3)%11===0)){
        ctx.fillStyle='#355d50';ctx.fillRect(wx-3,wy-12,7,9);ctx.fillStyle='#618b70';ctx.fillRect(wx-8,wy-20,15,11);ctx.fillStyle='#8cb398';ctx.fillRect(wx-5,wy-23,9,5);
      }
      if(closed){ctx.strokeStyle='#40535c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(wx-10,wy-5);ctx.lineTo(wx+10,wy+5);ctx.moveTo(wx+10,wy-5);ctx.lineTo(wx-10,wy+5);ctx.stroke();}
      if(selected?.x===x&&selected?.y===y){diamond(ctx,wx,wy,'rgba(242,228,135,.18)',p.selected);}
    }
  }
  // Depth sort by the front-most footprint corner (isometric painter's order).
  const orderedBuildings=[...world.buildings,...(world.cityBuildings??[])].sort((a,b)=>{
    const ac=projectedBuildingCorners(a,view.rotation??0), bc=projectedBuildingCorners(b,view.rotation??0);
    return ac.d.y-bc.d.y || ac.d.x-bc.d.x || ac.a.y-bc.a.y;
  });
  for(const b of orderedBuildings)buildingShape(ctx,b,world.connectivity?.[b.id]??true,view.rotation??0);
  if(placement && world.id==='underground'){
    const tiles=placement.tiles??[];
    for(const tile of tiles){const pt=projectedTile(tile.x,tile.y,view.rotation??0);diamond(ctx,pt.x,pt.y,placement.valid?'rgba(129,237,159,.42)':'rgba(248,100,100,.38)',placement.valid?'#b7ffc6':'#ffc1bf');}
    if(['home','shop','lab'].includes(placement.kind)){
      ctx.fillStyle=placement.valid?'#e1ffcd':'#ffe0d0';ctx.font='bold 14px system-ui';ctx.textAlign='center';
      const pt=projectedTile(placement.x,placement.y,view.rotation??0);ctx.fillText(`${placement.w}×${placement.h}`,pt.x,pt.y-30);
    }
  }
  // Street life: separate pedestrian and vehicle streams, tied to human population.
  if(world.id==='surface'){
    const humanCount=world.humanCount??34,trust=world.humanTrust??55;
    for(const v of vehiclesAt(elapsedSeconds,humanCount,trust)){
      const pt=projectedTile(v.x,v.y,view.rotation??0);
      carSprite(ctx,pt,(view.rotation??0)%2===0?v.axis:(v.axis==='x'?'y':'x'),v.color);
    }
    for(const walker of pedestriansAt(elapsedSeconds,humanCount)){
      const t=projectedTile(walker.x,walker.y,view.rotation??0);
      streetPerson(ctx,t,walker.id,elapsedSeconds);
    }
  }
  if(game){
    for(const r of visibleResidents(game,world.id,world)){
      const c=projectedTile(r.x,r.y,view.rotation??0);
      zombie(ctx,c.x,c.y+7,elapsedSeconds,r.index,r.activity??'walk');
      if(r.status==='出勤中'||r.status==='帰還中'){
        ctx.fillStyle='#f8e8af';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText(r.status==='出勤中'?'↑':'↓',c.x,c.y-23);
      }
    }
  }
  ctx.restore();
  // Informational drawing label; not counted as simulation.
  ctx.fillStyle='rgba(10,28,38,.78)';ctx.fillRect(12,12,144,26);
  ctx.fillStyle='#d7e9e8';ctx.font='600 11px system-ui';ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillText(`${MAP_SIZE} × ${MAP_SIZE} · ${((view.rotation??0)%4)*90}°`,24,25);
}
