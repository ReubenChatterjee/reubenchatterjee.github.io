# Tools

Node scripts for the portfolio proofs. Dependencies live in `tools/` (run `npm install` here once).

## build-assets.mjs

Builds the shared assets in `site/art/` from the source folder. It reads only the files listed in its `STILLS` and `VIDEOS` tables.

```bash
node tools/build-assets.mjs "<sourceDir>"
```

Outputs:
- `site/art/img/<id>-<480|960|1600>.webp` (WebP, quality starts at 78 and steps down by 6 until the size budget is met)
- `site/art/video/<id>.mp4` (H.264, no audio, 24 fps) and `site/art/video/<id>-poster.webp`
- `site/Resume_Reuben_Chatterjee_DS.pdf` (copied from `public/`)
- `site/art/projects.json` (manifest: projects, pieces, videos)

Needs `ffmpeg` and `ffprobe`. The default path is `/opt/homebrew/bin/ffmpeg`; override with `FFMPEG=/path/to/ffmpeg`.

## build-site.mjs

Assembles the page from `site-src/` into `site/`. No dependencies beyond Node. Never edit `site/index.html`, `site/css/site.css` or `site/js/site.js` by hand.

```bash
node tools/build-site.mjs           # write the built files
node tools/build-site.mjs --check   # exit 1 if the committed output differs from a fresh build
```

- `site-src/sections/NN-name.html` -> `site/index.html` (filename order; HTML comments and indentation are stripped). `00-head` opens the document, `09-rooms-open` and `91-rooms-close` wrap the rooms, `99-foot` closes it.
- `site-src/css/NN-name.css` -> `site/css/site.css`; `00-tokens.css` holds the colour worlds (`[data-world="..."]`), type, spacing, radii and easing tokens.
- `site-src/js/NN-name.js` -> `site/js/site.js`, all files in one shared scope inside one IIFE. `00-core.js` defines `rooms`, `onActive`, `onMode`, `follow()`, `bindNav()`, `each()`; `99-start.js` calls `start()` last.
- `site-src/js/lazy/*.js` (optional) are copied to `site/js/` unchanged, for scripts loaded on demand.
- `site-src/css/lazy/*.css` (optional) are minified like the main sheet and written to `site/css/<name>.css`, for stylesheets loaded on demand. `lazy/map.css` holds the colour map and its detail panel; `71-map.css` keeps only the section head and the plain list. `71-map-loader.js` adds `css/map.css` right after first paint and adds `js/map.js` only once the sheet has loaded.

A room is a `<section class="room" id="..." data-room data-world="name" ...>` partial. Order of filenames is the order of rooms. The build writes the rail from each room's `data-rail-label`, `data-rail-src` + `data-rail-ratio` (thumbnail) or `data-rail-text` (chip); `data-side="on"` marks the data science side for the header switch. The wipe, rail and header read the rooms from the DOM, so a new room partial needs no JS edit. The world must exist in `00-tokens.css`.

### render-work.mjs (used by build-site.mjs)

Renders the "On the clock" section from `site/work/work.json`. The partial `94z-on-the-clock.html` holds the `<section>` wrapper and the placeholder `<!--@on-the-clock-->`; `build-site.mjs` replaces it with `renderWork(work)` and then runs `verifyWork`, which fails the build unless every text node, image alt and link in the section equals, in order, a `work.json` value or one of the few design labels listed at the top of `render-work.mjs`. Non-room sections (outside `.rooms`, inside `<main>`) get a rail chip in `.rail__chips` when they carry `data-rail-text` and an `id` (the map, the story and On the clock do), so a chip exists only when its section does.

### Loading order (task 17)

The hero still is the LCP element, so anything that does not paint the first screen starts after the browser reports the largest contentful paint (inline script in `99-foot.html`; 3 s fallback):
- `js/site.js` is added by that script instead of `<script defer>`; `00-core.js` copes with the page already being loaded.
- Video posters are written as `data-poster` and set by that script. Use `data-poster`, not `poster`, on every new `<video>`; an eager `poster` is fetched during first paint.
- Rail thumbnails are `<stem>-rail.webp` (102 px tall, 1 to 3 KB), written by `node tools/build-rail.mjs` from each room's `data-rail-src`. Run it when a room is added or its still changes; `build-site.mjs` links to the files but does not create them.
- `site/css/site.css` is written with whitespace and comments stripped.

### Fonts (task 17b)

`site/fonts/*.woff2` are subsets of the full fonts in `tools/font-src/`, cut to the characters the built site uses (ASCII plus a few typographic marks, 101 in all). After adding text with a new character, run `node tools/build-site.mjs`, then `python3 tools/subset-fonts.py` (needs `pip install fonttools brotli`), and `python3 tools/subset-fonts.py --check` to prove every used character is in both fonts. Do not change its options lightly: keeping the glyph names and the fonts' own head/hhea bounds is what keeps rendering pixel-identical.

## shoot.mjs

Captures page images at 393x660 (3x, the visible area of a real phone with browser bars), 390x844 (2x) and 1440x900 (1x) using the system Chrome.

```bash
node tools/shoot.mjs <url> <outDir> [--reduced-motion]
```

For each viewport it saves:
- `<w>-top.png`: the first screen, after network idle and 1.5 s.
- `<w>-<data-shot>.png`: for each element with a `data-shot` attribute, the viewport after scrolling that element to the top (1.2 s wait). Values are sanitised for filenames.
- `<w>-full.png`: the full page.

`--reduced-motion` emulates `prefers-reduced-motion: reduce` and adds the `-rm` suffix to every file.

Chrome path defaults to `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; override with `CHROME_PATH`. The page must already be served (for example `python3 -m http.server 8080 -d site`).

The build fails if page text uses a character that is not in `tools/font-src/chars.txt` (the characters the subset fonts were cut for). After re-running `subset-fonts.py`, refresh that list with `node tools/build-site.mjs --font-chars`.

## browser-check.mjs

Cross-engine check (Playwright WebKit, Firefox, Chromium). Serve `site/` first (`python3 -m http.server 4215 -d site`), then `node tools/browser-check.mjs --out <results> --shots <shots>` (both outside the repo); `--summary --out <results>` prints tables. WebKit here is Safari's engine, not Safari.

## audit.mjs and overflow-check.mjs (task 16, final audit)

Scripted, read-only checks; they measure and report and never edit site code. Serve `site/` on a spare port first (`python3 -m http.server 4216 -d site`), keep `--out` and `--shots` outside the repo, and run `npm ci` here once. Lighthouse is run by hand (`npx lighthouse http://localhost:4216/ [--preset=desktop]`, three runs, median). The axe check needs `@axe-core/playwright`, installed outside the repo: `npm i @axe-core/playwright` in a scratch folder and pass `--axe-from <folder>`.

```bash
node tools/audit.mjs <check> --out <dir> [--shots <dir>] [--base http://localhost:4216/] [--axe-from <dir>]
# checks: links  excluded  content  build  perf  contrast  a11y  keys  hidden   (all = the first six that need no extra install)
node tools/overflow-check.mjs --out <dir> [--shots <dir>]    # WebKit, Chromium, Firefox x 360/390/393/412 x images normal/blocked/delayed x top and /#on-the-clock
```

- `links`: every href, src, srcset, poster, CSS `url()`, JS-referenced path, manifest and `work.json` image resolves to a file; external links get a HEAD then GET status (LinkedIn answers 999 to bots and is reported as "could not verify"); the resume downloads; contact and profile URLs are compared with `plan/shared-brief.md` (read from the main checkout, `PORTFOLIO_MAIN`).
- `excluded`: the excluded-work terms in the tree, in every commit message, in every blob (text and binary) and in every filename of the local art and task branches; blobs over 2 MB; image sizes the art branches add beyond `main`/`v2-apple`; `Blender/`, `curation/`, `plan/`, `content/` untracked at the tip; no attribution lines in commit messages.
- `content`: `work.json` against the old-site source (`build-work.mjs --verify`), rendered On the clock text, manifest dates and tools against `content/behance.md`, every row of copy-review section 8, room labels, title, disclaimer, alt text, and where the former employer's name and title appear.
- `build`: a fresh local clone of `art-design-a`, `build-site.mjs --check` in it, and the read-only deploy listing from `plan/deploy.md`. The scratch clone is removed afterwards. It never runs `gh-pages`, `git push` or `git fetch`.
- `perf`: design brief section 13 line by line, requests before and after first paint, first-load bytes (raw, gzip noted), CLS over a full scroll, lazy loading of sections 06 to 09, the hero loop request.
- `contrast`, `a11y`, `keys`, `hidden`: contrast from the tokens (header, rail and mid-wipe included) and from computed colours of every text element; axe in every colour world with the lightbox and map panel open; a recorded keyboard walk-through; interactive elements under the header or rail (WebKit, 393x660).

## build-story-curve.mjs

Redraws the story curve for however many dots `site-src/sections/94-story.html` holds (paths, dot positions, phone lane height, label grid columns). Run it after adding or removing a dot, then `node tools/build-site.mjs`.
