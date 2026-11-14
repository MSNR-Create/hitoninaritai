import { clamp, hitTile, tileToWorld, worldToView, zoomAround } from './geometry.js';
import { makeWorlds, describeTile } from './world.js';
import { drawScene } from './render.js';
import { boundCamera, makePinch, applyPinch } from './camera.js';
import { initialGame, stepGame, assignJob, JOBS, moodOf } from './simulation.js';
import { residentVisual } from './agent.js';
import { applyConstruction, canUnlock, zoneAt, connectedFacilities } from './construction.js';
import { planCorridor, applyCorridor, buildingPreview } from './planning.js';
import { GOODS, PACKING, initialResale, marketIndex, buyItem, sellItem } from './resale.js';
import { RENTALS, rentProperty } from './rentals.js';
import { PURCHASE_PRICES, buyProperty, propertyBill, selectProperty } from './property.js';
import { chooseFootprint, chooseCorridor } from './placement-interaction.js';
import { SUPPLIES, RESEARCH, initialColony, buySupply, beginResearch, advanceColony } from './colony.js';
import { initialSocial, advanceSocial, recordDeaths, NEIGHBORS } from './social.js';
import { serializeSession, validateSession, hydrateWorld, saveSnapshot, loadSnapshot, clearSnapshots } from './persistence.js';
import { sceneDefinition, paintEvent, eventsForDay } from './event-scenes.js';

const canvas=document.getElementById('scene');const ctx=canvas.getContext('2d',{alpha:false});
const viewport=document.getElementById('viewport');const worlds=makeWorlds();
worlds.underground.connectivity=connectedFacilities(worlds.underground);
const state={ layer:'underground', selected:{ underground:{x:8,y:8}, surface:{x:7,y:8} }, view:{cx:0,cy:0,panX:0,panY:0,zoom:1}, pointers:new Map(),gesture:null,started:performance.now() };
let bounds={width:0,height:0},dpr=1,raf=0;
let colony=initialColony();
let social=initialSocial();
let game=initialGame(), simAccumulator=0,lastTime=null,speed=1,paused=false;
let eventQueue=[], activeEvent=null, eventFrame=null, savePending=false, endingUnlocked=false;
let tool='inspect',pathStart=null,hoverTile=null,placement=null,resale=initialResale(),rented=[],owned=[],corridorChoice=null,buildChoice=null,economyDay=game.day,lastRentDue=0; 
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
  const p=tileToWorld(7.5,7.5);
  state.view={ cx:bounds.width/2,cy:bounds.height*.46, panX:-p.x,panY:-p.y, zoom:Math.min(1.05,Math.max(.48,bounds.width/700)) };
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
function updateConstruction(){
  for(const btn of document.querySelectorAll('[data-tool]')){
    const active=btn.dataset.tool===tool;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));
  }
}
function status(message){el('buildMessage').textContent=message;}
function refreshConnectivity(){worlds.underground.connectivity=connectedFacilities(worlds.underground);}
function setTool(next){tool=next;pathStart=null;corridorChoice=null;buildChoice=null;hoverTile=state.selected.underground;placement=null;updateConstruction();updatePlacement();
 status(tool==='path'?'通路の始点→終点→同じ終点をタップして施工。':tool==='home'||tool==='shop'||tool==='lab'?`${tool==='home'?'住居 3×2':tool==='lab'?'研究室 2×2':'配給所 2×3'} の位置を選択→占有範囲内を再タップして建設。`:tool==='unlock'?'閉鎖区画をタップして選択し、再タップして開放。':'マップを観察できます。');}
for(const btn of document.querySelectorAll('[data-tool]'))btn.addEventListener('click',()=>{if(state.layer!=='underground'&&btn.dataset.tool!=='inspect')switchLayer('underground');setTool(btn.dataset.tool)});
function rectangle(x,y,w,h){const cells=[];for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)cells.push({x:xx,y:yy});return cells;}
function updatePlacement(){
 placement=null;if(state.layer!=='underground'||tool==='inspect')return;
 const p=buildChoice??hoverTile??state.selected.underground;
 if(['home','shop','lab'].includes(tool)){
  const v=buildingPreview(worlds.underground,tool,p.x,p.y,game.money);
  placement={kind:tool,x:p.x,y:p.y,w:v.w,h:v.h,tiles:rectangle(p.x,p.y,v.w,v.h),valid:v.ok};
 }else if(tool==='path'&&corridorChoice?.start){
  const to=corridorChoice.end??hoverTile??corridorChoice.start;
  const route=planCorridor(worlds.underground,corridorChoice.start,to,game.money);
  placement={kind:'path',tiles:route.route??[],valid:route.ok};
 }else if(tool==='unlock'&&buildChoice){
  const z=zoneAt(worlds.underground,buildChoice.x,buildChoice.y);
  if(z)placement={kind:'unlock',tiles:rectangle(z.x,z.y,z.w,z.h),valid:!z.open};
 }
}
function buildAt(tile){
 if(state.layer!=='underground')return;
 const world=worlds.underground;
 if(tool==='unlock'){
  const zone=zoneAt(world,tile.x,tile.y);
  if(!zone||zone.open){status('開放可能な閉鎖区画を選んでください。');return;}
  const second=buildChoice?.kind==='unlock'&&zoneAt(world,buildChoice.x,buildChoice.y)?.id===zone.id;
  if(!second){buildChoice={kind:'unlock',x:tile.x,y:tile.y};status(`${zone.name}：開放費用 ${zone.cost}G。もう一度この区画をタップして確定。`);updatePlacement();return;}
  const result=applyConstruction(world,{type:'unlock',zoneId:zone.id},game.money);
  if(!result.ok){status(result.reason);return;}
  worlds.underground=result.world;game={...game,money:result.money};buildChoice=null;status(`${zone.name} を開放（−${result.cost}G）`);
 }else if(tool==='path'){
  const next=chooseCorridor(corridorChoice,tile);corridorChoice=next.state;
  pathStart=corridorChoice.start;
  if(!corridorChoice.end){status(`始点 (${tile.x}, ${tile.y}) を選択。終点を指定してください。`);updatePlacement();return;}
  const plan=planCorridor(world,corridorChoice.start,corridorChoice.end,game.money);
  if(!plan.ok){status('施工不可：'+plan.reason+'。終点を変えてください。');updatePlacement();return;}
  if(!next.commit){status(`通路 ${plan.newTiles.length}マス・${plan.cost}G。終点 (${corridorChoice.end.x}, ${corridorChoice.end.y}) を再タップで施工。別地点なら終点変更。`);updatePlacement();return;}
  const result=applyCorridor(world,plan,game.money);
  if(!result.ok){status(result.reason);return;}
  worlds.underground=result.world;game={...game,money:result.money};corridorChoice=null;pathStart=null;status(`通路 ${plan.newTiles.length}マスを敷設（−${result.cost}G）。次の始点を選択。`);
 }else if(['home','shop','lab'].includes(tool)){
  const dimensions=tool==='home'?[3,2]:tool==='shop'?[2,3]:[2,2];
  const next=chooseFootprint(buildChoice,tool,tile,dimensions);buildChoice=next.candidate;
  const v=buildingPreview(world,tool,buildChoice.x,buildChoice.y,game.money);
  if(!next.commit){status(`${tool==='home'?'住居':tool==='shop'?'配給所':'研究室'} ${v.w}×${v.h}：${v.ok?'設置可能':'設置不可・'+v.reason}。緑色の範囲内を再タップして確定、別地点で選択変更。`);updatePlacement();return;}
  if(!v.ok){status('配置不可：'+v.reason);updatePlacement();return;}
  const result=applyConstruction(world,{type:'build',kind:tool,x:buildChoice.x,y:buildChoice.y},game.money);
  if(!result.ok){status(result.reason);return;}
  worlds.underground=result.world;game={...game,money:result.money};buildChoice=null;status(`${tool==='home'?'住居':tool==='lab'?'研究室':'配給所'} ${v.w}×${v.h} を建設（−${result.cost}G）`);
 }
 refreshConnectivity();hoverTile=null;updatePlacement();updateSelection();updateEconomy();
}
function atPoint(point){return hitTile(point.x,point.y,state.view);}
function switchLayer(layer){if(!worlds[layer])return;state.layer=layer; if(layer==='surface'&&tool!=='inspect')setTool('inspect');layerButton();updateRentalPanel();}
function canvasCoords(evt){const r=canvas.getBoundingClientRect();return{x:evt.clientX-r.left,y:evt.clientY-r.top};}
function midpoint(a,b){return{x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function beginGesture(){
  const pointers=[...state.pointers.values()];
  if(pointers.length===1)state.gesture={mode:'drag',start:pointers[0],prev:pointers[0],moved:false};
  else if(pointers.length>=2)state.gesture={mode:'pinch',...makePinch(state.view,pointers[0],pointers[1])};
}
canvas.addEventListener('pointerdown',evt=>{
  if(evt.button!==0&&evt.pointerType==='mouse')return;
  canvas.setPointerCapture(evt.pointerId);state.pointers.set(evt.pointerId,canvasCoords(evt));beginGesture();
});
canvas.addEventListener('pointermove',evt=>{
  if(!state.pointers.has(evt.pointerId))return;
  const point=canvasCoords(evt);state.pointers.set(evt.pointerId,point);
  if(state.layer==='underground'&&tool!=='inspect'&&state.pointers.size===1){const t=atPoint(point);if(t&&!buildChoice){hoverTile=t;updatePlacement();}}
  if(state.pointers.size===1&&state.gesture?.mode==='drag'){
    const g=state.gesture;const deltaX=point.x-g.prev.x,deltaY=point.y-g.prev.y;
    if(Math.hypot(point.x-g.start.x,point.y-g.start.y)>7)g.moved=true;
    if(g.moved){state.view.panX+=deltaX/state.view.zoom;state.view.panY+=deltaY/state.view.zoom;state.view=boundCamera(state.view,bounds.width,bounds.height);}
    g.prev=point;
  }else if(state.pointers.size>=2){
    const [a,b]=[...state.pointers.values()],center=midpoint(a,b);
    const g=state.gesture;if(g?.mode!=='pinch')return;
    state.view=applyPinch(state.view,g,a,b,bounds.width,bounds.height);updateZoom();
  }
});
function endPointer(evt){
  if(!state.pointers.has(evt.pointerId))return;
  const point=canvasCoords(evt),g=state.gesture,one=state.pointers.size===1;
  const tile=atPoint(point);
  if(evt.type==='pointerup'&&one&&tile){
    if(g?.mode==='drag'&&!g.moved){
      state.selected[state.layer]=tile;hoverTile=tile;updateSelection();if(tool!=='inspect')buildAt(tile);else updateRentalPanel();
    }
  }
  state.pointers.delete(evt.pointerId);
  // The remaining finger must not start a drag after a pinch.
  if(state.pointers.size===1 && g?.mode==='pinch')state.gesture={mode:'suspended'};
  else if(state.pointers.size)beginGesture();else state.gesture=null;
}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('wheel',evt=>{evt.preventDefault();const p=canvasCoords(evt);state.view=boundCamera(zoomAround(state.view,state.view.zoom*(evt.deltaY<0?1.12:1/1.12),p.x,p.y),bounds.width,bounds.height);updateZoom();},{passive:false});

for(const button of document.querySelectorAll('[data-layer]'))button.addEventListener('click',()=>switchLayer(button.dataset.layer));
el('zoomIn').addEventListener('click',()=>{state.view=boundCamera(zoomAround(state.view,state.view.zoom*1.2,bounds.width/2,bounds.height/2),bounds.width,bounds.height);updateZoom();});
el('zoomOut').addEventListener('click',()=>{state.view=boundCamera(zoomAround(state.view,state.view.zoom/1.2,bounds.width/2,bounds.height/2),bounds.width,bounds.height);updateZoom();});
el('resetView').addEventListener('click',centerMap);
el('helpButton').addEventListener('click',()=>el('helpDialog').showModal());
el('closeHelp').addEventListener('click',()=>el('helpDialog').close());
window.addEventListener('keydown',evt=>{
  if(evt.key==='Escape'&&el('helpDialog').open){el('helpDialog').close();return;}
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(evt.key)){
    evt.preventDefault();const d=evt.key==='ArrowUp'?[0,20]:evt.key==='ArrowDown'?[0,-20]:evt.key==='ArrowLeft'?[20,0]:[-20,0];state.view.panX+=d[0];state.view.panY+=d[1];state.view=boundCamera(state.view,bounds.width,bounds.height);
  }
});
new ResizeObserver(frameSize).observe(viewport);
function updateResalePanel(note=''){
 const product=el('resaleProduct'),old=product.value;product.replaceChildren(...GOODS.map(g=>{const opt=document.createElement('option');opt.value=g.id;opt.textContent=`${g.name} 仕入${g.cost}G${resale.rating<g.required?' 🔒':''}`;opt.disabled=resale.rating<g.required;return opt}));
 if([...product.options].some(o=>o.value===old&&!o.disabled))product.value=old;
 el('marketTrend').textContent=`相場 ×${marketIndex(game.day).toFixed(2)}`;
 el('resaleStatus').textContent=`評価 ★${resale.rating.toFixed(1)}（${resale.reviewCount}件）／ 在庫 ${resale.inventory.map(i=>GOODS.find(g=>g.id===i.id).name).join('・')||'なし'}。${note}`;
 el('resaleSell').disabled=resale.inventory.length===0;
}
el('resaleBuy').addEventListener('click',()=>{const r=buyItem(resale,game.money,el('resaleProduct').value);if(r.ok){resale=r.resale;game={...game,money:r.money}}updateEconomy();updateResalePanel(r.ok?'仕入れました。':r.reason)});
el('resaleSell').addEventListener('click',()=>{const r=sellItem(resale,game.money,0,el('packingGrade').value,game.day);if(r.ok){resale=r.resale;game={...game,money:r.money}}updateEconomy();updateResalePanel(r.ok?`売値${r.price}G、手数料${r.fee}G、梱包${r.packingCost}G、今回の損益${r.profit>=0?'+':''}${r.profit}G、評価★${r.stars}。`:r.reason)});
function updateRentalPanel(){
 const t=state.selected.surface,property=state.layer==='surface'?selectProperty(RENTALS,t.x,t.y):null;
 el('rentSelected').disabled=!property||rented.includes(property.id)||owned.includes(property.id)||game.money<property.deposit;
 el('buySelected').disabled=!property||owned.includes(property.id)||game.money<PURCHASE_PRICES[property.id];
 el('rentalInfo').textContent=property?`${property.name}（${property.w}×${property.h}） / 賃貸：契約${property.deposit}G、毎朝${property.rent}G / 購入：${PURCHASE_PRICES[property.id]}G。${owned.includes(property.id)?'購入済み':rented.includes(property.id)?'賃貸契約中':''}`:'地上マップでアパート・店舗・倉庫をタップしてください。';
}
el('rentSelected').addEventListener('click',()=>{
 const t=state.selected.surface,p=selectProperty(RENTALS,t.x,t.y);if(!p)return;
 const r=rentProperty(rented,game.money,p.id);if(!r.ok){el('rentalInfo').textContent=r.reason;return;}
 rented=r.rented;game={...game,money:r.money};updateEconomy();saveNow();
});
el('buySelected').addEventListener('click',()=>{
 const t=state.selected.surface,p=selectProperty(RENTALS,t.x,t.y);if(!p)return;
 const r=buyProperty(owned,rented,game.money,p.id);if(!r.ok){el('rentalInfo').textContent=r.reason;return;}
 owned=r.owned;rented=r.rented;game={...game,money:r.money};updateEconomy();saveNow();
});
function refreshResidentRows(){
 const host=el('residentJobs');
 for(const row of [...host.children])if(!game.residents.some(r=>String(r.id)===row.dataset.id))row.remove();
 for(const r of game.residents){
  let line=[...host.children].find(node=>node.dataset.id===String(r.id));
  if(!line){
   line=document.createElement('div');line.className='resident-row';line.dataset.id=String(r.id);
   const name=document.createElement('span'),select=document.createElement('select');
   select.setAttribute('aria-label',`${r.name}の仕事`);
   for(const [id,job] of Object.entries(JOBS)){const option=document.createElement('option');option.value=id;option.textContent=job.name;select.append(option);}
   select.addEventListener('change',()=>{game=assignJob(game,r.id,select.value);updateEconomy();});
   const info=document.createElement('button');info.type='button';info.textContent='関係・履歴';info.className='detail-btn';info.addEventListener('click',()=>{showResidentDetail(r.id);showPanel('social');});
   line.append(name,select,info);host.append(line);
  }
  const visual=residentVisual(game,r),name=line.firstElementChild,select=line.querySelector('select');
  name.textContent=`${r.name} · 疲労 ${r.fatigue} · 衝動 ${r.impulse??0} · ${r.strikeDays>0?'✊ストライキ · ':''}${visual.status}`;
  name.title=visual.reason;
  // Keep the select DOM mounted and don't touch its value during native selection.
  if(document.activeElement!==select && select.value!==r.job)select.value=r.job;
 }
}
function updateEconomy(){
  const capacity=5+Math.max(0,worlds.underground.buildings.filter(b=>b.kind==='home'&&worlds.underground.connectivity?.[b.id]).length-1)*2;
  el('populationValue').textContent=`${game.residents.length} / ${capacity}`;
  el('moneyValue').textContent=game.money;
  el('foodValue').textContent=colony.inventory.food;
  el('moodValue').textContent=Math.max(0,moodOf(game)-Math.round(game.residents.reduce((sum,r)=>sum+(r.impulse??0),0)/Math.max(1,game.residents.length)/3));
  el('alertValue').textContent=game.alert;
  updateConstruction();updateRentalPanel();updateColonyPanel();updateSocialPanel();
  const clock=game.tick%120,night=clock>=60;
  el('dayValue').textContent=`第${game.day}日 ${night?'夜':'昼'} · ${Math.floor((clock%60)/60*12)+(night?18:6)}時`;
  el('progressValue').textContent=`${clock}/120 秒`;
  const message=game.lastReport?`前日：+${game.lastReport.income}G / 調達 +${game.lastReport.harvest} / 配給不足 ${colony.report?.shortage??0}体 / 地上賃料 -${lastRentDue}G`:'仕事を選び、夜になると成果が反映されます。';
  el('reportValue').textContent=message;
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
function updateColonyPanel(note=''){
 const box=el('colonyStatus');if(!box)return;
 const needs=game.residents.map(r=>`${r.name} ${r.impulse??0}${(r.impulse??0)>=60?' ⚠':''}`).join(' / ');
 const researchDone=colony.completedResearch.includes('impulse');
 box.textContent=`人口 ${game.residents.length}体 / 喪失 ${colony.lossCount??0}体 / 新たな眷属 ${colony.conversionCount??0}体。発展段階 ${colony.stage} / 在庫：食料${colony.inventory.food}・生活${colony.inventory.care}・嗜好${colony.inventory.luxury}・研究資材${colony.inventory.samples}。衝動：${needs}。${colony.report?.incidentNames.length?'⚠ 対人トラブル：'+colony.report.incidentNames.join('・')+'。':''} ${colony.report?.deathNames?.length?'⚰ 犠牲：'+colony.report.deathNames.join('・')+'。':''} ${colony.report?.newFollowerName?'🤝 '+colony.report.newFollowerName+'が加入。':''} ${note}`;
 el('researchStatus').textContent=researchDone?'衝動抑制研究が完了（全住民の衝動を毎日軽減）':`研究：${colony.research.started?'進行中':'未開始'} ${colony.research.progress}/${RESEARCH.work}（研究担当者の夜勤1回につき+1）`;
 el('researchStart').disabled=researchDone||colony.research.started;
}
for(const button of document.querySelectorAll('[data-supply]'))button.addEventListener('click',()=>{
 const r=buySupply(colony,game.money,button.dataset.supply);
 if(r.ok){colony=r.colony;game={...game,money:r.money,food:colony.inventory.food};}
 updateEconomy();updateColonyPanel(r.ok?`${SUPPLIES[button.dataset.supply].name}を${r.quantity}個仕入れ（−${r.cost}G）`:r.reason);
});
el('researchStart').addEventListener('click',()=>{
 const hasLab=worlds.underground.buildings.some(b=>b.kind==='lab'&&worlds.underground.connectivity?.[b.id]);
 const r=beginResearch(colony,game.money,hasLab);
 if(r.ok){colony=r.colony;game={...game,money:r.money};}
 updateEconomy();updateColonyPanel(r.ok?'衝動抑制研究を開始しました。住民の仕事を「地下研究」に変更してください。':r.reason);
});

// Save/load and scene presentation are intentionally outside the headless simulation.
function snapshot(){return serializeSession({game,colony,social,world:worlds.underground,resale,rented,owned,endingUnlocked});}
function saveStatus(message){el('saveStatus').textContent=message;}
async function saveNow(){if(savePending)return;savePending=true;try{await saveSnapshot(snapshot());saveStatus(`保存済み：第${game.day}日`);}catch(e){saveStatus(`保存できません：${e.message}`);}finally{savePending=false;}}
function restoreData(data){const d=validateSession(data);game=d.game;colony=d.colony;social=d.social;worlds.underground=hydrateWorld(d.world);resale=d.resale;rented=d.rented;owned=d.owned??[];endingUnlocked=!!d.endingUnlocked;economyDay=game.day;lastRentDue=0;simAccumulator=0;lastTime=null;eventQueue=[];activeEvent=null;el('eventDialog').close?.();refreshConnectivity();updateEconomy();updateResalePanel();layerButton();updateEndingPanel();}
el('saveButton').addEventListener('click',saveNow);
el('exportButton').addEventListener('click',()=>{try{const data=snapshot();const blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`zombie-colony-day${game.day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);saveStatus('JSONバックアップを出力しました');}catch(e){saveStatus(e.message);}});
el('importButton').addEventListener('click',()=>el('importFile').click());
el('importFile').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>2_000_000)throw Error('2MB以下のファイルを指定してください');const data=validateSession(await file.text());restoreData(data);await saveNow();saveStatus('バックアップを復元しました');}catch(err){saveStatus('復元失敗：'+err.message);}});
el('newGameButton').addEventListener('click',async()=>{if(!confirm('現在の進行データを消して最初から始めますか？'))return;await clearSnapshots();location.reload();});
const eventCanvas=el('eventCanvas'),eventCtx=eventCanvas.getContext('2d');
function showNextEvent(){if(activeEvent||!eventQueue.length)return;activeEvent=eventQueue.shift();const def=sceneDefinition(activeEvent.kind);el('eventTitle').textContent=def.title;el('eventNarrative').textContent=activeEvent.message||def.desc;el('eventReason').textContent='原因：'+(activeEvent.reason||def.desc);el('eventDay').textContent=`第${activeEvent.day??game.day}日`;el('eventCount').textContent=`残り ${eventQueue.length}件`;el('eventDialog').showModal();eventFrame=requestAnimationFrame(paintActiveEvent);}
function paintActiveEvent(t){if(!activeEvent)return;paintEvent(eventCtx,activeEvent.kind,t,eventCanvas.width,eventCanvas.height);eventFrame=requestAnimationFrame(paintActiveEvent);}
function closeEvent(){if(eventFrame!==null)cancelAnimationFrame(eventFrame);eventFrame=null;activeEvent=null;el('eventDialog').close();showNextEvent();}
el('eventNext').addEventListener('click',closeEvent);
el('eventDemoButton').addEventListener('click',()=>queueScenes(['friendship','warning','police','incident','conversion','loss','research'].map((kind,i)=>({id:'demo-'+i,kind,day:game.day,message:sceneDefinition(kind).desc,reason:'演出確認用デモ（実際のゲーム状態は変化しません）'}))));
el('eventDialog').addEventListener('cancel',e=>{e.preventDefault();closeEvent();});
function queueScenes(events){for(const e of events){if(!['friendship','warning','police','conversion','loss','incident','research','ending'].includes(e.kind))continue;eventQueue.push(e);}if(eventQueue.length>20)eventQueue=eventQueue.slice(-20);showNextEvent();}
function updateEndingPanel(){const completed=colony.completedResearch.includes('impulse'),adapted=colony.completedResearch.includes('adaptation');el('adaptResearchButton').disabled=!completed||adapted;el('adaptResearchButton').textContent=adapted?'社会適応研究 完了':'社会適応研究（180G・資材3）';el('endResearchButton').disabled=!adapted||endingUnlocked;el('endResearchButton').textContent=endingUnlocked?'人間化技術を確立済み':'人間化の最終研究 500G・研究資材5';el('endingActions').hidden=!endingUnlocked;}
el('adaptResearchButton').addEventListener('click',()=>{
 if(!colony.completedResearch.includes('impulse')||colony.completedResearch.includes('adaptation'))return;
 const hasLab=worlds.underground.buildings.some(b=>b.kind==='lab'&&worlds.underground.connectivity?.[b.id]);
 if(!hasLab||game.money<180||colony.inventory.samples<3){saveStatus('社会適応には接続済み研究室、180G、資材3個が必要です');return;}
 game={...game,money:game.money-180};colony={...colony,completedResearch:[...colony.completedResearch,'adaptation'],inventory:{...colony.inventory,samples:colony.inventory.samples-3}};
 updateEconomy();updateEndingPanel();queueScenes([{id:'adapt-'+game.day,kind:'research',day:game.day,message:'社会適応研究が完成。人間化研究へ進めます。',reason:'衝動抑制完了後、研究資金と資材を投資'}]);saveNow();
});
el('endResearchButton').addEventListener('click',()=>{const hasLab=worlds.underground.buildings.some(b=>b.kind==='lab'&&worlds.underground.connectivity?.[b.id]);if(!colony.completedResearch.includes('adaptation')||!hasLab){saveStatus('先に社会適応研究を完了してください');return;}if(game.money<500||colony.inventory.samples<5){saveStatus('人間化研究には500Gと資材5個が必要です');return;}game={...game,money:game.money-500};colony={...colony,inventory:{...colony.inventory,samples:colony.inventory.samples-5}};endingUnlocked=true;updateEconomy();updateEndingPanel();queueScenes([{id:'humanity-tech',kind:'research',day:game.day,message:'人間化技術が完成した。これからの暮らし方を選べる。',reason:'衝動抑制の完成と追加の研究投資'}]);saveNow();});
for(const b of document.querySelectorAll('[data-ending]'))b.addEventListener('click',()=>{const name={'human':'人間復帰','colony':'地下楽園','coexist':'共存'}[b.dataset.ending];queueScenes([{id:'final-'+b.dataset.ending,kind:'ending',day:game.day,message:`${name}エンド：住民たちは自分たちの未来を選んだ。引き続き自由に街を運営できます。`,reason:'人間化研究を完了し、進路を選択した'}]);el('endingResult').textContent=`到達：${name}エンド（継続プレイ可能）`;saveNow();});
el('pauseButton').addEventListener('click',()=>{paused=!paused;el('pauseButton').textContent=paused?'▶ 再開':'Ⅱ 一時停止';});
el('speedButton').addEventListener('click',()=>{speed=speed===1?2:1;el('speedButton').textContent=`${speed}× 速度`;});
updateEconomy();
function render(t){
  const elapsed=lastTime===null?0:Math.min(.25,(t-lastTime)/1000);lastTime=t;
  if(!paused&&!activeEvent){simAccumulator+=elapsed*speed;let updated=false;
    while(simAccumulator>=1){game=stepGame(game);simAccumulator-=1;updated=true;
      if(game.day!==economyDay){
        colony={...colony,inventory:{...colony.inventory,food:colony.inventory.food+game.lastReport.harvest}};
        const labActive=worlds.underground.buildings.some(b=>b.kind==='lab'&&worlds.underground.connectivity?.[b.id]);
        const housing=worlds.underground.buildings.filter(b=>b.kind==='home'&&worlds.underground.connectivity?.[b.id]).length;
        const capacity=5+Math.max(0,housing-1)*2;
        const prevHistoryIds=new Set(social.history.map(e=>e.id)), hadResearch=colony.completedResearch.includes('impulse');
        const daily=advanceColony(game,colony,labActive,capacity);game=daily.game;colony=daily.colony;
        social=recordDeaths(social,game.day,daily.colony.report.deathNames);
        const relation=advanceSocial(social,game,colony,capacity);social=relation.social;game=relation.game;
        if(relation.conversion){colony={...colony,conversionCount:colony.conversionCount+1,nextResidentId:relation.conversion.id+1,inventory:{...colony.inventory,food:colony.inventory.food-2},report:{...colony.report,newFollowerName:relation.conversion.name}};game={...game,events:[...game.events,`${relation.conversion.name}が${relation.conversion.by}の眷属になった`].slice(-12)};}
        game={...game,food:colony.inventory.food};
        const todaysScenes=eventsForDay(0,social,colony,game).filter(e=>(e.kind==='incident'||e.kind==='research'||!prevHistoryIds.has(e.id))&&(e.kind!=='research'||!hadResearch));queueScenes(todaysScenes);updateEndingPanel();
        const bill=propertyBill(rented,owned,game.money);game={...game,money:bill.money};economyDay=game.day;lastRentDue=bill.due;updateResalePanel();updateColonyPanel();saveNow();}
    }
    if(updated)updateEconomy();
  }
  if(bounds.width&&bounds.height){ctx.setTransform(dpr,0,0,dpr,0,0);drawScene(ctx,worlds[state.layer],state.view,state.selected[state.layer],(t-state.started)/1000,bounds,game,placement);}
  raf=requestAnimationFrame(render);
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){cancelAnimationFrame(raf);raf=0;lastTime=null;simAccumulator=0;}
  else if(!raf){lastTime=null;raf=requestAnimationFrame(render);}
});
layerButton();updateResalePanel();updateRentalPanel();updateColonyPanel();updateEndingPanel();loadSnapshot().then(data=>{if(data){restoreData(data);saveStatus('前回の続きから再開しました');}else saveStatus('新しいゲームです。自動保存は毎朝行います。');}).catch(err=>saveStatus('保存領域を使用できません：'+err.message));
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
raf=requestAnimationFrame(render);

// Compact mobile navigation: keep the simulation scene visible while switching sheets.
let currentPanel='map';
function showPanel(id){
 currentPanel=id;
 for(const section of document.querySelectorAll('[data-screen]'))section.hidden=id==='map'||section.dataset.screen!==id;
 const selected=el('selectionPanel');if(selected)selected.hidden=id!=='map'&&id!=='build'&&id!=='property';
 for(const b of document.querySelectorAll('[data-nav]'))b.classList.toggle('active',b.dataset.nav===id||(b.dataset.nav==='more'&&['market','social','property','settings'].includes(id)));
 if(id==='property'&&state.layer!=='surface')switchLayer('surface');
 if(id==='build'&&state.layer!=='underground')switchLayer('underground');
 if(id==='map'&&tool!=='inspect')setTool('inspect');
}
for(const b of document.querySelectorAll('[data-nav]'))b.addEventListener('click',()=>{
 if(b.dataset.nav==='more'){el('moreDialog').showModal();return;}showPanel(b.dataset.nav);
});
for(const b of document.querySelectorAll('[data-more]'))b.addEventListener('click',()=>{el('moreDialog').close();showPanel(b.dataset.more);});
el('moreClose').addEventListener('click',()=>el('moreDialog').close());
const statDescriptions={
 populationValue:()=>`人口 ${game.residents.length}体。住居の定員を超えると眷属化できません。`,
 moneyValue:()=>`共同金庫 ${game.money}G。人間社会で稼ぎ、仕入れ・建設・研究・家賃に使います。`,
 foodValue:()=>`共同食料 ${colony.inventory.food}個。毎朝、住民1体につき1個を配給します。`,
 moodValue:()=>`街の満足度 ${el('moodValue').textContent}。疲労と危険衝動によって変動します。`,
 alertValue:()=>`人間側警戒度 ${game.alert}/100。対人事件や夜間の活動で上昇します。`
};
for(const [id,getDescription] of Object.entries(statDescriptions)){
 const button=el(id).closest('.metrics > div');button.tabIndex=0;button.setAttribute('role','button');button.setAttribute('aria-label',id+'の詳細を表示');
 const open=()=>{el('statsTitle').textContent=button.querySelector('span').textContent;el('statsDetail').textContent=getDescription();el('statsDialog').showModal();};
 button.addEventListener('click',open);button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
}
el('statsClose').addEventListener('click',()=>el('statsDialog').close());
for(const btn of document.querySelectorAll('[data-node]'))btn.addEventListener('click',()=>{
 const id=btn.dataset.node;
 if(id==='impulse'){showPanel('research');el('researchStart').focus();}
 if(id==='adaptation'){showPanel('research');el('adaptResearchButton').focus();}
 if(id==='human'){showPanel('research');el('endResearchButton').focus();}
});
function updateTree(){
 for(const btn of document.querySelectorAll('[data-node]')){
  const id=btn.dataset.node;
  const completed=id==='impulse'?colony.completedResearch.includes('impulse'):id==='adaptation'?colony.completedResearch.includes('adaptation'):endingUnlocked;
  const locked=id==='adaptation'&&!colony.completedResearch.includes('impulse')||id==='human'&&!colony.completedResearch.includes('adaptation');
  btn.classList.toggle('completed',completed);btn.classList.toggle('locked',locked);
  btn.setAttribute('aria-label',btn.textContent.trim()+(completed?' 完了':locked?' 未解放':''));
 }
}
// Tree UI is refreshed by the main render cycle without rebuilding native selectors.
const treeObserver=new MutationObserver(updateTree);treeObserver.observe(el('researchStatus'),{childList:true,characterData:true,subtree:true});
showPanel('map');updateTree();
