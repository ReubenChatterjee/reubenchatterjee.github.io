// Renders the "On the clock" section content from site/work/work.json and checks the result against it.
// Used by build-site.mjs at build time: the partial site-src/sections/94z-on-the-clock.html holds the section wrapper and the
// placeholder <!--@on-the-clock-->, which is replaced by renderWork(work). Nothing from work.json is retyped anywhere else.
//
// verifyWork(sectionHtml, work) is the build-time check: every text node in the rendered section must be, in order, either a string
// taken from work.json or one of the LABELS below (the few labels this design adds). A reworded, dropped, added or reordered string
// throws and fails the build. Image alt text and the project links are checked as well.

export const LABELS = {
  kicker: 'The day job',
  titleLight: 'On the',
  titleHeavy: 'clock.',
  proprietary: 'Proprietary work',
  github: 'View on GitHub',
  now: 'Now',
  resume: 'Download resume',
  gh: 'GitHub',
  li: 'LinkedIn',
  mail: 'Email me',
};
export const LINKS = {
  resume: 'Resume_Reuben_Chatterjee_DS.pdf',
  gh: 'https://github.com/ReubenChatterjee',
  li: 'https://www.linkedin.com/in/reuben-chatterjee/',
  mail: 'mailto:reuben.a.chatterjee@gmail.com',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const statText = (s) => `${s.prefix || ''}${Number(s.end).toFixed(s.decimals || 0)}${s.suffix || ''}`;

function img(im, { sizes, cls = '' }) {
  return `<span class="pimg ${cls}" style="background-image:url(${im.lqip})"><img src="${esc(im.src)}" srcset="${esc(im.srcset)}" sizes="${esc(sizes)}" width="${im.width}" height="${im.height}" loading="lazy" decoding="async" alt="${esc(im.alt)}"></span>`;
}
const lock = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2h.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm1.5 0h4V5a2 2 0 0 0-4 0z" fill="currentColor"/></svg>';
const arrow = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M4 12L12 4M5.5 4H12v6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function cta(p) {
  if (p.proprietary) return `<span class="chip">${lock}${LABELS.proprietary}</span>`;
  if (p.github) return `<a class="glink" href="${esc(p.github)}" rel="noopener">${LABELS.github}${arrow}</a>`;
  return '';
}
function tags(list) { return `<ul class="tags">${list.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`; }

function card(p, cls) {
  return `<li class="pcard ${cls}"><article>
   ${img(p.image, { sizes: '(min-width: 1200px) 400px, (min-width: 600px) 46vw, 92vw' })}
   <div class="pcard__b"><p class="eyebrow">${esc(p.eyebrow)}</p><h3>${esc(p.title)}</h3><p class="pcard__d">${esc(p.description)}</p>${tags(p.tags)}<div class="pcard__f">${cta(p)}</div></div>
  </article></li>`;
}

export function renderWork(w) {
  const { bio, stats, featured: f, projects, experience } = w;
  const [lead, ...rest] = bio.paragraphs;
  const h = bio.headshot;
  const first = `
  <div class="otc__first">
   <div class="otc__l">
    <p class="kicker">${LABELS.kicker}</p>
    <h2 class="title otc__title" id="h-clock"><span class="light">${LABELS.titleLight}</span> <span class="heavy">${LABELS.titleHeavy}</span></h2>
    <div class="otc__id">
     <img class="otc__me" src="${esc(h.src)}" srcset="${esc(h.srcset)}" sizes="88px" width="${h.width}" height="${h.height}" loading="lazy" decoding="async" alt="${esc(h.alt)}" style="background-image:url(${h.lqip})">
     <div><p class="otc__name">${esc(bio.name)}</p><p class="otc__role">${esc(bio.role)}</p></div>
    </div>
    <p class="otc__lead">${esc(lead)}</p>
   </div>
   <div class="otc__r">
    <ul class="stats" aria-label="Impact">${stats.map((s) => `
     <li class="stat"><span class="stat__n">${esc(statText(s))}</span><span class="stat__l">${esc(s.label)}</span><span class="stat__s">${esc(s.sub)}</span></li>`).join('')}
    </ul>
    <ul class="actions">
     <li><a class="btn btn--main" href="${LINKS.resume}" download>${LABELS.resume}</a></li>
     <li><a class="btn" href="${LINKS.gh}" rel="noopener">${LABELS.gh}</a></li>
     <li><a class="btn" href="${LINKS.li}" rel="noopener">${LABELS.li}</a></li>
     <li><a class="btn" href="${LINKS.mail}">${LABELS.mail}</a></li>
    </ul>
   </div>
  </div>`;
  const more = `
  <div class="otc__more">
   <div class="otc__bio">${rest.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
   <article class="feat">
    ${img(f.image, { sizes: '(min-width: 900px) 52vw, 92vw', cls: 'feat__img' })}
    <div class="feat__b"><p class="eyebrow">${esc(f.eyebrow)}</p><h3>${esc(f.title)}</h3><p class="pcard__d">${esc(f.description)}</p>${tags(f.tags)}<div class="pcard__f">${cta(f)}</div></div>
   </article>
   <ul class="pgrid" aria-label="Projects">${projects.map((p, i) => card(p, i === projects.length - 1 ? 'pcard--last' : '')).join('\n')}
   </ul>
   <ol class="tl" aria-label="Experience">${experience.map((e) => `
    <li class="tl__i"${e.current ? ' data-current="true"' : ''}>
     <p class="tl__date"><span>${esc(e.date)}</span>${e.current ? `<b class="now">${LABELS.now}</b>` : ''}</p>
     <article class="tl__c"><h3>${esc(e.company)}</h3><p class="tl__role">${esc(e.role)}</p><ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></article>
    </li>`).join('')}
   </ol>
  </div>`;
  return first + more + '\n';
}

// ---- build-time check ----
function expectedNodes(w) {
  const { bio, stats, featured: f, projects, experience } = w;
  const L = LABELS, out = [L.kicker, L.titleLight, L.titleHeavy, bio.name, bio.role, bio.paragraphs[0]];
  for (const s of stats) out.push(statText(s), s.label, s.sub);
  out.push(L.resume, L.gh, L.li, L.mail, ...bio.paragraphs.slice(1));
  for (const p of [f, ...projects]) {
    out.push(p.eyebrow, p.title, p.description, ...p.tags);
    if (p.proprietary) out.push(L.proprietary); else if (p.github) out.push(L.github);
  }
  for (const e of experience) { out.push(e.date); if (e.current) out.push(L.now); out.push(e.company, e.role, ...e.bullets); }
  return out;
}
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export function verifyWork(sectionHtml, w) {
  const errs = [];
  const nodes = decode(sectionHtml.replace(/<!--[\s\S]*?-->/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '')).split(/<[^>]+>/).map((t) => t.trim()).filter(Boolean);
  const exp = expectedNodes(w);
  for (let i = 0; i < Math.max(nodes.length, exp.length); i++) {
    if (nodes[i] !== exp[i]) { errs.push(`text node ${i}: rendered ${JSON.stringify(nodes[i])} but expected ${JSON.stringify(exp[i])}`); break; }
  }
  const alts = [...sectionHtml.matchAll(/\balt="([^"]*)"/g)].map((m) => decode(m[1]));
  const expAlts = [w.bio.headshot.alt, w.featured.image.alt, ...w.projects.map((p) => p.image.alt)];
  if (JSON.stringify(alts) !== JSON.stringify(expAlts)) errs.push('image alt text differs from work.json');
  const hrefs = [...sectionHtml.matchAll(/\bhref="([^"]*)"/g)].map((m) => decode(m[1]));
  const expHrefs = [LINKS.resume, LINKS.gh, LINKS.li, LINKS.mail, ...[w.featured, ...w.projects].filter((p) => !p.proprietary && p.github).map((p) => p.github)];
  if (JSON.stringify(hrefs) !== JSON.stringify(expHrefs)) errs.push('links differ: ' + JSON.stringify(hrefs));
  if (errs.length) throw new Error('On the clock differs from work.json:\n  ' + errs.join('\n  '));
  return { nodes: nodes.length, alts: alts.length, hrefs: hrefs.length };
}
