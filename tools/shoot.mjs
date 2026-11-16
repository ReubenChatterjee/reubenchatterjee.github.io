#!/usr/bin/env node
// Captures screenshots of a page at two viewports (see tools/README.md).
//
// Usage: node tools/shoot.mjs <url> <outDir> [--reduced-motion]

import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const VIEWPORTS = [
  { name: '393x660', width: 393, height: 660, deviceScaleFactor: 3 },
  { name: '390', width: 390, height: 844, deviceScaleFactor: 2 },
  { name: '1440', width: 1440, height: 900, deviceScaleFactor: 1 },
];

const args = process.argv.slice(2);
const reducedMotion = args.includes('--reduced-motion');
const positional = args.filter((a) => !a.startsWith('--'));
const [url, outDir] = positional;

if (!url || !outDir) {
  console.error('Usage: node tools/shoot.mjs <url> <outDir> [--reduced-motion]');
  process.exit(1);
}

const suffix = reducedMotion ? '-rm' : '';
// Keep data-shot values safe for filenames.
const safe = (v) => v.replace(/[^a-zA-Z0-9_-]+/g, '-');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function shootViewport(browser, vp) {
  const page = await browser.newPage();
  await page.setViewport({
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: vp.deviceScaleFactor,
  });
  if (reducedMotion) {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  }

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await wait(1500);

  const topFile = path.join(outDir, `${vp.name}-top${suffix}.png`);
  await page.screenshot({ path: topFile });
  console.log('saved', topFile);

  const handles = await page.$$('[data-shot]');
  for (const handle of handles) {
    const value = await handle.evaluate((el) => el.getAttribute('data-shot'));
    await handle.evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await wait(1200);
    const file = path.join(outDir, `${vp.name}-${safe(value)}${suffix}.png`);
    await page.screenshot({ path: file });
    console.log('saved', file);
  }

  const fullFile = path.join(outDir, `${vp.name}-full${suffix}.png`);
  await page.screenshot({ path: fullFile, fullPage: true });
  console.log('saved', fullFile);

  await page.close();
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox'],
    defaultViewport: null,
  });
  try {
    for (const vp of VIEWPORTS) {
      await shootViewport(browser, vp);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
