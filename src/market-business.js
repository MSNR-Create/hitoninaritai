// Deterministic, turn-based marketplace simulation. No external catalogue or prices.
export const CATALOG=Object.freeze([
 {id:'book',name:'古書セット',category:'本',cost:16,base:39,volatility:.16,unlock:0},
 {id:'mug',name:'陶器マグ',category:'生活雑貨',cost:23,base:55,volatility:.13,unlock:0},
 {id:'shirt',name:'古着シャツ',category:'衣料',cost:28,base:73,volatility:.26,unlock:0},
 {id:'game',name:'レトロゲーム',category:'ホビー',cost:51,base:122,volatility:.3,unlock:2},
 {id:'lamp',name:'卓上ライト',category:'家電',cost:39,base:93,volatility:.2,unlock:2},
 {id:'comic',name:'漫画全巻セット',category:'本',cost:64,base:148,volatility:.27,unlock:2.5},
 {id:'figure',name:'限定フィギュア',category:'ホビー',cost:85,base:210,volatility:.42,unlock:3},
 {id:'speaker',name:'中古スピーカー',category:'家電',cost:105,base:235,volatility:.22,unlock:3},
 {id:'jacket',name:'ブランド古着',category:'衣料',cost:120,base:285,volatility:.32,unlock:3.5},
 {id:'camera',name:'フィルムカメラ',category:'家電',cost:170,base:385,volatility:.4,unlock:4},
 {id:'watch',name:'アンティーク時計',category:'雑貨',cost:215,base:530,volatility:.45,unlock:4},
 {id:'console',name:'レトロゲーム機',category:'ホビー',cost:260,base:590,volatility:.28,unlock:4.5}
]);
export const BOXES=Object.freeze({simple:{name:'簡易',cost:3,safety:0},standard:{name:'標準',cost:9,safety:1},premium:{name:'厳重',cost:20,safety:2}});
export const CONDITIONS=Object.freeze({used:{name:'使用感あり',factor:.80},good:{name:'良好',factor:1},new:{name:'未使用級',factor:1.22}});
function noise(n){const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x)}
function product(id){return CATALOG.find(p=>p.id===id)}
export function marketQuote(id,day,trust=50){const p=product(id);if(!p)return null;const demand=Math.max(.55,Math.min(1.65,1+(noise(day*19+p.base)-.5)*p.volatility*2+(trust-50)/380));return {demand,estimated:Math.round(p.base*demand),sellers:Math.round(5+noise(day*9+p.cost)*20),popularity:demand>1.16?'人気急上昇':demand<.86?'需要低迷':'通常需要'};}
export function initialMarketDesk(){return {inventory:[],listings:[],history:[],rating:2.5,reviews:2,nextId:1,researchDay:0,negotiation:null};}
export function inspectMarket(m,day){return {...m,researchDay:day};}
export function sourceItem(m,money,id,condition='good',day=1){const p=product(id),c=CONDITIONS[condition];if(!p||!c)return {ok:false,reason:'商品情報が不正です'};if(m.rating<p.unlock)return {ok:false,reason:`評価★${p.unlock}以上で取扱可能`};const price=Math.round(p.cost*c.factor*(.9+noise(day*3+p.base)*.2));if(money<price)return {ok:false,reason:`資金不足：仕入れには${price}G必要です`};const entry={uid:m.nextId,id,condition,cost:price,day};return {ok:true,price,market:{...m,nextId:m.nextId+1,inventory:[...m.inventory,entry]},money:money-price};}
export function listItem(m,money,uid,box,price,day,auto=false){const i=m.inventory.find(a=>a.uid===uid),b=BOXES[box],p=product(i?.id);if(!i||!b||!p)return {ok:false,reason:'在庫または梱包指定がありません'};if(!Number.isFinite(price)||price<1||price>99999)return {ok:false,reason:'価格を1〜99999Gで指定してください'};if(money<b.cost)return {ok:false,reason:`梱包代${b.cost}Gが不足しています`};const listing={...i,box,price:Math.round(price),auto,listedDay:day,days:0,offer:null};return {ok:true,packingCost:b.cost,market:{...m,inventory:m.inventory.filter(a=>a.uid!==uid),listings:[...m.listings,listing]},money:money-b.cost};}
export function autoPrice(id,condition,day,trust=50){const q=marketQuote(id,day,trust);return Math.max(1,Math.round(q.estimated*CONDITIONS[condition].factor*.96));}
export function changePrice(m,uid,price,auto=false){if(!Number.isFinite(price)||price<1||price>99999)return {ok:false,reason:'価格が範囲外です'};if(!m.listings.some(i=>i.uid===uid))return {ok:false,reason:'出品がありません'};return {ok:true,market:{...m,listings:m.listings.map(i=>i.uid===uid?{...i,price:Math.round(price),auto,offer:null}:i)}};}
export function cancelListing(m,uid){const listing=m.listings.find(x=>x.uid===uid);if(!listing)return {ok:false,reason:'出品がありません'};return {ok:true,market:{...m,listings:m.listings.filter(x=>x.uid!==uid),inventory:[...m.inventory,{uid:listing.uid,id:listing.id,condition:listing.condition,cost:listing.cost,day:listing.day}]}};}
function finishSale(m,listing,price,day){const p=product(listing.id),q=marketQuote(listing.id,day),fair=autoPrice(p.id,listing.condition,day);const fee=Math.ceil(price*.1),income=price-fee;const safety=BOXES[listing.box].safety;const review=Math.max(1,Math.min(5,Math.round(3+(safety-1)+(listing.condition==='new'?1:listing.condition==='used'?-1:0)+(price<=fair?1:price>fair*1.25?-1:0))));const rating=Math.round(((m.rating*m.reviews+review)/(m.reviews+1))*100)/100;
 const sale={day,id:listing.id,name:p.name,price,fee,profit:income-listing.cost-BOXES[listing.box].cost,review,uid:listing.uid,condition:listing.condition};
 return {market:{...m,listings:m.listings.filter(x=>x.uid!==listing.uid),rating,reviews:m.reviews+1,history:[sale,...m.history].slice(0,35),negotiation:null},money:income,fee,sale};}
export function resolveOffer(m,uid,accept,day){const listing=m.listings.find(x=>x.uid===uid);if(!listing?.offer)return {ok:false,reason:'交渉対象がありません'};if(accept){const sold=finishSale(m,listing,listing.offer,day);return {ok:true,...sold,accepted:true};}return {ok:true,market:{...m,listings:m.listings.map(x=>x.uid===uid?{...x,offer:null,days:x.days+1}:x),negotiation:null},money:0,accepted:false};}
export function advanceMarket(m,day,trust=50){let next={...m,listings:m.listings.map(x=>({...x})),negotiation:null},money=0,sales=[],offers=[];
 for(const l of [...next.listings]){
  if(l.offer){offers.push(l);next.negotiation=next.negotiation??l.uid;continue;}
  const fair=autoPrice(l.id,l.condition,day,trust);if(l.auto){l.price=fair;}
  l.days+=1;const relative=l.price/fair,roll=noise(day*37+l.uid*101+l.price*.019);
  const probability=Math.max(.025,Math.min(.9,(1.22-relative)*.82+.28+(trust-50)/400));
  if(roll<probability){const sold=finishSale(next,l,l.price,day);next=sold.market;money+=sold.money;sales.push(sold.sale);}
  else if(relative>=1.05&&roll<probability+.23&&l.days>=1){l.offer=Math.max(1,Math.round(l.price*(.75+noise(day+l.uid)*.12)));offers.push({...l});next.negotiation=next.negotiation??l.uid;}
 }
 return {market:next,money,sales,offers};
}
export function marketSummary(m){const spent=m.history.reduce((a,x)=>a+x.profit,0);return {profit:spent,completed:m.history.length,pending:m.listings.length,stock:m.inventory.length};}
