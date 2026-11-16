#!/usr/bin/env node
// Builds site/work/work.json and site/work/img/* for the "On the clock" section.
//
// Every string and number is extracted from the React sources by parsing them
// with @babel/parser. Nothing is retyped. A verification pass then re-reads
// work.json and checks each string against the source file it came from.
//
//   node tools/build-work.mjs            build the assets, then verify
//   node tools/build-work.mjs --verify   verify an existing site/work/work.json only
//
// Whitespace rule: non-bio strings must appear byte-for-byte in their source
// file. Bio strings are JSX text that wraps across lines, so the bio block of
// the source is whitespace-normalised first (every run of \s+ becomes one
// space, then the result is trimmed). Paragraph and role text is normalised the
// same way before comparison.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import sharp from 'sharp';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, '..');
const SITE = path.join(ROOT, 'site');
const OUT_DIR = path.join(SITE, 'work');
const IMG_DIR = path.join(OUT_DIR, 'img');
const WORK_JSON = path.join(OUT_DIR, 'work.json');
const PUBLIC = path.join(ROOT, 'public');

const SRC = {
  projects: path.join(ROOT, 'src/components/ProjectsSection/ProjectsSection.js'),
  experience: path.join(ROOT, 'src/components/ExperienceSection/ExperienceSection.js'),
  about: path.join(ROOT, 'src/components/AboutSection/AboutSection.js'),
};

// Copy edits approved by the owner. Each one replaces the extracted text at its
// locator with `to`. The verifier still checks that `from` is in the source
// (so a later source edit is noticed) and that work.json holds exactly `to`.
const APPROVED_EXCEPTIONS = [
  {
    locator: 'bio.paragraphs[1]',
    from: 'Currently on the AI/ML team at Applied Materials, architecting solutions for Computer Vision problems, training custom object detection models (RT-DETR, YOLO etc.), and designing OCR pipelines with vision-language models (GLM, Qwen VL, Paddle, Gemini etc.)',
    to: 'Currently on the AI/ML team at Applied Materials, architecting solutions for Computer Vision problems, training custom object detection models (RT-DETR, YOLO etc.), and designing OCR pipelines with vision-language models (GLM, Qwen VL, Paddle, Gemini etc.).',
    note: 'Approved by Reuben, 2026-11-14',
  },
  {
    locator: 'bio.paragraphs[2]',
    from: 'Previously at Alcamo Marketing, where I cut infrastructure costs by 60% and built a churn model identifying $2.1M in at-risk revenue.',
    to: 'Previously at Alcamo Marketing, where I cut infrastructure costs by 60%. I also built a churn model that identified $2.1M in at-risk revenue.',
    note: 'Approved by Reuben, 2026-11-14',
  },
];

// Fields left out on purpose. Approved by Reuben, 2026-11-15: the Gender & Group Dynamics repository is private
// (it holds student data), so the card carries no GitHub link, no chip and no replacement label.
const APPROVED_REMOVALS = [{ id: 'gender', field: 'github' }];
const dropRemoved = (p) => { for (const r of APPROVED_REMOVALS) if (p.id === r.id) delete p[r.field]; return p; };

const PROJECT_WIDTHS = [480, 960];
const HEADSHOT_WIDTHS = [160, 320];
const BUDGET_THUMB = 200 * 1024; // any 480-wide variant
const BUDGET_ALL = 500 * 1024;   // every variant

const normalise = (s) => s.replace(/\s+/g, ' ').trim();

// ---------- AST helpers ----------

const readSource = (file) => fs.readFileSync(file, 'utf8');

const parseFile = (file, text) =>
  parse(text, { sourceType: 'module', plugins: ['jsx'] });

function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  if (visit(node) === false) return;
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'extra') continue;
    const v = node[key];
    if (Array.isArray(v)) v.forEach((c) => walk(c, visit));
    else if (v && typeof v.type === 'string') walk(v, visit);
  }
}

// Find `const NAME = <expr>` and return the init node.
function findConst(ast, name) {
  let found = null;
  walk(ast.program, (n) => {
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === name) {
      found = n.init;
      return false;
    }
  });
  if (!found) throw new Error(`const ${name} not found`);
  return found;
}

// Evaluate a literal-only expression (objects, arrays, strings, numbers, booleans).
function evalLiteral(node, file) {
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value;
    case 'UnaryExpression':
      if (node.operator === '-' && node.argument.type === 'NumericLiteral') return -node.argument.value;
      break;
    case 'ArrayExpression':
      return node.elements.map((e) => evalLiteral(e, file));
    case 'ObjectExpression': {
      const out = {};
      for (const p of node.properties) {
        if (p.type !== 'ObjectProperty') throw new Error(`${file}: unsupported property ${p.type}`);
        const key = p.key.type === 'Identifier' ? p.key.name : p.key.value;
        out[key] = evalLiteral(p.value, file);
      }
      return out;
    }
    case 'TemplateLiteral':
      if (node.expressions.length === 0) return node.quasis[0].value.cooked;
      break;
  }
  throw new Error(`${file}: unsupported literal node ${node.type} at offset ${node.start}`);
}

// Text a JSX element shows: JSXText, nested elements, and {'literal'} expressions.
function jsxText(node, file) {
  if (node.type === 'JSXText') {
    const raw = node.extra?.raw ?? node.value;
    if (raw.includes('&')) throw new Error(`${file}: HTML entity in JSX text: ${raw}`);
    return node.value;
  }
  if (node.type === 'JSXExpressionContainer') {
    if (node.expression.type === 'StringLiteral') return node.expression.value;
    throw new Error(`${file}: non-literal JSX expression at offset ${node.start}`);
  }
  if (node.type === 'JSXElement') return node.children.map((c) => jsxText(c, file)).join('');
  throw new Error(`${file}: unsupported JSX child ${node.type}`);
}

function jsxClassName(el) {
  const attr = el.openingElement.attributes.find((a) => a.name?.name === 'className');
  return attr ? attr.value.value : null;
}

function findJsxByClass(ast, className) {
  let found = null;
  walk(ast.program, (n) => {
    if (n.type === 'JSXElement' && jsxClassName(n) === className) {
      found = n;
      return false;
    }
  });
  if (!found) throw new Error(`JSX element with className "${className}" not found`);
  return found;
}

function jsxAttr(el, name) {
  const attr = el.openingElement.attributes.find((a) => a.name?.name === name);
  return attr ? attr.value.value : undefined;
}

// ---------- image pipeline ----------

const imageFile = (src) => path.join(PUBLIC, src.replace(/^\//, ''));

async function encodeVariant(srcFile, width, maxBytes) {
  let last = null;
  for (let q = 82; q >= 50; q -= 6) {
    const buf = await sharp(srcFile)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: q })
      .toBuffer();
    last = buf;
    if (buf.length <= maxBytes) return { buf, quality: q };
  }
  throw new Error(`${srcFile} at ${width}px exceeds ${maxBytes} bytes even at q50 (${last.length})`);
}

async function buildImage({ srcPath, id, widths, alt, thumbWidth }) {
  const file = imageFile(srcPath);
  if (!fs.existsSync(file)) throw new Error(`missing source image ${file}`);
  const meta = await sharp(file).metadata();
  const usable = widths.filter((w) => w <= meta.width); // never upscale
  if (usable.length === 0) throw new Error(`${srcPath} is narrower than every target width`);

  const variants = [];
  for (const w of usable) {
    const maxBytes = w === thumbWidth ? BUDGET_THUMB : BUDGET_ALL;
    const { buf } = await encodeVariant(file, w, maxBytes);
    const out = `${id}-${w}.webp`;
    await fsp.writeFile(path.join(IMG_DIR, out), buf);
    const vm = await sharp(buf).metadata();
    variants.push({ w, file: out, width: vm.width, height: vm.height, bytes: buf.length });
  }

  const tiny = await sharp(file).resize({ width: 24, withoutEnlargement: true }).webp({ quality: 40 }).toBuffer();
  const lqip = `data:image/webp;base64,${tiny.toString('base64')}`;
  const largest = variants[variants.length - 1];

  return {
    alt,
    src: `work/img/${largest.file}`,
    srcset: variants.map((v) => `work/img/${v.file} ${v.w}w`).join(', '),
    width: largest.width,
    height: largest.height,
    lqip,
    // Kept for the build log only; stripped from work.json below.
    _variants: variants,
  };
}

// ---------- extraction ----------

function extract() {
  const pSrc = readSource(SRC.projects);
  const eSrc = readSource(SRC.experience);
  const aSrc = readSource(SRC.about);
  const pAst = parseFile(SRC.projects, pSrc);
  const eAst = parseFile(SRC.experience, eSrc);
  const aAst = parseFile(SRC.about, aSrc);

  const featured = evalLiteral(findConst(pAst, 'HERO_PROJECT'), 'ProjectsSection.js');
  const projects = evalLiteral(findConst(pAst, 'PROJECTS'), 'ProjectsSection.js');
  const experience = evalLiteral(findConst(eAst, 'EXPERIENCES'), 'ExperienceSection.js');
  const stats = evalLiteral(findConst(aAst, 'STATS'), 'AboutSection.js');

  // Bio: name, role line, headshot, paragraphs in document order.
  const name = normalise(jsxText(findJsxByClass(aAst, 'apple-bio-name'), 'AboutSection.js'));
  const roleEl = findJsxByClass(aAst, 'apple-bio-role');
  const role = normalise(jsxText(roleEl, 'AboutSection.js'));

  const avatar = findJsxByClass(aAst, 'apple-bio-avatar');
  const img = avatar.children.find((c) => c.type === 'JSXElement' && c.openingElement.name.name === 'img');
  const headshot = { src: jsxAttr(img, 'src'), alt: jsxAttr(img, 'alt') };

  const bodyEl = findJsxByClass(aAst, 'apple-bio-body');
  const paragraphs = bodyEl.children
    .filter((c) => c.type === 'JSXElement' && c.openingElement.name.name === 'p')
    .map((p) => normalise(jsxText(p, 'AboutSection.js')));

  return {
    sources: { pSrc, eSrc, aSrc },
    featured, projects, experience, stats,
    bio: { name, role, headshot, paragraphs },
  };
}

// Apply approved copy edits to the extracted paragraphs. `from` must match the
// extracted text exactly, otherwise the build stops.
function applyExceptions(paragraphs) {
  return paragraphs.map((p, i) => {
    const exc = APPROVED_EXCEPTIONS.find((e) => e.locator === `bio.paragraphs[${i}]`);
    if (!exc) return p;
    if (p !== exc.from) throw new Error(`${exc.locator}: extracted text does not equal the approved from-text`);
    return exc.to;
  });
}

// ---------- build ----------

async function build() {
  const ex = extract();

  await fsp.rm(IMG_DIR, { recursive: true, force: true });
  await fsp.mkdir(IMG_DIR, { recursive: true });

  const withImage = async (project, widths) => {
    const alt = `${project.title} project image`;
    const image = await buildImage({
      srcPath: project.image, id: project.id, widths, alt, thumbWidth: 480,
    });
    const { _variants, ...rest } = image;
    return { ...project, image: rest, _variants };
  };

  const featured = await withImage(ex.featured, PROJECT_WIDTHS);
  const projects = [];
  for (const p of ex.projects) projects.push(await withImage(dropRemoved(p), PROJECT_WIDTHS));

  const headshotShot = await buildImage({
    srcPath: ex.bio.headshot.src,
    id: 'headshot',
    widths: HEADSHOT_WIDTHS,
    alt: ex.bio.headshot.alt,
    thumbWidth: 160,
  });
  const { _variants: hv, ...headshotOut } = headshotShot;

  const strip = (p) => {
    const { _variants, ...rest } = p;
    return rest;
  };

  const out = {
    bio: { name: ex.bio.name, role: ex.bio.role, paragraphs: applyExceptions(ex.bio.paragraphs), headshot: headshotOut },
    stats: ex.stats,
    featured: strip(featured),
    projects: projects.map(strip),
    experience: ex.experience,
  };
  await fsp.writeFile(WORK_JSON, JSON.stringify(out, null, 2) + '\n');

  const variantLog = [featured, ...projects].flatMap((p) => p._variants.map((v) => ({ id: p.id, ...v })));
  variantLog.push(...hv.map((v) => ({ id: 'headshot', ...v })));
  return variantLog;
}

// ---------- verification ----------

// Collect every string leaf of work.json with a dotted path, skipping the
// fields that are generated rather than copied (image paths, lqip, alt text
// for projects, and the srcset string).
function stringLeaves(obj, prefix = '') {
  const out = [];
  if (typeof obj === 'string') {
    out.push({ path: prefix, value: obj });
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => out.push(...stringLeaves(v, `${prefix}[${i}]`)));
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (['src', 'srcset', 'lqip'].includes(k)) continue;
      if (k === 'alt' && (prefix.startsWith('projects') || prefix.startsWith('featured'))) continue;
      out.push(...stringLeaves(v, prefix ? `${prefix}.${k}` : k));
    }
  }
  return out;
}

function verify() {
  const failures = [];
  const fail = (msg) => failures.push(msg);

  const work = JSON.parse(fs.readFileSync(WORK_JSON, 'utf8'));

  const pSrc = readSource(SRC.projects);
  const eSrc = readSource(SRC.experience);
  const aSrc = readSource(SRC.about);

  // Bio block of the source, whitespace-normalised once.
  const bioStart = aSrc.indexOf('apple-bio-body');
  const bioEnd = aSrc.indexOf('</div>', bioStart);
  const bioBlock = normalise(aSrc.slice(bioStart, bioEnd).replace(/<[^>]+>/g, ' '));
  const bioHeader = aSrc.slice(aSrc.indexOf('apple-bio-id'), aSrc.indexOf('apple-bio-body'));
  const headerNorm = normalise(bioHeader.replace(/<[^>]+>/g, ' '));

  const sourceFor = (p) => {
    if (p === 'bio.headshot.alt') return { label: 'AboutSection.js', raw: aSrc };
    if (p.startsWith('bio.')) return { label: 'AboutSection.js', raw: aSrc, bio: true };
    if (p.startsWith('stats')) return { label: 'AboutSection.js', raw: aSrc };
    if (p.startsWith('experience')) return { label: 'ExperienceSection.js', raw: eSrc };
    return { label: 'ProjectsSection.js', raw: pSrc };
  };

  let checked = 0;
  let passed = 0;
  const leaves = stringLeaves(work);
  for (const { path: p, value } of leaves) {
    const exc = APPROVED_EXCEPTIONS.find((e) => e.locator === p);
    if (exc) {
      // Approved exception: work.json must hold `to`, and `from` must still be in the source.
      checked += 2;
      if (value === exc.to) passed++;
      else fail(`exception ${p}: work.json does not contain the approved to-text`);
      if (bioBlock.includes(exc.from)) passed++;
      else fail(`exception ${p}: source no longer contains the approved from-text`);
      continue;
    }
    checked++;
    const src = sourceFor(p);
    let ok;
    if (src.bio) {
      // Name is checked against the header; paragraphs against the bio body.
      const haystack = p.startsWith('bio.name') || p.startsWith('bio.role') ? headerNorm : bioBlock;
      ok = haystack.includes(value);
    } else {
      ok = src.raw.includes(value);
    }
    if (ok) passed++;
    else fail(`verbatim: ${p} = ${JSON.stringify(value)} not found in ${src.label}`);
  }

  // Project alt text follows the rule, not the source.
  const altRule = (p) => {
    const want = `${p.title} project image`;
    if (p.image.alt !== want) fail(`alt rule: ${p.id} alt is ${JSON.stringify(p.image.alt)}`);
    checked++;
    if (p.image.alt === want) passed++;
  };
  altRule(work.featured);
  work.projects.forEach(altRule);

  // Bio paragraphs appear in source order.
  let last = -1;
  work.bio.paragraphs.forEach((para, i) => {
    const exc = APPROVED_EXCEPTIONS.find((e) => e.locator === `bio.paragraphs[${i}]`);
    const srcText = exc ? exc.from : para;
    const at = bioBlock.indexOf(srcText);
    if (at <= last) fail(`bio paragraph order broken at: ${srcText.slice(0, 40)}`);
    last = at;
  });

  // Experience: exactly five entries in source order.
  if (work.experience.length !== 5) fail(`experience has ${work.experience.length} entries, want 5`);
  let lastExp = -1;
  for (const e of work.experience) {
    const at = eSrc.indexOf(`company: '${e.company}'`) >= 0 ? eSrc.indexOf(`company: '${e.company}'`) : eSrc.indexOf(`company: "${e.company}"`);
    if (at <= lastExp) fail(`experience order broken at ${e.id}`);
    lastExp = at;
  }

  // Counts.
  if (work.stats.length !== 4) fail(`stats has ${work.stats.length}, want 4`);
  for (const r of APPROVED_REMOVALS) if (work.projects.some((p) => p.id === r.id && r.field in p)) fail(`${r.id}.${r.field} must stay removed (approved removal)`);
  if (work.projects.length !== 5) fail(`projects has ${work.projects.length}, want 5 (plus featured = 6 cards)`);
  if (!work.featured) fail('featured missing');

  // Images: exist, sizes, dimensions.
  const images = [
    ['featured', work.featured.image],
    ...work.projects.map((p) => [p.id, p.image]),
    ['headshot', work.bio.headshot],
  ];
  const sizeLog = [];
  for (const [id, img] of images) {
    for (const entry of img.srcset.split(', ')) {
      const [rel, desc] = entry.split(' ');
      const f = path.join(SITE, rel);
      if (!fs.existsSync(f)) { fail(`missing image ${rel}`); continue; }
      const bytes = fs.statSync(f).size;
      sizeLog.push({ id, rel, bytes });
      if (bytes > BUDGET_ALL) fail(`${rel} is ${bytes} bytes, over 500 KB`);
      if (desc === '480w' && bytes > BUDGET_THUMB) fail(`${rel} is ${bytes} bytes, over 200 KB`);
    }
    if (!fs.existsSync(path.join(SITE, img.src))) fail(`missing src ${img.src}`);
    if (!img.lqip.startsWith('data:image/webp;base64,')) fail(`bad lqip for ${id}`);
  }

  for (const [id, img] of images) {
    if (!img.width || !img.height) fail(`missing width/height for ${id}`);
  }

  return { checked, passed, failures, sizeLog, work };
}

// ---------- main ----------

const verifyOnly = process.argv.includes('--verify');

(async () => {
  if (!verifyOnly) {
    const variants = await build();
    console.log('built variants:');
    for (const v of variants) console.log(`  ${v.file}  ${v.width}x${v.height}  ${v.bytes} B`);
  }
  const { checked, passed, failures, sizeLog } = verify();
  console.log(`verbatim/rule checks: ${passed}/${checked} passed`);
  console.log(`approved exceptions applied: ${APPROVED_EXCEPTIONS.length}`);
  for (const e of APPROVED_EXCEPTIONS) {
    console.log(`  ${e.locator} (${e.note})`);
    console.log(`    from: ${JSON.stringify(e.from)}`);
    console.log(`    to:   ${JSON.stringify(e.to)}`);
  }
  console.log('image files:');
  for (const s of sizeLog) console.log(`  ${s.rel}  ${s.bytes} B`);
  if (failures.length) {
    console.error(`\n${failures.length} FAILURE(S):`);
    for (const f of failures) console.error('  ' + f);
    process.exit(1);
  }
  console.log('all checks passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
