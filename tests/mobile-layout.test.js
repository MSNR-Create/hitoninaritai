import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('fixed-screen grid and clipping on mobile',()=>{let css=read('styles.css');assert.match(css,/grid-template-rows:\s*auto auto minmax\(0,1fr\) auto/);assert.match(css,/\[hidden\]\s*\{\s*display:\s*none\s*!important/);assert.match(css,/\.viewport\s*>\s*\.selection-panel/)});
test('tile details moved into map and visual viewport height tracked',()=>{let js=read('src/main.js');assert.match(js,/viewport\.appendChild\(el\('selectionPanel'\)\)/);assert.match(js,/window\.visualViewport\?\.addEventListener\('resize',updateScreenHeight/)});
test('versioned static assets avoid obsolete cache',()=>{let html=read('index.html');let sw=read('sw.js');const v=sw.match(/zombie-colony-v(\d+)-/)[1];assert.ok(html.includes('styles.css?v='+v),'CSS query must match SW cache version');assert.ok(html.includes('main.js?v='+v),'JS query must match SW cache version')});
