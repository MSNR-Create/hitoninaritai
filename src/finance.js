// Account transactions are authoritative UI history, not a second wallet.
const categories=['アルバイト','フリマ売上','フリマ仕入れ','フリマ返品','梱包・手数料','生活物資仕入れ','建設','研究','物件契約','不動産購入','賃料','事件・補償','地上事業売上','地上施設維持費','不動産売却'];
export const FINANCE_CATEGORIES=Object.freeze(categories);
export function createLedger(openingBalance=300,startDay=1){return {openingBalance,startDay,transactions:[]};}
export function addTransaction(ledger,{day,amount,category,note=''}){
 if(!Number.isInteger(day)||day<1||!Number.isFinite(amount)||!Number.isSafeInteger(amount)||!categories.includes(category)||typeof note!=='string')throw Error('収支履歴が不正です');
 if(amount===0)return ledger;
 return {...ledger,transactions:[...ledger.transactions,{day,amount,category,note:note.slice(0,100)}].slice(-250)};
}
export function daySummary(ledger,day){
 const transactions=ledger.transactions.filter(t=>t.day===day);
 const income=transactions.reduce((a,t)=>a+Math.max(0,t.amount),0);
 const expense=-transactions.reduce((a,t)=>a+Math.min(0,t.amount),0);
 const opening=ledger.openingBalance+ledger.transactions.filter(t=>t.day<day).reduce((a,t)=>a+t.amount,0);
 return {day,income,expense,net:income-expense,opening,closing:opening+income-expense,transactions};
}
export function balanceSeries(ledger,throughDay,days=7){return Array.from({length:days},(_,i)=>daySummary(ledger,Math.max(ledger.startDay,throughDay-days+1+i))).filter((v,i,a)=>i===0||v.day!==a[i-1].day);}
export function validateLedger(data){
 if(!data||!Number.isSafeInteger(data.openingBalance)||data.openingBalance<0||!Number.isInteger(data.startDay)||data.startDay<1||!Array.isArray(data.transactions)||data.transactions.length>250)throw Error('収支履歴が不正です');
 let prev=data.startDay;
 for(const t of data.transactions){if(!Number.isInteger(t.day)||t.day<prev||t.day>1e7||!Number.isSafeInteger(t.amount)||!categories.includes(t.category)||typeof t.note!=='string'||t.note.length>100)throw Error('収支明細が不正です');prev=t.day;}
 return data;
}
