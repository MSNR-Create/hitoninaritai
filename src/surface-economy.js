import { RENTALS } from './rentals.js';
import { ROAD_COLUMNS, ROAD_ROWS } from './surface-city.js';

export const PROPERTY_ROLES=Object.freeze({
 apartment:{name:'人間用アパート',detail:'人間が暮らす住宅。入居数が増えると来客と地域の信頼が増える。',capacity:12,base:11},
 market:{name:'商店',detail:'街の人間が買い物をする店。人口と信頼によって毎朝の売上が変化する。',capacity:0,base:24},
 warehouse:{name:'配送倉庫',detail:'ネット販売の梱包・配送拠点。人間の商業活動が盛んなほど売上が伸びる。',capacity:0,base:18},
 clinic:{name:'診療所',detail:'衛生と安心感を生む施設。信頼が高いと収益と地域人気が高まる。',capacity:0,base:14},
 cafe:{name:'街角カフェ',detail:'交流の場。人口と人間との関係が良いほど売上が伸びる。',capacity:0,base:17},
 flats:{name:'集合住宅',detail:'人間の居住地。空室が埋まると周辺の客足が増える。',capacity:16,base:12}
});
/** Fixed, inspectable location score: sidewalks/roads facing a property's perimeter. */
export function propertyLocation(id){
 const property=RENTALS.find(r=>r.id===id);
 if(!property)return null;
 let frontage=0;
 const roads=new Set();
 for(let x=property.x-1;x<=property.x+property.w;x++)for(let y=property.y-1;y<=property.y+property.h;y++){
  const adjacent=(x===property.x-1||x===property.x+property.w)?y>=property.y&&y<property.y+property.h:
    (y===property.y-1||y===property.y+property.h)&&x>=property.x&&x<property.x+property.w;
  if(!adjacent)continue;
  const direct=ROAD_COLUMNS.includes(x)||ROAD_ROWS.includes(y);
  const access=direct||ROAD_COLUMNS.some(c=>Math.abs(c-x)===1)||ROAD_ROWS.some(r=>Math.abs(r-y)===1);
  if(direct){frontage+=2;roads.add(`${x},${y}`);}else if(access)frontage++;
 }
 const accessibility=Math.min(1.25,.72+Math.min(8,frontage)*.065);
 return {frontage,accessibility,grade:frontage>=6?'駅前級':frontage>=3?'通り沿い':frontage>=1?'住宅街':'路地裏'};
}
export function initialSurfaceEconomy(){return {humans:34,trust:55,leasedOut:[],history:[],last:null};}
export function tradeProperty(surface,owned,rented,id,action,money){
 const p=RENTALS.find(r=>r.id===id);if(!p)return {ok:false,reason:'物件が見つかりません'};
 const leasing=surface.leasedOut??[];
 if(action==='lease'){
  if(!owned.includes(id)||leasing.includes(id))return {ok:false,reason:'所有中で、まだ貸していない物件を選んでください'};
  return {ok:true,surface:{...surface,leasedOut:[...leasing,id]},money};
 }
 if(action==='unlease'){
  if(!leasing.includes(id))return {ok:false,reason:'貸し出し中ではありません'};
  return {ok:true,surface:{...surface,leasedOut:leasing.filter(v=>v!==id)},money};
 }
 if(action==='sell'){
  if(!owned.includes(id)||leasing.includes(id))return {ok:false,reason:'所有中の空き物件のみ売却できます（貸出を先に解除）'};
  const sale=Math.floor(p.purchase*.7);
  return {ok:true,surface,owned:owned.filter(v=>v!==id),money:money+sale,sale};
 }
 return {ok:false,reason:'不明な契約操作'};
}
export function advanceSurfaceEconomy(surface,game,owned,rented,day){
 const alert=Math.max(0,Math.min(100,game.alert));
 const leasing=surface.leasedOut??[];
 const active=RENTALS.filter(p=>owned.includes(p.id)||rented.includes(p.id));
 const housing=active.filter(p=>PROPERTY_ROLES[p.id]?.capacity).reduce((n,p)=>n+PROPERTY_ROLES[p.id].capacity,0);
 // v3.0: trust is pulled toward a target set by alert (mean-reverting with daily mood swings) instead of stepping to the bounds.
 const tTarget=78-alert*.75+(active.some(p=>p.id==='clinic')?8:0)+Math.min(8,(surface.city?.lots?Object.values(surface.city.lots).filter(l=>l.facility==='garden').length*4:0));
 const swing=((((day??0)*40503+17)>>>0)%7)-3;
 const trust=Math.max(0,Math.min(100,Math.round(surface.trust+(tTarget-surface.trust)*.18+swing)));
 const target=25+housing+Math.round(trust*.25)-Math.round(alert*.24);
 const humans=Math.max(8,Math.min(160,surface.humans+(surface.humans<target?1:surface.humans>target?-2:0)));
 const visitors=Math.max(2,Math.round(humans*(.32+trust/175)*(1-alert/145)));
 const items=active.map(p=>{
  const role=PROPERTY_ROLES[p.id],isSublet=leasing.includes(p.id);
  const location=propertyLocation(p.id);
  // v3.0 balance: shops compete for the same visitors; the more businesses you run the thinner each one's share.
  const share=1/(1+.1*Math.max(0,active.length-1));const wobble=.85+((((day??0)*31+p.id.length*17)>>>0)%31)/100;
  const gross=isSublet?Math.floor(p.rent*1.15):Math.round(role.base*(.2+visitors/48)*(.35+trust/140)*location.accessibility*share*wobble*2.8);
  const upkeep=isSublet?0:Math.max(3,Math.ceil(gross*.32)+2);
  return {id:p.id,name:p.name,gross,upkeep,net:gross-upkeep,leasedOut:isSublet,location:location.grade,frontage:location.frontage};
 });
 const income=items.reduce((n,p)=>n+p.gross,0),expenses=items.reduce((n,p)=>n+p.upkeep,0);
 const last={day,humans,trust,visitors,income,expenses,net:income-expenses,items};
 return {surface:{...surface,humans,trust,last,history:[...(surface.history??[]),last].slice(-30)},...last};
}
