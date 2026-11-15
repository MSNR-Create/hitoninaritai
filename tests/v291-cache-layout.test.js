import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('service worker bypasses HTTP cache and triggers reload after controller replacement',()=>{
 const sw=read('sw.js'),js=read('src/main.js');
 assert.match(sw,/zombie-colony-v291-1/);
 assert.match(sw,/fetch\(req,\{cache:'reload'\}\)/);
 assert.match(js,/navigator\.serviceWorker\.addEventListener\('controllerchange'/);
 assert.match(js,/updateViaCache:'none'/);
});
test('map receives full remaining game panel height',()=>{
 const css=read('styles.css');
 assert.match(css,/\.app-shell > \.game-panel > \.viewport \{[\s\S]*?height: 100% !important/);
 assert.match(css,/grid-template-rows: max-content minmax\(0, 1fr\) !important/);
});
