#!/usr/bin/env node
// Assembles site/ from site-src/ (see tools/README.md). No dependencies beyond Node.
//
//   node tools/build-site.mjs           write site/index.html, site/css/site.css, site/js/site.js (+ lazy scripts)
//   node tools/build-site.mjs --check   build in memory and fail if the committed output differs
//
// Partials are concatenated in filename order (names start with a two-digit number):
//   site-src/sections/*.html -> site/index.html (comments and indentation stripped)
//   site-src/css/*.css       -> site/css/site.css (whitespace and comments stripped)
//   site-src/css/lazy/*.css  -> site/css/<name>.css (same minifier, loaded on demand)
//   site-src/js/*.js         -> site/js/site.js   (all files share one scope, wrapped in a single IIFE)
//   site-src/js/lazy/*.js    -> site/js/<name>.js (copied as they are, loaded on demand)

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderWork, verifyWork } from './render-work.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (...p) => path.join(repo, 'site-src', ...p);
const out = (...p) => path.join(repo, 'site', ...p);
const check = process.argv.includes('--check');

async function list(dir, ext) {
  let names;
  try { names = await readdir(dir, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  return names.filter((d) => d.isFile() && d.name.endsWith(ext)).map((d) => d.name).sort();
}
async function concat(dir, ext) {
  const names = await list(dir, ext);
  if (!names.length) throw new Error(`no ${ext} files in ${dir}`);
  return Promise.all(names.map((n) => readFile(path.join(dir, n), 'utf8')));
}

const files = new Map(); // output path -> contents

// The rail is generated here, from the data-rail-* attributes on each <section data-room>, so its thumbnails are in the HTML
// (images injected by script were discovered late and delayed the hero image's paint under Lighthouse's throttling).
// Rooms (section[data-room]) become thumbnails in <ol class="rail__rooms">: data-rail-src (path stem of the -480 and -960 webp files)
// and data-rail-ratio, or data-rail-text for a text chip. A normal-flow section after the rooms (outside .rooms) gets a text chip
// in <ol class="rail__chips"> by carrying data-rail-text and an id, so a chip exists only when its section does.
function railItems(html) {
  const esc = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const rooms = [], chips = [];
  for (const m of html.matchAll(/<section\b[^>]*\b(?:data-room|data-rail-text)\b[^>]*>/g)) {
    const attr = (n) => (m[0].match(new RegExp(`\\s${n}="([^"]*)"`)) || [])[1];
    const id = attr('id'), isRoom = /\sdata-room[\s>=]/.test(m[0]);
    if (!id) throw new Error('a section[data-room] needs an id: ' + m[0]);
    const label = attr('data-rail-label') || attr('data-rail-text') || id, text = attr('data-rail-text');
    let inner, cls = 'rail__i';
    if (text) { cls += ' rail__i--txt'; inner = esc(text); }
    else {
      const stem = attr('data-rail-src'), w = Math.round(34 * (parseFloat(attr('data-rail-ratio')) || 1));
      if (!stem) throw new Error('section#' + id + ' needs data-rail-src or data-rail-text');
      inner = `<img src="${stem}-rail.webp" width="${w}" height="34" alt="">`; // tiny file from tools/build-rail.mjs
    }
    const list = isRoom ? rooms : chips;
    list.push(`      <li><a href="#${id}" class="${cls}" aria-label="${esc(label)}"${isRoom && !rooms.length ? ' aria-current="true"' : ''}>${inner}</a></li>`);
  }
  return { rooms: rooms.join('\n'), chips: chips.join('\n') };
}
let html = (await concat(src('sections'), '.html')).join('');
// "On the clock": the section's content is rendered from site/work/work.json (tools/render-work.mjs) and checked against it; a mismatch fails the build.
if (html.includes('<!--@on-the-clock-->')) {
  const work = JSON.parse(await readFile(out('work', 'work.json'), 'utf8'));
  html = html.replace('<!--@on-the-clock-->', renderWork(work));
  const sec = html.match(/<section\b[^>]*id="on-the-clock"[\s\S]*?<\/section>/)[0];
  verifyWork(sec, work);
}
const rail = railItems(html);
html = html.replace('<!--@rail-rooms-->', `\n${rail.rooms}\n    `).replace('<!--@rail-chips-->', `\n${rail.chips}\n    `);
// Comments and indentation are stripped (a newline stays wherever there was whitespace, so inline spacing is unchanged):
// the document is on the first-paint path, and every kilobyte before the hero still counts on a slow connection.
html = html.replace(/<!--(?!@)[\s\S]*?-->/g, '').replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n');
files.set(out('index.html'), html);

const css = await concat(src('css'), '.css');
const cssNames = await list(src('css'), '.css');
// Whitespace and comments are stripped (strings are kept as they are): the stylesheet blocks first paint, so its bytes count.
function minCss(c) {
  const keep = [];
  // one pass over comments and strings, so an apostrophe inside a comment is never read as the start of a string
  c = c.replace(/\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => (m[0] === '/' ? ' ' : `\u0001${keep.push(m) - 1}\u0001`));
  c = c.replace(/\s+/g, ' ').replace(/ ?([{};]) ?/g, '$1').replace(/: /g, ':').replace(/;}/g, '}').trim();
  return c.replace(/\u0001(\d+)\u0001/g, (_, i) => keep[i]) + '\n';
}
files.set(out('css', 'site.css'), css.map(minCss).join(''));
for (const n of await list(src('css', 'lazy'), '.css')) {
  files.set(out('css', n), minCss(await readFile(src('css', 'lazy', n), 'utf8')));
}

const js = await concat(src('js'), '.js');
const jsNames = await list(src('js'), '.js');
files.set(
  out('js', 'site.js'),
  `(function () {\n'use strict';\n\n${js.map((c, i) => `/* ${jsNames[i]} */\n${c.replace(/\n*$/, '\n')}`).join('\n')}})();\n`
);

for (const n of await list(src('js', 'lazy'), '.js')) {
  files.set(out('js', n), await readFile(src('js', 'lazy', n), 'utf8'));
}

// Font guard: site/fonts/*.woff2 are subsets (tools/subset-fonts.py). tools/font-src/chars.txt lists the characters they
// were cut for; text using any other character fails the build, so a glyph can never silently fall back to a system font.
// After re-running subset-fonts.py, refresh the list with: node tools/build-site.mjs --font-chars
{
  const charsFile = path.join(repo, 'tools', 'font-src', 'chars.txt');
  const used = new Set();
  const texts = [...files.values()];
  for (const f of ['work/work.json', 'art/projects.json', 'art/embedding.json']) texts.push(await readFile(out(...f.split('/')), 'utf8'));
  for (const t of texts) {
    for (const ch of t) used.add(ch);
    for (const m of t.matchAll(/&#x([0-9a-f]+);|&#(\d+);|\\u([0-9a-fA-F]{4})/g)) used.add(String.fromCodePoint(m[1] ? parseInt(m[1], 16) : m[2] ? +m[2] : parseInt(m[3], 16)));
    for (const [ent, ch] of [['&nbsp;', '\u00a0'], ['&middot;', '\u00b7'], ['&mdash;', '\u2014'], ['&ndash;', '\u2013'], ['&times;', '\u00d7'], ['&rarr;', '\u2192'], ['&larr;', '\u2190'], ['&hellip;', '\u2026']]) if (t.includes(ent)) used.add(ch);
  }
  for (const c of ['\n', '\r', '\t']) used.delete(c);
  if (process.argv.includes('--font-chars')) {
    await writeFile(charsFile, [...used].sort().join(''));
    console.log('wrote tools/font-src/chars.txt', used.size, 'characters');
  } else {
    const have = new Set(await readFile(charsFile, 'utf8'));
    const extra = [...used].filter((c) => !have.has(c) && !(c >= ' ' && c <= '~'));
    if (extra.length) {
      console.error('build-site: characters not in the subset fonts: ' + extra.map((c) => JSON.stringify(c) + ' U+' + c.codePointAt(0).toString(16)).join(', ') + '\nRun python3 tools/subset-fonts.py, then node tools/build-site.mjs --font-chars');
      process.exit(1);
    }
  }
}

if (check) {
  const bad = [];
  for (const [file, text] of files) {
    let disk = null;
    try { disk = await readFile(file, 'utf8'); } catch { /* missing */ }
    if (disk !== text) bad.push(path.relative(repo, file));
  }
  if (bad.length) {
    console.error('build-site --check: committed output is out of date for:\n  ' + bad.join('\n  ') + '\nRun: node tools/build-site.mjs');
    process.exit(1);
  }
  console.log(`build-site --check: ok (${files.size} files up to date)`);
} else {
  for (const [file, text] of files) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
    console.log('wrote', path.relative(repo, file), `${Buffer.byteLength(text)} bytes`);
  }
}
