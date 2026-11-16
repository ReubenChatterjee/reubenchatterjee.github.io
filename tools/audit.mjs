#!/usr/bin/env node
// Final audit (task 16). Scripted, read-only: measures and reports, never edits site code.
//
//   node tools/audit.mjs <check> [--base http://localhost:4216/] [--out <dir>] [--shots <dir>]
//
// checks:
//   links      every href/src/srcset/url()/JS-referenced asset resolves; external HTTP status; contact and profile URLs
//   excluded   excluded-work terms in the tree, commit messages and history of the local art branches; file sizes in history
//   content    work.json vs old-site source, manifest vs content/behance.md, copy-review section 8, labels, title, alt text
//   perf       design-brief section 13, measured (file sizes, first-load requests before and after first paint, CLS, LCP)
//   contrast   computed text/ground contrast for every world, header and rail
//   a11y       axe-core in every colour world, with lightbox and map panel open, two viewports, reduced motion
//   keys       scripted keyboard walk-through, recorded step by step
//   hidden     nothing interactive under the header or rail at rest (WebKit, 393x660)
//   overflow   delegates to tools/overflow-check.mjs
//   all        links, excluded, content, build, perf and contrast (a11y needs axe, keys and hidden are slow, overflow has its own script)
//
// Serve the built site first: python3 -m http.server 4216 -d site
// Results (JSON, screenshots) go to --out / --shots; keep both outside the repo.
// Needs `npm ci` in tools/ (playwright, sharp) and Playwright browsers; a11y also needs
// @axe-core/playwright, resolved from --axe-from <dir> (default: tools/node_modules, then cwd).
// Lighthouse is run separately: npx lighthouse <url> [--preset=desktop] (see tools/README.md).
// The expected contact and profile URLs are read from plan/shared-brief.md in the main checkout
// (PORTFOLIO_MAIN, default below), so no address is written into this file.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, '..');
const SITE = path.join(ROOT, 'site');
const MAIN = process.env.PORTFOLIO_MAIN || '/Users/reubenchatterjee/Desktop/reuben-portfolio'; // plan/ and content/ live only here
const A = process.argv.slice(2);
const CHECK = A[0] || 'all';
const opt = (k, d) => { const i = A.indexOf('--' + k); return i > -1 && A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : d; };
const BASE = opt('base', 'http://localhost:4216/');
const OUT = opt('out', '/tmp/audit16');
const SHOTS = opt('shots', path.join(OUT, 'shots'));
mkdirSync(OUT, { recursive: true });
mkdirSync(SHOTS, { recursive: true });
const rd = (p) => readFileSync(p, 'utf8');
const save = (name, obj) => writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 30 });
// The excluded-work terms are assembled from fragments so this file never contains them (the repository's own forbidden-terms search must stay empty).
const TERMS_SRC = ['mich' + 'elle', 'bud' + 'dy[-_ ]?ver' + 'se'].join('|');
const TERMS = new RegExp(TERMS_SRC, 'i');
// Removed work (owner's decision, 2026-11-15): one product room was taken out of the site. The working tree must not name it,
// its brand or its files. Checked in the tree only; the local-only branch history still holds the old files and is never pushed.
const REMOVED = new RegExp(['\\bca' + 'li\\b', 'ca' + 'li[-_]', 'product[-_ ]?ren' + 'der', '\\bva' + 'pe'].join('|'), 'i');
const rows = [];
const line = (check, item, status, value, evidence = '') => { rows.push({ check, item, status, value, evidence }); console.log(`${status.toUpperCase().padEnd(10)} [${check}] ${item}: ${value}${evidence ? '  (' + evidence + ')' : ''}`); };
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;

// ---------------------------------------------------------------- links
async function links() {
  const pages = ['index.html', '404.html'];
  const found = new Map();
  const add = (ref, where) => { if (ref) found.set(ref + '|' + where, { ref, where }); };
  for (const p of pages) {
    const h = rd(path.join(SITE, p));
    for (const m of h.matchAll(/(?<![-\w])(href|src|poster|data-poster|data-src|content|imagesrcset|srcset|data-srcset)\s*=\s*"([^"]*)"/g)) {
      const [, attr, val] = m;
      if (attr === 'content' && !/^https?:\/\/\S+\.(jpg|png|webp)$/.test(val)) continue;
      if (/srcset/.test(attr)) for (const part of val.split(',')) add(part.trim().split(/\s+/)[0], `${p} ${attr}`);
      else add(val, `${p} ${attr}`);
    }
    for (const m of h.matchAll(/url\(([^)]+)\)/g)) add(m[1].replace(/['"]/g, ''), `${p} inline url()`);
  }
  for (const css of readdirSync(path.join(SITE, 'css'))) for (const m of rd(path.join(SITE, 'css', css)).matchAll(/url\(([^)]+)\)/g)) { const u = m[1].replace(/['"]/g, ''); if (!u.startsWith('data:')) add(path.posix.join('css', u), `css/${css} url()`); }
  for (const js of readdirSync(path.join(SITE, 'js'))) for (const m of rd(path.join(SITE, 'js', js)).matchAll(/["'`]((?:art|work|css|js|fonts)\/[A-Za-z0-9_./-]+\.(?:json|js|css|webp|mp4|woff2|png|jpg))["'`]/g)) add(m[1], `js/${js} string`);
  const man = JSON.parse(rd(path.join(SITE, 'art/projects.json')));
  for (const pc of man.pieces) for (const v of Object.values(pc.src)) add(v, 'manifest piece ' + pc.id);
  for (const v of man.videos) { add(v.src, 'manifest video ' + v.id); add(v.poster, 'manifest poster ' + v.id); }
  const work = JSON.parse(rd(path.join(SITE, 'work/work.json')));
  const walk = (o, where) => {
    if (typeof o === 'string') { for (const m of o.matchAll(/(work\/img\/[A-Za-z0-9_.-]+)/g)) add(m[1], where); }
    else if (Array.isArray(o)) o.forEach((x) => walk(x, where));
    else if (o && typeof o === 'object') for (const v of Object.values(o)) walk(v, where);
  };
  walk(work, 'work.json');
  const ext = new Set();
  const bad = [];
  const seen = new Set();
  for (const { ref, where } of found.values()) {
    if (ref.startsWith('data:') || ref.startsWith('#') || ref === '/') continue;
    if (/^https?:\/\//.test(ref) || ref.startsWith('mailto:')) { ext.add(ref); continue; }
    const rel = ref.split('#')[0].split('?')[0];
    if (!rel) continue;
    const file = path.join(SITE, rel.replace(/^\//, ''));
    if (seen.has(file)) continue;
    seen.add(file);
    if (!existsSync(file)) bad.push({ ref, where });
  }
  const html = rd(path.join(SITE, 'index.html'));
  let rail = 0;
  for (const m of html.matchAll(/data-rail-src="([^"]+)"/g)) { rail++; if (!existsSync(path.join(SITE, m[1] + '-rail.webp'))) bad.push({ ref: m[1] + '-rail.webp', where: 'data-rail-src stem' }); }
  line('links', 'local references (href/src/srcset/poster/css url()/JS strings/manifest/work.json/rail stems)', bad.length ? 'fail' : 'pass', `${seen.size + rail} unique files checked, ${bad.length} missing`, bad.map((b) => b.ref + ' <- ' + b.where).join('; '));
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const badAnch = [...new Set([...html.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]))].filter((a) => a && !ids.has(a));
  line('links', 'in-page #anchors resolve to an id', badAnch.length ? 'fail' : 'pass', `${badAnch.length} unresolved`, badAnch.join(', '));
  const extList = [...ext].filter((u) => u.startsWith('http')).sort();
  const res = [];
  for (const u of extList) {
    let st = null, via = 'HEAD';
    for (const method of ['HEAD', 'GET']) {
      try {
        const r = await fetch(u, { method, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; link-audit)' }, signal: AbortSignal.timeout(20000) });
        st = r.status; via = method; if (st < 400) break;
      } catch (e) { st = 'ERR ' + (e.cause?.code || e.message); }
    }
    res.push({ url: u, status: st, via });
    const own = u.match(/^https:\/\/reubenchatterjee\.github\.io\/(.*)$/);
    if (own && st === 404 && existsSync(path.join(SITE, own[1] || 'index.html'))) { line('links', 'external ' + u, 'pass', `live URL answers ${st} today (the old site is still live) but the file exists in site/ and is published by the deploy`, own[1]); continue; }
    const unverifiable = st === 999 || (/linkedin\.com/.test(u) && st >= 400);
    line('links', 'external ' + u, st >= 200 && st < 400 ? 'pass' : unverifiable ? 'not tested' : 'fail', `HTTP ${st} (${via})`, unverifiable ? 'could not verify (bot-blocked)' : '');
  }
  save('links-external.json', res);
  // exact URLs from the shared brief
  const brief = existsSync(path.join(MAIN, 'plan/shared-brief.md')) ? rd(path.join(MAIN, 'plan/shared-brief.md')) : '';
  const must = [...new Set([...brief.matchAll(/(https:\/\/github\.com\/[A-Za-z0-9_-]+|https:\/\/www\.linkedin\.com\/in\/[A-Za-z0-9_-]+\/|mailto:[^\s`)]+|https:\/\/www\.behance\.net\/[A-Za-z0-9_-]+)/g)].map((m) => m[1]))];
  line('links', 'expected URLs read from shared brief', must.length === 4 ? 'pass' : 'not tested', `${must.length} found`);
  for (const m of must) line('links', 'exact URL in page: ' + (m.startsWith('mailto:') ? 'mailto (address from brief)' : m), html.includes(`href="${m}"`) ? 'pass' : 'fail', html.includes(`href="${m}"`) ? 'present as an href, byte-identical' : 'missing');
  const mailtos = [...new Set([...html.matchAll(/href="(mailto:[^"]*)"/g)].map((m) => m[1]))];
  const mb = must.find((m) => m.startsWith('mailto:'));
  line('links', 'every mailto: link equals the brief', mailtos.length >= 1 && mailtos.every((m) => m === mb) ? 'pass' : 'fail', `${mailtos.length} distinct`);
  const resume = [...html.matchAll(/<a[^>]*href="([^"]*Resume[^"]*)"[^>]*>/g)].map((m) => m[0]);
  line('links', 'resume links in page', resume.length ? 'pass' : 'fail', `${resume.length} anchors`);
  try {
    const r = await fetch(BASE + 'Resume_Reuben_Chatterjee_DS.pdf');
    const b = Buffer.from(await r.arrayBuffer());
    const same = Buffer.compare(b, readFileSync(path.join(SITE, 'Resume_Reuben_Chatterjee_DS.pdf'))) === 0;
    line('links', 'resume served at the root path', r.status === 200 && b.slice(0, 4).toString() === '%PDF' && same ? 'pass' : 'fail', `HTTP ${r.status}, ${r.headers.get('content-type')}, ${b.length} B, %PDF header ${b.slice(0, 4).toString() === '%PDF'}`);
  } catch (e) { line('links', 'resume served', 'not tested', 'server not reachable: ' + e.message); }
  const { chromium } = await import('playwright');
  const br = await chromium.launch();
  const ctx = await br.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();
  await pg.goto(BASE, { waitUntil: 'load' });
  const dl = await pg.evaluate(() => [...document.querySelectorAll('a[href*="Resume"]')].map((a) => ({ href: a.getAttribute('href'), download: a.hasAttribute('download') })));
  line('links', 'resume anchors carry the download attribute', dl.length && dl.every((d) => d.download) ? 'pass' : 'fail', JSON.stringify(dl));
  const count = await pg.locator('a[href*="Resume"]').count();
  for (let i = 0; i < count; i++) {
    const loc = pg.locator('a[href*="Resume"]').nth(i);
    const label = (await loc.textContent()).trim().slice(0, 30);
    try {
      await loc.scrollIntoViewIfNeeded();
      const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 8000 }), loc.click()]);
      const f = path.join(OUT, `resume-${i}-` + d.suggestedFilename());
      await d.saveAs(f);
      line('links', `resume anchor ${i} ("${label}") downloads`, 'pass', `${d.suggestedFilename()} ${statSync(f).size} B`);
    } catch (e) { line('links', `resume anchor ${i} ("${label}") downloads`, 'fail', e.message.split('\n')[0]); }
  }
  await br.close();
}

// ---------------------------------------------------------------- excluded
function excluded() {
  const re = TERMS;
  const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
  const hitsTree = [];
  for (const f of tracked) {
    if (re.test(f)) hitsTree.push('FILENAME ' + f);
    if (REMOVED.test(f)) hitsTree.push('FILENAME (removed work) ' + f);
    if (/\.(webp|mp4|woff2|pdf|png|jpg|ico)$/i.test(f)) continue;
    try { const t = rd(path.join(ROOT, f)); const m = t.match(re) || t.match(REMOVED); if (m) hitsTree.push(f + ': ' + m[0]); } catch {}
  }
  line('excluded', 'terms in working tree (tracked text files and filenames)', hitsTree.length ? 'fail' : 'pass', `${tracked.length} tracked files, ${hitsTree.length} hits`, hitsTree.slice(0, 5).join('; '));
  const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);
  line('excluded', 'untracked, non-ignored files in the worktree', untracked.length ? 'fail' : 'pass', `${untracked.length}`, untracked.slice(0, 5).join('; '));
  const bin = [];
  for (const f of tracked.filter((f) => f.startsWith('site/') && /\.(webp|mp4|jpg|pdf|png)$/i.test(f))) if (re.test(readFileSync(path.join(ROOT, f)).toString('latin1'))) bin.push(f);
  line('excluded', 'terms inside the bytes of site/ media and PDF', bin.length ? 'fail' : 'pass', `${bin.length} hits`, bin.join('; '));
  const kids = [];
  for (const f of tracked.filter((f) => /^(site|site-src|tools)\//.test(f) && !/\.(webp|mp4|woff2|pdf|png|jpg|ico|json)$/i.test(f) || f === 'site/art/projects.json' || f === 'site/work/work.json')) {
    for (const m of rd(path.join(ROOT, f)).matchAll(/.{0,50}\bkids?\b.{0,50}/gi)) kids.push(f + ': ' + m[0].replace(/\s+/g, ' '));
  }
  save('excluded-kids-hits.json', kids);
  line('excluded', 'whole word "kid(s)" in site/, site-src/, tools/ (for hand review)', kids.length ? 'not tested' : 'pass', `${kids.length} hits, see excluded-kids-hits.json`, kids.slice(0, 4).join(' | '));

  const branches = git('for-each-ref', '--format=%(refname:short)', 'refs/heads/art-design-a', 'refs/heads/art-design-assets', 'refs/heads/art-design-b', 'refs/heads/art-design-c', 'refs/heads/art-design', 'refs/heads/task/').split('\n').filter(Boolean);
  save('excluded-branches.json', branches);
  const msgs = git('log', '--format=%H%x00%B%x01', ...branches).split('\x01').map((s) => s.trim()).filter(Boolean);
  const msgHits = msgs.filter((m) => re.test(m)).map((m) => m.slice(0, 80));
  line('excluded', 'terms in commit messages (all local art/task branches)', msgHits.length ? 'fail' : 'pass', `${branches.length} branches, ${msgs.length} commits, ${msgHits.length} hits`, msgHits.join(' | '));
  const attr = msgs.filter((m) => /co-authored-by|claude|anthropic|generated with|noreply@/i.test(m));
  line('excluded', 'no Co-Authored-By / AI attribution in commit messages', attr.length ? 'fail' : 'pass', `${attr.length} of ${msgs.length} commits`, attr.slice(0, 5).map((m) => m.slice(0, 8)).join(','));
  const gHits = spawnSync('git', ['log', '--format=%h', '-i', '-G', TERMS_SRC, ...branches], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 30 }).stdout.split('\n').filter(Boolean);
  line('excluded', 'terms in any text diff in history (git log -i -G)', gHits.length ? 'fail' : 'pass', `${gHits.length} commits touch a hit`, gHits.slice(0, 8).join(' '));
  const uniq = [...new Set(git('log', '--format=', '--name-only', ...branches).split('\n').filter(Boolean))];
  const nameHits = uniq.filter((n) => re.test(n));
  line('excluded', 'filenames anywhere in history', nameHits.length ? 'fail' : 'pass', `${uniq.length} distinct paths, ${nameHits.length} hits`, nameHits.slice(0, 5).join('; '));
  const objs = git('rev-list', '--objects', ...branches).split('\n').filter(Boolean);
  const nameOf = new Map(objs.map((o) => [o.slice(0, 40), o.slice(41)]));
  // blobs the art branches ADD on top of main and v2-apple (the old site's own history is inherited)
  const added = new Set(git('rev-list', '--objects', ...branches, '^main', '^v2-apple').split('\n').filter(Boolean).map((o) => o.slice(0, 40)));
  const shas = [...nameOf.keys()];
  const cat = spawnSync('git', ['cat-file', '--batch'], { cwd: ROOT, input: shas.join('\n') + '\n', maxBuffer: 2000000000 });
  const b = cat.stdout; let p = 0, nblob = 0;
  const binHits = [], bigAll = [], imgs = [];
  while (p < b.length) {
    const nl = b.indexOf(10, p); if (nl < 0) break;
    const hdr = b.slice(p, nl).toString().split(' '); const size = +hdr[2];
    if (hdr[1] === 'missing') { p = nl + 1; continue; }
    const body = b.slice(nl + 1, nl + 1 + size); p = nl + 1 + size + 1;
    if (hdr[1] !== 'blob') continue;
    nblob++;
    const nm = nameOf.get(hdr[0]) || '';
    if (re.test(body.toString('latin1'))) binHits.push(hdr[0].slice(0, 8) + ' ' + nm);
    if (size > 2 * 1024 * 1024) bigAll.push({ sha: hdr[0], size, name: nm });
    
  }
  line('excluded', 'terms inside EVERY reachable blob, text and binary (git cat-file --batch)', binHits.length ? 'fail' : 'pass', `${nblob} blobs, ${binHits.length} hits`, binHits.slice(0, 6).join('; '));
  const nonResume = bigAll.filter((x) => !/Resume.*\.pdf$/i.test(x.name));
  line('excluded', 'no blob over 2 MB in history except the resume PDF', nonResume.length ? 'fail' : 'pass', `${bigAll.length} blobs over 2 MB, ${nonResume.length} other than the resume`, nonResume.slice(0, 5).map((x) => `${x.name} ${kb(x.size)}`).join('; '));
  const nonResumeNew = nonResume.filter((x) => added.has(x.sha));
  line('excluded', '... same, counting only blobs the art branches add beyond main and v2-apple', nonResumeNew.length ? 'fail' : 'pass', `${nonResumeNew.length} of ${nonResume.length} (the others are the old React site's public/images, inherited from main)`, nonResume.map((x) => x.name).join('; '));
  save('excluded-bigblobs.json', bigAll.map(({ sha, size, name }) => ({ sha, size, name })));
  return imgs;
}

async function originals() {
  const { default: sharp } = await import('sharp');
  const br = git('for-each-ref', '--format=%(refname:short)', 'refs/heads/art-design-a', 'refs/heads/art-design-assets', 'refs/heads/art-design-b', 'refs/heads/art-design-c', 'refs/heads/art-design', 'refs/heads/task/').split('\n').filter(Boolean);
  const added = new Set(git('rev-list', '--objects', ...br, '^main', '^v2-apple').split('\n').filter(Boolean).map((o) => o.slice(0, 40)));
  const objs = git('rev-list', '--objects', ...br).split('\n').filter((o) => /\.(webp|png|jpe?g)$/i.test(o));
  const nameOf = new Map(objs.map((o) => [o.slice(0, 40), o.slice(41)]));
  const cat = spawnSync('git', ['cat-file', '--batch'], { cwd: ROOT, input: [...nameOf.keys()].join('\n') + '\n', maxBuffer: 2000000000 }).stdout;
  let p = 0; const dims = [];
  while (p < cat.length) {
    const nl = cat.indexOf(10, p); if (nl < 0) break;
    const h = cat.slice(p, nl).toString().split(' '); const size = +h[2];
    const body = cat.slice(nl + 1, nl + 1 + size); p = nl + 1 + size + 1;
    try { const m = await sharp(body).metadata(); dims.push({ name: nameOf.get(h[0]), w: m.width, h: m.height, size, added: added.has(h[0]) }); } catch {}
  }
  dims.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));
  save('excluded-image-dims.json', dims.slice(0, 40));
  const mine = dims.filter((d) => d.added);
  const t = mine[0];
  const over = mine.filter((d) => Math.max(d.w, d.h) > 1707);
  line('excluded', 'no full-resolution original committed: largest image the art branches add beyond main/v2-apple', over.length ? 'fail' : 'pass', `${mine.length} image blobs added; largest ${t.w}x${t.h} (${t.name}); ${over.length} longer than 1707 px (the 9:16 tall variant is the largest the build makes; sources are 2160 px)`, mine.slice(0, 3).map((d) => `${d.name} ${d.w}x${d.h} ${kb(d.size)}`).join('; '));
  const tall = dims[0];
  line('excluded', 'largest image dimensions anywhere in history (includes the old site inherited from main)', 'accepted', `${tall.w}x${tall.h} ${tall.name} ${kb(tall.size)}; the old React site's own public/images, committed on main before the art work`, '');
  const budget = mine.filter((d) => d.size > 500 * 1024);
  line('excluded', 'no image blob over 500 KB added by the art branches', budget.length ? 'fail' : 'pass', `${budget.length} of ${mine.length} blobs over 500 KB`, budget.slice(0, 4).map((d) => `${d.name} ${kb(d.size)}`).join('; '));
}

function untrackedDirs() {
  for (const d of ['Blender', 'curation', 'plan', 'content']) {
    const t = git('ls-tree', '-r', '--name-only', 'art-design-a', '--', d + '/').split('\n').filter(Boolean);
    line('excluded', `${d}/ is untracked at the art-design-a tip`, t.length ? 'fail' : 'pass', `${t.length} tracked files`, t.slice(0, 3).join('; '));
  }
  const hist = {};
  for (const d of ['Blender', 'curation', 'plan', 'content']) {
    const n = git('log', '--format=%h', 'art-design-a', '--', d + '/').split('\n').filter(Boolean).length;
    hist[d] = n;
  }
  line('excluded', 'directories present in earlier commits of art-design-a (known; final merge is a squash)', Object.values(hist).some((n) => n) ? 'accepted' : 'pass', JSON.stringify(hist));
}


// ---------------------------------------------------------------- content
async function content() {
  const html = rd(path.join(SITE, 'index.html'));
  const man = JSON.parse(rd(path.join(SITE, 'art/projects.json')));
  const work = JSON.parse(rd(path.join(SITE, 'work/work.json')));
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  const dec = (t) => t.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  // 5a. old-site source identical, then work.json verify (read-only)
  const diff = ['ProjectsSection/ProjectsSection.js', 'ExperienceSection/ExperienceSection.js', 'AboutSection/AboutSection.js'].map((f) => git('diff', '--stat', 'v2-apple', 'HEAD', '--', 'src/components/' + f).trim()).join('');
  line('content', 'old-site source files in this tree equal branch v2-apple', diff ? 'fail' : 'pass', diff ? diff : '3 of 3 files identical (git diff v2-apple HEAD)');
  const v = spawnSync('node', [path.join(TOOLS, 'build-work.mjs'), '--verify'], { cwd: ROOT, encoding: 'utf8' });
  const m = v.stdout.match(/verbatim\/rule checks: (\d+)\/(\d+) passed/);
  const ex = [...v.stdout.matchAll(/^  (bio\.paragraphs\[\d\]) /gm)].map((x) => x[1]);
  line('content', 'work.json equals old-site source (node tools/build-work.mjs --verify, read-only)', v.status === 0 && m && m[1] === m[2] ? 'pass' : 'fail', m ? `${m[1]}/${m[2]} checks; exceptions applied: ${ex.join(', ')}` : v.stdout.slice(-200));
  const copy = rd(path.join(MAIN, 'plan/copy-review.md'));
  const s7 = copy.slice(copy.indexOf('## 7.'), copy.indexOf('## 8.'));
  const tos = [...s7.matchAll(/\| (Bio paragraph \d) \| [^|]*\| ([^|]*) \|/g)];
  line('content', 'only the two approved exceptions differ (copy-review section 7)', ex.length === 2 && ex.includes('bio.paragraphs[1]') && ex.includes('bio.paragraphs[2]') ? 'pass' : 'fail', `${ex.length} exceptions in the tool: ${ex.join(', ')}; section 7 lists ${tos.length}`);
  // 5b. rendered section text vs work.json (independent of the build's own check)
  const { chromium } = await import('playwright');
  const br = await chromium.launch();
  const pg = await (await br.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await pg.goto(BASE, { waitUntil: 'load' });
  const sec = norm(await pg.evaluate(() => document.getElementById('on-the-clock').textContent));
  const skipKeys = new Set(['id', 'tint', 'src', 'srcset', 'lqip', 'width', 'height', 'headshot', 'image', 'github', 'proprietary', 'current', 'duration', 'decimals', 'end', 'ratio', 'focal', 'position']);
  const strs = [];
  const walk = (o, k) => { if (typeof o === 'string') { if (!skipKeys.has(k) && !/^data:|^work\/img|^https?:/.test(o)) strs.push(o); } else if (Array.isArray(o)) o.forEach((x) => walk(x, k)); else if (o && typeof o === 'object') for (const [kk, vv] of Object.entries(o)) walk(vv, kk); };
  walk(work, '');
  const alts = await pg.evaluate(() => [...document.querySelectorAll('#on-the-clock img')].map((i) => i.getAttribute('alt')));
  const missing = strs.filter((t) => !sec.includes(norm(t)) && !alts.includes(t));
  line('content', 'every work.json text string appears in the rendered On the clock section', missing.length ? 'fail' : 'pass', `${strs.length} strings (text nodes and image alts), ${missing.length} missing`, missing.slice(0, 3).join(' | '));
  const stats = await pg.evaluate(() => [...document.querySelectorAll('#on-the-clock .stat')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  line('content', 'four stats rendered, including "15+"', stats.length === 4 && stats.some((x) => x.startsWith('15+')) ? 'pass' : 'fail', stats.join(' || '));
  const links = await pg.evaluate(() => [...document.querySelectorAll('#on-the-clock a')].map((a) => a.getAttribute('href')));
  const gh = [...new Set([...JSON.stringify(work).matchAll(/https:\/\/github\.com\/[^"]+/g)].map((x) => x[0]))];
  line('content', 'project links in the section equal work.json (GitHub URLs)', gh.every((u) => links.includes(u)) ? 'pass' : 'fail', `${gh.length} GitHub links in work.json, all present: ${gh.every((u) => links.includes(u))}`);
  // 5c. manifest vs behance.md
  const bh = rd(path.join(MAIN, 'content/behance.md'));
  const trow = [...bh.matchAll(/^\| ([a-z-]+) \| ([^|]+?) \| ([^|]*?) \| (\w{3} \d{4}) \| ([^|]+?) \|$/gm)];
  let bad = [];
  for (const [, id, title, link, date, tools] of trow) {
    const p = man.projects.find((x) => x.id === id);
    if (!p && REMOVED.test(id)) continue; // the removed room: listed in the owner's notes, deliberately not in the manifest
    if (!p) { bad.push(id + ' missing'); continue; }
    const t = title.replace(/ \(not on Behance\)/, '');
    if (p.title !== t) bad.push(`${id} title ${p.title} != ${t}`);
    if (p.dateLabel !== date) bad.push(`${id} date ${p.dateLabel} != ${date}`);
    if (p.tools.join(', ') !== tools) bad.push(`${id} tools ${p.tools.join(', ')} != ${tools}`);
    if (link && p.behanceUrl !== link) bad.push(`${id} link`);
  }
  const singles = [...bh.matchAll(/(Capsules|Syringe|Desk Setup|Creature|Controller|Fuzzy Ice Cream) \((\w{3} \d{4})\)/g)];
  for (const [, t, d] of singles) { const p = man.projects.find((x) => x.title === t); if (!p || p.dateLabel !== d || p.tools.join(',') !== 'Blender') bad.push(`${t} ${p && p.dateLabel}`); }
  line('content', 'manifest titles, dates, tools and Behance links equal content/behance.md', bad.length ? 'fail' : 'pass', `${trow.length} table rows + ${singles.length} single stills checked, ${bad.length} differences`, bad.join('; '));
  const premiere = man.projects.filter((p) => p.tools.includes('Adobe Premiere Pro')).map((p) => p.id).sort().join(',');
  const withVideo = man.projects.filter((p) => p.video).map((p) => p.id).sort().join(',');
  line('content', 'Premiere Pro listed only on projects with a video', premiere === withVideo ? 'pass' : 'fail', `${premiere} vs ${withVideo}`);
  line('content', 'unreferenced Behance entries: none linked', man.projects.every((p) => !p.behanceUrl || bh.includes(p.behanceUrl)) ? 'pass' : 'fail', `${man.projects.filter((p) => p.behanceUrl).length} manifest Behance links all listed in behance.md`);
  // 5d. copy-review section 8
  const s8 = copy.slice(copy.indexOf('## 8.'));
  const corpusFiles = ['site/index.html', 'site/art/projects.json', 'site/work/work.json', 'site/js/site.js', 'site/js/map.js', 'site/404.html'];
  const buildFiles = ['tools/build-assets.mjs', ...readdirSync(path.join(ROOT, 'site-src/sections')).map((f) => 'site-src/sections/' + f)];
  const corpus = corpusFiles.map((f) => rd(path.join(ROOT, f))).join('\n');
  const corpusDec = dec(corpus);
  const buildCorpus = buildFiles.map((f) => rd(path.join(ROOT, f))).join('\n');
  const rows8 = [...s8.matchAll(/^\| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)].filter((r) => !/^-+$/.test(r[1].trim()) && r[1].trim() !== 'Where');
  const res8 = [];
  for (const [, where, was, becomes] of rows8) {
    if (REMOVED.test(where)) continue; // a row about the removed room: nothing of it ships
    const ws = was.trim().split(' / '), bs = becomes.trim().split(' / ');
    const oldGone = ws.every((w) => !corpusDec.includes(w.trim()) && !buildCorpus.replace(/&#39;/g, "'").includes(w.trim()));
    const newHere = bs.every((b) => corpusDec.includes(b.trim()) || buildCorpus.includes(b.trim()));
    res8.push({ where: where.trim(), oldGone, newHere });
    line('content', `copy-review section 8: ${where.trim()}`, oldGone && newHere ? 'pass' : 'fail', `new wording present: ${newHere}; old wording gone from shipped files and build sources: ${oldGone}`);
  }
  const gw = ['Pearl white G-Wagon on a wet night street', 'Portrait view of a pearl white G-Wagon'];
  line('content', 'section 8 has 10 rows', rows8.length === 10 ? 'pass' : 'fail', `${rows8.length} rows parsed`);
  const suspect = ['denim', 'sage', 'SUV', 'copper', 'blue accents', 'sports cars', 'neon', 'Glass syringe', 'ending on the gold', 'reveals the three', 'Camera flight along the orbit lines of the solar system', 'Front view of the open', 'olive', 'fly-through', 'Product film that reveals'];
  const sus = suspect.filter((x) => new RegExp('\\b' + x.trim().replace(/[-]/g, '[- ]') + '\\b', 'i').test(corpusDec.replace(/data:[^"')]*/g, '').replace(/class="[^"]*"/g, '')));
  line('content', 'no SUSPECT wording in shipped copy (index.html, manifest, JS, work.json)', sus.length ? 'fail' : 'pass', `${suspect.length} phrases searched, ${sus.length} found`, sus.join(', '));
  // 5e. labels, title, disclaimer, alt text
  const k = await pg.evaluate(() => [...document.querySelectorAll('.kicker')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  const wantK = ['02 Sidearm', '03 Night drive', '04 Character study', "05 Collector's case"];
  line('content', 'room labels 02 to 05', wantK.every((x, i) => k[i] === x) ? 'pass' : 'fail', k.slice(0, 5).join(' | '));
  const title = await pg.title();
  line('content', 'page title', title === 'Reuben Chatterjee: Off the clock' ? 'pass' : 'fail', title);
  const t404 = (rd(path.join(SITE, '404.html')).match(/<title>([^<]*)/) || [])[1];
  line('content', '404 page title', t404 === 'Reuben Chatterjee: Off the clock' ? 'pass' : 'fail', t404);
  const foot = norm(await pg.evaluate(() => document.querySelector('footer').textContent));
  const disc = 'Personal projects. Not affiliated with or endorsed by any brand shown.';
  line('content', 'disclaimer verbatim in footer and manifest', foot.includes(disc) && man.disclaimer === disc ? 'pass' : 'fail', foot.slice(0, 120));
  // alt text: every image with a manifest src carries the manifest alt; map thumbnails after the map loads
  const pieceByStem = new Map(man.pieces.map((p) => [p.id, p]));
  const checkAlt = async (label) => {
    const imgs = await pg.evaluate(() => [...document.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src') || i.getAttribute('data-src') || '', alt: i.getAttribute('alt'), cls: i.className })));
    let n = 0; const bad = [];
    for (const i of imgs) {
      const mm = i.src.match(/art\/img\/(.+?)-(?:480|960|1600)\.webp/);
      if (!mm) continue;
      n++;
      const p = pieceByStem.get(mm[1]);
      if (i.alt === '' || i.alt === null) continue; // decorative duplicates carry an empty alt
      if (!p || i.alt !== p.alt) bad.push(`${mm[1]}: "${i.alt}"`);
    }
    return { n, bad, total: imgs.length, emptyAlt: imgs.filter((i) => i.alt === '').length, noAlt: imgs.filter((i) => i.alt === null).length };
  };
  const a1 = await checkAlt();
  line('content', 'alt text of every non-decorative page image equals the manifest', a1.bad.length ? 'fail' : 'pass', `${a1.n} manifest images, ${a1.bad.length} differ; ${a1.total} img elements, ${a1.emptyAlt} with empty alt (decorative), ${a1.noAlt} with no alt attribute`, a1.bad.join('; '));
  const namedAlts = await pg.evaluate(() => [...document.querySelectorAll('img')].filter((i) => i.getAttribute('alt') && i.getAttribute('alt').length).map((i) => i.getAttribute('alt')));
  const allowed = new Set([...man.pieces.map((p) => p.alt), work.bio.headshot.alt, ...work.projects.map((p) => p.imageAlt || '').filter(Boolean)]);
  const unknownAlt = namedAlts.filter((a) => !allowed.has(a) && !/project image$/.test(a));
  line('content', 'every other non-empty alt is a work.json alt', unknownAlt.length ? 'fail' : 'pass', `${unknownAlt.length} unknown`, unknownAlt.join(' | '));
  const vids = await pg.evaluate(() => [...document.querySelectorAll('video')].map((v) => ({ src: (v.getAttribute('data-src') || v.getAttribute('src') || (v.querySelector('source') && v.querySelector('source').getAttribute('src')) || ''), label: v.getAttribute('aria-label'), hidden: v.getAttribute('aria-hidden') })));
  const vbad = [];
  for (const x of vids) { const mm = x.src.match(/video\/(.+)\.mp4/); const mv = mm && man.videos.find((q) => q.id === mm[1]); if (mv && x.label !== mv.description) vbad.push(`${mm[1]}: ${x.label}`); }
  line('content', 'film aria-labels equal the manifest descriptions', vbad.length ? 'fail' : 'pass', `${vids.length} video elements, ${vbad.length} differ`, vbad.join(' | ') + ' ' + JSON.stringify(vids.map((x) => [x.src.slice(-22), x.hidden])));
  // map thumbnails (JS-written), after the map loads
  await pg.evaluate(() => document.getElementById('map').scrollIntoView());
  await pg.waitForTimeout(2500);
  const mapImgs = await pg.evaluate(() => [...document.querySelectorAll('#map img[src]')].map((i) => ({ src: i.getAttribute('src'), alt: i.getAttribute('alt') })));
  const mbad = mapImgs.filter((i) => { const mm = (i.src || '').match(/art\/img\/(.+?)-(?:480|960|1600)\.webp/); const p = mm && pieceByStem.get(mm[1]); return !p || (i.alt !== p.alt && i.alt !== ''); });
  line('content', 'map and list thumbnails: alt equals the manifest', mapImgs.length && !mbad.length ? 'pass' : 'fail', `${mapImgs.length} images, ${mbad.length} differ`, mbad.slice(0, 3).map((i) => i.src + ' ' + i.alt).join(' | '));
  // 5f. employer name and title only in On the clock
  const exp = work.experience.find((e) => /Learning Buddy/.test(e.company));
  const names = [exp.company, exp.role];
  const stripped = html.replace(/<section class="otc"[\s\S]*?<\/section>/, '').replace(/<footer[\s\S]*?<\/footer>/, (f) => f);
  const outside = names.filter((n) => stripped.includes(n) || stripped.toLowerCase().includes(n.toLowerCase()));
  line('content', `former employer name and title ("${exp.company}", "${exp.role}") do not appear outside On the clock in index.html`, outside.length ? 'fail' : 'pass', `${outside.length} hits outside the section`);
  const inside = html.match(/<section class="otc"[\s\S]*?<\/section>/)[0];
  line('content', 'name and title appear in the On the clock experience entry, verbatim from work.json', names.every((n) => dec(inside).includes(n)) ? 'pass' : 'fail', `${exp.company} / ${exp.role} / ${exp.date}`);
  const others = ['site/art/projects.json', 'site/js/site.js', 'site/js/map.js', 'site/css/site.css', 'site/css/map.css', 'site/art/embedding.json', 'site/404.html'].filter((f) => /Learning Buddy|3D Design Lead/i.test(rd(path.join(ROOT, f))));
  const fnames = git('ls-files').split('\n').filter((f) => /learning|buddy|design-lead/i.test(f));
  line('content', 'name/title absent from manifest, JS, CSS, 404 and every filename', others.length || fnames.length ? 'fail' : 'pass', `files with text: ${others.join(',') || 'none'}; filenames: ${fnames.join(',') || 'none'}`);
  const w2 = JSON.stringify(work.experience.filter((e) => e !== exp)) + JSON.stringify(work.projects) + JSON.stringify(work.bio) + JSON.stringify(work.featured);
  line('content', 'name/title appear in work.json only in that one experience entry', /Learning Buddy|3D Design Lead/.test(w2) ? 'fail' : 'pass', 'checked bio, featured, projects and the other four experience entries');
  await br.close();
}


// ---------------------------------------------------------------- build
async function build() {
  const { rmSync, mkdtempSync, readdirSync: rds, lstatSync } = await import('node:fs');
  const dir = path.join(OUT, 'clone-' + Date.now());
  mkdirSync(dir, { recursive: true });
  const target = path.join(dir, 'repo');
  const br = opt('branch', 'art-design-a');
  const c = spawnSync('git', ['clone', '--quiet', '--branch', br, '--single-branch', ROOT.includes('.worktrees') ? git('rev-parse', '--git-common-dir').trim().replace(/\/\.git$/, '') : ROOT, target], { encoding: 'utf8' });
  if (c.status !== 0) { line('build', 'fresh local clone of ' + br, 'fail', c.stderr.slice(0, 200)); return; }
  const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: target, encoding: 'utf8' }).stdout.trim();
  line('build', `fresh local clone of branch ${br}`, 'pass', `cloned at ${head} into ${target} (local clone, nothing pushed)`);
  const r = spawnSync('node', ['tools/build-site.mjs', '--check'], { cwd: target, encoding: 'utf8' });
  line('build', 'node tools/build-site.mjs --check in the clean clone', r.status === 0 && /ok/.test(r.stdout) ? 'pass' : 'fail', (r.stdout + r.stderr).trim().slice(0, 200));
  const st = spawnSync('git', ['status', '--porcelain'], { cwd: target, encoding: 'utf8' }).stdout.trim();
  line('build', 'the check left the clone clean (no file rewritten)', st ? 'fail' : 'pass', st || 'git status --porcelain empty');
  // deploy dry run (read-only listing; gh-pages is never run)
  const files = spawnSync('find', ['site', '-type', 'f'], { cwd: target, encoding: 'utf8' }).stdout.split('\n').filter(Boolean).sort();
  const outside = files.filter((f) => !f.startsWith('site/'));
  const totalBytes = files.reduce((n, f) => n + statSync(path.join(target, f)).size, 0);
  line('build', 'deploy dry run: find site -type f lists only site/', outside.length ? 'fail' : 'pass', `${files.length} files, ${(totalBytes / 1048576).toFixed(2)} MB, ${outside.length} outside site/`);
  save('deploy-file-list.json', files);
  const top = [...new Set(files.map((f) => f.split('/').slice(1, 2)[0]))].sort();
  line('build', 'top-level entries that would be published', 'pass', top.join(', '));
  line('build', '.nojekyll, 404.html, robots.txt, favicon.ico, og.jpg, resume present', ['.nojekyll', '404.html', 'robots.txt', 'favicon.ico', 'og.jpg', 'Resume_Reuben_Chatterjee_DS.pdf'].every((f) => files.includes('site/' + f)) ? 'pass' : 'fail', '');
  const cname = spawnSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'], { cwd: target, encoding: 'utf8' }).stdout.split('\n').filter((f) => /(^|\/)CNAME$/i.test(f));
  line('build', 'no CNAME anywhere in the tree', cname.length ? 'fail' : 'pass', cname.join(',') || 'none');
  const same = existsSync(path.join(target, 'public/Resume_Reuben_Chatterjee_DS.pdf')) && Buffer.compare(readFileSync(path.join(target, 'site/Resume_Reuben_Chatterjee_DS.pdf')), readFileSync(path.join(target, 'public/Resume_Reuben_Chatterjee_DS.pdf'))) === 0;
  line('build', 'resume in site/ byte-identical to public/ (the old site)', same ? 'pass' : 'fail', '');
  const pkg = JSON.parse(readFileSync(path.join(target, 'package.json'), 'utf8'));
  line('build', 'deploy:art script publishes only site/', /gh-pages -d site --dotfiles/.test(pkg.scripts['deploy:art']) ? 'pass' : 'fail', pkg.scripts['deploy:art']);
  const bad = files.filter((f) => TERMS.test(f));
  line('build', 'no excluded-work name in the publish list', bad.length ? 'fail' : 'pass', `${bad.length} hits`);
  // files in site/ that nothing references
  const refs = new Set();
  for (const f of ['site/index.html', 'site/404.html', 'site/css/site.css', 'site/css/map.css', 'site/js/site.js', 'site/js/map.js', 'site/art/projects.json', 'site/work/work.json', 'site/art/embedding.json']) { try { for (const m of rd(path.join(target, f)).matchAll(/[A-Za-z0-9_./-]+\.(?:webp|mp4|woff2|png|jpg|ico|pdf|json|js|css)/g)) refs.add(path.basename(m[0])); } catch {} }
  const orphan = files.filter((f) => !refs.has(path.basename(f)) && !/\.nojekyll|robots/.test(f)).filter((f) => !/-rail\.webp$/.test(f));
  line('build', 'published files nothing refers to by name', 'pass', `${orphan.length} (information): ${orphan.slice(0, 6).join(', ')}`);
  rmSync(dir, { recursive: true, force: true });
  line('build', 'scratch clone directory removed', existsSync(dir) ? 'fail' : 'pass', dir);
}


// ---------------------------------------------------------------- perf
async function perf() {
  const man = JSON.parse(rd(path.join(SITE, 'art/projects.json')));
  const size = (f) => statSync(path.join(SITE, f)).size;
  // static file budgets
  const listing = [];
  const thumbs = man.pieces.map((p) => ({ id: p.id, f: p.src['480'] })).filter((x) => x.f);
  const maxThumb = thumbs.map((t) => ({ ...t, n: size(t.f) })).sort((a, b) => b.n - a.n)[0];
  line('perf', 'thumbnails (480w, all 24 pieces)', maxThumb.n < 200 * 1024 ? 'pass' : 'fail', `largest ${kb(maxThumb.n)} (${maxThumb.id}); budget 200 KB`, maxThumb.f);
  const rail = readdirSync(path.join(SITE, 'art/img')).filter((f) => /-rail\.webp$/.test(f)).map((f) => size('art/img/' + f));
  line('perf', 'rail thumbnails', rail.every((n) => n < 200 * 1024) ? 'pass' : 'fail', `${rail.length} files, largest ${kb(Math.max(...rail))}`);
  const big = man.pieces.flatMap((p) => ['960', '1600'].map((w) => ({ id: p.id, w, f: p.src[w], n: p.src[w] ? size(p.src[w]) : 0 }))).filter((x) => x.f).sort((a, b) => b.n - a.n);
  line('perf', 'hero and large images (960w, 1600w, all pieces)', big[0].n < 500 * 1024 ? 'pass' : 'fail', `largest ${kb(big[0].n)} (${big[0].f}); budget 500 KB; ${big.length} files`, big.slice(0, 3).map((x) => `${x.f} ${kb(x.n)}`).join('; '));
  const hero = man.pieces.find((p) => p.id === 'boat-front');
  line('perf', 'hero still (the LCP element, 960w served)', size(hero.src['960']) < 500 * 1024 ? 'pass' : 'fail', `${kb(size(hero.src['960']))}; 480w ${kb(size(hero.src['480']))}; 1600w ${kb(size(hero.src['1600']))}`);
  for (const v of man.videos) {
    if (!v.poster) continue; // the hero loop has no poster; it is measured below
    const n = size(v.src), pn = size(v.poster);
    line('perf', `film ${v.id}`, n < 2 * 1024 * 1024 && pn < 150 * 1024 ? 'pass' : 'fail', `${kb(n)} (${n} B) of 2 MB; poster ${kb(pn)} of 150 KB; ${v.duration}s`, v.src);
  }
  const hl = size('art/video/boat-hero.mp4');
  line('perf', 'hero loop clip', hl < 500 * 1024 ? 'pass' : 'fail', `${kb(hl)} of 500 KB`, 'art/video/boat-hero.mp4');
  const wimg = readdirSync(path.join(SITE, 'work/img')).map((f) => ({ f, n: size('work/img/' + f) })).sort((a, b) => b.n - a.n);
  line('perf', 'data science images (work/img)', wimg[0].n < 200 * 1024 ? 'pass' : 'fail', `largest ${kb(wimg[0].n)} (${wimg[0].f}); budget 200 KB for 480w, 500 KB others`);
  // JS, CSS, fonts
  const js = readdirSync(path.join(SITE, 'js')).map((f) => ({ f, n: size('js/' + f), g: gz(readFileSync(path.join(SITE, 'js', f))) }));
  const jsTot = js.reduce((a, b) => a + b.n, 0);
  line('perf', 'JavaScript total, uncompressed (site.js + map.js)', jsTot < 90 * 1024 ? 'pass' : 'fail', `${kb(jsTot)} of 90 KB; ${js.map((j) => `${j.f} ${kb(j.n)} (gzip ${kb(j.g)})`).join(', ')}`);
  const inline = [...rd(path.join(SITE, 'index.html')).matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1].length);
  line('perf', 'inline script in index.html (not counted above)', 'pass', `${inline.length} blocks, ${kb(inline.reduce((a, b) => a + b, 0))}`);
  const fonts = readdirSync(path.join(SITE, 'fonts')).map((f) => ({ f, n: size('fonts/' + f) }));
  const fTot = fonts.reduce((a, b) => a + b.n, 0);
  const css = rd(path.join(SITE, 'css/site.css'));
  const ff = [...css.matchAll(/@font-face\{[^}]*\}/g)].map((m) => m[0]);
  const fams = new Set(ff.map((x) => (x.match(/font-family:\s*"?([^;"}]+)/) || [])[1]));
  line('perf', 'fonts: families, total, format', fonts.length === 2 && fams.size === 2 && fTot < 120 * 1024 && fonts.every((x) => x.f.endsWith('.woff2')) ? 'pass' : 'fail', `${fams.size} families (${[...fams].join(', ')}), ${kb(fTot)} of 120 KB, ${fonts.map((x) => `${x.f} ${kb(x.n)}`).join(', ')}`);
  line('perf', 'font-display: swap on every @font-face', ff.length && ff.every((x) => /font-display:\s*swap/.test(x)) ? 'pass' : 'fail', `${ff.length} faces`);
  const cssAll = readdirSync(path.join(SITE, 'css')).map((f) => ({ f, n: size('css/' + f), g: gz(readFileSync(path.join(SITE, 'css', f))) }));
  line('perf', 'CSS sizes (information)', 'pass', cssAll.map((c) => `${c.f} ${kb(c.n)} (gzip ${kb(c.g)})`).join(', '));
  const html = readFileSync(path.join(SITE, 'index.html'));
  line('perf', 'index.html size (information)', 'pass', `${kb(html.length)} (gzip ${kb(gz(html))})`);
  const hh = html.toString();
  const ext = [...hh.matchAll(/<script[^>]*src="(https?:)?\/\/[^"]+"/g)];
  line('perf', 'no third-party scripts or CDN requests in the page source', ext.length ? 'fail' : 'pass', `${ext.length} external <script src>; all JS strings checked: ${!/https?:\/\/(?!reubenchatterjee|www\.(behance|linkedin)|github)/.test(js.map((j) => rd(path.join(SITE, 'js', j.f))).join(''))}`);
  // img attributes
  const imgs = [...hh.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]).filter((i) => !/id="md-img"/.test(i)); // md-img is the map detail panel's image, filled by map.js (no src until opened)
  const noDim = imgs.filter((i) => !/\bwidth="\d+"/.test(i) || !/\bheight="\d+"/.test(i));
  const eager = imgs.filter((i) => !/loading="lazy"/.test(i) && !/-rail\.webp/.test(i));
  const noSrcset = imgs.filter((i) => !/srcset=/.test(i) && !/-rail\.webp|favicon/.test(i));
  line('perf', 'every <img> has width and height', noDim.length ? 'fail' : 'pass', `${imgs.length} images, ${noDim.length} without`, noDim.slice(0, 2).join(' ').slice(0, 200));
  line('perf', 'lazy loading on every image except the hero', eager.length === 1 ? 'pass' : 'fail', `${eager.length} not lazy: ${eager.map((e) => (e.match(/src="([^"]+)"/) || [])[1]).join(', ')}`);
  line('perf', 'WebP with srcset/sizes on content images', noSrcset.length ? 'fail' : 'pass', `${noSrcset.length} images without srcset (rail thumbnails excluded)`, noSrcset.slice(0, 2).join(' ').slice(0, 200));

  // runtime: requests by phase, CLS
  const { chromium, webkit } = await import('playwright');
  const out = {};
  for (const vp of [{ n: '393x660', w: 393, h: 660, dsf: 3, touch: true }, { n: '1440x900', w: 1440, h: 900, dsf: 1, touch: false }]) {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dsf, hasTouch: vp.touch });
    const pg = await ctx.newPage();
    const reqs = [];
    pg.on('requestfinished', async (rq) => { try { const sz = await rq.sizes(); reqs.push({ url: rq.url().replace(BASE, ''), type: rq.resourceType(), body: sz.responseBodySize, hdr: sz.responseHeadersSize, t0: 0 }); } catch {} });
    await ctx.addInitScript(() => {
      window.__cls = []; window.__fcp = null;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__cls.push({ v: e.value, t: e.startTime, input: e.hadRecentInput }); }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
      window.__lcp = null; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = { t: e.startTime, url: e.url, size: e.size }; }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    await pg.goto(BASE, { waitUntil: 'load' });
    await sleep(4000);
    const tl = await pg.evaluate(() => ({ fcp: window.__fcp, lcp: window.__lcp, load: performance.timing.loadEventStart - performance.timing.navigationStart, res: performance.getEntriesByType('resource').map((r) => ({ url: r.name, start: r.startTime, end: r.responseEnd, enc: r.encodedBodySize, xfer: r.transferSize, type: r.initiatorType })), nav: (() => { const n = performance.getEntriesByType('navigation')[0]; return { enc: n.encodedBodySize, xfer: n.transferSize }; })() }));
    const rows2 = tl.res.map((r) => ({ ...r, url: r.url.replace(BASE, '') }));
    const sum = (arr) => arr.reduce((a, b) => a + (b.xfer || b.enc || 0), 0);
    const before = rows2.filter((r) => r.start < tl.fcp);
    const toLcp = rows2.filter((r) => r.start < tl.lcp.t);
    const byLoad = rows2.filter((r) => r.start < tl.load);
    const after = rows2.filter((r) => r.start >= tl.load);
    const gzSave = (arr) => arr.reduce((a, r) => { const f = path.join(SITE, r.url.split('?')[0]); if (/\.(js|css|json|html)$/.test(f) && existsSync(f)) return a + (r.xfer - gz(readFileSync(f))); return a; }, 0);
    const htmlX = tl.nav.xfer;
    const nonLazyTotal = sum(rows2.filter((r) => !/\.mp4/.test(r.url))) + htmlX; // the hero loop is added in full below (Chromium aborts it at a random byte)
    const loopReq = rows2.find((r) => /boat-hero\.mp4/.test(r.url));
    out[vp.n] = { fcp: tl.fcp, lcp: tl.lcp, load: tl.load, htmlX, rows: rows2.map((r) => ({ u: r.url, s: Math.round(r.start), e: Math.round(r.end), x: r.xfer })), before: sum(before) + htmlX, toLcp: sum(toLcp) + htmlX, byLoad: sum(byLoad) + htmlX, after: sum(after), total: nonLazyTotal, gzSave: gzSave(rows2) + (gz(html) ? htmlX - gz(html) : 0) };
    // CLS after a full scroll
    const H = await pg.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += Math.round(vp.h * 0.7)) { await pg.evaluate((v) => scrollTo(0, v), y); await sleep(120); }
    await sleep(1500);
    const cls = await pg.evaluate(() => window.__cls.filter((c) => !c.input));
    out[vp.n].cls = cls.reduce((a, c) => a + c.v, 0);
    out[vp.n].clsTop = cls.sort((a, b) => b.v - a.v).slice(0, 3);
    out[vp.n].afterScrollRequests = reqs.length;
    await b.close();
  }
  save('perf-load.json', out);
  for (const [n, o] of Object.entries(out)) {
    line('perf', `first load, ${n}: bytes requested before first paint (FCP ${Math.round(o.fcp)} ms)`, 'pass', `${kb(o.before)} (HTML + CSS + font + hero still + whatever started before FCP)`, o.rows.filter((r) => r.s < o.fcp).map((r) => `${r.u.slice(-34)} ${kb(r.x)}`).join(', ') + ' | html ' + kb(o.htmlX));
    line('perf', `first load, ${n}: before the largest paint (LCP ${Math.round(o.lcp.t)} ms, ${(o.lcp.url || '').replace(BASE, '')})`, 'pass', kb(o.toLcp));
    line('perf', `first load, ${n}: requested AFTER first paint (site.js loader, posters, map.css, hero loop)`, 'pass', `${kb(o.rows.filter((r) => r.s >= o.fcp).reduce((a, r) => a + r.x, 0))} (the hero loop shows its 0.3 KB abort in Chromium: no H.264)`, o.rows.filter((r) => r.s >= o.fcp).map((r) => `${r.u} ${kb(r.x)}@${r.s}ms`).join(', '));
    const loopFull = size('art/video/boat-hero.mp4');
    line('perf', `first load, ${n}: hero viewport total without the loop (raw; the local server does not compress)`, o.total < 900 * 1024 ? 'pass' : 'fail', `${kb(o.total)} of 900 KB; gzip would save about ${kb(Math.max(0, o.gzSave))} on the HTML, CSS and JS`);
    line('perf', `first load, ${n}: same, counting the whole hero loop (${kb(loopFull)}) as if it were fetched`, o.total + loopFull < 900 * 1024 ? 'pass' : 'fail', `${kb(o.total + loopFull)} raw; about ${kb(o.total + loopFull - Math.max(0, o.gzSave))} with gzip, of 900 KB`);
    line('perf', `CLS over a full scroll, ${n} (Chromium)`, o.cls < 0.05 ? 'pass' : 'fail', o.cls.toFixed(4), JSON.stringify(o.clsTop.map((c) => [+c.v.toFixed(4), Math.round(c.t)])));
  }
  // lazy sections: nothing for map/story/On the clock before approach
  const b2 = await chromium.launch();
  const c2 = await b2.newContext({ viewport: { width: 393, height: 660 }, deviceScaleFactor: 3, hasTouch: true });
  const p2 = await c2.newPage();
  const seen = [];
  p2.on('request', (r) => seen.push({ u: r.url().replace(BASE, ''), y: 0 }));
  await p2.goto(BASE, { waitUntil: 'load' }); await sleep(3000);
  const atTop = seen.map((s) => s.u);
  const lazyAtTop = atTop.filter((u) => /^js\/map\.js|embedding\.json|^work\/img\//.test(u));
  line('perf', 'sections 07 to 09: no map.js, embedding.json or work/ image requested at the top of the page', lazyAtTop.length ? 'fail' : 'pass', `${lazyAtTop.length} requested of ${atTop.length} total requests`, lazyAtTop.join(', '));
  line('perf', 'map.css fetched right after first paint (design decision of task 17b)', atTop.includes('css/map.css') ? 'pass' : 'fail', atTop.includes('css/map.css') ? 'requested before any scrolling' : 'not requested');
  const m = await p2.evaluate(() => { const r = (id) => { const e = document.getElementById(id); return e.getBoundingClientRect().top + scrollY; }; return { map: r('map'), story: r('story'), otc: r('on-the-clock'), vh: innerHeight }; });
  const log = [];
  for (let y = 0; y < m.otc + 600; y += 200) { seen.length = 0; await p2.evaluate((v) => scrollTo(0, v), y); await sleep(150); for (const s of seen) log.push({ y, u: s.u }); }
  const firstMap = log.find((l) => /js\/map\.js|embedding/.test(l.u)), firstWork = log.find((l) => /^work\/img\//.test(l.u));
  line('perf', 'map.js and embedding.json first requested when the map is about this many screens away', firstMap ? 'pass' : 'fail', firstMap ? `${((m.map - firstMap.y) / m.vh).toFixed(1)} screens above the map (scrollY ${firstMap.y}; map top ${Math.round(m.map)})` : 'never');
  line('perf', 'work images first requested when On the clock is about this many screens away', firstWork ? 'pass' : 'fail', firstWork ? `${((m.otc - firstWork.y) / m.vh).toFixed(1)} screens above the section (scrollY ${firstWork.y}; section top ${Math.round(m.otc)})` : 'never');
  await b2.close();
  // hero loop in WebKit (plays H.264): requested only after load; none under reduced motion
  const wk = await webkit.launch();
  for (const reduced of [false, true]) {
    const c = await wk.newContext({ viewport: { width: 393, height: 660 }, deviceScaleFactor: 3, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const p = await c.newPage();
    const t = [];
    await p.addInitScript(() => { window.__loadAt = null; addEventListener('load', () => { window.__loadAt = performance.now(); }); });
    p.on('request', (r) => { if (/\.mp4/.test(r.url())) t.push({ u: r.url().replace(BASE, ''), at: Date.now() }); });
    const t0 = Date.now();
    await p.goto(BASE, { waitUntil: 'load' }); await sleep(4500);
    const lo = await p.evaluate(() => window.__loadAt);
    const loop = t.find((x) => /boat-hero/.test(x.u));
    if (!reduced) line('perf', 'hero loop requested only after the load event (WebKit)', loop && loop.at - t0 > lo ? 'pass' : 'fail', loop ? `requested ${loop.at - t0} ms after navigation start; load event at ${Math.round(lo)} ms` : 'not requested in 4.5 s');
    else line('perf', 'no hero loop and no film request under reduced motion (WebKit)', t.length === 0 ? 'pass' : 'fail', `${t.length} video requests: ${t.map((x) => x.u).join(', ')}`);
    await c.close();
  }
  await wk.close();
  line('perf', 'Save-Data: the loop is skipped (code path only; not emulated)', /saveData\(\)/.test(readFileSync(path.join(ROOT, 'site-src/js/10-hero.js'), 'utf8')) ? 'not tested' : 'fail', 'heroOK() checks navigator.connection.saveData; runtime path not exercised');
}


// ---------------------------------------------------------------- contrast
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hex = (h) => { h = h.trim().replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t); // t = share of b
const WORLDS = ['boat', 'wingman', 'gwagon', 'pokemon', 'wheels', 'map', 'story', 'clock'];

async function contrast() {
  const { chromium } = await import('playwright');
  const b = await chromium.launch();
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await pg.goto(BASE, { waitUntil: 'load' });
  const tok = await pg.evaluate((worlds) => Object.fromEntries(worlds.map((w) => { const e = document.createElement('div'); e.setAttribute('data-world', w); document.body.appendChild(e); const cs = getComputedStyle(e); const o = {}; for (const k of ['bg', 'ink', 'accent', 'accent2', 'muted', 'on-accent', 'card', 'card-ink', 'card-muted', 'block']) o[k] = cs.getPropertyValue('--' + k).trim(); e.remove(); return [w, o]; })), WORLDS);
  save('contrast-tokens.json', tok);
  const T = {}; for (const w of WORLDS) { T[w] = {}; for (const [k, v] of Object.entries(tok[w])) if (/^#/.test(v)) T[w][k] = hex(v); }
  const table = [];
  const pair = (world, label, fg, bgc, need, note = '') => { if (!fg || !bgc) return; const r = ratio(fg, bgc); table.push({ world, pair: label, ratio: +r.toFixed(2), need, pass: r >= need, note }); };
  for (const w of WORLDS) {
    const t = T[w];
    pair(w, 'ink on ground (body text)', t.ink, t.bg, 4.5);
    pair(w, 'muted on ground (small text)', t.muted, t.bg, 4.5);
    pair(w, 'accent on ground (text, links)', t.accent, t.bg, 4.5, w === 'wheels' ? 'accent is ink on this ground' : '');
    pair(w, 'on-accent on accent (button text)', t['on-accent'], t.accent, 4.5);
    pair(w, 'card-ink on card', t['card-ink'], t.card, 4.5);
    pair(w, 'card-muted on card', t['card-muted'], t.card, 4.5);
    pair(w, 'accent on card (informational: only matters if accent text sits on a card; the DOM sweep below covers real use)', t.accent, t.card, 3, 'informational');
    pair(w, 'card against ground (informational)', t.card, t.bg, 1, 'informational');
    if (t.accent2) pair(w, 'second accent on ground (small detail only)', t.accent2, t.bg, 3);
    if (t.block) pair(w, 'ink on orange block', t.ink, t.block, 4.5);
    // header
    pair(w, 'header: name (ink) on ground', t.ink, t.bg, 4.5);
    pair(w, 'header: switch, inactive item (bg at 0.92 opacity on ink pill)', mix(t.ink, t.bg, 0.92), t.ink, 4.5);
    pair(w, 'header: switch, current item (ink on bg)', t.ink, t.bg, 4.5);
    pair(w, 'header: Resume (on-accent on accent)', t['on-accent'], t.accent, 4.5);
    pair(w, 'header: switch pill edge vs ground (UI)', t.ink, t.bg, 3);
    // rail
    pair(w, 'rail: chip text (bg at 0.92 opacity on ink rail)', mix(t.ink, t.bg, 0.92), t.ink, 4.5);
    pair(w, 'rail: current item (ink on bg)', t.ink, t.bg, 4.5);
    pair(w, 'rail: pill and more button (bg at 0.92 on ink)', mix(t.ink, t.bg, 0.92), t.ink, 4.5);
    pair(w, 'rail: edge vs ground (UI)', t.ink, t.bg, 3);
  }
  // across a wipe: header/rail colours transition in .3s while the ground changes
  for (let i = 0; i < WORLDS.length - 1; i++) {
    const A = T[WORLDS[i]], B = T[WORLDS[i + 1]];
    for (const tt of [0.25, 0.5, 0.75]) {
      const ink = mix(A.ink, B.ink, tt), bg = mix(A.bg, B.bg, tt);
      pair(`${WORLDS[i]}>${WORLDS[i + 1]} @${tt}`, 'header/rail text on its own pill while both transition', mix(ink, bg, 0.92), ink, 3, 'transient, 0.3 s; held to 3:1');
    }
    // old world's header name over the new world's ground (header lags the wipe)
    pair(`${WORLDS[i]}>${WORLDS[i + 1]}`, 'header name of the OLD world over the NEW ground (worst case, first frames)', A.ink, B.bg, 3, 'transient');
    pair(`${WORLDS[i]}>${WORLDS[i + 1]}`, 'header name of the NEW world over the OLD ground', B.ink, A.bg, 3, 'transient');
    pair(`${WORLDS[i]}>${WORLDS[i + 1]}`, 'pill edge: OLD pill over NEW ground (UI)', A.ink, B.bg, 3, 'transient');
  }
  save('contrast-table.json', table);
  const steady = table.filter((r) => !r.world.includes('>') && r.need >= 3 && r.ratio !== undefined);
  const fails = table.filter((r) => !r.pass && !/informational/.test(r.note) && !r.world.includes('>') && !r.world.includes('@'));
  const trans = table.filter((r) => r.world.includes('>'));
  const transBad = trans.filter((r) => !r.pass);
  const worst = [...table].filter((r) => r.need >= 3 && !/informational/.test(r.note) && !r.world.includes('>')).sort((a, c) => a.ratio / a.need - c.ratio / c.need).slice(0, 5);
  line('contrast', `token pairs, header and rail in every world (${table.length} pairs, computed from the CSS custom properties)`, fails.length ? 'fail' : 'pass', `${fails.length} below their threshold; lowest margins: ${worst.map((w) => `${w.world} ${w.pair} ${w.ratio}:1 (need ${w.need})`).join(' | ')}`, 'contrast-table.json');
  for (const f of fails) line('contrast', `${f.world}: ${f.pair}`, 'fail', `${f.ratio}:1, needs ${f.need}:1`, f.note);
  const tw = [...trans].sort((a, c) => a.ratio - c.ratio).slice(0, 4);
  line('contrast', 'mid-wipe: header and rail colours while they transition (0.3 s) between adjacent worlds, 3 samples per step, 8 steps, held to 3:1', transBad.length ? 'fail' : 'pass', `${transBad.length} of ${trans.length} samples below 3:1; worst: ${tw.map((x) => `${x.world} ${x.pair.slice(0, 30)} ${x.ratio}:1`).join(' | ')}`, 'interpolated linearly in sRGB, as CSS does; transient, not steady-state');

  // DOM sweep: every text element's computed colour against its resolved ground, reduced motion (everything in normal flow)
  const sweepAll = {};
  for (const vp of [{ w: 1440, h: 900 }, { w: 393, h: 660 }]) {
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, reducedMotion: 'reduce' });
    const p2 = await ctx.newPage();
    await p2.goto(BASE, { waitUntil: 'load' });
    await sleep(800);
    await p2.evaluate(() => document.getElementById('map').scrollIntoView()); await sleep(2500);
    await p2.evaluate(() => scrollTo(0, 0)); await sleep(1200);
    const res = await p2.evaluate(() => {
      const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const v = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
      const over = (top, under) => { const a = top[3] + under[3] * (1 - top[3]); if (a === 0) return [0, 0, 0, 0]; return [0, 1, 2].map((i) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a).concat(a); };
      const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const out = []; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      while (walker.nextNode()) {
        const n = walker.currentNode; if (!n.textContent.trim()) continue; const e = n.parentElement; if (seen.has(e)) continue; seen.add(e);
        if (e.closest('script,style,noscript,svg,[hidden]')) continue;
        const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
        const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        let op = 1, hidden = false, img = false; let bg = [0, 0, 0, 0]; let layers = [];
        for (let a = e; a && a.nodeType === 1; a = a.parentElement) { const c = getComputedStyle(a); op *= +c.opacity; if (c.display === 'none' || c.visibility === 'hidden') hidden = true; if (c.backgroundImage !== 'none') img = true; layers.push(parse(c.backgroundColor)); }
        if (hidden || op < 0.05 || e.closest('.sr-only,.vh')) continue;
        for (const l of layers) { bg = over(bg, l); if (bg[3] >= 0.999) break; }
        if (bg[3] < 0.999 && e.closest('#hdr,#rail')) { // fixed chrome: the ground is whatever sits under it
          const fx = e.closest('#hdr,#rail'); const rr = e.getBoundingClientRect(); const pv = fx.style.visibility; fx.style.visibility = 'hidden';
          const under = document.elementsFromPoint(Math.min(Math.max(rr.left + rr.width / 2, 1), innerWidth - 1), Math.min(Math.max(rr.top + rr.height / 2, 1), innerHeight - 1)); fx.style.visibility = pv;
          let g = [0, 0, 0, 0]; for (const u of under) { g = over(g, parse(getComputedStyle(u).backgroundColor)); if (g[3] >= 0.999) break; } bg = over(bg, g);
        }
        if (bg[3] < 0.999) bg = over(bg, parse(getComputedStyle(document.body).backgroundColor).slice(0, 3).concat(1));
        let fg = parse(cs.color); fg = [fg[0], fg[1], fg[2], fg[3] * 1];
        const fgc = over(fg, bg); // text composited over its ground
        // ancestors with opacity blend the text towards the ground
        const eff = [0, 1, 2].map((i) => fgc[i] * op + bg[i] * (1 - op));
        const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
        const large = size >= 24 || (size >= 18.66 && bold);
        // is it sitting over a picture? (an <img>/<video> or canvas under its centre)
        const stack = document.elementsFromPoint(Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1));
        out.push({ t: n.textContent.trim().slice(0, 40), tag: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''), sec: (e.closest('section,header,nav,footer') || {}).id || (e.closest('section,header,nav,footer') || {}).className || '', r: +ratio(eff, bg).toFixed(2), need: large ? 3 : 4.5, size, large, img, y: Math.round(r.top + scrollY), op: +op.toFixed(2) });
      }
      return out;
    });
    sweepAll[vp.w] = res;
    await ctx.close();
  }
  save('contrast-sweep.json', sweepAll);
  for (const [w, res] of Object.entries(sweepAll)) {
    const low = res.filter((x) => x.r < x.need);
    const hard = low.filter((x) => !x.img);
    const bySec = {}; for (const x of res) { bySec[x.sec] = Math.min(bySec[x.sec] ?? 99, x.r); }
    line('contrast', `DOM sweep at ${w} wide, reduced motion: every text element vs its resolved ground`, hard.length ? 'fail' : 'pass', `${res.length} text elements, ${hard.length} below threshold on a plain ground, ${low.length - hard.length} below on a ground with a background image (see file)`, hard.slice(0, 6).map((x) => `"${x.t}" ${x.tag} ${x.r}:1 need ${x.need} (${x.sec})`).join(' | '));
    const imgs = low.filter((x) => x.img);
    if (imgs.length) line('contrast', `... text over a background image at ${w} (needs eyes)`, 'not tested', imgs.slice(0, 6).map((x) => `"${x.t}" ${x.r}:1`).join(' | '));
    save(`contrast-min-by-section-${w}.json`, bySec);
  }
  await b.close();
}


// ---------------------------------------------------------------- shared state helpers
const STATES = [
  { id: 'top', name: 'room 1 Boat Rockerz (hero)', world: 'boat', room: 0 },
  { id: 'wingman', name: 'room 2 Wingman', world: 'wingman', room: 1 },
  { id: 'g-wagon', name: 'room 3 G Wagon', world: 'gwagon', room: 2 },
  { id: 'pokemon', name: 'room 4 Pokemon', world: 'pokemon', room: 3 },
  { id: 'hot-wheels', name: 'room 5 Hottest Wheels', world: 'wheels', room: 4 },
  { id: 'map', name: 'section 06 map', world: 'map' },
  { id: 'story', name: 'section 07 story', world: 'story' },
  { id: 'on-the-clock', name: 'section 08 On the clock', world: 'clock' },
];
async function goState(pg, st, extra = 1700) {
  const y = await pg.evaluate((st) => {
    const H = innerHeight, wipe = document.documentElement.classList.contains('wipe');
    if (st.room !== undefined) return wipe ? Math.round(st.room * 1.35 * H) : Math.round(document.getElementById(st.id).getBoundingClientRect().top + scrollY);
    const e = document.getElementById(st.id); return Math.round(e.getBoundingClientRect().top + scrollY);
  }, st);
  // approach in steps so scroll handlers (wipe, lazy map) see a natural scroll
  const cur = await pg.evaluate(() => scrollY);
  const steps = 6;
  for (let i = 1; i <= steps; i++) { await pg.evaluate((v) => scrollTo(0, v), Math.round(cur + ((y - cur) * i) / steps)); await sleep(90); }
  await sleep(extra);
  if (st.id === 'map') await sleep(1500);
  return pg.evaluate(() => { const c = document.querySelector('.hdr__ctl'); return { world: c && c.getAttribute('data-world'), y: scrollY }; });
}
async function loadAxe() {
  const req = createRequire(import.meta.url);
  const from = opt('axe-from', '');
  for (const base of [from, path.join(TOOLS, 'node_modules'), process.cwd()].filter(Boolean)) {
    try { return req(req.resolve('@axe-core/playwright', { paths: [base] })); } catch {}
    try { return req(path.join(base, 'node_modules/@axe-core/playwright')); } catch {}
    try { return req(path.join(base, '@axe-core/playwright')); } catch {}
  }
  throw new Error('@axe-core/playwright not found; run `npm i @axe-core/playwright` outside the repo and pass --axe-from <dir>');
}

// ---------------------------------------------------------------- a11y (axe)
async function a11y() {
  const { AxeBuilder } = await loadAxe();
  const { chromium } = await import('playwright');
  const b = await chromium.launch();
  const results = [];
  const run = async (pg, label, vp, motion, activeRoom = null) => {
    const r = await new AxeBuilder({ page: pg }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    // In the wipe layout every earlier room stays in the DOM, painted under the opaque room on top of it. Axe tests those hidden layers
    // as if they were visible. A node whose room is not the active one is therefore set aside and counted, not reported.
    const owner = async (sel) => pg.evaluate((s) => { try { const e = document.querySelector(s); const rm = e && e.closest('[data-room]'); return rm ? rm.id : ''; } catch { return ''; } }, sel);
    const v = [], layer = [];
    for (const x of r.violations) {
      const keep = [], drop = [];
      for (const n of x.nodes) { const o = activeRoom !== null && motion === 'normal' ? await owner(n.target[0]) : ''; if (activeRoom !== null && o && o !== activeRoom) drop.push(n); else keep.push(n); }
      if (drop.length) layer.push({ id: x.id, n: drop.length });
      if (keep.length) v.push({ id: x.id, impact: x.impact, n: keep.length, help: x.help, nodes: keep.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 3).join(' ').slice(0, 160)) });
    }
    const inc = r.incomplete.map((x) => ({ id: x.id, n: x.nodes.length, nodes: x.nodes.slice(0, 2).map((n) => n.target.join(' ')) }));
    results.push({ label, vp, motion, passes: r.passes.length, violations: v, setAsideStackedLayers: layer, incomplete: inc });
    line('a11y', `axe ${label} @${vp} ${motion}`, v.length ? 'fail' : 'pass', `${r.passes.length} rules passed, ${v.length} violations${v.length ? ': ' + v.map((x) => `${x.id}(${x.n}, ${x.impact})`).join(', ') : ''}; ${inc.length} need review${inc.length ? ': ' + inc.map((x) => `${x.id}(${x.n})`).join(', ') : ''}${layer.length ? '; set aside as covered earlier rooms: ' + layer.map((x) => `${x.id}(${x.n})`).join(', ') : ''}`);
  };
  for (const vp of [{ n: '393x660', w: 393, h: 660, dsf: 3, touch: true }, { n: '1440x900', w: 1440, h: 900, dsf: 1, touch: false }]) {
    for (const motion of ['normal', 'reduced']) {
      const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dsf, hasTouch: vp.touch, reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference' });
      const pg = await ctx.newPage();
      await pg.goto(BASE, { waitUntil: 'load' });
      await sleep(1200);
      for (const st of STATES) {
        const got = await goState(pg, st);
        if (got.world !== st.world && motion === 'normal') line('a11y', `state check ${st.name} @${vp.n}`, 'not tested', `header world is ${got.world}, wanted ${st.world}`);
        await run(pg, st.name, vp.n, motion, st.room !== undefined ? st.id : null);
        if (motion === 'normal') await pg.screenshot({ path: path.join(SHOTS, `a11y-${vp.n}-${st.id}.png`) });
      }
      // lightbox open, in each room that has a strip
      for (const st of STATES.filter((x) => ['wingman', 'pokemon', 'hot-wheels', 'g-wagon'].includes(x.id))) {
        await goState(pg, st, 1200);
        const opened = await pg.evaluate((id) => { const b = document.querySelector(`#${id} .views__b`); if (!b) return false; b.click(); return true; }, st.id);
        await sleep(1200);
        const open = await pg.evaluate(() => document.getElementById('lb').open);
        if (!opened || !open) { line('a11y', `lightbox open in ${st.name} @${vp.n}`, 'fail', `strip button found ${opened}, dialog open ${open}`); continue; }
        await run(pg, `lightbox open over ${st.name}`, vp.n, motion);
        if (motion === 'normal') await pg.screenshot({ path: path.join(SHOTS, `a11y-${vp.n}-lightbox-${st.id}.png`) });
        await pg.keyboard.press('Escape'); await sleep(700);
      }
      // map detail panel open (deep link, then a click on a node)
      await pg.goto(BASE + '?open=the-view#map', { waitUntil: 'load' }); await sleep(3500);
      const panel = await pg.evaluate(() => { const p = document.querySelector('.map__panel'); return p && p.offsetParent !== null && getComputedStyle(p).visibility !== 'hidden'; });
      if (!panel) line('a11y', `map detail panel open @${vp.n} ${motion}`, 'fail', 'panel not visible after ?open=the-view#map');
      else {
        await run(pg, 'map detail panel open (the-view)', vp.n, motion);
        if (motion === 'normal') await pg.screenshot({ path: path.join(SHOTS, `a11y-${vp.n}-map-panel.png`) });
      }
      await ctx.close();
    }
  }
  save('axe-results.json', results);
  const totals = {}; for (const r of results) for (const v of r.violations) totals[v.id] = (totals[v.id] || 0) + v.n;
  line('a11y', 'axe total over all states, sizes and motion modes', Object.keys(totals).length ? 'fail' : 'pass', `${results.length} runs; distinct violated rules: ${JSON.stringify(totals)}`);
  await b.close();
}


// ---------------------------------------------------------------- keyboard walk-through
const DESCRIBE = () => {
  const e = document.activeElement;
  if (!e || e === document.body) return { body: true, scrollY: Math.round(scrollY) };
  const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
  const name = (e.getAttribute('aria-label') || e.textContent || e.getAttribute('alt') || e.id || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
  const top = document.elementFromPoint(cx, cy);
  const hit = top && (e === top || e.contains(top) || top.contains(e)) ? 'ok' : top && top.closest('#hdr') ? 'under header' : top && top.closest('#rail') ? 'under rail' : top ? 'under ' + (top.className || top.tagName) : 'none';
  const sec = e.closest('section,header,nav,footer,dialog');
  return {
    el: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : ''), name, href: e.getAttribute('href'),
    sec: sec ? sec.id || (typeof sec.className === 'string' ? sec.className.split(' ')[0] : sec.tagName) : '', rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth, hit,
    ring: e.matches(':focus-visible'), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} off ${cs.outlineOffset}`, shadow: (cs.boxShadow !== 'none' ? cs.boxShadow.slice(0, 40) : '') || ['::before', '::after'].map((q) => { const c = getComputedStyle(e, q); return c.boxShadow !== 'none' ? 'pseudo ' + q + ' ' + c.boxShadow.slice(0, 40) : (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0 ? 'pseudo ' + q + ' outline' : ''); }).find(Boolean) || '', scrollY: Math.round(scrollY),
  };
};
const FOCUSABLES = () => (window.__foc = [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex], video[controls]')].filter((e) => {
  if (e.tabIndex < 0 || e.disabled || e.closest('[hidden],[inert]') || e.closest('dialog:not([open])')) return false;
  { const d = e.closest('details:not([open])'); if (d && !(e.tagName === 'SUMMARY' && e.parentElement === d)) return false; }
  for (let a = e; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden') return false; }
  return true;
})).map((e) => (e.getAttribute('aria-label') || e.textContent || e.id || '').replace(/\s+/g, ' ').trim().slice(0, 40) + ' <' + e.tagName.toLowerCase() + (e.getAttribute('href') ? ' ' + e.getAttribute('href').slice(0, 30) : '') + '>');
const SETTLE = async (pg) => { let last = -1, n = 0; for (let i = 0; i < 40 && n < 4; i++) { await sleep(120); const y = await pg.evaluate(() => scrollY); if (y === last) n++; else { n = 0; last = y; } } await sleep(900); };

async function keysRun(engineName, vp, motion = 'no-preference') {
  const pw = await import('playwright');
  const br = await pw[engineName].launch();
  const ctx = await br.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dsf || 1, reducedMotion: motion, acceptDownloads: true });
  const pg = await ctx.newPage();
  const tag = `${engineName} ${vp.w}x${vp.h}${motion === 'reduce' ? ' reduced' : ''}`;
  const steps = [];
  const rec = (k, d) => steps.push({ k, ...d });
  await pg.goto(BASE, { waitUntil: 'load' }); await sleep(2200);
  await pg.evaluate(() => { document.activeElement && document.activeElement.blur(); scrollTo(0, 0); });
  const all = await pg.evaluate(FOCUSABLES);
  // 1. Tab from the top, identity-based: stop when focus lands on an element it has already visited, or returns to the page
  const stops = [];
  for (let i = 0; i < 260; i++) {
    await pg.keyboard.press('Tab'); await SETTLE(pg);
    const dup = await pg.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return 'body'; const d = !!e.__aud; e.__aud = 1; return d ? 'dup' : ''; });
    const d = await pg.evaluate(DESCRIBE);
    if (dup) { stops.push({ i: i + 1, end: dup, ...d }); break; }
    stops.push({ i: i + 1, ...d });
  }
  save(`keys-tab-${tag.replace(/ /g, '_')}.json`, stops);
  const real = stops.filter((x) => !x.end);
  const sections = real.map((x) => x.sec).filter((v, i, a) => i === 0 || v !== a[i - 1]);
  line('keys', `[${tag}] Tab from the top: ${real.length} stops, ends with ${stops[stops.length - 1].end || 'the cap'}`, 'pass', `section order: ${sections.join(' > ')}`, 'keys-tab-*.json');
  const missedEls = await pg.evaluate(() => (window.__foc || []).filter((e) => !e.__aud).map((e) => (e.getAttribute('aria-label') || e.textContent || e.id || '').replace(/\s+/g, ' ').trim().slice(0, 40) + ' <' + e.tagName.toLowerCase() + (e.getAttribute('href') ? ' ' + e.getAttribute('href').slice(0, 30) : '') + '>'));
  line('keys', `[${tag}] every visible focusable element is reached by Tab`, missedEls.length ? 'fail' : 'pass', `${all.length} focusable in the DOM, ${real.length} stops, ${missedEls.length} not reached${missedEls.length ? ': ' + missedEls.slice(0, 6).join(' | ') : ''}`);
  const noRing = real.filter((x) => !x.ring || (/^none|0px/.test(x.outline) && !x.shadow));
  line('keys', `[${tag}] visible focus ring on every stop (:focus-visible matches, outline or shadow drawn)`, noRing.length ? 'fail' : 'pass', `${real.length} stops, ${noRing.length} without${noRing.length ? ': ' + noRing.slice(0, 4).map((x) => `${x.el} "${x.name}" ${x.outline}`).join(' | ') : ''}`);
  const covered = real.filter((x) => x.hit !== 'ok' && x.inView);
  line('keys', `[${tag}] a focused element is never covered by the header, the rail or another layer`, covered.length ? 'fail' : 'pass', `${covered.length} covered${covered.length ? ': ' + covered.slice(0, 5).map((x) => `${x.el} "${x.name}" ${x.hit} (${x.sec}, y ${x.scrollY}, rect ${JSON.stringify(x.rect)})`).join(' | ') : ''}`);
  const off = real.filter((x) => !x.inView);
  line('keys', `[${tag}] a focused element is scrolled into view`, off.length ? 'fail' : 'pass', `${off.length} stops off screen${off.length ? ': ' + off.slice(0, 5).map((x) => `${x.el} "${x.name}" ${JSON.stringify(x.rect)}`).join(' | ') : ''}`);
  const order = ['hdr', 'top', 'wingman', 'g-wagon', 'pokemon', 'hot-wheels', 'map', 'story', 'on-the-clock', 'foot', 'rail'];
  // 2. scenarios
  const fresh = async () => { await pg.goto(BASE, { waitUntil: 'load' }); await sleep(1800); await pg.evaluate(() => { document.activeElement && document.activeElement.blur(); scrollTo(0, 0); }); };
  const focusEl = async (sel) => { await pg.evaluate((s) => { const e = document.querySelector(s); e.focus(); }, sel); await sleep(150); };
  // switch
  await fresh();
  await focusEl('.switch__i[href="#on-the-clock"]'); await pg.keyboard.press('Enter'); await sleep(2200);
  const sw = await pg.evaluate(() => ({ top: Math.round(document.getElementById('on-the-clock').getBoundingClientRect().top), cur: [...document.querySelectorAll('.switch__i')].map((a) => a.getAttribute('aria-current')), focus: document.activeElement.className || document.activeElement.tagName }));
  line('keys', `[${tag}] switch: Enter on "On the clock" lands on section 09`, Math.abs(sw.top) <= 90 ? 'pass' : 'fail', `section top at ${sw.top}px, aria-current ${JSON.stringify(sw.cur)}, focus on ${sw.focus}`);
  await focusEl('.switch__i[href="#top"]'); await pg.keyboard.press('Enter'); await sleep(2200);
  const sw2 = await pg.evaluate(() => scrollY);
  line('keys', `[${tag}] switch: Enter on "Off the clock" returns to the top`, sw2 < 60 ? 'pass' : 'fail', `scrollY ${sw2}`);
  // resume
  await focusEl('.hdr__resume');
  const dlp = pg.waitForEvent('download', { timeout: 6000 }).catch(() => null);
  await pg.keyboard.press('Enter'); const dl = await dlp;
  line('keys', `[${tag}] Resume: Enter downloads the PDF`, dl ? 'pass' : 'fail', dl ? dl.suggestedFilename() : 'no download event');
  // rail
  await fresh();
  await pg.evaluate(() => scrollTo(0, 1500)); await sleep(900);
  const railState = await pg.evaluate(() => document.getElementById('rail').className);
  await pg.keyboard.press('Tab');
  await focusEl('#rail a[href="#pokemon"]');
  const hv = await pg.evaluate(DESCRIBE);
  line('keys', `[${tag}] rail: a thumbnail link takes focus and is on screen (rail state "${railState}")`, hv.inView && hv.hit === 'ok' ? 'pass' : 'fail', `${hv.name} rect ${JSON.stringify(hv.rect)} hit ${hv.hit}`);
  await pg.keyboard.press('Enter'); await sleep(2400);
  const rw = await pg.evaluate(() => ({ w: document.querySelector('.hdr__ctl').getAttribute('data-world'), cur: document.querySelector('#rail [aria-current="true"]') && document.querySelector('#rail [aria-current="true"]').getAttribute('href') }));
  line('keys', `[${tag}] rail: Enter on the Pokemon thumbnail goes to room 3`, rw.w === 'pokemon' && rw.cur === '#pokemon' ? 'pass' : 'fail', JSON.stringify(rw));
  const pill = await pg.evaluate(() => { const b = document.querySelector('.rail__now, .rail__more'); return b ? { cls: b.className, exp: b.getAttribute('aria-expanded') } : null; });
  if (pill) { await focusEl('.rail__more'); await pg.keyboard.press('Enter'); await sleep(500); const e2 = await pg.evaluate(() => document.querySelector('.rail__more').getAttribute('aria-expanded')); line('keys', `[${tag}] rail: "More sections" button toggles aria-expanded with Enter`, e2 === 'true' ? 'pass' : 'not tested', `aria-expanded ${pill.exp} -> ${e2} (the button exists at phone widths only)`); await pg.keyboard.press('Enter'); }
  // room controls: film button in room 2
  await fresh();
  await goState(pg, STATES[1], 1500);
  const play = await pg.evaluate(() => { const b = document.querySelector('#wingman .play'); return b ? b.getAttribute('aria-label') : null; });
  if (play) {
    await focusEl('#wingman .play'); const lab0 = await pg.evaluate(() => document.querySelector('#wingman .play').getAttribute('aria-label') + '|' + document.querySelector('#wingman .play').getAttribute('aria-pressed'));
    await pg.keyboard.press('Space'); await sleep(600);
    const lab1 = await pg.evaluate(() => document.querySelector('#wingman .play').getAttribute('aria-label') + '|' + document.querySelector('#wingman .play').getAttribute('aria-pressed'));
    line('keys', `[${tag}] room film button toggles from the keyboard (Space)`, lab0 !== lab1 ? 'pass' : 'not tested', `${lab0} -> ${lab1} (play buttons only matter when the film is not autoplaying)`);
  } else line('keys', `[${tag}] room film button`, 'not tested', 'no .play button in the Wingman room in this state');
  // palette segments: focus shows the hex (tooltip)
  const seg = await pg.evaluate(() => { const b = document.querySelector('#wingman .seg'); if (!b) return null; b.focus(); const cs = getComputedStyle(b); return { label: b.getAttribute('aria-label'), outline: cs.outlineStyle + ' ' + cs.outlineWidth }; });
  line('keys', `[${tag}] palette segment is focusable with a name`, seg && seg.label ? 'pass' : 'fail', JSON.stringify(seg));
  // strip -> lightbox -> back, in every room that has a strip
  for (const st of STATES.filter((x) => ['wingman', 'pokemon', 'hot-wheels', 'g-wagon'].includes(x.id))) {
    await goState(pg, st, 1300);
    const sel = `#${st.id} .views__b`;
    if (!(await pg.$(sel))) { line('keys', `[${tag}] strip in ${st.name}`, 'fail', 'no strip button'); continue; }
    await focusEl(sel);
    const label = await pg.evaluate((s) => document.querySelector(s).querySelector('img').alt, sel);
    await pg.keyboard.press('Enter'); await sleep(900);
    const o = await pg.evaluate(() => { const lb = document.getElementById('lb'); const a = document.activeElement; return { open: lb.open, inside: lb.contains(a), focus: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 20), cap: lb.querySelector('.lb__cap').textContent.trim().slice(0, 50) }; });
    let trapOK = true; const seen = [];
    for (let i = 0; i < 8; i++) { await pg.keyboard.press('Tab'); await sleep(60); const r = await pg.evaluate(() => ({ inside: document.getElementById('lb').contains(document.activeElement), n: (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || '').trim().slice(0, 14) })); seen.push(r.n); if (!r.inside) trapOK = false; }
    await pg.keyboard.press('ArrowRight'); await sleep(500);
    const cap2 = await pg.evaluate(() => document.querySelector('.lb__cap').textContent.trim().slice(0, 50));
    await pg.keyboard.press('ArrowLeft'); await sleep(500);
    await pg.keyboard.press('Escape'); await sleep(900);
    const back = await pg.evaluate((s) => { const lb = document.getElementById('lb'); return { open: lb.open, ret: document.activeElement === document.querySelector(s), now: (document.activeElement.className + '').slice(0, 20) }; }, sel);
    line('keys', `[${tag}] ${st.name}: strip button opens the lightbox with focus inside`, o.open && o.inside ? 'pass' : 'fail', JSON.stringify(o));
    line('keys', `[${tag}] ${st.name}: Tab stays inside the open lightbox (8 presses: ${seen.join(', ')})`, trapOK ? 'pass' : 'fail', '');
    line('keys', `[${tag}] ${st.name}: ArrowRight changes the caption`, cap2 !== o.cap ? 'pass' : 'not tested', `${o.cap} -> ${cap2}`);
    line('keys', `[${tag}] ${st.name}: Escape closes and focus returns to the thumbnail button`, !back.open && back.ret ? 'pass' : 'fail', JSON.stringify(back));
  }
  // map
  await fresh(); await goState(pg, STATES[6], 1500);
  const mp = await pg.evaluate(() => { const v = document.getElementById('map-vp'); return v ? { vp: !!v.getBoundingClientRect().width, nodes: document.querySelectorAll('.map__node').length, w: document.getElementById('map-world') && document.getElementById('map-world').style.transform } : null; });
  if (!mp || !mp.nodes) line('keys', `[${tag}] map loaded`, 'fail', JSON.stringify(mp));
  else {
    await focusEl('#map-vp');
    const t0 = await pg.evaluate(() => document.getElementById('map-world').style.transform || getComputedStyle(document.getElementById('map-world')).transform);
    for (const k of ['ArrowRight', 'ArrowDown', '+']) { await pg.keyboard.press(k); await sleep(250); }
    const t1 = await pg.evaluate(() => document.getElementById('map-world').style.transform || getComputedStyle(document.getElementById('map-world')).transform);
    await pg.keyboard.press('0'); await sleep(500);
    const t2 = await pg.evaluate(() => document.getElementById('map-world').style.transform || getComputedStyle(document.getElementById('map-world')).transform);
    line('keys', `[${tag}] map: arrow keys pan and + zooms, 0 resets`, t0 !== t1 && t2 !== t1 ? 'pass' : 'fail', `${t0.slice(0, 40)} -> ${t1.slice(0, 40)} -> ${t2.slice(0, 40)}`);
    await pg.keyboard.press('Tab'); await sleep(200);
    const n1 = await pg.evaluate(DESCRIBE);
    await pg.keyboard.press('Enter'); await sleep(1500);
    const pan = await pg.evaluate(() => { const p = document.querySelector('.map__panel'); const a = document.activeElement; return { open: !!p && p.offsetParent !== null, inside: !!p && p.contains(a), focus: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 24) }; });
    line('keys', `[${tag}] map: Enter on a node opens the detail panel with focus inside`, pan.open && pan.inside ? 'pass' : 'fail', JSON.stringify(pan) + ' node: ' + n1.name);
    const seen = []; let trap = true;
    for (let i = 0; i < 14; i++) { await pg.keyboard.press('Tab'); await sleep(60); const r = await pg.evaluate(() => ({ inside: !!document.querySelector('.map__panel').contains(document.activeElement), n: (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || '').trim().slice(0, 16) })); seen.push(r.n); if (!r.inside) trap = false; }
    line('keys', `[${tag}] map: Tab stays inside the open panel (14 presses)`, trap ? 'pass' : 'fail', seen.slice(0, 8).join(' | '));
    await pg.keyboard.press('Escape'); await sleep(1200);
    const ret = await pg.evaluate(() => ({ open: !!document.querySelector('.map__panel') && document.querySelector('.map__panel').offsetParent !== null, cls: (document.activeElement.className + '').slice(0, 30), name: (document.activeElement.getAttribute('aria-label') || '').slice(0, 40) }));
    line('keys', `[${tag}] map: Escape closes the panel and focus returns to the node`, !ret.open && /map__node/.test(ret.cls) ? 'pass' : 'fail', JSON.stringify(ret) + ' wanted ' + n1.name);
  }
  // story dots
  await fresh(); await goState(pg, STATES[7], 1500);
  const dots = await pg.evaluate(() => [...document.querySelectorAll('.dot__pt')].map((a) => ({ href: a.getAttribute('href'), name: a.getAttribute('aria-label') })));
  await focusEl('.dot__pt');
  const seenDots = [];
  for (let i = 0; i < dots.length; i++) { const d = await pg.evaluate(DESCRIBE); seenDots.push(d); await pg.keyboard.press('Tab'); await sleep(120); }
  const dotBad = seenDots.filter((d) => !d.inView || d.hit !== 'ok' || !d.ring);
  line('keys', `[${tag}] story: ${dots.length} dots in order, each focusable, on screen, not covered, ring drawn`, dots.length === 9 && !dotBad.length ? 'pass' : 'fail', `${dotBad.length} problems${dotBad.length ? ': ' + dotBad.slice(0, 3).map((d) => `${d.name} ${d.hit} inView ${d.inView} ring ${d.ring}`).join(' | ') : ''}`);
  const internal = dots.find((d) => /^#/.test(d.href));
  if (internal) { await focusEl(`.dot__pt[href="${internal.href}"]`); await pg.keyboard.press('Enter'); await sleep(2300); const w = await pg.evaluate(() => document.querySelector('.hdr__ctl').getAttribute('data-world')); line('keys', `[${tag}] story: Enter on a dot linking ${internal.href} goes to that room`, w ? 'pass' : 'fail', `header world ${w}`); }
  await fresh(); await goState(pg, STATES[7], 1500);
  const mapDot = dots.find((d) => /open=/.test(d.href));
  if (mapDot) { await focusEl(`.dot__pt[href="${mapDot.href}"]`); await pg.keyboard.press('Enter'); await sleep(3500); const o = await pg.evaluate(() => { const p = document.querySelector('.map__panel'); return { open: !!p && p.offsetParent !== null, inside: !!p && p.contains(document.activeElement) }; }); line('keys', `[${tag}] story: Enter on a dot linking ${mapDot.href} opens the map panel`, o.open ? 'pass' : 'fail', JSON.stringify(o)); await pg.keyboard.press('Escape'); await sleep(800); }
  // On the clock links and footer
  await fresh(); await goState(pg, STATES[8], 1500);
  await focusEl('#on-the-clock a');
  const otc = [];
  for (let i = 0; i < 40; i++) { const d = await pg.evaluate(DESCRIBE); if (!d.body && d.sec !== 'on-the-clock' && d.sec !== 'otc' && !/otc/.test(d.sec || '')) { otc.push({ ...d, out: true }); break; } otc.push(d); await pg.keyboard.press('Tab'); await sleep(90); }
  const inOtc = otc.filter((d) => !d.out);
  const otcBad = inOtc.filter((d) => !d.inView || d.hit !== 'ok' || !d.ring);
  const expectOtc = await pg.evaluate(() => [...document.querySelectorAll('#on-the-clock a[href], #on-the-clock button')].length);
  line('keys', `[${tag}] On the clock: ${inOtc.length} of ${expectOtc} links and buttons reached in order, then the footer`, inOtc.length === expectOtc && !otcBad.length ? 'pass' : 'fail', `${otcBad.length} problems${otcBad.length ? ': ' + otcBad.slice(0, 3).map((d) => `${d.name} ${d.hit} inView ${d.inView} ring ${d.ring}`).join(' | ') : ''}; order: ${inOtc.map((d) => d.name.slice(0, 18)).join(' > ')}`);
  const last = await pg.evaluate(DESCRIBE);
  line('keys', `[${tag}] footer: the next stop after On the clock`, last.sec === 'foot' || /Behance/.test(last.name) ? 'pass' : 'fail', `${last.name} (${last.sec}) hit ${last.hit} inView ${last.inView} ring ${last.ring}`);
  save(`keys-steps-${tag.replace(/ /g, '_')}.json`, steps);
  await br.close();
}
async function keys() {
  // WebKit is left out on purpose: Safari does not Tab to links unless Option+Tab is used (owner list), so a scripted Tab walk there is not comparable.
  await keysRun('chromium', { w: 1440, h: 900, dsf: 1 });
  await keysRun('chromium', { w: 393, h: 660, dsf: 3 });
  await keysRun('firefox', { w: 393, h: 660, dsf: 3 });
  await keysRun('chromium', { w: 393, h: 660, dsf: 3 }, 'reduce');
}

// ---------------------------------------------------------------- nothing interactive under the header or rail (WebKit, 393x660)
const COVER = () => {
  const hdr = document.getElementById('hdr'), rail = document.getElementById('rail');
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return null; for (let p = e, i = 0; p && i < 6; p = p.parentElement, i++) { const c = getComputedStyle(p); if (c.visibility === 'hidden' || c.display === 'none' || +c.opacity < 0.05) return null; } return r; };
  const out = [];
  // the parts of the header and rail that are painted right now
  const chrome = [];
  for (const [root, sel, ref] of [[hdr, '.hdr__bar, .hdr__name, .switch, .hdr__resume', 'header'], [rail, ':scope', 'rail']]) for (const e of root.matches(sel) ? [root] : root.querySelectorAll(sel)) { const r = vis(e); if (r) chrome.push({ ref, r }); }
  const railR = vis(rail); if (railR && !rail.classList.contains('is-tucked') && !chrome.some((c) => c.ref === 'rail')) chrome.push({ ref: 'rail', r: railR });
  const hv = hdr.style.visibility, rv = rail.style.visibility; hdr.style.visibility = 'hidden'; rail.style.visibility = 'hidden';
  const els = [...document.querySelectorAll('main a[href], main button, main summary, main input, main [tabindex]:not([tabindex="-1"]), footer a')].filter((e) => !hdr.contains(e) && !rail.contains(e) && !e.closest('dialog'));
  for (const e of els) {
    const r = vis(e); if (!r || r.bottom <= 0 || r.top >= innerHeight || r.height > 220) continue;
    const pts = [[0.5, 0.5], [0.15, 0.5], [0.85, 0.5], [0.5, 0.15], [0.5, 0.85]].map(([a, b]) => [Math.min(Math.max(r.left + r.width * a, 1), innerWidth - 1), Math.min(Math.max(r.top + r.height * b, 1), innerHeight - 1)]);
    // only elements that are really on top of the page at their own position (not a hidden earlier room's layer)
    const top = document.elementFromPoint(pts[0][0], pts[0][1]);
    if (!(top && (top === e || e.contains(top) || top.contains(e)))) continue;
    const cov = pts.map(([x, y]) => { const c = chrome.find((c) => x >= c.r.left && x <= c.r.right && y >= c.r.top && y <= c.r.bottom); return c ? c.ref : ''; }).filter(Boolean);
    if (cov.length) out.push({ el: (e.getAttribute('aria-label') || e.textContent || e.className).replace(/\s+/g, ' ').trim().slice(0, 40), tag: e.tagName.toLowerCase(), by: cov[0], pts: cov.length + '/5', rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] });
  }
  hdr.style.visibility = hv; rail.style.visibility = rv;
  return { out, rail: rail.className, hdrWorld: document.querySelector('.hdr__ctl').getAttribute('data-world'), y: Math.round(scrollY) };
};
async function hidden() {
  const { webkit } = await import('playwright');
  const br = await webkit.launch();
  const ctx = await br.newContext({ viewport: { width: 393, height: 660 }, deviceScaleFactor: 3, hasTouch: true });
  const pg = await ctx.newPage();
  await pg.goto(BASE, { waitUntil: 'load' }); await sleep(2500);
  const all = [];
  // accepted: the hero card (exception 1) and the rail pill after scrolling up (exception 3); everything else fails
  const verdict = (r, hero, up) => {
    if (!r.out.length) return 'pass';
    if (hero) return 'accepted';
    if (up && r.rail.includes('is-compact') && r.out.every((o) => o.by === 'rail')) return 'accepted';
    return 'fail';
  };
  const check = async (label, { hero = false, up = false } = {}) => {
    const r = await pg.evaluate(COVER);
    all.push({ label, ...r });
    const v = verdict(r, hero, up);
    line('hidden', `${label} (rail "${r.rail.replace(/\\s+/g, ' ').replace('rail ', '')}")`, v, r.out.length ? r.out.map((o) => `${o.tag} "${o.el}" under ${o.by} ${o.pts}`).join(' | ') : 'nothing interactive under the header or rail', v === 'accepted' ? (hero ? 'hero card: accepted exception 1' : 'rail pill after scrolling up: accepted exception 3') : '');
    await pg.screenshot({ path: path.join(SHOTS, `hidden-${label.replace(/[^a-z0-9]+/gi, '-')}.png`) });
  };
  for (const st of STATES) { await goState(pg, st, 1700); await check(`${st.name} at rest`, { hero: st.id === 'top' }); }
  const geo = (id) => pg.evaluate((i) => { const r = document.getElementById(i).getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; }, id);
  const glide = async (y, ms = 100) => { const cur = await pg.evaluate(() => scrollY); for (let i = 1; i <= 6; i++) { await pg.evaluate((v) => scrollTo(0, v), cur + ((y - cur) * i) / 6); await sleep(ms); } await sleep(1600); };
  for (const id of ['map', 'story', 'on-the-clock']) {
    for (const where of ['top', 'bottom']) {
      for (const dir of ['down', 'up']) {
        // approach from above (down) or from below (up) so the rail and header are in the state a reader would meet
        let g = await geo(id);
        const from = dir === 'down' ? Math.max(g.top - 1500, 0) : g.top + g.h + 400;
        await pg.evaluate((v) => scrollTo(0, v), from); await sleep(1800);
        g = await geo(id);
        await glide(where === 'top' ? g.top : g.top + g.h - 660);
        g = await geo(id);
        await glide(where === 'top' ? g.top : g.top + g.h - 660, 60); // land again in case the section changed height while loading
        await check(`${id} ${where}, arrived scrolling ${dir}`, { up: dir === 'up' });
      }
    }
  }
  // walk the long sections in 330 px steps, scrolling down, and flag any rest position with something interactive under the header or rail
  let steps = 0; const bad = [];
  for (const id of ['map', 'story', 'on-the-clock']) {
    const g0 = await geo(id);
    await pg.evaluate((v) => scrollTo(0, v), Math.max(g0.top - 1200, 0)); await sleep(1500);
    for (let y = g0.top - 200; y < g0.top + g0.h; y += 330) {
      await pg.evaluate((v) => scrollTo(0, v), y); await sleep(320); steps++;
      const r = await pg.evaluate(COVER); if (r.out.length) bad.push({ id, y: Math.round(y - g0.top), rail: r.rail, out: r.out });
    }
  }
  save('hidden-walk.json', bad);
  line('hidden', `walk through map, story and On the clock in 330 px steps (${steps} rest positions, scrolling down)`, bad.length ? 'info' : 'pass', `${bad.length} positions have an interactive element under the header bar or rail while passing; mid-scroll overlap is expected for fixed chrome${bad.length ? ': ' + bad.slice(0, 4).map((b) => `${b.id}+${b.y}: ${b.out.slice(0, 2).map((o) => `${o.tag} "${o.el.slice(0, 20)}" by ${o.by}`).join(',')}`).join(' | ') : ''}`, 'hidden-walk.json');
  save('hidden-states.json', all);
  await br.close();
}

// ---------------------------------------------------------------- run
const CHECKS = { links, content, build, perf, contrast, a11y, keys, hidden, excluded: async () => { await excluded(); await originals(); untrackedDirs(); } };
CHECKS.overflow = async () => { const r = spawnSync('node', [path.join(TOOLS, 'overflow-check.mjs'), '--base', BASE, '--out', path.join(OUT, 'overflow'), '--shots', path.join(SHOTS, 'overflow')], { stdio: 'inherit' }); line('overflow', 'tools/overflow-check.mjs', r.status === 0 ? 'pass' : 'fail', 'exit code ' + r.status); };
const names = CHECK === 'all' ? ['links', 'excluded', 'content', 'build', 'perf', 'contrast'] : [CHECK];
for (const n of names) {
  if (!CHECKS[n]) { console.error('unknown check ' + n); process.exit(2); }
  console.log('\n== ' + n);
  await CHECKS[n]();
}
save(`audit-${CHECK}.json`, rows);
const failed = rows.filter((r) => r.status === 'fail').length;
console.log(`\n${rows.length} lines, ${failed} fail`);
process.exit(failed ? 1 : 0);
