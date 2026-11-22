// v3.9 guided objectives: one clear next goal at a time, with a small reward and a shortcut to the right menu.
export const GOALS=Object.freeze([
 {id:'jobs',icon:'👷',title:'住民の夜の仕事を確認しよう',hint:'下の「仕事」で住民ごとの仕事を選べます。迷ったら「🌙夜の稼ぎはおまかせ」。',panel:'jobs',reward:40,done:s=>s.openedJobs},
 {id:'sanitation',icon:'🧪',title:'研究「衛生管理Ⅰ」を始めよう',hint:'腐敗が進むと外で働けなくなります。研究ツリーで衛生管理Ⅰを選んで開始（研究サンプルが足りなければ研究画面のボタンで買い出しへ）。',panel:'research',reward:60,done:s=>s.research.includes('sanitation')||s.active==='sanitation'},
 {id:'wash',icon:'🚿',title:'洗浄台を建てよう',hint:'洗浄台で毎朝ゾンビを洗って腐敗を抑えます。建設→生活のカテゴリから。',panel:'build',reward:80,done:s=>s.kinds.includes('wash')},
 {id:'food',icon:'🍄',title:'食料を自給しよう',hint:'研究「キノコ栽培」か「地下調理」→施設を建てて「巣穴のお手伝い」を配属。買い出しが減ります。',panel:'build',reward:100,done:s=>s.kinds.includes('mushroom')||s.kinds.includes('kitchen')},
 {id:'homes',icon:'🏠',title:'住居を増やして仲間を迎えよう',hint:'人間の隣人と仲良くなると眷属に。住居の空きと食料の余裕が必要です。',panel:'build',reward:100,done:s=>s.kinds.filter(k=>k==='home').length>=2},
 {id:'orders',icon:'📦',title:'製品を作って注文に納品しよう',hint:'選別台・資材再生工房・工作室などで作った製品を「資材」の注文ボードで納品。バイトより稼げることも。',panel:'supply',reward:150,done:s=>s.ordersDone>=1},
 {id:'property',icon:'🏪',title:'地上の物件で商売を始めよう',hint:'その他→不動産・空き地から物件を借ります。警戒が低いほど客が来ます。',panel:'property',reward:150,done:s=>s.properties>=1},
 {id:'district',icon:'🏗️',title:'街の開発に出資しよう',hint:'人口・繁栄・信頼の条件を満たすと出資できます（その他→街の発展）。街が広がりバイト枠も増えます。',panel:'city',reward:200,done:s=>s.districts>=2},
 {id:'watch',icon:'🛡️',title:'見張り当番を研究して守りを固めよう',hint:'警戒が高い日が続くとゾンビバスターが来ます。研究「見張り当番」と「巣穴の見張り」で備えましょう。',panel:'research',reward:150,done:s=>s.research.includes('watch')},
 {id:'project',icon:'🌟',title:'大型プロジェクトに着手しよう',hint:'その他→大型プロジェクト。お金と製品を投じて、コロニーに大きな恩恵を。',panel:'projects',reward:300,done:s=>s.projectStages>=1},
 {id:'humanity',icon:'🌅',title:'人間化計画を完成させよう',hint:'研究「人間化技術」の後、大型プロジェクト「人間化計画」の3段階を完成させると未来を選べます。',panel:'projects',reward:0,done:s=>s.humanity}
]);
export function currentGoal(done){return GOALS.find(g=>!done.includes(g.id))??null;}
