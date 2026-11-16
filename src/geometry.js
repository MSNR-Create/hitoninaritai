export const MAP_SIZE = 32;
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

/** All map coordinates are integer tile indices; world coordinates are CSS-pixel units. */
export function tileToWorld(tx, ty) {
  return { x: (tx - ty) * TILE_WIDTH / 2, y: (tx + ty) * TILE_HEIGHT / 2 };
}

export function worldToTile(wx, wy) {
  const tx = wx / TILE_WIDTH + wy / TILE_HEIGHT;
  const ty = wy / TILE_HEIGHT - wx / TILE_WIDTH;
  return { x: Math.floor(tx + 0.5), y: Math.floor(ty + 0.5) };
}

/** Quarter-turns of the tile grid, not a rotation of the screen pixels. */
export function rotateTile(x,y,rotation=0,size=MAP_SIZE){
  switch(((rotation%4)+4)%4){
    case 1:return {x:size-1-y,y:x};
    case 2:return {x:size-1-x,y:size-1-y};
    case 3:return {x:y,y:size-1-x};
    default:return {x,y};
  }
}
export function unrotateTile(x,y,rotation=0,size=MAP_SIZE){return rotateTile(x,y,4-rotation,size);}
export function projectedTile(x,y,rotation=0){const t=rotateTile(x,y,rotation);return tileToWorld(t.x,t.y);}
export function projectedFootprint(b,rotation=0){
  const tiles=[rotateTile(b.x,b.y,rotation),rotateTile(b.x+b.w-1,b.y,rotation),rotateTile(b.x,b.y+b.h-1,rotation),rotateTile(b.x+b.w-1,b.y+b.h-1,rotation)];
  return {x:Math.min(...tiles.map(t=>t.x)),y:Math.min(...tiles.map(t=>t.y)),w:Math.max(...tiles.map(t=>t.x))-Math.min(...tiles.map(t=>t.x))+1,h:Math.max(...tiles.map(t=>t.y))-Math.min(...tiles.map(t=>t.y))+1};
}

export function inBounds(x, y, size = MAP_SIZE) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < size && y >= 0 && y < size;
}

export function viewToWorld(px, py, view) {
  return { x: (px - view.cx) / view.zoom - view.panX, y: (py - view.cy) / view.zoom - view.panY };
}

export function worldToView(wx, wy, view) {
  return { x: view.cx + (wx + view.panX) * view.zoom, y: view.cy + (wy + view.panY) * view.zoom };
}

export function hitTile(px, py, view) {
  const p = viewToWorld(px, py, view);
  const t = worldToTile(p.x, p.y);
  const actual=unrotateTile(t.x,t.y,view.rotation??0);
  return inBounds(actual.x,actual.y) ? actual : null;
}

export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

export function zoomAround(view, nextZoom, focusX, focusY) {
  const oldWorld = viewToWorld(focusX, focusY, view);
  const zoom = clamp(nextZoom, 0.45, 2.5);
  const panX = (focusX - view.cx) / zoom - oldWorld.x;
  const panY = (focusY - view.cy) / zoom - oldWorld.y;
  return { ...view, zoom, panX, panY };
}
