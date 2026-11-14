import { visibleResidents } from './agent.js';
import { MAP_SIZE, TILE_HEIGHT, TILE_WIDTH, tileToWorld, worldToView } from './geometry.js';

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
function tileCenter(tx,ty) { return tileToWorld(tx,ty); }
function buildingShape(ctx,b,connected=true) {
  // Structural mass uses the footprint's isometric corners and renders above ground.
  const a=tileToWorld(b.x,b.y), r=tileToWorld(b.x+b.w,b.y), d=tileToWorld(b.x+b.w,b.y+b.h), l=tileToWorld(b.x,b.y+b.h);
  const ht = b.kind==='exit'?19: b.kind==='shop'||b.kind==='market'?42:54;
  const colors = {
    home:['#8fa5af','#567b8c','#3a596e'], shop:['#deb784','#a77261','#865455'], exit:['#9ac9bc','#4d827c','#376560'],
    humanHome:['#bfa7b4','#796b92','#6a587c'],market:['#d7a58f','#9d665d','#80535a'],warehouse:['#8b9ca5','#526b7d','#3e5667'],clinic:['#d0e0e0','#85a9a1','#648d8c'],cafe:['#efb783','#a77652','#815c49'],lab:['#b1b3d8','#7978b0','#535483']
  };
  const [roof,right,left]=colors[b.kind]??colors.home;
  polygon(ctx,[[l.x,l.y],[d.x,d.y],[d.x,d.y-ht],[l.x,l.y-ht]],right,'#223846',1.5);
  polygon(ctx,[[r.x,r.y],[d.x,d.y],[d.x,d.y-ht],[r.x,r.y-ht]],left,'#223846',1.5);
  polygon(ctx,[[a.x,a.y-ht],[r.x,r.y-ht],[d.x,d.y-ht],[l.x,l.y-ht]],roof,'#d4d2b7',1.5);
  // Slanted front faces: window and door lights.
  const mx=(l.x+d.x)/2, my=(l.y+d.y)/2;
  polygon(ctx,[[mx-8,my-ht*0.42],[mx+1,my-ht*0.42+4],[mx+1,my-ht*0.42+13],[mx-8,my-ht*0.42+9]],'#f1d09c');
  if(b.kind!=='exit'){
    const wx=(r.x+d.x)/2,wy=(r.y+d.y)/2;
    polygon(ctx,[[wx-7,wy-ht*0.54],[wx+1,wy-ht*0.54-4],[wx+1,wy-ht*0.54+4],[wx-7,wy-ht*0.54+8]],'#d5dbc5');
  }
  // Tile-based pixel windows and roof ornaments add visual identity without asset downloads.
  const decorations=b.kind==='clinic'?3:b.kind==='market'||b.kind==='cafe'?2:1;
  ctx.fillStyle=b.kind==='clinic'?'#e8fff5':'#ffd68a';
  for(let i=0;i<decorations;i++){const f=(i+1)/(decorations+1);const fx=l.x+(d.x-l.x)*f,fy=l.y+(d.y-l.y)*f-ht*.42;ctx.fillRect(Math.round(fx)-3,Math.round(fy),6,5);}
  if(b.kind==='exit') {
    const cx=(a.x+d.x)/2,cy=(a.y+d.y)/2 - ht - 1;
    ctx.fillStyle='#243f48'; ctx.fillRect(cx-9,cy-4,18,8); ctx.fillStyle='#d7f3c1';ctx.fillRect(cx-4,cy-3,8,6);
  }
  // Facility status marker anchored to roof.
  const cx=(a.x+d.x)/2, cy=(a.y+d.y)/2-ht-14;
  ctx.fillStyle='#223d49';ctx.beginPath();ctx.arc(cx,cy,11,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f8e9b0';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(connected===false?'!':(({home:'⌂',shop:'★',exit:'↕',humanHome:'⌂',market:'★',warehouse:'▣',clinic:'✚',cafe:'♨',lab:'⚗'})[b.kind]??'•'),cx,cy);
  if(connected===false){ctx.strokeStyle='#f4a799';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,13,0,Math.PI*2);ctx.stroke();}
}
function zombie(ctx, x,y,t,kind=0) {
  const bob=Math.sin(t*2+kind)*1.3;
  ctx.fillStyle='rgba(0,0,0,.26)';ctx.beginPath();ctx.ellipse(x,y+7,9,4,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=['#a0bc92','#a5bfb1','#b3c29c','#98c7ae','#c6b89f'][kind%5];
  ctx.fillRect(x-7,y-13+bob,14,14);
  ctx.fillStyle='#465764';ctx.fillRect(x-6,y+bob,5,7);ctx.fillRect(x+1,y+bob,5,7);
  ctx.fillStyle='#263d41';ctx.fillRect(x-4,y-8+bob,3,3);ctx.fillRect(x+3,y-8+bob,3,3);
  ctx.fillStyle='#d5d7b8';ctx.fillRect(x-2,y-2+bob,5,2);
  ctx.fillStyle='#576e62';ctx.fillRect(x-7,y-10+bob,2,5);ctx.fillRect(x+5,y-10+bob,2,5);
  ctx.fillStyle='#c0d7c4';ctx.fillRect(x-5,y-11+bob,3,2);ctx.fillStyle='#233c3f';ctx.fillRect(x-3,y+7+bob,4,2);ctx.fillRect(x+3,y+7+bob,4,2);
  ctx.fillStyle='#a34d5b';ctx.fillRect(x-6,y-1+bob,3,3);
}
export function drawScene(ctx, world, view, selected, elapsedSeconds, renderSize, game, placement=null) {
  const {width,height}=renderSize, p=PALETTES[world.id];
  ctx.clearRect(0,0,width,height);
  const bg=ctx.createLinearGradient(0,0,0,height);
  bg.addColorStop(0,world.id==='underground'?'#132a36':'#263a48');bg.addColorStop(1,world.id==='underground'?'#091b28':'#1a3036');
  ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  ctx.save(); ctx.translate(view.cx,view.cy); ctx.scale(view.zoom,view.zoom);ctx.translate(view.panX,view.panY);
  const bAt={};
  for (const b of world.buildings) {
    const last=(b.x+b.w-1)+(b.y+b.h-1);
    (bAt[last]??=[]).push(b);
  }
  for(let diagonal=0;diagonal<=2*(MAP_SIZE-1);diagonal++){
    for(let x=0;x<MAP_SIZE;x++){
      const y=diagonal-x;if(y<0||y>=MAP_SIZE)continue;
      const {x:wx,y:wy}=tileCenter(x,y), k=`${x},${y}`;
      const closed=world.closed.has(k), path=world.paths.has(k), accent=world.accents.has(k);
      const floor= closed?p.closed:path?p.path:accent?'#60736e':((x+y)%2?p.ground1:p.ground2);
      diamond(ctx,wx,wy,floor,p.seam);
      if(closed){ctx.strokeStyle='#40535c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(wx-10,wy-5);ctx.lineTo(wx+10,wy+5);ctx.moveTo(wx+10,wy-5);ctx.lineTo(wx-10,wy+5);ctx.stroke();}
      if(selected?.x===x&&selected?.y===y){diamond(ctx,wx,wy,'rgba(242,228,135,.18)',p.selected);}
    }
    for(const b of bAt[diagonal]??[])buildingShape(ctx,b,world.connectivity?.[b.id]??true);
  }
  if(placement && world.id==='underground'){
    const tiles=placement.tiles??[];
    for(const tile of tiles){const pt=tileToWorld(tile.x,tile.y);diamond(ctx,pt.x,pt.y,placement.valid?'rgba(129,237,159,.42)':'rgba(248,100,100,.38)',placement.valid?'#b7ffc6':'#ffc1bf');}
    if(['home','shop','lab'].includes(placement.kind)){
      ctx.fillStyle=placement.valid?'#e1ffcd':'#ffe0d0';ctx.font='bold 14px system-ui';ctx.textAlign='center';
      const pt=tileToWorld(placement.x,placement.y);ctx.fillText(`${placement.w}×${placement.h}`,pt.x,pt.y-30);
    }
  }
  // Residents are projected from the deterministic sim state on both layers.
  if(world.id==='surface'){
    const count=Math.min(14,Math.max(2,Math.round((world.humanCount??34)/6)));
    for(let i=0;i<count;i++){const x=(i*7+3)%MAP_SIZE,y=(i*11+8)%MAP_SIZE;if(world.buildings.some(b=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h))continue;
      const p=tileToWorld(x,y),step=Math.sin(elapsedSeconds*1.2+i)*3;ctx.fillStyle='#ddba9b';ctx.fillRect(p.x-3,p.y-12+step,7,7);ctx.fillStyle=['#a3c3dc','#e3ac99','#9cb5a2'][i%3];ctx.fillRect(p.x-4,p.y-5+step,9,8);ctx.fillStyle='#21343f';ctx.fillRect(p.x-3,p.y+3+step,3,5);ctx.fillRect(p.x+2,p.y+3+step,3,5);
    }
  }
  if(game){
    for(const r of visibleResidents(game,world.id)){
      const c=tileToWorld(r.x,r.y);
      zombie(ctx,c.x,c.y+7,elapsedSeconds,r.index);
      if(r.status==='出勤中'||r.status==='帰還中'){
        ctx.fillStyle='#f8e8af';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText(r.status==='出勤中'?'↑':'↓',c.x,c.y-23);
      }
    }
  }
  ctx.restore();
  // Informational drawing label; not counted as simulation.
  ctx.fillStyle='rgba(10,28,38,.78)';ctx.fillRect(12,12,144,26);
  ctx.fillStyle='#d7e9e8';ctx.font='600 11px system-ui';ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillText(`${MAP_SIZE} × ${MAP_SIZE} · ゾンビタウン`,24,25);
}
