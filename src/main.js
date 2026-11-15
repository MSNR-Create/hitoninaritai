import { clamp, hitTile, tileToWorld, projectedTile, projectedFootprint, worldToView, zoomAround } from './geometry.js';
import { makeWorlds, describeTile } from './world.js';
import { drawScene } from './render.js';
import { boundCamera, makePinch, applyPinch } from './camera.js';
import { initialGame, stepGame, assignJob, JOBS, moodOf, jobEligible, jobReqText, SHIFT_HOURS } from './simulation.js';
import { residentVisual, visibleResidents } from './agent.js';
import { applyConstruction, canUnlock, zoneAt, connectedFacilities, FACILITY_SIZES, FACILITY_NAMES, BUILD_COSTS } from './construction.js';
import { MAP_SIZE } from './geometry.js';
import * as C from './colonists.js';
import * as CITY from './city.js';
import { lotAt } from './city.js';
import { FACILITIES, runProduction, ITEM_NAMES, SALVAGE_PACK } from './production.js';
import * as ST from './storage.js';
import { homeCapacity, homeAssignments } from './agent.js';
import { unlockAudio, setMusic, sfx, setAudio, audioPrefs, EVENT_SFX } from './audio.js';
import { FACILITY_DEFS, ITEMS, BUILD_CATEGORIES, TOOLS, RECIPES as CAT_RECIPES, recipesFor } from './catalog.js';
import { dailyFacilityEffects } from './facility-effects.js';
import { planCorridor, applyCorridor, buildingPreview } from './planning.js';
import { initialResale } from './resale.js';
import * as F from './flea.js';
import { RENTALS, rentProperty } from './rentals.js';
import { PURCHASE_PRICES, buyProperty, propertyBill, selectProperty } from './property.js';
import { chooseFootprint, chooseCorridor } from './placement-interaction.js';
import { SUPPLIES, initialColony, buySupply, advanceColony, STAGE2_DAY } from './colony.js';
import { TECHS, BRANCHES, techById, techStatus, startTech, advanceResearch, researchMods, researchState } from './research.js';
import { initialSocial, advanceSocial, recordDeaths, NEIGHBORS } from './social.js';
import { serializeSession, validateSession, hydrateWorld, saveSnapshot, loadSnapshot, clearSnapshots } from './persistence.js';
import { sceneDefinition, paintEvent, eventsForDay } from './event-scenes.js';
import { createLedger, addTransaction, daySummary, balanceSeries, validateLedger } from './finance.js';
import { demolitionTarget, applyDemolition } from './demolition.js';
import { initialSurfaceEconomy, advanceSurfaceEconomy, tradeProperty, PROPERTY_ROLES, propertyLocation } from './surface-economy.js';
import { formattedGameClock, ticksUntilNextDay, nextSpeed } from './game-clock.js';

const canvas=document.getElementById('scene');const ctx=canvas.getContext('2d',{alpha:false});
const viewport=document.getElementById('viewport');const worlds=makeWorlds();
worlds.underground.connectivity=connectedFacilities(worlds.underground);
const state={ layer:'underground', selected:{ underground:{x:8,y:8}, surface:{x:7,y:8} }, view:{cx:0,cy:0,panX:0,panY:0,zoom:1,rotation:0}, pointers:new Map(),gesture:null,started:performance.now() };
let bounds={width:0,height:0},dpr=1,raf=0;
let colony=initialColony();
let social=initialSocial();
let game=initialGame(), simAccumulator=0,lastTime=null,speed=1,paused=false;
let selectedTech=null;
let buildRotated=false;
function sizeOf(kind){const s0=FACILITY_SIZES[kind];return buildRotated?[s0[1],s0[0]]:s0;}
function rotateCandidate(){if(!buildChoice)return;buildRotated=!buildRotated;const [w,h]=sizeOf(buildChoice.kind);buildChoice={...buildChoice,w,h,x:Math.min(buildChoice.x,MAP_SIZE-w),y:Math.min(buildChoice.y,MAP_SIZE-h)};const v=buildingPreview(worlds.underground,buildChoice.kind,buildChoice.x,buildChoice.y,game.money,buildRotated);status(`向きを変更：${v.w}×${v.h}・${v.ok?'設置可能。範囲内をタップで建設':'設置不可・'+v.reason}`);updatePlacement();}
function ensureAllColonists(){game={...game,residents:game.residents.map(C.ensureColonist)};}
ensureAllColonists();let productionLog=[],lastColonistReport=null,facilityNotes=[],shoppingNote='';
const BUILDABLE=Object.keys(FACILITY_DEFS);
const HOLD_MS=260;
// v1.11: v1.10以前の初期配給所(10,8)は通路行y=8をまたいでいたため1マス南へ移し、通路をつなぎ直す。
function migrateInitialLayout(w){const shop=w.buildings.find(b=>b.id==='shop'&&b.x===10&&b.y===8&&b.w===2&&b.h===3);if(!shop)return;
 const free=[0,1].every(i=>{const k=`${10+i},11`;return !w.paths.has(k)&&!w.closed.has(k)&&!w.buildings.some(b=>b!==shop&&10+i>=b.x&&10+i<b.x+b.w&&11>=b.y&&11<b.y+b.h);});
 if(!free)return;shop.y=9;w.paths.add('10,8');w.paths.add('11,8');}
let eventQueue=[], activeEvent=null, eventFrame=null, savePending=false, endingUnlocked=false;
let ledger=createLedger(300,1);
let surfaceEconomy=initialSurfaceEconomy();
let marketDesk=F.initialFlea();let fleaTab='trend',fleaCategory='all';const fleaQty={};
function moneyChange(amount, category, note, day=game.day){if(amount!==0)ledger=addTransaction(ledger,{day,amount,category,note});}
let tool='inspect',pathStart=null,hoverTile=null,placement=null,resale=initialResale(),rented=[],owned=[],corridorChoice=null,buildChoice=null,economyDay=game.day,lastRentDue=0,demolishChoice=null; 
const el=id=>document.getElementById(id);

function frameSize() {
  const r=viewport.getBoundingClientRect(); const prevWidth=bounds.width,prevHeight=bounds.height;
  bounds={width:r.width,height:r.height};dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);
  canvas.style.width=`${r.width}px`;canvas.style.height=`${r.height}px`;
  if(!prevWidth){centerMap();} else {state.view.cx+=(r.width-prevWidth)/2;state.view.cy+=(r.height-prevHeight)/2;state.view=boundCamera(state.view,bounds.width,bounds.height);}
}
function centerMap() {
  // The center of all tiles, not the top-left, aligns to the available viewport.
  const p=projectedTile(8,8,state.view.rotation??0);
  state.view={ cx:bounds.width/2,cy:bounds.height*.46, panX:-p.x,panY:-p.y, zoom:Math.min(1.05,Math.max(.48,bounds.width/700)),rotation:state.view.rotation??0 };
  state.view=boundCamera(state.view,bounds.width,bounds.height);updateZoom();
}
function updateZoom(){el('zoomValue').textContent=`${Math.round(state.view.zoom*100)}%`;}
function layerButton(){
  for(const button of document.querySelectorAll('[data-layer]')) {
    const active=button.dataset.layer===state.layer;
    button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  }
  el('sceneName').textContent=worlds[state.layer].name;el('sceneSubtitle').textContent=worlds[state.layer].subtitle;
  updateSelection();
}
function updateSelection(){
  const t=state.selected[state.layer],info=t?describeTile(worlds[state.layer],t.x,t.y):null;
  el('tilePosition').textContent=t?`${t.x}, ${t.y}`:'—';
  el('selectionTitle').textContent=info?.title??'未選択';
  el('selectionType').textContent=info?.type??'タイル';
  const connected=info?.building&&state.layer==='underground'?worlds.underground.connectivity?.[info.building.id]:null;
  el('selectionDescription').textContent=(info?.description??'マップ上のタイルをタップしてください。')+(connected===false?' ⚠ 通路未接続：利用停止':connected===true?' ✓ 出口まで接続':'');
  updateConstruction();
}
let buildCat='life';
function tileEl(icon,name,sub,attrs={}){const b=document.createElement('button');b.type='button';b.className='icon-tile';for(const [k,v] of Object.entries(attrs))b.setAttribute(k,v);b.innerHTML=`<span class="ic" aria-hidden="true">${icon}</span><span class="nm"></span><span class="sub"></span>`;b.querySelector('.nm').textContent=name;b.querySelector('.sub').textContent=sub;b.setAttribute('aria-label',name+' '+sub);return b;}
function buildPalette(){
 const cats=el('buildCats'),grid=el('buildGrid');
 for(const c of BUILD_CATEGORIES){const b=document.createElement('button');b.type='button';b.dataset.cat=c.id;b.innerHTML=`<b aria-hidden="true">${c.icon}</b>${c.name}`;b.addEventListener('click',()=>{buildCat=c.id;updateBuildButtons();});cats.append(b);}
 for(const t of TOOLS)grid.append(tileEl(t.icon,t.name,t.desc.split('。')[0],{'data-tool':t.id,'data-cat':'tools'}));
 for(const [k,f] of Object.entries(FACILITY_DEFS))grid.append(tileEl(f.icon,f.short,`${f.size.join('×')}・${f.cost}G`,{'data-tool':k,'data-cat':f.cat,title:f.desc}));
}
buildPalette();
function updateBuildButtons(){
 for(const c of document.querySelectorAll('#buildCats [data-cat]'))c.classList.toggle('active',c.dataset.cat===buildCat);
 for(const b of document.querySelectorAll('#buildGrid [data-tool]')){const t=b.dataset.tool;b.hidden=b.dataset.cat!==buildCat;const f=FACILITY_DEFS[t];if(!f)continue;
  const locked=f.tech&&!colony.completedResearch.includes(f.tech),poor=game.money<f.cost;
  b.disabled=!!locked||poor;b.classList.toggle('locked',!!locked);b.classList.toggle('poor',!locked&&poor);
  b.querySelector('.sub').textContent=locked?`🔒${techById(f.tech).name}`:`${f.size.join('×')}・${f.cost}G`;
  let lk=b.querySelector('.lock');if(locked&&!lk){lk=document.createElement('span');lk.className='lock';lk.textContent='🔒';b.append(lk);}else if(!locked&&lk)lk.remove();
  if(b.disabled&&tool===t){tool='inspect';buildChoice=null;}}
}
function updateConstruction(){updateBuildButtons();
  for(const btn of document.querySelectorAll('[data-tool]')){
    const active=btn.dataset.tool===tool;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));
  }
}
function status(message){el('buildMessage').textContent=message;}
function refreshConnectivity(){worlds.underground.connectivity=connectedFacilities(worlds.underground);}
function setTool(next){if(next!==tool)buildRotated=false;tool=next;pathStart=null;corridorChoice=null;buildChoice=null;demolishChoice=null;hoverTile=state.selected.underground;placement=null;updateConstruction();updatePlacement();
 status(tool==='path'?'通路：始点を長押し→指を滑らせて離すと施工（タップ2回でも可）。ドラッグだけならマップ移動。':BUILDABLE.includes(tool)?`${FACILITY_NAMES[tool]} ${FACILITY_SIZES[tool].join('×')}・${BUILD_COSTS[tool]}G：タップで仮置き→範囲内を再タップで建設。仮置きを長押しで移動。${FACILITIES[tool]?.tech&&!colony.completedResearch.includes(FACILITIES[tool].tech)?`（要研究：${techById(FACILITIES[tool].tech).name}）`:''}`:tool==='unlock'?'閉鎖区画をタップして選択し、再タップして開放。':tool==='demolish'?'施設・通路をタップして選択→同じ対象を再タップして撤去。':'マップを観察できます。');}
for(const btn of document.querySelectorAll('[data-tool]'))btn.addEventListener('click',()=>{if(state.layer!=='underground'&&btn.dataset.tool!=='inspect')switchLayer('underground');setTool(btn.dataset.tool)});
function rectangle(x,y,w,h){const cells=[];for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)cells.push({x:xx,y:yy});return cells;}
function updatePlacement(){window.__buildChoice=buildChoice;
 placement=null;if(state.layer!=='underground'||tool==='inspect')return;
 const p=buildChoice??hoverTile??state.selected.underground;
 if(BUILDABLE.includes(tool)){
  const v=buildingPreview(worlds.underground,tool,p.x,p.y,game.money,buildRotated);
  placement={kind:tool,x:p.x,y:p.y,w:v.w,h:v.h,tiles:rectangle(p.x,p.y,v.w,v.h),valid:v.ok};
 }else if(tool==='path'&&corridorChoice?.start){
  const to=corridorChoice.end??hoverTile??corridorChoice.start;
  const route=planCorridor(worlds.underground,corridorChoice.start,to,game.money);
  placement={kind:'path',tiles:route.route??[],valid:route.ok};
 }else if(tool==='demolish'&&demolishChoice){
  if(demolishChoice.type==='building'){const b=worlds.underground.buildings.find(b=>b.id===demolishChoice.id);if(b)placement={kind:'demolish',tiles:rectangle(b.x,b.y,b.w,b.h),valid:false};}
  else placement={kind:'demolish',tiles:[{x:demolishChoice.x,y:demolishChoice.y}],valid:false};
 }else if(tool==='unlock'&&buildChoice){
  const z=zoneAt(worlds.underground,buildChoice.x,buildChoice.y);
  if(z)placement={kind:'unlock',tiles:rectangle(z.x,z.y,z.w,z.h),valid:!z.open};
 }
}
function buildAt(tile){
 if(state.layer!=='underground')return;
 const world=worlds.underground;
 if(tool==='demolish'){
  const target=demolitionTarget(world,tile.x,tile.y);
  if(!target.ok){demolishChoice=null;status(target.reason);updatePlacement();return;}
  if(demolishChoice?.id!==target.id){demolishChoice=target;status(`${target.description}を撤去します。同じ対象をもう一度タップして確定（返金なし）。`);updatePlacement();return;}
  const result=applyDemolition(world,target);if(!result.ok){status(result.reason);return;}
  worlds.underground=result.world;demolishChoice=null;status(`${result.removed}を撤去しました。施設の通路接続を確認してください。`);
 }else if(tool==='unlock'){
  const zone=zoneAt(world,tile.x,tile.y);
  if(!zone||zone.open){status('開放可能な閉鎖区画を選んでください。');return;}
  const second=buildChoice?.kind==='unlock'&&zoneAt(world,buildChoice.x,buildChoice.y)?.id===zone.id;
  if(!second){buildChoice={kind:'unlock',x:tile.x,y:tile.y};status(`${zone.name}：開放費用 ${zone.cost}G。もう一度この区画をタップして確定。`);updatePlacement();return;}
  const result=applyConstruction(world,{type:'unlock',zoneId:zone.id},game.money);
  if(!result.ok){status(result.reason);return;}
  worlds.underground=result.world;game={...game,money:result.money};moneyChange(-result.cost,'建設',zone.name+'の区画開放');sfx('build');buildChoice=null;status(`${zone.name} を開放（−${result.cost}G）`);
 }else if(tool==='path'){
  const next=chooseCorridor(corridorChoice,tile);corridorChoice=next.state;
  pathStart=corridorChoice.start;
  if(!corridorChoice.end){status(`始点 (${tile.x}, ${tile.y}) を選択。終点を指定してください。`);updatePlacement();return;}
  const plan=planCorridor(world,corridorChoice.start,corridorChoice.end,game.money);
  if(!plan.ok){status('施工不可：'+plan.reason+'。終点を変えてください。');updatePlacement();return;}
  if(!next.commit){status(`通路 ${plan.newTiles.length}マス・${plan.cost}G。終点 (${corridorChoice.end.x}, ${corridorChoice.end.y}) を再タップで施工。別地点なら終点変更。`);updatePlacement();return;}
  const result=applyCorridor(world,plan,game.money);
  if(!result.ok){status(result.reason);return;}
  worlds.underground=result.world;game={...game,money:result.money};moneyChange(-result.cost,'建設','通路の一括施工');corridorChoice=null;pathStart=null;status(`通路 ${plan.newTiles.length}マスを敷設（−${result.cost}G）。次の始点を選択。`);
 }else if(BUILDABLE.includes(tool)){
  const fac=FACILITIES[tool];if(fac?.tech&&!colony.completedResearch.includes(fac.tech)){status(`${fac.name}には研究「${techById(fac.tech).name}」が必要です。`);return;}
  const dimensions=sizeOf(tool);
  const next=chooseFootprint(buildChoice,tool,tile,dimensions);buildChoice=next.candidate;
  const v=buildingPreview(world,tool,buildChoice.x,buildChoice.y,game.money,buildRotated);
  if(!next.commit){status(`${FACILITY_NAMES[tool]} ${v.w}×${v.h}・${BUILD_COSTS[tool]}G：${v.ok?'設置可能':'設置不可・'+v.reason}。範囲内をもう一度タップで建設／長押しで移動。`);updatePlacement();return;}
  if(!v.ok){status('配置不可：'+v.reason);updatePlacement();return;}
  const result=applyConstruction(world,{type:'build',kind:tool,x:buildChoice.x,y:buildChoice.y,rotated:buildRotated},game.money);
  if(!result.ok){status(result.reason);return;}
  worlds.underground=result.world;game={...game,money:result.money};moneyChange(-result.cost,'建設',FACILITY_NAMES[tool]+'の建築');sfx('build');buildChoice=null;status(`${FACILITY_NAMES[tool]} ${v.w}×${v.h} を建設（−${result.cost}G）`);
 }
 refreshConnectivity();hoverTile=null;updatePlacement();updateSelection();updateEconomy();
}
function buildCorridorDrag(start,end){
 const plan=planCorridor(worlds.underground,start,end,game.money);
 if(!plan.ok){status('施工不可：'+plan.reason);corridorChoice={start,end};updatePlacement();return;}
 const result=applyCorridor(worlds.underground,plan,game.money);if(!result.ok){status(result.reason);return;}
 worlds.underground=result.world;game={...game,money:result.money};moneyChange(-result.cost,'建設','ドラッグ通路施工');
 corridorChoice=null;pathStart=null;hoverTile=null;refreshConnectivity();updatePlacement();updateSelection();updateEconomy();saveNow();
 status(`${plan.newTiles.length}マスの通路を施工（−${result.cost}G）。`);
}
function visibleBuildingAt(point){
 const world=worlds[state.layer];
 const inside=vertices=>{let hit=false;for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
  const a=vertices[i],b=vertices[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
 }return hit;};
 const ordered=[...world.buildings].sort((a,b)=>{
  const fa=projectedFootprint(a,state.view.rotation??0),fb=projectedFootprint(b,state.view.rotation??0);
  return fb.x+fb.y+fb.w+fb.h-fa.x-fa.y-fa.w-fa.h;
 });
 for(const b of ordered){
  const f=projectedFootprint(b,state.view.rotation??0);
  const pts=[[f.x,f.y],[f.x+f.w,f.y],[f.x+f.w,f.y+f.h],[f.x,f.y+f.h]].map(([x,y])=>{const p=tileToWorld(x,y);return worldToView(p.x,p.y,state.view)});
  if(inside(pts))return b;
  const ht=(b.kind==='exit'?10:21)*state.view.zoom;
  if(inside([pts[0],pts[1],{x:pts[1].x,y:pts[1].y-ht},{x:pts[0].x,y:pts[0].y-ht}])||inside([pts[0],pts[3],{x:pts[3].x,y:pts[3].y-ht},{x:pts[0].x,y:pts[0].y-ht}]))return b;
 }
 return null;
}
function positionRotateButton(){const b=el('rotateBuild');if(!b)return;const show=state.layer==='underground'&&buildChoice&&BUILDABLE.includes(tool)&&!state.gesture?.mode?.startsWith('move');
 if(!show){b.hidden=true;return;}const [w,h]=sizeOf(buildChoice.kind);let best=null;
 for(const [cx,cy] of [[buildChoice.x,buildChoice.y],[buildChoice.x+w,buildChoice.y],[buildChoice.x,buildChoice.y+h],[buildChoice.x+w,buildChoice.y+h]]){const p=projectedTile(cx-.5,cy-.5,state.view.rotation??0),v=worldToView(p.x,p.y,state.view);if(!best||v.x>best.x)best=v;}
 const r=canvas.getBoundingClientRect(),host=canvas.offsetParent?.getBoundingClientRect()??r;b.hidden=false;b.style.left=`${Math.min(r.width-48,Math.max(4,best.x+8))+r.left-host.left}px`;b.style.top=`${Math.min(r.height-48,Math.max(4,best.y-22))+r.top-host.top}px`;}
function residentAt(point){let best=null,bd=26*Math.max(.6,state.view.zoom);
 for(const r of visibleResidents(game,state.layer,worlds[state.layer])){const w=projectedTile(r.x,r.y,state.view.rotation??0),v=worldToView(w.x,w.y-14,state.view);const d=Math.hypot(v.x-point.x,v.y-point.y);if(d<bd){bd=d;best=r.resident;}}
 return best;}
function atPoint(point){return hitTile(point.x,point.y,state.view);}
function switchLayer(layer){if(!worlds[layer])return;state.layer=layer; if(layer==='surface'&&tool!=='inspect')setTool('inspect');layerButton();updateRentalPanel();}
function canvasCoords(evt){const r=canvas.getBoundingClientRect();return{x:evt.clientX-r.left,y:evt.clientY-r.top};}
function midpoint(a,b){return{x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function beginGesture(){
  const pointers=[...state.pointers.values()];
  if(pointers.length===1)state.gesture={mode:'drag',start:pointers[0],startTile:atPoint(pointers[0]),prev:pointers[0],moved:false};
  else if(pointers.length>=2)state.gesture={mode:'pinch',...makePinch(state.view,pointers[0],pointers[1])};
}
function insideCandidate(t){if(!buildChoice||!BUILDABLE.includes(buildChoice.kind)||!t)return false;const [w,h]=sizeOf(buildChoice.kind);return t.x>=buildChoice.x&&t.x<buildChoice.x+w&&t.y>=buildChoice.y&&t.y<buildChoice.y+h;}
canvas.addEventListener('pointerdown',evt=>{
  if(evt.button!==0&&evt.pointerType==='mouse')return;
  canvas.setPointerCapture(evt.pointerId);state.pointers.set(evt.pointerId,canvasCoords(evt));beginGesture();
  const g=state.gesture;
  if(g?.mode==='drag'&&state.layer==='underground'&&tool!=='inspect'){
    const onCand=insideCandidate(g.startTile);
    if(onCand||tool==='path'){g.hold=setTimeout(()=>{if(state.gesture!==g||g.moved)return;
      if(onCand){g.mode='moveCandidate';g.offset={x:g.startTile.x-buildChoice.x,y:g.startTile.y-buildChoice.y};status('長押し中：指を動かして位置を調整。離したら、もう一度タップで建設。');}
      else{g.mode='drawPath';corridorChoice={start:g.startTile,end:g.startTile};updatePlacement();status('通路を描画中：指を離した地点まで施工します。');}
      try{navigator.vibrate?.(12);}catch{}},HOLD_MS);}
  }
});
canvas.addEventListener('pointermove',evt=>{
  if(!state.pointers.has(evt.pointerId))return;
  const point=canvasCoords(evt);state.pointers.set(evt.pointerId,point);
  const g=state.gesture;
  if(state.pointers.size===1&&g?.mode==='moveCandidate'){const t=atPoint(point);if(t&&buildChoice){const [w,h]=sizeOf(buildChoice.kind);buildChoice={...buildChoice,x:Math.max(0,Math.min(MAP_SIZE-w,t.x-g.offset.x)),y:Math.max(0,Math.min(MAP_SIZE-h,t.y-g.offset.y))};updatePlacement();}return;}
  if(state.pointers.size===1&&g?.mode==='drawPath'){const t=atPoint(point);if(t){corridorChoice={start:g.startTile,end:t};hoverTile=t;updatePlacement();}g.moved=true;return;}
  if(state.pointers.size===1&&g?.mode==='drag'){
    const deltaX=point.x-g.prev.x,deltaY=point.y-g.prev.y;
    if(Math.hypot(point.x-g.start.x,point.y-g.start.y)>8){g.moved=true;clearTimeout(g.hold);}
    if(g.moved){state.view.panX+=deltaX/state.view.zoom;state.view.panY+=deltaY/state.view.zoom;state.view=boundCamera(state.view,bounds.width,bounds.height);}
    g.prev=point;
  }else if(state.pointers.size>=2){
    if(g?.mode!=='pinch')return;
    state.view=applyPinch(state.view,g,...[...state.pointers.values()].slice(0,2),bounds.width,bounds.height);updateZoom();
  }
});
function endPointer(evt){
  if(!state.pointers.has(evt.pointerId))return;
  const point=canvasCoords(evt),g=state.gesture,one=state.pointers.size===1;clearTimeout(g?.hold);
  const screenBuilding=(state.layer==='surface'||tool==='demolish')?visibleBuildingAt(point):null;
  const tile=screenBuilding?{x:screenBuilding.x,y:screenBuilding.y}:atPoint(point);
  if(evt.type==='pointerup'&&one){
    if(g?.mode==='moveCandidate'){const v=buildingPreview(worlds.underground,buildChoice.kind,buildChoice.x,buildChoice.y,game.money,buildRotated);status(`位置を (${buildChoice.x}, ${buildChoice.y}) に移動：${v.ok?'設置可能。範囲内をもう一度タップで建設':'設置不可・'+v.reason}`);updatePlacement();}
    else if(g?.mode==='drawPath'&&tile){buildCorridorDrag(g.startTile,tile);}
    else if(g?.mode==='drag'&&!g.moved&&tile){
      state.selected[state.layer]=tile;hoverTile=tile;updateSelection();
      const zHit=tool==='inspect'?residentAt(point):null;
      if(zHit){openColonist(zHit.id);}
      else if(tool==='inspect'&&state.layer==='underground'){const b=worlds.underground.buildings.find(b=>tile.x>=b.x&&tile.x<b.x+b.w&&tile.y>=b.y&&tile.y<b.y+b.h);if(b)openBuilding(b.id);}
      else if(tool!=='inspect')buildAt(tile);else if(state.layer==='surface'){const lot=lotAt(tile.x,tile.y);if(lot)openLotDialog(lot);else openPropertyDialog(tile);}
    }
  }
  state.pointers.delete(evt.pointerId);
  if(state.pointers.size===1 && g?.mode==='pinch')state.gesture={mode:'suspended'};
  else if(state.pointers.size)beginGesture();else state.gesture=null;
}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('wheel',evt=>{evt.preventDefault();const p=canvasCoords(evt);state.view=boundCamera(zoomAround(state.view,state.view.zoom*(evt.deltaY<0?1.12:1/1.12),p.x,p.y),bounds.width,bounds.height);updateZoom();},{passive:false});

for(const button of document.querySelectorAll('[data-layer]'))button.addEventListener('click',()=>switchLayer(button.dataset.layer));
el('zoomIn').addEventListener('click',()=>{if(tool!=='inspect'||currentPanel==='build')return;state.view=boundCamera(zoomAround(state.view,state.view.zoom*1.2,bounds.width/2,bounds.height/2),bounds.width,bounds.height);updateZoom();});
el('zoomOut').addEventListener('click',()=>{if(tool!=='inspect'||currentPanel==='build')return;state.view=boundCamera(zoomAround(state.view,state.view.zoom/1.2,bounds.width/2,bounds.height/2),bounds.width,bounds.height);updateZoom();});
el('rotateView').addEventListener('click',()=>{
 if(tool!=='inspect'){status('回転は建設・撤去モードを終了してから行えます。');return;}
 state.view.rotation=((state.view.rotation??0)+1)%4;
 centerMap();
 el('rotateView').setAttribute('aria-label',`マップを90度回転（現在 ${state.view.rotation*90}度）`);
});
el('resetView').addEventListener('click',()=>{if(tool==='inspect'&&currentPanel!=='build')centerMap();});
el('helpButton').addEventListener('click',()=>el('helpDialog').showModal());
el('closeHelp').addEventListener('click',()=>el('helpDialog').close());
window.addEventListener('keydown',evt=>{
  if(evt.key==='Escape'&&el('helpDialog').open){el('helpDialog').close();return;}
  if(tool==='inspect'&&currentPanel!=='build'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(evt.key)){
    evt.preventDefault();const d=evt.key==='ArrowUp'?[0,20]:evt.key==='ArrowDown'?[0,-20]:evt.key==='ArrowLeft'?[20,0]:[-20,0];state.view.panX+=d[0];state.view.panY+=d[1];state.view=boundCamera(state.view,bounds.width,bounds.height);
  }
});
new ResizeObserver(frameSize).observe(viewport);
function marketMessage(text){el('resaleStatus').textContent=text;}
function formatProfit(v){return `${v>=0?'+':''}${v}G`;}
function h(tag,attrs={},...kids){const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='on')e.addEventListener('click',v);else if(k==='class')e.className=v;else if(k==='disabled')e.disabled=v;else e.setAttribute(k,v);}for(const c of kids)if(c!=null)e.append(c);return e;}
function sparkline(vals,up){const c=document.createElement('canvas');c.width=64;c.height=16;c.className='spark';const g=c.getContext('2d');if(!vals?.length)return c;const mn=Math.min(...vals,.9),mx=Math.max(...vals,1.1);g.strokeStyle=up?'#ff9a5a':'#7ab0e8';g.lineWidth=1.5;g.beginPath();vals.forEach((v,i)=>{const x=i/(Math.max(1,vals.length-1))*62+1,y=15-(v-mn)/(mx-mn)*14;i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();return c;}
function fleaAct(result,ok,fail){if(result.ok){updateEconomy();saveNow();}updateResalePanel(result.ok?ok:(fail??result.reason));}
const condName=c=>F.CONDITIONS[c].name;
function updateResalePanel(note=''){
 const m=marketDesk,sum=F.fleaSummary(m),day=game.day,susp=m.suspendedUntil>=day;
 el('marketTrend').textContent=`第${day}日${susp?'・⚠利用制限中':''}`;
 el('marketMetrics').textContent=`評価 ★${m.rating.toFixed(2)}（${m.reviews}件）フォロワー${m.followers??0}｜配送待ち${sum.incoming}・在庫${sum.stock}・出品${sum.listed}・発送中${sum.shipping}｜累計損益 ${formatProfit(sum.profit)}`;
 for(const b of document.querySelectorAll('[data-flea]'))b.classList.toggle('active',b.dataset.flea===fleaTab);
 const body=el('fleaBody');body.replaceChildren();
 const catSel=()=>{const s=h('select',{'aria-label':'カテゴリ'});for(const c of ['all','本','衣料','ホビー','家電','生活雑貨','雑貨']){const o=h('option',{value:c},c==='all'?'すべて':c);if(c===fleaCategory)o.selected=true;s.append(o);}s.addEventListener('change',()=>{fleaCategory=s.value;updateResalePanel();});return s;};
 if(fleaTab==='trend'){
  body.append(h('div',{class:'row'},h('small',{},'相場は毎日変動。バズ中に売り、暴落中に仕入れるのが鉄則。'),catSel()));
  for(const p of F.CATALOG.filter(x=>fleaCategory==='all'||x.category===fleaCategory)){const t=m.trends[p.id],up=t.f>=1,lab=F.trendLabel(m,p.id);
   body.append(h('div',{class:'flea-card'},h('div',{class:'row'},h('b',{},p.name),h('span',{class:'tag '+(t.event==='buzz'||t.f>1.12?'up':t.event==='restock'||t.f<.88?'down':'')},lab),sparkline(m.hist?.[p.id],up)),
    h('small',{},`新品 ${F.marketPrice(m,p.id,'new')}G ／ 美品 ${F.marketPrice(m,p.id,'mint')}G ／ 中古 ${F.marketPrice(m,p.id,'good')}G ／ 傷あり ${F.marketPrice(m,p.id,'damaged')}G ／ ジャンク ${F.marketPrice(m,p.id,'junk')}G`+(m.rating<p.unlock?`　🔒★${p.unlock}で取扱可`:''))));}
 }else if(fleaTab==='shop'){
  body.append(h('div',{class:'row'},h('small',{},'今日のネットショップ新着（毎朝入れ替わり）'),catSel()));
  const offers=F.shopOffers(m,day,fleaCategory).filter(o=>F.offerLeft(m,o)>0);
  if(!offers.length)body.append(h('small',{},'該当する出品はありません。'));
  const est=o=>{const fair=F.marketPrice(m,o.id,o.listed);return Math.round(fair-Math.ceil(fair*F.FEE_RATE)-F.SHIPPING.anonymous.cost-o.price-o.ship);};offers.sort((a,b)=>est(b)-est(a));
  for(const o of offers){const p=F.product(o.id),fair=F.marketPrice(m,o.id,o.listed),total=o.price+o.ship,margin=est(o);
   const risky=o.sellerRating<3.3||o.price<fair*.65;
   body.append(h('div',{class:'flea-card'},h('div',{class:'row'},h('b',{},p.name),h('span',{class:'tag'},condName(o.listed))),
    h('small',{},`出品者「${o.seller}」★${o.sellerRating}・${o.photo}／価格 ${o.price}G＋送料 ${o.ship?o.ship+'G':'込み'}`),
    h('div',{class:'row'},h('small',{},`この状態の相場 ${fair}G → 見込み利益 `),h('span',{class:'tag '+(margin>0?'good':'risk')},formatProfit(margin)),risky?h('span',{class:'tag risk'},'⚠ 怪しい'):null,
     null),
    (()=>{const left=F.offerLeft(m,o);const q=Math.min(left,fleaQty[o.oid]??1);const sum=o.price*q+o.ship;
     const step=d=>()=>{fleaQty[o.oid]=Math.max(1,Math.min(left,q+d));updateResalePanel();};
     return h('div',{class:'row flea-qty'},h('small',{},`在庫 ${left}個（1個${o.price}G・送料はまとめて1回）`),h('button',{on:step(-1),disabled:q<=1},'−'),h('b',{},`${q}個`),h('button',{on:step(1),disabled:q>=left},'＋'),
      h('button',{on:()=>{const r=F.buyOffer(marketDesk,game.money,o,day,q);if(r.ok){marketDesk=r.market;game={...game,money:r.money};moneyChange(-r.cost,'フリマ仕入れ',`${p.name}×${q}（${o.seller}）`);delete fleaQty[o.oid];}fleaAct(r,`${p.name}を${q}個購入。到着まで1〜2日。`);},disabled:o.locked},o.locked?`🔒★${p.unlock}`:`購入 ${sum}G`));})()));}
 }else if(fleaTab==='stock'){
  if(m.incoming.length){body.append(h('small',{},'🚚 配送中'));for(const p of m.incoming)body.append(h('div',{class:'flea-card'},h('div',{class:'row'},h('b',{},F.product(p.id).name),h('span',{class:'tag'},`第${p.arrive}日 到着予定`)),h('small',{},`表記：${condName(p.listed)}／${p.seller}／${p.cost}G`)));}
  if(!m.inventory.length)body.append(h('small',{},'在庫はありません。「仕入れ」から購入しましょう。'));
  for(const i of m.inventory){const p=F.product(i.id);
   const listCond=h('select',{'aria-label':'表記する状態'});for(const [k,c] of Object.entries(F.CONDITIONS)){const o=h('option',{value:k},(k===i.condition?'✓ ':'')+c.name+(c.rank>F.CONDITIONS[i.condition].rank?'（盛る）':''));if(k===i.condition)o.selected=true;listCond.append(o);}
   const ship=h('select',{'aria-label':'発送方法'});for(const [k,s2] of Object.entries(F.SHIPPING)){const o=h('option',{value:k},`${s2.name} ${s2.cost}G`);if(k==='anonymous')o.selected=true;ship.append(o);}
   const photo=h('select',{'aria-label':'撮影'});for(const [k,ph] of Object.entries(F.PHOTOS))photo.append(h('option',{value:k},`${ph.name}${ph.cost?' '+ph.cost+'G':''}`));
   const price=h('input',{type:'number',min:'1',max:'99999',inputmode:'numeric','aria-label':'販売価格'});const suggest=()=>{price.value=String(F.marketPrice(marketDesk,i.id,listCond.value));};suggest();listCond.addEventListener('change',suggest);
   const est=()=>{const pr=Number(price.value)||0,sh=F.SHIPPING[ship.value].cost;return pr-Math.ceil(pr*F.FEE_RATE)-sh-i.cost;};
   const estEl=h('small',{},'');const upd=()=>{estEl.textContent=`手取り見込み ${formatProfit(est())}（手数料10%・送料込み）`;};upd();for(const x of [price,ship,listCond])x.addEventListener('input',upd),x.addEventListener('change',upd);
   body.append(h('div',{class:'flea-card'},h('div',{class:'row'},h('b',{},`#${i.uid} ${p.name}`),h('span',{class:'tag'},condName(i.condition)),i.fake?h('span',{class:'tag risk'},'偽物'):null,i.cleaned?h('span',{class:'tag good'},'整備済'):null),
    h('small',{},`仕入れ原価 ${i.cost}G ／ 現在の相場 ${F.marketPrice(m,i.id,i.condition)}G`),
    h('div',{class:'row'},listCond,ship),h('div',{class:'row'},photo,price,estEl),
    h('div',{class:'row'},
     h('button',{on:()=>{const r=F.cleanItem(marketDesk,game.money,i.uid,day);if(r.ok){marketDesk=r.market;game={...game,money:r.money};moneyChange(-r.cost,'フリマ梱包',`${p.name}の清掃・整備`);}fleaAct(r,r.success?`整備成功！状態が「${condName(F.migrateFlea(marketDesk).inventory.find(x=>x.uid===i.uid).condition)}」に上がった`:'整備したが状態は変わらなかった…');},disabled:i.cleaned||i.fake},i.condition==='junk'?'修理 18G':`清掃・整備 ${F.CLEAN_COST}G`),
     h('button',{on:()=>{const r=F.listItem(marketDesk,game.money,i.uid,{price:Number(price.value),listedCondition:listCond.value,ship:ship.value,photo:photo.value,freePhoto:CITY.lotEffects(CITY.ensureCity(surfaceEconomy).city).freePhoto},day);if(r.ok){marketDesk=r.market;game={...game,money:r.money};if(r.cost)moneyChange(-r.cost,'フリマ梱包',p.name+'の撮影');}fleaAct(r,`${p.name}を${price.value}Gで出品しました。`);},disabled:susp},'出品する'),
     h('button',{class:'warn',on:()=>{const r=F.disposeItem(marketDesk,i.uid);if(r.ok)marketDesk=r.market;fleaAct(r,`${p.name}を処分しました（損失 ${r.loss}G）`);}},'処分'))));}
 }else if(fleaTab==='listing'){
  if(!m.listings.length)body.append(h('small',{},'出品中の商品はありません。'));
  for(const l of m.listings){const p=F.product(l.id),fair=F.marketPrice(m,l.id,l.listedCondition);const price=h('input',{type:'number',min:'1',max:'99999',value:String(l.price),'aria-label':'価格'});
   const card=h('div',{class:'flea-card'},h('div',{class:'row'},h('b',{},`#${l.uid} ${p.name} ${l.price}G`),h('span',{class:'tag'+(l.listedCondition!==l.condition?' risk':'')},condName(l.listedCondition)+(l.listedCondition!==l.condition?'（盛り）':''))),
    h('small',{},`👀${l.views} ❤${l.likes} ／ 相場 ${fair}G（${Math.round(l.price/fair*100)}%）／ ${F.SHIPPING[l.ship].name} ／ 出品${day-l.listedDay}日目`));
   if(l.offer){card.append(h('small',{},`💬「${l.offer}Gになりませんか？」`),h('div',{class:'row'},
     h('button',{on:()=>{const r=F.resolveOffer(marketDesk,l.uid,true,day);if(r.ok){marketDesk=r.market;game={...game,money:game.money+r.money};moneyChange(r.sale.price,'フリマ売上',p.name+'・交渉成立');moneyChange(-r.sale.fee,'フリマ販売手数料',p.name);moneyChange(-r.sale.ship,'フリマ梱包',p.name+'の送料');}fleaAct(r,`交渉成立！${p.name}を${l.offer}Gで発送します。`);}},'応じる'),
     h('button',{class:'warn',on:()=>{const r=F.resolveOffer(marketDesk,l.uid,false,day);if(r.ok)marketDesk=r.market;fleaAct(r,'交渉をお断りしました。');}},'断る')));}
   else card.append(h('div',{class:'row'},price,h('button',{on:()=>{const r=F.changePrice(marketDesk,l.uid,Number(price.value));if(r.ok)marketDesk=r.market;fleaAct(r,Number(price.value)<l.price?'値下げ！いいねした人に通知が届きます。':'価格を変更しました。');}},'価格変更'),
     h('button',{class:'warn',on:()=>{const r=F.cancelListing(marketDesk,l.uid);if(r.ok)marketDesk=r.market;fleaAct(r,'出品を取り下げ、在庫に戻しました。');}},'取り下げ')));
   body.append(card);}
 }else{
  if(!m.history.length)body.append(h('small',{},'取引履歴はまだありません。'));
  const label={shipping:'🚚 発送済み・到着待ち',done:'✅ 取引完了',claim:'⚠ クレーム・返金',disposed:'🗑 処分',closed:'✅ 完了（旧）'};
  for(const x of m.history.slice(0,20))body.append(h('div',{class:'flea-card'},h('div',{class:'row'},h('b',{},`第${x.day}日 ${x.name}`),h('span',{class:'tag '+(x.status==='claim'?'risk':x.profit>0?'good':'')},formatProfit(x.profit??0))),h('small',{},`${label[x.status]??x.status} ／ 売値 ${x.price}G${x.review?` ／ 評価★${x.review}`:''}`)));
 }
 if(note)marketMessage(note);
}
for(const b of document.querySelectorAll('[data-flea]'))b.addEventListener('click',()=>{fleaTab=b.dataset.flea;updateResalePanel();});
function updateRentalPanel(){
 const t=state.selected.surface,property=state.layer==='surface'?selectProperty(RENTALS,t.x,t.y):null;
 el('rentSelected').disabled=!property||rented.includes(property.id)||owned.includes(property.id)||game.money<property.deposit;
 el('buySelected').disabled=!property||owned.includes(property.id)||game.money<PURCHASE_PRICES[property.id];
 el('rentalInfo').textContent=property?`${property.name}（${property.w}×${property.h}） / 賃貸：契約${property.deposit}G、毎朝${property.rent}G / 購入：${PURCHASE_PRICES[property.id]}G。${owned.includes(property.id)?'購入済み':rented.includes(property.id)?'賃貸契約中':''}`:'地上マップでアパート・店舗・倉庫をタップしてください。';
}
el('rentSelected').addEventListener('click',()=>{
 const t=state.selected.surface,p=selectProperty(RENTALS,t.x,t.y);if(!p)return;
 const r=rentProperty(rented,game.money,p.id);if(!r.ok){el('rentalInfo').textContent=r.reason;return;}
 rented=r.rented;game={...game,money:r.money};moneyChange(-r.deposit,'物件契約',p.name+'の契約');updateEconomy();saveNow();
});
el('buySelected').addEventListener('click',()=>{
 const t=state.selected.surface,p=selectProperty(RENTALS,t.x,t.y);if(!p)return;
 const r=buyProperty(owned,rented,game.money,p.id);if(!r.ok){el('rentalInfo').textContent=r.reason;return;}
 const before=game.money;owned=r.owned;rented=r.rented;game={...game,money:r.money};moneyChange(r.money-before,'不動産購入',p.name+'の購入');updateEconomy();saveNow();
});

function openPropertyDialog(tile){
 const p=selectProperty(RENTALS,tile.x,tile.y);if(!p)return;
 const dialog=el('propertyDialog');dialog.dataset.id=p.id;renderPropertyDialog();
 if(!dialog.open)dialog.showModal();
}
function renderPropertyDialog(){
 const dialog=el('propertyDialog'),p=RENTALS.find(q=>q.id===dialog.dataset.id);if(!p)return;
 const mine=owned.includes(p.id),rental=rented.includes(p.id),sublet=surfaceEconomy.leasedOut.includes(p.id),role=PROPERTY_ROLES[p.id],location=propertyLocation(p.id);
 el('propertyTitle').textContent=p.name;
 el('propertyDetails').textContent=`${role?.name??'地上物件'}：${role?.detail??''}\n面積 ${p.w}×${p.h}／契約金 ${p.deposit}G／日額家賃 ${p.rent}G／購入 ${p.purchase}G\n状態：${mine?(sublet?'所有・人間に貸出中':'所有・自営中'):rental?'賃借・自営中':'未契約'}。\n立地：${location?.grade??'不明'}／道路接面 ${location?.frontage??0}／集客倍率 ${location?.accessibility??1}倍\n街の人間 ${surfaceEconomy.humans}人／信頼 ${surfaceEconomy.trust}/100／来客 ${surfaceEconomy.last?.visitors??'—'}人`;
 const actions=el('propertyDialogActions');actions.replaceChildren();
 const button=(label,handler,disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.addEventListener('click',handler);actions.append(b);};
 if(!mine&&!rental){button(`借りる ${p.deposit}G`,()=>{el('rentSelected').click();renderPropertyDialog();},game.money<p.deposit);button(`買う ${p.purchase}G`,()=>{el('buySelected').click();renderPropertyDialog();},game.money<p.purchase);}
 else if(mine){button(sublet?'貸出解除':'貸す',()=>{const r=tradeProperty(surfaceEconomy,owned,rented,p.id,sublet?'unlease':'lease',game.money);if(!r.ok)return;surfaceEconomy=r.surface;renderPropertyDialog();updateSurfacePanel();saveNow();});button(`売る +${Math.floor(p.purchase*.7)}G`,()=>{const r=tradeProperty(surfaceEconomy,owned,rented,p.id,'sell',game.money);if(!r.ok){el('propertyDetails').textContent+='\n'+r.reason;return;}const diff=r.money-game.money;owned=r.owned;game={...game,money:r.money};moneyChange(diff,'不動産売却',p.name+'を売却');renderPropertyDialog();updateEconomy();saveNow();},sublet);}
 else button('賃借中',()=>{},true);
}
el('propertyClose').addEventListener('click',()=>el('propertyDialog').close());
function updateSurfacePanel(){
 worlds.surface.humanCount=surfaceEconomy.humans;worlds.surface.humanTrust=surfaceEconomy.trust;
 const last=surfaceEconomy.last;
 el('surfaceEconomyInfo').textContent=`人間 ${surfaceEconomy.humans}人 · 信頼 ${surfaceEconomy.trust}/100 · 来客 ${last?.visitors??'—'}人 · 前日売上 +${last?.income??0}G · 維持費 −${last?.expenses??0}G。警戒度が上がると客足と人口が減ります。`;
}
function refreshResidentRows(){
 const host=el('residentJobs');
 for(const row of [...host.children])if(!game.residents.some(r=>String(r.id)===row.dataset.id))row.remove();
 for(const r of game.residents){
  let line=[...host.children].find(node=>node.dataset.id===String(r.id));
  if(!line){
   line=document.createElement('div');line.className='resident-row';line.dataset.id=String(r.id);
   const name=document.createElement('span'),select=document.createElement('select');
   select.setAttribute('aria-label',`${r.name}の仕事`);
   for(const [id,job] of Object.entries(JOBS)){const option=document.createElement('option');option.value=id;option.dataset.base=`${job.icon} ${job.name}${job.wage?`（時給${job.wage}G×${SHIFT_HOURS}h）`:''}`;option.textContent=option.dataset.base;select.append(option);}
   select.addEventListener('change',()=>{game=assignJob(game,r.id,select.value);updateEconomy();});
   const info=document.createElement('button');info.type='button';info.textContent='関係・履歴';info.className='detail-btn';info.addEventListener('click',()=>{showResidentDetail(r.id);showPanel('social');});
   const grow=document.createElement('button');grow.type='button';grow.className='detail-btn grow-btn';grow.addEventListener('click',()=>openColonist(r.id));
   line.append(name,select,grow,info);host.append(line);
  }
  const visual=residentVisual(game,r),name=line.firstElementChild,select=line.querySelector('select');
  const cr=C.ensureColonist(r),st=C.decayStage(cr.decay);name.textContent=`${r.name} Lv${cr.level} · 疲労${r.fatigue} · 衝動${r.impulse??0} · 腐敗${Math.round(cr.decay)}(${st.name}) · 臭気${C.odorOf(cr)} · ${r.strikeDays>0?'✊ストライキ · ':''}${visual.status}`;
  line.querySelector('.grow-btn').textContent=cr.sp>0?`育成 ⬆${cr.sp}`:'育成';
  for(const o of line.querySelector('select').options){const ok=jobEligible(cr,o.value);o.disabled=!ok;o.textContent=ok?o.dataset.base:`🔒 ${o.dataset.base}（要${jobReqText(o.value)}）`;}
  name.title=visual.reason;
  // Keep the select DOM mounted and don't touch its value during native selection.
  if(document.activeElement!==select && select.value!==r.job)select.value=r.job;
 }
}
function updateEconomy(){updateBuildButtons();
  const capacity=colonyCapacity();
  el('populationValue').textContent=`${game.residents.length} / ${capacity}`;
  el('moneyValue').textContent=game.money;
  el('foodValue').innerHTML=`食${colony.inventory.food}<small> ・品${ST.goodsTotal(colony.inventory)}</small>`;
  el('moodValue').textContent=Math.max(0,moodOf(game)-Math.round(game.residents.reduce((sum,r)=>sum+(r.impulse??0),0)/Math.max(1,game.residents.length)/3));
  el('alertValue').textContent=game.alert;
  updateConstruction();updateRentalPanel();updateSurfacePanel();updateColonyPanel();updateSocialPanel();updateCityPanel();
  const clock=game.tick%120,night=clock>=60;
  const clockInfo=formattedGameClock(game.day,game.tick);
  el('dayValue').textContent=clockInfo.dateTime;
  el('gameDateLabel').textContent=clockInfo.dateTime;
  el('gamePhaseLabel').textContent=`${clockInfo.phase} · 1日120秒`;
  el('progressValue').textContent=`${clock}/120 秒`;
  const message=game.lastReport?`前日：+${game.lastReport.income}G / 調達 +${game.lastReport.harvest} / 配給不足 ${colony.report?.shortage??0}体 / 地上賃料 -${lastRentDue}G`:'仕事を選び、夜になると成果が反映されます。';
  el('reportValue').textContent=message;
  if(el('statsDialog').open)refreshStatDetail();
  refreshResidentRows();
}

function showResidentDetail(id){
 const resident=game.residents.find(r=>r.id===id);if(!resident)return;
 const link=social.links[id],neighbor=social.neighbors.find(n=>n.id===link?.neighborId);
 const entries=social.history.filter(e=>e.residentId===id).slice(-8).reverse();
 el('socialTitle').textContent=`${resident.name}の人間関係`;
 el('socialDetail').textContent=`相手：${neighbor?.name??'未接触'} / 親密度：${link?.affinity??0} / 疑惑：${link?.suspicion??0}/100 / 交流回数：${link?.meetings??0}。 食料：${resident.lastNeeds?.food===false?'不足':'充足または未判定'}、疲労：${resident.fatigue}、衝動：${resident.impulse}。`;
 el('socialPersonalHistory').replaceChildren(...entries.map(e=>{const li=document.createElement('li');li.textContent=`第${e.day}日 ${e.message}（理由：${e.reason}）`;return li;}));
 if(!entries.length){const li=document.createElement('li');li.textContent='交流履歴はまだありません';el('socialPersonalHistory').append(li);}
}
function updateSocialPanel(){
 const box=el('socialHistory');if(!box)return;
 const recent=[...social.history].reverse().slice(0,12);box.replaceChildren(...recent.map(e=>{const li=document.createElement('li');li.textContent=`第${e.day}日 ${e.message} — ${e.reason}`;return li;}));
 if(!recent.length){const li=document.createElement('li');li.textContent='まだ交流イベントは発生していません';box.append(li);}
 el('neighborSummary').textContent=social.neighbors.map(n=>`${n.name}：${n.converted?'眷属になった':'人間として生活中'}`).join(' / ');
}
function renderStockAndRecipes(){
 {const sl=colony.shoppingList??{};const packs=Object.values(sl).reduce((a,b)=>a+b,0);const total=Object.entries(sl).reduce((a,[k,n])=>a+n*Math.ceil(ITEMS[k].buy[1]*currentMods().supplyMul),0);
  el('shoppingSummary').textContent=(packs?`今夜の買い出し：${Object.entries(sl).map(([k,n])=>ITEMS[k].icon+'×'+n).join(' ')}（約${total}G・${Math.ceil(packs/3)}人で出発）`:'今夜の買い出し予定はありません。')+(colony.completedResearch.includes('autoprocure')?'　🤖自動調達：ON':'　夕方に調達当番が不足物資を相談します。')+(shoppingNote?`　前夜：${shoppingNote}`:'');}
 const inv=colony.inventory,caps=ST.capacities(worlds.underground),g=el('stockGrid');if(!g)return;g.replaceChildren();
 el('stockSummary').textContent=`🍞${inv.food}/${caps.food}　📦${ST.goodsTotal(inv)}/${caps.goods}`;
 for(const [k,it] of Object.entries(ITEMS)){const n=inv[k]??0;if(!n&&!it.buy&&!['residue','labwaste'].includes(k))continue;const t=tileEl(it.icon,it.name,'');t.disabled=true;t.classList.toggle('zero',!n);const q=document.createElement('span');q.className='qty';q.textContent=n;t.append(q);t.querySelector('.sub').remove();g.append(t);}
 renderFacilityPlans();
}
// v2.5: per-building production plans (recipe + staff). Rows are rebuilt only when the building set changes,
// so an open <select> is never destroyed by the per-tick refresh.
function prodBuildings(){return worlds.underground.buildings.filter(b=>recipesFor(b.kind).length&&worlds.underground.connectivity?.[b.id]);}
function staffCap(b){const a=(b.w??2)*(b.h??2);return (a>=6?3:a>=4?2:1)+((b.level??1)-1);}
function planOf(b){const p=(colony.facilityPlans??{})[b.id];return {recipe:p?.recipe??(colony.recipePrefs??{})[b.kind]??'auto',staff:Math.max(0,Math.min(staffCap(b),p?.staff??1))};}
function setPlan(b,patch){colony={...colony,facilityPlans:{...(colony.facilityPlans??{}),[b.id]:{...planOf(b),...patch}}};saveNow();renderFacilityPlans(true);}
function internalSlots(){return {process:prodBuildings().reduce((n,b)=>n+planOf(b).staff,0),research:researchState(colony).active?Math.max(0,connectedLabs())*2:0};}
function staffing(residents){const posts=prodBuildings().map(b=>({b,plan:planOf(b),workers:[]}));
 const ws=residents.filter(r=>r.activeJob==='process').sort((a,b)=>(a.job==='process'?0:1)-(b.job==='process'?0:1)||(b.stats?.dex??2)-(a.stats?.dex??2)||a.id-b.id);
 const left=[];for(const r of ws){const p=posts.find(p=>p.workers.length<p.plan.staff);if(p)p.workers.push(r);else left.push(r);}return {posts,left};}
function renderFacilityPlans(force=false){
 const host=el('recipeSettings');if(!host)return;const bs=prodBuildings();const sig=bs.map(b=>b.id).join(',');
 if(force||host.dataset.sig!==sig){host.dataset.sig=sig;host.replaceChildren();const seen={};
  const fmt=o=>Object.entries(o).map(([k,v])=>`${ITEMS[k]?.icon??''}${v}`).join('+');
  for(const b of bs){const f=FACILITY_DEFS[b.kind];seen[b.kind]=(seen[b.kind]??0)+1;const pl=planOf(b);
   const row=document.createElement('div');row.className='plan-row';row.dataset.bid=b.id;
   const head=document.createElement('div');head.className='plan-head';head.textContent=`${f.icon} ${f.short} #${seen[b.kind]}`;
   const sel=document.createElement('select');sel.setAttribute('aria-label',`${f.name}#${seen[b.kind]}で作る物`);
   sel.append(new Option('おまかせ（作れる物を自動で）','auto'));for(const id of recipesFor(b.kind)){const r=CAT_RECIPES[id];sel.append(new Option(`${r.name} ${fmt(r.in)}→${fmt(r.out)}${r.power?' ⚡':''}${r.fee?` ${r.fee}G`:''}`,id));}
   sel.value=pl.recipe;sel.addEventListener('change',()=>setPlan(b,{recipe:sel.value}));
   const st=document.createElement('div');st.className='plan-staff';const minus=document.createElement('button');minus.type='button';minus.textContent='−';const num=document.createElement('b');const plus=document.createElement('button');plus.type='button';plus.textContent='＋';
   minus.addEventListener('click',()=>setPlan(b,{staff:Math.max(0,planOf(b).staff-1)}));plus.addEventListener('click',()=>setPlan(b,{staff:Math.min(staffCap(b),planOf(b).staff+1)}));
   st.append('👷',minus,num,plus);const who=document.createElement('small');who.className='plan-who';
   row.append(head,sel,st,who);host.append(row);}
  if(!bs.length){const p=document.createElement('small');p.textContent='生産施設（♻️選別台・🍄キノコ栽培・🍳調理場など）を建てて通路につなぐと、ここで施設ごとに作る物と人数を決められます。';host.append(p);}}
 const sf=staffing(game.residents);
 for(const row of host.querySelectorAll('.plan-row')){const b=bs.find(x=>String(x.id)===row.dataset.bid);if(!b)continue;const pl=planOf(b);const post=sf.posts.find(p=>p.b.id===b.id);
  row.querySelector('.plan-staff b').textContent=`${pl.staff}/${staffCap(b)}`;
  const want=game.residents.filter(r=>r.job==='process'||r.job==='autoin').length;
  row.querySelector('.plan-who').textContent=post?.workers.length?`配属：${post.workers.map(r=>r.name).join('・')}`:pl.staff?'配属：今夜の勤務開始時に「素材加工」「お任せ（内部作業）」の住民から自動で配属':'停止中（人数0）';}
 const sum=internalSlots();el('planSummary').textContent=`内部ポスト：加工${sum.process}人・研究${sum.research}人／内部作業の住民 ${game.residents.filter(r=>['process','research','autoin'].includes(r.job)).length}人`;
}
function procurementNeeds(){
 const inv=colony.inventory,n=game.residents.length,target={food:n*3,care:Math.max(2,Math.ceil(n/2)+connectedKind('wash')*2),luxury:2};
 const act=researchState(colony).active;if(!act&&selectedTech&&techStatus(colony,selectedTech)==='available')target.samples=techById(selectedTech).samples;
 for(const b of prodBuildings()){const pl=planOf(b);if(pl.recipe!=='auto'&&pl.staff)for(const [k,v] of Object.entries(CAT_RECIPES[pl.recipe].in))target[k]=(target[k]??0)+v*pl.staff*2;}
 if(connectedKind('generator'))target.fuel=(target.fuel??0)+connectedKind('generator')*2;
 const producible=k=>Object.values(CAT_RECIPES).some(r=>r.out[k]&&connectedKind(r.facility)>0);const out=[];
 for(const [k,it] of Object.entries(ITEMS)){if(!it.buy)continue;const tg=target[k]??0,have=inv[k]??0,prod=producible(k),pack=k==='food'?currentMods().foodPack:it.buy[0];
  const packs=prod?0:Math.ceil(Math.max(0,tg-have)/pack);out.push({k,it,tg,have,prod,pack,packs,price:Math.ceil(it.buy[1]*currentMods().supplyMul)});}
 return out;}
let procureOpenedDay=0;
function openProcure(auto=false){const d=el('procureDialog');if(d.open)return;const needs=procurementNeeds(),sl=colony.shoppingList??{};
 if(auto&&!needs.some(x=>x.packs))return;procureOpenedDay=game.day;
 el('procureIntro').textContent=`${auto?`第${game.day}日の夕方です。`:''}在庫を確認しました。今夜の買い出し量を決めてください（1人3パックまで運べます。🏭は施設で作れるので不要）。`;
 const rows=el('procureRows');rows.replaceChildren();
 const sorted=needs.slice().sort((a,b)=>(b.packs-a.packs)||((b.tg||0)-(a.tg||0)));
 let hidden=0;for(const x of sorted){const r=document.createElement('label');r.className='procure-row'+(x.packs?' need':'');if(!x.tg&&!x.have&&!x.packs&&!sl[x.k]){r.classList.add('extra');r.hidden=true;hidden++;}
  const init=sl[x.k]??x.packs;r.innerHTML=`<span class="pi">${x.it.icon}</span><span class="pn">${x.it.name}<small>在庫${x.have}${x.tg?`／目安${x.tg}`:''}${x.prod?' 🏭施設で生産可':''}${x.packs?` ⚠${x.packs}パック不足`:''}</small></span><span class="pq">1パック${x.pack}個・${x.price}G</span>`;
  const inp=document.createElement('input');inp.type='number';inp.min=0;inp.max=9;inp.value=init;inp.dataset.k=x.k;inp.dataset.price=x.price;inp.addEventListener('input',procureTotal);r.append(inp);rows.append(r);}
 if(hidden){const more=document.createElement('button');more.type='button';more.className='mini-btn';more.textContent=`＋ その他の物資（${hidden}）`;more.addEventListener('click',()=>{for(const x of rows.querySelectorAll('.extra'))x.hidden=false;more.remove();});rows.append(more);}
 procureTotal();paused=true;syncClockButtons?.();d.showModal();}
function procureTotal(){let g=0,p=0;for(const i of el('procureRows').querySelectorAll('input')){const n=Math.max(0,Math.min(9,parseInt(i.value)||0));g+=n*+i.dataset.price;p+=n;}
 el('procureTotal').textContent=`合計 ${p}パック・${g}G（所持 ${game.money}G）／必要な担当 ${Math.ceil(p/3)}人：🛒買い出し担当か「お任せ（バイト）」の住民が行きます`+(g>game.money?' ⚠資金不足分は買えません':'');}
el('openProcure').addEventListener('click',()=>openProcure(false));
el('procureCancel').addEventListener('click',()=>{el('procureDialog').close();paused=false;syncClockButtons?.();});
el('procureGo').addEventListener('click',()=>{const list={};for(const i of el('procureRows').querySelectorAll('input')){const n=Math.max(0,Math.min(9,parseInt(i.value)||0));if(n)list[i.dataset.k]=n;}
 colony={...colony,shoppingList:list};saveNow();el('procureDialog').close();paused=false;syncClockButtons?.();updateColonyPanel(Object.keys(list).length?'🛒 買い出しを任せました。今夜、担当が地上で購入します。':'今夜は買い出しなし。');});
function autoProcure(){const list={};for(const x of procurementNeeds())if(x.packs)list[x.k]=Math.min(9,x.packs);colony={...colony,shoppingList:list};}
function updateColonyPanel(note=''){
 const box=el('colonyStatus');if(!box)return;
 const needs=game.residents.map(r=>`${r.name} ${r.impulse??0}${(r.impulse??0)>=60?' ⚠':''}`).join(' / ');
 const researchDone=colony.completedResearch.includes('impulse');
 box.textContent=`人口 ${game.residents.length}体 / 喪失 ${colony.lossCount??0}体 / 新たな眷属 ${colony.conversionCount??0}体。発展段階 ${colony.stage} / 在庫：食料${colony.inventory.food}・生活${colony.inventory.care}・嗜好${colony.inventory.luxury}・研究資材${colony.inventory.samples}。衝動：${needs}。${colony.report?.incidentNames.length?'⚠ 対人トラブル：'+colony.report.incidentNames.join('・')+'。':''} ${colony.report?.deathNames?.length?'⚰ 犠牲：'+colony.report.deathNames.join('・')+'。':''} ${colony.report?.newFollowerName?'🤝 '+colony.report.newFollowerName+'が加入。':''} ${note}`;
 const inv=colony.inventory;el('productionStatus').textContent=`♻ 生産チェーン：回収物${inv.salvage??0}・有機残渣${inv.residue??0}・実験廃材${inv.labwaste??0}・研究試料${inv.samples}｜選別台${connectedKind('sorting')}・抽出装置${connectedKind('extractor')}・洗浄台${connectedKind('wash')}（接続済）`+(productionLog.length?`｜前夜：${productionLog.map(l=>l.ok?`${l.worker}が${l.name}`:`${l.worker}:${l.reason}`).join('、')}`:'')+(lastColonistReport?.washed?.length?`｜洗浄：${lastColonistReport.washed.join('・')}`:'');
 renderStockAndRecipes();
 updateResearchPanel();
}
el('rotateBuild').addEventListener('click',e=>{e.stopPropagation();rotateCandidate();});
el('researchStart').addEventListener('click',()=>{
 if(!selectedTech)return;
 const r=startTech(colony,game.money,selectedTech,connectedLabs()>0);
 if(r.ok){colony=r.colony;game={...game,money:r.money};moneyChange(-r.cost,'研究',techById(selectedTech).name+'の研究開始');}
 updateEconomy();updateColonyPanel(r.ok?`${techById(selectedTech).name}の研究を開始。住民の仕事を「地下研究」に指定してください。`:r.reason);updateResearchPanel(r.ok?'':r.reason);saveNow();
});

// Save/load and scene presentation are intentionally outside the headless simulation.
function snapshot(){return serializeSession({game,colony,social,world:worlds.underground,resale,rented,owned,surfaceEconomy,endingUnlocked,ledger,marketDesk});}
function saveStatus(message){el('saveStatus').textContent=message;}
async function saveNow(){if(savePending||resetting)return;savePending=true;try{await saveSnapshot(snapshot());saveStatus(`保存済み：第${game.day}日`);}catch(e){saveStatus(`保存できません：${e.message}`);}finally{savePending=false;}}
function restoreData(data){const d=validateSession(data);game=d.game;ensureAllColonists();colony=d.colony;social=d.social;worlds.underground=hydrateWorld(d.world);migrateInitialLayout(worlds.underground);
 if(!worlds.underground.zones.some(z=>z.id==='eastward')){const fresh=makeWorlds().underground;for(const z of fresh.zones.filter(z=>['eastward','deepward'].includes(z.id))){worlds.underground.zones.push(z);for(let x=z.x;x<z.x+z.w;x++)for(let y=z.y;y<z.y+z.h;y++)worlds.underground.closed.add(`${x},${y}`);}}resale=d.resale;marketDesk=F.migrateFlea(d.marketDesk);rented=d.rented;owned=d.owned??[];surfaceEconomy=d.surfaceEconomy??initialSurfaceEconomy();endingUnlocked=!!d.endingUnlocked;if(endingUnlocked&&!colony.completedResearch.includes('humanization'))colony={...colony,completedResearch:[...colony.completedResearch,'humanization']};ledger=d.ledger?validateLedger(d.ledger):createLedger(game.money,game.day);economyDay=game.day;lastRentDue=0;simAccumulator=0;lastTime=null;eventQueue=[];activeEvent=null;el('eventDialog').close?.();refreshConnectivity();updateEconomy();updateResalePanel();layerButton();updateEndingPanel();}
el('saveButton').addEventListener('click',saveNow);
el('exportButton').addEventListener('click',()=>{try{const data=snapshot();const blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`zombie-colony-day${game.day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);saveStatus('JSONバックアップを出力しました');}catch(e){saveStatus(e.message);}});
el('importButton').addEventListener('click',()=>el('importFile').click());
el('importFile').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>2_000_000)throw Error('2MB以下のファイルを指定してください');const data=validateSession(await file.text());restoreData(data);await saveNow();saveStatus('バックアップを復元しました');}catch(err){saveStatus('復元失敗：'+err.message);}});
// v2.6: confirm() is blocked inside sandboxed frames, so use a two-tap confirmation instead.
async function restartGame(){resetting=true;try{await clearSnapshots();}catch{}location.reload();}
let resetting=false,resetArm=0;
el('newGameButton').addEventListener('click',()=>{const b=el('newGameButton');if(Date.now()-resetArm>4000){resetArm=Date.now();b.textContent='⚠ もう一度押すと全データを消して最初から';b.classList.add('danger');setTimeout(()=>{if(Date.now()-resetArm>=4000){b.textContent='最初から';b.classList.remove('danger');}},4100);return;}restartGame();});
const eventCanvas=el('eventCanvas'),eventCtx=eventCanvas.getContext('2d');
function showNextEvent(){if(activeEvent||!eventQueue.length)return;activeEvent=eventQueue.shift();sfx(EVENT_SFX[activeEvent.kind]);const def=sceneDefinition(activeEvent.kind);el('eventTitle').textContent=def.title;el('eventNarrative').textContent=activeEvent.message||def.desc;el('eventReason').textContent='原因：'+(activeEvent.reason||def.desc);el('eventDay').textContent=`第${activeEvent.day??game.day}日`;el('eventCount').textContent=`残り ${eventQueue.length}件`;el('eventDialog').showModal();eventFrame=requestAnimationFrame(paintActiveEvent);}
function paintActiveEvent(t){if(!activeEvent)return;activeEvent.t0??=t;paintEvent(eventCtx,activeEvent.kind,t-activeEvent.t0,eventCanvas.width,eventCanvas.height);eventFrame=requestAnimationFrame(paintActiveEvent);}
function closeEvent(){if(eventFrame!==null)cancelAnimationFrame(eventFrame);eventFrame=null;activeEvent=null;el('eventDialog').close();showNextEvent();}
el('eventNext').addEventListener('click',closeEvent);
el('eventDemoButton').addEventListener('click',()=>queueScenes(['friendship','warning','police','incident','conversion','loss','research','flea_claim','flea_good','flea_jackpot','flea_buzz','flea_fake','levelup','district','wifi_caught'].map((kind,i)=>({id:'demo-'+i,kind,day:game.day,message:sceneDefinition(kind).desc,reason:'演出確認用デモ（実際のゲーム状態は変化しません）'}))));
el('eventDialog').addEventListener('cancel',e=>{e.preventDefault();closeEvent();});
function queueScenes(events){for(const e of events){if(!['friendship','warning','police','conversion','loss','incident','research','ending','flea_claim','flea_good','flea_jackpot','flea_buzz','flea_crash','flea_fake','flea_mismatch','levelup','district','wifi_caught'].includes(e.kind))continue;eventQueue.push(e);}if(eventQueue.length>20)eventQueue=eventQueue.slice(-20);showNextEvent();}
function updateEndingPanel(){if(colony.completedResearch.includes('humanization'))endingUnlocked=true;el('endingActions').hidden=!endingUnlocked;el('endingHint').textContent=endingUnlocked?'人間化技術が完成。住民たちの未来を選んでください。':'「人間化技術」を完成させると未来を選べます。';}


for(const b of document.querySelectorAll('[data-ending]'))b.addEventListener('click',()=>{const name={'human':'人間復帰','colony':'地下楽園','coexist':'共存'}[b.dataset.ending];queueScenes([{id:'final-'+b.dataset.ending,kind:'ending',day:game.day,message:`${name}エンド：住民たちは自分たちの未来を選んだ。引き続き自由に街を運営できます。`,reason:'人間化研究を完了し、進路を選択した'}]);el('endingResult').textContent=`到達：${name}エンド（継続プレイ可能）`;saveNow();});
el('pauseButton').addEventListener('click',()=>{paused=!paused;el('pauseButton').textContent=paused?'▶ 再開':'Ⅱ 一時停止';if(el('clockPause'))syncClockButtons();});
function syncClockButtons(){
  el('speedButton').textContent=`${speed}× 速度`;
  el('clockSpeed').textContent=speed>1?`▶▶ ${speed}×`:'▶▶';
  el('clockPause').classList.toggle('on',paused);el('clockPlay').classList.toggle('on',!paused&&speed===1);el('clockSpeed').classList.toggle('on',!paused&&speed>1);
}
function toggleSpeed(){speed=nextSpeed(speed);syncClockButtons();}
el('speedButton').addEventListener('click',toggleSpeed);
el('clockSpeed').addEventListener('click',()=>{if(paused)el('pauseButton').click();speed=nextSpeed(speed);syncClockButtons();});
el('clockPlay').addEventListener('click',()=>{if(paused)el('pauseButton').click();speed=1;syncClockButtons();});
el('clockPause').addEventListener('click',()=>{if(!paused)el('pauseButton').click();syncClockButtons();});
el('clockNext').addEventListener('click',()=>{
  if(activeEvent)return;
  const count=ticksUntilNextDay(game.tick);
  for(let i=0;i<count;i++)advanceOneTick();
  simAccumulator=0;lastTime=null;updateEconomy();
  // If a day-end event is queued, show its visual scene before further input.
});
syncClockButtons();
updateEconomy();
function advanceOneTick(){
const beforeTickMoney=game.money;worlds.underground.homeBonus=currentMods().homeBonus;game=stepGame({...game,mods:currentMods(),internalSlots:internalSlots(),shoppingPacks:Object.values(colony.shoppingList??{}).reduce((a,b)=>a+b,0)});
      {const ck=game.tick%120;if(ck===0)sfx('dawn');if(ck===60)sfx('dusk');setMusic(colony.gameOver?null:(game.alert>=70||(colony.starveDays??0)>=3)?'danger':ck>=60?'night':'day');if(ck>=60)worlds.underground.workPlaces=Object.fromEntries(staffing(game.residents).posts.flatMap(p=>p.workers.map(r=>[r.name,p.b.id])));
       if(ck===50&&!Object.keys(colony.shoppingList??{}).length){if(colony.completedResearch.includes('autoprocure')){autoProcure();updateColonyPanel('🤖 自動調達：不足物資を買い出しリストに入れました。');}else if(procureOpenedDay!==game.day)openProcure(true);}}
      if(game.day!==economyDay){
        const completedDay=game.day-1;moneyChange(game.money-beforeTickMoney,'アルバイト','外部勤務の報酬',completedDay);const beforeEventsMoney=game.money;
        let refusedNote=[];const caps=ST.capacities(worlds.underground);
        {const t=ST.intake(colony.inventory,'food',game.lastReport.harvest,caps);colony={...colony,inventory:t.inventory};if(t.refused)refusedNote.push(`食料${t.refused}個（食料庫が満杯）`);}
        // v2.0: salvage → production chain, then colonist growth & body maintenance
        {const list={...(colony.shoppingList??{})};let packs=(game.lastReport.shoppers??0)*3;const got=[];
         for(const [key,n0] of Object.entries(list)){let n=n0;while(n>0&&packs>0){const it=ITEMS[key];const qty=key==='food'?currentMods().foodPack:it.buy[0];const price=Math.ceil(it.buy[1]*currentMods().supplyMul);
           if(game.money<price){refusedNote.push(`${it.name}（資金不足）`);packs=0;break;}const t=ST.intake(colony.inventory,key,qty,caps);if(!t.accepted){refusedNote.push(`${it.name}（置き場が満杯）`);break;}
           colony={...colony,inventory:t.inventory};game={...game,money:game.money-price};moneyChange(-price,'生活物資仕入れ',`買い出し：${it.name}`,completedDay);got.push(`${it.icon}${t.accepted}`);n--;packs--;}
          if(n>0)list[key]=n;else delete list[key];}
         colony={...colony,shoppingList:list};if(got.length)shoppingNote=`🛒買い出し：${got.join(' ')}`;else shoppingNote='';}
        if(game.lastReport.salvage){const t=ST.intake(colony.inventory,'salvage',game.lastReport.salvage,caps);colony={...colony,inventory:t.inventory};if(t.refused)refusedNote.push(`回収物${t.refused}個（資材置き場が満杯）`);}
        {const facs=Object.fromEntries(Object.keys(FACILITY_DEFS).map(k=>[k,connectedKind(k)]));const ex=r=>C.hasTrait(r,'dexterous')&&((r.id*7+completedDay*3)%10)<3;const sf=staffing(game.residents);const workers=[...sf.posts.flatMap(p=>p.workers.map(r=>({name:r.name,extra:ex(r),facility:p.b.kind,recipe:p.plan.recipe,building:p.b.id}))),...sf.left.map(r=>({name:r.name,extra:ex(r)}))];
         if(workers.length||facs.automation){const pr=runProduction(colony.inventory,game.money,workers,facs,{prefs:colony.recipePrefs??{},caps:ST.capacities(worlds.underground),goodsTotal:ST.goodsTotal,mods:currentMods()});colony={...colony,inventory:{...colony.inventory,...pr.inventory}};game={...game,money:pr.money};if(pr.fees)moneyChange(-pr.fees,'研究','素材加工の処理費',completedDay);productionLog=pr.log;}else productionLog=[];}
        {const cd=C.dailyColonists(game.residents,{washSlots:connectedKind('wash')*2,care:colony.inventory.care??0,decayRelief:(currentMods().impulseRelief?0.3:0)+currentMods().decayRelief});
         game={...game,residents:cd.residents,alert:Math.min(100,game.alert+cd.alertAdd)};colony={...colony,inventory:{...colony.inventory,care:(colony.inventory.care??0)-cd.careUsed}};lastColonistReport=cd;{const users={},w=worlds.underground;const need=game.residents.filter(r=>(r.decay??0)>=15).sort((a,b)=>(b.decay??0)-(a.decay??0));for(const [k,per] of [['wash',2],['repair',2],['cooler',4]])for(const b of w.buildings.filter(b=>b.kind===k&&w.connectivity?.[b.id]))for(let i=0;i<per*(b.level??1);i++){const r=need.shift();if(r)users[r.name]=b.id;}w.facilityUsers=users;}
         {const counts=Object.fromEntries(['lounge','theater','cooler','repair','security'].map(k=>[k,connectedKind(k)]));const fx=dailyFacilityEffects(game.residents,colony.inventory,counts,{outsideWorkers:game.residents.filter(r=>C.OUTSIDE.has(r.activeJob)).length,stage:colony.stage});
          game={...game,residents:fx.residents,alert:Math.max(0,Math.min(100,game.alert+fx.alertDelta))};colony={...colony,inventory:fx.inventory};facilityNotes=fx.notes;}
         if(cd.levelUps.length)queueScenes(cd.levelUps.map((u,i)=>({id:`lv-${completedDay}-${i}`,kind:'levelup',day:completedDay,message:`${u.name}がLv${u.level}に上がった！ スキルポイント+1`,reason:'夜勤・研究・加工の経験を積んだ'})));}
        const labActive=worlds.underground.buildings.some(b=>b.kind==='lab'&&worlds.underground.connectivity?.[b.id]);
        const housing=worlds.underground.buildings.filter(b=>b.kind==='home'&&worlds.underground.connectivity?.[b.id]).length;
        const capacity=colonyCapacity();
        const prevHistoryIds=new Set(social.history.map(e=>e.id)), hadResearch=colony.completedResearch.includes('impulse');
        const researchers=Math.round(game.residents.filter(r=>r.activeJob==='research').reduce((n,r)=>n+C.researchPower(r),0)*100)/100,labCount=connectedLabs();const ar=advanceResearch(colony,researchers>0?researchers+connectedKind('archives'):0,labCount);colony=ar.colony;if(ar.completed){const t=techById(ar.completed);if(ar.completed==='humanization')endingUnlocked=true;queueScenes([{id:'tech-'+ar.completed+'-'+completedDay,kind:'research',day:completedDay,message:`${t.name}が完成！ ${t.desc}`,reason:`研究担当${researchers}体・研究室${labCount}棟で研究を続けた成果`}]);}
        const daily=advanceColony(game,colony,labActive,capacity,currentMods());game=daily.game;colony=daily.colony;
        social=recordDeaths(social,game.day,daily.colony.report.deathNames);
        const relation=advanceSocial(social,game,colony,capacity);social=relation.social;game=relation.game;
        if(relation.conversion){colony={...colony,conversionCount:colony.conversionCount+1,nextResidentId:relation.conversion.id+1,inventory:{...colony.inventory,food:colony.inventory.food-2},report:{...colony.report,newFollowerName:relation.conversion.name}};game={...game,events:[...game.events,`${relation.conversion.name}が${relation.conversion.by}の眷属になった`].slice(-12)};}
        game={...game,food:colony.inventory.food};
        const todaysScenes=eventsForDay(0,social,colony,game).filter(e=>(e.kind==='incident'||e.kind==='research'||!prevHistoryIds.has(e.id))&&(e.kind!=='research'||!hadResearch));queueScenes(todaysScenes);updateEndingPanel();
        moneyChange(game.money-beforeEventsMoney,'事件・補償','対人事件・住民イベント',completedDay);const surfaceResult=advanceSurfaceEconomy(surfaceEconomy,game,owned,rented,completedDay);surfaceEconomy=surfaceResult.surface;
        {const prevHumans=surfaceResult.surface.humans,before=surfaceEconomy;const ownedHousing=RENTALS.filter(p=>(owned.includes(p.id)||rented.includes(p.id))&&PROPERTY_ROLES[p.id]?.capacity).reduce((n,p)=>n+PROPERTY_ROLES[p.id].capacity,0);
         const ct=CITY.advanceCity({...surfaceEconomy,humans:(before.humansPrev??prevHumans)},game.alert,completedDay,{ownedHousing,businesses:owned.length+rented.length});
         surfaceEconomy={...ct.surface,humansPrev:ct.surface.humans};game={...game,money:game.money+ct.money,alert:Math.min(100,game.alert+ct.alertAdd)};
         if(ct.money)moneyChange(ct.money,ct.money>0?'地上事業売上':'地上施設維持費','空き地の設備・賃料',completedDay);
         if(ct.food){const t=ST.intake(colony.inventory,'food',ct.food,ST.capacities(worlds.underground));colony={...colony,inventory:t.inventory};}
         colony={...colony,stockHist:[...(colony.stockHist??[]),{day:completedDay,food:colony.inventory.food,goods:ST.goodsTotal(colony.inventory)}].slice(-14)};
         if(refusedNote.length)updateColonyPanel('⚠ 置き場不足で受け取れず：'+refusedNote.join('・'));
         queueScenes(ct.events.map((e,i)=>({id:`city-${completedDay}-${i}`,kind:e.kind==='district'?'district':'wifi_caught',day:completedDay,message:e.message,reason:e.reason})));}
        const surfaceBonus=Math.round(surfaceResult.income*(currentMods().surfaceMul-1));if(surfaceBonus){game={...game,money:game.money+surfaceBonus};moneyChange(surfaceBonus,'地上事業売上','口コミ研究ボーナス',completedDay);}
        game={...game,money:game.money+surfaceResult.net,alert:Math.max(0,game.alert-(surfaceResult.trust>=70?1:0))};moneyChange(surfaceResult.income,'地上事業売上',`来客${surfaceResult.visitors}人・人間${surfaceResult.humans}人`,completedDay);moneyChange(-surfaceResult.expenses,'地上施設維持費','運営・人件費',completedDay);
        const bill=propertyBill(rented,owned,game.money);const paid=bill.due;game={...game,money:game.money-paid,alert:Math.min(100,game.alert+(paid<bill.due?3:0))};moneyChange(-paid,'賃料','地上物件の家賃'+(paid<bill.due?'・未払い発生':'') ,completedDay);economyDay=game.day;lastRentDue=paid;const refundDebtPayment=Math.min(game.money,marketDesk.refundDebt??0);
        if(refundDebtPayment>0){game={...game,money:game.money-refundDebtPayment};marketDesk={...marketDesk,refundDebt:(marketDesk.refundDebt??0)-refundDebtPayment};moneyChange(-refundDebtPayment,'フリマ返品','前回の未払返金',completedDay);}
        const marketDay=F.advanceFlea(marketDesk,game.day,surfaceEconomy.trust,CITY.lotEffects(CITY.ensureCity(surfaceEconomy).city));marketDesk=marketDay.market;
        {const after=game.money+marketDay.money;if(after<0)marketDesk={...marketDesk,refundDebt:(marketDesk.refundDebt??0)-after};game={...game,money:Math.max(0,after)};}
        for(const sale of marketDay.sales){moneyChange(sale.price,'フリマ売上',sale.name+'・購入成立',completedDay);moneyChange(-sale.fee,'フリマ販売手数料',sale.name,completedDay);moneyChange(-sale.ship,'フリマ梱包',sale.name+'の送料',completedDay);const rebate=Math.floor(sale.price*currentMods().fleaRebate);if(rebate){game={...game,money:game.money+rebate};moneyChange(rebate,'フリマ売上','目利き術の還元',completedDay);}}
        for(const rf of marketDay.refunds)if(rf.amount)moneyChange(-rf.amount,'フリマ返品',rf.name+'・クレーム返金',completedDay);
        const trendNews=marketDay.events.filter(e=>(e.kind==='flea_buzz'||e.kind==='flea_crash')&&!e.held).map(e=>e.message);
        queueScenes(marketDay.events.filter(e=>!((e.kind==='flea_buzz'||e.kind==='flea_crash')&&!e.held)).map((e,i)=>({id:`flea-${completedDay}-${i}`,kind:e.kind,day:completedDay,message:e.message,reason:e.kind==='flea_buzz'||e.kind==='flea_crash'?`手元の該当在庫：${e.held}点`:'フリマ取引の結果'})));
        const parts=[];if(marketDay.sales.length)parts.push(`${marketDay.sales.length}件売れた`);if(marketDay.arrivals.length)parts.push(`荷物${marketDay.arrivals.length}件到着`);if(marketDay.offers.length)parts.push(`値下げ交渉${marketDay.offers.length}件`);if(marketDay.claims.length)parts.push(`クレーム${marketDay.claims.length}件`);parts.push(...trendNews);if(parts.length)marketMessage('📱 '+parts.join('・'));
        checkFamineAndDefeat();
        updateResalePanel();updateColonyPanel();saveNow();}
}

function render(t){
  const elapsed=lastTime===null?0:Math.min(.25,(t-lastTime)/1000);lastTime=t;
  if(!paused&&!activeEvent){simAccumulator+=elapsed*speed;let updated=false;
    while(simAccumulator>=1){
      advanceOneTick();simAccumulator-=1;updated=true;
      if(activeEvent)break;
    }
    if(updated)updateEconomy();
  }
  if(bounds.width&&bounds.height){positionRotateButton();ctx.setTransform(dpr,0,0,dpr,0,0);{const cty=CITY.ensureCity(surfaceEconomy).city;worlds.surface.lotDefs=CITY.LOTS;worlds.surface.lotState=cty.lots;worlds.surface.lotOpen=(x,y)=>{const l=lotAt(x,y);return !!l&&CITY.lotOpen(cty,l);};}try{drawScene(ctx,worlds[state.layer],state.view,state.selected[state.layer],(t-state.started)/1000,bounds,game,placement);}catch(err){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=1;ctx.fillStyle='rgba(120,30,30,.85)';ctx.fillRect(8,bounds.height-58,bounds.width-16,50);ctx.fillStyle='#fff';ctx.font='12px system-ui';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText('描画エラー：'+String(err?.message??err).slice(0,60),16,bounds.height-52);ctx.fillText('この画面のスクショを送ってください',16,bounds.height-34);if(!window.__drawErr){window.__drawErr=err;console.error(err);}}}
  raf=requestAnimationFrame(render);
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){cancelAnimationFrame(raf);raf=0;lastTime=null;simAccumulator=0;}
  else if(!raf){lastTime=null;raf=requestAnimationFrame(render);}
});
layerButton();updateResalePanel();updateRentalPanel();updateColonyPanel();updateEndingPanel();loadSnapshot().then(data=>{if(data){restoreData(data);saveStatus('前回の続きから再開しました');}else saveStatus('新しいゲームです。自動保存は毎朝行います。');}).catch(err=>saveStatus('保存領域を使用できません：'+err.message));
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
raf=requestAnimationFrame(render);

// Map-centric sheets: the panel stays within the viewport instead of pushing the map down.
let currentPanel=null;
// iOS Safari's visible area changes when its browser bars expand or retract.
function updateScreenHeight(){ const h=window.visualViewport?.height||window.innerHeight; if(h>0)document.documentElement.style.setProperty('--game-screen-height',Math.round(h)+'px'); }
updateScreenHeight();
window.addEventListener('resize',updateScreenHeight,{passive:true});
window.visualViewport?.addEventListener('resize',updateScreenHeight,{passive:true});
// Keep tile details inside the map so the fixed screen has no extra vertical row.
viewport.appendChild(el('selectionPanel'));
const sheet=document.createElement('div');sheet.id='mapSheet';sheet.className='map-sheet';sheet.hidden=true;
const sheetHeader=document.createElement('div');sheetHeader.className='sheet-header';sheetHeader.innerHTML='<strong id="sheetTitle">メニュー</strong><button type="button" id="sheetClose" aria-label="パネルを閉じる">×</button>';
const sheetBody=document.createElement('div');sheetBody.className='sheet-body';sheet.append(sheetHeader,sheetBody);viewport.append(sheet);
const titles={city:'街の発展',supply:'物資・生産',jobs:'仕事と住民',build:'地下建設',research:'研究ツリー',market:'フリマ経営',social:'人間関係',settings:'設定・セーブ'};
for(const section of [...document.querySelectorAll('.game-panel > [data-screen]')])sheetBody.append(section);
function showPanel(id){
 const oldSheetHeight=sheet.hidden?0:sheet.getBoundingClientRect().height;
 if(id===currentPanel&&id!==null)id=null;
 currentPanel=id;if(id===null&&tool!=='inspect')setTool('inspect');sheet.hidden=id===null;sheet.dataset.panel=id??'none';sheet.querySelector('#sheetTitle').textContent=titles[id]??'メニュー';
 for(const section of sheetBody.querySelectorAll('[data-screen]'))section.hidden=id===null||section.dataset.screen!==id;
 sheetBody.scrollTop=0;
 el('selectionPanel').hidden=id!==null;
 for(const b of document.querySelectorAll('[data-nav]'))b.classList.toggle('active',b.dataset.nav===id||(b.dataset.nav==='more'&&['social','settings'].includes(id)));
 if(id==='property'&&state.layer!=='surface')switchLayer('surface');
 if(id==='build'&&state.layer!=='underground')switchLayer('underground');
 if(id===null&&tool!=='inspect')setTool('inspect');
 const newSheetHeight=sheet.hidden?0:sheet.getBoundingClientRect().height;
 // Shift the map to the uncovered area instead of leaving important tiles beneath the sheet.
 const delta=(oldSheetHeight-newSheetHeight)/2;
 state.view={...state.view,cy:state.view.cy+delta};
 state.view=boundCamera(state.view,bounds.width,bounds.height);
}
el('sheetClose').addEventListener('click',()=>showPanel(null));
for(const b of document.querySelectorAll('[data-nav]'))b.addEventListener('click',()=>{
 if(b.dataset.nav==='more'){el('moreDialog').showModal();return;}showPanel(b.dataset.nav);
});
for(const b of document.querySelectorAll('[data-more]'))b.addEventListener('click',()=>{el('moreDialog').close();showPanel(b.dataset.more);});
el('moreClose').addEventListener('click',()=>el('moreDialog').close());
const statTitles={populationValue:'住民',moneyValue:'資金',foodValue:'食料',moodValue:'満足度',alertValue:'警戒度'};
let selectedStat='moneyValue';
function sbRow(host,label,value,max,color,text,onClick,mark){const row=document.createElement('div');row.className='sb-row'+(onClick?' click':'');const l=document.createElement('span');l.textContent=label;const bar=document.createElement('div');bar.className='bar';const i=document.createElement('i');i.style.width=`${Math.max(0,Math.min(100,value/Math.max(1,max)*100))}%`;i.style.background=color;bar.append(i);
 if(mark!=null){const m=document.createElement('b');m.style.left=`${Math.min(100,mark/Math.max(1,max)*100)}%`;bar.append(m);}const v=document.createElement('span');v.textContent=text??`${value}/${max}`;row.append(l,bar,v);if(onClick)row.addEventListener('click',onClick);host.append(row);}
function sbHead(host,t){const h=document.createElement('div');h.className='sb-head';h.textContent=t;host.append(h);}
const lvl=(v,warn=60,bad=80)=>v>=bad?'#e0705a':v>=warn?'#e0c04a':'#74c8b6';
function renderStatBars(){
 const host=el('statsBars');host.replaceChildren();const inv=colony.inventory,caps=ST.capacities(worlds.underground),n=game.residents.length;
 const open=id=>()=>{el('statsDialog').close();openColonist(id);};
 if(selectedStat==='foodValue'){
  sbHead(host,`🍞 食料庫（${caps.pantries}棟）`);sbRow(host,'食料',inv.food,caps.food,inv.food<n*2?'#e0705a':'#f2c24a',`${inv.food}/${caps.food}`,null,n*3);
  sbRow(host,'残り日数',Math.min(14,n?Math.floor(inv.food/n):0),14,'#f2d37a',`${n?Math.floor(inv.food/n):0}日`);
  sbHead(host,`▦ 資材置き場（${caps.storages}棟）　合計 ${ST.goodsTotal(inv)}/${caps.goods}`);
  const cols={care:'#8fd0ea',luxury:'#f27a8c',samples:'#b2a6f2',salvage:'#c99a62',residue:'#9ad07a',labwaste:'#d8b0e0'};
  for(const [k,name] of Object.entries(ST.GOODS))sbRow(host,name,inv[k]??0,caps.goods,cols[k],`${inv[k]??0}`);
  sbHead(host,'直近の在庫推移（黄：食料　青：資材）');const cv=document.createElement('canvas');cv.id='stockChart';cv.width=320;cv.height=90;host.append(cv);
  const g=cv.getContext('2d'),hs=colony.stockHist??[];if(hs.length){const mx=Math.max(caps.food,caps.goods,...hs.map(x=>Math.max(x.food,x.goods)));const bw=300/Math.max(7,hs.length);
   hs.forEach((x,i)=>{const bx=10+i*bw;g.fillStyle='#f2c24a';const h1=x.food/mx*70;g.fillRect(bx,80-h1,bw*.4,h1);g.fillStyle='#8fd0ea';const h2=x.goods/mx*70;g.fillRect(bx+bw*.45,80-h2,bw*.4,h2);g.fillStyle='#9ab';g.font='9px system-ui';g.fillText(x.day,bx,89);});}
  else{g.fillStyle='#9ab';g.font='11px system-ui';g.fillText('翌朝から記録されます',10,45);}
 }else if(selectedStat==='populationValue'||selectedStat==='moodValue'){
  sbHead(host,'住民（タップでステータス）');
  for(const r of game.residents){const c=C.ensureColonist(r);const key=selectedStat==='moodValue'?'fatigue':'level';
   if(selectedStat==='populationValue')sbRow(host,`${r.name} Lv${c.level}`,c.xp-(C.LEVEL_XP[c.level-1]??0),Math.max(1,(C.LEVEL_XP[c.level]??c.xp)-(C.LEVEL_XP[c.level-1]??0)),'#f2d37a',c.sp?`⬆SP${c.sp}`:`Lv${c.level}`,open(r.id));
   else{sbRow(host,`${r.name} 疲労`,r.fatigue,100,lvl(r.fatigue),String(r.fatigue),open(r.id));sbRow(host,`　衝動`,r.impulse??0,100,lvl(r.impulse??0),String(r.impulse??0),open(r.id));sbRow(host,`　腐敗`,Math.round(c.decay),100,lvl(c.decay,45,65),String(Math.round(c.decay)),open(r.id));}}
  if(selectedStat==='populationValue'){sbHead(host,'住居');sbRow(host,'居住',n,colonyCapacity(),'#74c8b6');}
 }else if(selectedStat==='alertValue'){
  const city=CITY.ensureCity(surfaceEconomy).city;
  sbRow(host,'警戒度',game.alert,100,lvl(game.alert,30,60));sbRow(host,'地域の信頼',surfaceEconomy.trust,100,'#74c8b6');sbRow(host,'街の繁栄',Math.round(city.prosperity),100,'#f2d37a');
  sbHead(host,'臭気（外勤時に警戒へ影響・70で外勤不可）');for(const r of game.residents){const o=C.odorOf(C.ensureColonist(r));sbRow(host,r.name,o,100,lvl(o,35,70),String(o),open(r.id),70);}
 }else if(selectedStat==='moneyValue'){}
}
function refreshStatDetail(){
 const count=game.residents.length,capacity=colonyCapacity();
 const mean=key=>count?Math.round(game.residents.reduce((a,r)=>a+(r[key]??0),0)/count):0;
 const details={
 populationValue:`居住：${count} / ${capacity}体　空き：${Math.max(0,capacity-count)}体\n新しい眷属：${colony.conversionCount??0}体 / 喪失：${colony.lossCount??0}体\n住居の空きと配給余力が眷属化の条件です。`,
 foodValue:`食料庫：${colony.inventory.food}/${ST.capacities(worlds.underground).food}個　1日必要：約${count}個\n配給可能日数：約${count?Math.floor(colony.inventory.food/count):0}日\n前日配給不足：${colony.report?.shortage??0}体\n生活用品：${colony.inventory.care} / 嗜好品：${colony.inventory.luxury} / 研究資材：${colony.inventory.samples}`,
 moodValue:`街の満足度：${el('moodValue').textContent}/100\n平均疲労：${mean('fatigue')} / 平均危険衝動：${mean('impulse')}\nストライキ中：${game.residents.filter(r=>r.strikeDays>0).length}体\n配給・休息・交流が満足度に影響します。`,
 alertValue:`人間 ${surfaceEconomy.humans}人／信頼 ${surfaceEconomy.trust}/100\n現在の警戒度：${game.alert}/100\n状態：${game.alert>=80?'危険':game.alert>=60?'巡回':game.alert>=30?'注意':'平穏'}\n夜間勤務・通報・対人事件で上昇し、自粛によって徐々に下がります。`
 };
 el('statsTitle').textContent=statTitles[selectedStat];renderStatBars();
 const isMoney=selectedStat==='moneyValue';el('financeView').hidden=!isMoney;el('statsDetail').hidden=isMoney;
 if(!isMoney){el('statsDetail').textContent=details[selectedStat];return;}
 const prev=game.day-1,latest=daySummary(ledger,prev),today=daySummary(ledger,game.day);
 el('financeHeadline').textContent=`現在 ${game.money}G / 昨日（第${prev}日） ${prev<ledger.startDay?'履歴なし':`${latest.net>=0?'+':''}${latest.net}G`}`;
 const historyAvailable=prev>=ledger.startDay;
 el('financeYesterday').textContent=historyAvailable?`収入 +${latest.income}G · 支出 −${latest.expense}G · 期末 ${latest.closing}G`:'更新前の日別取引履歴はありません。';
 el('financeToday').textContent=`本日：収入 +${today.income}G / 支出 −${today.expense}G`;
 const list=el('financeTransactions');list.replaceChildren();
 for(const t of [...(historyAvailable?latest.transactions:[])].reverse()){
  const li=document.createElement('li');li.textContent=`${t.category}：${t.amount>0?'+':''}${t.amount}G — ${t.note}`;list.append(li);
 }
 if(!list.childElementCount){const li=document.createElement('li');li.textContent='前日の記録はまだありません';list.append(li);}
 drawFinanceChart(balanceSeries(ledger,game.day,7));
}
function drawFinanceChart(series){
 const canvas=el('financeChart'),ctx=canvas.getContext('2d'),dpr=Math.min(2,window.devicePixelRatio||1),w=310,h=135;
 canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const max=Math.max(1,...series.map(x=>x.closing)),min=Math.min(0,...series.map(x=>x.closing));
 ctx.strokeStyle='#557481';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(20,12);ctx.lineTo(20,110);ctx.lineTo(303,110);ctx.stroke();
 ctx.textAlign='center';ctx.font='11px system-ui';series.forEach((s,i)=>{
  const x=30+(i+.5)*260/Math.max(1,series.length),y=107-(s.closing-min)/(max-min)*88;
  ctx.fillStyle='#83c4ab';ctx.fillRect(x-10,y,20,Math.max(2,108-y));ctx.fillStyle='#cadce0';ctx.fillText(String(s.day)+'日',x,125);
 });
 ctx.fillStyle='#e3ebe5';ctx.textAlign='left';ctx.fillText(`${max}G`,23,12);
}
for(const id of Object.keys(statTitles)){
 const button=el(id).closest('.metrics > div');button.tabIndex=0;button.setAttribute('role','button');button.setAttribute('aria-label',statTitles[id]+'の詳細を表示');
 const open=()=>{selectedStat=id;refreshStatDetail();el('statsDialog').showModal();};
 button.addEventListener('click',open);button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
}
el('statsClose').addEventListener('click',()=>el('statsDialog').close());

function colonyCapacity(){worlds.underground.homeBonus=currentMods().homeBonus;const hs=worlds.underground.buildings.filter(b=>b.kind==='home'&&worlds.underground.connectivity?.[b.id]);if(hs.length)return hs.reduce((n,b)=>n+homeCapacity(worlds.underground,b),0);const homes=worlds.underground.buildings.filter(b=>b.kind==='home'&&worlds.underground.connectivity?.[b.id]).length;return 5+Math.max(0,homes-1)*2+homes*currentMods().homeBonus;}
function openColonist(id){
 const idx=game.residents.findIndex(r=>r.id===id);if(idx<0)return;let r=C.ensureColonist(game.residents[idx]);game.residents[idx]=r;
 const d=el('propertyDialog');el('propertyTitle').textContent=`${r.name}　Lv${r.level}（XP ${r.xp}/${C.LEVEL_XP[Math.min(9,r.level)]??'MAX'}）`;
 const st=C.decayStage(r.decay);
 el('propertyDetails').textContent=`長所：${C.TRAITS[r.traits[0]].name}（${C.TRAITS[r.traits[0]].desc}）\n短所：${C.TRAITS[r.traits[1]].name}（${C.TRAITS[r.traits[1]].desc}）\n腐敗 ${r.decay}（${st.name}・作業効率×${st.eff}）／臭気 ${C.odorOf(r)}${C.canGoOutside(r)?'':'　⚠外勤不可'}\nスキルポイント：${r.sp}`;
 const host=el('propertyDialogActions');host.replaceChildren();const grid=document.createElement('div');grid.className='colonist-stats';
 for(const [k,label] of Object.entries(C.STATS)){const lab=document.createElement('span');lab.textContent=label;const bar=document.createElement('div');bar.className='bar';const i=document.createElement('i');i.style.width=`${r.stats[k]*10}%`;i.style.background='#74c8b6';bar.append(i);
  const b=document.createElement('button');b.textContent=`${r.stats[k]} ＋`;b.disabled=!(r.sp>0)||r.stats[k]>=10;b.addEventListener('click',()=>{const res=C.allocate(game.residents[idx],k);if(res.ok){game.residents[idx]=res.resident;saveNow();refreshResidentRows();openColonist(id);}});grid.append(lab,bar,b);}
 const wash=document.createElement('button');wash.textContent='🧽 手作業洗浄（衛生用品1・10G）';wash.addEventListener('click',()=>{const res=C.handWash(game.residents[idx],colony.inventory.care,game.money);if(res.ok){game.residents[idx]=res.resident;colony={...colony,inventory:{...colony.inventory,care:res.care}};game={...game,money:res.money};moneyChange(-10,'生活物資仕入れ',r.name+'の手作業洗浄');updateEconomy();saveNow();openColonist(id);}else status(res.reason);});
 host.append(grid,wash);if(!d.open)d.showModal();
}
function lotOwnerText(lot,city){const st=city.lots[lot.id]??{};const f=st.facility&&CITY.LOT_FACILITIES[st.facility];return `${CITY.lotOpen(city,lot)?'':'🔒 '}${st.leased?'契約中':'未契約'}${f?'・'+f.icon+f.name:''}`;}
function openLotDialog(lot){
 surfaceEconomy=CITY.ensureCity(surfaceEconomy);const city=surfaceEconomy.city,st=city.lots[lot.id]??{},d=el('propertyDialog');
 const dist=CITY.DISTRICTS.find(x=>x.id===lot.district);
 el('propertyTitle').textContent=`空き地 ${lot.id.slice(-1).toUpperCase()}（${dist.name}）`;
 el('propertyDetails').textContent=`${lotOwnerText(lot,city)}\n${CITY.lotOpen(city,lot)?`契約：敷金${CITY.LEASE.deposit}G＋${CITY.LEASE.daily}G/日。設備で街やフリマ事業を強化できます。`:`「${dist.name}」が開発されると使えます。`}`;
 const host=el('propertyDialogActions');host.replaceChildren();
 const act=(label,fn,disabled=false,cls='')=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;if(cls)b.className=cls;b.addEventListener('click',()=>{const r=fn();if(r.ok){surfaceEconomy={...surfaceEconomy,city:r.city};if(r.cost){game={...game,money:r.money};moneyChange(-r.cost,'建設',label);}updateEconomy();saveNow();openLotDialog(lot);}else{el('propertyDetails').textContent+=`\n⚠ ${r.reason}`;}});host.append(b);};
 if(!CITY.lotOpen(city,lot)){}
 else{
  if(!st.leased)act(`借りる（敷金${CITY.LEASE.deposit}G）`,()=>CITY.leaseLot(surfaceEconomy.city,game.money,lot.id));
  for(const [k,f] of Object.entries(CITY.LOT_FACILITIES)){
   const isUpgrade=f.from&&st.facility===f.from;if(st.facility&&!isUpgrade)continue;if(!st.facility&&f.from)continue;
   act(`${f.icon} ${f.name} ${f.cost}G${f.upkeep?`（${f.upkeep}G/日）`:''}`,()=>CITY.buildOnLot(surfaceEconomy.city,game.money,lot.id,k),!city.districts.includes(f.district));
   const note=document.createElement('small');note.textContent=f.desc+(city.districts.includes(f.district)?'':`（${CITY.DISTRICTS.find(x=>x.id===f.district).name}で解放）`);host.append(note);}
  if(st.facility)act('設備を撤去',()=>CITY.clearLot(surfaceEconomy.city,lot.id),false,'warn');
  if(st.leased&&!st.facility)act('解約する',()=>CITY.releaseLot(surfaceEconomy.city,lot.id),false,'warn');
 }
 if(!d.open)d.showModal();
}
function updateCityPanel(){
 const box=el('cityStatus');if(!box)return;surfaceEconomy=CITY.ensureCity(surfaceEconomy);const city=surfaceEconomy.city;
 const ownedHousing=RENTALS.filter(p=>(owned.includes(p.id)||rented.includes(p.id))&&PROPERTY_ROLES[p.id]?.capacity).reduce((n,p)=>n+PROPERTY_ROLES[p.id].capacity,0);
 const cap=CITY.housingCapacity(city,ownedHousing),fx=CITY.lotEffects(city);
 el('cityBadge').textContent=CITY.DISTRICTS.filter(x=>city.districts.includes(x.id)).map(x=>x.name).join('・');
 box.textContent=`人口 ${surfaceEconomy.humans}/${cap}人・繁栄 ${Math.round(city.prosperity)}・信頼 ${surfaceEconomy.trust}・警戒 ${game.alert}｜空き地 ${CITY.LOTS.filter(l=>CITY.lotOpen(city,l)).length}区画（契約${Object.values(city.lots).filter(l=>l.leased).length}）｜フリマ閲覧×${fx.fleaViewMul.toFixed(2)}${fx.leeching?'（ただ乗り中…）':''}`;
 const nx=CITY.nextDistrict(city);const hs=city.history??[];const trustNow=surfaceEconomy.trust,pros=Math.round(city.prosperity),pop=surfaceEconomy.humans;
 // v2.6: goal bars toward the next district
 const goal=el('cityGoal');goal.replaceChildren();
 const row=(label,val,need,max,ok,col,unit='')=>{const r=document.createElement('div');r.className='cg-row'+(ok?' ok':'');r.innerHTML=`<b>${ok?'✅':'⬜'} ${label}</b><div class="cg-bar"><i style="width:${Math.min(100,val/max*100)}%;background:${col}"></i><em style="left:${Math.min(100,need/max*100)}%"></em></div><span>${val}${unit} / ${need}${unit}</span>`;goal.append(r);};
 if(nx){const h=document.createElement('div');h.className='cg-title';h.textContent=`次の街区「${nx.name}」の条件`;goal.append(h);
  row('人口',pop,nx.need.pop,Math.max(nx.need.pop,cap),pop>=nx.need.pop,'#f2d37a','人');row('繁栄',pros,nx.need.prosperity,100,pros>=nx.need.prosperity,'#74c8b6');row('信頼',trustNow,nx.need.trust,100,trustNow>=nx.need.trust,'#9ab4f0');
  const r=document.createElement('div');r.className='cg-row'+(game.alert<nx.need.alertBelow?' ok':'');r.innerHTML=`<b>${game.alert<nx.need.alertBelow?'✅':'⬜'} 警戒</b><div class="cg-bar"><i style="width:${game.alert}%;background:#f08a7a"></i><em style="left:${nx.need.alertBelow}%"></em></div><span>${game.alert} / ${nx.need.alertBelow}未満</span>`;goal.append(r);
  el('cityNext').textContent=`開発されると：${nx.desc}（住宅枠+${nx.housing}）`;}else el('cityNext').textContent='全街区を開発済み！';
 // advice: why it stalls
 const tips=[];const d7=hs.length>7?pop-hs[hs.length-8].humans:null;
 if(game.alert>=55)tips.push(`🚨 警戒度${game.alert}が高く、信頼が毎日下がっています（警戒45未満で信頼が上がり始めます）。外勤を減らす・洗浄・偽装クリーム・警備室で下げましょう。`);
 else if(game.alert>=25)tips.push(`⚠ 警戒度${game.alert}：信頼は横ばい〜微減。25未満なら信頼+2/日。`);
 if(trustNow<45)tips.push(`🤝 信頼${trustNow}が低いと人口が減り、繁栄も伸びません。`);
 if(pop>=cap*0.95)tips.push(`🏠 人間の住宅枠（${cap}人）が満杯。地上物件の取得や新街区で枠が増えます。`);
 if((owned.length+rented.length)<2)tips.push('🏪 地上事業（物件）が少ないと雇用が伸びず繁栄が上がりにくいです。');
 if(!tips.length)tips.push('👍 順調です。このまま警戒を低く保つと条件に近づきます。');
 el('cityAdvice').replaceChildren(...[(d7!=null?`📈 人口の推移：7日で${d7>=0?'+':''}${d7}人`:''),...tips].filter(Boolean).map(t=>{const p=document.createElement('p');p.textContent=t;return p;}));
 // chart sized to its CSS box (no stretched text)
 const cv=el('cityChart'),dpr2=window.devicePixelRatio||1,cw=Math.max(200,cv.clientWidth||320),ch=120;if(cv.width!==Math.round(cw*dpr2)){cv.width=Math.round(cw*dpr2);cv.height=Math.round(ch*dpr2);}
 const g=cv.getContext('2d');g.setTransform(dpr2,0,0,dpr2,0,0);g.clearRect(0,0,cw,ch);g.fillStyle='#0e2430';g.fillRect(0,0,cw,ch);
 g.strokeStyle='#2c4652';g.lineWidth=1;g.font='9px system-ui';g.fillStyle='#7f9ca3';for(const v of [0,50,100]){const y=ch-14-(v/100)*(ch-24);g.beginPath();g.moveTo(26,y);g.lineTo(cw-4,y);g.stroke();g.fillText(v,4,y+3);}
 const sh=surfaceEconomy.history??[];
 if(hs.length>1){const mx=Math.max(...hs.map(x=>x.humans),cap);const X=i=>26+i/(hs.length-1)*(cw-32),Y=v=>ch-14-v*(ch-24);
  const line=(vals,col)=>{g.strokeStyle=col;g.lineWidth=2;g.beginPath();vals.forEach((v,i)=>{i?g.lineTo(X(i),Y(v)):g.moveTo(X(i),Y(v));});g.stroke();};
  line(hs.map(x=>x.humans/mx),'#f2d37a');line(hs.map(x=>x.prosperity/100),'#74c8b6');
  if(sh.length>1){const t=sh.slice(-hs.length);line(t.map(x=>(x.trust??0)/100),'#9ab4f0');}
  g.fillStyle='#9fb6bb';g.fillText(`第${hs[0].day}日`,26,ch-3);g.fillText(`第${hs.at(-1).day}日`,cw-46,ch-3);g.fillText(`人口目盛り:最大${mx}人`,cw-110,10);}
 else{g.fillStyle='#9fb6bb';g.font='11px system-ui';g.fillText('翌朝からグラフが記録されます',36,ch/2);}
}
function connectedKind(kind){return worlds.underground.buildings.filter(b=>b.kind===kind&&worlds.underground.connectivity?.[b.id]).reduce((n,b)=>n+(b.level??1),0);}
function connectedLabs(){return worlds.underground.buildings.filter(b=>b.kind==='lab'&&worlds.underground.connectivity?.[b.id]).length;}
function currentMods(){return researchMods(colony.completedResearch);}
function updateResearchPanel(note=''){
 const tree=el('researchTree');if(!tree)return;
 const st=researchState(colony),active=st.active?techById(st.active):null;
 el('researchStatus').textContent=note||(active?`研究中：${active.name} ${st.progress}/${active.work}pt`:`完了 ${colony.completedResearch.length}/${TECHS.length}・研究室${connectedLabs()}棟`);
 el('researchBar').style.width=active?`${Math.round(st.progress/active.work*100)}%`:'0%';
 if(!tree.dataset.built){tree.dataset.built='1';tree.classList.add('tree-mode');
  // v2.9: strategy-game style tree — tiers are columns, each branch is a lane, prerequisites are drawn as connectors.
  const T=Math.max(...TECHS.map(t=>t.tier));const wrap=document.createElement('div');wrap.className='tree-canvas';wrap.style.gridTemplateColumns=`repeat(${T},128px)`;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('tree-lines');wrap.append(svg);
  let row=1;for(let t=1;t<=T;t++){const h=document.createElement('div');h.className='tier-head';h.textContent=['','Ⅰ 基礎','Ⅱ 発展','Ⅲ 応用','Ⅳ 到達'][t]??`Tier${t}`;h.style.gridColumn=t;h.style.gridRow=row;wrap.append(h);}row++;
  for(const [bid,br] of Object.entries(BRANCHES)){const list=TECHS.filter(t=>t.branch===bid);if(!list.length)continue;
   const lab=document.createElement('div');lab.className='lane-head';lab.textContent=`${br.icon} ${br.name}`;lab.style.gridColumn=`1 / span ${T}`;lab.style.gridRow=row;wrap.append(lab);row++;
   const slots={};let rows=1;
   for(const t of list){const k=slots[t.tier]=(slots[t.tier]??0)+1;rows=Math.max(rows,k);const btn=document.createElement('button');btn.className='research-node';btn.dataset.node=t.id;
    const tic=Object.values(FACILITY_DEFS).find(f=>f.tech===t.id)?.icon??br.icon;btn.innerHTML=`<span class="tic" aria-hidden="true">${tic}</span>${t.name}<small>${t.cost}G・資材${t.samples}・${t.work}pt</small>`;
    btn.style.gridColumn=t.tier;btn.style.gridRow=row+k-1;btn.addEventListener('click',()=>{selectedTech=t.id;updateResearchPanel();});wrap.append(btn);}
   row+=rows;}
  tree.append(wrap);new ResizeObserver(()=>{tree.dataset.lines='';drawTreeLines();}).observe(wrap);
 }
 for(const btn of tree.querySelectorAll('[data-node]')){const s2=techStatus(colony,btn.dataset.node);btn.classList.toggle('completed',s2==='done');btn.classList.toggle('locked',s2==='locked');btn.classList.toggle('active',s2==='active');btn.classList.toggle('selected',selectedTech===btn.dataset.node);btn.setAttribute('aria-label',techById(btn.dataset.node).name+({done:' 完了',locked:' 未解放',active:' 研究中',available:''})[s2]);}
 drawTreeLines();
 const t=selectedTech&&techById(selectedTech);
 if(t){const s2=techStatus(colony,t.id);el('researchDetailName').textContent=`${t.name}（${BRANCHES[t.branch].name}）`;{const fac=Object.values(FACILITY_DEFS).filter(f=>f.tech===t.id);const next=TECHS.filter(n=>n.req.includes(t.id));const labs=Math.max(1,connectedLabs());const nights=Math.ceil(t.work/labs);
   const stTxt={done:'✅ 完了済み',active:'⏳ 研究中',locked:'🔒 前提研究が未完了',available:'🟢 研究できます'}[s2];
   const rows=[['状態',stTxt],['効果',t.desc]];
   for(const f of fac)rows.push(['解放施設',`${f.icon} ${f.name}${f.desc?`：${f.desc}`:''}${f.cost!=null?`（建設 ${f.cost}G）`:''}`]);
   rows.push(['費用',`${t.cost}G・研究資材${t.samples}個（所持 ${colony.inventory?.samples??0}）`],['必要研究量',`${t.work}pt（担当1体・研究室${connectedLabs()}棟なら約${nights}夜）`]);
   rows.push(['前提',t.req.length?t.req.map(q=>`${colony.completedResearch.includes(q)?'✓':'✗'} ${techById(q).name}`).join('・'):'なし']);
   if(next.length)rows.push(['次に解放',next.map(n=>n.name).join('・')]);
   const d=el('researchDetailDesc');d.replaceChildren();for(const [k,v] of rows){const r=document.createElement('span');r.className='rd-row';const b=document.createElement('b');b.textContent=k;const i=document.createElement('i');i.textContent=v;r.append(b,i);d.append(r);}}
  const b=el('researchStart');b.disabled=s2!=='available'||!!active;b.textContent=s2==='done'?'完了済み':s2==='active'?'研究中':s2==='locked'?'前提研究が必要':active?'他の研究が進行中':`研究開始 · ${t.cost}G＋資材${t.samples}`;}
}
function updateTree(){updateResearchPanel();}
showPanel(null);updateTree();

// ===== v2.6: notices, famine, game over, raids =====
function showNotice(title,body){sfx(/成功|💰/.test(title)?'coin':/💀|飢餓|🩸/.test(title)?'death':'bad');el('noticeTitle').textContent=title;el('noticeBody').textContent=body;const d=el('noticeDialog');if(!d.open)d.showModal();}
el('noticeClose').addEventListener('click',()=>el('noticeDialog').close());
function gameOver(title,body){sfx('gameover');setMusic(null);colony={...colony,gameOver:{title,body,day:game.day}};paused=true;syncClockButtons?.();
 el('gameOverTitle').textContent=`GAME OVER — ${title}`;el('gameOverBody').textContent=`${body}（第${game.day}日・資金${game.money}G）`;const d=el('gameOverDialog');if(!d.open)d.showModal();saveNow();}
el('gameOverRestart').addEventListener('click',restartGame);
el('gameOverDialog').addEventListener('cancel',e=>e.preventDefault());
function checkFamineAndDefeat(){
 if(colony.gameOver)return;
 const starving=(colony.report?.shortage??0)>0&&(colony.inventory.food??0)<=0;
 colony={...colony,starveDays:starving&&game.residents.length?(colony.starveDays??0)+1:0};
 if(colony.starveDays>=3){const n=Math.ceil(game.residents.length/2);
  surfaceEconomy={...surfaceEconomy,humans:Math.max(0,surfaceEconomy.humans-n*2),trust:Math.max(0,surfaceEconomy.trust-8)};
  game={...game,alert:Math.min(100,game.alert+12+n*3),residents:game.residents.map(r=>({...r,impulse:Math.min(100,(r.impulse??0)+15)}))};
  if(game.alert>=100&&colony.starveDays>=5){gameOver('人間による殲滅','食料が尽き、飢えたゾンビたちは地上で人間を襲い続けた。ついに武装した人間たちが地下タウンを突き止め、コロニーは殲滅された…');return;}
  showNotice('🩸 飢餓状態',`食料が尽きて${colony.starveDays}日目。飢えたゾンビ${n}体が地上へ出て人間を襲った…（人間−${n*2}・警戒度${game.alert}）。食料を確保しないまま警戒度100で飢餓が続くと、人間に殲滅されます。`);}
 else if(colony.starveDays>0)showNotice('🍞 食料切れ',`食料が尽きています（${colony.starveDays}日目）。3日続くと飢餓状態になり、ゾンビが地上で人間を襲い始めます。買い出し・食料調達・調理施設で食料を確保してください。`);
 if(!game.residents.length)gameOver('全滅','ゾンビが一体もいなくなった。地下タウンは静まり返った…');
}
function raidOdds(r){const st=r.stats??{};return Math.round(Math.max(.1,Math.min(.85,.2+(st.str??2)*.06+(st.dex??2)*.04+(r.level??1)*.03-game.alert/300))*100);}
function raidLoot(r){const st=r.stats??{};return 70+(r.level??1)*25+(st.str??2)*10+(st.dex??2)*8;}
function renderRaid(){const sel=el('raidWho');if(!sel)return;const keep=sel.value;const sig=game.residents.map(r=>r.id).join(',');
 if(sel.dataset.sig!==sig){sel.dataset.sig=sig;sel.replaceChildren();for(const r of game.residents)sel.append(new Option(`${r.name}（Lv${r.level??1}）`,r.id));if(keep)sel.value=keep;}
 const r=game.residents.find(x=>String(x.id)===sel.value);el('raidInfo').textContent=r?`成功率 約${raidOdds(r)}%／成功時 約${raidLoot(r)}G。※成功しても失敗しても、${r.name}は捕まり二度と戻りません。`:'ゾンビがいません。';
 el('raidGo').disabled=!r||!!colony.gameOver;}
let raidArm=0;
el('raidWho')?.addEventListener('change',()=>{raidArm=0;el('raidGo').textContent='💀 強奪に行かせる';renderRaid();});
el('raidGo')?.addEventListener('click',()=>{const r=game.residents.find(x=>String(x.id)===el('raidWho').value);if(!r)return;
 if(Date.now()-raidArm>4000){raidArm=Date.now();el('raidGo').textContent=`⚠ ${r.name}を本当に行かせる？（もう一度押す）`;return;}
 raidArm=0;el('raidGo').textContent='💀 強奪に行かせる';
 const roll=((game.day*131+game.tick*17+r.id*53)%100);const ok=roll<raidOdds(r);const loot=ok?raidLoot(r):0;
 game={...game,money:game.money+loot,alert:Math.min(100,game.alert+(ok?14:22)),residents:game.residents.filter(x=>x.id!==r.id)};
 if(loot)moneyChange(loot,'強奪',`${r.name}が地上で強奪`);
 social=recordDeaths(social,game.day,[r.name]);colony={...colony,lossCount:(colony.lossCount??0)+1};
 showNotice(ok?'💰 強奪成功…':'💀 強奪失敗',ok?`${r.name}は人間の店から${loot}Gを奪い、地下へ送り届けた。だが逃げきれず、人間に捕まり惨殺された…（警戒度+14）`:`${r.name}は強奪に失敗し、その場で人間に取り押さえられ惨殺された…（警戒度+22）`);
 updateEconomy();updateColonyPanel();renderRaid();if(!game.residents.length)gameOver('全滅','最後のゾンビが地上で倒れた。地下タウンには誰も残っていない…');saveNow();});
setInterval(renderRaid,1000);renderRaid();
setTimeout(()=>{if(colony.gameOver)gameOver(colony.gameOver.title,colony.gameOver.body);},1500);

// ===== v2.7: building detail & research-gated upgrades =====
function maxLevelFor(){const n=colony.completedResearch.length;return n>=10?3:n>=4?2:1;}
function upgradeCost(b){const f=FACILITY_DEFS[b.kind];return Math.round((f?.cost??80)*.6*(b.level??1)+40);}
function levelEffectText(b){const lv=b.level??1,k=b.kind;
 const m={home:`定員 ${homeCapacity(worlds.underground,b)}人（Lvごとに+2）`,wash:`毎朝 ${2*lv}人まで洗浄`,cooler:`毎朝 ${4*lv}人まで腐敗−3`,repair:`毎朝 ${2*lv}人まで腐敗−12`,pantry:`食料庫の容量 ×${lv}`,storage:`資材置き場の容量 ×${lv}`,lab:`研究室${lv}棟分の研究力`,security:`警戒 −${Math.min(2,lv)}/日`,generator:`電力 ${3*lv}回分/夜`,automation:`無人加工 ${2*lv}回/夜`};
 if(m[k])return m[k];if(recipesFor(k).length)return `配属人数の上限 ${staffCap(b)}人`;if(k==='lounge')return `娯楽効果 ×${lv}`;return '';}
function openBuilding(id){const w=worlds.underground,b=w.buildings.find(x=>x.id===id);if(!b)return;const f=FACILITY_DEFS[b.kind]??{icon:'🏠',name:b.name,desc:b.description};const lv=b.level??1,mx=maxLevelFor();
 const d=el('propertyDialog');el('propertyTitle').textContent=`${f.icon} ${b.name}　Lv${lv}`;
 const lines=[f.desc??b.description??'',`大きさ ${b.w}×${b.h}／${w.connectivity?.[b.id]?'✓ 通路に接続':'⚠ 通路未接続（利用停止中）'}`,levelEffectText(b)?`現在の効果：${levelEffectText(b)}`:''];
 if(b.kind==='home'){const a=homeAssignments(game,w);const who=game.residents.filter(r=>a[r.id]?.id===b.id).map(r=>r.name);lines.push(`住んでいる住民：${who.join('・')||'なし'}`);}
 if(recipesFor(b.kind).length){const pl=planOf(b);const post=staffing(game.residents).posts.find(p=>p.b.id===b.id);lines.push(`生産：${pl.recipe==='auto'?'おまかせ':CAT_RECIPES[pl.recipe].name}／人数 ${pl.staff}/${staffCap(b)}`,`配属：${post?.workers.map(r=>r.name).join('・')||'なし'}`);}
 const users=Object.entries(w.facilityUsers??{}).filter(([,v])=>v===b.id).map(([n])=>n);if(users.length)lines.push(`今日の利用者：${users.join('・')}`);
 el('propertyDetails').textContent=lines.filter(Boolean).join('\n');
 const host=el('propertyDialogActions');host.replaceChildren();
 const upg=['home','wash','cooler','repair','pantry','storage','lab','security','generator','automation','lounge'].includes(b.kind)||recipesFor(b.kind).length>0;
 if(!upg){const s=document.createElement('small');s.textContent='この施設は強化の対象外です。';host.append(s);}
 else if(lv<3){const cost=upgradeCost(b);const btn=document.createElement('button');const can=lv<mx;
  btn.textContent=can?`⬆ Lv${lv+1}に強化（${cost}G）`:`🔒 Lv${lv+1}：研究を${lv+1===2?4:10}件完了で解放（現在${colony.completedResearch.length}件）`;btn.disabled=!can||game.money<cost;
  btn.addEventListener('click',()=>{if(game.money<cost)return;b.level=lv+1;sfx('levelup');game={...game,money:game.money-cost};moneyChange(-cost,'建設',`${b.name}をLv${lv+1}に強化`);updateEconomy();updateColonyPanel();renderFacilityPlans(true);saveNow();openBuilding(id);});
  host.append(btn);const note=document.createElement('small');note.textContent=can?`強化後：Lv${lv+1}で効果アップ${game.money<cost?'（資金不足）':''}`:'研究ツリーを進めると強化できるようになります。';host.append(note);}
 else{const s=document.createElement('small');s.textContent='最大レベルです。';host.append(s);}
 if(!d.open)d.showModal();}

function drawTreeLines(){const tree=el('researchTree'),wrap=tree?.querySelector('.tree-canvas'),svg=wrap?.querySelector('.tree-lines');if(!svg||!wrap.offsetWidth)return;
 const sig=colony.completedResearch.join()+'|'+(researchState(colony).active??'')+'|'+selectedTech+'|'+wrap.offsetWidth+'x'+wrap.offsetHeight;if(tree.dataset.lines===sig)return;tree.dataset.lines=sig;
 svg.setAttribute('width',wrap.scrollWidth);svg.setAttribute('height',wrap.scrollHeight);svg.replaceChildren();const base=wrap.getBoundingClientRect();
 const box=id=>{const b=wrap.querySelector(`[data-node="${id}"]`);return b&&b.getBoundingClientRect();};
 for(const t of TECHS)for(const q of t.req){const a=box(q),b=box(t.id);if(!a||!b)continue;
  const x1=a.right-base.left,y1=a.top+a.height/2-base.top,x2=b.left-base.left,y2=b.top+b.height/2-base.top,mx=(x1+x2)/2;
  const done=colony.completedResearch.includes(q),hot=selectedTech===t.id||selectedTech===q;
  const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',`M${x1} ${y1} C${mx} ${y1},${mx} ${y2},${x2} ${y2}`);
  const cross=techById(q).branch!==t.branch;p.setAttribute('class','tl'+(done?' done':'')+(hot?' hot':'')+(cross?' cross':''));svg.append(p);}}

// ===== v3.1 audio =====
for(const ev of ['pointerdown','keydown'])window.addEventListener(ev,()=>{unlockAudio();setMusic(colony.gameOver?null:(game.tick%120)>=60?'night':'day');},{capture:true});
document.addEventListener('click',e=>{if(e.target.closest('button'))sfx('click');},{capture:true});
{const m=el('audioMute'),b=el('bgmVol'),f=el('sfxVol');if(m&&b&&f){b.value=audioPrefs.bgm;f.value=audioPrefs.sfx;const sync=()=>{m.textContent=audioPrefs.muted?'🔇 ミュート中':'🔊 音あり';};sync();
 m.addEventListener('click',()=>{setAudio({muted:!audioPrefs.muted});sync();});b.addEventListener('input',()=>setAudio({bgm:+b.value}));f.addEventListener('input',()=>{setAudio({sfx:+f.value});sfx('coin');});}}
