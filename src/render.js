import { visibleResidents } from './agent.js';
import { MAP_SIZE, TILE_HEIGHT, TILE_WIDTH, tileToWorld, projectedTile, projectedFootprint, worldToView } from './geometry.js';

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
  const f=projectedFootprint(b,rotation);
  const a=tileToWorld(f.x,f.y),r=tileToWorld(f.x+f.w,f.y),d=tileToWorld(f.x+f.w,f.y+f.h),l=tileToWorld(f.x,f.y+f.h);
  const colors={home:['#9e9477','#6e8892','#92b4bb'],shop:['#ad8867','#ae7562','#e1b987'],exit:['#6c9b8e','#52817d','#b2d9c6'],humanHome:['#807998','#78668b','#baafc8'],market:['#9a795f','#996b60','#dcb38f'],warehouse:['#667a87','#5f7085','#96b3bf'],clinic:['#84a79d','#7f9b9d','#d3ebe2'],cafe:['#ab805d','#a47661','#e7c59e'],lab:['#817ca2','#6c6eaa','#b4b4df']};
  const [floor,wall,trim]=colors[b.kind]??colors.home;
  const height=b.kind==='exit'?10:21;
  const wallBorder='#293f4a';
  // Back wall edges a-r and a-l; front edges are deliberately missing.
  polygon(ctx,[[a.x,a.y],[r.x,r.y],[r.x,r.y-height],[a.x,a.y-height]],wall,wallBorder,1.2);
  polygon(ctx,[[a.x,a.y],[l.x,l.y],[l.x,l.y-height],[a.x,a.y-height]],trim,wallBorder,1.2);
  // Interior floor surface with a bright raised perimeter.
  polygon(ctx,[[a.x,a.y],[r.x,r.y],[d.x,d.y],[l.x,l.y]],floor,'#dbddbd',1.5);
  // Flooring seams (one checker per tile) keep rooms legible behind furnishing.
  for(let ix=0;ix<f.w;ix++)for(let iy=0;iy<f.h;iy++){
    const pt=tileToWorld(f.x+ix+.5,f.y+iy+.5);
    ctx.fillStyle=((ix+iy)&1)?'#ffffff12':'#071a2516';
    ctx.beginPath();ctx.moveTo(pt.x,pt.y-9);ctx.lineTo(pt.x+18,pt.y);ctx.lineTo(pt.x,pt.y+9);ctx.lineTo(pt.x-18,pt.y);ctx.closePath();ctx.fill();
  }
  // Furniture and fixtures, drawn in a readable common pixel grid.
  const cx=(a.x+d.x)/2,cy=(a.y+d.y)/2;
  const block=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
  if(['home','humanHome'].includes(b.kind)){
    block(cx-19,cy-4,19,12,'#4d6279');block(cx-17,cy-6,16,8,'#cfd8c7');block(cx-17,cy-6,6,4,'#f5efdb');
    block(cx+11,cy-9,11,13,'#684d40');block(cx+12,cy-11,9,4,'#e3b786');
  }else if(['shop','market','cafe'].includes(b.kind)){
    block(cx-19,cy-9,31,11,'#55463b');block(cx-18,cy-13,29,7,'#d6a86c');
    for(let i=0;i<4;i++)block(cx-14+i*7,cy-15,4,5,['#95c4a5','#e5d8a4','#ba9dc6','#c49f85'][i]);
    block(cx+11,cy+8,12,6,'#4d6964');
  }else if(b.kind==='lab'||b.kind==='clinic'){
    block(cx-18,cy-9,34,10,'#556c88');block(cx-16,cy-14,29,6,'#e0f0eb');
    block(cx-10,cy-18,6,6,'#8bdbcf');block(cx+4,cy-20,6,8,'#9fa5f0');
    block(cx+12,cy+7,12,7,'#64747b');
  }else if(b.kind==='warehouse'){
    for(let i=0;i<3;i++){block(cx-21+i*15,cy-7+(i%2)*5,13,12,'#ad8a64');block(cx-20+i*15,cy-5+(i%2)*5,11,2,'#d9b887');}
  }else{block(cx-8,cy-7,17,13,'#4b847d');block(cx-4,cy-11,9,7,'#c0e1c2');}
  // A compact overhead room marker that remains visible at low zoom.
  const px=cx,py=cy-35;
  ctx.fillStyle='#1d3844';ctx.fillRect(Math.round(px-10),Math.round(py-10),20,20);
  ctx.strokeStyle=connected===false?'#f0a28f':'#b0d6c4';ctx.lineWidth=1.5;ctx.strokeRect(Math.round(px-10),Math.round(py-10),20,20);
  ctx.fillStyle='#f8e9b0';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(connected===false?'!':(({home:'⌂',shop:'★',exit:'↕',humanHome:'⌂',market:'★',warehouse:'▣',clinic:'✚',cafe:'♨',lab:'⚗'})[b.kind]??'•'),px,py);
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
  // Render in explicit depth passes. Painting buildings inside the tile loop
  // caused later floor diamonds to overwrite the lower walls of buildings.
  for(let diagonal=0;diagonal<=2*(MAP_SIZE-1);diagonal++){
    for(let x=0;x<MAP_SIZE;x++){
      const y=diagonal-x;if(y<0||y>=MAP_SIZE)continue;
      const {x:wx,y:wy}=tileCenter(x,y,view.rotation??0), k=`${x},${y}`;
      const closed=world.closed.has(k), path=world.paths.has(k), accent=world.accents.has(k);
      const floor= closed?p.closed:path?p.path:accent?'#60736e':((x+y)%2?p.ground1:p.ground2);
      diamond(ctx,wx,wy,floor,p.seam);
      if(closed){ctx.strokeStyle='#40535c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(wx-10,wy-5);ctx.lineTo(wx+10,wy+5);ctx.moveTo(wx+10,wy-5);ctx.lineTo(wx-10,wy+5);ctx.stroke();}
      if(selected?.x===x&&selected?.y===y){diamond(ctx,wx,wy,'rgba(242,228,135,.18)',p.selected);}
    }
  }
  // Depth sort by the front-most footprint corner (isometric painter's order).
  const orderedBuildings=[...world.buildings].sort((a,b)=>{
    const x=projectedFootprint(a,view.rotation??0),y=projectedFootprint(b,view.rotation??0);
    return (x.x+x.y+x.w+x.h)-(y.x+y.y+y.w+y.h)||x.x-y.x;
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
  // Residents are projected from the deterministic sim state on both layers.
  if(world.id==='surface'){
    const count=Math.min(14,Math.max(2,Math.round((world.humanCount??34)/6)));
    for(let i=0;i<count;i++){const x=(i*7+3)%MAP_SIZE,y=(i*11+8)%MAP_SIZE;if(world.buildings.some(b=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h))continue;
      const p=projectedTile(x,y,view.rotation??0),step=Math.sin(elapsedSeconds*1.2+i)*3;ctx.fillStyle='#ddba9b';ctx.fillRect(p.x-3,p.y-12+step,7,7);ctx.fillStyle=['#a3c3dc','#e3ac99','#9cb5a2'][i%3];ctx.fillRect(p.x-4,p.y-5+step,9,8);ctx.fillStyle='#21343f';ctx.fillRect(p.x-3,p.y+3+step,3,5);ctx.fillRect(p.x+2,p.y+3+step,3,5);
    }
  }
  if(game){
    for(const r of visibleResidents(game,world.id)){
      const c=projectedTile(r.x,r.y,view.rotation??0);
      zombie(ctx,c.x,c.y+7,elapsedSeconds,r.index);
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
