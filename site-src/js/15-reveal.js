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
