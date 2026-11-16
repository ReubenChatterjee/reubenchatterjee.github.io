#!/usr/bin/env python3
"""Subsets the two site fonts to the characters the site uses (task 17b).

  python3 tools/subset-fonts.py           write site/fonts/*.woff2 from tools/font-src/*.woff2
  python3 tools/subset-fonts.py --check   fail unless every character used in the built site is in the shipped fonts

Needs fonttools and brotli (pip install fonttools brotli). Characters come from site/index.html, site/work/work.json,
site/art/projects.json, site/art/embedding.json, site/js/*.js and site/css/*.css (all of ASCII 32-126 and nbsp are always kept).
Run `node tools/build-site.mjs` first. The font's own head/hhea bounding boxes are kept (not recalculated) and glyph names are kept on purpose: without them the 'post' table changes and Chromium and WebKit render a few glyphs one pixel apart at 1x (measured). Full fonts stay in tools/font-src/ so a new character can be added by re-running this.
"""
import glob, html, os, re, sys
from fontTools.ttLib import TTFont
from fontTools import subset

root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
files = [f'{root}/site/index.html', f'{root}/site/work/work.json', f'{root}/site/art/projects.json', f'{root}/site/art/embedding.json'] \
    + sorted(glob.glob(f'{root}/site/js/*.js')) + sorted(glob.glob(f'{root}/site/css/*.css'))
chars = set()
for f in files:
    t = open(f, encoding='utf8').read()
    chars |= set(t) | set(html.unescape(t))
    chars |= {chr(int(m, 16)) for m in re.findall(r'\\u([0-9a-fA-F]{4})', t)}
chars |= {chr(i) for i in range(32, 127)} | {' '}
chars -= {'\n', '\r', '\t'}
FONTS = ['instrument-sans', 'bricolage-wdth']

if '--check' in sys.argv:
    bad = 0
    for n in FONTS:
        cmap = TTFont(f'{root}/site/fonts/{n}.woff2').getBestCmap()
        miss = sorted(c for c in chars if ord(c) not in cmap)
        print(n, 'used characters', len(chars), 'in font cmap', len(cmap), 'missing', [hex(ord(c)) for c in miss] or 'none')
        bad += len(miss)
    sys.exit(1 if bad else 0)

for n in FONTS:
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.notdef_outline = True; opts.glyph_names = True; opts.recalc_bounds = False; opts.recalc_timestamp = False; opts.recalc_max_context = False; opts.name_IDs = ['*']
    font = TTFont(f'{root}/tools/font-src/{n}.woff2', recalcBBoxes=False, recalcTimestamp=False)
    s = subset.Subsetter(opts); s.populate(text=''.join(sorted(chars))); s.subset(font)
    font.flavor = 'woff2'; font.save(f'{root}/site/fonts/{n}.woff2')
    print('wrote', n, os.path.getsize(f'{root}/site/fonts/{n}.woff2'), 'bytes')
