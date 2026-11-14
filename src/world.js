import { MAP_SIZE, inBounds } from './geometry.js';
import { createCityInfrastructure } from './surface-city.js';

const coords = (x, y) => `${x},${y}`;
function fillRectangle(set, x0, y0, x1, y1) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) set.add(coords(x, y));
}
function tileSet(points) { return new Set(points.map(([x,y]) => coords(x,y))); }

export function makeWorlds() {
  const closed = new Set();
  fillRectangle(closed,16,0,23,6);
  fillRectangle(closed,17,16,23,23);
  fillRectangle(closed, 0, 0, 4, 4);
  fillRectangle(closed, 11, 1, 15, 5);
  fillRectangle(closed, 10, 11, 15, 15);

  const paths = new Set();
  for (let x = 3; x < 14; x++) paths.add(coords(x, 8));
  for (let y = 4; y < 13; y++) paths.add(coords(8, y));
  for (let x = 5; x < 11; x++) paths.add(coords(x, 12));
  for (let y = 8; y <= 12; y++) paths.add(coords(5, y));

  paths.add(coords(5, 7)); // Connect the initial home to the exit corridor.
  const zones = [
    {id:'northwest',name:'北西区画',x:0,y:0,w:5,h:5,cost:75,open:false},
    {id:'northeast',name:'北東区画',x:11,y:1,w:5,h:5,cost:110,open:false},
    {id:'southeast',name:'南東区画',x:10,y:11,w:6,h:5,cost:140,open:false},
    {id:'eastward',name:'東部拡張区画',x:16,y:0,w:8,h:7,cost:220,open:false},
    {id:'deepward',name:'深層開発区画',x:17,y:16,w:7,h:8,cost:280,open:false}
  ];
  const underground = {
    id: 'underground', name: '地下タウン', subtitle: '閉鎖区画と住民の生活拠点',
    closed, paths, zones, nextBuildingId:0,
    buildings: [
      { id: 'home', name: '共同住居', kind: 'home', x: 4, y: 5, w: 3, h: 2, description: '住民5体の帰る場所。Phase 1で休息機能を実装します。' },
      { id: 'shop', name: '共同配給所', kind: 'shop', x: 10, y: 8, w: 2, h: 3, description: '人間社会から仕入れた物資を住民へ配給する施設。' },
      { id: 'exit', name: '地上への出口', kind: 'exit', x: 7, y: 2, w: 2, h: 2, description: '地上へつながる通路。Phase 1で出勤・帰還を実装します。' },
    ],
    accents: tileSet([[2,9],[3,10],[11,7],[12,7],[7,14],[9,14],[1,7],[13,10]])
  };
  // Keep floor corridors outside building footprints; no hidden or overdrawn tiles.
  for(const b of underground.buildings){
    for(let x=b.x;x<b.x+b.w;x++)for(let y=b.y;y<b.y+b.h;y++)paths.delete(coords(x,y));
  }
  const surface = {
    id: 'surface', name: '地上', subtitle: '夜の人間社会につながる街',
    closed: new Set(), paths: new Set(), sidewalks: new Set(),
    buildings: [
      { id: 'street-home', name: '人間の住宅', kind: 'humanHome', x: 2, y: 3, w: 3, h: 3, description: '地域の人間が暮らす住宅。住民が増えると商業施設の売上が増えます。' },
      { id: 'market', name: '夜の商店', kind: 'market', x: 10, y: 3, w: 3, h: 3, description: '街の人間の買い物先。人口と信頼が売上に影響します。' },
      { id: 'warehouse', name: '倉庫', kind: 'warehouse', x: 10, y: 10, w: 3, h: 3, description: 'ネット販売の物流拠点。地域の商業活動から収入を生みます。' },
      { id:'clinic',name:'地域診療所',kind:'clinic',x:17,y:3,w:3,h:3,description:'信頼を高める人間の診療所。' },
      { id:'cafe',name:'街角カフェ',kind:'cafe',x:17,y:10,w:3,h:3,description:'人間同士が交流する場所。' },
      { id:'flats',name:'集合住宅',kind:'humanHome',x:3,y:17,w:4,h:3,description:'人口が増えると来客が増える。' },
      { id: 'surface-exit', name: '地下への入口', kind: 'exit', x: 6, y: 7, w: 2, h: 2, description: '地下タウンへ戻る入口です。' }
    ],
    accents: tileSet([[2,10],[3,10],[4,11],[13,7],[13,8],[8,13],[4,2],[7,2]])
  };
  // Human-owned buildings form a lived-in streetscape; they are scenery,
  // not empty purchasable lots. Existing investable properties stay unchanged.
  surface.cityBuildings=[
    {id:'city-r1',kind:'humanHome',x:0,y:10,w:3,h:3,name:'民家'},
    {id:'city-r2',kind:'humanHome',x:4,y:11,w:3,h:2,name:'民家'},
    {id:'city-r3',kind:'market',x:11,y:18,w:3,h:3,name:'雑貨店'},
    {id:'city-r4',kind:'cafe',x:18,y:18,w:3,h:3,name:'食堂'},
    {id:'city-r5',kind:'humanHome',x:20,y:2,w:3,h:3,name:'住宅'},
    {id:'city-r6',kind:'warehouse',x:2,y:21,w:4,h:2,name:'配送所'},
    {id:'city-r7',kind:'humanHome',x:11,y:22,w:3,h:2,name:'住宅'},
    {id:'city-r8',kind:'humanHome',x:18,y:22,w:3,h:2,name:'住宅'},
    {id:'city-r9',kind:'market',x:20,y:11,w:3,h:3,name:'日用品店'},
    {id:'city-r10',kind:'humanHome',x:0,y:0,w:3,h:2,name:'住宅'},
    {id:'city-r11',kind:'market',x:11,y:0,w:3,h:2,name:'小売店'},
    {id:'city-r12',kind:'clinic',x:18,y:0,w:3,h:2,name:'薬局'}
  ];
  const infrastructure=createCityInfrastructure([...surface.buildings,...surface.cityBuildings]);
  surface.paths=infrastructure.roads;surface.sidewalks=infrastructure.sidewalks;
  return { underground, surface };
}

export function buildingAt(world, x, y) {
  if (!inBounds(x, y, MAP_SIZE)) return null;
  return world.buildings.find(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) ?? null;
}
export function describeTile(world, x, y) {
  if (!inBounds(x, y)) return null;
  const building = buildingAt(world, x, y);
  if (building) return { title: building.name, description: building.description, type: '施設', building };
  if (world.closed.has(coords(x,y))) return { title: '閉鎖区画', description: '区画を選択して開放できます。', type: '閉鎖' };
  if (world.paths.has(coords(x,y))) return world.id==='surface'?{ title:'街の車道',description:'人間の街の道路です。自動車が行き交い、周辺に人通りが生まれます。',type:'道路' }:{ title: '地下通路', description: '施設の接続に使う地下通路です。', type: '通路' };
  if(world.id==='surface'&&world.sidewalks?.has(coords(x,y))) return {title:'街の歩道',description:'住民が往来する歩行者の道です。',type:'歩道'};
  return { title: world.id === 'surface' ? '街の地面' : '空き区画', description: '現在は選択・描画の検証用タイルです。', type: '地面' };
}
