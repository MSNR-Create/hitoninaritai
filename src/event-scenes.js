// Reusable game-event scenes. Stylized, non-graphic pixel-tableau animations.
const SCENES={friendship:{title:'心が通じた！',desc:'街角で会話を交わし、少しだけ距離が縮まった。',accent:'#a4d6b1'},warning:{title:'正体を疑われた！',desc:'妙な仕草を見られた。相手が不審そうにしている。',accent:'#e7bd76'},police:{title:'警察が出動！',desc:'通報を受けた警官が駆けつけ、取り押さえようとしている。',accent:'#ee9886'},conversion:{title:'新しい眷属！',desc:'人間の隣人が新たな仲間として地下に加わった。',accent:'#b5c8ff'},loss:{title:'帰らぬ仲間',desc:'衝突の末、住民を失った。地下に悲しみが広がる。',accent:'#b9b4c6'},incident:{title:'対人トラブル！',desc:'衝動を抑えられず、人間社会で騒ぎになってしまった。',accent:'#f6a780'},research:{title:'研究成功！',desc:'長年の課題をひとつ克服した。人間化への道が開ける。',accent:'#a4ebda'},ending:{title:'新たな未来',desc:'ゾンビたちの未来を選ぶときが来た。',accent:'#e6dba3'}};
export const sceneDefinition=kind=>SCENES[kind]??SCENES.incident;
export function eventsForDay(previousCount,social,colony,game){
 const entries=social.history.slice(previousCount).map(e=>({id:e.id,kind:e.kind,message:e.message,reason:e.reason,day:e.day}));
 const report=colony.report;
 if(report){for(const name of report.incidentNames??[])entries.push({id:`${game.day}-${name}-incident`,kind:'incident',message:`${name}が人間社会で騒動を起こした`,reason:'配給や休息の不足が続き、危険衝動が高まった',day:game.day});
 if(report.researchDone&&colony.completedResearch.includes('impulse'))entries.push({id:`research-${game.day}`,kind:'research',message:'衝動抑制の研究が完成した',reason:'研究室と研究員による研究が所定量に到達',day:game.day});}
 return entries.filter((e,i,a)=>a.findIndex(x=>x.id===e.id)===i);
}
export function paintEvent(ctx,kind,frame,w=320,h=170){
 const s=sceneDefinition(kind),t=frame/1000;ctx.clearRect(0,0,w,h);ctx.fillStyle='#162d3c';ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#314c54';ctx.fillRect(0,h-38,w,38);
 for(let i=0;i<13;i++){ctx.fillStyle=i%2?'#365663':'#42616a';ctx.fillRect(i*26,0,20,90);ctx.fillStyle='#e4bf80';ctx.fillRect(i*26+5,24,5,9)}
 const pixel=(x,y,width,height,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),width,height)};
 function sprite(x,y,human=false,police=false,fallen=false){let bob=fallen?0:Math.sin(t*3+x)*2;ctx.save();if(fallen){ctx.translate(x,y);ctx.rotate(-Math.PI/2);ctx.translate(-x,-y)}pixel(x-9,y-44+bob,18,20,police?'#f3c49b':human?'#e7bb96':'#add1a7');pixel(x-10,y-24+bob,20,21,police?'#354e93':human?'#b68a8b':'#698e91');pixel(x-8,y-3+bob,6,11,'#435668');pixel(x+2,y-3+bob,6,11,'#435668');pixel(x-5,y-34+bob,3,3,'#23363e');pixel(x+3,y-34+bob,3,3,'#23363e');if(police)pixel(x-11,y-49+bob,22,7,'#283e70');ctx.restore()}
 const action=kind==='police'||kind==='incident'||kind==='loss';
 if(kind==='research'||kind==='ending'){sprite(120,128);pixel(175,65,32,35,'#74c8b6');pixel(183,50,16,16,'#e6e0b6');for(let i=0;i<4;i++)pixel(175+Math.sin(t*2+i)*30,45+i*17,5,5,'#f6e89f')}
 else if(kind==='conversion'){sprite(113,128);sprite(207,128);pixel(156,70,9,9,'#f2b1b7')}
 else if(kind==='friendship'){sprite(110,128);sprite(203,128,true);pixel(155,68,9,9,'#f3b4bc')}
 else if(kind==='warning'){sprite(110,128);sprite(205,128,true);pixel(178,39,20,20,'#e6b778');pixel(185,44,6,11,'#334653')}
 else if(action){sprite(110,128,false,false,kind==='loss');sprite(198+Math.sin(t*9)*3,128,true,true);if(kind!=='loss'){pixel(146,55,18,18,'#edc46d');pixel(152,59,5,9,'#3c4b5a')}if(kind==='police'){sprite(252,132,true,true);for(let i=0;i<3;i++)pixel(160+Math.sin(t*13+i)*12,95+i*7,7,6,'#e7d0a6')}}
 ctx.fillStyle=s.accent;ctx.fillRect(0,0,w,5);
}
