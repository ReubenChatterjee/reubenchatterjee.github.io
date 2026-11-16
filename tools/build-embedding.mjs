#!/usr/bin/env node
// Builds site/art/embedding.json (where each still sits on the colour map) and
// writes the map section's fallback list and piece count into
// site-src/sections/93-map.html. Run `node tools/build-site.mjs` afterwards.
//
// Usage: node tools/build-embedding.mjs
//
// Input is only site/art/projects.json (the five k-means palette colours and
// their pixel-share weights for each still). Nothing is random: running the
// script twice gives byte-identical output.
//
// What is measured, per still:
//   1. Every palette colour is converted from sRGB to OKLab (L = lightness,
//      a = green..red, b = blue..yellow).
//   2. lightness = weighted mean of L (weights = share of pixels).
//   3. warmth = weighted mean of the colour's position along the blue-to-orange
//      direction of the a/b plane: a*cos(60deg) + b*sin(60deg). Positive leans
//      orange/red/yellow, negative leans blue/cyan. Greys score near zero.
// The x axis is lightness (darker -> brighter), the y axis is warmth
// (cooler -> warmer), both rescaled to the data range and drawn on a power
// scale (order unchanged, so the axis words stay true). Then a collision-
// relaxation pass nudges thumbnails apart so none overlap, while a spring pulls
// each one back toward its measured position.
//
// "Closest in colour" uses a symmetric weighted nearest-colour distance between
// two palettes in OKLab (see paletteDistance).

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const manifestPath = path.join(root, 'site/art/projects.json');
const outPath = path.join(root, 'site/art/embedding.json');
const partialPath = path.join(root, 'site-src/sections/93-map.html');

const WARM_ANGLE = (60 * Math.PI) / 180;
// Most stills are dark and lean slightly cool, with one very warm outlier, so
// both axes are drawn on a power scale (like a log axis: order and labels
// unchanged) to give the crowded end room.
const X_POWER = 0.6;
const Y_POWER = 0.6;

// Three layouts: `wide` for landscape map frames (900 px and up), `tall` and
// `short` for phone frames (map.js picks the one whose shape is closest). Only the scale of the axes and the thumbnail size differ; the
// measured order along each axis is the same. `key` (wide only) is a box in
// world units kept free of thumbnails for the in-map key. It sits in the
// bright-and-warm corner, which no still measures into (checked below).
const LAYOUTS = {
  wide: { width: 1600, height: 800, pad: 56, base: 118, gap: 14, key: { x: 1290, y: 24, w: 286, h: 238 } },
  tall: { width: 400, height: 600, pad: 18, base: 70, gap: 6 },
  // short phone frames (the 393 x 660 visible area): same width, less height
  short: { width: 400, height: 500, pad: 18, base: 62, gap: 6 },
};

// Size tiers by rank (a curation choice, not a measurement).
const sizeFactor = (rank) => (rank === 1 ? 1.55 : rank <= 3 ? 1.25 : 1);

// ---------- colour maths ----------
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
// Björn Ottosson's OKLab.
function hexToOklab(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const dist3 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

// Symmetric weighted nearest-colour distance: each colour in A finds its
// nearest colour in B (OKLab), weighted by its pixel share; same from B to A;
// the result is the mean of the two directions.
function paletteDistance(A, B) {
  const one = (X, Y) => X.reduce((sum, x) => sum + x.w * Math.min(...Y.map((y) => dist3(x.lab, y.lab))), 0);
  const wa = A.reduce((s, x) => s + x.w, 0);
  const wb = B.reduce((s, x) => s + x.w, 0);
  return (one(A, B) / wa + one(B, A) / wb) / 2;
}

const round = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d;

// ---------- layout ----------
function nodeSize(piece, base) {
  // Equal area for every orientation, then the rank tier.
  const area = base * base * sizeFactor(piece.rank) ** 2;
  const h = Math.sqrt(area / piece.ratio);
  return { w: round(h * piece.ratio, 1), h: round(h, 1) };
}

// Push a node out of the key box (the box does not move).
function avoidKey(n, K, gap) {
  if (!K) return false;
  const ox = Math.min(n.x + n.w / 2 + gap - K.x, K.x + K.w + gap - (n.x - n.w / 2));
  const oy = Math.min(n.y + n.h / 2 + gap - K.y, K.y + K.h + gap - (n.y - n.h / 2));
  if (ox <= 0 || oy <= 0) return false;
  if (ox < oy) n.x += n.x < K.x + K.w / 2 ? -ox : ox;
  else n.y += n.y < K.y + K.h / 2 ? -oy : oy;
  return true;
}

function relax(nodes, L) {
  // nodes: [{tx, ty, x, y, w, h}] with centres; deterministic order.
  const ITER = 600;
  const SPRING = 0.02;
  for (let it = 0; it < ITER; it++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const p = nodes[i];
        const q = nodes[j];
        const ox = (p.w + q.w) / 2 + L.gap - Math.abs(p.x - q.x);
        const oy = (p.h + q.h) / 2 + L.gap - Math.abs(p.y - q.y);
        if (ox > 0 && oy > 0) {
          // Push apart along the axis of least overlap, split by size.
          const share = q.w * q.h / (p.w * p.h + q.w * q.h);
          if (ox < oy) {
            const dir = p.x < q.x || (p.x === q.x && i < j) ? -1 : 1;
            p.x += dir * ox * share;
            q.x -= dir * ox * (1 - share);
          } else {
            const dir = p.y < q.y || (p.y === q.y && i < j) ? -1 : 1;
            p.y += dir * oy * share;
            q.y -= dir * oy * (1 - share);
          }
        }
      }
    }
    // Spring back toward the measured position, keep out of the key, stay inside the frame.
    for (const n of nodes) {
      n.x += (n.tx - n.x) * SPRING;
      n.y += (n.ty - n.y) * SPRING;
      avoidKey(n, L.key, L.gap);
      n.x = Math.min(L.width - L.pad / 2 - n.w / 2, Math.max(L.pad / 2 + n.w / 2, n.x));
      n.y = Math.min(L.height - L.pad / 2 - n.h / 2, Math.max(L.pad / 2 + n.h / 2, n.y));
    }
  }
  // Final strict pass without the spring so nothing is left overlapping.
  for (let it = 0; it < 200; it++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const p = nodes[i];
        const q = nodes[j];
        const ox = (p.w + q.w) / 2 + L.gap - Math.abs(p.x - q.x);
        const oy = (p.h + q.h) / 2 + L.gap - Math.abs(p.y - q.y);
        if (ox > 0.01 && oy > 0.01) {
          moved = true;
          if (ox < oy) {
            const dir = p.x <= q.x ? -1 : 1;
            p.x += (dir * ox) / 2;
            q.x -= (dir * ox) / 2;
          } else {
            const dir = p.y <= q.y ? -1 : 1;
            p.y += (dir * oy) / 2;
            q.y -= (dir * oy) / 2;
          }
        }
      }
    }
    for (const n of nodes) {
      if (avoidKey(n, L.key, 0.5)) moved = true;
      n.x = Math.min(L.width - n.w / 2 - 4, Math.max(n.w / 2 + 4, n.x));
      n.y = Math.min(L.height - n.h / 2 - 4, Math.max(n.h / 2 + 4, n.y));
    }
    if (!moved) break;
  }
  return nodes;
}

function overlaps(nodes, K) {
  let count = 0;
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    if (K && Math.abs(p.x - (K.x + K.w / 2)) < (p.w + K.w) / 2 && Math.abs(p.y - (K.y + K.h / 2)) < (p.h + K.h) / 2) count++;
    for (let j = i + 1; j < nodes.length; j++) {
      const q = nodes[j];
      if (Math.abs(p.x - q.x) < (p.w + q.w) / 2 && Math.abs(p.y - q.y) < (p.h + q.h) / 2) count++;
    }
  }
  return count;
}

// Spearman rank correlation, to report how far relaxation bends the order.
function spearman(a, b) {
  const rank = (v) => {
    const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(v.length);
    idx.forEach(([, i], k) => { r[i] = k; });
    return r;
  };
  const ra = rank(a), rb = rank(b), n = a.length;
  const d2 = ra.reduce((s, r, i) => s + (r - rb[i]) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}

// ---------- main ----------
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const pieces = [...manifest.pieces].sort((a, b) => a.rank - b.rank);
const projects = new Map(manifest.projects.map((p) => [p.id, p]));

const feats = pieces.map((p) => {
  const cols = p.palette.map((c) => ({ hex: c.hex, w: c.weight, lab: hexToOklab(c.hex) }));
  const W = cols.reduce((s, c) => s + c.w, 0);
  const mean = (f) => cols.reduce((s, c) => s + c.w * f(c), 0) / W;
  const L = mean((c) => c.lab[0]);
  const a = mean((c) => c.lab[1]);
  const b = mean((c) => c.lab[2]);
  const warmth = mean((c) => c.lab[1] * Math.cos(WARM_ANGLE) + c.lab[2] * Math.sin(WARM_ANGLE));
  const chroma = mean((c) => Math.hypot(c.lab[1], c.lab[2]));
  return { id: p.id, rank: p.rank, piece: p, cols, L, a, b, warmth, chroma };
});

const Lmin = Math.min(...feats.map((f) => f.L));
const Lmax = Math.max(...feats.map((f) => f.L));
const Wmin = Math.min(...feats.map((f) => f.warmth));
const Wmax = Math.max(...feats.map((f) => f.warmth));
for (const f of feats) {
  f.lx = (f.L - Lmin) / (Lmax - Lmin);
  f.wy = (f.warmth - Wmin) / (Wmax - Wmin);
  f.nx = Math.pow(f.lx, X_POWER);
  f.ny = Math.pow(f.wy, Y_POWER);
}

// Nearest neighbours by palette distance.
for (const f of feats) {
  f.neighbours = feats
    .filter((g) => g.id !== f.id)
    .map((g) => ({ id: g.id, d: paletteDistance(f.cols, g.cols) }))
    .sort((p, q) => p.d - q.d || (p.id < q.id ? -1 : 1))
    .slice(0, 3)
    .map((n) => ({ id: n.id, distance: round(n.d, 3) }));
}

const layouts = {};
let problems = 0;
for (const [name, L] of Object.entries(LAYOUTS)) {
  const innerW = L.width - 2 * L.pad;
  const innerH = L.height - 2 * L.pad;
  const nodes = feats.map((f) => {
    const s = nodeSize(f.piece, L.base);
    const tx = L.pad + f.nx * innerW;
    const ty = L.pad + (1 - f.ny) * innerH; // warmer is up
    return { id: f.id, tx, ty, x: tx, y: ty, w: s.w, h: s.h };
  });
  if (L.key) {
    const K = L.key;
    const inKey = nodes.filter((n) => n.tx >= K.x && n.tx <= K.x + K.w && n.ty >= K.y && n.ty <= K.y + K.h);
    if (inKey.length) { problems++; console.warn(`layout ${name}: measured points inside the key box: ${inKey.map((n) => n.id).join(', ')}`); }
  }
  relax(nodes, L);
  const left = overlaps(nodes, L.key);
  if (left) { problems++; console.warn(`layout ${name}: ${left} overlapping pairs remain`); }
  const outside = nodes.filter((n) => n.x - n.w / 2 < 0 || n.y - n.h / 2 < 0 || n.x + n.w / 2 > L.width || n.y + n.h / 2 > L.height).length;
  if (outside) { problems++; console.warn(`layout ${name}: ${outside} nodes outside the frame`); }
  const drift = nodes.map((n) => Math.hypot(n.x - n.tx, n.y - n.ty));
  console.log(
    `layout ${name}: mean drift ${round(drift.reduce((s, d) => s + d, 0) / drift.length, 1)}, max ${round(Math.max(...drift), 1)} (world units); ` +
      `spearman x ${round(spearman(nodes.map((n) => n.x), nodes.map((n) => n.tx)), 3)}, y ${round(spearman(nodes.map((n) => n.y), nodes.map((n) => n.ty)), 3)}`,
  );
  layouts[name] = {
    width: L.width,
    height: L.height,
    pad: L.pad,
    ...(L.key ? { key: L.key } : {}),
    nodes: Object.fromEntries(
      nodes.map((n) => [
        n.id,
        {
          x: round(n.x, 1),
          y: round(n.y, 1),
          w: n.w,
          h: n.h,
          trueX: round(n.tx, 1),
          trueY: round(n.ty, 1),
        },
      ]),
    ),
  };
}

// Axis truth: x must rise with lightness and y with warmth (strictly by measured value).
const mono = (key, val) => [...feats].sort((p, q) => p[val] - q[val]).every((f, i, s) => !i || s[i - 1][key] <= f[key]);
if (!mono('nx', 'L') || !mono('ny', 'warmth')) { problems++; console.warn('axis order is not monotone'); }

const out = {
  generatedBy: 'tools/build-embedding.mjs',
  source: 'site/art/projects.json',
  count: feats.length,
  method: {
    colourSpace: 'OKLab',
    x: `lightness: pixel-share-weighted mean of OKLab L over the five palette colours, rescaled to the data range (0 = darkest still, 1 = brightest), then drawn on a power scale (value ^ ${X_POWER}) so the many dark stills get room; order is unchanged`,
    y: `warmth: pixel-share-weighted mean of a*cos(60deg) + b*sin(60deg) in OKLab, rescaled to the data range (0 = coolest, 1 = warmest), then drawn on a power scale (value ^ ${Y_POWER}) so the crowded cool end gets room; order is unchanged`,
    layout: 'deterministic collision relaxation (600 passes, spring 0.02 toward the measured point, then a strict separation pass); the wide layout keeps a key box in the bright-and-warm corner, where no still measures',
    neighbours: 'symmetric pixel-share-weighted nearest-colour distance between palettes in OKLab; 3 closest',
    size: 'thumbnail area is equal for all stills except a rank tier (rank 1 x1.55, ranks 2-3 x1.25); size is curation, not measurement',
  },
  ranges: {
    lightness: [round(Lmin), round(Lmax)],
    warmth: [round(Wmin), round(Wmax)],
  },
  pieces: feats.map((f) => ({
    id: f.id,
    rank: f.rank,
    features: {
      lightness: round(f.L),
      a: round(f.a),
      b: round(f.b),
      warmth: round(f.warmth),
      chroma: round(f.chroma),
      lightnessScaled: round(f.lx),
      warmthScaled: round(f.wy),
      x: round(f.nx),
      y: round(f.ny),
    },
    neighbours: f.neighbours,
  })),
  layouts,
};

await writeFile(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${path.relative(root, outPath)} (${feats.length} stills)`);

// ---------- the section partial: count and fallback list ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const words = (n) => (n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '') : String(n));
const cap = (s) => s[0].toUpperCase() + s.slice(1);

const items = pieces.map((p) => {
  const pr = projects.get(p.project);
  const many = pr.pieces.length > 1;
  const view = many ? ` · view ${pr.pieces.indexOf(p.id) + 1} of ${pr.pieces.length}` : '';
  const sw = p.palette.map((c) => `<i style="flex-grow:${Math.round(c.weight * 1000)};background:${c.hex}"></i>`).join('');
  return `    <li><a class="map__li" href="${p.src['1600'] || p.src['960']}" data-open="${p.id}"><span class="map__li-t">${esc(pr.title)}</span>` +
    `<span class="map__li-m">${esc(pr.dateLabel)}${view}</span><span class="map__sw" aria-hidden="true">${sw}</span></a></li>`;
});

const fill = (html, tag, text) => {
  const re = new RegExp(`(<!-- ${tag}:start -->)[\\s\\S]*?(<!-- ${tag}:end -->)`, 'g');
  if (!re.test(html)) throw new Error(`marker ${tag} missing in ${path.relative(root, partialPath)}`);
  return html.replace(re, (_, a, b) => a + text + b);
};
let partial = await readFile(partialPath, 'utf8');
partial = fill(partial, 'count', cap(words(feats.length)));
partial = fill(partial, 'n', String(feats.length));
partial = fill(partial, 'list', '\n' + items.join('\n') + '\n    ');
await writeFile(partialPath, partial);
console.log(`wrote ${path.relative(root, partialPath)} (count and list)`);

for (const f of feats) {
  console.log(
    `${f.id.padEnd(20)} L=${f.L.toFixed(3)} warmth=${f.warmth.toFixed(4)} x=${f.nx.toFixed(2)} y=${f.ny.toFixed(2)} nn=${f.neighbours.map((n) => n.id).join(',')}`,
  );
}
if (problems) { console.error(`${problems} problem(s), see warnings above`); process.exitCode = 1; }
