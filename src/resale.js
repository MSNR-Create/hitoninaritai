// Economy prototype: all values in in-game G; deterministic with explicit market index.
export const GOODS=Object.freeze([
 {id:'book',name:'古書',base:36,cost:18,required:0},
 {id:'figure',name:'フィギュア',base:95,cost:55,required:3},
 {id:'console',name:'中古ゲーム機',base:210,cost:140,required:4}
]);
export const PACKING=Object.freeze({economy:{name:'簡易',cost:3,quality:1},standard:{name:'標準',cost:9,quality:3},premium:{name:'丁寧',cost:20,quality:5}});
export function marketIndex(day,seed=7){return Math.max(.72,Math.min(1.35,1+Math.sin(day*1.37+seed)*.23+Math.cos(day*.51+seed)*.1));}
export function canBuy(resale,money,itemId){const item=GOODS.find(g=>g.id===itemId);if(!item)return {ok:false,reason:'商品がありません'};if(resale.rating<item.required)return {ok:false,reason:`評価${item.required}以上で解放`};if(money<item.cost)return {ok:false,reason:`仕入資金が不足（${item.cost}G）`};return {ok:true,item};}
export function buyItem(resale,money,itemId){const c=canBuy(resale,money,itemId);if(!c.ok)return {...c,resale,money};return {ok:true,resale:{...resale,inventory:[...resale.inventory,{id:itemId,buyPrice:c.item.cost}]},money:money-c.item.cost};}
export function sellItem(resale,money,index,packing,day){const held=resale.inventory[index],item=GOODS.find(g=>g.id===held?.id),pack=PACKING[packing];if(!item||!pack)return {ok:false,reason:'商品・梱包指定が不正です',resale,money};if(money<pack.cost)return {ok:false,reason:'梱包資材の資金が不足',resale,money};
 const price=Math.round(item.base*marketIndex(day)),fee=Math.ceil(price*.1),revenue=price-fee-pack.cost,profit=revenue-held.buyPrice;
 // Price competitiveness and packing combine into a simple 1–5 review.
 const competitiveness=price<=item.base?1:price>item.base*1.2?-1:0;
 const stars=Math.max(1,Math.min(5,pack.quality+competitiveness));const rated=(resale.reviewCount*resale.rating+stars)/(resale.reviewCount+1);
 return {ok:true,resale:{...resale,inventory:resale.inventory.filter((_,i)=>i!==index),rating:Math.round(rated*10)/10,reviewCount:resale.reviewCount+1},money:money+revenue,price,fee,packingCost:pack.cost,profit,stars};
}
export function initialResale(){return {rating:2,reviewCount:1,inventory:[]};}
