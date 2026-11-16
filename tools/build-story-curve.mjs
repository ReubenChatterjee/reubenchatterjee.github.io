#!/usr/bin/env node
// Redraws the story section's learning curve for however many dots site-src/sections/94-story.html holds.
//
//   node tools/build-story-curve.mjs      then: node tools/build-site.mjs
//
// The curve drops fast and flattens (1 - e^-kt), with a little seeded jitter between dots that fades toward the end.
// It writes the two SVG paths (horizontal for 900px and up, vertical for phones), each dot's position on the curve and
// the fraction of the path length at which the line reaches it. Run it after adding or removing a dot (an <li class="dot">).
// The phone layout's height (rows of 74px) and the desktop label grid's column count are written into site-src/css/94-story.css.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const f = path.join(repo, 'site-src/sections/94-story.html');
const cssFile = path.join(repo, 'site-src/css/94-story.css');
let h = fs.readFileSync(f, 'utf8');
const N = (h.match(/<li class="dot"/g) || []).length;
if (N < 2) throw new Error('need at least two dots');

let s = 1234567;
const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 4294967296) * 2 - 1; };
const SUB = 12, K = 3.2;
const shape = (t) => (1 - Math.exp(-K * t)) / (1 - Math.exp(-K));
function build(amp) {
  const pts = [], idx = [];
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < SUB; j++) {
      const u = i + j / SUB, t = u / (N - 1);
      pts.push({ u, v: shape(t), n: j === 0 ? 0 : rnd() * amp * (1 - t) * Math.sin((Math.PI * j) / SUB) });
      if (j === 0) idx.push(pts.length - 1);
    }
  }
  pts.push({ u: N - 1, v: 1, n: 0 });
  idx.push(pts.length - 1);
  return { pts, idx };
}
function frac(P, idx) {
  const c = [0];
  for (let i = 1; i < P.length; i++) c.push(c[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  return idx.map((i) => c[i] / c[c.length - 1]);
}
const d = (P) => 'M' + P.map((p) => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L');

// horizontal: viewBox 1000 x 280, dots evenly spaced with half a step of margin on each side
const X0 = 1000 / (2 * N), XS = 1000 / N, Y0 = 40, Y1 = 236;
const H = build(5);
const PH = H.pts.map((p) => [X0 + XS * p.u, Y0 + (Y1 - Y0) * p.v + p.n]);
const fh = frac(PH, H.idx);
// vertical: a 64px lane, one 74px row per dot
const ROW = 74, V0 = 54, V1 = 12;
const V = build(3.5);
const PV = V.pts.map((p) => [V0 + (V1 - V0) * p.v + p.n, ROW / 2 + ROW * p.u]);
const fv = frac(PV, V.idx);

h = h.replace(/(<svg class="curve curve--h"[\s\S]*?<\/svg>)/, (m) => m.replace(/ d="[^"]*"/g, ` d="${d(PH)}"`));
h = h.replace(/(<svg class="curve curve--v"[\s\S]*?<\/svg>)/, (m) => m.replace(/ d="[^"]*"/g, ` d="${d(PV)}"`).replace(/viewBox="0 0 64 \d+"/, `viewBox="0 0 64 ${ROW * N}"`));
let k = 0;
h = h.replace(/<li class="dot" style="[^"]*" data-fh="[^"]*" data-fv="[^"]*">/g, () => {
  const i = k++;
  return `<li class="dot" style="--x:${(PH[H.idx[i]][0] / 10).toFixed(3)};--y:${(PH[H.idx[i]][1] / 2.8).toFixed(2)};--vx:${PV[V.idx[i]][0].toFixed(2)}" data-fh="${fh[i].toFixed(4)}" data-fv="${fv[i].toFixed(4)}">`;
});
if (k !== N) throw new Error(`rewrote ${k} dots, expected ${N}`);
fs.writeFileSync(f, h);

let css = fs.readFileSync(cssFile, 'utf8');
const before = css;
css = css.replace(/(\.dots\{display:grid;grid-template-columns:repeat\()\d+/, `$1${N}`);
if (!css.includes(`grid-template-columns:repeat(${N},`)) throw new Error('could not find the label grid in 94-story.css');
css = css.replace(/(\.plot\{width:64px;height:)\d+px/, `$1${ROW * N}px`).replace(/(\.curve--v\{width:64px;height:)\d+px/, `$1${ROW * N}px`);
if (css === before && !css.includes(`height:${ROW * N}px`)) throw new Error('could not find the phone lane height in 94-story.css');
fs.writeFileSync(cssFile, css);
console.log(`story curve: ${N} dots; phone lane ${ROW * N}px tall`);
