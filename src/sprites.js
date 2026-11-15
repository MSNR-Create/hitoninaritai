// v1.9 pixel-art sprite system. Every sprite is a character map + palette,
// rasterised once into an offscreen canvas and blitted with smoothing off.
// One sprite pixel = PX world units, so all art shares a single pixel grid.
export const PX=2;
const cache=new Map();
function makeCanvas(w,h){
  // Prefer a real <canvas>: some mobile browsers draw OffscreenCanvas sources as blank.
  if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(w,h);
  return null; // headless tests: drawing becomes a no-op
}
export function sprite(key,rows,pal){
  if(cache.has(key))return cache.get(key);
  const h=rows.length,w=Math.max(...rows.map(r=>r.length));
  const c=makeCanvas(w,h);if(!c){cache.set(key,null);return null;}
  const g=c.getContext('2d');
  rows.forEach((row,y)=>{for(let x=0;x<row.length;x++){const col=pal[row[x]];if(col){g.fillStyle=col;g.fillRect(x,y,1,1);}}});
  const s={canvas:c,w,h};cache.set(key,s);return s;
}
/** Draw sprite anchored at its bottom-centre (feet) on world point (x,y). */
export function blit(ctx,s,x,y,flip=false,scale=PX){
  if(!s||!ctx.drawImage)return;
  const w=s.w*scale,h=s.h*scale,left=Math.round(x-w/2),top=Math.round(y-h);
  ctx.imageSmoothingEnabled=false;
  if(flip){ctx.save();ctx.translate(left+w,top);ctx.scale(-1,1);ctx.drawImage(s.canvas,0,0,w,h);ctx.restore();}
  else ctx.drawImage(s.canvas,left,top,w,h);
}

// ---------- characters ----------
const ZOMBIE_SKIN=[['#9cc48a','#76a06a'],['#a3c9b6','#7aa592'],['#b8c79a','#93a374'],['#8fc5aa','#689f86'],['#c7bf9f','#a19877']];
const SHIRTS=[['#5f7fae','#45608a'],['#b0715f','#8a5446'],['#7c9a62','#5c7748'],['#9a7bb3','#775a8f'],['#c09a52','#977639'],['#5e9a9a','#447777']];
const HAIR=['#3b3040','#5a4632','#2f3f4a','#704a3a','#4a5b3c'];
const BODY_IDLE=[
  '....oooo....',
  '...ohhhho...',
  '..ohhhhhho..',
  '..ohssssho..',
  '..oseswseo..',
  '..osssssSo..',
  '..osmmmsSo..',
  '...ossSSo...',
  '..occcccCo..',
  '.osccccccso.',
  '.osocccCoso.',
  '..oocccCoo..',
  '...oppppo...',
  '...oppopo...',
  '...offoffo..',
  '....oo.oo...'];
const BODY_STEP=[...BODY_IDLE.slice(0,12),
  '...oppppo...',
  '..oppo.opo..',
  '..offo.offo.',
  '...oo...oo..'];
// Zombie "arms forward" shuffle pose
const BODY_SHAMBLE=[...BODY_IDLE.slice(0,8),
  '..occcccCoooo',
  '.occcccccsssso',
  '.occcccCCoooo',
  '..oocccCoo...',
  ...BODY_IDLE.slice(12)];
const BODY_SLEEP=BODY_IDLE;
export function zombieSprite(kind,frame=0,activity='walk'){
  const [s,S]=ZOMBIE_SKIN[kind%5],[c,C]=SHIRTS[(kind*2+1)%6];
  const rows=activity==='sleep'?BODY_SLEEP.map(r=>r.replace('oseswseo','osSSsSSo')):activity==='walk'?(frame%2?BODY_STEP:BODY_SHAMBLE):BODY_IDLE;
  return sprite(`z${kind}-${activity}-${frame%2}`,rows,{o:'#1b2a2c',h:'#4a5d4a',s,S,e:'#f4f1c9',w:'#c4433f',m:'#5b3a3a',c,C,p:'#3a4a5c',f:'#2a2626'});
}
export function humanSprite(id,frame=0){
  const skin=[['#f1c9a5','#d4a682'],['#c99474','#a8735a'],['#e3b896','#c4977a'],['#a8775e','#865a45']][id%4];
  const [c,C]=SHIRTS[id%6];
  const rows=(frame%2?BODY_STEP:BODY_IDLE).map(r=>r.replace('oseswseo','osesseso').replace('osmmmsSo','ossmssSo'));
  return sprite(`h${id%24}-${frame%2}`,rows,{o:'#1f2228',h:HAIR[id%5],s:skin[0],S:skin[1],e:'#22262e',m:'#a5584f',c,C,p:['#2f3c55','#5a4a3a','#3a3a3a'][id%3],f:'#1d1d1d'});
}

// ---------- furniture (aligned per tile, anchored at tile centre) ----------
const FURN={
  bed:[['....oooooooooo','...owwwwwwwbbbo','..owwwwwwwbbbbo','.oBBBBBBBBBBBBo','oBBBBBBBBBBBBo.','oddddddddddddo.','od..........do.','oo..........oo.'],{o:'#22313a',w:'#e8e4d0',b:'#7aa0c8',B:'#5b7fa8',d:'#6b4c3a'}],
  shelf:[['oooooooooo','owwwwwwwwo','oryybgrrbo','oddddddddo','obbggyywwo','oddddddddo','orrwbbyygo','oddddddddo','od......do','oo......oo'],{o:'#22313a',d:'#7a5640',w:'#d9d1b8',r:'#c0605a',y:'#e3c46a',b:'#6a8fc0',g:'#78a868'}],
  counter:[['oooooooooooooo','oTTTTTTTTTTTTo','oaayyrraaggbbo','oddddddddddddo','odDDDDDDDDDDdo','odDDDDDDDDDDdo','oddddddddddddo','oooooooooooooo'],{o:'#22313a',T:'#e0c08a',d:'#8a6044',D:'#6a4632',a:'#f0ead0',y:'#e3c46a',r:'#c0605a',g:'#78a868',b:'#6a8fc0'}],
  desk:[['....o...o.....','...oGo.oPo....','...oGo.oPo.oo.','..oGGGooPPoYYo','oooooooooooooo','oTTTTTTTTTTTTo','odddddddddddo.','od.........do.','oo.........oo.'],{o:'#22313a',G:'#7ee0c6',P:'#b2a6f2',Y:'#f2b8a8',T:'#cfdbe0',d:'#5d6f80'}],
  crates:[['..oooooo......','..oyyyyo......','..oxyyxo.ooooo','..oyxxyo.oyyyo','oooooooooxyxyo','oyyyyyyoooyxyo','oxyyyyxo.oxyxo','oyxyyxyo.ooooo','oyyxxyyo......','oooooooo......'],{o:'#3a2a1c',y:'#c99a62',x:'#9a7148'}],
  plant:[['...oo...','..oggo..','.oggGgo.','oGgggGgo','.oggggo.','..oGgo..','..oppo..','..oPPo..','..oooo..'],{o:'#1e3226',g:'#6fb36a',G:'#4a8a4e',p:'#b8684a',P:'#8e4c36'}],
  fridge:[['oooooooo','owwwwwwo','owwwwwgo','oooooooo','owwwwwwo','owwwwwgo','owwwwwwo','owwwwwwo','oooooooo'],{o:'#22313a',w:'#d8e4e6',g:'#8aa2a8'}],
  table:[['.oooooooooo.','oTTTTTTTTTTo','oddddddddddo','.od......do.','.oo......oo.'],{o:'#22313a',T:'#d8b080',d:'#8a6044'}],
  hatch:[['...oooooo...','..oyyyyyyo..','.oyoooooooy.','oyoggggggoyo','oyogGGGGgoyo','oyoggggggoyo','.oyoooooooy.','..oyyyyyyo..','...oooooo...'],{o:'#18282a',y:'#d9c46a',g:'#2c4a46',G:'#79d6b6'}],
  sofa:[['..oooooooooooo..','..oCCCCCCCCCCo..','.ooCCCCCCCCCCoo.','oRRRRRRRRRRRRo.','oRRRRRRRRRRRRo.','oRRoooooooRRRo.','ooRo.......oRoo','..oo.......oo..'],{o:'#22313a',C:'#c37e73',R:'#825f7e'}],
  cooler:[['oooooo','obbbbo','oBbbBo','oooooo','owwwwo','owwwwo','oooooo'],{o:'#22313a',b:'#8ad0ec',B:'#5aa0c0',w:'#dfe8ea'}]
};
export function furniture(name){const f=FURN[name];return f?sprite('f-'+name,f[0],f[1]):null;}
// Furniture layout in footprint-local tile coordinates (tile centres).
export const ROOM_LAYOUT={
  home:[['bed',0,0],['bed',1,0],['shelf',2,0],['table',1,1],['plant',2,1]],
  humanHome:[['bed',0,0],['shelf',1,0],['table',1,1],['plant',0,2],['fridge',2,0]],
  shop:[['shelf',0,0],['shelf',1,0],['counter',0,1],['crates',1,2],['fridge',0,2]],
  market:[['shelf',0,0],['shelf',1,0],['fridge',2,0],['counter',1,1],['crates',2,2]],
  cafe:[['counter',0,0],['cooler',1,0],['table',1,1],['table',2,2],['plant',0,2]],
  pantry:[['fridge',0,0],['shelf',1,0],['crates',1,1]],
  storage:[['crates',0,0],['shelf',1,0],['crates',2,0],['crates',0,1],['crates',2,1]],
  wash:[['cooler',0,0],['fridge',1,0],['plant',1,1]],
  sorting:[['crates',0,0],['table',1,0],['crates',1,1]],
  extractor:[['desk',0,0],['cooler',1,0],['shelf',2,0],['desk',2,1]],
  mushroom:[['plant',0,0],['plant',1,0],['plant',2,0],['crates',1,1]],
  kitchen:[['table',0,0],['fridge',1,0],['shelf',1,1]],
  lounge:[['sofa',0,0],['table',1,0],['plant',2,1]],
  cooler:[['cooler',0,0],['fridge',1,0],['cooler',0,2]],
  generator:[['cooler',0,0],['desk',1,0]],
  recycler:[['crates',0,0],['table',1,0],['crates',2,1]],
  chemical:[['desk',0,0],['cooler',1,0]],
  disguise:[['table',0,0],['shelf',1,0]],
  culture:[['cooler',0,0],['plant',1,1],['desk',2,1]],
  farm:[['plant',0,0],['plant',1,0],['plant',2,0],['plant',0,2]],
  repair:[['table',0,0],['cooler',1,0],['desk',2,1]],
  theater:[['sofa',0,0],['sofa',1,0],['desk',2,1]],
  workshop:[['desk',0,0],['crates',1,0],['table',2,1]],
  automation:[['crates',0,0],['desk',1,1],['crates',2,2]],
  water:[['cooler',0,0],['plant',1,1]],
  security:[['desk',0,0],['shelf',1,0]],
  archives:[['shelf',0,0],['shelf',1,0],['desk',2,1]],

  lab:[['desk',0,0],['shelf',1,0],['desk',0,1],['cooler',1,1]],
  clinic:[['bed',0,0],['desk',1,0],['cooler',2,0],['bed',0,1],['plant',2,2]],
  warehouse:[['crates',0,0],['crates',1,0],['crates',2,0],['crates',0,1],['crates',2,2],['shelf',1,2]],
  exit:[['hatch',0,0],['plant',1,1]]
};

// ---------- textured isometric floor tiles ----------
function hash(x,y,s=0){let h=(x*374761393+y*668265263+s*982451653)|0;h=(h^(h>>>13))*1274126177|0;return ((h^(h>>>16))>>>0)/4294967296;}
function shade(hex,amt){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const f=v=>Math.max(0,Math.min(255,Math.round(v+amt)));return `rgb(${f(r)},${f(g)},${f(b)})`;}
/** style: noise (rock/grass), slab (stone path), stripe (road), brick (sidewalk), rubble (closed) */
export function tileTexture(base,style,variant=0){
  const key=`t-${base}-${style}-${variant}`;if(cache.has(key))return cache.get(key);
  const W=64,H=32,c=makeCanvas(W,H+1);if(!c){cache.set(key,null);return null;}
  const g=c.getContext('2d');
  for(let y=0;y<=H;y+=1)for(let x=0;x<W;x+=2){
    const dx=Math.abs(x+1-32)/32,dy=Math.abs(y+.5-16)/16;if(dx+dy>1)continue;
    const edge=dx+dy>0.9;
    let a=0;const n=hash((x>>1)+variant*31,y+variant*17,variant);
    if(style==='noise'){a=n<.12?-14:n>.9?10:0;}
    else if(style==='rubble'){a=n<.25?-18:n>.82?14:0;}
    else if(style==='slab'){const u=(x/64+y/32),v=(x/64-y/32+1);const seam=Math.abs((u*2)%1-.0)<.05||Math.abs((v*2)%1)<.05;a=seam?-22:n<.1?-8:n>.93?8:0;}
    else if(style==='brick'){const u=x/64+y/32;const seam=(Math.floor(u*8)%1===0&&((u*8)%1)<.14)||y%6===0;a=seam?-16:n<.08?-6:0;}
    else if(style==='stripe'){a=n<.06?-6:n>.96?6:0;}
    // light from top-left: brighten upper-left edges, darken lower-right
    if(edge)a+=(y<16?(x<32?18:6):(x<32?-6:-20));
    g.fillStyle=shade(base,a);g.fillRect(x,y,2,1);
  }
  cache.set(key,c);return c;
}
export function drawTile(ctx,wx,wy,base,style,variant){
  const t=tileTexture(base,style,variant);
  if(t&&ctx.drawImage){ctx.imageSmoothingEnabled=false;ctx.drawImage(t,Math.round(wx-32),Math.round(wy-16));return true;}
  return false;
}
export {hash as tileHash,shade};
export function policeSprite(frame=0){
  const rows=(frame%2?BODY_STEP:BODY_IDLE).map((r,i)=>i===4?r.replace('oseswseo','osesseso'):i===6?r.replace('osmmmsSo','ossmssSo'):i===9?r.replace('osccccccso','osccycccso'):i===1?'..oKKKKKKo..':i===2?'.oKKKKKKKKo.':r);
  return sprite(`police-${frame%2}`,rows,{o:'#15182a',h:'#1d2a52',K:'#26386e',s:'#f1c9a5',S:'#d4a682',e:'#22262e',m:'#a5584f',c:'#3552a0',C:'#283f7e',y:'#f2d36a',p:'#1f2b4f',f:'#111'});
}
// ---------- outdoor / cave props (v1.10) ----------
const PROPS={
  tree:[['.....oooo.....','...ooGGGGoo...','..oGGgGGGGGo..','.oGGGGGgGGGGo.','.oGgGGGGGGgGo.','oGGGGGgGGGGGGo','oGGgGGGGGGgGGo','oGGGGGGGGGGGGo','.oGGgGGGGGGGo.','.ooGGGGGgGGoo.','...oooGGooo...','.....oTTo.....','.....oTTo.....','....oTTTTo....','.....oooo.....'],{o:'#1f4a28',G:'#4fa64a',g:'#8fd46a',T:'#7a5236'}],
  bush:[['..oooooo..','.oGGgGGGo.','oGgGGGGgGo','oGGGGgGGGo','.oooooooo.'],{o:'#1f4a28',G:'#4fa64a',g:'#8fd46a'}],
  flowers:[['.r..y..p..','rRr.yYypPp','.r.g.y.gp.','.gg.gg.gg.','oooooooooo','obbbbbbbbo','oooooooooo'],{o:'#5a3a26',b:'#8a5a3a',g:'#4fa64a',r:'#f26a6a',R:'#ffd0d0',y:'#f6d64a',Y:'#fff6b0',p:'#c88af2',P:'#f2e0ff'}],
  lamp:[['.oooo.','oYYYYo','oyyyyo','.oooo.','..oo..','..oo..','..oo..','..oo..','..oo..','..oo..','..oo..','.oooo.'],{o:'#2c3440',Y:'#fff6c8',y:'#f2d37a'}],
  bench:[['oooooooooo','owwwwwwwwo','oooooooooo','owwwwwwwwo','oooooooooo','o.o....o.o'],{o:'#3a2a1c',w:'#c99a62'}],
  lantern:[['..oo..','.oYYo.','oYyyYo','oYyyYo','.oooo.','..oo..','..oo..','.oooo.'],{o:'#3a2a1c',Y:'#ffe9a8',y:'#f2b44a'}],
  mushroom:[['.oooo.','oRwRRo','oRRwRo','.oooo.','..ow..','..ow..','.oooo.'],{o:'#3a2a1c',R:'#e2584a',w:'#fff1dc'}],
  sign:[['oooooooooooo','owwwwwwwwwwo','owrrwwrrwwwo','owwwwwwwwwwo','oooooooooooo','.....oo.....','.....oo.....','.....oo.....'],{o:'#4a3424',w:'#f4ead0',r:'#c0605a'}],
  antenna:[['.o.....o.','o.o...o.o','..o.o.o..','...ooo...','....o....','....o....','....o....','....o....','...ooo...','..ooooo..'],{o:'#5a6470'}],
  router:[['..o....o..','..o....o..','.oooooooo.','owwwwwwwwo','owgwbwwwwo','oooooooooo'],{o:'#2a3440',w:'#e8eef2',g:'#4ae08a',b:'#4aa0e8'}],
  hut:[['....oooooo....','...oRRRRRRo...','..oRRRRRRRRo..','.oRRRRRRRRRRo.','oooooooooooooo','owwwwwwwbbbbwo','owggwwwwbbbbwo','owggwwwwbbbbwo','owwwwwwwbbbbwo','oooooooooooooo'],{o:'#3a2a1c',R:'#c0605a',w:'#e8dcc0',g:'#8ad0ec',b:'#8a6044'}],
  vending:[['oooooooo','orrrrrro','orwywgro','orwywgro','orrrrrro','orbbbbro','orrrrrro','orrrrrro','orkkkkro','oooooooo'],{o:'#2a2030',r:'#d84a4a',w:'#f4f4f4',y:'#f2d37a',g:'#7ad07a',b:'#4a7ad8',k:'#1a1a1a'}],
  lockers:[['oooooooooo','oyyoyyoyyo','oyyoyyoyyo','oooooooooo','oyyoyyoyyo','oyyoyyoyyo','oooooooooo','oyyoyyokko','oooooooooo'],{o:'#3a4a5a',y:'#f2c24a',k:'#5ad0a0'}],
  garden:[['.g.g.g.g.g','gGgGgGgGgG','oooooooooo','.g.r.g.r.g','gGgRgGgRgG','oooooooooo'],{o:'#6a4a30',g:'#6fb36a',G:'#4a8a4e',r:'#e2584a',R:'#b8382a'}],
  crystal:[['..o...','.oCo.o','.oCCoC','oCcCoC','oCcCCo','oooooo'],{o:'#20304a',C:'#7ad0f2',c:'#d0f4ff'}]
};
export function prop(name){const p=PROPS[name];return p?sprite('p-'+name,p[0],p[1]):null;}
