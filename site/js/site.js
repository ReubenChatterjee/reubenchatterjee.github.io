(function () {
'use strict';

/* 00-core.js */
/* Core: room registry, colour-room wipe, the one scroll handler, navigation, films, reduced-motion switch.
   ?wipe=0.5 freezes the wipe into room 2 at 50% (add &room=3, &room=4 ... for later rooms).
   Rooms are every section[data-room] in DOM order. Nothing here names a room: a new section[data-room] is a new room.
   Everything in site-src/js is concatenated into one scope, so later files use these names directly.

   Scroll maths are in svh (the small viewport: the visible area with the browser bars showing), read from a probe element,
   so the wipe does not jump when the bars show or hide. All layout reads happen in measure() (load, resize, orientation change,
   fonts, and a ResizeObserver on <main>); the animation frame works from those cached numbers and scrollY only. */
var root = document.documentElement;
var rooms = [].slice.call(document.querySelectorAll('section[data-room]'));
var inners = rooms.map(function (r) { return r.querySelector('.room__inner'); });
var pieceEls = rooms.map(function (r) { return r.querySelector('[data-origin]'); });
var stack = document.getElementById('rooms');
var foot = document.querySelector('body > footer[data-world]');
var mqMotion = matchMedia('(prefers-reduced-motion: reduce)');
var mqDesk = matchMedia('(min-width: 900px)');
var params = new URLSearchParams(location.search);
var frozen = params.has('wipe') ? Math.max(0, Math.min(1, parseFloat(params.get('wipe')) || 0)) : null;
var frozenRoom = Math.max(1, Math.min(rooms.length - 1, (parseInt(params.get('room'), 10) || 2) - 1));

/* H: layout viewport height; SV/LV: 100svh/100lvh in px; VW: width; D/W: per-room hold and wipe distances (45svh, 90svh, as in 03-rooms.css) */
var H = innerHeight, SV = H, LV = H, VW = innerWidth, D = 0, W = 0, top0 = 0, Y = scrollY;
var origin = rooms.map(function () { return { x: 0, y: 0, R: 0 }; });
var ps = rooms.map(function (_, i) { return i === 0 ? 1 : 0; });
var drawn = rooms.map(function () { return ''; });
var inState = rooms.map(function (_, i) { return i === 0; });
var active = 0;
var ticking = false, jumped = false;
/* hooks other files subscribe to:
   onActive(a): the active room changed; onMode(): motion preference flipped; onExtra(section|null): see extras below;
   onMeasure(): geometry was re-read (do layout reads here, never in onFrame); onFrame(y, dy): every animation frame after a scroll;
   onIn(i, on, p): room i's words were let in (its circle covers about 70% of the viewport) or sent away */
var onActive = [], onMode = [], onMeasure = [], onFrame = [], onIn = [];
/* followers: fixed elements that take the colour world of whatever is under a sample point */
var followers = [];
/* Normal-flow sections after the rooms (the colour map, the story, On the clock): <main> > section[data-world] that is not a room.
   They are not wipe layers. They only (a) lend their colour world to the fixed header and rail while they sit under them,
   (b) mark the header switch / rail chip current while they fill the middle of the viewport, and (c) are reachable by hash links
   (bindNav). onExtra hooks get the section element, or null when the middle of the viewport is back in the rooms. */
var extras = [].slice.call(document.querySelectorAll('main > section[data-world]:not([data-room])'));
var activeExtra = null, onExtra = [];
/* cached document offsets (measure) */
var exTop = [], exBot = [], roomTop = [], roomBot = [], footTop = Infinity;
function extraAt(y) {
  var d = Y + y;
  for (var i = 0; i < extras.length; i++) if (exTop[i] <= d && exBot[i] > d) return extras[i];
  return null;
}
/* any normal-flow block at viewport y, the footer included (colour lookups only) */
function flowAt(y) { return extraAt(y) || (foot && Y + y >= footTop ? foot : null); }
function extraForHash(h) { for (var i = 0; i < extras.length; i++) if ('#' + extras[i].id === h) return extras[i]; return null; }
stack.style.setProperty('--n', rooms.length - 1);

/* 100svh and 100lvh probes (fixed, invisible; see 03-rooms.css) */
function probe(cls) { var el = document.createElement('i'); el.className = 'vh-probe ' + cls; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); return el; }
var probeS = probe('vh-probe--s'), probeL = probe('vh-probe--l');

function wiping() { return root.classList.contains('wipe'); }
function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function ease(p) { return (1 - Math.cos(Math.PI * p)) / 2; }
function each(list, fn) { for (var i = 0; i < list.length; i++) fn(list[i], i); }
function follow(el, point) { followers.push({ el: el, point: point, i: -1 }); }
function roomIndexForHash(h) {
  if (!h || h.length < 2) return -1;
  for (var i = 0; i < rooms.length; i++) if ('#' + rooms[i].id === h) return i;
  return -1;
}

/* geometry: viewport units, where each wipe starts (centre of the incoming piece) and how far it must grow, and the offsets above */
function measure() {
  H = innerHeight; VW = innerWidth;
  SV = probeS.offsetHeight || H; LV = Math.max(SV, probeL.offsetHeight || H);
  D = SV * 0.45; W = SV * 0.9;
  var sy = scrollY;
  top0 = stack.getBoundingClientRect().top + sy;
  rooms.forEach(function (r, i) {
    var sr = r.getBoundingClientRect();
    roomTop[i] = sr.top + sy; roomBot[i] = sr.bottom + sy;
    if (i === 0) return;
    var rr = (pieceEls[i] || r).getBoundingClientRect();
    var x = rr.left + rr.width / 2 - sr.left, y = rr.top + rr.height / 2 - sr.top;
    x = Math.max(0, Math.min(VW, x)); y = Math.max(0, Math.min(SV, y));
    /* the room box is 100lvh tall, so the circle must reach the corners of the large viewport */
    var R = Math.max(Math.hypot(x, y), Math.hypot(VW - x, y), Math.hypot(x, LV - y), Math.hypot(VW - x, LV - y));
    origin[i] = { x: x, y: y, R: R + 12 };
  });
  extras.forEach(function (s, i) { var b = s.getBoundingClientRect(); exTop[i] = b.top + sy; exBot[i] = b.bottom + sy; });
  footTop = foot ? foot.getBoundingClientRect().top + sy : Infinity;
  drawn = drawn.map(function () { return ''; });
  each(onMeasure, function (fn) { fn(); });
}
function restY(i) { return top0 + i * (D + W); }

function progress() {
  if (frozen !== null) {
    return ps.map(function (_, i) { return i === 0 ? 1 : i < frozenRoom ? 1 : i === frozenRoom ? frozen : 0; });
  }
  var s = Y - top0;
  return ps.map(function (_, i) { return i === 0 ? 1 : clamp((s - ((i - 1) * (D + W) + D)) / W); });
}

/* share of the small viewport inside room i's circle (sampled on a 12 x 20 grid; only while that room is mid-wipe) */
function coverage(i, rad) {
  var o = origin[i], n = 0, r2 = rad * rad;
  for (var gx = 0; gx < 12; gx++) {
    var dx = (gx + 0.5) * VW / 12 - o.x;
    for (var gy = 0; gy < 20; gy++) { var dy = (gy + 0.5) * SV / 20 - o.y; if (dx * dx + dy * dy <= r2) n++; }
  }
  return n / 240;
}
/* the incoming room's words wait for about 70% coverage, then come in as stacked blocks (CSS: .room[data-in]); they leave again below 55% */
function setIn(i, on) {
  if (inState[i] === on) return;
  inState[i] = on;
  rooms[i].toggleAttribute('data-in', on);
  each(onIn, function (fn) { fn(i, on); });
}

/* which room's colour is visible at a viewport point */
function coveredWipe(x, y) {
  for (var j = rooms.length - 1; j > 0; j--) {
    if (ps[j] >= 1) return j;
    if (ps[j] > 0 && Math.hypot(x - origin[j].x, y - origin[j].y) <= origin[j].R * ease(ps[j])) return j;
  }
  return 0;
}
function coveredStacked(x, y) {
  var c = 0, d = Y + y;
  for (var i = 0; i < rooms.length; i++) if (roomTop[i] <= d && roomBot[i] > d) c = i;
  return c;
}

function apply() {
  ticking = false;
  var y = scrollY, dy = jumped ? 0 : y - Y; /* a programmatic landing (openHash) is not the reader scrolling */
  Y = y; jumped = false;
  var a = 0, cover;
  if (wiping()) {
    ps = progress();
    for (var i = 1; i < rooms.length; i++) {
      var p = ps[i], o = origin[i], rad = o.R * ease(p);
      var key = p <= 0 ? '0' : p >= 1 ? '1' : rad.toFixed(1);
      if (key !== drawn[i]) {
        drawn[i] = key;
        var cx = o.x.toFixed(1) + 'px ' + o.y.toFixed(1) + 'px';
        if (p >= 1) { rooms[i].style.clipPath = 'none'; inners[i].style.clipPath = 'none'; }
        else {
          rooms[i].style.clipPath = 'circle(' + (p <= 0 ? 0 : rad.toFixed(1)) + 'px at ' + cx + ')';
          /* accent ring on the wipe edge: the inner ground is slightly smaller than the outer circle */
          inners[i].style.clipPath = 'circle(' + Math.max(0, rad - 7).toFixed(1) + 'px at ' + cx + ')';
        }
        /* the piece settles from 112% to 100% as its circle opens (only the piece's subtree restyles) */
        if (pieceEls[i]) pieceEls[i].style.setProperty('--p', p.toFixed(3));
      }
      var cov = p <= 0 ? 0 : p >= 1 ? 1 : coverage(i, rad);
      if (!inState[i] && cov >= 0.7) setIn(i, true);
      else if (inState[i] && cov < 0.55) setIn(i, false);
      if (p >= 0.5) a = i;
    }
    cover = coveredWipe;
  } else {
    /* reduced motion / no wipe: rooms are plain stacked sections */
    var mid = Y + H * 0.5;
    for (var k = 0; k < rooms.length; k++) if (roomTop[k] <= mid && roomBot[k] > mid) a = k;
    if (extraAt(H * 0.5) || (foot && mid >= footTop)) a = rooms.length - 1; /* past the last room: keep it as the active room, not room 0 */
    cover = coveredStacked;
  }
  setUI(a, cover);
  each(onFrame, function (fn) { fn(y, dy); });
}

function setUI(a, cover) {
  /* the header sits on its solid bar over normal-flow content: the sections after the rooms, and every room when they are stacked */
  root.classList.toggle('over-flow', !!flowAt(34) || (!wiping() && Y > 8));
  var ex = extraAt(H * 0.5);
  if (ex !== activeExtra) { activeExtra = ex; films(); each(onExtra, function (fn) { fn(ex); }); }
  if (a !== active) {
    active = a;
    films(); each(onActive, function (fn) { fn(a); });
  }
  each(followers, function (f) {
    var pt = f.point(), x = flowAt(pt[1]), j = x ? rooms.length + (x === foot ? extras.length : extras.indexOf(x)) : cover(pt[0], pt[1]);
    if (f.i !== j) {
      f.i = j;
      f.el.setAttribute('data-world', (x || rooms[j]).getAttribute('data-world'));
      f.el.setAttribute('data-idx', j);
    }
  });
}

function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(apply); } }

/* navigation: rail, header links, hash links, keyboard focus, shot tooling */
function goto(i, instant) {
  if (!wiping()) { Element.prototype.scrollIntoView.call(rooms[i], { behavior: instant ? 'instant' : 'smooth', block: 'start' }); return; }
  scrollTo({ top: restY(i), behavior: instant ? 'instant' : 'smooth' });
}
/* a link whose href is a room's id scrolls to that room (sticky layers share one flow position, so the browser's own anchor jump would be wrong) */
function bindNav(link) {
  link.addEventListener('click', function (e) {
    var i = roomIndexForHash(link.getAttribute('href'));
    if (i < 0) {
      /* a section after the rooms is in normal flow, so a plain scroll to its top is right */
      var t = extraForHash(link.getAttribute('href'));
      if (!t) return;
      e.preventDefault(); t.scrollIntoView({ behavior: mqMotion.matches ? 'auto' : 'smooth', block: 'start' }); history.replaceState(null, '', link.getAttribute('href'));
      return;
    }
    e.preventDefault(); goto(i); history.replaceState(null, '', link.getAttribute('href'));
  });
}
rooms.forEach(function (r, i) {
  r.addEventListener('focusin', function () { if (wiping() && frozen === null && i !== active && ps[i] < 1) goto(i); });
  /* lets tools/shoot.mjs bring a pinned room into view */
  r.scrollIntoView = function () { goto(i, true); };
});
each(document.querySelectorAll('.skip'), bindNav);
function openHash() {
  if (frozen !== null) return;
  var i = roomIndexForHash(location.hash);
  if (i > 0) { jumped = true; goto(i, true); return; }
  /* /#on-the-clock (or another section after the rooms): the browser jumped there before the page settled; land exactly on it,
     with no wipe and no colour fades on the way in. ?open= deep links into the map scroll themselves. */
  var t = extraForHash(location.hash);
  if (t && !params.has('open') && Math.abs(t.getBoundingClientRect().top) > 1) { jumped = true; Element.prototype.scrollIntoView.call(t, { behavior: 'instant', block: 'start' }); }
}
addEventListener('hashchange', openHash);

/* films: play only the active room's clip, only with motion allowed */
var pieces = [].slice.call(document.querySelectorAll('[data-video]'));
function films() {
  pieces.forEach(function (p) {
    var v = p.querySelector('video'), room = rooms.indexOf(p.closest('section[data-room]'));
    var want = !mqMotion.matches && room === active && !activeExtra && !p.hasAttribute('data-manual-off');
    clearTimeout(p._t);
    /* give the still a moment on screen before the film takes over */
    if (want && v.paused) { p._t = setTimeout(function () { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }, 1400); }
    if (!want && !v.paused && !p.hasAttribute('data-manual-on')) v.pause();
    if (!want && p.hasAttribute('data-manual-on') && room !== active) { v.pause(); p.removeAttribute('data-manual-on'); }
  });
}
pieces.forEach(function (p) {
  var v = p.querySelector('video'), b = p.querySelector('.play') || document.querySelector('.play[data-for="' + p.getAttribute('data-video') + '"]');
  /* the film replaces the still only once it is really showing frames (not on the first, possibly dark, frame) */
  function shown() { p.setAttribute('data-playing', ''); b.classList.add('is-off'); }
  v.addEventListener('playing', function () {
    if (v.currentTime > 0.2) { shown(); return; }
    var go = function () { if (!v.paused && v.currentTime > 0.2) { v.removeEventListener('timeupdate', go); shown(); } };
    v.addEventListener('timeupdate', go);
  });
  v.addEventListener('pause', function () { p.removeAttribute('data-playing'); b.classList.remove('is-off'); });
  /* with reduced motion a film started by hand plays once and stops at its end, back on the still */
  v.addEventListener('ended', function () { p.removeAttribute('data-manual-on'); p.removeAttribute('data-playing'); b.classList.remove('is-off'); v.loop = true; });
  b.addEventListener('click', function () { p.setAttribute('data-manual-on', ''); v.loop = !mqMotion.matches; var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); });
});
document.addEventListener('visibilitychange', function () {
  if (document.hidden) pieces.forEach(function (p) { p.querySelector('video').pause(); }); else films();
});

/* reduced-motion switch */
function setMode() {
  root.classList.toggle('wipe', !mqMotion.matches);
  if (!wiping()) rooms.forEach(function (r, i) { r.style.clipPath = ''; inners[i].style.clipPath = ''; if (pieceEls[i]) pieceEls[i].style.removeProperty('--p'); });
  measure(); apply(); films(); each(onMode, function (fn) { fn(); });
}
mqMotion.addEventListener('change', setMode);

/* started last, from 99-start.js, once every file has registered its hooks */
function start() {
  /* first paint after script: header and rail take their world without colour fades (a deep link lands with nothing animating) */
  root.classList.add('no-tr');
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', function () {
    /* browser bars showing or hiding change innerHeight but not svh/lvh or the width: nothing to re-measure */
    if (innerWidth !== VW || probeS.offsetHeight !== SV || Math.max(SV, probeL.offsetHeight) !== LV) measure();
    onScroll();
  });
  addEventListener('orientationchange', function () { measure(); onScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); onScroll(); });
  /* this script is added after the first paint (99-foot.html), so the page may already be loaded */
  var late = function () { measure(); onScroll(); openHash(); };
  if (document.readyState === 'complete') late(); else addEventListener('load', late);
  /* sections that change height after load (the map arriving, a <details> opening) */
  if ('ResizeObserver' in window) new ResizeObserver(function () { measure(); onScroll(); }).observe(document.getElementById('main'));
  each(rooms, function (r, i) { if (inState[i]) r.setAttribute('data-in', ''); });
  measure(); apply();
  requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove('no-tr'); }); });
}

/* 02-card.js */
/* Model card: palette readout, and the details panel (open on desktop, a pop-over on phones) */
each(document.querySelectorAll('.card'), function (c) {
  var out = c.querySelector('.pal__out');
  each(c.querySelectorAll('.seg'), function (s) {
    function show() { out.textContent = s.dataset.hex + ' · ' + s.dataset.pc + '%'; }
    s.addEventListener('mouseenter', show); s.addEventListener('focus', show); s.addEventListener('click', show);
  });
  c.querySelector('summary').addEventListener('click', function (e) { if (mqDesk.matches) e.preventDefault(); });
});
function cards() {
  each(document.querySelectorAll('.card__d'), function (d) {
    if (mqDesk.matches) d.setAttribute('open', ''); else d.removeAttribute('open');
  });
}
mqDesk.addEventListener('change', cards); cards();

/* 05-header.js */
/* Header: the name and the controls each follow the colour world under them; the switch marks the side of the active room. */
var hdrName = document.querySelector('.hdr__name');
var hdrCtl = document.querySelector('.hdr__ctl');
var switchLinks = [].slice.call(document.querySelectorAll('.switch__i'));
/* solid bar behind the header in the ground colour of whatever is under it, shown while normal-flow content scrolls beneath (05-header.css) */
var hdrBar = document.querySelector('.hdr__bar');
var hdrCtlX = 0;
onMeasure.push(function () { var b = hdrCtl.getBoundingClientRect(); hdrCtlX = b.left + b.width / 2; });
follow(hdrBar, function () { return [VW / 2, 34]; });
follow(hdrName, function () { return [VW < 900 ? 60 : 110, 34]; });
follow(hdrCtl, function () { return [hdrCtlX, 34]; });
each(document.querySelectorAll('.hdr__name,.switch__i'), bindNav);
function syncSwitch(a, ex) {
  var side = (ex || rooms[a]).getAttribute('data-side') || 'off';
  each(switchLinks, function (l) {
    var i = roomIndexForHash(l.getAttribute('href')), t = i >= 0 ? rooms[i] : extraForHash(l.getAttribute('href')),
      on = !!t && (t.getAttribute('data-side') || 'off') === side;
    if (on) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
  });
}
onActive.push(function (a) { syncSwitch(a, activeExtra); });
onExtra.push(function (ex) { syncSwitch(active, ex); });

/* 10-hero.js */
/* hero loop: the still dissolves into the clip and back. Nothing is requested before window load + idle,
   and nothing at all under reduced motion, Save-Data or ?hero=still. ?herot=<s> shows the clip frozen at that time. */
var hp = document.querySelector('.piece--hero'), hv = hp.querySelector('video'), hb = hp.querySelector('.motion');
var hMode = params.get('hero') === 'still' ? 'off' : params.has('herot') ? 'frozen' : 'cycle';
var hState = { loaded: false, started: false, userPaused: false, timer: 0, phase: 'idle' };
function saveData() { var c = navigator.connection; return !!(c && c.saveData); }
function heroOK() { return hMode !== 'off' && !mqMotion.matches && !saveData(); }
function heroWant() { return heroOK() && hState.loaded && !hState.userPaused && active === 0 && !document.hidden; }
function heroShow(on) {
  if (on) { hp.setAttribute('data-hv', ''); if (hp.hasAttribute('data-hv-instant')) hp.setAttribute('data-hv-done', ''); }
  else { hp.removeAttribute('data-hv'); hp.removeAttribute('data-hv-done'); }
}
/* once the clip is fully opaque the still underneath is dropped, so its edges cannot ghost through the clip's feathered mask */
hv.addEventListener('transitionend', function () { if (hp.hasAttribute('data-hv')) hp.setAttribute('data-hv-done', ''); });
function heroStop() {
  clearTimeout(hState.timer); hState.phase = 'idle';
  if (!hv.paused) hv.pause();
  heroShow(false);
}
function heroHold(ms) { clearTimeout(hState.timer); hState.phase = 'hold'; hState.timer = setTimeout(heroPlay, ms); }
function heroPlay() {
  if (!heroWant()) return;
  hState.phase = 'play';
  try { hv.currentTime = 0; } catch (e) {}
  var pr = hv.play();
  if (pr && pr.catch) pr.catch(function () { heroStop(); });
}
hv.addEventListener('playing', function () { if (hState.phase === 'play') heroShow(true); });
hv.addEventListener('ended', function () {
  if (hState.phase !== 'play') return;
  heroShow(false); heroHold(600 + 2500);
});
function heroSync() {
  if (!hState.started) return;
  if (hMode === 'frozen') return;
  if (hb) hb.hidden = !heroOK();
  if (!heroOK()) { heroStop(); return; }
  if (heroWant()) { if (hState.phase === 'idle') heroHold(900); }
  else if (hState.phase !== 'idle') heroStop();
}
function heroStart() {
  if (!heroOK() || hState.started) return;
  hState.started = true;
  function ready() {
    if (hState.loaded) return;
    hState.loaded = true;
    if (hMode === 'frozen') {
      var t = Math.max(0, parseFloat(params.get('herot')) || 0);
      hp.setAttribute('data-hv-instant', '');
      hv.addEventListener('seeked', function () { heroShow(true); }, { once: true });
      try { hv.currentTime = Math.min(t, (hv.duration || t) - 0.001); } catch (e) {}
      hv.pause();
      return;
    }
    hb.hidden = false;
    heroSync();
  }
  hv.addEventListener('canplaythrough', ready, { once: true });
  hv.addEventListener('loadeddata', function () { setTimeout(ready, 1500); }, { once: true });
  hv.preload = 'auto';
  hv.src = 'art/video/boat-hero.mp4';
  hv.load();
}
if (hb) hb.addEventListener('click', function () {
  hState.userPaused = !hState.userPaused;
  hb.setAttribute('aria-pressed', hState.userPaused ? 'true' : 'false');
  hb.setAttribute('aria-label', hState.userPaused ? 'Play the headphone animation' : 'Pause the headphone animation');
  heroSync();
});
function heroBoot() { if ('requestIdleCallback' in window) requestIdleCallback(heroStart, { timeout: 2000 }); else setTimeout(heroStart, 200); }
if (document.readyState === 'complete') heroBoot(); else addEventListener('load', heroBoot);

/* hooks into core: the active room changes, the motion preference flips, the tab hides */
onActive.push(function () { heroSync(); });
onMode.push(function () { if (!mqMotion.matches) heroBoot(); heroSync(); });
document.addEventListener('visibilitychange', function () { heroSync(); });

/* 15-reveal.js */
/* Noise to clean (from Proof C): when a room's piece lands after the wipe, a grain tinted from that piece's palette (the model card's
   k = 5 colours, which come from the manifest) clears in visible steps over about 600 ms. One small noise field is generated once,
   lazily, and reused by every room. The grain is a canvas inside the piece, under the room's text. Never on the hero, never under
   reduced motion. ?noise=<0..1> freezes every reveal at that point (0 = first, noisiest step; 1 = the last step before clean). */
var gFrozen = params.has('noise') ? clamp(parseFloat(params.get('noise')) || 0) : null;
var G_COVER = [0.9, 0.78, 0.63, 0.48, 0.33, 0.2, 0.09, 0]; /* share of grains still noisy at each step */
var G_SCALE = [4, 3.5, 3, 3, 2.5, 2, 1.5, 1.5];             /* CSS pixels per grain, coarse to fine */
var G_STEP = 86, G_TILE = 96, gField = null, gTiles = {};
var grains = rooms.map(function (r, i) {
  if (i === 0 || !pieceEls[i]) return null;
  return { i: i, cv: null, state: 'reset', step: 0, t: 0, w: 0, h: 0,
    pal: [].map.call(r.querySelectorAll('.seg'), function (s) { var v = parseInt(s.getAttribute('data-hex').slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }) };
});
function gRand(seed) { var s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function gTile(g, step) {
  var key = g.i + '|' + step;
  if (gTiles[key]) return gTiles[key];
  if (!gField) {
    var r = gRand(128), n = G_TILE * G_TILE;
    gField = { t: new Float32Array(n), c: new Uint8Array(n), b: new Float32Array(n) };
    for (var k = 0; k < n; k++) { gField.t[k] = r(); gField.c[k] = Math.floor(r() * 5); gField.b[k] = r(); }
  }
  var tile = document.createElement('canvas'); tile.width = tile.height = G_TILE;
  var ctx = tile.getContext('2d'), img = ctx.createImageData(G_TILE, G_TILE), px = img.data, cover = G_COVER[step], pal = g.pal.length ? g.pal : [[128, 128, 128]];
  for (var j = 0; j < G_TILE * G_TILE; j++) {
    if (gField.t[j] >= cover) continue;
    var c = pal[gField.c[j] % pal.length], m = 0.5 + gField.b[j] * 1.1, o = j * 4;
    px[o] = Math.min(255, c[0] * m + 10); px[o + 1] = Math.min(255, c[1] * m + 10); px[o + 2] = Math.min(255, c[2] * m + 12); px[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return (gTiles[key] = tile);
}
function gDraw(g, step) {
  g.step = step;
  if (G_COVER[step] <= 0) { if (g.cv) { g.cv.classList.remove('on'); g.cv.width = g.cv.height = 0; } return; }
  if (!g.cv) {
    g.cv = document.createElement('canvas'); g.cv.className = 'grain'; g.cv.setAttribute('aria-hidden', 'true');
    pieceEls[g.i].appendChild(g.cv);
  }
  var s = G_SCALE[step], cw = Math.max(8, Math.round(g.w / s)), ch = Math.max(8, Math.round(g.h / s));
  g.cv.width = cw; g.cv.height = ch;
  var ctx = g.cv.getContext('2d'), ox = Math.floor(Math.random() * G_TILE), oy = Math.floor(Math.random() * G_TILE);
  ctx.translate(-ox, -oy); ctx.fillStyle = ctx.createPattern(gTile(g, step), 'repeat'); ctx.fillRect(ox, oy, cw, ch);
  g.cv.classList.add('on');
}
function gFrozenStep() { return Math.min(G_COVER.length - 2, Math.round(gFrozen * (G_COVER.length - 2))); }
/* primed: the piece is noisy while its circle opens; played: it clears once the words come in; reset: back to noisy for next time */
function gPrime(g) { g.state = 'primed'; gDraw(g, gFrozen !== null ? gFrozenStep() : 0); }
function gPlay(g) {
  if (g.state !== 'primed' || gFrozen !== null) return;
  g.state = 'playing';
  var tick = function () { gDraw(g, g.step + 1); if (g.step < G_COVER.length - 1) g.t = setTimeout(tick, G_STEP); else g.state = 'done'; };
  g.t = setTimeout(tick, G_STEP);
}
function gClear(g) { clearTimeout(g.t); g.state = 'reset'; if (g.cv) { g.cv.classList.remove('on'); g.cv.width = g.cv.height = 0; } }
onMeasure.push(function () { each(grains, function (g) { if (g) { g.w = pieceEls[g.i].offsetWidth; g.h = pieceEls[g.i].offsetHeight; } }); });
onFrame.push(function () {
  if (!wiping()) return;
  each(grains, function (g) {
    if (!g) return;
    var p = ps[g.i];
    if (p > 0 && g.state === 'reset') gPrime(g);
    else if (p <= 0 && g.state !== 'reset' && gFrozen === null) gClear(g);
  });
});
onIn.push(function (i, on) { var g = grains[i]; if (g && on && wiping()) { if (g.state === 'reset') gPrime(g); gPlay(g); } });
onMode.push(function () { if (!wiping()) each(grains, function (g) { if (g) gClear(g); }); });

/* 70-lightbox.js */
/* "More views" strips and the lightbox. Any <ul class="views"> of <button class="views__b"> thumbnails opens here (event delegation,
   so a room needs only the markup). The set is the clicked strip; the colour world is the strip's room. Each button carries
   data-big (960/1600 srcset) and data-lqip; its img carries the native width/height and the alt text, shown as the caption.
   Open and close fly the image between the thumbnail and the centre (FLIP); instant under reduced motion. */
var lb = document.getElementById('lb');
if (lb && lb.showModal) (function () {
  var stage = lb.querySelector('.lb__stage'), bg = lb.querySelector('.lb__bg'), img = new Image();
  var capN = lb.querySelector('.lb__n'), capT = lb.querySelector('.lb__t');
  var prev = lb.querySelector('.lb__prev'), next = lb.querySelector('.lb__next'), close = lb.querySelector('.lb__x');
  var set = [], at = 0, tm = 0, isOpen = false, closing = false, x0 = null, y0 = 0, swiped = false, EASE = 'cubic-bezier(.2,.7,.2,1)';
  img.className = 'lb__img'; img.alt = ''; img.decoding = 'async'; img.draggable = false;
  stage.appendChild(img);

  function thumb() { return set[at].querySelector('img'); }
  function still() { return mqMotion.matches; }
  /* largest native-ratio box that fits the stage */
  function fit() {
    var t = thumb(), w = +t.getAttribute('width'), h = +t.getAttribute('height');
    var s = Math.min(stage.clientWidth / w, stage.clientHeight / h);
    img.style.width = Math.floor(w * s) + 'px'; img.style.height = Math.floor(h * s) + 'px';
    return w * s;
  }
  function show(i) {
    at = (i + set.length) % set.length;
    var b = set[at], t = thumb(), want = at, url = '';
    capN.textContent = set.length > 1 ? (at + 1) + ' of ' + set.length : '';
    capT.textContent = t.alt; /* caption first: its height decides the stage's */
    var need = fit() * (devicePixelRatio || 1);
    img.style.backgroundImage = 'url("' + b.getAttribute('data-lqip') + '")';
    img.src = t.currentSrc || t.src; /* the 480 thumbnail is already loaded: it holds the place until the big file is decoded */
    b.getAttribute('data-big').split(',').some(function (c) {
      var p = c.trim().split(' '); url = p[0]; return parseInt(p[1], 10) >= need;
    });
    var big = new Image(); big.src = url;
    var swap = function () { if (isOpen && at === want) img.src = url; };
    if (big.decode) big.decode().then(swap, function () {}); else big.onload = swap;
  }
  /* FLIP between the thumbnail and the centred image */
  function fly(out) {
    var a = thumb().getBoundingClientRect(), z = img.getBoundingClientRect();
    var tf = 'translate(' + (a.left - z.left) + 'px,' + (a.top - z.top) + 'px) scale(' + (a.width / z.width) + ')';
    return img.animate([{ transform: out ? 'none' : tf }, { transform: out ? tf : 'none' }], { duration: 420, easing: EASE, fill: out ? 'forwards' : 'none' });
  }
  function lock(on) {
    var sb = innerWidth - root.clientWidth;
    root.style.overflow = on ? 'hidden' : '';
    document.body.style.paddingRight = on && sb > 0 ? sb + 'px' : '';
  }
  function open(b) {
    var ul = b.closest('.views'), room = b.closest('[data-world]');
    set = [].slice.call(ul.querySelectorAll('.views__b'));
    lb.setAttribute('data-world', room ? room.getAttribute('data-world') : 'boat');
    prev.hidden = next.hidden = set.length < 2;
    lock(true); lb.showModal(); isOpen = true;
    show(set.indexOf(b));
    close.focus({ preventScroll: true });
    if (still()) { lb.classList.add('is-in'); return; }
    bg.offsetWidth; /* commit the faded-out state so the backdrop transition runs */
    lb.classList.add('is-in'); fly(false);
  }
  function done() {
    clearTimeout(tm);
    if (!isOpen) return;
    isOpen = closing = false;
    if (lb.open) lb.close();
    lb.classList.remove('is-in');
    each(img.getAnimations ? img.getAnimations() : [], function (a) { a.cancel(); });
    img.removeAttribute('src');
    lock(false);
    set[at].focus({ preventScroll: true });
  }
  function shut() {
    if (!isOpen || closing) return;
    closing = true;
    /* bring the current thumbnail into its strip's view so the image has somewhere to land */
    var b = set[at], ul = b.closest('.views'), ur = ul.getBoundingClientRect(), br = b.getBoundingClientRect();
    if (br.left < ur.left || br.right > ur.right) ul.scrollLeft += br.left - ur.left - 4;
    if (still()) return done();
    lb.classList.remove('is-in');
    fly(true).onfinish = done; tm = setTimeout(done, 700);
  }
  function step(d) {
    if (set.length < 2) return;
    show(at + d);
    if (!still()) img.animate([{ opacity: 0, transform: 'translateX(' + d * 48 + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: EASE });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.views__b');
    if (b) open(b);
  });
  prev.addEventListener('click', function () { step(-1); });
  next.addEventListener('click', function () { step(1); });
  close.addEventListener('click', shut);
  lb.addEventListener('cancel', function (e) { e.preventDefault(); shut(); });
  lb.addEventListener('close', done); /* a dialog closed by the browser itself still cleans up */
  /* backdrop click closes (not a click on the image or the controls, and not the end of a swipe) */
  lb.addEventListener('click', function (e) {
    if (swiped) { swiped = false; return; }
    if (e.target === lb || e.target === stage || e.target === bg) shut();
  });
  lb.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
    else if (e.key === 'Tab') { /* focus trap over the visible buttons */
      var f = [].filter.call(lb.querySelectorAll('button'), function (x) { return !x.hidden; }), i = f.indexOf(document.activeElement);
      if (e.shiftKey ? i <= 0 : i === f.length - 1) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
    }
  });
  /* swipe: left/right moves within the set, down closes */
  stage.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; swiped = false; });
  stage.addEventListener('pointerup', function (e) {
    if (x0 === null) return;
    var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { swiped = true; step(dx < 0 ? 1 : -1); }
    else if (dy > 80 && dy > Math.abs(dx)) { swiped = true; shut(); }
  });
  stage.addEventListener('pointercancel', function () { x0 = null; });

  /* strips: fade the right edge while thumbnails are hidden off to the right */
  var strips = document.querySelectorAll('.views');
  function hint() { each(strips, function (ul) { ul.toggleAttribute('data-more', ul.scrollWidth - ul.clientWidth - ul.scrollLeft > 2); }); }
  each(strips, function (ul) { ul.addEventListener('scroll', hint, { passive: true }); });
  addEventListener('resize', function () { hint(); if (isOpen) fit(); });
  hint();
})();

/* 71-map-loader.js */
/* Colour map loader. The map section is plain HTML (an ordered list of the pieces). This script is added after the first paint,
   and it then fetches css/map.css (the map's own styles, off the first-paint path); the plot stays hidden until that sheet is in,
   so nothing shows unstyled. When the section comes within about two screens (or ?open=<piece-id> asks), js/map.js is added, but
   never before the stylesheet has loaded; it fetches art/embedding.json, art/projects.json and the 480 thumbnails.
   If the stylesheet, the script or its data fail, the plain list comes back. */
var mapSec = document.getElementById('map');
if (mapSec) (function () {
  var all = document.getElementById('map-all'), asked = false, styled = false, added = false;
  function fail() {
    mapSec.classList.remove('map--js'); mapSec.classList.add('map--broken');
    if (all) all.open = true;
  }
  function add() {
    if (added || !asked || !styled) return;
    added = true;
    var s = document.createElement('script');
    s.src = 'js/map.js'; s.async = true; s.onerror = fail;
    document.head.appendChild(s);
  }
  function load() { asked = true; add(); }
  var l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = 'css/map.css'; l.onerror = fail;
  /* the sheet changes the map's height, which can happen after a /#on-the-clock landing. Until the reader touches the page
     (or 5 s pass), land again whenever the map section changes height. */
  var touched = false;
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (n) { addEventListener(n, function () { touched = true; }, { passive: true, once: true }); });
  if ('ResizeObserver' in window && extraForHash(location.hash) && !params.has('open')) {
    var ro = new ResizeObserver(function () { if (touched) ro.disconnect(); else openHash(); });
    ro.observe(mapSec);
    setTimeout(function () { ro.disconnect(); }, 5000);
  }
  l.onload = function () { styled = true; add(); };
  document.head.appendChild(l);
  mapSec.classList.add('map--js');
  if (all) all.open = false;
  mapSec.addEventListener('map:fail', fail);
  if (params.has('open') || !('IntersectionObserver' in window)) { load(); return; }
  var io = new IntersectionObserver(function (es) {
    if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); load(); }
  }, { rootMargin: '150% 0px 150% 0px' });
  io.observe(mapSec);
})();

/* 94-story.js */
/* Story: draw the learning curve by scroll, light dots as the line reaches them, first tap shows a thumbnail on touch. */
(function () {
  var chart = document.querySelector('[data-chart]');
  if (!chart) return;
  var lines = chart.querySelectorAll('.curve__line'), dots = chart.querySelectorAll('.dot');
  var fz = params.has('draw') ? clamp(parseFloat(params.get('draw')) || 0) : null;
  function set(p, desk) {
    each(lines, function (l) { l.style.strokeDashoffset = p === null ? '' : 1 - p; });
    each(dots, function (d) {
      var f = parseFloat(d.getAttribute(desk ? 'data-fh' : 'data-fv'));
      d.classList.toggle('off', p !== null && p < f - 0.005);
    });
  }
  /* geometry is cached in measure (00-core.js); the frame only uses scrollY, so this rides on the one scroll handler */
  var cTop = 0, cH = 0, last = null;
  onMeasure.push(function () { var b = chart.getBoundingClientRect(); cTop = b.top + scrollY; cH = b.height; last = null; });
  function upd() {
    var v = mqMotion.matches && fz === null ? null : fz !== null ? fz : Math.round(clamp((H * 0.85 - (cTop - Y)) / (cH + H * 0.35)) * 1000) / 1000;
    if (v === last) return; /* nothing changed (the chart is off screen, or the line is fully drawn) */
    last = v; set(v, mqDesk.matches);
  }
  onFrame.push(upd);
  onMode.push(function () { last = undefined; upd(); });
  var touch = matchMedia('(hover: none)');
  chart.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('.dot__pt') : null;
    each(dots, function (d) { if (!a || d !== a.parentNode) d.classList.remove('show'); });
    if (!a || !touch.matches || a.parentNode.classList.contains('show')) return;
    e.preventDefault(); a.parentNode.classList.add('show'); a.scrollIntoView({ block: 'center', behavior: mqMotion.matches ? 'instant' : 'smooth' });
  });
  document.addEventListener('click', function (e) { if (!chart.contains(e.target)) each(dots, function (d) { d.classList.remove('show'); }); });
})();

/* 94z-on-the-clock.js */
/* On the clock: cards and timeline entries below the first screen fade up as they arrive. Motion only; without script, or with
   reduced motion, nothing is hidden. Numbers are static (no count-up). */
(function () {
  var sec = document.getElementById('on-the-clock');
  if (!sec || !('IntersectionObserver' in window) || mqMotion.matches) return;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  each(sec.querySelectorAll('.otc__bio,.feat,.pcard,.tl__i'), function (el) {
    var r = el.getBoundingClientRect();
    if (r.top < innerHeight) return; /* already on screen (deep link): leave visible */
    el.setAttribute('data-rv', ''); io.observe(el);
  });
})();

/* 98-rail.js */
/* Rail: the build writes one thumbnail per section[data-room] and one chip per later section with data-rail-text (tools/build-site.mjs).
   Over the rooms it is the full filmstrip (at phone widths the chips sit behind a "more" button). Over normal-flow content it gets out
   of the way: it tucks away while you scroll down, comes back as a small pill when you scroll up (and tucks again after a few idle
   seconds), and it stays away while the footer is showing. The pill opens the full rail. Focus inside the rail always shows it. */
var rail = document.getElementById('rail');
var railNow = rail.querySelector('.rail__now'), railNowT = rail.querySelector('.rail__nt');
var railMore = rail.querySelector('.rail__more'), railChips = rail.querySelector('.rail__chips');
var railLinks = rooms.map(function (r) { return rail.querySelector('.rail__rooms a[href="#' + r.id + '"]'); });
var railExtraLinks = [].slice.call(rail.querySelectorAll('.rail__chips a'));
each(railLinks, bindNav);
each(railExtraLinks, bindNav);
if (!railExtraLinks.length) railMore.hidden = true;
rail.classList.add('rail--js');
follow(rail, function () { return [mqDesk.matches ? 100 : VW / 2, H - 36]; });

var railFace = 'full', railTucked = false, railAcc = 0, railOpenAt = null, railIdle = 0, railHover = false;
function railSet(face, tucked) {
  if (face !== railFace) { railFace = face; rail.classList.toggle('is-compact', face === 'compact'); if (face === 'compact') railMoreSet(false); }
  if (tucked !== railTucked) { railTucked = tucked; rail.classList.toggle('is-tucked', tucked); if (tucked) railMoreSet(false); }
}
function railMoreSet(on) {
  if (rail.classList.contains('is-more') === on) return;
  rail.classList.toggle('is-more', on); railMore.setAttribute('aria-expanded', on ? 'true' : 'false');
}
function railIdleArm() {
  clearTimeout(railIdle);
  railIdle = setTimeout(function () {
    if (railFace === 'compact' && !railTucked && !railHover && !rail.contains(document.activeElement)) railSet('compact', true);
  }, 4000);
}
/* the pill (or focus) opens the full rail; it closes again after a real scroll, a pick, Escape or a tap outside */
function railOpen(moveFocus) {
  railOpenAt = Y; railSet('full', false); rail.classList.add('is-open'); railNow.setAttribute('aria-expanded', 'true');
  if (!mqDesk.matches && railExtraLinks.length) railMoreSet(true);
  if (moveFocus) { var c = rail.querySelector('.rail__body [aria-current="true"]') || rail.querySelector('.rail__body a'); if (c) c.focus({ preventScroll: true }); }
}
function railClose() {
  if (railOpenAt === null) return;
  railOpenAt = null; rail.classList.remove('is-open'); railNow.setAttribute('aria-expanded', 'false'); railMoreSet(false); onScroll();
}
railNow.addEventListener('click', function (e) { railOpen(e.detail === 0); });
railMore.addEventListener('click', function () { railMoreSet(!rail.classList.contains('is-more')); });
each(railLinks.concat(railExtraLinks), function (l) { l.addEventListener('click', function () { railMoreSet(false); railClose(); }); });
/* Escape closes the chip menu, then the opened rail (from anywhere: a tap on the pill leaves focus on the page) */
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape' || (!rail.classList.contains('is-more') && railOpenAt === null)) return;
  var inside = rail.contains(document.activeElement);
  if (rail.classList.contains('is-more') && railOpenAt === null) { railMoreSet(false); if (inside) railMore.focus(); }
  else { railClose(); if (inside) railNow.focus(); }
});
document.addEventListener('click', function (e) { if (!rail.contains(e.target)) { railMoreSet(false); railClose(); } });
rail.addEventListener('pointerenter', function () { railHover = true; clearTimeout(railIdle); });
rail.addEventListener('pointerleave', function () { railHover = false; if (railFace === 'compact') railIdleArm(); });
rail.addEventListener('focusin', function () { clearTimeout(railIdle); if (railTucked) railSet(railFace, false); });
rail.addEventListener('focusout', function (e) { if (!rail.contains(e.relatedTarget) && railFace === 'compact') railIdleArm(); });

/* where the rail sits: over the rooms (full), over normal-flow content (pill / tucked), or with the footer showing (tucked) */
function railZone() {
  if (foot && Y + H - 8 > footTop) return 'foot';
  if (!wiping()) return Y < 8 ? 'rooms' : 'flow';
  return flowAt(H - 36) ? 'flow' : 'rooms';
}
onFrame.push(function (y, dy) {
  var z = railZone();
  if (railOpenAt !== null) { if (z !== 'foot' && Math.abs(y - railOpenAt) < 140) return; railClose(); }
  if (z === 'rooms') { railAcc = 0; railSet('full', false); return; }
  if (z === 'foot') { railSet(railFace, true); return; }
  if (dy) railAcc = (dy > 0) === (railAcc > 0) ? railAcc + dy : dy;
  if (railAcc < -30) { if (railFace !== 'compact' || railTucked) { railSet('compact', false); } railIdleArm(); }
  else if (railAcc > 8 || railFace === 'full') railSet(railFace, true);
});

function markRail(a, ex) {
  railLinks.forEach(function (l, i) { if (!ex && i === a) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current'); });
  var cur = null;
  railExtraLinks.forEach(function (l) { if (ex && l.getAttribute('href') === '#' + ex.id) { l.setAttribute('aria-current', 'true'); cur = l; } else l.removeAttribute('aria-current'); });
  railMore.classList.toggle('is-cur', !!cur);
  railNowT.textContent = cur ? cur.textContent : 'Rooms';
  railNow.setAttribute('aria-label', railNowT.textContent + ': show all rooms and sections');
}
onActive.push(function (a) { markRail(a, activeExtra); });
onExtra.push(function (ex) { markRail(active, ex); });
markRail(0, null);

/* 99-start.js */
start();
})();
