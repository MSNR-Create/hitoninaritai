import { connectedFacilities } from './construction.js';
import { buildingAt } from './world.js';
export function demolitionTarget(world,x,y){
 const b=buildingAt(world,x,y);
 if(b){if(b.kind==='exit')return {ok:false,reason:'地上への出口は撤去できません'};
  if(b.kind==='home'&&world.buildings.filter(o=>o.kind==='home').length<=1)return {ok:false,reason:'最後の共同住居は撤去できません（住民の帰る場所が必要）'};
 return {ok:true,type:'building',id:b.id,x,y,description:b.name};}
 if(world.paths.has(`${x},${y}`))return {ok:true,type:'path',id:`${x},${y}`,x,y,description:'通路'};
 return {ok:false,reason:'撤去できる施設・通路がありません'};
}
export function applyDemolition(world,target){
 if(!target?.ok)return {ok:false,reason:target?.reason??'撤去先を選んでください'};
 const copy={...world,buildings:world.buildings.map(b=>({...b})),paths:new Set(world.paths)};
 if(target.type==='building'){
  const found=copy.buildings.find(b=>b.id===target.id&&b.kind!=='exit');if(!found)return {ok:false,reason:'対象施設はありません'};
  copy.buildings=copy.buildings.filter(b=>b.id!==target.id);
 }else if(target.type==='path'){
  if(!copy.paths.delete(target.id))return {ok:false,reason:'対象通路はありません'};
 }else return {ok:false,reason:'撤去種別が不正です'};
 copy.connectivity=connectedFacilities(copy);
 return {ok:true,world:copy,removed:target.description};
}
