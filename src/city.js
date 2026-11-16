// v2.0-A town building: prosperity, housing-capped population growth, district unlocks
// (ZDL-SD-020 §7) and player-usable vacant lots (空き地) on the surface.
export const DISTRICTS=Object.freeze([
 {id:'old_town',name:'旧市街',need:null,invest:0,housing:55,desc:'最初からある街。空き地4区画。'},
 {id:'commerce',name:'商業通り',need:{pop:45,prosperity:50,trust:45,alertBelow:70},invest:400,housing:35,desc:'東へ大通りが延び、ショッピングモールが開業。空き地+1・自販機が設置可能に。'},
 {id:'residential',name:'住宅新街区',need:{pop:75,prosperity:58,trust:52,alertBelow:65},invest:650,housing:60,desc:'南の丘に曲がりくねった坂道と新しい住宅地。空き地+1・家庭菜園が設置可能に。'},
 {id:'logistics',name:'物流街区',need:{pop:110,prosperity:62,trust:55,alertBelow:60},invest:900,housing:70,desc:'東に物流センターと搬入路。空き地+1・光回線が引けるように。'},
 {id:'parkland',name:'公園緑地',need:{pop:140,prosperity:65,trust:60,alertBelow:55},invest:1200,housing:60,desc:'森と池を残した大きな公園。人間の信頼が上がりやすくなる。'},
 {id:'station',name:'駅前再開発',need:{pop:180,prosperity:70,trust:62,alertBelow:55},invest:1800,housing:90,desc:'南に新駅とロータリー。来客と人口が大きく伸びる。'},
 {id:'business',name:'高層ビジネス街',need:{pop:230,prosperity:75,trust:65,alertBelow:50},invest:2600,housing:110,desc:'南東に高層オフィス群。地上事業の売上が伸びる。'},
 {id:'metropolis',name:'大都市',need:{pop:300,prosperity:82,trust:70,alertBelow:45},invest:4000,housing:160,desc:'ホテルとタワーが並ぶ大都市に。街の最終段階。'}
]);
// v3.5: what each district physically adds to the 32×32 surface. Outside the original 24×24 town the land is
// wilderness (forest/meadow/pond) until a district develops it; roads are not limited to the grid.
const R=(x0,y0,x1,y1)=>{const a=[];for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)a.push([x,y]);return a;};
export const DISTRICT_FEATURES={
 commerce:{roads:[...R(24,8,31,9)],buildings:[{kind:'mall',x:25,y:3,w:4,h:4,name:'ショッピングモール'},{kind:'market',x:29,y:4,w:3,h:3,name:'専門店'}]},
 residential:{roads:[...R(8,24,9,26),...R(10,26,11,27),...R(12,27,13,28),...R(14,28,15,29)],buildings:[{kind:'humanHome',x:2,y:25,w:3,h:3,name:'丘の住宅'},{kind:'humanHome',x:5,y:28,w:3,h:3,name:'丘の住宅'},{kind:'school',x:10,y:29,w:4,h:3,name:'小学校'}]},
 logistics:{roads:[...R(26,10,27,16)],buildings:[{kind:'warehouse',x:28,y:11,w:4,h:4,name:'物流センター'},{kind:'warehouse',x:24,y:11,w:2,h:3,name:'搬入倉庫'}]},
 parkland:{park:[...R(24,17,31,23)],buildings:[]},
 station:{roads:[...R(16,24,17,31),...R(18,24,23,25)],buildings:[{kind:'station',x:18,y:27,w:5,h:3,name:'新駅'},{kind:'cafe',x:18,y:30,w:3,h:2,name:'駅ナカカフェ'}]},
 business:{roads:[...R(24,24,31,25)],buildings:[{kind:'office',x:25,y:26,w:3,h:3,name:'オフィスタワー'},{kind:'office',x:29,y:26,w:3,h:3,name:'金融ビル'},{kind:'office',x:25,y:29,w:3,h:3,name:'IT企業ビル'}]},
 metropolis:{roads:[],buildings:[{kind:'hotel',x:29,y:29,w:3,h:3,name:'グランドホテル'},{kind:'mall',x:0,y:28,w:4,h:4,name:'駅前百貨店'},{kind:'office',x:24,y:0,w:4,h:3,name:'ランドマークタワー'}]}
};
/** Surface additions for the developed districts: roads, buildings, park; plus wilderness tiles still untouched. */
export function cityLayer(city){
 const roads=new Set(),buildings=[],park=new Set(),used=new Set();
 for(const d of DISTRICTS){if(!city.districts.includes(d.id))continue;const f=DISTRICT_FEATURES[d.id];if(!f)continue;
  for(const [x,y] of f.roads??[]){roads.add(x+','+y);used.add(x+','+y);}for(const [x,y] of f.park??[])park.add(x+','+y);
  f.buildings.forEach((b,i)=>{buildings.push({id:`dist-${d.id}-${i}`,...b});for(let x=b.x;x<b.x+b.w;x++)for(let y=b.y;y<b.y+b.h;y++)used.add(x+','+y);});}
 return {roads,buildings,park,used};}

export const LOTS=Object.freeze([
 {id:'lot-a',x:3,y:0,w:2,h:2,district:'old_town'},{id:'lot-b',x:21,y:0,w:2,h:2,district:'old_town'},
 {id:'lot-c',x:0,y:5,w:2,h:2,district:'old_town'},{id:'lot-d',x:21,y:5,w:2,h:2,district:'old_town'},
 {id:'lot-e',x:0,y:2,w:2,h:2,district:'commerce'},{id:'lot-f',x:5,y:21,w:2,h:2,district:'residential'},
 {id:'lot-g',x:21,y:18,w:2,h:2,district:'logistics'}
]);
// Lot facilities. Wi-Fi is a 3-step ladder that starts as "free-riding a neighbour's open Wi-Fi".
export const LOT_FACILITIES=Object.freeze({
 leech:{name:'こっそりアンテナ（回線ただ乗り）',icon:'📶',cost:15,upkeep:0,needsLease:false,district:'old_town',desc:'近所の鍵なしWi-Fiに勝手に相乗り。フリマ閲覧+15%。毎日8%でバレて警戒+4・信頼−3、アンテナ撤去。',view:1.15},
 router:{name:'格安モバイルルーター',icon:'📡',cost:60,upkeep:3,needsLease:true,district:'old_town',desc:'正規契約の回線。フリマ閲覧+25%・撮影費無料。',view:1.25,from:'leech'},
 fiber:{name:'光回線＋作業小屋',icon:'🛜',cost:220,upkeep:7,needsLease:true,district:'logistics',desc:'高速回線と撮影ブース。フリマ閲覧+45%・撮影費無料・送料−2G。',view:1.45,from:'router'},
 vending:{name:'自動販売機',icon:'🥤',cost:80,upkeep:1,needsLease:true,district:'commerce',desc:'人口と信頼に応じて毎日売上（目安6〜20G）。',income:true},
 lockers:{name:'宅配ロッカー',icon:'📦',cost:90,upkeep:1,needsLease:true,district:'old_town',desc:'発送が楽に。フリマ送料−3G・紛失ゼロ。'},
 garden:{name:'家庭菜園',icon:'🥬',cost:60,upkeep:0,needsLease:true,district:'residential',desc:'毎朝 食料+2。人間からの印象も良い（信頼+0.2/日）。'}
});
export const LEASE={deposit:30,daily:2};
export function initialCity(){return {prosperity:48,districts:['old_town'],lots:{},history:[]};}
export function ensureCity(surface){return surface.city?surface:{...surface,city:initialCity()};}
export const lotAt=(x,y)=>LOTS.find(l=>x>=l.x&&x<l.x+l.w&&y>=l.y&&y<l.y+l.h);
export function lotOpen(city,lot){return city.districts.includes(lot.district);}
export function housingCapacity(city,extra=0){return DISTRICTS.filter(d=>city.districts.includes(d.id)).reduce((n,d)=>n+d.housing,0)+extra;}
/** Effects from built lot facilities for other systems. */
export function lotEffects(city){
 const built=Object.values(city.lots??{}).map(l=>l.facility).filter(Boolean);
 const view=Math.max(1,...built.map(f=>LOT_FACILITIES[f]?.view??1));
 return {fleaViewMul:view,freePhoto:built.includes('router')||built.includes('fiber'),shipDiscount:(built.includes('fiber')?2:0)+(built.includes('lockers')?3:0),noLoss:built.includes('lockers'),food:built.filter(f=>f==='garden').length*2,leeching:built.includes('leech')};
}
export function leaseLot(city,money,lotId){const lot=LOTS.find(l=>l.id===lotId);if(!lot)return {ok:false,reason:'空き地が見つかりません'};
 if(!lotOpen(city,lot))return {ok:false,reason:`${DISTRICTS.find(d=>d.id===lot.district).name}の解放が必要です`};
 if(city.lots[lotId]?.leased)return {ok:false,reason:'契約済みです'};if(money<LEASE.deposit)return {ok:false,reason:`敷金${LEASE.deposit}Gが必要です`};
 return {ok:true,cost:LEASE.deposit,money:money-LEASE.deposit,city:{...city,lots:{...city.lots,[lotId]:{...(city.lots[lotId]??{}),leased:true}}}};}
export function buildOnLot(city,money,lotId,kind){const lot=LOTS.find(l=>l.id===lotId),f=LOT_FACILITIES[kind];if(!lot||!f)return {ok:false,reason:'設置できません'};
 const cur=city.lots[lotId]??{};
 if(!lotOpen(city,lot))return {ok:false,reason:'この空き地の街区はまだ未解放です'};
 if(!city.districts.includes(f.district))return {ok:false,reason:`${DISTRICTS.find(d=>d.id===f.district).name}の解放が必要です`};
 if(f.needsLease&&!cur.leased)return {ok:false,reason:'先に空き地を借りてください'};
 if(f.from&&cur.facility!==f.from&&!(kind==='fiber'&&cur.facility==='router'))return {ok:false,reason:`${LOT_FACILITIES[f.from].name}からのアップグレードです`};
 if(!f.from&&cur.facility)return {ok:false,reason:'すでに設備があります（撤去してから）'};
 if(kind!=='leech'&&kind!=='router'&&kind!=='fiber'&&Object.values(city.lots).some(l=>l.facility===kind))return {ok:false,reason:'同じ設備は街に1つまで'};
 if(['leech','router','fiber'].includes(kind)&&!f.from&&Object.values(city.lots).some(l=>['leech','router','fiber'].includes(l.facility)))return {ok:false,reason:'回線は1か所で十分です'};
 if(money<f.cost)return {ok:false,reason:`資金不足（${f.cost}G）`};
 return {ok:true,cost:f.cost,money:money-f.cost,city:{...city,lots:{...city.lots,[lotId]:{...cur,facility:kind,since:0}}}};}
export function clearLot(city,lotId){const cur=city.lots[lotId];if(!cur?.facility)return {ok:false,reason:'設備がありません'};return {ok:true,city:{...city,lots:{...city.lots,[lotId]:{...cur,facility:null}}}};}
export function releaseLot(city,lotId){const cur=city.lots[lotId];if(!cur?.leased)return {ok:false,reason:'契約していません'};if(cur.facility&&LOT_FACILITIES[cur.facility].needsLease)return {ok:false,reason:'設備を撤去してから解約'};return {ok:true,city:{...city,lots:{...city.lots,[lotId]:{...cur,leased:false}}}};}
const rr=n=>{const x=Math.sin(n*45.31+2.1)*43758.5453;return x-Math.floor(x);};
/**
 * Daily city update. surface:{humans,trust,city}, alert, extras:{ownedHousing,businesses}
 * returns {surface, money, food, alert, trust, events, unlocked}
 */
export function advanceCity(surface0,alert,day,{ownedHousing=0,businesses=0}={}){
 const surface=ensureCity(surface0);let city={...surface.city,lots:{...surface.city.lots}};const events=[];let money=0,food=0,alertAdd=0,trustAdd=0;
 const cap=housingCapacity(city,ownedHousing);
 // lots: upkeep, income, leeching risk
 for(const [id,l] of Object.entries(city.lots)){
  if(l.leased)money-=LEASE.daily;
  const f=l.facility&&LOT_FACILITIES[l.facility];if(!f)continue;money-=f.upkeep;
  if(l.facility==='vending')money+=Math.round(4+surface.humans*.12*(surface.trust/60)*(1-alert/150)+rr(day*7+id.length)*4);
  if(l.facility==='garden'){food+=2;trustAdd+=.2;}
  if(l.facility==='leech'&&rr(day*13+id.charCodeAt(4))<.08){city.lots[id]={...l,facility:null};alertAdd+=4;trustAdd-=3;events.push({kind:'wifi_caught',message:'回線ただ乗りがバレた！ 隣人がWi-Fiにパスワードを設定し、アンテナを撤去された…',reason:'鍵のかかっていない回線への無断接続'});}
 }
 const housingFill=Math.min(100,surface.humans/cap*130);
 const employment=Math.min(100,40+businesses*12);
 const target=Math.max(0,Math.min(100,.3*housingFill+.22*employment+.26*surface.trust+.22*(100-alert)));
 const prosperity=Math.max(0,Math.min(100,Math.round((city.prosperity+Math.max(-3,Math.min(3,(target-city.prosperity)*.15)))*10)/10));
 const delta=Math.max(-3,Math.min(4,Math.floor((prosperity-40)/15+(surface.trust-45)/25-alert/50)));
 const humans=Math.max(20,Math.min(cap,surface.humans+delta));
 const trust=Math.max(0,Math.min(100,Math.round(surface.trust+trustAdd)));
 city.prosperity=prosperity;
 // district unlocks (irreversible)
 for(const d of DISTRICTS){if(!d.need||city.districts.includes(d.id))continue;const n=d.need;
  // v3.5: conditions only make the district READY; the colony must fund the development (money sink).
  const ok=humans>=n.pop&&prosperity>=n.prosperity&&trust>=n.trust&&alert<n.alertBelow;
  if(ok&&city.ready!==d.id){city.ready=d.id;events.push({kind:'district',id:d.id,message:`「${d.name}」の開発計画が持ち上がった！ ${d.invest}Gを出資すると開発が始まります（街の発展パネル）。`,reason:`人口${humans}・繁栄${Math.round(prosperity)}・信頼${trust}・警戒${alert}`});}
  break;}
 city.history=[...(city.history??[]),{day,humans,prosperity:Math.round(prosperity)}].slice(-30);
 return {surface:{...surface,humans,trust,city},money,food,alertAdd,events};
}
export function investDistrict(city,money){const d=nextDistrict(city);if(!d)return {ok:false,reason:'すべて開発済みです'};if(city.ready!==d.id)return {ok:false,reason:'開発条件をまだ満たしていません'};if(money<d.invest)return {ok:false,reason:`資金不足（${d.invest}G）`};
 return {ok:true,cost:d.invest,money:money-d.invest,district:d,city:{...city,ready:null,districts:[...city.districts,d.id]}};}
export function nextDistrict(city){return DISTRICTS.find(d=>d.need&&!city.districts.includes(d.id));}
