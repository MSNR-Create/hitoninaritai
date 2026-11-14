export const MAP_SIZE = 16;
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
  return inBounds(t.x, t.y) ? t : null;
}

export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

export function zoomAround(view, nextZoom, focusX, focusY) {
  const oldWorld = viewToWorld(focusX, focusY, view);
  const zoom = clamp(nextZoom, 0.45, 2.5);
  const panX = (focusX - view.cx) / zoom - oldWorld.x;
  const panY = (focusY - view.cy) / zoom - oldWorld.y;
  return { ...view, zoom, panX, panY };
}
