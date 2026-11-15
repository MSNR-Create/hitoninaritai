// v1.12 フリマ転売エンジン — realistic reseller loop, fully fictional data.
// ネットショップ検索 → 購入 → 配送待ち → 到着・検品（説明違い/偽物の発覚）→ 清掃・整備
// → 撮影・梱包・説明文 → 出品 → 閲覧/いいね/値下げ交渉 → 発送 → 受取評価／クレーム／返品。
// 相場は商品ごとに日々変動し、「SNSでバズ」「再販決定」などのイベントで急騰・暴落する。
// Deterministic: every roll is seeded by day/uid so the simulation is testable.

export const CATALOG=Object.freeze([
 {id:'book',name:'古書セット',category:'本',base:42,vol:.10,unlock:0,fragile:0,fake:0},
 {id:'comic',name:'漫画全巻セット',category:'本',base:150,vol:.18,unlock:0,fragile:0,fake:0},
 {id:'mug',name:'作家物マグ',category:'生活雑貨',base:60,vol:.12,unlock:0,fragile:2,fake:0},
 {id:'shirt',name:'古着シャツ',category:'衣料',base:75,vol:.2,unlock:0,fragile:0,fake:.04},
 {id:'sneaker',name:'限定スニーカー',category:'衣料',base:320,vol:.35,unlock:3,fragile:0,fake:.18},
 {id:'jacket',name:'ブランドジャケット',category:'衣料',base:290,vol:.25,unlock:3.5,fragile:0,fake:.15},
 {id:'card',name:'トレカ未開封BOX',category:'ホビー',base:180,vol:.45,unlock:2,fragile:0,fake:.1},
 {id:'figure',name:'限定フィギュア',category:'ホビー',base:220,vol:.35,unlock:2.5,fragile:1,fake:.12},
 {id:'game',name:'レトロゲームソフト',category:'ホビー',base:120,vol:.25,unlock:0,fragile:0,fake:.05},
 {id:'console',name:'最新ゲーム機',category:'家電',base:520,vol:.4,unlock:4,fragile:2,fake:.02},
 {id:'speaker',name:'中古スピーカー',category:'家電',base:240,vol:.18,unlock:2,fragile:2,fake:0},
 {id:'camera',name:'フィルムカメラ',category:'家電',base:380,vol:.3,unlock:3,fragile:2,fake:0},
 {id:'watch',name:'アンティーク時計',category:'雑貨',base:540,vol:.3,unlock:4,fragile:1,fake:.2},
 {id:'cosme',name:'限定コスメセット',category:'雑貨',base:95,vol:.3,unlock:1,fragile:1,fake:.08}
]);
// メルカリ等で一般的な6段階の状態表記（架空アプリ内）
export const CONDITIONS=Object.freeze({
 new:{name:'新品・未使用',rank:5,factor:1.0},
 mint:{name:'未使用に近い',rank:4,factor:.85},
 good:{name:'目立った傷や汚れなし',rank:3,factor:.72},
 used:{name:'やや傷や汚れあり',rank:2,factor:.55},
 damaged:{name:'傷や汚れあり',rank:1,factor:.38},
 junk:{name:'全体的に状態が悪い・ジャンク',rank:0,factor:.15}
});
const BY_RANK=Object.keys(CONDITIONS).sort((a,b)=>CONDITIONS[a].rank-CONDITIONS[b].rank);
export const SHIPPING=Object.freeze({
 envelope:{name:'封筒・追跡なし',cost:4,safety:0,insured:false,lostRisk:.05},
 anonymous:{name:'匿名配送・段ボール',cost:8,safety:1,insured:false,lostRisk:0},
 insured:{name:'厳重梱包・補償付き',cost:18,safety:2,insured:true,lostRisk:0}
});
export const PHOTOS=Object.freeze({quick:{name:'スマホでサッと',cost:0,views:1},studio:{name:'背景紙で丁寧に撮影',cost:5,views:1.45}});
export const FEE_RATE=.1;
const r=(n)=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);};
export const product=id=>CATALOG.find(p=>p.id===id);
const condShift=(c,d)=>BY_RANK[Math.max(0,Math.min(5,CONDITIONS[c].rank+d))];

// ---------- market value ----------
export function initialFlea(){return {v:2,inventory:[],listings:[],history:[],incoming:[],rating:3,reviews:2,followers:0,nextId:1,trends:Object.fromEntries(CATALOG.map(p=>[p.id,{f:1,event:null,until:0}])),day:1,shop:{day:0,offers:[]},returns:[],refundDebt:0,suspendedUntil:0,log:[]};}
/** v1.8〜1.11 marketDesk → v2. Old conditions used/good/new keep their keys. */
export function migrateFlea(m){
 if(!m)return initialFlea();if(m.v===2)return m;
 const base=initialFlea();
 return {...base,rating:Number.isFinite(m.rating)?m.rating:3,reviews:m.reviews??2,nextId:m.nextId??1,refundDebt:m.refundDebt??0,
  inventory:(m.inventory??[]).map(i=>({uid:i.uid,id:product(i.id)?i.id:'book',condition:CONDITIONS[i.condition]?i.condition:'good',cost:i.cost??0,day:i.day??1,fake:false,cleaned:false})),
  listings:(m.listings??[]).map(l=>({uid:l.uid,id:product(l.id)?l.id:'book',condition:CONDITIONS[l.condition]?l.condition:'good',listedCondition:CONDITIONS[l.condition]?l.condition:'good',cost:l.cost??0,day:l.day??1,fake:false,price:l.price,ship:'anonymous',photo:'quick',listedDay:l.listedDay??1,views:0,likes:0,offer:null})),
  history:(m.history??[]).slice(0,35).map(h=>({...h,status:'closed'}))};
}
/** Market price for a product in a given condition today (G). */
export function marketPrice(m,id,condition='good'){const p=product(id),t=m.trends?.[id]?.f??1;return Math.max(1,Math.round(p.base*t*CONDITIONS[condition].factor));}
export function trendLabel(m,id){const t=m.trends[id];if(t.event==='buzz')return '🔥SNSでバズ中';if(t.event==='restock')return '📉再販決定で暴落';if(t.event==='season')return '🌸季節需要';return t.f>1.12?'↑上昇':t.f<.88?'↓下落':'→横ばい';}
function stepTrends(m,day){
 const trends={},events=[];
 for(const p of CATALOG){const t={...(m.trends[p.id]??{f:1,event:null,until:0})};
  if(t.event&&day>t.until){t.event=null;}
  const roll=r(day*7919+p.base*13);
  if(!t.event&&roll<.035*(.5+p.vol*2)){t.event='buzz';t.until=day+2+Math.floor(r(day+p.base)*3);t.f*=1.55;events.push({kind:'buzz',id:p.id});}
  else if(!t.event&&roll>1-.025*(.5+p.vol*2)){t.event='restock';t.until=day+3;t.f*=.62;events.push({kind:'restock',id:p.id});}
  else if(!t.event&&roll>.48&&roll<.495){t.event='season';t.until=day+4;t.f*=1.2;}
  // random walk with mean reversion toward 1 when no event is active
  const drift=(r(day*131+p.base)-.5)*p.vol*.35;t.f=t.event?t.f*(1+drift*.4):t.f+(1-t.f)*.18+drift;
  t.f=Math.max(.4,Math.min(2.6,Math.round(t.f*1000)/1000));trends[p.id]=t;}
 return {trends,events};
}

// ---------- ネットショップ（仕入れ）----------
const SELLERS=['ふるどうぐ屋','リサイクル北口','まとめ売りの人','引越しセール中','新品倉庫ストア','コレクター卸','ゆるっと出品','ジャンク天国'];
/** Daily deterministic search results. Low price + low seller rating = higher hidden risk. */
export function shopOffers(m,day,category='all'){
 const out=[];
 CATALOG.forEach((p,pi)=>{if(category!=='all'&&p.category!==category)return;
  for(let k=0;k<2;k++){const seed=day*977+pi*61+k*17;if(r(seed)<.35)continue;
   const listed=BY_RANK[1+Math.floor(r(seed+1)*5)];
   const sellerRating=Math.round((2.2+r(seed+2)*2.8)*10)/10;
   const discount=.45+r(seed+3)*.6; // 0.55〜1.10 × 相場
   const price=Math.max(3,Math.round(marketPrice(m,p.id,listed)*discount));
   const ship=r(seed+4)<.5?0:Math.round(5+r(seed+5)*10);
   // hidden truth
   const lie=r(seed+6)<Math.max(0,(4.4-sellerRating)*.15+(discount<.6?.15:0));
   const truth=lie?condShift(listed,r(seed+7)<.8?-1:-2):listed;
   const fake=r(seed+8)<p.fake*(discount<.6?2:.6)*(sellerRating<3.5?1.5:.3);
   out.push({oid:`${day}-${p.id}-${k}`,id:p.id,listed,price,ship,seller:SELLERS[Math.floor(r(seed+9)*SELLERS.length)],sellerRating,photo:r(seed+10)<.4?'ぼやけた写真':'写真多め',truth,fake,stock:1+Math.floor(r(seed+11)*(p.base<40?6:p.base<120?3:1.6)),locked:m.rating<p.unlock});}
 });
 return out;
}
export function offerLeft(m,offer){const got=(m.shop.boughtQty??{})[offer.oid]??((m.shop.bought??[]).includes(offer.oid)?(offer.stock??1):0);return Math.max(0,(offer.stock??1)-got);}
export function buyOffer(m,money,offer,day,qty=1){
 if(!offer)return {ok:false,reason:'商品が見つかりません'};
 if(offer.locked)return {ok:false,reason:`評価★${product(offer.id).unlock}以上で取扱可能`};
 qty=Math.floor(qty);const left=offerLeft(m,offer);if(left<=0)return {ok:false,reason:'この商品は売り切れです'};
 if(!(qty>=1)||qty>left)return {ok:false,reason:`在庫は${left}個までです`};
 const total=offer.price*qty+offer.ship;if(money<total)return {ok:false,reason:`資金不足（${total}G必要）`};
 const arrive=day+1+(r(day*3+offer.price)<.4?1:0);const each=Math.round(total/qty);let id=m.nextId;const parcels=[];
 for(let i=0;i<qty;i++)parcels.push({uid:id++,id:offer.id,listed:offer.listed,condition:offer.truth,fake:offer.fake,cost:i===0?total-each*(qty-1):each,day,arrive,seller:offer.seller,sellerRating:offer.sellerRating});
 const bq=Object.fromEntries(Object.entries(m.shop.boughtQty??{}).filter(([k])=>k.startsWith(day+'-')));bq[offer.oid]=(bq[offer.oid]??0)+qty;
 const bought=[...(m.shop.bought??[]).filter(x=>x.startsWith(day+'-')&&x!==offer.oid),...(left-qty<=0?[offer.oid]:[])];
 return {ok:true,qty,cost:total,money:money-total,market:{...m,nextId:id,incoming:[...m.incoming,...parcels],shop:{...m.shop,bought,boughtQty:bq}}};
}

// ---------- 在庫作業 ----------
export const CLEAN_COST=6;
/** 清掃・整備: 1段階アップを狙う（確率）。ジャンクは修理扱いで高コスト。 */
export function cleanItem(m,money,uid,day){
 const i=m.inventory.find(x=>x.uid===uid);if(!i)return {ok:false,reason:'在庫がありません'};
 if(i.cleaned)return {ok:false,reason:'整備済みです'};
 if(CONDITIONS[i.condition].rank>=4)return {ok:false,reason:'これ以上きれいにできません'};
 const cost=i.condition==='junk'?18:CLEAN_COST;if(money<cost)return {ok:false,reason:`資金不足（${cost}G）`};
 const success=r(uid*31+day*7)<(i.condition==='junk'?.45:.65);
 const condition=success?condShift(i.condition,1):i.condition;
 return {ok:true,cost,success,money:money-cost,market:{...m,inventory:m.inventory.map(x=>x.uid===uid?{...x,condition,cleaned:true,cost:x.cost+cost}:x)}};
}
/** 出品。listedCondition を実際より良く書く（盛る）と高く売れるがクレーム率が跳ね上がる。 */
export function listItem(m,money,uid,{price,listedCondition,ship='anonymous',photo='quick',freePhoto=false},day){
 if(m.suspendedUntil>=day)return {ok:false,reason:`利用制限中（第${m.suspendedUntil}日まで）`};
 const i=m.inventory.find(x=>x.uid===uid);if(!i)return {ok:false,reason:'在庫がありません'};
 const s=SHIPPING[ship],ph=PHOTOS[photo];if(!s||!ph||!CONDITIONS[listedCondition])return {ok:false,reason:'出品設定が不正です'};
 if(!Number.isFinite(price)||price<1||price>99999)return {ok:false,reason:'価格は1〜99999Gで指定'};
 const photoCost=freePhoto?0:ph.cost;if(money<photoCost)return {ok:false,reason:'撮影費が不足しています'};
 const listing={...i,listedCondition,price:Math.round(price),ship,photo,listedDay:day,views:0,likes:0,offer:null};
 return {ok:true,cost:photoCost,money:money-photoCost,market:{...m,inventory:m.inventory.filter(x=>x.uid!==uid),listings:[...m.listings,listing]}};
}
export function changePrice(m,uid,price){if(!Number.isFinite(price)||price<1||price>99999)return {ok:false,reason:'価格が範囲外です'};const l=m.listings.find(x=>x.uid===uid);if(!l)return {ok:false,reason:'出品がありません'};
 // 値下げは「いいね」した人に通知が飛び、閲覧が伸びる
 return {ok:true,market:{...m,listings:m.listings.map(x=>x.uid===uid?{...x,price:Math.round(price),offer:null,boost:price<x.price?1:0}:x)}};}
export function cancelListing(m,uid){const l=m.listings.find(x=>x.uid===uid);if(!l)return {ok:false,reason:'出品がありません'};const {listedCondition,price,ship,photo,listedDay,views,likes,offer,boost,...item}=l;return {ok:true,market:{...m,listings:m.listings.filter(x=>x.uid!==uid),inventory:[...m.inventory,item]}};}
export function disposeItem(m,uid){const i=m.inventory.find(x=>x.uid===uid);if(!i)return {ok:false,reason:'在庫がありません'};return {ok:true,loss:i.cost,market:{...m,inventory:m.inventory.filter(x=>x.uid!==uid),history:[{day:m.day,uid,name:product(i.id).name,price:0,fee:0,ship:0,profit:-i.cost,status:'disposed'},...m.history].slice(0,35)}};}
export function fairPrice(m,id,cond){return marketPrice(m,id,cond);}
export function resolveOffer(m,uid,accept,day){const l=m.listings.find(x=>x.uid===uid);if(!l?.offer)return {ok:false,reason:'交渉はありません'};
 if(!accept)return {ok:true,accepted:false,market:{...m,listings:m.listings.map(x=>x.uid===uid?{...x,offer:null}:x)},money:0};
 const s=sell(m,l,l.offer,day);return {ok:true,accepted:true,...s};}
function sell(m,l,price,day,shipCut=0){const p=product(l.id),fee=Math.ceil(price*FEE_RATE),ship=Math.max(1,SHIPPING[l.ship].cost-shipCut);
 const sale={uid:l.uid,id:l.id,name:p.name,day,price,fee,ship,cost:l.cost,profit:price-fee-ship-l.cost,condition:l.condition,listedCondition:l.listedCondition,fake:l.fake,shipMethod:l.ship,status:'shipping',deliverDay:day+1,review:null};
 return {market:{...m,listings:m.listings.filter(x=>x.uid!==l.uid),history:[sale,...m.history].slice(0,35)},money:price-fee-ship,sale};}

// ---------- 1日の更新 ----------
/** Returns {market, money, sales, arrivals, claims, events, offers}. money = net cash change. */
export function advanceFlea(m0,day,trust=50,fx={}){
 const viewMul=fx.fleaViewMul??1,shipCut=fx.shipDiscount??0,noLoss=!!fx.noLoss;
 let m={...m0,day,listings:m0.listings.map(x=>({...x})),history:m0.history.map(x=>({...x}))};
 const out={money:0,sales:[],arrivals:[],claims:[],events:[],offers:[],refunds:[]};
 const tr=stepTrends(m,day);m.trends=tr.trends;m.hist=Object.fromEntries(CATALOG.map(p=>[p.id,[...((m0.hist??{})[p.id]??[]),tr.trends[p.id].f].slice(-14)]));
 for(const e of tr.events)out.events.push({kind:e.kind==='buzz'?'flea_buzz':'flea_crash',id:e.id,message:e.kind==='buzz'?`${product(e.id).name}がSNSでバズって相場が急騰！`:`${product(e.id).name}の再販が決定し相場が暴落…`,held:m.inventory.concat(m.listings).filter(x=>x.id===e.id).length});
 // arrivals & inspection
 const arrived=m.incoming.filter(p=>p.arrive<=day);m.incoming=m.incoming.filter(p=>p.arrive>day);
 for(const p of arrived){const item={uid:p.uid,id:p.id,condition:p.condition,cost:p.cost,day,fake:p.fake,cleaned:false};m.inventory=[...m.inventory,item];
  const worse=CONDITIONS[p.condition].rank<CONDITIONS[p.listed].rank;
  out.arrivals.push({...p,worse});
  if(p.fake)out.events.push({kind:'flea_fake',uid:p.uid,message:`届いた${product(p.id).name}は精巧な偽物だった…（${p.seller}）`});
  else if(worse)out.events.push({kind:'flea_mismatch',uid:p.uid,message:`${product(p.id).name}：「${CONDITIONS[p.listed].name}」のはずが「${CONDITIONS[p.condition].name}」だった`});}
 // deliveries → reviews / claims
 for(const s of m.history){if(s.status!=='shipping'||s.deliverDay>day)continue;
  const seed=s.uid*977+day*31,ship=SHIPPING[s.shipMethod];const p=product(s.id);
  const gap=CONDITIONS[s.listedCondition].rank-CONDITIONS[s.condition].rank;
  let claim=null;
  if(s.fake&&r(seed)<.7)claim={type:'fake',text:'偽物では？と通報された'};
  else if(!noLoss&&ship.lostRisk&&r(seed+1)<ship.lostRisk)claim={type:'lost',text:'「届かない」と連絡が来た'};
  else if(gap>0&&r(seed+2)<.35+gap*.25)claim={type:'mismatch',text:'「説明と状態が違う」とクレーム'};
  else if(r(seed+3)<p.fragile*.035*(2-ship.safety))claim={type:'broken',text:'「配送中に破損していた」とクレーム'};
  if(claim){const covered=ship.insured&&claim.type==='broken';const refund=covered?0:s.price;
   s.status='claim';s.claim=claim.type;s.profit-=refund;s.review=1;out.money-=refund;out.refunds.push({uid:s.uid,name:s.name,amount:refund});
   m.rating=Math.max(0,Math.round(((m.rating*m.reviews+1)/(m.reviews+1))*100)/100);m.reviews++;
   // 返品された実物は手元に戻る（破損品は2段階劣化）。偽物・紛失は戻らない。
   if((claim.type==='mismatch'||claim.type==='broken')&&!covered){m.inventory=[...m.inventory,{uid:s.uid,id:s.id,condition:claim.type==='broken'?condShift(s.condition,-2):s.condition,cost:s.cost,day,fake:s.fake,cleaned:true}];s.profit+=s.cost;}
   if(claim.type==='fake'){m.suspendedUntil=day+3;}
   out.claims.push({...s,claim:claim.type});
   out.events.push({kind:'flea_claim',uid:s.uid,message:`${s.name}：${claim.text}${covered?'（配送補償で全額カバー）':`。${refund}G を返金`}${claim.type==='fake'?'。アカウントが3日間利用制限に…':''}`});
  }else{const fair=marketPrice(m,s.id,s.condition);const review=Math.max(3,Math.min(5,Math.round(4+(ship.safety-1)*.5+(s.price<=fair?.7:-.3)+(r(seed+4)-.5))));
   s.status='done';s.review=review;m.rating=Math.round(((m.rating*m.reviews+review)/(m.reviews+1))*100)/100;m.reviews++;
   if(review===5&&r(seed+5)<.35){m.followers=(m.followers??0)+1;out.events.push({kind:'flea_good',uid:s.uid,message:`${s.name}の購入者から★5「梱包が丁寧で最高でした！」フォロワー+1`});}}
 }
 // listings: views → likes → sale / offer
 const suspended=m.suspendedUntil>=day;
 for(const l of [...m.listings]){if(suspended)break;
  if(l.offer&&day<=(l.offerDay??day)){out.offers.push(l);continue;}
  if(l.offer){l.offer=null;}
  const fair=marketPrice(m,l.id,l.listedCondition),rel=l.price/fair;const seed=l.uid*101+day*37;
  const views=Math.round((8+r(seed)*20)*PHOTOS[l.photo].views*viewMul*(1+(m.followers??0)*.05)*(l.boost?1.6:1)*Math.max(.3,1.4-rel*.5));
  l.views+=views;l.likes+=Math.round(views*Math.max(0,1.25-rel)*.25);l.boost=0;
  const pSell=Math.max(.02,Math.min(.92,(1.3-rel)*.85+.12+(viewMul-1)*.25+(m.rating-3)*.06+(trust-50)/500+Math.min(.15,l.likes*.01)));
  const roll=r(seed+1);
  if(roll<pSell){const s=sell(m,l,l.price,day,shipCut);m=s.market;out.money+=s.money;out.sales.push(s.sale);
   if(s.sale.profit>=120)out.events.push({kind:'flea_jackpot',uid:l.uid,message:`${s.sale.name}が${s.sale.price}Gで売れた！ 利益 +${s.sale.profit}G`});}
  else if(l.likes>=2&&roll<pSell+.3){const ask=Math.max(1,Math.round(l.price*(.7+r(seed+2)*.15)));m.listings=m.listings.map(x=>x.uid===l.uid?{...x,views:l.views,likes:l.likes,offer:ask,offerDay:day+1}:x);out.offers.push({...l,offer:ask});}
  else m.listings=m.listings.map(x=>x.uid===l.uid?{...x,views:l.views,likes:l.likes,boost:0}:x);
 }
 // まとめ買い: occasionally a fan buys a second listing the same day
 if(out.sales.length===1&&m.listings.length&&(m.followers??0)>=2&&r(day*53)<.25){const l=m.listings[0];const s=sell(m,l,Math.round(l.price*.95),day);m=s.market;out.money+=s.money;out.sales.push(s.sale);out.events.push({kind:'flea_good',uid:l.uid,message:`フォロワーから「まとめて買います！」${s.sale.name}も売れた`});}
 m.returns=[...(m.returns??[]),...out.refunds.map(x=>({...x,day}))].slice(-30);
 return {market:m,...out};
}
export function fleaSummary(m){return {profit:m.history.reduce((a,x)=>a+(x.profit??0),0),stock:m.inventory.length,listed:m.listings.length,incoming:m.incoming.length,shipping:m.history.filter(h=>h.status==='shipping').length};}
