#!/usr/bin/env node
// Распаковывает самораспаковывающийся HTML-бандл (__bundler) в обычную статику:
// index.html + assets/. Имена файлов — из ext_resources или из хэша содержимого,
// поэтому повторный экспорт того же сайта даёт те же имена и чистый git diff.
//
//   node unpack.js <bundle.html> <output-dir>

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const crypto = require('crypto');

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('usage: node unpack.js <bundle.html> <output-dir>');
  process.exit(1);
}

const html = fs.readFileSync(src, 'utf8');
const grab = (t) => {
  const m = html.match(new RegExp('<script type="__bundler/' + t + '">([\\s\\S]*?)</script>'));
  return m ? m[1] : null;
};

const manifest = JSON.parse(grab('manifest'));
const ext = JSON.parse(grab('ext_resources') || '[]');
let template = JSON.parse(grab('template'));

const EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg',
  'image/gif': 'gif', 'image/avif': 'avif', 'font/woff2': 'woff2', 'font/woff': 'woff',
  'font/ttf': 'ttf', 'application/javascript': 'js', 'text/javascript': 'js',
  'text/css': 'css', 'video/mp4': 'mp4', 'audio/mpeg': 'mp3',
};

const idByUuid = Object.fromEntries(ext.map((e) => [e.uuid, e.id]));
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });

const rel = {};
for (const [uuid, entry] of Object.entries(manifest)) {
  let bytes = Buffer.from(entry.data, 'base64');
  if (entry.compressed) bytes = zlib.gunzipSync(bytes);

  const suffix = EXT[entry.mime] || 'bin';
  let base = idByUuid[uuid];
  if (base) {
    // id бывает URL (вендорные библиотеки) — берём только имя файла
    base = base.split('/').pop().replace(/[^A-Za-z0-9._-]/g, '_');
    if (base.toLowerCase().endsWith('.' + suffix)) base = base.slice(0, -(suffix.length + 1));
  } else {
    // Безымянный ресурс: хэш содержимого, а не uuid — uuid меняется при каждом
    // экспорте, хэш не меняется, пока не изменился сам файл.
    base = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 10);
  }

  const name = base + '.' + suffix;
  fs.writeFileSync(path.join(out, 'assets', name), bytes);
  rel[uuid] = 'assets/' + name;
}

for (const [uuid, r] of Object.entries(rel)) template = template.split(uuid).join(r);

const resources = {};
for (const e of ext) if (rel[e.uuid]) resources[e.id] = rel[e.uuid];
const inject = '<script>window.__resources = ' +
  JSON.stringify(resources).replace(/<\//g, '<\\/') + ';<\/script>';
const head = template.match(/<head[^>]*>/i);
if (head) {
  const i = head.index + head[0].length;
  template = template.slice(0, i) + '\n' + inject + template.slice(i);
}

fs.writeFileSync(path.join(out, 'index.html'), template);
console.error(`${Object.keys(rel).length} ресурсов → ${out}/assets, index.html ${template.length} Б`);
