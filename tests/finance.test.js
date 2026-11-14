import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedger, addTransaction, daySummary, balanceSeries, validateLedger } from '../src/finance.js';
const tx=(l,day,amount,category,note)=>addTransaction(l,{day,amount,category,note});
test('income, daily supply, rent and trades reconcile to cash balance',()=>{
 let l=createLedger(300,1);l=tx(l,1,-7,'生活物資仕入れ','食料');l=tx(l,1,-100,'建設','住居');l=tx(l,1,60,'アルバイト','二人の仕事');l=tx(l,1,-12,'賃料','家賃');
 const s=daySummary(l,1);assert.equal(s.opening,300);assert.equal(s.income,60);assert.equal(s.expense,119);assert.equal(s.net,-59);assert.equal(s.closing,241);
 l=tx(l,2,120,'フリマ売上','ゲーム機');l=tx(l,2,-21,'梱包・手数料','梱包');assert.equal(daySummary(l,2).opening,241);assert.equal(daySummary(l,2).closing,340);
});
test('empty and older day work without inventing entries',()=>{const l=createLedger(184,7);assert.equal(daySummary(l,7).closing,184);assert.equal(balanceSeries(l,8,7)[0].day,7);});
test('invalid records and categories are rejected',()=>{
 assert.throws(()=>tx(createLedger(),1,-3,'不明','不正'));assert.throws(()=>validateLedger({openingBalance:300,startDay:1,transactions:[{day:2,amount:3,category:'建設',note:'a'},{day:1,amount:1,category:'建設',note:'b'}]}));
});
test('serialized finance ledger retains daily transactions',()=>{const l=tx(createLedger(),4,18,'アルバイト','清掃');assert.deepEqual(validateLedger(JSON.parse(JSON.stringify(l))),l);});
