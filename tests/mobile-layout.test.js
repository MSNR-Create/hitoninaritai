import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('fixed-screen grid and clipping on mobile',()=>{let css=read('styles.css');assert.match(css,/grid-template-rows:\s*auto auto minmax\(0,1fr\) auto/);assert.match(css,/\[hidden\]\s*\{\s*display:\s*none\s*!important/);assert.match(css,/\.viewport\s*>\s*\.selection-panel/)});
test('tile details moved into map and visual viewport height tracked',()=>{let js=read('src/main.js');assert.match(js,/viewport\.appendChild\(el\('selectionPanel'\)\)/);assert.match(js,/window\.visualViewport\?\.addEventListener\('resize',updateScreenHeight/)});
test('versioned static assets avoid obsolete cache',()=>{let html=read('index.html');let sw=read('sw.js');assert.match(html,/styles\.css\?v=1300/);assert.match(html,/main\.js\?v=1300/);assert.match(sw,/zombie-colony-v13-0/)});
