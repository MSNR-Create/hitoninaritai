// v1.9.1 production event scenes: low-res pixel stage (160×85 logical px, ×2),
// shared character sprites, timed choreography, particles. Comic, never graphic.
import { zombieSprite, humanSprite, policeSprite, blit } from './sprites.js';
const SCENES={friendship:{title:'心が通じた！',desc:'街角で会話を交わし、少しだけ距離が縮まった。',accent:'#a4d6b1'},warning:{title:'正体を疑われた！',desc:'妙な仕草を見られた。相手が不審そうにしている。',accent:'#e7bd76'},police:{title:'警察が出動！',desc:'通報を受けた警官が駆けつけ、取り押さえようとしている。',accent:'#ee9886'},conversion:{title:'新しい眷属！',desc:'人間の隣人が新たな仲間として地下に加わった。',accent:'#b5c8ff'},loss:{title:'帰らぬ仲間',desc:'衝突の末、住民を失った。地下に悲しみが広がる。',accent:'#b9b4c6'},incident:{title:'対人トラブル！',desc:'衝動を抑えられず、人間社会で騒ぎになってしまった。',accent:'#f6a780'},levelup:{title:'レベルアップ！',desc:'住民が成長した。',accent:'#f2d37a'},district:{title:'新街区オープン！',desc:'街が発展した。',accent:'#9ad8ff'},wifi_caught:{title:'ただ乗りバレた！',desc:'回線泥棒が発覚した。',accent:'#f08070'},flea_claim:{title:'クレーム発生！',desc:'購入者からクレームが届いた。',accent:'#f08070'},flea_good:{title:'高評価ゲット！',desc:'購入者から嬉しい評価が届いた。',accent:'#f2d37a'},flea_jackpot:{title:'大当たり！',desc:'高値で売れた！',accent:'#f6c94a'},flea_buzz:{title:'相場が急騰！',desc:'SNSでバズって相場が跳ね上がった。',accent:'#ff9a5a'},flea_crash:{title:'相場が暴落…',desc:'再販決定で相場が崩れた。',accent:'#8aa0c8'},flea_fake:{title:'偽物だった…',desc:'届いた商品は偽物だった。',accent:'#c070d0'},flea_mismatch:{title:'説明と違う！',desc:'届いた商品の状態が説明より悪かった。',accent:'#d8a060'},research:{title:'研究成功！',desc:'長年の課題をひとつ克服した。人間化への道が開ける。',accent:'#a4ebda'},ending:{title:'新たな未来',desc:'ゾンビたちの未来を選ぶときが来た。',accent:'#e6dba3'}};
export const sceneDefinition=kind=>SCENES[kind==='waiting'?'friendship':kind]??SCENES.incident;
export function eventsForDay(previousCount,social,colony,game){
 const entries=social.history.slice(previousCount).map(e=>({id:e.id,kind:e.kind,message:e.message,reason:e.reason,day:e.day}));
 const report=colony.report;
 if(report){for(const name of report.incidentNames??[])entries.push({id:`${game.day}-${name}-incident`,kind:'incident',message:`${name}が人間社会で騒動を起こした`,reason:'配給や休息の不足が続き、危険衝動が高まった',day:game.day});
 if(report.researchDone&&colony.completedResearch.includes('impulse'))entries.push({id:`research-${game.day}`,kind:'research',message:'衝動抑制の研究が完成した',reason:'研究室と研究員による研究が所定量に到達',day:game.day});}
 return entries.filter((e,i,a)=>a.findIndex(x=>x.id===e.id)===i);
}
const LOOP=6;
const clamp01=v=>Math.max(0,Math.min(1,v));
const ease=v=>{v=clamp01(v);return v<.5?2*v*v:1-Math.pow(-2*v+2,2)/2;};
const lerp=(a,b,t)=>a+(b-a)*t;
function r2(i){const x=Math.sin(i*91.7)*43758.5453;return x-Math.floor(x);}
function rnd(i){const x=Math.sin(i*127.1)*43758.5453;return x-Math.floor(x);}
function R(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),w,h);}
const GROUND=70;
// ---------- backgrounds ----------
function street(g,T,{siren=false,dim=0}={}){
  const sky=g.createLinearGradient(0,0,0,GROUND);sky.addColorStop(0,'#0d1b33');sky.addColorStop(1,'#2a3d5c');g.fillStyle=sky;g.fillRect(0,0,160,GROUND);
  for(let i=0;i<22;i++){if((Math.floor(T*3+i*7))%9===0)continue;R(g,rnd(i)*160,rnd(i+50)*30,1,1,'#e8eefc');}
  R(g,128,8,8,8,'#f4ecc4');R(g,130,7,4,1,'#f4ecc4');R(g,130,16,4,1,'#f4ecc4');R(g,127,10,1,4,'#f4ecc4');R(g,136,10,1,4,'#f4ecc4');R(g,132,10,3,3,'#e2d8a8');
  // far skyline
  for(let i=0;i<9;i++){const w=12+rnd(i)*10,h=18+rnd(i+9)*22,x=i*19-4;R(g,x,GROUND-h,w,h,'#1a2a40');for(let wy=GROUND-h+3;wy<GROUND-4;wy+=5)for(let wx=x+2;wx<x+w-2;wx+=4)if(rnd(wx*3+wy)>.55)R(g,wx,wy,2,2,'#f2d37a');}
  // near storefront
  R(g,0,GROUND-28,52,28,'#3b4f63');R(g,0,GROUND-30,52,3,'#5d7790');for(let i=0;i<4;i++)R(g,4+i*12,GROUND-30,6,3,i%2?'#c96a5a':'#efe3c4');R(g,6,GROUND-20,18,12,'#f2d37a');R(g,7,GROUND-19,16,10,'#ffe9a8');R(g,30,GROUND-22,10,22,'#24303e');
  // lamp
  R(g,112,GROUND-36,2,36,'#3a4652');R(g,108,GROUND-38,10,3,'#3a4652');R(g,109,GROUND-35,6,2,'#ffe9a8');
  g.fillStyle='rgba(255,233,168,.12)';g.beginPath();g.moveTo(109,GROUND-33);g.lineTo(98,GROUND);g.lineTo(128,GROUND);g.lineTo(115,GROUND-33);g.fill();
  // ground
  R(g,0,GROUND,160,15,'#5c6a6c');for(let x=0;x<160;x+=8)R(g,x+(Math.floor(x/8)%2)*4,GROUND+4,1,3,'#4a5658');R(g,0,GROUND,160,1,'#86948f');R(g,0,GROUND+8,160,1,'#4a5658');
  if(siren){const on=Math.floor(T*6)%2;g.fillStyle=on?'rgba(255,60,60,.18)':'rgba(60,120,255,.18)';g.fillRect(0,0,160,85);}
  if(dim){g.fillStyle=`rgba(10,14,28,${dim})`;g.fillRect(0,0,160,85);}
}
function lab(g,T){
  R(g,0,0,160,GROUND,'#22303d');for(let y=0;y<GROUND;y+=6)for(let x=(y/6%2)*6;x<160;x+=12){R(g,x,y,11,5,'#2b3c4a');R(g,x,y,11,1,'#34495a');}
  R(g,8,14,30,3,'#6b4c3a');R(g,8,30,30,3,'#6b4c3a');for(let i=0;i<5;i++){R(g,10+i*6,8,4,6,['#7ee0c6','#b2a6f2','#f2b8a8','#e3c46a','#8ad0ec'][i]);R(g,10+i*6,24,4,6,['#e3c46a','#7ee0c6','#8ad0ec','#b2a6f2','#f2b8a8'][i]);}
  R(g,118,10,30,22,'#1b2430');R(g,120,12,26,18,'#0f3a3a');for(let i=0;i<6;i++)R(g,122,14+i*3,Math.round(4+((T*20+i*7)%20)),1,'#74e8c8');
  R(g,0,GROUND,160,15,'#3a4652');R(g,0,GROUND,160,1,'#5a6a74');
  // desk
  R(g,70,GROUND-14,50,4,'#cfdbe0');R(g,72,GROUND-10,3,10,'#5d6f80');R(g,114,GROUND-10,3,10,'#5d6f80');
}
function dawn(g,T){
  const p=clamp01(T/4);const sky=g.createLinearGradient(0,0,0,GROUND);sky.addColorStop(0,`rgb(${lerp(40,250,p*.6)|0},${lerp(50,170,p*.6)|0},${lerp(90,140,p*.4)|0})`);sky.addColorStop(1,`rgb(${lerp(120,255,p)|0},${lerp(90,210,p)|0},${lerp(110,150,p)|0})`);g.fillStyle=sky;g.fillRect(0,0,160,GROUND);
  const sy=lerp(GROUND+6,GROUND-14,ease(T/4));g.fillStyle='#fff2b8';g.beginPath();g.arc(80,sy,12,0,Math.PI*2);g.fill();g.fillStyle='rgba(255,242,184,.25)';g.beginPath();g.arc(80,sy,20,0,Math.PI*2);g.fill();
  for(let i=0;i<9;i++){const w=12+rnd(i)*10,h=10+rnd(i+9)*18;R(g,i*19-4,GROUND-h,w,h,'#4a3a52');}
  R(g,0,GROUND,160,15,'#6a5a5e');R(g,0,GROUND,160,1,'#c9a88a');
}
// ---------- props & fx ----------
function bubble(g,x,y,txt,col='#f8f4e6'){g.font='bold 7px monospace';const w=Math.ceil(g.measureText(txt).width)+6;R(g,x-w/2,y-9,w,9,'#1b2a2c');R(g,x-w/2+1,y-8,w-2,7,col);R(g,x-1,y,2,2,'#1b2a2c');g.fillStyle='#1b2a2c';g.font='bold 7px monospace';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,x,y-4.5);}
function heart(g,x,y,c='#f27a8c'){R(g,x,y,2,1,c);R(g,x+3,y,2,1,c);R(g,x-1,y+1,7,2,c);R(g,x,y+3,5,1,c);R(g,x+1,y+4,3,1,c);R(g,x+2,y+5,1,1,c);R(g,x,y+1,1,1,'#ffd0d8');}
function spark(g,x,y,s,c){R(g,x,y-s,1,s*2+1,c);R(g,x-s,y,s*2+1,1,c);}
function burst(g,x,y,r,T){g.fillStyle='#ffe066';g.beginPath();for(let i=0;i<16;i++){const a=i/16*Math.PI*2+T,rr=i%2?r*.45:r;g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}g.closePath();g.fill();g.fillStyle='#ff8a3c';g.beginPath();for(let i=0;i<16;i++){const a=i/16*Math.PI*2+T,rr=(i%2?r*.45:r)*.6;g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}g.closePath();g.fill();}
function shadow(g,x){g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(x,GROUND+1,8,2,0,0,Math.PI*2);g.fill();}
function zombieAt(g,x,T,kind=0,{walk=false,flip=false,jump=0,alpha=1,activity}={}){shadow(g,x);g.globalAlpha=alpha;blit(g,zombieSprite(kind,walk?Math.floor(T*6):0,activity??(walk?'walk':'idle')),x,GROUND+1-jump,flip,2);g.globalAlpha=1;}
function humanAt(g,x,T,id=2,{walk=false,flip=false,jump=0}={}){shadow(g,x);blit(g,humanSprite(id,walk?Math.floor(T*6):0),x,GROUND+1-jump,flip,2);}
function copAt(g,x,T,{walk=false,flip=false}={}){shadow(g,x);blit(g,policeSprite(walk?Math.floor(T*8):0),x,GROUND+1,flip,2);}
function dust(g,x,T,dir=1){for(let i=0;i<4;i++){const p=(T*3+i/4)%1;g.fillStyle=`rgba(220,214,190,${.6*(1-p)})`;g.fillRect(Math.round(x-dir*p*14-i*2),Math.round(GROUND-2-p*6+i),3,3);}}
function policeCar(g,x,T){R(g,x,GROUND-14,40,10,'#e9eef2');R(g,x+8,GROUND-21,22,8,'#e9eef2');R(g,x+10,GROUND-19,8,5,'#5f8bb0');R(g,x+20,GROUND-19,8,5,'#5f8bb0');R(g,x,GROUND-9,40,3,'#1f2b4f');const on=Math.floor(T*6)%2;R(g,x+14,GROUND-24,5,3,on?'#ff4040':'#802020');R(g,x+20,GROUND-24,5,3,on?'#204080':'#4080ff');R(g,x+4,GROUND-5,7,5,'#1b1b1b');R(g,x+29,GROUND-5,7,5,'#1b1b1b');}
// ---------- scenes ----------
function room(g,T){
  R(g,0,0,160,GROUND,'#4a3a30');for(let y=0;y<GROUND;y+=6)for(let x=(y/6%2)*7;x<160;x+=14){R(g,x,y,13,5,'#56443a');R(g,x,y,13,1,'#64503f');}
  R(g,96,10,40,26,'#2b2230');R(g,98,12,36,22,'#f6efe0');R(g,100,14,10,8,'#c96a5a');R(g,112,14,20,2,'#5a4a40');R(g,112,18,14,2,'#5a4a40');R(g,100,24,32,2,'#e0d4c0');
  R(g,10,20,26,30,'#6b4c3a');for(let i=0;i<3;i++){R(g,12,22+i*9,22,7,'#8a6044');R(g,14,24+i*9,6,4,'#c99a62');R(g,22,24+i*9,8,4,'#d8b080');}
  R(g,0,GROUND,160,15,'#7a6450');R(g,0,GROUND,160,1,'#a08a70');R(g,52,GROUND-12,60,3,'#c99a62');R(g,54,GROUND-9,3,9,'#8a6044');R(g,106,GROUND-9,3,9,'#8a6044');
}
function phone(g,x,y,screen,T){R(g,x-1,y-1,24,38,'#1b1b22');R(g,x,y,22,36,'#2c2c36');R(g,x+2,y+3,18,28,screen);R(g,x+9,y+32,4,2,'#5a5a66');}
function stars(g,x,y,n,T){for(let i=0;i<5;i++){const on=i<n;const c=on?'#f6c94a':'#5a5a66';R(g,x+i*7+2,y,2,1,c);R(g,x+i*7,y+1,6,2,c);R(g,x+i*7+1,y+3,4,1,c);R(g,x+i*7,y+4,2,1,c);R(g,x+i*7+4,y+4,2,1,c);}}
function chart(g,x,y,w,h,up,T){R(g,x,y,w,h,'#10202a');R(g,x+1,y+1,w-2,h-2,'#163040');const n=Math.floor(clamp01(T/2.4)*12);let py=y+h/2;g.fillStyle=up?'#ff7a4a':'#6a9ad8';
  for(let i=0;i<n;i++){const ny=up?py-(i>7?3:1)+((i*7)%3===0?1:0):py+(i>7?3:1)-((i*5)%3===0?1:0);const cy=Math.max(y+2,Math.min(y+h-3,ny));g.fillRect(x+3+i*((w-6)/12),cy,3,2);py=cy;}
  if(n>=12){const tx=x+w-6,ty=py;if(up){R(g,tx,ty-4,3,3,'#ffe066');R(g,tx-2,ty-1,2,2,'#ff9a5a');}else{R(g,tx,ty+2,3,3,'#6a9ad8');}}}
function box(g,x,T,open){R(g,x,GROUND-14,26,14,'#c99a62');R(g,x,GROUND-14,26,2,'#e4b880');R(g,x+11,GROUND-14,4,14,'#e8dcc0');if(open){R(g,x-6,GROUND-20,10,6,'#c99a62');R(g,x+22,GROUND-20,10,6,'#c99a62');}}
function stamp(g,x,y,txt,c,T){const s=1+Math.max(0,.25-T)*4;g.save();g.translate(x,y);g.scale(s,s);g.rotate(-.2);const w=Math.max(28,txt.length*11+8);R(g,-w/2,-9,w,18,c);R(g,-w/2+2,-7,w-4,14,'#fff4ec');g.fillStyle=c;g.font='bold 11px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,0,1);g.restore();}
function cloud(g,x,y,T){R(g,x-10,y,20,6,'#8a90a0');R(g,x-6,y-3,12,4,'#9aa0b0');for(let i=0;i<5;i++){const p=(T*2+i/5)%1;R(g,x-8+i*4,y+7+p*14,1,3,'rgba(150,180,230,.8)');}}
function antenna(g,x,T,ok){R(g,x,GROUND-34,2,34,'#5a6470');R(g,x-6,GROUND-36,14,3,'#7a8490');if(ok)for(let i=0;i<3;i++){const p=(T*1.5+i/3)%1;g.strokeStyle=`rgba(140,220,255,${1-p})`;g.lineWidth=1;g.beginPath();g.arc(x+1,GROUND-38,4+p*14,-2.4,-.7);g.stroke();}}
const PLAY={
  levelup(g,T){lab(g,T);const j=T>1?Math.abs(Math.sin(T*8))*6:0;zombieAt(g,80,T,0,{jump:j});
    if(T>.8){for(let i=0;i<14;i++){const a=i/14*Math.PI*2+T,r=10+((T-.8)*20)%24;spark(g,80+Math.cos(a)*r,GROUND-18+Math.sin(a)*r*.6,1,i%2?'#f2d37a':'#fff');}}
    if(T>1.2){g.fillStyle='#f2d37a';g.font='bold 12px monospace';g.textAlign='center';g.fillText('LEVEL UP!',80,22-Math.min(6,(T-1.2)*10));}
    if(T>2.2)bubble(g,80,GROUND-40,'強くなった！');},
  district(g,T){street(g,T);const rise=ease((T-.5)/2);
    for(let i=0;i<4;i++){const x=64+i*22,hgt=Math.round((18+i*6)*rise);R(g,x,GROUND-hgt,18,hgt,['#f0d2a0','#9fd0e4','#f6b07a','#cbb0ec'][i]);for(let wy=GROUND-hgt+3;wy<GROUND-4;wy+=6)R(g,x+3,wy,4,3,'#ffe9a8');}
    humanAt(g,30,T,1,{});zombieAt(g,46,T,2,{jump:T>2.6?Math.abs(Math.sin(T*8))*4:0});
    if(T>2.6){for(let i=0;i<20;i++){const p=((T-2.6)*.5+r2(i))%1;R(g,r2(i+3)*160,p*85,2,2,['#f2d37a','#9ad8ff','#f27a8c'][i%3]);}bubble(g,38,GROUND-40,'街が広がった！');}},
  wifi_caught(g,T){street(g,T);antenna(g,120,T,T<1.6);zombieAt(g,96,T,1,{walk:T>2.6,flip:T>2.6});
    const hx=T<1.2?lerp(-10,40,ease(T/1.2)):40;humanAt(g,hx,T,3,{walk:T<1.2});
    if(T>1.4&&T<2.4)bubble(g,hx,GROUND-36,'うちのWi-Fi！？','#ffe0d0');
    if(T>1.6){R(g,112,GROUND-46,18,10,'#c03040');g.fillStyle='#fff';g.font='bold 7px sans-serif';g.textAlign='center';g.fillText('鍵',121,GROUND-38);}
    if(T>2.6)bubble(g,96,GROUND-36,'す、すみません！');},
  flea_claim(g,T){room(g,T);const shake=T>1&&T<1.6?Math.sin(T*70)*2:0;g.save();g.translate(shake,0);
    zombieAt(g,60,T,1,{});phone(g,82,GROUND-52,T>1?'#ffdcd4':'#d8f0ff',T);
    if(T>1){R(g,88,GROUND-44,10,10,'#e2584a');R(g,92,GROUND-42,2,5,'#fff');R(g,92,GROUND-36,2,2,'#fff');}
    if(T>1.3)bubble(g,93,GROUND-56,'返金して！','#ffe0d8');
    if(T>1.6)for(let i=0;i<3;i++){const p=((T-1.6)*1.5+i/3)%1;R(g,48+i*3,GROUND-30+p*10,2,3,`rgba(140,200,255,${1-p})`);}
    if(T>2.4)bubble(g,52,GROUND-36,'す、すみません…');
    g.restore();if(T>1&&T<1.25){g.fillStyle='rgba(255,80,60,.25)';g.fillRect(0,0,160,85);}},
  flea_good(g,T){room(g,T);zombieAt(g,60,T,4,{jump:T>2.4?Math.abs(Math.sin(T*9))*5:0});phone(g,82,GROUND-52,'#fff8e0',T);
    stars(g,84,GROUND-40,Math.min(5,Math.floor(Math.max(0,T-.8)*3)),T);
    if(T>2.4){bubble(g,93,GROUND-56,'最高でした！');for(let i=0;i<5;i++){const p=((T-2.4)*.6+i/5)%1;heart(g,40+i*8,GROUND-30-p*30,i%2?'#f27a8c':'#ffb0c0');}}},
  flea_jackpot(g,T){room(g,T);zombieAt(g,60,T,2,{jump:T>1.4?Math.abs(Math.sin(T*10))*6:0});phone(g,82,GROUND-52,'#e8fff0',T);
    if(T>.8){g.fillStyle='#1b6a3a';g.font='bold 7px monospace';g.textAlign='center';g.fillText('SOLD',93,GROUND-38);}
    if(T>1.2)for(let i=0;i<20;i++){const p=((T-1.2)*.7+r2(i))%1;const x=r2(i+7)*160,y=p*90-6;R(g,x,y,4,4,'#f6c94a');R(g,x+1,y+1,2,2,'#fff2b8');}
    if(T>1.6)bubble(g,58,GROUND-38,'売れたー！');},
  flea_buzz(g,T){room(g,T);chart(g,92,8,44,30,true,T);zombieAt(g,60,T,0,{jump:T>2.6?Math.abs(Math.sin(T*9))*4:0});
    if(T>2.6){bubble(g,58,GROUND-38,'在庫が化けた！');for(let i=0;i<3;i++)spark(g,96+i*14,6+Math.sin(T*8+i)*2,2,'#ffe066');}},
  flea_crash(g,T){room(g,T);chart(g,92,8,44,30,false,T);zombieAt(g,60,T,3,{activity:'sleep'});if(T>2.4){cloud(g,60,GROUND-44,T);bubble(g,30,GROUND-38,'そんな…');}},
  flea_fake(g,T){room(g,T);zombieAt(g,48,T,1,{});box(g,70,T,T>1);
    if(T>1.2){const lift=Math.min(10,(T-1.2)*20);R(g,77,GROUND-20-lift,12,12,'#d8c060');R(g,79,GROUND-18-lift,8,4,'#f6e8a0');}
    if(T>1.8&&T<2.4)bubble(g,83,GROUND-40,'？');if(T>2.4)stamp(g,112,GROUND-44,'偽物','#c03040',T-2.4);if(T>2.6)bubble(g,44,GROUND-36,'やられた…');},
  flea_mismatch(g,T){room(g,T);zombieAt(g,48,T,2,{});box(g,70,T,T>1);
    if(T>1.2){const lift=Math.min(10,(T-1.2)*20);R(g,77,GROUND-20-lift,12,12,'#8ab0c8');R(g,79,GROUND-17-lift,6,1,'#3a3a3a');R(g,84,GROUND-15-lift,4,1,'#3a3a3a');R(g,80,GROUND-12-lift,1,4,'#3a3a3a');}
    if(T>2.2)stamp(g,112,GROUND-44,'傷あり','#c07020',T-2.2);if(T>2.5)bubble(g,44,GROUND-36,'えぇ…');},
  friendship(g,T){street(g,T);
    const zx=lerp(-12,62,ease(T/1.4)),hx=lerp(172,100,ease(T/1.4));const talk=T>1.4;
    zombieAt(g,zx,T,0,{walk:!talk,jump:talk&&T>3.2?Math.abs(Math.sin(T*8))*3:0});humanAt(g,hx,T,2,{walk:!talk,flip:true,jump:talk&&T>3.2?Math.abs(Math.sin(T*8+1))*3:0});
    if(T>1.6&&T<2.6)bubble(g,zx+4,GROUND-34,'こんばんは');if(T>2.4&&T<3.4)bubble(g,hx-4,GROUND-34,'♪♪');
    if(T>3)for(let i=0;i<5;i++){const p=((T-3)*.6+i/5)%1;heart(g,81+Math.sin(p*9+i)*8,GROUND-30-p*34,i%2?'#f27a8c':'#ffb0c0');}},
  warning(g,T){street(g,T);
    const zx=lerp(-12,58,ease(T/1.2));zombieAt(g,zx,T,1,{walk:T<1.2});const turn=T>1.5;const hx=T>2.6?lerp(104,118,ease((T-2.6)/.6)):104;humanAt(g,hx,T,3,{flip:turn,walk:T>2.6&&T<3.2});
    if(T>1.5&&T<2.4)bubble(g,hx,GROUND-34,'？');if(T>2.4){const s=1+Math.max(0,.4-(T-2.4))*2;g.save();g.translate(hx,GROUND-44);g.scale(s,s);R(g,-4,-8,8,14,'#e7bd76');R(g,-2,-6,4,7,'#3a2a1c');R(g,-2,3,4,2,'#3a2a1c');g.restore();}
    if(T>2.5)for(let i=0;i<3;i++){const p=((T-2.5)*1.5+i/3)%1;R(g,zx+10+i*3,GROUND-30+p*10,2,3,`rgba(140,200,255,${1-p})`);}},
  police(g,T){street(g,T,{siren:T>.6});
    policeCar(g,lerp(170,112,ease((T-.2)/.8)),T);
    const run=T>1.8;const zx=run?lerp(58,-20,ease((T-1.8)/2)):58;zombieAt(g,zx,T,2,{walk:run,flip:run});if(run)dust(g,zx+6,T,-1);
    if(T>1)copAt(g,lerp(124,run?lerp(100,20,ease((T-1.8)/2.6)):100,ease((T-1)/.8)),T,{walk:true,flip:true});
    if(T>1.3)copAt(g,lerp(140,run?lerp(118,40,ease((T-2)/2.6)):118,ease((T-1.3)/.8)),T,{walk:true,flip:true});
    if(T>1.1&&T<1.9)bubble(g,100,GROUND-36,'待て！','#ffe0d0');
    if(run&&T<3.5){g.fillStyle='rgba(255,255,255,.5)';for(let i=0;i<5;i++)g.fillRect(zx+12+((T*90+i*17)%30),GROUND-26+i*5,8,1);}
    if(T>1.6&&T<2.2)bubble(g,58,GROUND-34,'！？');},
  incident(g,T){street(g,T);
    const lunge=T>1.6&&T<2.2,hit=T>=2.0;const shake=T>2&&T<2.6?Math.sin(T*60)*2:0;g.save();g.translate(shake,0);
    const zx=T<1.6?lerp(-12,56,ease(T/1.4)):lerp(56,82,ease((T-1.6)/.3));zombieAt(g,zx,T,3,{walk:T<1.4,jump:lunge?Math.sin((T-1.6)/.6*Math.PI)*8:0});
    if(T<1.4&&T>.6){R(g,zx-2,GROUND-38,5,6,'#c4433f');R(g,zx-1,GROUND-30,3,2,'#c4433f');}
    const hx=hit?lerp(104,122,ease((T-2)/.4)):104;if(hit){g.save();g.translate(hx,GROUND);g.rotate(Math.min(1.3,(T-2)*4));blit(g,humanSprite(1,0),0,1,true,2);g.restore();for(let i=0;i<3;i++){const a=T*5+i*2.1;spark(g,hx+Math.cos(a)*10,GROUND-30+Math.sin(a)*3,1,'#ffe066');}}
    else humanAt(g,hx,T,1,{flip:true});
    if(T>1.95&&T<2.6)burst(g,94,GROUND-22,14+Math.sin(T*30)*2,T*4);
    if(T>2.6){bubble(g,40,GROUND-46,'騒ぎだ！','#ffe0d0');}
    g.restore();},
  conversion(g,T){street(g,T);
    zombieAt(g,52,T,4,{jump:T>3.4?Math.abs(Math.sin(T*8))*4:0});
    const turned=T>2.4;const hx=104;
    if(T>.8&&T<2.4){const p=(T-.8)/1.6;for(let i=0;i<10;i++){const a=i/10*Math.PI*2+T*3,r=lerp(26,2,p);spark(g,hx+Math.cos(a)*r,GROUND-16+Math.sin(a)*r*.6,1,i%2?'#b5c8ff':'#f8f4e6');}}
    if(turned)zombieAt(g,hx,T,2,{flip:true,jump:T>3.4?Math.abs(Math.sin(T*8+1))*4:0});else humanAt(g,hx,T,4,{flip:true});
    if(T>2.3&&T<2.7){g.fillStyle=`rgba(255,255,255,${1-Math.abs(T-2.5)*5})`;g.fillRect(0,0,160,85);}
    if(T>3)for(let i=0;i<24;i++){const p=((T-3)*.5+rnd(i))%1;R(g,rnd(i+3)*160,p*85,2,2,['#f2d37a','#b5c8ff','#f27a8c','#7ee0c6'][i%4]);}
    if(T>3.2&&T<4.6)bubble(g,78,GROUND-40,'ようこそ！');},
  loss(g,T){street(g,T,{dim:.35});
    for(let i=0;i<40;i++){const p=(T*1.6+rnd(i))%1;R(g,rnd(i+7)*160-p*6,p*85,1,4,'rgba(170,190,220,.55)');}
    const fade=clamp01((T-1)/2.2);zombieAt(g,96,T,1,{alpha:1-fade,jump:fade*18});
    if(T>1.2){g.globalAlpha=clamp01((T-1.2)*.6);R(g,93,GROUND-14,8,14,'#8a8f9a');R(g,91,GROUND-16,12,3,'#9aa0aa');R(g,96,GROUND-11,2,6,'#6a6f7a');R(g,94,GROUND-9,6,2,'#6a6f7a');R(g,102,GROUND-4,2,4,'#5a8a52');R(g,101,GROUND-6,4,2,'#f2b8c8');g.globalAlpha=1;}
    zombieAt(g,58,T,0,{activity:'sleep'});
    if(T>3.4)bubble(g,58,GROUND-34,'……','#d8dbe6');},
  research(g,T){lab(g,T);
    const done=T>2.8;zombieAt(g,62,T,3,{activity:done?'idle':'research',jump:done?Math.abs(Math.sin(T*9))*5:0});
    const fx=96;R(g,fx,GROUND-26,10,12,'#1b2a2c');R(g,fx+1,GROUND-22,8,7,done?'#f2d37a':'#7ee0c6');R(g,fx+3,GROUND-30,4,5,'#1b2a2c');
    for(let i=0;i<4;i++){const p=(T*1.5+i/4)%1;R(g,fx+3+Math.sin(p*8+i)*3,GROUND-30-p*14,2,2,`rgba(200,255,230,${1-p})`);}
    R(g,40,12,70,6,'#1b2430');R(g,41,13,Math.round(68*clamp01(T/2.8)),4,done?'#f2d37a':'#74c8b6');
    if(done){for(let i=0;i<12;i++){const a=i/12*Math.PI*2,r=(T-2.8)*30%34;spark(g,fx+5+Math.cos(a)*r,GROUND-20+Math.sin(a)*r*.6,1,'#fff2b8');}bubble(g,62,GROUND-38,'できた！');}},
  ending(g,T){dawn(g,T);
    const walk=x=>lerp(x,x+30,ease(T/LOOP));
    zombieAt(g,walk(30),T,0,{walk:true});zombieAt(g,walk(48),T,2,{walk:true});humanAt(g,walk(66),T,2,{walk:true});zombieAt(g,walk(84),T,4,{walk:true});
    for(let i=0;i<10;i++){const p=(T*.4+rnd(i))%1;spark(g,rnd(i+2)*160,GROUND-10-p*50,1,`rgba(255,242,184,${1-p})`);}}
};
/** frame: ms timestamp. Draws a looping ~6 s choreography for the event kind. */
export function paintEvent(ctx,kind,frame,w=320,h=170){
  if(kind==='waiting')kind='friendship';const s=sceneDefinition(kind),T=((frame/1000)%LOOP+LOOP)%LOOP;
  ctx.save();ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;ctx.scale(w/160,h/85);
  (PLAY[kind]??PLAY.incident)(ctx,T);
  // letterbox + accent + fade-in at loop start
  R(ctx,0,0,160,2,s.accent);R(ctx,0,83,160,2,s.accent);
  if(T<.35){ctx.fillStyle=`rgba(8,14,22,${1-T/.35})`;ctx.fillRect(0,0,160,85);}
  ctx.restore();
}
