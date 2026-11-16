// Existing human settlement: the surface already has streets, sidewalks, and traffic.
// Rendering is deterministic and separated from the colony's buildable underground.
import { MAP_SIZE } from './geometry.js';
const key=(x,y)=>`${x},${y}`;
export const CORE=24; // v3.5: the original town; the ring beyond is wilderness until districts develop it
export const ROAD_COLUMNS=Object.freeze([8,9,15,16]);
export const ROAD_ROWS=Object.freeze([8,9,15,16]);
export function createCityInfrastructure(buildings=[]){
 const blocked=new Set();
 for(const b of buildings)for(let x=b.x;x<b.x+b.w;x++)for(let y=b.y;y<b.y+b.h;y++)blocked.add(key(x,y));
 const roads=new Set(),sidewalks=new Set();
 for(let x=0;x<MAP_SIZE;x++)for(let y=0;y<MAP_SIZE;y++){
  if(x<CORE&&y<CORE&&!blocked.has(key(x,y))&&(ROAD_COLUMNS.includes(x)||ROAD_ROWS.includes(y)))roads.add(key(x,y));
 }
 for(const r of roads){const [x,y]=r.split(',').map(Number);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const a=x+dx,b=y+dy;if(a>=0&&a<MAP_SIZE&&b>=0&&b<MAP_SIZE&&!roads.has(key(a,b))&&!blocked.has(key(a,b)))sidewalks.add(key(a,b));
 }}
 return {roads,sidewalks};
}
export function streetTileKind(world,x,y){
 const p=key(x,y);if(world.paths?.has(p))return 'road';if(world.sidewalks?.has(p))return 'sidewalk';if(world.fog?.has(p))return 'fog';if(world.water?.has(p))return 'water';if(world.park?.has(p))return 'park';if((x>=CORE||y>=CORE)&&!world.devUsed?.has(p))return 'wild';return 'lot';
}
// Animated vehicles occupy designated carriageways. They never cross building footprints.
export function vehiclesAt(seconds,humans=34,trust=55){
 const rate=Math.max(1,Math.min(10,Math.floor(humans/18)+Math.floor(trust/45)));
 const res=[];
 for(let i=0;i<rate;i++){
  const vertical=i%2===0;
  const lane=vertical?(i%4<2?8.35:15.35):15.35;
  const travel=((seconds*(.95+(i%3)*.26)+i*7.3)%23.9+23.9)%23.9;
  const direction=i%4<2?1:-1;
  const along=direction===1?travel:23.9-travel;
  const x=vertical?lane:along,y=vertical?along:lane;
  // Avoid random parked sprites and road boundaries.
  res.push({id:i,x,y,dir:direction,axis:vertical?'y':'x',color:['#eab77b','#83aebd','#c39ab9','#d9d7a6','#86b6a1'][i%5]});
 }
 return res;
}
export function pedestriansAt(seconds,humans=34){
 const n=Math.max(4,Math.min(26,Math.round(humans/4)));
 const a=[];
 for(let i=0;i<n;i++){
  const vertical=i%2===0,axis=(i%4<2?7.35:17.25),t=((seconds*(.32+(i%3)*.08)+i*5.3)%23.9+23.9)%23.9;
  a.push({id:i,x:vertical?axis:t,y:vertical?t:axis});
 }
 return a;
}
