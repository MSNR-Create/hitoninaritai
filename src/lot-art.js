// v3.0 hand-placed pixel art for surface lot facilities (2×2 tiles, centered on the lot).
// Iso helpers: u runs down-right, v runs down-left; 32 units = one tile edge; z is height in px.
export const P=(cx,cy,u,v,z=0)=>[Math.round(cx+(u-v)),Math.round(cy+(u+v)/2-z)];
export function poly(ctx,pts,fill,stroke){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function pad(ctx,cx,cy,fill,edge,inset=4){poly(ctx,[P(cx,cy,-32+inset,-32+inset),P(cx,cy,32-inset,-32+inset),P(cx,cy,32-inset,32-inset),P(cx,cy,-32+inset,32-inset)],fill,edge);}
/** Box with visible top, +u (right) face and +v (left) face. Optional face painters receive (s,t)->point mappers. */
export function box(ctx,cx,cy,u0,u1,v0,v1,h,c,{right,left,top}={}){
 poly(ctx,[P(cx,cy,u1,v0),P(cx,cy,u1,v1),P(cx,cy,u1,v1,h),P(cx,cy,u1,v0,h)],c[2],c[3]);
 poly(ctx,[P(cx,cy,u0,v1),P(cx,cy,u1,v1),P(cx,cy,u1,v1,h),P(cx,cy,u0,v1,h)],c[1],c[3]);
 poly(ctx,[P(cx,cy,u0,v0,h),P(cx,cy,u1,v0,h),P(cx,cy,u1,v1,h),P(cx,cy,u0,v1,h)],c[0],c[3]);
 const R=(s,t)=>P(cx,cy,u1,v0+(v1-v0)*s,h*t),L=(s,t)=>P(cx,cy,u0+(u1-u0)*s,v1,h*t),T=(s,t)=>P(cx,cy,u0+(u1-u0)*s,v0+(v1-v0)*t,h);
 right?.(R);left?.(L);top?.(T);}
export const quad=(ctx,M,s0,s1,t0,t1,fill,stroke)=>poly(ctx,[M(s0,t0),M(s1,t0),M(s1,t1),M(s0,t1)],fill,stroke);
export function shadow(ctx,cx,cy,u0,u1,v0,v1){poly(ctx,[P(cx,cy,u0+3,v0+3),P(cx,cy,u1+6,v0+3),P(cx,cy,u1+6,v1+6),P(cx,cy,u0+3,v1+6)],'rgba(0,0,0,.22)');}
function pole(ctx,x,y,h,col='#6a6f78'){ctx.fillStyle='#2e3238';ctx.fillRect(x-1,y-h,3,h);ctx.fillStyle=col;ctx.fillRect(x,y-h,1,h);}
function waves(ctx,x,y,t){for(let i=0;i<2;i++){const p=(t*.8+i/2)%1;ctx.strokeStyle=`rgba(120,200,255,${1-p})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,4+p*13,-2.5,-.6);ctx.stroke();}}

export function drawLotFacility(ctx,kind,cx,cy,t=0){
 if(kind==='garden'){
  pad(ctx,cx,cy,'#6b4a2e','#4a3220',3);
  for(let r=0;r<3;r++){const v0=-24+r*17;box(ctx,cx,cy,-24,24,v0,v0+11,3,['#7a5434','#5a3c24','#4a301c','#3a2616'],{top:T=>{for(let k=0;k<6;k++){const [x,y]=T(.1+k*.16,.5);const ph=Math.sin(t*2+k+r)*0.6;
    ctx.fillStyle='#2f6b2a';ctx.fillRect(x-3,y-5+ph,6,4);ctx.fillStyle='#4fa040';ctx.fillRect(x-2,y-7+ph,4,3);ctx.fillStyle='#7ccf5a';ctx.fillRect(x-1,y-8+ph,2,2);
    if((k+r)%3===0){ctx.fillStyle='#d8402c';ctx.fillRect(x+1,y-4,2,2);}if((k+r)%4===1){ctx.fillStyle='#f0c040';ctx.fillRect(x-3,y-4,2,2);}}}});}
  for(const [u,v] of [[-30,-30],[30,-30],[30,30],[-30,30],[0,-30],[30,0],[0,30],[-30,0]]){const [x,y]=P(cx,cy,u,v);ctx.fillStyle='#8a6a40';ctx.fillRect(x-1,y-8,3,8);ctx.fillStyle='#c9a46a';ctx.fillRect(x-1,y-8,3,2);}
  ctx.strokeStyle='#c9a46a';ctx.lineWidth=1;ctx.beginPath();const fence=[[-30,-30],[30,-30],[30,30],[-30,30],[-30,-30]].map(([u,v])=>P(cx,cy,u,v,5));fence.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
  {const [x,y]=P(cx,cy,24,26);ctx.fillStyle='#3a7ac0';ctx.fillRect(x-4,y-6,8,6);ctx.fillStyle='#6aaae8';ctx.fillRect(x-4,y-6,8,2);ctx.fillRect(x+4,y-8,4,2);}
  return;}
 if(kind==='vending'){
  pad(ctx,cx,cy,'#b8b4aa','#8a867c',6);
  for(const [u0,col,lit] of [[-20,['#e8484a','#b02a2c','#8a1e20','#4a1012'],'#ffe9a0'],[4,['#3a7ad0','#2456a0','#1a3e78','#0e2240'],'#c8f0ff']]){
   shadow(ctx,cx,cy,u0,u0+14,-10,4);
   box(ctx,cx,cy,u0,u0+14,-10,4,30,col,{left:L=>{quad(ctx,L,.1,.9,.45,.92,'#1c2430');for(let i=0;i<3;i++)for(let j=0;j<2;j++){const pal=['#f05a5a','#5ad06a','#f0c040','#5ab0f0','#e8e8e8','#f08ad0'];quad(ctx,L,.16+i*.25,.33+i*.25,.52+j*.2,.66+j*.2,pal[(i+j*3)%6]);}
     quad(ctx,L,.12,.88,.08,.2,'#11161c');const g=.5+Math.sin(t*3+u0)*.5;quad(ctx,L,.15,.85,.36,.42,lit);ctx.globalAlpha=.25*g;quad(ctx,L,.05,.95,.3,.98,'#ffffff');ctx.globalAlpha=1;},
    right:R=>{quad(ctx,R,.3,.7,.55,.75,'#d8d8d8');}});}
  {const [x,y]=P(cx,cy,24,18);ctx.fillStyle='#5a6a5a';ctx.fillRect(x-4,y-10,8,10);ctx.fillStyle='#7a8a7a';ctx.fillRect(x-4,y-10,8,2);ctx.fillStyle='#2a3a2a';ctx.fillRect(x-2,y-9,4,1);}
  return;}
 if(kind==='lockers'){
  pad(ctx,cx,cy,'#a8aeb6','#7a8088',5);shadow(ctx,cx,cy,-22,14,-6,8);
  box(ctx,cx,cy,-22,14,-6,8,26,['#c8ced8','#9aa4b2','#7a8494','#4a5260'],{left:L=>{for(let i=0;i<5;i++)for(let j=0;j<3;j++){const s0=.04+i*.19,t0=.06+j*.31;if(i===2&&j===1){quad(ctx,L,s0,s0+.17,t0,t0+.28,'#1a2a3a');quad(ctx,L,s0+.03,s0+.14,t0+.12,t0+.24,(Math.floor(t*2)%2)?'#5ae0a0':'#3ab080');continue;}
     quad(ctx,L,s0,s0+.17,t0,t0+.28,j===2?'#b8c2d0':'#aab4c2','#6a7484');const [x,y]=L(s0+.13,t0+.14);ctx.fillStyle='#4a5260';ctx.fillRect(x,y,2,1);}},
   top:T=>{quad(ctx,T,0,1,0,1,'#d8dee8');}});
  {const [x,y]=P(cx,cy,-2,22);ctx.fillStyle='#c99a62';ctx.fillRect(x-6,y-7,12,7);ctx.fillStyle='#a87a48';ctx.fillRect(x-6,y-7,12,2);ctx.fillStyle='#e8d0a0';ctx.fillRect(x-1,y-7,2,7);}
  return;}
 if(kind==='leech'){
  pad(ctx,cx,cy,'#5a8a44','#3e6a30',8);
  {const [x,y]=P(cx,cy,-6,-4);pole(ctx,x,y,34);ctx.fillStyle='#d8dce0';ctx.beginPath();ctx.ellipse(x+4,y-32,6,8,-.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#9aa0a8';ctx.fillRect(x+3,y-33,3,3);
   ctx.strokeStyle='#2a2a2a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-20);ctx.quadraticCurveTo(x+14,y-6,x+20,y+6);ctx.stroke();waves(ctx,x+6,y-36,t);}
  {const [x,y]=P(cx,cy,14,12);ctx.fillStyle='#2a5aa0';ctx.fillRect(x-8,y-6,16,6);ctx.fillStyle='#3a7ad0';ctx.fillRect(x-8,y-8,16,3);ctx.fillStyle='#e8e0c0';ctx.fillRect(x-3,y-5,6,3);}
  return;}
 if(kind==='router'){
  pad(ctx,cx,cy,'#9a9a94','#76766e',7);shadow(ctx,cx,cy,-10,8,-8,8);
  box(ctx,cx,cy,-10,8,-8,8,14,['#e8e4dc','#c4beb2','#a49e92','#5a5650'],{left:L=>{for(let i=0;i<4;i++){quad(ctx,L,.12+i*.2,.24+i*.2,.35,.5,(Math.floor(t*4+i)%3)?'#4ae070':'#1a5a2a');}}});
  {const [x,y]=P(cx,cy,-1,-1,14);pole(ctx,x-5,y,12);pole(ctx,x+5,y,12);waves(ctx,x,y-14,t);}
  return;}
 if(kind==='fiber'){
  pad(ctx,cx,cy,'#8a8a84','#666660',3);shadow(ctx,cx,cy,-24,20,-22,18);
  box(ctx,cx,cy,-24,20,-22,18,26,['#d8c8a8','#b89a70','#94784e','#4a3a24'],{left:L=>{quad(ctx,L,.12,.34,0,.72,'#5a3a24');quad(ctx,L,.3,.32,.3,.4,'#e8c860');quad(ctx,L,.5,.86,.35,.75,'#2a4a6a','#e8e0d0');quad(ctx,L,.52,.84,.37,.55,'#7ac0f0');},
   right:R=>{quad(ctx,R,.3,.7,.4,.75,'#2a4a6a','#e8e0d0');quad(ctx,R,.32,.68,.42,.58,'#9ad8ff');}});
  // gable roof
  {const a=P(cx,cy,-27,-25,26),b=P(cx,cy,23,-25,26),c=P(cx,cy,23,21,26),d=P(cx,cy,-27,21,26),r1=P(cx,cy,-27,-2,40),r2=P(cx,cy,23,-2,40);
   poly(ctx,[d,c,r2,r1],'#b04a3a','#5a2018');poly(ctx,[a,b,r2,r1],'#d0604a','#5a2018');poly(ctx,[b,c,r2],'#8a3428','#5a2018');}
  {const [x,y]=P(cx,cy,10,-12,38);pole(ctx,x,y+4,10);ctx.fillStyle='#e8ecf0';ctx.beginPath();ctx.ellipse(x+3,y-8,6,7,-.6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#9aa0a8';ctx.fillRect(x+2,y-9,2,2);waves(ctx,x+4,y-14,t);}
  {const [x,y]=P(cx,cy,28,10);ctx.strokeStyle='#f0a030';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-10,y-2);ctx.lineTo(x+4,y+6);ctx.stroke();}
  return;}
}
