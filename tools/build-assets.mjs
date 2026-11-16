#!/usr/bin/env node
// Builds web-optimised stills, short clips with posters, the resume copy and
// site/art/projects.json from a fixed list of source files.
//
// Usage: node tools/build-assets.mjs <sourceDir>
//
// Only the files listed in STILLS and VIDEOS are read from <sourceDir>.
// Requires ffmpeg/ffprobe (FFMPEG env var overrides the default path).

import sharp from 'sharp';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG || '/opt/homebrew/bin/ffmpeg';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const IMG_DIR = path.join(SITE, 'art', 'img');
const VID_DIR = path.join(SITE, 'art', 'video');

const WIDTHS = [480, 960, 1600];
const Q_START = 78;
const Q_STEP = 6;
const Q_FLOOR = 30;
const LIMIT_480 = 200_000; // bytes
const LIMIT_LARGE = 500_000; // bytes
const LIMIT_CLIP = 2_000_000; // bytes
const LIMIT_POSTER = 150_000; // bytes
const CRF_START = 28;
const CRF_MAX = 40;
const DISCLAIMER = 'Personal projects. Not affiliated with or endorsed by any brand shown.';

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error('Usage: node tools/build-assets.mjs <sourceDir>');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Inputs (fixed list). Descriptions are used as the basis for alt text.
// ---------------------------------------------------------------------------

const STILLS = [
  { id: 'boat-front', src: 'Boat Rockerz/1.png', project: 'boat-rockerz', rank: 1, description: 'Blue and black over-ear headphones seen from the front against a soft grey studio gradient' },
  { id: 'boat-trio', src: 'Boat Rockerz/4.png', project: 'boat-rockerz', rank: 4, description: 'Three over-ear headphones side by side in grey, blue and black' },
  { id: 'boat-float', src: 'Boat Rockerz/3.png', project: 'boat-rockerz', rank: 13, description: 'Blue headphones floating at an angle with a dark vignette' },
  { id: 'wingman-gold', src: 'Wingman/Render3.png', project: 'wingman', rank: 2, description: 'Ornate gold stylised pistol with an engraved grip on a black background' },
  { id: 'wingman-blue', src: 'Wingman/Blue2.png', project: 'wingman', rank: 8, description: 'Stylised pistol outlined in glowing cyan edge lines on black' },
  { id: 'wingman-red', src: 'Wingman/Red2.png', project: 'wingman', rank: 9, description: 'Red and black stylised pistol with a red glow on black' },
  { id: 'pokemon-group', src: 'Pokemon/Pokemon1.png', project: 'pokemon', rank: 3, description: 'Salamence, Jigglypuff, Ralts and two Poke Balls on a purple-lit stage' },
  { id: 'pokemon-jigglypuff', src: 'Pokemon/Pokemon4.png', project: 'pokemon', rank: 10, description: 'Pink Jigglypuff with teal eyes on a purple floor' },
  { id: 'pokemon-group-tall', src: 'Pokemon/PhonePokemon1.png', project: 'pokemon', rank: 11, description: 'Portrait view of Salamence, Jigglypuff, Ralts and two Poke Balls' },
  { id: 'pokemon-salamence', src: 'Pokemon/Pokemon3.png', project: 'pokemon', rank: 12, description: 'Salamence in profile with a red wing and teal and yellow body' },
  { id: 'hotwheels-case', src: 'Innova Hot Wheels/HW1.png', project: 'hot-wheels', rank: 5, description: 'White toy car in an open collector case with orange and blue inserts' },
  { id: 'hotwheels-dark', src: 'Innova Hot Wheels/HW3.png', project: 'hot-wheels', rank: 14, description: 'The open toy car case on a black background, with orange and blue inserts' },
  { id: 'gwagon-street', src: 'G Wagon/4.png', project: 'g-wagon', rank: 7, description: 'Pearl white G-Wagon on a wet night street with city lights and purple underglow' },
  { id: 'gwagon-tall', src: 'G Wagon/vert2.png', project: 'g-wagon', rank: 23, description: 'Portrait view of a pearl white G-Wagon driving down a wet night street toward lit towers' },
  { id: 'pills', src: 'Pills.png', project: 'capsules', rank: 15, description: 'Glossy red, green and blue capsules on a mint background' },
  { id: 'syringe', src: 'Syringe.png', project: 'syringe', rank: 16, description: 'Syringe with a red tip floating on a mint-green gradient' },
  { id: 'the-view', src: 'R1.png', project: 'the-view', rank: 17, description: 'Living room with two paper lanterns and green armchairs looking out over the ocean at dusk' },
  { id: 'desk-setup', src: 'Devices2.png', project: 'desk-setup', rank: 19, description: 'Gaming desk with pink triangular wall lights and a monitor in magenta light' },
  { id: 'creature', src: 'Creature.png', project: 'creature', rank: 20, description: 'Blue Indian mythological creature with a gold crown against a green and blue backdrop' },
  { id: 'autoshop', src: '1.png', project: 'autoshop', rank: 21, description: 'Auto shop at night with two cars inside a brick interior under a lit sign' },
  { id: 'ice-cream', src: 'Ice cream.png', project: 'ice-cream', rank: 22, description: 'Two fuzzy purple ice cream cones tilted on a cream surface against a dark wall' },
  { id: 'solar-jupiter', src: 'Solar System3.png', project: 'solar-system', rank: 24, description: 'Jupiter filling the frame with Earth, Mars and other planets in front of it' },
  { id: 'controller', src: 'Controller.png', project: 'controller', rank: 25, description: 'Red game controller on black, lit from the side' },
];

// start and length are in seconds; portrait clips are scaled to 720x1280.
const VIDEOS = [
  { id: 'boat-film', src: 'Boat Rockerz/Final Cut.mp4', project: 'boat-rockerz', start: 9.5, length: 8, portrait: false, description: 'Boat Rockerz 460 film: macro passes ending on the three-colourway reveal' },
  // Hero loop: the opening turn only, centre-cropped square. Length 3.85 s keeps source frame 115 (3.833 s),
  // the frame closest to the opening front pose by blurred pixel difference. crf is fixed (396 KB, no banding).
  { id: 'boat-hero', src: 'Boat Rockerz/Final Cut.mp4', project: 'boat-rockerz', start: 0, length: 3.85, square: true, crf: 24, role: 'hero-loop', duration: 3.875, description: 'The headphones turn once and return to the front view' },
  { id: 'gwagon-reel', src: 'G Wagon/Reel.mp4', project: 'g-wagon', start: 3, length: 8, portrait: true, description: 'Short portrait film of the pearl white G-Wagon on a night street' },
  { id: 'wingman-film', src: 'Wingman/0001-0600.mp4', project: 'wingman', start: 12, length: 8, portrait: false, description: 'Short film of the Wingman model' },
  { id: 'solar-film', src: 'Solar System Animation0001-0450.mp4', project: 'solar-system', start: 4, length: 8, portrait: false, description: 'Short film of the solar system model' },
];

// Behance titles, dates and links from content/behance.md. Single-still
// projects use their working titles and have no Behance page.
const PROJECTS = [
  { id: 'boat-rockerz', title: 'Boat Rockerz 460', date: '2023-01', dateLabel: 'Jan 2023', behanceUrl: 'https://www.behance.net/gallery/161705745/Boat-Rockerz-460' },
  { id: 'g-wagon', title: 'Mercedes G Wagon', date: '2023-07', dateLabel: 'Jul 2023', behanceUrl: 'https://www.behance.net/gallery/175614965/Mercedes-G-Wagon' },
  { id: 'wingman', title: 'Wingman 3D model', date: '2022-11', dateLabel: 'Nov 2022', behanceUrl: 'https://www.behance.net/gallery/158204171/Wingman-3D-model' },
  { id: 'hot-wheels', title: 'Hottest Wheels', date: '2022-10', dateLabel: 'Oct 2022', behanceUrl: 'https://www.behance.net/gallery/155749489/Hottest-Wheels' },
  { id: 'autoshop', title: 'Autoshop', date: '2022-06', dateLabel: 'Jun 2022', behanceUrl: 'https://www.behance.net/gallery/148746081/Autoshop' },
  { id: 'the-view', title: 'The View', date: '2022-05', dateLabel: 'May 2022', behanceUrl: 'https://www.behance.net/gallery/142858139/The-View' },
  { id: 'solar-system', title: '3D Solar System', date: '2022-02', dateLabel: 'Feb 2022', behanceUrl: 'https://www.behance.net/gallery/138670283/3D-Solar-System' },
  { id: 'pokemon', title: 'Pokemon', date: '2022-01', dateLabel: 'Jan 2022', behanceUrl: null },
  { id: 'capsules', title: 'Capsules', date: '2022-02', dateLabel: 'Feb 2022', behanceUrl: null },
  { id: 'syringe', title: 'Syringe', date: '2022-02', dateLabel: 'Feb 2022', behanceUrl: null },
  { id: 'desk-setup', title: 'Desk Setup', date: '2022-02', dateLabel: 'Feb 2022', behanceUrl: null },
  { id: 'creature', title: 'Creature', date: '2022-02', dateLabel: 'Feb 2022', behanceUrl: null },
  { id: 'controller', title: 'Controller', date: '2022-03', dateLabel: 'Mar 2022', behanceUrl: null },
  { id: 'ice-cream', title: 'Fuzzy Ice Cream', date: '2022-03', dateLabel: 'Mar 2022', behanceUrl: null },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function relLuminance(r, g, b) {
  const lin = (c) => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Small deterministic PRNG (mulberry32) so k-means init is reproducible.
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Plain k-means on RGB triples (raw 0-255). Returns [{hex, weight}] sorted by weight.
function kmeans(data, k = 5, iters = 12, seed = 20260614) {
  const n = data.length / 3;
  const rnd = mulberry32(seed);
  const used = new Set();
  const cent = [];
  while (cent.length < k) {
    const i = Math.floor(rnd() * n);
    if (used.has(i)) continue;
    used.add(i);
    cent.push([data[i * 3], data[i * 3 + 1], data[i * 3 + 2]]);
  }

  const assignAll = (counts, sums) => {
    for (let i = 0; i < n; i++) {
      const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const dr = r - cent[c][0], dg = g - cent[c][1], db = b - cent[c][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) { bestD = d; best = c; }
      }
      if (counts) {
        counts[best]++;
        sums[best][0] += r; sums[best][1] += g; sums[best][2] += b;
      }
    }
  };

  for (let it = 0; it < iters; it++) {
    const counts = new Array(k).fill(0);
    const sums = Array.from({ length: k }, () => [0, 0, 0]);
    assignAll(counts, sums);
    for (let c = 0; c < k; c++) {
      if (counts[c]) cent[c] = sums[c].map((s) => s / counts[c]);
    }
  }

  const counts = new Array(k).fill(0);
  assignAll(counts, Array.from({ length: k }, () => [0, 0, 0]));
  const entries = cent.map((c, i) => ({ hex: toHex(c), weight: counts[i] / n }));
  entries.sort((a, b) => b.weight - a.weight);
  // Round to 3 decimals and push any rounding drift onto the largest entry.
  for (const e of entries) e.weight = Math.round(e.weight * 1000) / 1000;
  const drift = Math.round((1 - entries.reduce((s, e) => s + e.weight, 0)) * 1000) / 1000;
  entries[0].weight = Math.round((entries[0].weight + drift) * 1000) / 1000;
  return entries;
}

function orientationOf(ratio) {
  if (ratio > 1.2) return 'wide';
  if (ratio < 0.85) return 'portrait';
  return 'square';
}

// ---------------------------------------------------------------------------
// Stills
// ---------------------------------------------------------------------------

async function buildStill(s) {
  const input = await readFile(path.join(sourceDir, s.src));
  const meta = await sharp(input).metadata();
  const { width, height } = meta;
  const widths = WIDTHS.filter((w) => w <= width); // never upscale

  // Step quality down until the 480 variant is under 200 KB and the rest under 500 KB.
  let q = Q_START;
  let bufs;
  for (;;) {
    bufs = {};
    for (const w of widths) {
      bufs[w] = await sharp(input).rotate().resize({ width: w }).webp({ quality: q }).toBuffer();
    }
    const ok = widths.every((w) => bufs[w].length < (w === 480 ? LIMIT_480 : LIMIT_LARGE));
    if (ok || q - Q_STEP < Q_FLOOR) break;
    q -= Q_STEP;
  }
  const finalOk = widths.every((w) => bufs[w].length < (w === 480 ? LIMIT_480 : LIMIT_LARGE));
  if (!finalOk) console.warn(`WARN ${s.id}: size budget not met at quality ${q}`);

  const src = {};
  for (const w of widths) {
    const file = `${s.id}-${w}.webp`;
    await writeFile(path.join(IMG_DIR, file), bufs[w]);
    src[String(w)] = `art/img/${file}`;
  }

  // Low-quality placeholder.
  const lqipBuf = await sharp(input).rotate().resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
  const lqip = `data:image/webp;base64,${lqipBuf.toString('base64')}`;

  // Palette, mean colour and lightness from a 64px-wide raw RGB sample.
  const pipe = sharp(input).rotate().resize({ width: 64 });
  if (meta.hasAlpha) pipe.flatten({ background: '#ffffff' });
  const { data, info } = await pipe.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new Error(`${s.id}: expected 3 channels, got ${info.channels}`);
  const n = data.length / 3;
  let sr = 0, sg = 0, sb = 0, lum = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    sr += r; sg += g; sb += b;
    lum += relLuminance(r, g, b);
  }
  const palette = kmeans(data, 5);
  const mean = toHex([sr / n, sg / n, sb / n]);
  const lightness = Math.round((lum / n) * 1000) / 1000;

  const ratio = Math.round((width / height) * 10000) / 10000;
  const piece = {
    id: s.id,
    project: s.project,
    rank: s.rank,
    width,
    height,
    ratio,
    orientation: orientationOf(ratio),
    src,
    alt: `${s.description}.`,
    lqip,
    palette,
    mean,
    lightness,
  };
  console.log(`still ${s.id}: ${widths.join('/')} at q${q}, sizes ${widths.map((w) => bufs[w].length).join('/')} bytes, hasAlpha=${meta.hasAlpha}`);
  return piece;
}

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

async function buildVideo(v) {
  const srcPath = path.join(sourceDir, v.src);
  const out = path.join(VID_DIR, `${v.id}.mp4`);
  const [W, H] = v.square ? [720, 720] : v.portrait ? [720, 1280] : [1280, 720];
  let crf = v.crf || CRF_START;
  let bytes;
  for (;;) {
    await run(FFMPEG, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-ss', String(v.start), '-i', srcPath, '-t', String(v.length),
      '-an', '-r', '24', '-vf', v.square ? 'crop=1080:1080,scale=720:720' : `scale=${W}:${H}`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      out,
    ]);
    bytes = (await stat(out)).size;
    if (bytes < LIMIT_CLIP || crf + 2 > CRF_MAX) break;
    crf += 2;
  }
  if (bytes >= LIMIT_CLIP) console.warn(`WARN ${v.id}: still ${bytes} bytes at crf ${crf}`);

  if (v.role) {
    // Looping hero clips have no poster (the page's still is the poster).
    console.log(`video ${v.id}: ${W}x${H}, crf ${crf}, ${bytes} bytes (no poster)`);
    return { id: v.id, project: v.project, role: v.role, src: `art/video/${v.id}.mp4`, width: W, height: H, duration: v.duration, bytes, description: `${v.description}.`, _crf: crf };
  }

  // Poster: the frame 60% through the trimmed clip, as WebP at the clip's pixel size.
  const t = (v.length * 0.6).toFixed(3);
  const { stdout } = await run(FFMPEG, [
    '-hide_banner', '-loglevel', 'error',
    '-ss', t, '-i', out, '-frames:v', '1',
    '-f', 'image2pipe', '-c:v', 'png', 'pipe:1',
  ], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  let q = 80;
  let poster;
  for (;;) {
    poster = await sharp(stdout).webp({ quality: q }).toBuffer();
    if (poster.length < LIMIT_POSTER || q - Q_STEP < Q_FLOOR) break;
    q -= Q_STEP;
  }
  const posterMeta = await sharp(poster).metadata();
  if (posterMeta.width !== W || posterMeta.height !== H) throw new Error(`${v.id}: poster size mismatch`);
  await writeFile(path.join(VID_DIR, `${v.id}-poster.webp`), poster);

  console.log(`video ${v.id}: ${W}x${H}, crf ${crf}, ${bytes} bytes, poster q${q} ${poster.length} bytes`);
  return {
    id: v.id,
    project: v.project,
    src: `art/video/${v.id}.mp4`,
    poster: `art/video/${v.id}-poster.webp`,
    width: W,
    height: H,
    duration: v.length,
    bytes,
    description: `${v.description}.`,
    _crf: crf,
    _posterQuality: q,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await mkdir(IMG_DIR, { recursive: true });
  await mkdir(VID_DIR, { recursive: true });

  const pieces = [];
  for (const s of STILLS) pieces.push(await buildStill(s));
  pieces.sort((a, b) => a.rank - b.rank);

  const videos = [];
  for (const v of VIDEOS) videos.push(await buildVideo(v));

  await copyFile(
    path.join(ROOT, 'public', 'Resume_Reuben_Chatterjee_DS.pdf'),
    path.join(SITE, 'Resume_Reuben_Chatterjee_DS.pdf'),
  );

  const projects = PROJECTS.map((p) => {
    const projPieces = pieces.filter((pc) => pc.project === p.id).map((pc) => pc.id);
    const video = videos.find((v) => v.project === p.id) || null;
    return {
      id: p.id,
      title: p.title,
      date: p.date,
      dateLabel: p.dateLabel,
      tools: video ? ['Blender', 'Adobe Premiere Pro'] : ['Blender'],
      behanceUrl: p.behanceUrl,
      canLead: projPieces.length > 1,
      pieces: projPieces,
      video: video ? video.id : null,
    };
  });

  // Every piece and video must belong to a listed project.
  for (const pc of pieces) {
    if (!PROJECTS.some((p) => p.id === pc.project)) throw new Error(`unknown project for ${pc.id}`);
  }

  const cleanVideos = videos.map(({ _crf, _posterQuality, ...rest }) => rest);
  const manifest = { disclaimer: DISCLAIMER, projects, pieces, videos: cleanVideos };
  await writeFile(path.join(SITE, 'art', 'projects.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log('crf per clip:', videos.map((v) => `${v.id}=${v._crf}`).join(' '));
  console.log('poster quality per clip:', videos.map((v) => `${v.id}=${v._posterQuality}`).join(' '));
  console.log(`wrote ${pieces.length} pieces, ${videos.length} videos, ${projects.length} projects`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
