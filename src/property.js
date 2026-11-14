import { RENTALS } from './rentals.js';
export const PURCHASE_PRICES=Object.freeze({apartment:650,market:1250,warehouse:900,clinic:1550,cafe:1050,flats:1400});
export function buyProperty(owned,rented,money,id){
 const unit=RENTALS.find(p=>p.id===id),price=PURCHASE_PRICES[id];
 if(!unit||!Number.isFinite(price))return {ok:false,reason:'物件がありません'};
 if(owned.includes(id))return {ok:false,reason:'購入済みです'};
 if(money<price)return {ok:false,reason:`資金不足（購入費${price}G）`};
 return {ok:true,owned:[...owned,id],rented:rented.filter(v=>v!==id),money:money-price,price};
}
export function propertyBill(rented,owned,money){
 const due=RENTALS.filter(p=>rented.includes(p.id)&&!owned.includes(p.id)).reduce((a,p)=>a+p.rent,0);
 return {money:money-due,due};
}
export function selectProperty(properties,x,y){return properties.find(p=>x>=p.x&&x<p.x+p.w&&y>=p.y&&y<p.y+p.h)??null;}
