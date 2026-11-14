// Pure, deterministic visual projection from simulation state to map coordinates.
// No economic logic and no animation randomness here.
const HOMES=[[5.4,7.0],[6.0,7.4],[5.8,6.9],[6.6,7.2],[5.1,7.7]];
const HUB=[8.0,3.6];
const SURFACE_HUB=[7.1,8.8];
function lerp(a,b,t){return a+(b-a)*Math.max(0,Math.min(1,t));}
function along(a,b,t){return {x:lerp(a[0],b[0],t),y:lerp(a[1],b[1],t)};}
export function residentVisual(game,resident){
  const index=game.residents.findIndex(r=>r.id===resident.id);
  if(index<0)throw new Error('Resident absent');
  const home=HOMES[index%HOMES.length];
  const clock=game.tick%120;
  // During the day: return from previous shift, rest at home and socialize.
  if(resident.strikeDays>0)return {layer:'underground',x:home[0],y:home[1],status:'ストライキ中',reason:'疲労または配給不足のため勤務を拒否。休息と配給で回復します'};
  if(clock<60){
    if(clock<13&&game.day>1){return {layer:'underground',...along(HUB,home,clock/12),status:'帰宅中',reason:'夜勤を終え、共同住居へ戻っています'};}
    if(clock<43){return {layer:'underground',x:home[0],y:home[1],status:'休息中',reason:'疲労を回復するため住居で休んでいます'};}
    const move=Math.sin((clock-43)/17*Math.PI)*.85;
    return {layer:'underground',x:home[0]+move,y:home[1]+move*.25,status:'地下で生活',reason:'次の勤務まで地下で過ごしています'};
  }
  if(resident.activeJob==='research')return {layer:'underground',x:9.1,y:6.5,status:'研究中',reason:'地下研究室で衝動抑制を研究しています'};
  if(resident.activeJob==='rest')return {layer:'underground',x:home[0],y:home[1],status:'休息中',reason:resident.fatigue>=85?'疲労が高いため夜勤より休息を優先':'休息を指示されているため地下にいます'};
  const night=clock-60;
  if(night<14)return {layer:'underground',...along(home,HUB,night/13),status:'出勤中',reason:'割り当てられた夜勤へ向かっています'};
  if(night<20)return {layer:'surface',...along(SURFACE_HUB,[7.9,9.2],(night-14)/5),status:'地上へ移動',reason:'地下の出口から人間社会へ出ています'};
  if(night<52)return {layer:'outside',x:0,y:0,status:resident.activeJob==='forage'?'食料調達中':'外部勤務中',reason:'地図の外で勤務しています。翌朝に成果が確定します'};
  return {layer:'surface',...along([7.9,9.2],SURFACE_HUB,(night-52)/7),status:'帰還中',reason:'夜勤を終えて地下への入口へ向かっています'};
}
export function visibleResidents(game,layer){return game.residents.map((resident,index)=>({resident,index,...residentVisual(game,resident)})).filter(r=>r.layer===layer);}
