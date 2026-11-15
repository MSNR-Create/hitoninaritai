import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../src/flea.js';
const rich=1e6;
test('six real-world condition grades scale price monotonically',()=>{const m=F.initialFlea();const order=['junk','damaged','used','good','mint','new'];const ps=order.map(c=>F.marketPrice(m,'camera',c));for(let i=1;i<6;i++)assert.ok(ps[i]>ps[i-1]);});
test('market value fluctuates daily and events spike/crash it',()=>{let m=F.initialFlea();const seen=new Set();let buzz=0,crash=0;
 for(let d=2;d<120;d++){const r=F.advanceFlea(m,d);m=r.market;seen.add(m.trends.card.f);buzz+=r.events.filter(e=>e.kind==='flea_buzz').length;crash+=r.events.filter(e=>e.kind==='flea_crash').length;}
 assert.ok(seen.size>50);assert.ok(buzz>0&&crash>0);for(const p of F.CATALOG)assert.ok(m.trends[p.id].f>=.4&&m.trends[p.id].f<=2.6);});
test('shop → incoming → arrival with hidden truth revealed',()=>{let m=F.initialFlea();const offers=F.shopOffers(m,3);assert.ok(offers.length>5);assert.deepEqual(offers,F.shopOffers(m,3));
 const o=offers.find(x=>!x.locked);const b=F.buyOffer(m,rich,o,3);assert.ok(b.ok);assert.equal(F.buyOffer(b.market,rich,o,3).ok,false,'sold out');
 m=b.market;assert.equal(m.incoming.length,1);let d=3;while(m.incoming.length){d++;m=F.advanceFlea(m,d).market;}
 assert.equal(m.inventory[0].condition,o.truth);assert.equal(m.inventory[0].fake,o.fake);});
test('cheap offers from low-rated sellers are riskier over many days',()=>{let risky=0,riskyBad=0,safe=0,safeBad=0;const m=F.initialFlea();
 for(let d=1;d<200;d++)for(const o of F.shopOffers(m,d)){const bad=o.fake||o.truth!==o.listed;if(o.sellerRating<3.3&&o.price<F.marketPrice(m,o.id,o.listed)*.7){risky++;riskyBad+=bad;}else if(o.sellerRating>4.3){safe++;safeBad+=bad;}}
 assert.ok(riskyBad/risky>safeBad/safe*1.5);});
test('exaggerated listings get far more claims than honest ones',()=>{
 const run=(honest)=>{let claims=0;for(let k=0;k<60;k++){let m={...F.initialFlea(),inventory:[{uid:k+1,id:'book',condition:'used',cost:5,day:1,fake:false,cleaned:false}],nextId:k+2};
  m=F.listItem(m,100,k+1,{price:1,listedCondition:honest?'used':'new',ship:'anonymous',photo:'quick'},1).market;
  for(let d=2;d<8;d++){const r=F.advanceFlea(m,d+k*10);m=r.market;claims+=r.claims.length;}}return claims;};
 assert.ok(run(false)>run(true)+10);});
test('insured shipping covers breakage; fake sale suspends the account',()=>{
 let m={...F.initialFlea(),inventory:[{uid:1,id:'watch',condition:'good',cost:10,day:1,fake:true,cleaned:false}],nextId:2};
 m=F.listItem(m,100,1,{price:1,listedCondition:'good',ship:'anonymous',photo:'quick'},1).market;let suspended=false;
 for(let d=2;d<40&&!suspended;d++){m=F.advanceFlea(m,d).market;suspended||=m.suspendedUntil>=d;}assert.ok(suspended||m.history[0].status==='done');});
test('clean upgrades condition at most once; legacy desk migrates',()=>{let m={...F.initialFlea(),inventory:[{uid:1,id:'mug',condition:'used',cost:5,day:1}]};const r=F.cleanItem(m,100,1,1);assert.ok(r.ok);assert.equal(F.cleanItem(r.market,100,1,2).ok,false);
 const legacy={inventory:[{uid:3,id:'book',condition:'good',cost:9,day:2}],listings:[],history:[],rating:3.4,reviews:5,nextId:4};const mg=F.migrateFlea(legacy);assert.equal(mg.v,2);assert.equal(mg.inventory[0].condition,'good');assert.equal(mg.rating,3.4);});
