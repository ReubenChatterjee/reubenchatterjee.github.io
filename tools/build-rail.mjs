#!/usr/bin/env node
// Writes the rail thumbnails: site/art/img/<stem>-rail.webp, 102 px tall (3x the 34 px the rail shows), from <stem>-960.webp.
// The rail is on the first screen, so its images are kept tiny (1 to 3 KB each) to stay out of the hero still's way.
// Reads data-rail-src from site-src/sections/*.html; run it when a room is added or its still changes.
//   node tools/build-rail.mjs
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(repo, 'site-src', 'sections');
const stems = new Set();
for (const n of (await readdir(dir)).filter((f) => f.endsWith('.html'))) {
  for (const m of (await readFile(path.join(dir, n), 'utf8')).matchAll(/data-rail-src="([^"]+)"/g)) stems.add(m[1]);
}
for (const stem of [...stems].sort()) {
  const o = await sharp(path.join(repo, 'site', `${stem}-960.webp`)).resize({ height: 102 }).webp({ quality: 80 }).toFile(path.join(repo, 'site', `${stem}-rail.webp`));
  console.log(`${stem}-rail.webp ${o.width}x${o.height} ${o.size} bytes`);
}
