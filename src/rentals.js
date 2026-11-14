export const RENTALS=Object.freeze([
 {id:'apartment',name:'空きアパート',deposit:90,rent:12,purchase:650,x:2,y:3,w:3,h:3},
 {id:'market',name:'貸し店舗',deposit:180,rent:22,purchase:1250,x:10,y:3,w:3,h:3},
 {id:'warehouse',name:'貸し倉庫',deposit:120,rent:16,purchase:900,x:10,y:10,w:3,h:3},
 {id:'clinic',name:'地域診療所',deposit:220,rent:26,purchase:1550,x:17,y:3,w:3,h:3},
 {id:'cafe',name:'街角カフェ',deposit:150,rent:18,purchase:1050,x:17,y:10,w:3,h:3},
 {id:'flats',name:'集合住宅',deposit:200,rent:23,purchase:1400,x:3,y:17,w:4,h:3}
]);
export function rentProperty(rented,money,id){const unit=RENTALS.find(r=>r.id===id);if(!unit)return {ok:false,reason:'物件がありません'};if(rented.includes(id))return {ok:false,reason:'契約済みです'};if(money<unit.deposit)return {ok:false,reason:`契約時資金不足（${unit.deposit}G）`};return {ok:true,rented:[...rented,id],money:money-unit.deposit,deposit:unit.deposit};}
export function chargeRent(rented,money){const due=RENTALS.filter(r=>rented.includes(r.id)).reduce((v,r)=>v+r.rent,0);return {money:money-due,due};}
