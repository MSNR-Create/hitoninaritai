// v2.1 single source of truth for facilities, items and recipes (CONTENT_CATALOG_v2.1).
// Every icon is an emoji so players who don't read Japanese can still recognise things.
// Add a facility/item/recipe HERE; construction/production/storage/persistence derive from it.

export const BUILD_CATEGORIES=Object.freeze([
 {id:'tools',name:'道具',icon:'🧰'},
 {id:'life',name:'生活',icon:'🏠'},
 {id:'food',name:'食料',icon:'🍄'},
 {id:'care',name:'衛生',icon:'🩹'},
 {id:'research',name:'研究',icon:'🧪'},
 {id:'industry',name:'生産',icon:'⚙️'},
 {id:'stealth',name:'潜伏',icon:'🕶️'}
]);
export const TOOLS=Object.freeze([
 {id:'inspect',name:'観察',icon:'🔎',desc:'マップを見る・ゾンビをタップ'},
 {id:'path',name:'通路',icon:'🛤️',cost:5,desc:'5G/マス。施設を出口につなぐ'},
 {id:'unlock',name:'区画開放',icon:'🔓',desc:'閉鎖区画を開放'},
 {id:'demolish',name:'撤去',icon:'🧨',desc:'施設・通路を壊す（返金なし）'}
]);
// kind: {name, short, icon, cat, size:[w,h], cost, tech, desc, color:[floor,wall,trim], layout}
export const FACILITY_DEFS=Object.freeze({
 home:{name:'共同住居',short:'住居',icon:'🏠',cat:'life',size:[3,2],cost:100,tech:null,desc:'住民の寝床。2棟目から定員+2',color:['#e9c99a','#6fa8c8','#9fd0e4']},
 shop:{name:'共同配給所',short:'配給所',icon:'🍱',cat:'life',size:[2,3],cost:80,tech:null,desc:'夕方に住民が食事を受け取る',color:['#f0d2a0','#e07a5a','#f6b07a']},
 pantry:{name:'食料庫',short:'食料庫',icon:'🥫',cat:'life',size:[2,2],cost:90,tech:null,desc:'食料の保管枠+40',color:['#f4e4c4','#d0904a','#f0c080']},
 storage:{name:'資材置き場',short:'資材庫',icon:'📦',cat:'life',size:[3,2],cost:110,tech:null,desc:'資材の保管枠+60',color:['#d8cdb8','#7a8a6a','#b0c098']},
 lounge:{name:'娯楽ホール',short:'娯楽',icon:'🎲',cat:'life',size:[3,2],cost:180,tech:'leisure',desc:'毎日 全員の衝動−3（嗜好品1を使うと−6）',color:['#f2d8e8','#c05a9a','#e8a0cc']},
 theater:{name:'地下シアター',short:'シアター',icon:'🎬',cat:'life',size:[3,2],cost:245,tech:'entertainment',desc:'娯楽メディア1/日で 全員の衝動−5・疲労−3',color:['#2a2a3a','#5a4a8a','#9a8ad0']},
 archives:{name:'地下図書館',short:'図書館',icon:'📚',cat:'life',size:[3,2],cost:200,tech:'archives_research',desc:'研究担当がいる夜 研究pt+1。再生紙→娯楽メディア',color:['#e8dcc4','#8a6a4a','#c8a880']},
 mushroom:{name:'地下キノコ栽培室',short:'キノコ',icon:'🍄',cat:'food',size:[3,2],cost:145,tech:'mycology',desc:'培地2→キノコ4',color:['#c8b8a0','#7a5a4a','#a88a70']},
 kitchen:{name:'地下調理場',short:'調理場',icon:'🍳',cat:'food',size:[2,2],cost:125,tech:'cooking',desc:'キノコ・野菜を食料に。調味料があると+2',color:['#f4ead8','#d07a4a','#f0b080']},
 farm:{name:'地下水耕農園',short:'水耕農園',icon:'🥬',cat:'food',size:[3,3],cost:340,tech:'hydroponics',desc:'再生水2＋培地1→野菜4（電力）',color:['#d8ecc8','#4a8a5a','#8ac89a']},
 water:{name:'浄水設備',short:'浄水',icon:'🚰',cat:'food',size:[2,2],cost:135,tech:'watercycle',desc:'有機残渣1→再生水3',color:['#d8eef8','#4a8ac0','#8ac0e8']},
 wash:{name:'簡易洗浄台',short:'洗浄台',icon:'🚿',cat:'care',size:[2,2],cost:70,tech:'sanitation',desc:'毎朝2人まで腐敗−8（生活用品1/人）',color:['#e6f4f8','#4aa0c8','#8fd0ea']},
 cooler:{name:'低温保存室',short:'冷却室',icon:'❄️',cat:'care',size:[2,3],cost:230,tech:'refrigeration',desc:'毎朝4人まで腐敗−3',color:['#e0f0ff','#6a9ad8','#a8ccf0']},
 repair:{name:'身体修復室',short:'修復室',icon:'🩹',cat:'care',size:[3,2],cost:320,tech:'regeneration',desc:'毎朝2人まで腐敗−12（洗浄液1/人）',color:['#f8e8e8','#c86a6a','#f0a8a8']},
 chemical:{name:'薬品合成室',short:'薬品室',icon:'⚗️',cat:'care',size:[2,2],cost:270,tech:'chemistry',desc:'洗浄液・生活用品を製造',color:['#eae0f4','#8a6ac0','#c0a8e8']},
 lab:{name:'研究室',short:'研究室',icon:'🧪',cat:'research',size:[2,2],cost:120,tech:null,desc:'研究に必要。2棟目以降 研究pt+1',color:['#dcd8f0','#7a6ad0','#aea2ee']},
 extractor:{name:'研究試料抽出装置',short:'試料抽出',icon:'🔬',cat:'research',size:[3,2],cost:170,tech:'research_base',desc:'有機残渣2＋実験廃材1→研究サンプル1',color:['#e4e0f4','#5a8a9a','#9ad0d8']},
 culture:{name:'培養研究槽',short:'培養槽',icon:'🧫',cat:'research',size:[3,3],cost:390,tech:'bioculture',desc:'研究サンプル1＋再生水1＋培地1→研究サンプル3（電力）',color:['#e8f4e0','#5a9a6a','#a0d8a8']},
 sorting:{name:'回収物選別台',short:'選別台',icon:'♻️',cat:'industry',size:[2,2],cost:90,tech:null,desc:'回収物2→有機残渣1＋実験廃材1',color:['#e2d2b4','#8a7a5a','#bfae8a']},
 recycler:{name:'資材再生工房',short:'再生工房',icon:'🛠️',cat:'industry',size:[3,2],cost:190,tech:'recycling',desc:'培地・部品・再生紙・燃料を製造',color:['#dcd4c4','#7a6a5a','#b0a090']},
 generator:{name:'小型発電所',short:'発電所',icon:'⚡',cat:'industry',size:[2,2],cost:155,tech:'electricity',desc:'燃料1（またはバッテリー1）/夜で電力3回分',color:['#f4f0c8','#c0a030','#f0d870']},
 workshop:{name:'機械組立室',short:'組立室',icon:'🔧',cat:'industry',size:[3,2],cost:330,tech:'mechanization',desc:'電子基板・バッテリー・精密工具（電力）',color:['#d8dce4','#5a6a8a','#9aa8c8']},
 automation:{name:'自動仕分けセンター',short:'自動仕分け',icon:'🤖',cat:'industry',size:[3,3],cost:460,tech:'sorting_ai',desc:'担当なしで毎夜2回 選別・解体（電力）',color:['#d4e4ec','#3a7a9a','#80b8d0']},
 disguise:{name:'偽装メイク工房',short:'偽装工房',icon:'💄',cat:'stealth',size:[2,2],cost:185,tech:'camouflage',desc:'偽装クリームを製造。外勤者が使うと警戒↓',color:['#f8e0ec','#d06a9a','#f0a8c8']},
 gate:{name:'防衛ゲート',short:'ゲート',icon:'🛡️',cat:'stealth',size:[2,2],cost:160,tech:'gatework',desc:'襲撃時の防衛力+8（出口の隣で+4）。電力1',color:['#c8ccd0','#5a5a62','#a0a4aa']},
 security:{name:'防音・警備室',short:'警備室',icon:'🔇',cat:'stealth',size:[2,2],cost:225,tech:'soundproof',desc:'毎日 警戒−1（2棟まで）',color:['#d8dce0','#4a5a6a','#8a9aaa']}
});
export const ITEMS=Object.freeze({
 food:{name:'食料',icon:'🍞',buy:[5,7],store:'food'},
 care:{name:'生活用品',icon:'🧴',buy:[3,12]},
 luxury:{name:'嗜好品',icon:'🎁',buy:[2,20]},
 samples:{name:'研究サンプル',icon:'🧪',buy:[1,24]},
 salvage:{name:'未選別回収物',icon:'🗑️',buy:[2,5]},
 residue:{name:'有機残渣',icon:'🍂'},
 labwaste:{name:'実験廃材',icon:'🧯'},
 mushrooms:{name:'地下キノコ',icon:'🍄'},
 vegetables:{name:'地下野菜',icon:'🥬'},
 compost:{name:'培養用培地',icon:'🪴',buy:[3,10]},
 parts:{name:'ジャンク部品',icon:'🔩',buy:[2,15]},
 cleaner:{name:'洗浄液',icon:'🧼'},
 makeup:{name:'偽装クリーム',icon:'💄'},
 media:{name:'娯楽メディア',icon:'📼',buy:[1,17]},
 paper:{name:'再生紙',icon:'📄'},
 water:{name:'再生水',icon:'💧',buy:[3,9]},
 circuits:{name:'電子基板',icon:'💾'},
 toolkit:{name:'精密工具',icon:'🧰'},
 fuel:{name:'精製燃料',icon:'🛢️',buy:[2,9]},
 sweets:{name:'お菓子',icon:'🍬',buy:[3,12]},
 coffee:{name:'コーヒー',icon:'☕',buy:[2,11]},
 spices:{name:'調味料',icon:'🧂',buy:[2,8]},
 batteries:{name:'バッテリー',icon:'🔋'}
});
// Recipes in PRIORITY order (later production stages first). power:true needs a generator slot.
export const RECIPES=Object.freeze({
 sample_culture:{name:'研究試料培養',facility:'culture',in:{samples:1,water:1,compost:1},out:{samples:3},fee:6,power:true},
 extract:{name:'試料抽出',facility:'extractor',in:{residue:2,labwaste:1},out:{samples:1},fee:3},
 toolkit:{name:'精密工具組立',facility:'workshop',in:{parts:2,circuits:1},out:{toolkit:1},fee:5,power:true},
 battery:{name:'蓄電池組立',facility:'workshop',in:{circuits:1,fuel:1},out:{batteries:2},fee:3,power:true},
 circuit:{name:'電子基板組立',facility:'workshop',in:{parts:2,labwaste:1},out:{circuits:1},fee:4,power:true},
 food_preserve:{name:'保存食加工',facility:'kitchen',in:{vegetables:2,mushrooms:1},out:{food:7},fee:3},
 food_prep:{name:'キノコ定食',facility:'kitchen',in:{mushrooms:3},out:{food:6},fee:2},
 sweets_prep:{name:'菓子製造',facility:'kitchen',in:{vegetables:2},out:{sweets:3},fee:3},
 vegetables:{name:'水耕栽培',facility:'farm',in:{water:2,compost:1},out:{vegetables:4},fee:3,power:true},
 mushroom_crop:{name:'キノコ栽培',facility:'mushroom',in:{compost:2},out:{mushrooms:4},fee:2},
 care_prep:{name:'衛生用品製造',facility:'chemical',in:{cleaner:2},out:{care:3},fee:3},
 medicinal:{name:'洗浄液合成',facility:'chemical',in:{labwaste:2,water:1},out:{cleaner:3},fee:5},
 makeup_prep:{name:'偽装クリーム調合',facility:'disguise',in:{cleaner:1,parts:1},out:{makeup:2},fee:3},
 recreation:{name:'娯楽セット準備',facility:'lounge',in:{media:1,sweets:1},out:{luxury:3},fee:2},
 media_prep:{name:'娯楽メディア編集',facility:'archives',in:{paper:2},out:{media:2},fee:1},
 water_purify:{name:'再生水精製',facility:'water',in:{residue:1},out:{water:3},fee:2},
 composting:{name:'培地生成',facility:'recycler',in:{residue:2},out:{compost:3},fee:1},
 fuel_refine:{name:'燃料精製',facility:'recycler',in:{residue:2},out:{fuel:2},fee:2},
 parts:{name:'ジャンク解体',facility:'recycler',in:{salvage:3},out:{parts:2,labwaste:1},fee:2},
 scrap_to_paper:{name:'紙資源再生',facility:'recycler',in:{salvage:2},out:{paper:3},fee:1},
 sort:{name:'選別',facility:'sorting',in:{salvage:2},out:{residue:1,labwaste:1},fee:1}
});
export const FACILITY_KINDS=Object.freeze(['exit',...Object.keys(FACILITY_DEFS)]);
export const recipesFor=kind=>Object.entries(RECIPES).filter(([,r])=>r.facility===kind).map(([id])=>id);
