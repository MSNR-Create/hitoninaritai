// Two-stage placement. Different positions reselect instead of spending money.
export function chooseFootprint(candidate,kind,tile,dimensions){
 if(!tile)return {candidate,commit:false};
 const [w,h]=dimensions;
 if(candidate?.kind===kind && tile.x>=candidate.x && tile.x<candidate.x+w && tile.y>=candidate.y && tile.y<candidate.y+h){return {candidate,commit:true};}
 return {candidate:{kind,x:tile.x,y:tile.y,w,h},commit:false};
}
export function chooseCorridor(state,tile){
 if(!state?.start)return {state:{start:tile,end:null},commit:false};
 if(!state.end)return {state:{start:state.start,end:tile},commit:false};
 if(tile.x===state.end.x&&tile.y===state.end.y)return {state,commit:true};
 return {state:{start:state.start,end:tile},commit:false};
}
