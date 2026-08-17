#!/usr/bin/env node
// Собирает сайт из HTML-бандла, выгруженного из Claude.
//
//   node tools/build.js ~/Downloads/Торба.html
//
// Что делает:
//   1. распаковывает бандл в index.html + assets/  (tools/unpack.js)
//   2. проставляет lang="ru" и вставляет метатеги из tools/head.html
//   3. делает 404.html копией главной
//
// Правки текста метатегов — в tools/head.html, не в index.html:
// index.html перезаписывается при каждой сборке.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const bundle = process.argv[2];
if (!bundle) {
  console.error('usage: node tools/build.js <путь к бандлу .html>');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');

execFileSync(process.execPath, [path.join(__dirname, 'unpack.js'), bundle, root], {
  stdio: 'inherit',
});

const indexPath = path.join(root, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

if (!/<html[^>]*\slang=/i.test(html)) {
  html = html.replace(/<html\b/i, '<html lang="ru"');
}

const head = fs.readFileSync(path.join(__dirname, 'head.html'), 'utf8').trim();
const viewport = html.match(/<meta[^>]+name="viewport"[^>]*>/i);
const anchor = viewport ? viewport[0] : html.match(/<head[^>]*>/i)[0];
html = html.replace(anchor, anchor + '\n' + head + '\n');

fs.writeFileSync(indexPath, html);
fs.writeFileSync(path.join(root, '404.html'), html);

console.error('index.html и 404.html собраны');
