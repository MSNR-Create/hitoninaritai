import { clamp, viewToWorld } from './geometry.js';

// Conservative map envelope, including tall building silhouettes, in world units.
export const WORLD_EXTENTS = Object.freeze({ left:-768, right:768, top:-90, bottom:800 });

function axisClamp(pan, center, zoom, length, low, high, margin=72) {
  const minScreen=margin, maxScreen=length-margin;
  const worldSpan=(high-low)*zoom;
  if(worldSpan <= maxScreen-minScreen) return (length/2-center)/zoom-(low+high)/2;
  const lower=(maxScreen-center)/zoom-high;
  const upper=(minScreen-center)/zoom-low;
  return clamp(pan, lower, upper);
}
export function boundCamera(view,width,height){
  if(!(width>0&&height>0))return view;
  return {...view,
    panX:axisClamp(view.panX,view.cx,view.zoom,width,WORLD_EXTENTS.left,WORLD_EXTENTS.right),
    panY:axisClamp(view.panY,view.cy,view.zoom,height,WORLD_EXTENTS.top,WORLD_EXTENTS.bottom)
  };
}
// Pinch gesture: fixed world anchor at the START midpoint, evaluated from the
// START camera, not from the previously adjusted camera. Avoids cumulative drift.
export function makePinch(view,first,second){
  const midpoint={x:(first.x+second.x)/2,y:(first.y+second.y)/2};
  return {startZoom:view.zoom,startDistance:Math.max(1,Math.hypot(first.x-second.x,first.y-second.y)),anchor:viewToWorld(midpoint.x,midpoint.y,view),startMidpoint:midpoint};
}
export function applyPinch(view,pinch,first,second,width,height){
  const midpoint={x:(first.x+second.x)/2,y:(first.y+second.y)/2};
  const distance=Math.hypot(first.x-second.x,first.y-second.y);
  const zoom=clamp(pinch.startZoom*distance/pinch.startDistance,.45,2.5);
  const panX=(midpoint.x-view.cx)/zoom-pinch.anchor.x;
  const panY=(midpoint.y-view.cy)/zoom-pinch.anchor.y;
  return boundCamera({...view,zoom,panX,panY},width,height);
}
