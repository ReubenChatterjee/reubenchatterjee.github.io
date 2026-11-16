// Horizontal-overflow check (task 16, check 7; grew out of phone bug 3, project cards wider than the screen on an iPhone).
//
//   node tools/overflow-check.mjs [--base http://localhost:4216/] [--out <dir>] [--shots <dir>]
//        [--engines webkit,chromium,firefox] [--widths 360,390,393,412] [--height 660]
//        [--modes normal,blocked,delayed] [--landing top,hash]
//
// For every engine, width, image mode and landing it scrolls the whole page and asserts at every step that
//   - document.documentElement.scrollWidth <= innerWidth, and
//   - no element in any section (rooms, map, story, On the clock, footer, header, rail) has a VISIBLE right or left edge outside the screen
//     (an element clipped by an ancestor with overflow hidden/clip/auto/scroll is judged by the clipped box and listed separately).
// Image modes: normal; blocked (every image request aborted: the state in which phone bug 3 showed); delayed (every image held back 3.5 s).
// Landing: top (/) and hash (/#on-the-clock).
// With --shots it also saves, in WebKit at 393 wide, a screenshot of every project card and every room and section.
// Serve the site first: python3 -m http.server 4216 -d site.  Exit code 1 on any failure.
import { webkit, chromium, firefox } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const A = process.argv.slice(2);
const opt = (k, d) => { const i = A.indexOf('--' + k); return i > -1 && A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : d; };
const BASE = opt('base', 'http://localhost:4216/');
const OUT = opt('out', '/tmp/overflow-out');
const SHOTS = opt('shots', '');
const ENG = { webkit, chromium, firefox };
const ENGINES = opt('engines', 'webkit,chromium,firefox').split(',');
const WIDTHS = opt('widths', '360,390,393,412').split(',').map(Number);
const H = +opt('height', '660');
const MODES = opt('modes', 'normal,blocked,delayed').split(',');
const LANDINGS = opt('landing', 'top,hash').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

// In page: every element whose visible box leaves the screen. Returns offenders and clipped-only cases.
const SCAN = () => {
  const iw = document.documentElement.clientWidth;
  const bad = [], clipped = [];
  const name = (e) => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
  const secOf = (e) => { const s = e.closest('section,header,nav,footer'); return s ? s.id || (typeof s.className === 'string' ? s.className.split(' ')[0] : s.tagName.toLowerCase()) : 'body'; };
  for (const e of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SOURCE', 'TRACK', 'BR', 'PATH', 'CIRCLE', 'USE', 'G'].includes(e.tagName.toUpperCase())) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.right <= iw + 0.5 && r.left >= -0.5) continue;
    // visible box = box intersected with every clipping ancestor
    let left = r.left, right = r.right, hiddenByClip = false, off = false;
    for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.position === 'fixed') { /* fixed ancestors are laid out against the screen */ }
      if (cs.overflowX !== 'visible' || cs.clipPath !== 'none') {
        const pr = p.getBoundingClientRect(); left = Math.max(left, pr.left); right = Math.min(right, pr.right);
        if (right <= left) { hiddenByClip = true; break; }
      }
      if (cs.display === 'none' || cs.visibility === 'hidden') { off = true; break; }
    }
    // effectively invisible (own or ancestor opacity under 5%, e.g. the tucked rail mid-fade) does not count
    let eo = 1; for (let p = e; p && p !== document.documentElement; p = p.parentElement) eo *= +getComputedStyle(p).opacity;
    const cs0 = getComputedStyle(e);
    if (off || cs0.visibility === 'hidden' || cs0.display === 'none' || eo < 0.05) continue;
    if (hiddenByClip) { continue; }
    const rec = `${name(e)} [${secOf(e)}] ${Math.round(r.left)}..${Math.round(r.right)}`;
    if (right > iw + 0.5 || left < -0.5) bad.push(rec + ` (visible ${Math.round(left)}..${Math.round(right)})`);
    else clipped.push(rec);
  }
  const rl = document.getElementById('rail');
  return { sw: document.documentElement.scrollWidth, iw, bad: bad.slice(0, 12), nbad: bad.length, clipped: clipped.slice(0, 6), nclip: clipped.length, rail: rl ? rl.className.replace('rail rail--js', '').trim() + ' op ' + (+getComputedStyle(rl).opacity).toFixed(2) + ' ' + Math.round(rl.getBoundingClientRect().left) + '..' + Math.round(rl.getBoundingClientRect().right) : '', y: Math.round(scrollY) };
};

let failures = 0;
const results = [];
for (const eName of ENGINES) {
  const b = await ENG[eName].launch();
  for (const w of WIDTHS) {
    for (const mode of MODES) {
      for (const landing of LANDINGS) {
        const ctx = await b.newContext({ viewport: { width: w, height: H }, deviceScaleFactor: 2, hasTouch: true });
        const pg = await ctx.newPage();
        if (mode !== 'normal') await pg.route('**/*', async (route) => {
          if (route.request().resourceType() !== 'image') return route.continue();
          if (mode === 'blocked') return route.abort();
          await sleep(3500); try { await route.continue(); } catch {}
        });
        const errs = [];
        pg.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
        await pg.goto(BASE + (landing === 'hash' ? '#on-the-clock' : ''), { waitUntil: 'load' });
        await sleep(landing === 'hash' ? 1500 : 900);
        let maxSW = 0, nbad = 0, nclip = 0, firstAt = ''; const transient = new Set(); const bad = new Set(), clip = new Set();
        const total = await pg.evaluate(() => document.documentElement.scrollHeight);
        const ys = [];
        if (landing === 'hash') { const y0 = await pg.evaluate(() => scrollY); for (let y = y0; y < total; y += 400) ys.push(y); for (let y = y0 - 400; y > 0; y -= 800) ys.push(Math.max(y, 0)); ys.push(0); }
        else for (let y = 0; y < total; y += 400) ys.push(y);
        ys.push(total);
        for (const y of ys) {
          await pg.evaluate((v) => scrollTo(0, v), y);
          await sleep(mode === 'delayed' ? 120 : 90);
          let r = await pg.evaluate(SCAN);
          if (r.nbad) { // an offender mid-animation (the rail sliding in) is noted as transient; one that is still there 0.8 s later is a failure
            const first = r; await sleep(800); r = await pg.evaluate(SCAN);
            for (const x of first.bad) if (!r.bad.includes(x) && !r.bad.some((y) => y.split(' ')[0] === x.split(' ')[0])) transient.add(x + ` @scrollY ${first.y}, rail ${first.rail}`);
          }
          maxSW = Math.max(maxSW, r.sw); nbad += r.nbad; nclip += r.nclip; if (r.nbad && !firstAt) firstAt = `scrollY ${r.y}, rail ${r.rail}`;
          for (const x of r.bad) bad.add(x); for (const x of r.clipped) clip.add(x);
        }
        const ok = maxSW <= w && bad.size === 0;
        if (!ok) failures++;
        const row = { engine: eName, width: w, mode, landing, ok, maxScrollWidth: maxSW, steps: ys.length, transient: [...transient].slice(0, 4), offenders: [...bad].slice(0, 6), firstAt, clippedOnly: [...clip].slice(0, 4), pageErrors: errs.slice(0, 2) };
        results.push(row);
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${eName.padEnd(8)} ${String(w).padStart(3)} ${mode.padEnd(8)} ${landing.padEnd(4)} scrollWidth max ${maxSW}${maxSW > w ? ' > ' + w : ''}, ${ys.length} steps, offenders ${bad.size}${bad.size ? ' (first at ' + firstAt + '): ' + [...bad].slice(0, 3).join(' | ') : ''}${transient.size ? ' [transient, gone 0.8 s later: ' + [...transient].slice(0, 2).join(' | ') + ']' : ''}${clip.size ? ' (clipped only: ' + [...clip].slice(0, 2).join(' | ') + ')' : ''}`);
        await ctx.close();
      }
    }
  }
  await b.close();
}

if (SHOTS && ENGINES.includes('webkit')) {
  const b = await webkit.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 660 }, deviceScaleFactor: 3, hasTouch: true });
  const pg = await ctx.newPage();
  await pg.goto(BASE, { waitUntil: 'load' }); await sleep(1500);
  const shot = async (name) => { await pg.screenshot({ path: path.join(SHOTS, name + '.png') }); };
  // rooms: scroll in steps so the wipe runs, then rest
  const geo = await pg.evaluate(() => ({ H: innerHeight, wipe: document.documentElement.classList.contains('wipe'), rooms: [...document.querySelectorAll('[data-room]')].map((r, i) => ({ id: r.id, top: r.getBoundingClientRect().top + scrollY, i })) }));
  for (const r of geo.rooms) {
    const y = geo.wipe ? Math.round(r.i * 1.35 * geo.H) : Math.round(r.top);
    const cur = await pg.evaluate(() => scrollY);
    for (let i = 1; i <= 6; i++) { await pg.evaluate((v) => scrollTo(0, v), cur + ((y - cur) * i) / 6); await sleep(80); }
    await sleep(1800); await shot(`room-${r.i + 1}-${r.id}`);
  }
  for (const id of ['map', 'story']) { await pg.evaluate((i) => document.getElementById(i).scrollIntoView(), id); await sleep(2500); await shot(`section-${id}`); }
  await pg.evaluate(() => document.getElementById('on-the-clock').scrollIntoView()); await sleep(1500);
  const cards = await pg.$$('#on-the-clock .feat, #on-the-clock .pcard');
  let i = 0;
  for (const c of cards) {
    await pg.evaluate((e) => scrollTo(0, e.getBoundingClientRect().top + scrollY - 90), c); await sleep(900);
    await shot(`card-${i++}`);
    await pg.evaluate((e) => scrollTo(0, e.getBoundingClientRect().bottom + scrollY - 560), c); await sleep(700);
    await shot(`card-${i - 1}-bottom`);
  }
  console.log(`screenshots in ${SHOTS}: ${geo.rooms.length} rooms, map, story, ${cards.length} project cards`);
  await b.close();
}
writeFileSync(path.join(OUT, 'overflow-results.json'), JSON.stringify(results, null, 2));
console.log(failures ? `OVERFLOW CHECK FAILED (${failures} of ${results.length} runs)` : `OVERFLOW CHECK PASSED (${results.length} runs)`);
process.exit(failures ? 1 : 0);
