// Cross-engine check of the site: Playwright WebKit (Safari's engine, NOT Safari, NOT iOS), Firefox and Chromium.
//
//   node tools/browser-check.mjs [--base http://localhost:4215/] [--out <dir>] [--shots <dir>]
//        [--engines webkit,firefox,chromium] [--vps 393x660,390x844,1440x900] [--motion normal,reduced]
//        [--suite main|overflow|startup|all]   (default all)
//   node tools/browser-check.mjs --summary --out <dir>      prints markdown tables from saved results
//
// Serve the built site first: python3 -m http.server 4215 -d site
// Results are JSON files in --out; screenshots go to --shots/<engine>/ (keep both outside the repo).
// Browsers are installed outside the repo: npx playwright install webkit firefox chromium
import { webkit, firefox, chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';

const A = process.argv.slice(2);
const opt = (k, d) => { const i = A.indexOf('--' + k); return i > -1 && A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : d; };
const BASE = opt('base', 'http://localhost:4215/');
const OUT = opt('out', '/tmp/t15-results');
const SHOTS = opt('shots', '/tmp/t15-shots');
const ENGINES = opt('engines', 'webkit,firefox,chromium').split(',');
const ENG = { webkit, firefox, chromium };
const ALLVP = { '393x660': { w: 393, h: 660, dsf: 3, touch: true }, '390x844': { w: 390, h: 844, dsf: 2, touch: true }, '1440x900': { w: 1440, h: 900, dsf: 1, touch: false } };
const VPS = opt('vps', '393x660,390x844,1440x900').split(',');
const MOTIONS = opt('motion', 'normal,reduced').split(',');
const SUITE = opt('suite', 'all');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (A.includes('--summary')) { summary(); process.exit(0); }
mkdirSync(OUT, { recursive: true });

// In-page helpers, installed before any page script runs.
function installHelpers() {
  const t = (window.__t = {});
  try {
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.tagName === 'SCRIPT' && /js\/site\.js/.test(n.src || '')) {
          t.append = performance.now(); t.scrollAtAppend = window.scrollY;
          n.addEventListener('load', () => { t.loaded = performance.now(); });
        }
      }
    }).observe(document, { childList: true, subtree: true });
  } catch (e) { t.moErr = String(e); }
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (t.lcp == null) t.lcp = e.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) { t.lcpUnsupported = true; }
  window.__h = {
    geo() {
      const H = innerHeight, wipe = document.documentElement.classList.contains('wipe');
      const rooms = [...document.querySelectorAll('[data-room]')].map((r, i) => ({ id: r.id, y: wipe ? Math.round(i * 1.35 * H) : Math.round(r.getBoundingClientRect().top + scrollY) }));
      const sec = (id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return { id, top: Math.round(r.top + scrollY), h: Math.round(r.height) }; };
      return { H, W: innerWidth, wipe, rooms, secs: ['map', 'story', 'on-the-clock'].map(sec), total: document.documentElement.scrollHeight };
    },
    // block right edges, document width
    edges() {
      const iw = document.documentElement.clientWidth, out = [];
      const sel = 'main > *, main section > *, .room__inner > *, .room__inner .copy > *, .card, .piece, .views, .pgrid > *, .pcard article, .feat, .feat *, .pcard *, .tl__c, .stat, .btn, .otc__first > *, .story__in > *, .map__head, .map__head *, .hdr > *, #rail, .otc .actions a, .tags li';
      for (const e of document.querySelectorAll(sel)) {
        const q = e.getBoundingClientRect();
        if (q.width && (q.right > iw + 0.5 || q.left < -0.5)) out.push((e.className && e.className.baseVal === undefined ? e.className : e.tagName) + ' ' + Math.round(q.left) + '..' + Math.round(q.right));
      }
      return { sw: document.documentElement.scrollWidth, iw, out: out.slice(0, 8), n: out.length };
    },
    // interactive elements that visibly intersect the fixed header or the rail
    overlap() {
      const hdr = document.getElementById('hdr'), rail = document.getElementById('rail');
      const hv = hdr.style.visibility, rv = rail.style.visibility;
      const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return null; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return null; for (let p = e, i = 0; p && i < 4; p = p.parentElement, i++) if (+getComputedStyle(p).opacity < 0.05) return null; return r; };
      const fixedRects = (root, sel, ref) => [...root.querySelectorAll(sel)].map((e) => ({ ref, r: vis(e), n: (e.className || e.tagName) + '' })).filter((x) => x.r && x.r.bottom > 0 && x.r.top < innerHeight && x.r.right > 0 && x.r.left < innerWidth);
      const hRects = fixedRects(hdr, '.hdr__bar, .hdr__name, .switch, .hdr__resume', 'header');
      const rRects = fixedRects(rail, 'a, button, ol, .rail__in, :scope > div', 'rail');
      const fixed = hRects.concat(rRects);
      hdr.style.visibility = 'hidden'; rail.style.visibility = 'hidden';
      const bad = [];
      const els = [...document.querySelectorAll('main a[href], main button, main summary, main input, footer a, [tabindex]:not([tabindex="-1"])')].filter((e) => !hdr.contains(e) && !rail.contains(e) && !e.closest('dialog,.lb'));
      for (const e of els) {
        const r = vis(e); if (!r || r.bottom <= 0 || r.top >= innerHeight || r.height > 200) continue; // big scroll containers (the map viewport) are not tap targets
        const cx = Math.min(Math.max((r.left + r.right) / 2, 1), innerWidth - 1), cy = Math.min(Math.max((r.top + r.bottom) / 2, 1), innerHeight - 1);
        const top = document.elementFromPoint(cx, cy);
        if (!top || !(top === e || e.contains(top) || top.contains(e))) continue; // clipped away or covered by something else
        for (const f of fixed) {
          const ix = Math.min(r.right, f.r.right) - Math.max(r.left, f.r.left), iy = Math.min(r.bottom, f.r.bottom) - Math.max(r.top, f.r.top);
          if (ix > 1 && iy > 1) { bad.push({ el: ((e.className || e.tagName) + '').slice(0, 40) + ' "' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24) + '"', hit: f.ref + ':' + String(f.n).slice(0, 24), y: Math.round(r.top) + '..' + Math.round(r.bottom), room: (e.closest('[data-room]') || {}).id || (e.closest('section') || {}).id || '' }); break; }
        }
      }
      hdr.style.visibility = hv; rail.style.visibility = rv;
      return bad.slice(0, 10);
    },
    boxes() {
      const r = (e) => { if (!e) return null; const q = e.getBoundingClientRect(); return [Math.round(q.width * 10) / 10, Math.round(q.height * 10) / 10]; };
      const o = {};
      document.querySelectorAll('.pcard .pimg, .feat .pimg').forEach((e, i) => { o['pimg' + i] = r(e); });
      document.querySelectorAll('.views').forEach((v, i) => { v.querySelectorAll('.views__b').forEach((b, j) => { o['strip' + i + '.' + j] = r(b); }); });
      document.querySelectorAll('[data-room] .piece').forEach((e, i) => { o['piece' + i] = r(e); });
      document.querySelectorAll('#map-list li img').forEach((e, i) => { if (i < 4) o['maplist' + i] = r(e); });
      const li = document.querySelector('.lb__stage img'); if (li) o.lbimg = r(li);
      return o;
    },
    feats() {
      const S = (a, b) => (b === undefined ? CSS.supports(a) : CSS.supports(a, b));
      const title = document.querySelector('.title .heavy') || document.querySelector('.title');
      let axis = null;
      if (title) {
        const s = document.createElement('span'); s.textContent = 'Chatterjee Wingman Render'; s.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:60px;font-weight:800;transition:none!important;font-family:' + getComputedStyle(title).fontFamily;
        document.body.appendChild(s); s.style.fontStretch = '75%'; const a = s.offsetWidth; s.style.fontStretch = '100%'; const b = s.offsetWidth; s.remove(); axis = { w75: a, w100: b, works: b > a * 1.03 };
      }
      const v = document.createElement('video');
      return {
        clipPathCircle: S('clip-path', 'circle(50% at 50% 50%)'), maskImage: S('mask-image', 'linear-gradient(#000,transparent)'), webkitMaskImage: S('-webkit-mask-image', 'linear-gradient(#000,transparent)'),
        backdropFilter: S('backdrop-filter', 'blur(2px)'), svh: S('height', '100svh'), lvh: S('height', '100lvh'), dvh: S('height', '100dvh'), containerType: S('container-type', 'inline-size'),
        textWrapBalance: S('text-wrap', 'balance'), aspectRatio: S('aspect-ratio', '16/9'), focusVisible: (() => { try { document.querySelector(':focus-visible'); return true; } catch (e) { return false; } })(),
        dialogShowModal: typeof HTMLDialogElement !== 'undefined' && !!HTMLDialogElement.prototype.showModal, fontStretchAxis: axis,
        scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior, h264: v.canPlayType('video/mp4; codecs="avc1.42E01E"'), lcpEntry: (PerformanceObserver.supportedEntryTypes || []).includes('largest-contentful-paint'),
      };
    },
  };
}

async function newCtx(browser, vp, reduced, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dsf, hasTouch: vp.touch, reducedMotion: reduced ? 'reduce' : 'no-preference', ...extra });
  await ctx.addInitScript(installHelpers);
  return ctx;
}
function watch(page, R, tag = '') {
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') R.console.push(`${tag}${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => R.console.push(`${tag}pageerror: ${String(e).slice(0, 200)}`));
  page.on('requestfailed', (q) => R.failed.push(`${tag}${q.resourceType()} ${q.url().replace(BASE, '/')} ${q.failure() && q.failure().errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) R.failed.push(`${tag}HTTP ${r.status()} ${r.url().replace(BASE, '/')}`); });
  page.on('request', (q) => R.reqs.push([Date.now(), q.url().replace(BASE, '/')]));
}

// ---------------------------------------------------------------- main suite
async function mainRun(engine, vpName, motion) {
  const vp = ALLVP[vpName], reduced = motion === 'reduced';
  const R = { engine, vp: vpName, motion, checks: {}, console: [], failed: [], reqs: [], shots: [], notes: {} };
  const dir = `${SHOTS}/${engine}`; mkdirSync(dir, { recursive: true });
  const chk = (k, pass, detail, shot) => { R.checks[k] = { pass: pass === null ? 'n/t' : pass ? 'pass' : 'FAIL', detail: detail === undefined ? '' : detail, shot: pass === false ? shot || '' : undefined }; };
  const b = await ENG[engine].launch();
  const ctx = await newCtx(b, vp, reduced);
  const page = await ctx.newPage();
  watch(page, R);
  let lastShot = '';
  const shot = async (name) => { const p = `${dir}/${vpName}-${motion}-${name}.png`; await page.screenshot({ path: p }); R.shots.push(p); lastShot = p; return p; };
  const go = async (y, wait = 700) => { await page.evaluate((v) => scrollTo({ top: v, behavior: 'instant' }), Math.round(y)); await sleep(wait); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { chk(name, false, 'script error: ' + String(e).split('\n')[0].slice(0, 160), lastShot); } };

  await page.goto(BASE, { waitUntil: 'load' });
  await sleep(2500);
  const mapReqEarly = R.reqs.filter(([, u]) => /map\.js|embedding\.json/.test(u)).length;
  const mapCssEarly = R.reqs.filter(([, u]) => /css\/map\.css/.test(u)).length;
  const geo = await page.evaluate(() => window.__h.geo());
  R.notes.geo = geo;
  const feats = await page.evaluate(() => window.__h.feats());
  R.notes.feats = feats;

  // fonts (subset files): both families loaded, no system fallback, and text widths to compare across engines
  await step('fonts', async () => {
    const f = await page.evaluate(async () => {
      await document.fonts.ready;
      const faces = [...document.fonts].map((x) => x.family.replace(/"/g, '') + ':' + x.status);
      const w = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = document.createRange(); r.selectNodeContents(e); const rects = [...r.getClientRects()]; return rects.length ? Math.round(Math.max(...rects.map((q) => q.width)) * 10) / 10 : null; };
      // a fallback test: the same string measured in the page font and in plain Arial; equal widths would mean the page font is not in use
      const probe = (family) => { const s = document.createElement('span'); s.textContent = 'Chatterjee Wingman Render 2023 $2.1M+'; s.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:40px;font-family:' + family; document.body.appendChild(s); const x = s.offsetWidth; s.remove(); return x; };
      const bodyFam = getComputedStyle(document.body).fontFamily;
      return { faces, bodyFam, bodyW: probe(bodyFam), arialW: probe('Arial'), dispW: probe('Bricolage, Arial'), checkBric: document.fonts.check('800 40px Bricolage'), checkInst: document.fonts.check('16px Instrument'),
        widths: { heroTitle: w('#h-hero'), heroLede: w('#top .lede'), wingTitle: w('#h-wingman'), wingLede: w('#wingman .lede'), storyTitle: w('#h-story'), storyBody: w('.story__body'), clockLead: w('.otc__lead'), clockTitle: w('#h-clock'), stat: w('.stat__n') } };
    });
    R.notes.fonts = f;
    const loaded = f.faces.filter((x) => /Bricolage|Instrument/.test(x));
    const ok = loaded.length >= 2 && loaded.every((x) => /loaded$/.test(x)) && f.bodyW !== f.arialW && f.dispW !== f.arialW;
    chk('fonts-subset-loaded', ok, JSON.stringify({ faces: loaded, bodyW: f.bodyW, arialW: f.arialW, dispW: f.dispW }), '');
  });

  // feature support
  await step('features', async () => {
    const f = feats;
    const miss = [];
    if (!f.clipPathCircle) miss.push('clip-path circle');
    if (!f.maskImage && !f.webkitMaskImage) miss.push('mask-image');
    if (!f.svh || !f.lvh) miss.push('svh/lvh');
    if (!f.containerType) miss.push('container queries');
    if (!f.dialogShowModal) miss.push('dialog.showModal');
    if (!f.fontStretchAxis || !f.fontStretchAxis.works) miss.push('font-stretch width axis');
    chk('features', miss.length === 0, miss.length ? 'missing: ' + miss.join(', ') : JSON.stringify({ mask: f.maskImage ? 'unprefixed' : f.webkitMaskImage ? 'prefixed only' : 'none', backdrop: f.backdropFilter, dvh: f.dvh, axis: f.fontStretchAxis, scrollBehavior: f.scrollBehavior }), '');
    chk('reduced-motion-path', reduced ? !geo.wipe : geo.wipe, reduced ? 'html.wipe absent (stacked rooms)' : 'html.wipe present');
  });

  // hero loop / video requests
  await step('hero-video', async () => {
    const samples = [];
    for (let i = 0; i < (reduced ? 2 : 14); i++) {
      samples.push(await page.evaluate(() => { const p = document.querySelector('.piece--hero'), v = document.querySelector('.piece__vid--hero'); return { playing: p.hasAttribute('data-hv'), t: v ? +v.currentTime.toFixed(2) : -1, paused: v ? v.paused : null, src: v ? !!(v.currentSrc || v.src) : false }; }));
      await sleep(500);
    }
    const mp4 = R.reqs.filter(([, u]) => /\.mp4/.test(u)).length;
    if (reduced) chk('hero-video', mp4 === 0 && !samples.some((s) => s.playing), `mp4 requests at load: ${mp4}; playing: ${samples.some((s) => s.playing)}`, '');
    else if (feats.h264 === '') chk('hero-video', null, 'engine cannot play H.264 (canPlayType empty): hero film cannot start; still stays. mp4 requests ' + mp4);
    else chk('hero-video', samples.some((s) => s.playing) && samples.some((s) => s.t > 0), `dissolve seen: ${samples.some((s) => s.playing)}; max t ${Math.max(...samples.map((s) => s.t))}; mp4 requests ${mp4}`, '');
    await shot('hero-0');
  });

  // rooms at rest
  const intersects = [];
  await step('rooms', async () => {
    for (let i = 0; i < geo.rooms.length; i++) {
      const r = geo.rooms[i];
      await go(r.y, 900);
      await shot(`room-${i + 1}`);
      const bad = await page.evaluate(() => window.__h.overlap());
      for (const x of bad) intersects.push({ where: 'room-' + (i + 1), ...x });
      if (!reduced && geo.wipe && i > 0) {
        await go(r.y - 0.45 * geo.H, 700);
        await shot(`wipe-mid-${i + 1}`);
        const clip = await page.evaluate(() => [...document.querySelectorAll('[data-room], [data-room] .piece, [data-room] .room__inner')].map((e) => getComputedStyle(e).clipPath).filter((c) => c && c !== 'none').slice(0, 3));
        R.notes['clip' + (i + 1)] = clip;
      }
    }
    const clipOk = reduced ? true : [2, 3, 4, 5, 6].every((n) => (R.notes['clip' + n] || []).some((c) => /circle|inset|polygon|path/.test(c)));
    chk('wipe-clip-path', clipOk, reduced ? 'n/a stacked' : JSON.stringify([R.notes.clip2, R.notes.clip4]), R.shots.find((s) => /wipe-mid-2/.test(s)));
  });

  // wipe frame timing (indicative only: headless, software compositing)
  await step('wipe-perf', async () => {
    if (reduced) return chk('wipe-perf', null, 'no wipe under reduced motion');
    await go(0, 400);
    const d = await page.evaluate((to) => new Promise((res) => { let y = 0, last = performance.now(); const ds = []; const f = (t) => { ds.push(t - last); last = t; y += 14; scrollTo({ top: y, behavior: 'instant' }); if (y < to) requestAnimationFrame(f); else res(ds); }; requestAnimationFrame(f); }), Math.round(geo.rooms[5].y));
    d.shift(); d.sort((a, c) => a - c);
    const p = (q) => +d[Math.min(d.length - 1, Math.floor(d.length * q))].toFixed(1);
    const avg = +(d.reduce((a, c) => a + c, 0) / d.length).toFixed(1);
    R.notes.perf = { frames: d.length, avg, p95: p(0.95), p99: p(0.99), max: +d[d.length - 1].toFixed(1) };
    chk('wipe-perf', R.notes.perf.p95 < 34, JSON.stringify(R.notes.perf) + ' (headless, indicative only)', '');
  });

  // full scroll pass: horizontal overflow and block edges
  await step('scroll-pass', async () => {
    let maxSW = 0; const offenders = new Set();
    const total = (await page.evaluate(() => window.__h.geo())).total;
    for (let y = 0; y < total; y += Math.round(geo.H / 2)) {
      await go(y, 90);
      const e = await page.evaluate(() => window.__h.edges());
      maxSW = Math.max(maxSW, e.sw); e.out.forEach((o) => offenders.add(Math.round(y) + ':' + o));
    }
    chk('no-horizontal-scroll', maxSW <= vp.w, `max scrollWidth ${maxSW} vs ${vp.w}`, lastShot);
    chk('blocks-inside-viewport', offenders.size === 0, [...offenders].slice(0, 5).join(' | '), lastShot);
  });

  // sections
  const secs = (await page.evaluate(() => window.__h.geo())).secs;
  await step('sections', async () => {
    for (const s of secs) {
      const pts = { top: s.top, mid: s.top + Math.max(0, (s.h - geo.H) / 2), bottom: s.top + Math.max(0, s.h - geo.H) };
      for (const [k, y] of Object.entries(pts)) {
        await go(Math.max(0, y - 120), 150); await go(y, 900); // arrive by scrolling down
        await shot(`${s.id}-${k}`);
        let bad = await page.evaluate(() => window.__h.overlap());
        for (const x of bad) intersects.push({ where: `${s.id}-${k}`, state: 'down', ...x });
        if (k !== 'top') { // after scrolling 80px back up: the rail pill shows
          await go(y - 80, 900);
          if (vp.w < 600 && vp.h < 700) await shot(`${s.id}-${k}-up`);
          bad = await page.evaluate(() => window.__h.overlap());
          for (const x of bad) intersects.push({ where: `${s.id}-${k}`, state: 'up', ...x });
        }
      }
    }
  });
  // Strict: every room at rest and every section top (header and rail), plus the rail anywhere. Mid/bottom positions are arbitrary
  // scroll stops where content legitimately slides under the header bar, so header hits there are information only.
  // Accepted by the owner: the hero's collapsed model card under the rail at 393x660; the rail pill on scroll up.
  const acc = intersects.filter((x) => (x.where === 'room-1' && /^rail/.test(x.hit)) || (x.state === 'up' && /^rail/.test(x.hit)));
  const info = intersects.filter((x) => !acc.includes(x) && /^header/.test(x.hit) && !/^room-|-top$/.test(x.where));
  const real = intersects.filter((x) => !acc.includes(x) && !info.includes(x));
  chk('no-overlap-with-header-or-rail', real.length === 0, JSON.stringify(real.slice(0, 6)) + ` | accepted by owner: ${acc.length}; under the header bar at mid/bottom stops (info): ${info.length}`, lastShot);
  R.notes.acceptedOverlaps = acc.slice(0, 8); R.notes.underHeaderInfo = info.slice(0, 8);

  // header bar hides content scrolling under it (pixel test on the bar band)
  await step('header-bar', async () => {
    const info = await page.evaluate(() => {
      const bar = document.querySelector('.hdr__bar'), im = document.querySelector('.feat .pimg');
      if (!bar || !im) return null;
      const bq = bar.getBoundingClientRect(), ctl = [...document.querySelectorAll('.hdr__name,.switch,.hdr__resume')].map((e) => e.getBoundingClientRect());
      const iq = im.getBoundingClientRect(); scrollTo({ top: iq.top + scrollY + 40, behavior: 'instant' });
      return { bh: bq.height, ctlTop: Math.min(...ctl.map((c) => c.top)), ctlBot: Math.max(...ctl.map((c) => c.bottom)) };
    });
    if (!info) return chk('header-bar', false, 'no .hdr__bar or .feat .pimg');
    await sleep(900);
    const p = await shot('header-bar-over-image');
    const q = await page.evaluate(() => { const bar = document.querySelector('.hdr__bar'); const cs = getComputedStyle(bar); return { bg: cs.backgroundColor, op: cs.opacity, h: bar.getBoundingClientRect().height }; });
    const img = await sharp(p).raw().toBuffer({ resolveWithObject: true });
    const W = img.info.width, ch = img.info.channels, s = vp.dsf;
    const lineStd = (yCss) => { const y = Math.min(img.info.height - 1, Math.round(yCss * s)); let sum = 0, sq = 0; for (let x = 0; x < W; x++) { const o = (y * W + x) * ch; const l = 0.3 * img.data[o] + 0.59 * img.data[o + 1] + 0.11 * img.data[o + 2]; sum += l; sq += l * l; } const m = sum / W; return Math.sqrt(Math.max(0, sq / W - m * m)); };
    const lines = [];
    if (info.ctlTop > 3) lines.push(['above controls', Math.max(1, info.ctlTop / 2)]);
    const res = lines.map(([n, y]) => `${n} y=${Math.round(y)} stdev=${lineStd(y).toFixed(1)}`);
    const opaque = /rgb\(|rgba\([^)]*,\s*(1|0?\.[89]\d*)\)/.test(q.bg) && +q.op > 0.9;
    const clean = lines.every(([, y]) => lineStd(y) < 8);
    chk('header-bar', opaque && clean, `bar ${Math.round(q.h)}px bg ${q.bg}; ${res.join('; ') || 'no free line to sample'}`, p);
  });

  // focus rings
  await step('focus-rings', async () => {
    await go(0, 500);
    const seen = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab'); await sleep(250);
      seen.push(await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { el: ((e.className || e.tagName) + '').slice(0, 30) + ' ' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 18), ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none', ow: cs.outlineWidth, oc: cs.outlineColor, inView: r.bottom > 0 && r.top < innerHeight }; }));
      if (i === 1) await shot('focus-2');
      if (i === 7) await shot('focus-8');
    }
    const got = seen.filter(Boolean), missing = got.filter((s) => !s.ring);
    chk('focus-rings', got.length >= 6 && missing.length === 0, `tabbed ${got.length} elements; without ring: ${missing.map((m) => m.el).join(', ') || 'none'}`, lastShot);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
  });

  // map: lazy load, detail, ESC
  await step('map', async () => {
    chk('map-lazy', mapReqEarly === 0, `map.js/embedding requests before scrolling: ${mapReqEarly}; css/map.css requested before scrolling: ${mapCssEarly}`);
    await go(secs[0].top - geo.H * 1.2, 100); await go(secs[0].top, 50);
    const samples = [];
    for (let i = 0; i < 30; i++) { samples.push(await page.evaluate(() => { const pl = document.getElementById('map-plot') || document.querySelector('.map__plot'); const cs = pl && getComputedStyle(pl); const r = pl && pl.getBoundingClientRect(); const vis = !!pl && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.height > 20; return { css: [...document.styleSheets].some((x) => /map\.css/.test(x.href || '')), vis, list: !!document.querySelector('#map-list li') }; })); await sleep(100); }
    const unstyled = samples.filter((x) => x.vis && !x.css).length;
    chk('map-never-unstyled', unstyled === 0 && samples.some((x) => x.css), `samples with plot visible before map.css applied: ${unstyled}/30; sheet applied: ${samples.some((x) => x.css)}; plot ever visible: ${samples.some((x) => x.vis)}`, await shot('map-arrival'));
    await sleep(800);
    const loaded = R.reqs.filter(([, u]) => /map\.js/.test(u)).length > 0;
    const n = await page.evaluate(() => document.querySelectorAll('#map-list li').length);
    let id = await page.evaluate(() => { const b = document.querySelector('#map-list [data-open]'); return b && b.dataset.open; });
    R.notes.mapId = id;
    chk('map-loads', loaded && n > 5 && !!id, `map.js requested: ${loaded}; list items: ${n}`, await shot('map-loaded'));
    const btn = page.locator('#map-list [data-open]').first();
    await btn.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
    await sleep(500);
    await btn.click({ timeout: 4000 }).catch(() => btn.evaluate((e) => e.click()));
    await sleep(1500);
    const d = await page.evaluate(() => { const e = document.getElementById('map-detail'); return { open: e.classList.contains('is-open'), title: (document.getElementById('md-title') || {}).textContent, url: location.search + location.hash }; });
    const p = await shot('map-detail-open');
    chk('map-detail', d.open && !!d.title, JSON.stringify(d), p);
    Object.assign(R.notes, { boxesDetail: await page.evaluate(() => window.__h.boxes()) });
    await page.keyboard.press('Escape'); await sleep(900);
    const closed = await page.evaluate(() => !document.getElementById('map-detail').classList.contains('is-open'));
    chk('map-detail-escape', closed, 'Escape closes the detail', await shot('map-detail-closed'));
  });

  // aspect-ratio boxes (compared across engines in the summary)
  R.notes.boxes = await page.evaluate(() => window.__h.boxes());

  // lightbox
  await step('lightbox', async () => {
    const wi = geo.rooms[1];
    await go(wi.y, 1200);
    const btn = page.locator('#wingman .views__b').first();
    await btn.click({ timeout: 4000 }).catch(() => btn.evaluate((e) => e.click()));
    await sleep(1200);
    const st = () => page.evaluate(() => ({ open: document.getElementById('lb').open, n: (document.querySelector('.lb__n') || {}).textContent, img: (document.querySelector('.lb__stage img') || {}).src }));
    const s0 = await st(); const p = await shot('lightbox-open');
    R.notes.boxes.lbimg = (await page.evaluate(() => window.__h.boxes())).lbimg;
    await page.keyboard.press('ArrowRight'); await sleep(700); const s1 = await st();
    // Playwright's Firefox with touch emulation sends no pointer events for mouse drags, so the swipe is a synthetic left swipe (PointerEvents) in every engine.
    await page.evaluate(() => { const st = document.querySelector('.lb__stage'), r = st.getBoundingClientRect(), y = r.top + r.height / 2; const f = (t, x) => st.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true })); f('pointerdown', r.left + r.width * 0.8); f('pointermove', r.left + r.width * 0.5); f('pointerup', r.left + r.width * 0.2); }); await sleep(800);
    const s2 = await st();
    await shot('lightbox-after-swipe');
    await page.keyboard.press('Escape'); await sleep(900); const s3 = await st();
    const back = await page.evaluate(() => document.activeElement && ((document.activeElement.className || '') + ''));
    chk('lightbox', s0.open && s1.n !== s0.n && s2.n !== s1.n && !s3.open, `open ${s0.open} (${s0.n}) -> arrow ${s1.n} -> swipe ${s2.n} -> closed ${!s3.open}; focus returns to ${back}`, p);
  });

  // video poster and still-until-playing (room 2 Wingman), in a fresh page so no earlier scroll has started the film
  await step('video', async () => {
    const pv = await ctx.newPage(); watch(pv, R, 'video-page: ');
    await pv.goto(BASE, { waitUntil: 'load' }); await sleep(2500);
    await pv.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), geo.rooms[1].y);
    const sel = '#wingman video', samples = [];
    const t0 = Date.now();
    for (let i = 0; i < 30; i++) {
      samples.push({ ms: Date.now() - t0, ...(await pv.evaluate((s) => { const v = document.querySelector(s), p = v.closest('.piece'); return { poster: v.poster.replace(location.origin, ''), paused: v.paused, playing: p.hasAttribute('data-playing'), op: +getComputedStyle(v).opacity, ct: +v.currentTime.toFixed(2), rs: v.readyState, err: v.error && v.error.code, h264: v.canPlayType('video/mp4; codecs="avc1.42E01E"'), btn: !!document.querySelector('#wingman .play:not(.is-off)') }; }, sel)) });
      if (i === 1) { const p = `${dir}/${vpName}-${motion}-wingman-arrive.png`; await pv.screenshot({ path: p }); R.shots.push(p); }
      await sleep(150);
    }
    const p = `${dir}/${vpName}-${motion}-wingman-after-4s.png`; await pv.screenshot({ path: p }); R.shots.push(p);
    const first = samples[0], last = samples[samples.length - 1];
    const firstPlay = samples.find((s) => s.playing);
    const stillBefore = samples.filter((s) => !s.playing).every((s) => s.op < 0.05);
    const posterOk = !!first.poster && /poster/.test(first.poster);
    const pf = await pv.evaluate(async (u) => { try { return (await fetch(u)).ok; } catch (e) { return false; } }, first.poster.replace(/^\//, ''));
    chk('video-poster', posterOk && pf, JSON.stringify({ poster: first.poster, fetchOk: pf }), p);
    R.notes.video = { first, last, firstPlayMs: firstPlay && firstPlay.ms };
    if (reduced) chk('video-still-until-playing', !last.playing && last.paused && last.btn, `no autoplay: paused ${last.paused}, playing attr ${last.playing}, Play button visible ${last.btn}`, p);
    else if (first.h264 === '') chk('video-still-until-playing', null, 'engine cannot decode H.264 (canPlayType empty): playback not verifiable; poster stays: ' + JSON.stringify(last));
    else chk('video-still-until-playing', stillBefore && !!firstPlay && !last.paused && last.ct > 0 && last.op > 0.9, `still (opacity 0) until playing: ${stillBefore}; playing after ${firstPlay && firstPlay.ms}ms; end ${JSON.stringify(last)}`, p);
    if (reduced) {
      const pb = pv.locator('#wingman .play').first();
      if (await pb.count()) { await pb.click({ timeout: 3000 }).catch(() => {}); await sleep(1800); R.notes.playButton = await pv.evaluate(() => { const v = document.querySelector('#wingman video'); return { paused: v.paused, ct: v.currentTime }; }); }
    }
    await pv.close();
  });

  // blocked map files: the plain list must still show
  await step('map-blocked', async () => {
    for (const [what, pat] of [['css/map.css', /css\/map\.css/], ['js/map.js', /js\/map\.js/]]) {
      const pb = await ctx.newPage(); watch(pb, R, 'blocked-' + what + ': ');
      await pb.route(pat, (r) => r.abort());
      await pb.goto(BASE, { waitUntil: 'load' }); await sleep(1500);
      await pb.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), secs[0].top - geo.H * 0.5); await sleep(300);
      await pb.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), secs[0].top); await sleep(3500);
      const r = await pb.evaluate(() => { const l = document.getElementById('map-list'); const rr = l.getBoundingClientRect(); const cs = getComputedStyle(l); let anc = l, hidden = false; while (anc && anc !== document.body) { const c = getComputedStyle(anc); if (c.display === 'none' || c.visibility === 'hidden') hidden = true; anc = anc.parentElement; } const pl = document.getElementById('map-plot') || document.querySelector('.map__plot'); const pc = pl && getComputedStyle(pl); const det = l.closest('details'); return { items: l.querySelectorAll('li').length, h: Math.round(rr.height), hidden, detailsOpen: det ? det.open : null, plotShown: !!pl && pc.display !== 'none' && pc.visibility !== 'hidden' && +pc.opacity > 0.05, sw: document.documentElement.scrollWidth }; });
      const sp = `${dir}/${vpName}-${motion}-map-blocked-${what.replace(/\W/g, '_')}.png`; await pb.screenshot({ path: sp }); R.shots.push(sp);
      chk('map-fallback-' + what.replace(/\W/g, '_'), r.items > 5 && !r.hidden && r.h > 40 && r.sw <= vp.w, JSON.stringify(r), sp);
      await pb.close();
    }
  });

  // hash landing: rail link and /#on-the-clock in a fresh page
  await step('hash', async () => {
    await go(0, 300);
    await page.evaluate(() => document.querySelector('#rail a[href="#story"], #rail a[href="#g-wagon"]').click());
    await sleep(2000);
    const y = await page.evaluate(() => scrollY);
    const want = geo.wipe ? geo.rooms[5].y : geo.rooms[5].y;
    const alt = secs[1].top;
    chk('hash-nav-rail', Math.abs(y - alt) < 4 || Math.abs(y - want) < 4, `rail link landed at ${y}; story top ${alt}; g-wagon rest ${want}`, await shot('hash-rail'));
    const p2 = await ctx.newPage(); watch(p2, R, 'otc-page: ');
    await p2.goto(BASE + '#on-the-clock', { waitUntil: 'load' }); await sleep(3000);
    const r = await p2.evaluate(() => { const s = document.getElementById('on-the-clock').getBoundingClientRect(); const ai = document.querySelector('.switch__i[aria-current="true"]'); return { top: Math.round(s.top), sw: ai && ai.textContent.trim(), h2: (document.getElementById('h-clock') || {}).textContent, bar: getComputedStyle(document.querySelector('.hdr__bar')).opacity, sy: scrollY, sww: document.documentElement.scrollWidth }; });
    const p = `${dir}/${vpName}-${motion}-hash-on-the-clock.png`; await p2.screenshot({ path: p }); R.shots.push(p);
    chk('on-the-clock-landing', Math.abs(r.top) <= 2 && /On the clock/i.test(r.sw || '') && r.sww <= vp.w, JSON.stringify(r), p);
    // ?open= deep link
    if (R.notes.mapId) {
      await p2.goto(BASE + `?open=${R.notes.mapId}#map`, { waitUntil: 'load' }); await sleep(3500);
      const o = await p2.evaluate(() => { const d = document.getElementById('map-detail'); return { open: d.classList.contains('is-open'), title: (document.getElementById('md-title') || {}).textContent, mapTop: Math.round(document.getElementById('map').getBoundingClientRect().top) }; });
      const pp = `${dir}/${vpName}-${motion}-open-deeplink.png`; await p2.screenshot({ path: pp }); R.shots.push(pp);
      chk('map-open-deeplink', o.open && !!o.title, JSON.stringify(o), pp);
    }
    await p2.close();
  });

  await ctx.close(); await b.close();
  const aborted = R.failed.filter((f) => /media /.test(f) && /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(f)); // a film request cancelled when playback is impossible or the page closes
  R.notes.abortedMedia = aborted.length;
  const mine = (x) => /^blocked-/.test(x); // failures caused on purpose by the map-blocked step
  const con = R.console.filter((x) => !mine(x)), fl = R.failed.filter((x) => !mine(x) && !aborted.includes(x));
  R.console = con; R.failed = R.failed.filter((x) => !mine(x));
  chk('console-and-requests-clean', con.length === 0 && fl.length === 0, `console ${con.length}; failed requests ${R.failed.length} (film aborts: ${aborted.length})`, '');
  R.reqs = R.reqs.length;
  writeFileSync(`${OUT}/main-${engine}-${vpName}-${motion}.json`, JSON.stringify(R, null, 1));
  console.log(engine, vpName, motion, Object.entries(R.checks).filter(([, c]) => c.pass === 'FAIL').map(([k]) => k).join(',') || 'no failures');
}

// ---------------------------------------------------------------- overflow suite (blocked / delayed images)
async function overflowSuite(engine) {
  const R = { engine, rows: [] };
  const b = await ENG[engine].launch();
  for (const mode of ['normal', 'blocked', 'delayed']) {
    for (const [w, h] of [[360, 660], [390, 660], [393, 660], [412, 660], [1440, 900]]) {
      for (const reduced of [false, true]) {
        const ctx = await newCtx(b, { w, h, dsf: w < 600 ? 2 : 1, touch: w < 600 }, reduced);
        const page = await ctx.newPage();
        if (mode === 'blocked') await page.route(/\.(webp|jpg|png)(\?.*)?$/, (r) => r.abort());
        if (mode === 'delayed') await page.route(/\.(webp|jpg|png)(\?.*)?$/, async (r) => { await sleep(1800); r.continue().catch(() => {}); });
        await page.goto(BASE, { waitUntil: 'load' }); await sleep(800);
        let maxSW = 0; const off = new Set();
        const total = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < total; y += Math.round(h / 2)) {
          await page.evaluate((v) => scrollTo({ top: v, behavior: 'instant' }), y); await sleep(60);
          const e = await page.evaluate(() => window.__h.edges()); maxSW = Math.max(maxSW, e.sw); e.out.forEach((o) => off.add(o));
        }
        const row = { mode, w, reduced, maxSW, offenders: [...off].slice(0, 4), pass: maxSW <= w && off.size === 0 };
        if (!row.pass) { const p = `${SHOTS}/${engine}/overflow-${mode}-${w}-${reduced ? 'reduced' : 'normal'}.png`; await page.screenshot({ path: p }); row.shot = p; }
        R.rows.push(row);
        await ctx.close();
      }
    }
  }
  await b.close();
  mkdirSync(`${SHOTS}/${engine}`, { recursive: true });
  writeFileSync(`${OUT}/overflow-${engine}.json`, JSON.stringify(R, null, 1));
  console.log(engine, 'overflow', R.rows.filter((r) => !r.pass).length, 'failing of', R.rows.length);
}

// ---------------------------------------------------------------- startup suite
async function startupSuite(engine) {
  const R = { engine, runs: [] };
  const b = await ENG[engine].launch();
  for (const [vpName, scenario] of [['393x660', 'natural'], ['393x660', 'immediate-scroll'], ['1440x900', 'natural'], ['1440x900', 'immediate-scroll'], ['393x660', 'immediate-tap']]) {
    const vp = ALLVP[vpName];
    const ctx = await newCtx(b, vp, false); const page = await ctx.newPage();
    const x = { vpName, scenario, console: [], failed: [], reqs: [] }; watch(page, x);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    if (scenario === 'immediate-scroll') { await page.evaluate(() => scrollBy(0, 300)); await page.mouse.wheel(0, 200).catch(() => {}); }
    if (scenario === 'immediate-tap') await page.mouse.click(vp.w / 2, 100).catch(() => {});
    await sleep(4200);
    const t = await page.evaluate(() => ({ ...window.__t, loadEnd: Math.round(performance.getEntriesByType('navigation')[0].loadEventEnd), scripts: [...document.scripts].filter((s) => /site\.js/.test(s.src)).length }));
    // does the page work afterwards? room 3 at its rest position must give the header the pokemon world
    const H = vp.h; await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), 2 * 1.35 * H); await sleep(1500);
    const w = await page.evaluate(() => ({ world: document.querySelector('.hdr__name').dataset.world, railIdx: document.getElementById('rail').dataset.idx, sy: scrollY }));
    x.t = t; x.after = w; x.works = w.world === 'pokemon';
    x.startMs = t.append != null ? Math.round(t.append) : null; x.lcpMs = t.lcp != null ? Math.round(t.lcp) : null;
    const p = `${SHOTS}/${engine}/startup-${vpName}-${scenario}.png`; mkdirSync(`${SHOTS}/${engine}`, { recursive: true }); await page.screenshot({ path: p }); x.shot = p;
    R.runs.push(x); await ctx.close();
  }
  await b.close();
  writeFileSync(`${OUT}/startup-${engine}.json`, JSON.stringify(R, null, 1));
  console.log(engine, 'startup', R.runs.map((r) => `${r.vpName}/${r.scenario}: start ${r.startMs}ms lcp ${r.lcpMs} works ${r.works}`).join(' | '));
}

// ---------------------------------------------------------------- summary
function summary() {
  const files = readdirSync(OUT).filter((f) => f.endsWith('.json')).map((f) => [f, JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8'))]);
  const mains = files.filter(([f]) => f.startsWith('main-')).map(([, j]) => j);
  const keys = [...new Set(mains.flatMap((m) => Object.keys(m.checks)))];
  const cols = [...new Set(mains.map((m) => `${m.engine} ${m.vp} ${m.motion}`))];
  console.log('| check | ' + cols.join(' | ') + ' |\n|---|' + cols.map(() => '---').join('|') + '|');
  for (const k of keys) console.log(`| ${k} | ` + cols.map((c) => { const m = mains.find((x) => `${x.engine} ${x.vp} ${x.motion}` === c); return m && m.checks[k] ? m.checks[k].pass : '-'; }).join(' | ') + ' |');
  console.log('\nFAILURES');
  for (const m of mains) for (const [k, c] of Object.entries(m.checks)) if (c.pass === 'FAIL') console.log(`- ${m.engine} ${m.vp} ${m.motion} ${k}: ${String(c.detail).slice(0, 300)} ${c.shot || ''}`);
  console.log('\nCONSOLE / FAILED REQUESTS');
  for (const m of mains) if (m.console.length || m.failed.length) console.log(`- ${m.engine} ${m.vp} ${m.motion}: console=${JSON.stringify([...new Set(m.console)].slice(0, 3))} failed=${JSON.stringify([...new Set(m.failed)].slice(0, 5))}`);
  console.log('\nTEXT WIDTHS (cross-engine, 3 px tolerance; text-wrap differences show as large diffs)');
  for (const vp of Object.keys(ALLVP)) for (const mo of ['normal']) {
    const g = mains.filter((m) => m.vp === vp && m.motion === mo && m.notes.fonts); if (g.length < 2) continue;
    const names = Object.keys(g[0].notes.fonts.widths); const diffs = [];
    for (const n of names) { const vals = g.map((m) => m.notes.fonts.widths[n]); if (vals.some((v) => v == null)) continue; const d = Math.max(...vals) - Math.min(...vals); if (d > 3) diffs.push(`${n}: ` + g.map((m, i) => `${m.engine} ${vals[i]}`).join(' ')); }
    console.log(`- ${vp}: ${diffs.length ? diffs.join(' ; ') : 'all within 3px'}`);
  }
  console.log('\nBOXES (cross-engine, within 1px)');
  for (const vp of Object.keys(ALLVP)) for (const mo of ['normal', 'reduced']) {
    const g = mains.filter((m) => m.vp === vp && m.motion === mo); if (g.length < 2) continue;
    const names = [...new Set(g.flatMap((m) => Object.keys(m.notes.boxes || {})))]; const diffs = [];
    for (const n of names) { const vals = g.map((m) => (m.notes.boxes || {})[n]); if (vals.some((v) => !v)) { diffs.push(`${n}: missing in ${g.filter((m, i) => !vals[i]).map((m) => m.engine)}`); continue; } const dw = Math.max(...vals.map((v) => v[0])) - Math.min(...vals.map((v) => v[0])), dh = Math.max(...vals.map((v) => v[1])) - Math.min(...vals.map((v) => v[1])); if (dw > 1 || dh > 1) diffs.push(`${n}: ` + g.map((m, i) => `${m.engine} ${vals[i]}`).join(' ')); }
    console.log(`- ${vp} ${mo}: ${names.length} boxes, ${diffs.length ? 'DIFFS ' + diffs.join(' ; ') : 'all within 1px'}`);
  }
  for (const [f, j] of files) {
    if (f.startsWith('overflow-')) { const bad = j.rows.filter((r) => !r.pass); console.log(`\nOVERFLOW ${j.engine}: ${bad.length} failing of ${j.rows.length}`); bad.forEach((r) => console.log(`  ${r.mode} ${r.w} ${r.reduced ? 'reduced' : 'normal'} sw ${r.maxSW} ${r.offenders.join(' | ')} ${r.shot || ''}`)); }
    if (f.startsWith('startup-')) { console.log(`\nSTARTUP ${j.engine}`); j.runs.forEach((r) => console.log(`  ${r.vpName} ${r.scenario}: site.js appended ${r.startMs}ms, first LCP ${r.lcpMs}, load end ${r.t.loadEnd}ms, scroll at append ${r.t.scrollAtAppend}, works after ${r.works}, lcp entry unsupported ${!!r.t.lcpUnsupported}, console ${r.console.length}, failed ${r.failed.length}`)); }
  }
}

// ---------------------------------------------------------------- run
const jobs = [];
for (const e of ENGINES) jobs.push((async () => {
  if (SUITE === 'main' || SUITE === 'all') for (const v of VPS) for (const m of MOTIONS) await mainRun(e, v, m).catch((err) => console.log(e, v, m, 'CRASH', err.message.split('\n')[0]));
  if (SUITE === 'overflow' || SUITE === 'all') await overflowSuite(e).catch((err) => console.log(e, 'overflow CRASH', err.message.split('\n')[0]));
  if (SUITE === 'startup' || SUITE === 'all') await startupSuite(e).catch((err) => console.log(e, 'startup CRASH', err.message.split('\n')[0]));
})());
await Promise.all(jobs);
