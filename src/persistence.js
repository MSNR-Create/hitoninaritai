// Versioned single-snapshot persistence with previous-good rollback.
export const SAVE_VERSION=1;
const MAX_BYTES=2_000_000;
export function serializeSession(session){
 const raw={schemaVersion:SAVE_VERSION,savedAt:Date.now(),...session,world:{...session.world,closed:[...session.world.closed],paths:[...session.world.paths],accents:[...session.world.accents]}};
 return JSON.stringify(raw);
}
function isRecord(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
export function validateSession(input){
 if(typeof input==='string'){if(new TextEncoder().encode(input).length>MAX_BYTES)throw Error('保存データが大きすぎます');input=JSON.parse(input)}
 if(!isRecord(input)||input.schemaVersion!==SAVE_VERSION)throw Error('対応していないセーブ形式です');
 const {game,colony,social,world,resale,rented}=input;
 if(!isRecord(game)||!Number.isInteger(game.day)||game.day<1||game.day>1e7||!Number.isInteger(game.tick)||game.tick<0||!Array.isArray(game.residents)||game.residents.length>10||!Number.isFinite(game.money)||game.money<0||!Number.isFinite(game.alert)||game.alert<0||game.alert>100)throw Error('ゲーム状態が不正です');
 if(!isRecord(colony)||!isRecord(colony.inventory)||!Object.values(colony.inventory).every(v=>Number.isSafeInteger(v)&&v>=0)||!isRecord(social)||!Array.isArray(social.history)||social.history.length>100||!Array.isArray(social.neighbors)||!isRecord(social.links))throw Error('住民・倉庫情報が不正です');
 if(!isRecord(world)||!Array.isArray(world.closed)||!Array.isArray(world.paths)||!Array.isArray(world.accents)||!Array.isArray(world.buildings)||world.buildings.length>100||!Array.isArray(world.zones))throw Error('マップ情報が不正です');
 const tileValid=a=>a.length<=256&&a.every(s=>typeof s==='string'&&/^\d{1,2},\d{1,2}$/.test(s)&&s.split(',').every(t=>+t<16));
 if(!tileValid(world.closed)||!tileValid(world.paths)||!tileValid(world.accents))throw Error('マップ座標が不正です');
 if(!world.buildings.every(b=>isRecord(b)&&typeof b.id==='string'&&['home','shop','exit','lab'].includes(b.kind)&&[b.x,b.y,b.w,b.h].every(Number.isInteger)&&b.x>=0&&b.y>=0&&b.w>0&&b.h>0&&b.x+b.w<=16&&b.y+b.h<=16))throw Error('建物データが不正です');
 if(!game.residents.every(r=>isRecord(r)&&Number.isInteger(r.id)&&typeof r.name==='string'&&r.name.length<=60&&Number.isFinite(r.fatigue)&&r.fatigue>=0&&r.fatigue<=100&&Number.isFinite(r.impulse)&&r.impulse>=0&&r.impulse<=100))throw Error('住民データが不正です');
 if(!isRecord(resale)||!Array.isArray(resale.inventory)||resale.inventory.length>100||!Array.isArray(rented)||rented.length>10||!rented.every(id=>typeof id==='string'))throw Error('事業データが不正です');
 return input;
}
export function hydrateWorld(data){return {...data,closed:new Set(data.closed),paths:new Set(data.paths),accents:new Set(data.accents)};}
function database(){return new Promise((resolve,reject)=>{if(!('indexedDB' in globalThis)){reject(Error('IndexedDB非対応'));return;}const req=indexedDB.open('zombie-colony-save',1);req.onupgradeneeded=()=>req.result.createObjectStore('snapshots');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function transaction(mode,fn){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('snapshots',mode),store=tx.objectStore('snapshots');let result;try{result=fn(store)}catch(err){reject(err);return;}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
export async function saveSnapshot(json){validateSession(json);await transaction('readwrite',store=>{const get=store.get('current');get.onsuccess=()=>{if(get.result)store.put(get.result,'previous');store.put(json,'current');};});}
export async function loadSnapshot(){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readonly'),store=tx.objectStore('snapshots');const current=store.get('current'),previous=store.get('previous');tx.oncomplete=()=>{for(const candidate of [current.result,previous.result]){if(!candidate)continue;try{return resolve(validateSession(candidate))}catch{}}resolve(null)};tx.onerror=()=>reject(tx.error)});}finally{db.close();}}
export async function clearSnapshots(){await transaction('readwrite',store=>store.clear());}
