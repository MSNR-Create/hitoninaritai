/** Pure time controls for a 120-tick game day. No wall-clock progression. */
export function formattedGameClock(day, tick){
  const n=((Math.floor(tick)%120)+120)%120;
  const totalMinutes=(6*60+n*12)%(24*60);
  const hh=String(Math.floor(totalMinutes/60)).padStart(2,'0');
  const mm=String(totalMinutes%60).padStart(2,'0');
  return {dateTime:`第${day}日 · ${hh}:${mm}`,phase:n>=60?'夜':'昼',hour:hh,minute:mm};
}
export function ticksUntilNextDay(tick){const n=((Math.floor(tick)%120)+120)%120;return 120-n;}
export function nextSpeed(speed){return ({1:2,2:3,3:5,5:10,10:2})[speed]??2;}
