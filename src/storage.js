// v2.0-B storage: 食料庫 (pantry) holds food, 資材置き場 (storage) holds everything else.
// Full storage refuses intake (purchases blocked, surplus not collected) — nothing already stored is destroyed.
export const FOOD_BASE=30,FOOD_PER_PANTRY=40,GOODS_BASE=30,GOODS_PER_STORAGE=60;
export const GOODS=Object.freeze({care:'生活用品',luxury:'嗜好品',samples:'研究資材',salvage:'未選別回収物',residue:'有機残渣',labwaste:'実験廃材'});
export function capacities(world){
 const n=k=>world.buildings.filter(b=>b.kind===k&&(world.connectivity?.[b.id]??true)).length;
 return {food:FOOD_BASE+FOOD_PER_PANTRY*n('pantry'),goods:GOODS_BASE+GOODS_PER_STORAGE*n('storage'),pantries:n('pantry'),storages:n('storage')};
}
export const goodsTotal=inv=>Object.keys(GOODS).reduce((s,k)=>s+(inv[k]??0),0);
/** Free space for adding qty of item key. */
export function room(inv,key,caps){return key==='food'?Math.max(0,caps.food-(inv.food??0)):Math.max(0,caps.goods-goodsTotal(inv));}
/** Clamp intake: returns {inventory, accepted, refused}. Existing stock above cap is kept (never deleted). */
export function intake(inv,key,qty,caps){const ok=Math.min(qty,room(inv,key,caps));return {inventory:{...inv,[key]:(inv[key]??0)+ok},accepted:ok,refused:qty-ok};}
