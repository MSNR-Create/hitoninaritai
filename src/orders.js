// v3.9 orders board: humans (and less legal buyers) order crafted goods at premium prices.
import { SELL } from './catalog.js';
const BUYERS=['駅前の雑貨店','人間の工務店','夜の闇ルート業者','商店街の修理屋','オフィスの総務課','ネットの小売業者','学校の用務員さん','ホテルの備品係'];
const r=(n)=>{const x=Math.sin(n*9301+49297)*233280;return x-Math.floor(x);};
export const ORDER_GOODS=Object.freeze(['circuits','batteries','toolkit','makeup','media','sweets','cleaner','fuel','parts','paper','vegetables','mushrooms']);
/** Generate up to 3 open orders; items the colony can produce are favoured. Reward = qty × sell price × (1.8〜2.4) × reputation bonus. */
export function refreshOrders(state,day,producible){const open=(state.orders??[]).filter(o=>o.due>=day&&!o.done);const out=[...open];let k=0;
 const pool=ORDER_GOODS.filter(g=>producible.has(g));const any=pool.length?pool:['parts','paper','fuel'];
 while(out.length<3&&k<6){const seed=day*31+k*7+(state.orderSeq??0);const item=any[Math.floor(r(seed)*any.length)];const unit=SELL[item]?.[0]??3;
  const qty=Math.max(2,Math.round((unit>=30?2:unit>=10?4:8)*(.8+r(seed+1)*.8)));const rep=Math.min(.4,(state.ordersDone??0)*.02);
  const reward=Math.round(qty*unit*(1.8+r(seed+2)*.6)*(1+rep));out.push({id:`o${day}-${k}-${state.orderSeq??0}`,item,qty,reward,due:day+3+Math.floor(r(seed+3)*3),buyer:BUYERS[Math.floor(r(seed+4)*BUYERS.length)]});k++;}
 return {...state,orders:out,orderSeq:(state.orderSeq??0)+k};}
export function deliverOrder(state,inventory,id){const o=(state.orders??[]).find(x=>x.id===id);if(!o)return {ok:false,reason:'注文がありません'};
 if((inventory[o.item]??0)<o.qty)return {ok:false,reason:'在庫が足りません'};
 return {ok:true,reward:o.reward,order:o,inventory:{...inventory,[o.item]:inventory[o.item]-o.qty},state:{...state,orders:state.orders.filter(x=>x.id!==id),ordersDone:(state.ordersDone??0)+1}};}
