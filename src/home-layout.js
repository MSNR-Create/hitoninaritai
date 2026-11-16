// v3.4: one source of truth for where beds go in a home, used by both the renderer and the residents.
// Beds are laid out to the home's capacity; when beds outnumber tiles, bunk beds hold two.
export function homeLayout(b,cap){
 const tiles=[];for(let ly=0;ly<b.h;ly++)for(let lx=0;lx<b.w;lx++)tiles.push([lx,ly]);
 const T=tiles.length,bunk=cap>T-1,bedTiles=bunk?Math.min(T,Math.ceil(cap/2)):Math.max(0,cap);
 const slots=[];for(let i=0;i<bedTiles;i++){slots.push({lx:tiles[i][0],ly:tiles[i][1],upper:false,bunk});if(bunk)slots.push({lx:tiles[i][0],ly:tiles[i][1],upper:true,bunk});}
 const decor=tiles.slice(bedTiles).map((t,i)=>({lx:t[0],ly:t[1],name:['table','shelf','plant','plant'][i]??'plant'}));
 return {slots:slots.slice(0,Math.max(cap,0)),beds:tiles.slice(0,bedTiles).map(t=>({lx:t[0],ly:t[1],bunk})),decor};}
