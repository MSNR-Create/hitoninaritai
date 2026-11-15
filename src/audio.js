// v3.1 procedural chiptune BGM + sound effects (Web Audio, no asset files). Starts on first user gesture.
let ac=null,master=null,bgmBus=null,sfxBus=null,timer=null,mode=null,step=0,nextTime=0;
const prefs=(()=>{try{return JSON.parse(localStorage.getItem('zc-audio')??'')??{}}catch{return {}}})();
export const audioPrefs={bgm:prefs.bgm??0.5,sfx:prefs.sfx??0.7,muted:prefs.muted??false};
function persist(){try{localStorage.setItem('zc-audio',JSON.stringify(audioPrefs));}catch{}}
function apply(){if(!ac)return;master.gain.value=audioPrefs.muted?0:1;bgmBus.gain.value=audioPrefs.bgm*0.22;sfxBus.gain.value=audioPrefs.sfx*0.5;}
export function setAudio(p){Object.assign(audioPrefs,p);persist();apply();}
export function unlockAudio(){if(ac){if(ac.state==='suspended')ac.resume();return;}
 const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return;ac=new AC();master=ac.createGain();master.connect(ac.destination);
 bgmBus=ac.createGain();bgmBus.connect(master);sfxBus=ac.createGain();sfxBus.connect(master);apply();nextTime=ac.currentTime+.1;timer=setInterval(schedule,60);}
const hz=n=>440*Math.pow(2,(n-69)/12);
function tone(bus,t,midi,dur,{type='square',vol=.3,attack=.005,release=.08,slide=0}={}){const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(hz(midi),t);if(slide)o.frequency.linearRampToValueAtTime(hz(midi+slide),t+dur);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+attack);g.gain.setValueAtTime(vol,t+Math.max(attack,dur-release));g.gain.linearRampToValueAtTime(0,t+dur);o.connect(g);g.connect(bus);o.start(t);o.stop(t+dur+.02);}
function noise(bus,t,dur,vol=.2,hp=2000){const n=Math.floor(ac.sampleRate*dur),buf=ac.createBuffer(1,n,ac.sampleRate),d=buf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
 const s=ac.createBufferSource();s.buffer=buf;const f=ac.createBiquadFilter();f.type='highpass';f.frequency.value=hp;const g=ac.createGain();g.gain.value=vol;s.connect(f);f.connect(g);g.connect(bus);s.start(t);}
// ---- BGM: 16-step patterns, 4 bars loop. Day = bouncy major, night = sneaky minor, danger = tense.
const SONGS={
 day:{bpm:112,chords:[[60,64,67],[57,60,64],[53,57,60],[55,59,62]],mel:[72,null,76,74,72,null,69,null,67,69,72,null,74,null,72,null, 69,null,72,69,67,null,64,null,65,67,69,null,67,null,null,null, 65,null,69,67,65,null,64,62,60,null,62,64,65,null,67,null, 67,null,71,69,67,null,74,null,72,null,71,null,67,null,null,null],bass:'oct'},
 night:{bpm:84,chords:[[57,60,64],[53,57,60],[55,58,62],[52,56,59]],mel:[69,null,null,72,71,null,69,null,null,null,64,null,65,null,64,null, 65,null,null,69,67,null,65,null,64,null,null,null,62,null,null,null, 67,null,null,70,69,null,67,null,65,null,62,null,64,null,null,null, 68,null,null,71,69,null,68,null,64,null,null,null,null,null,null,null],bass:'walk'},
 danger:{bpm:132,chords:[[57,60,64],[58,62,65],[57,60,64],[56,59,64]],mel:[81,null,80,null,81,null,76,null,81,null,80,null,77,null,76,null, 82,null,81,null,82,null,77,null,82,null,81,null,77,null,74,null, 81,null,80,null,81,null,76,null,84,null,83,null,81,null,80,null, 80,null,81,null,83,null,80,null,76,null,null,null,null,null,null,null],bass:'pulse'}};
export function setMusic(m){if(m===mode)return;mode=m;step=0;}
function schedule(){if(!ac||!mode||audioPrefs.muted||audioPrefs.bgm<=0){if(ac)nextTime=ac.currentTime+.05;return;}
 const song=SONGS[mode],dt=60/song.bpm/4;
 while(nextTime<ac.currentTime+.25){const t=nextTime,bar=Math.floor(step/16)%4,s=step%16,ch=song.chords[bar];
  const m=song.mel[(step)%64];if(m)tone(bgmBus,t,m,dt*1.8,{type:mode==='night'?'triangle':'square',vol:mode==='night'?.32:.16});
  if(song.bass==='oct'&&s%2===0)tone(bgmBus,t,ch[0]-24+(s%4?12:0),dt*.9,{type:'triangle',vol:.35});
  if(song.bass==='walk'&&s%4===0)tone(bgmBus,t,ch[(s/4)%3]-24,dt*3.6,{type:'triangle',vol:.38});
  if(song.bass==='pulse')tone(bgmBus,t,ch[0]-24,dt*.6,{type:'sawtooth',vol:.12});
  if(mode==='day'&&(s===4||s===12))noise(bgmBus,t,.05,.12,5000);
  if(mode==='day'&&s%2===1)tone(bgmBus,t,ch[(s>>1)%3]+12,dt*.5,{type:'square',vol:.05});
  if(mode==='danger'&&s%4===0)noise(bgmBus,t,.04,.15,3000);
  if(mode==='night'&&s===8&&bar%2)tone(bgmBus,t,ch[2]+12,dt*6,{type:'sine',vol:.12});
  nextTime+=dt;step++;}}
// ---- SFX
const SFX={
 click:t=>tone(sfxBus,t,84,.05,{vol:.15}),
 build:t=>{noise(sfxBus,t,.08,.3,800);noise(sfxBus,t+.1,.08,.3,800);tone(sfxBus,t+.2,72,.08,{vol:.2});tone(sfxBus,t+.28,79,.12,{vol:.2});},
 coin:t=>{tone(sfxBus,t,83,.06,{vol:.25});tone(sfxBus,t+.06,88,.18,{vol:.25});},
 pay:t=>{tone(sfxBus,t,76,.06,{vol:.18});tone(sfxBus,t+.06,72,.1,{vol:.18});},
 good:t=>[72,76,79,84].forEach((n,i)=>tone(sfxBus,t+i*.08,n,.12,{vol:.22})),
 levelup:t=>{[72,76,79,84,88].forEach((n,i)=>tone(sfxBus,t+i*.07,n,.1,{vol:.22}));tone(sfxBus,t+.38,91,.35,{vol:.2,type:'triangle'});},
 research:t=>[67,71,74,79,83].forEach((n,i)=>tone(sfxBus,t+i*.09,n,.16,{vol:.18,type:'triangle'})),
 bad:t=>{tone(sfxBus,t,64,.18,{vol:.25,type:'sawtooth',slide:-3});tone(sfxBus,t+.2,60,.35,{vol:.25,type:'sawtooth',slide:-5});},
 police:t=>{for(let i=0;i<4;i++){tone(sfxBus,t+i*.3,79,.15,{vol:.15,type:'square'});tone(sfxBus,t+i*.3+.15,74,.15,{vol:.15,type:'square'});}},
 death:t=>{[67,63,60,55].forEach((n,i)=>tone(sfxBus,t+i*.22,n,.3,{vol:.22,type:'triangle'}));noise(sfxBus,t+.9,.4,.15,200);},
 conversion:t=>{[60,67,72,75,79].forEach((n,i)=>tone(sfxBus,t+i*.12,n,.4,{vol:.15,type:'sine'}));},
 gameover:t=>{[67,66,65,64,63,62,60].forEach((n,i)=>tone(sfxBus,t+i*.25,n,.3,{vol:.25,type:'sawtooth'}));},
 dawn:t=>{tone(sfxBus,t,79,.2,{vol:.12,type:'sine'});tone(sfxBus,t+.15,84,.3,{vol:.12,type:'sine'});},
 dusk:t=>{tone(sfxBus,t,67,.3,{vol:.12,type:'sine'});tone(sfxBus,t+.2,62,.4,{vol:.12,type:'sine'});},
 wifi:t=>{tone(sfxBus,t,88,.05,{vol:.12});tone(sfxBus,t+.08,93,.05,{vol:.12});noise(sfxBus,t+.2,.3,.12,4000);}};
export function sfx(name){if(!ac||audioPrefs.muted||!SFX[name])return;try{SFX[name](ac.currentTime+.01);}catch{}}
export const EVENT_SFX={friendship:'good',warning:'bad',police:'police',conversion:'conversion',loss:'death',incident:'bad',research:'research',ending:'levelup',
 flea_claim:'bad',flea_good:'coin',flea_jackpot:'levelup',flea_buzz:'good',flea_crash:'bad',flea_fake:'bad',flea_mismatch:'bad',levelup:'levelup',district:'good',wifi_caught:'police'};
