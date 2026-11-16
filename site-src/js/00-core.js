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
