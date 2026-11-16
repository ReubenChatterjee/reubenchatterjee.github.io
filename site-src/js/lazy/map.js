/* The colour map (section 06), loaded on demand by 71-map-loader.js. Ported from Proof B.
   Touch: one-finger swipes over the map scroll the page; taps open pieces. "Explore the map" (touch only) switches
   to one-finger pan and two-finger pinch. Mouse: drag pans with inertia; the wheel zooms only with Ctrl/Cmd held, or
   after a click on empty map space. Keyboard: arrows pan, + and - zoom, 0 resets, Tab walks the pieces in rank order.
   Reduced motion: no inertia, no flight, no line growth, no panel wipe. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const html = document.documentElement;
  const sec = $('#map');
  const rmq = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = rmq.matches;
  rmq.addEventListener('change', (e) => { reduced = e.matches; });
  const wideMq = matchMedia('(min-width: 900px)');
  const EASE = 'cubic-bezier(.2,.7,.2,1)';

  const frame = $('#map-frame'), vp = $('#map-vp'), world = $('#map-world'), nodesEl = $('#map-nodes');
  const linksEl = $('#map-links'), dotsEl = $('#map-dots'), toastEl = $('#map-toast'), keyEl = $('#map-key');
  const detail = $('#map-detail'), panel = $('.map__panel', detail), scroller = $('#md-scroll');
  const media = $('#md-media'), mediaImg = $('#md-img');

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  let byId = new Map(), order = [], emb = null, layoutName = '', layout = null;
  const nodeEls = new Map(), dotEls = new Map();
  const view = { s: 1, x: 0, y: 0 };
  let fitView = { s: 1, x: 0, y: 0 }, minS = 0.3, maxS = 3, touched = false;

  /* ---------- data ---------- */
  async function load() {
    const get = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u); return r.json(); });
    const [m, e] = await Promise.all([get('art/projects.json'), get('art/embedding.json')]);
    emb = e;
    const projects = new Map(m.projects.map((p) => [p.id, p]));
    const videos = new Map(m.videos.map((v) => [v.id, v]));
    const feats = new Map(e.pieces.map((p) => [p.id, p]));
    order = [...m.pieces].sort((a, b) => a.rank - b.rank).map((p, i) => {
      const project = projects.get(p.project);
      return { ...p, n: i + 1, project, video: project.video ? videos.get(project.video) : null,
        features: feats.get(p.id).features, neighbours: feats.get(p.id).neighbours, sib: project.pieces.indexOf(p.id) + 1 };
    });
    byId = new Map(order.map((p) => [p.id, p]));
  }

  const thumb = (p) => p.src['480'];
  const srcset = (p) => Object.entries(p.src).map(([w, u]) => `${u} ${w}w`).join(', ');
  const fitBox = (ratio, bw, bh) => (ratio >= bw / bh ? [bw, Math.round(bw / ratio)] : [Math.round(bh * ratio), bh]);
  const thumbImg = (p, bw, bh) => {
    const [w, h] = fitBox(p.ratio, bw, bh);
    return `<img src="${thumb(p)}" srcset="${thumb(p)} 480w" sizes="${w}px" width="${w}" height="${h}" loading="lazy" decoding="async" alt="">`;
  };
  const viewOf = (p) => (p.project.pieces.length > 1 ? ` · view ${p.sib} of ${p.project.pieces.length}` : '');

  /* ---------- nodes ---------- */
  let tether = null;
  function buildNodes() {
    const nf = document.createDocumentFragment(), df = document.createDocumentFragment();
    for (const p of order) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'map__node';
      b.dataset.id = p.id;
      b.style.backgroundImage = `url("${p.lqip}")`;
      b.innerHTML = `<span class="sr">${esc(p.project.title)}, ${esc(p.project.dateLabel)}. </span>` +
        `<img src="${thumb(p)}" srcset="${thumb(p)} 480w" sizes="240px" width="${p.width}" height="${p.height}" loading="lazy" decoding="async" draggable="false" alt="${esc(p.alt)}">` +
        `<span class="map__cap" aria-hidden="true">${esc(p.project.title)}<small>${esc(p.project.dateLabel)}</small></span>`;
      nodeEls.set(p.id, b);
      nf.appendChild(b);
      const d = document.createElement('i');
      d.className = 'map__dot';
      dotEls.set(p.id, d);
      df.appendChild(d);
    }
    nodesEl.appendChild(nf);
    dotsEl.appendChild(df);
    tether = document.createElement('i');
    tether.className = 'map__tether';
    dotsEl.appendChild(tether);
  }

  // the layout whose shape is closest to the frame's (wide 2:1, short 4:5, tall 2:3)
  const chooseLayout = () => {
    const r = vp.clientWidth / Math.max(1, vp.clientHeight);
    let best = '', d = Infinity;
    for (const [name, l] of Object.entries(emb.layouts)) {
      const e = Math.abs(Math.log(r * l.height / l.width));
      if (e < d) { d = e; best = name; }
    }
    return best;
  };
  function applyLayout(name) {
    layoutName = name;
    layout = emb.layouts[name];
    world.style.width = `${layout.width}px`;
    world.style.height = `${layout.height}px`;
    world.classList.toggle('is-tall', name !== 'wide');
    const k = layout.key;
    if (k) Object.assign(keyEl.style, { left: `${k.x}px`, top: `${k.y}px`, width: `${k.w}px`, height: `${k.h}px` });
    for (const p of order) {
      const n = layout.nodes[p.id], el = nodeEls.get(p.id), d = dotEls.get(p.id);
      Object.assign(el.style, { left: `${n.x - n.w / 2}px`, top: `${n.y - n.h / 2}px`, width: `${n.w}px`, height: `${n.h}px` });
      el.style.setProperty('--w', `${n.w}px`);
      el.style.setProperty('--h', `${n.h}px`);
      // captions near a side edge hang inward, so the frame does not clip them
      el.classList.toggle('cap-l', n.x < layout.width * 0.3);
      el.classList.toggle('cap-r', n.x > layout.width * 0.7);
      d.style.left = `${n.trueX}px`;
      d.style.top = `${n.trueY}px`;
    }
    if (current) drawLinks(current, true);
  }
  function computeFit() {
    const w = vp.clientWidth, h = vp.clientHeight, m = 14;
    const s = Math.min((w - 2 * m) / layout.width, (h - 2 * m) / layout.height);
    fitView = { s, x: (w - layout.width * s) / 2, y: (h - layout.height * s) / 2 };
    minS = s * 0.75;
    maxS = Math.max(s * 3.5, 1.5);
  }

  /* ---------- view transform ---------- */
  let motionTimer = 0;
  function paint() {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
    world.style.setProperty('--inv', (1 / view.s).toFixed(4));
  }
  function moving() {
    world.classList.add('is-moving');
    clearTimeout(motionTimer);
    motionTimer = setTimeout(() => world.classList.remove('is-moving'), 180);
  }
  function clampView() {
    const w = vp.clientWidth, h = vp.clientHeight;
    view.s = clamp(view.s, minS, maxS);
    view.x = clamp(view.x, w / 2 - layout.width * view.s, w / 2);
    view.y = clamp(view.y, h / 2 - layout.height * view.s, h / 2);
  }
  function setView(v) { Object.assign(view, v); clampView(); paint(); moving(); }
  function zoomAt(px, py, s) {
    s = clamp(s, minS, maxS);
    const wx = (px - view.x) / view.s, wy = (py - view.y) / view.s;
    setView({ s, x: px - wx * s, y: py - wy * s });
  }

  let tweenRaf = 0, inertiaRaf = 0;
  function stopMotion() { cancelAnimationFrame(tweenRaf); cancelAnimationFrame(inertiaRaf); }
  function tweenTo(target, dur = 480) {
    stopMotion();
    if (reduced || dur <= 0) { setView(target); return; }
    const from = { ...view }, t0 = performance.now(), ls0 = Math.log(from.s), ls1 = Math.log(target.s);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      view.s = Math.exp(ls0 + (ls1 - ls0) * e);
      view.x = from.x + (target.x - from.x) * e;
      view.y = from.y + (target.y - from.y) * e;
      paint(); moving();
      if (t < 1) tweenRaf = requestAnimationFrame(step); else setView(target);
    };
    tweenRaf = requestAnimationFrame(step);
  }
  function zoomBy(k) {
    const w = vp.clientWidth, h = vp.clientHeight, s = clamp(view.s * k, minS, maxS);
    const wx = (w / 2 - view.x) / view.s, wy = (h / 2 - view.y) / view.s;
    const saved = { ...view };
    Object.assign(view, { s, x: w / 2 - wx * s, y: h / 2 - wy * s });
    clampView();
    const target = { ...view };
    Object.assign(view, saved);
    tweenTo(target, 320);
  }
  function startInertia(vx, vy) {
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(32, now - last);
      last = now;
      const bx = view.x + vx * dt, by = view.y + vy * dt;
      view.x = bx; view.y = by;
      clampView();
      if (view.x !== bx) vx = 0;
      if (view.y !== by) vy = 0;
      const decay = Math.exp(-dt / 300);
      vx *= decay; vy *= decay;
      paint(); moving();
      if (Math.hypot(vx, vy) > 0.015) inertiaRaf = requestAnimationFrame(step);
    };
    inertiaRaf = requestAnimationFrame(step);
  }

  /* ---------- pointer, wheel, keys ---------- */
  const pointers = new Map();
  let drag = null, pinch = null, exploring = false, active = false, suppressClick = false;
  const beginDrag = (id, x, y, moved = false) => { drag = { id, sx: x, sy: y, lx: x, ly: y, moved, samples: [{ t: performance.now(), x, y }] }; };
  function mid() {
    const [a, b] = [...pointers.values()], r = vp.getBoundingClientRect();
    return [(a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, Math.hypot(a.x - b.x, a.y - b.y) || 1];
  }
  vp.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      if (!touched) { touched = true; sec.classList.add('has-touch'); }
      if (!exploring) return; // the page scrolls; taps still open pieces
    } else if (e.button !== 0) return;
    stopMotion();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) beginDrag(e.pointerId, e.clientX, e.clientY);
    else if (pointers.size === 2) {
      for (const id of pointers.keys()) { try { vp.setPointerCapture(id); } catch (_) { /* gone */ } }
      const [mx, my, d] = mid();
      pinch = { d0: d, s0: view.s, wx: (mx - view.x) / view.s, wy: (my - view.y) / view.s };
      drag = null;
    }
  });
  vp.addEventListener('pointermove', (e) => {
    const pt = pointers.get(e.pointerId);
    if (!pt) return;
    pt.x = e.clientX; pt.y = e.clientY;
    if (pinch && pointers.size >= 2) {
      const [mx, my, d] = mid(), s = clamp(pinch.s0 * (d / pinch.d0), minS, maxS);
      setView({ s, x: mx - pinch.wx * s, y: my - pinch.wy * s });
      suppressClick = true;
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
      drag.moved = true;
      try { vp.setPointerCapture(e.pointerId); } catch (_) { /* gone */ }
      vp.classList.add('is-dragging');
    }
    if (drag.moved) {
      setView({ x: view.x + (e.clientX - drag.lx), y: view.y + (e.clientY - drag.ly) });
      const now = performance.now();
      drag.samples.push({ t: now, x: e.clientX, y: e.clientY });
      while (drag.samples.length > 2 && now - drag.samples[0].t > 100) drag.samples.shift();
    }
    drag.lx = e.clientX; drag.ly = e.clientY;
  });
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    vp.classList.remove('is-dragging');
    if (pinch) {
      if (pointers.size < 2) {
        pinch = null;
        if (pointers.size === 1) { const [[id, pt]] = [...pointers.entries()]; beginDrag(id, pt.x, pt.y, true); }
      }
      return;
    }
    if (drag && drag.id === e.pointerId) {
      if (drag.moved) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 0);
        const s = drag.samples, a = s[0], b = s[s.length - 1], dt = b.t - a.t;
        if (!reduced && dt > 0 && performance.now() - b.t < 80 && e.type === 'pointerup') startInertia((b.x - a.x) / dt, (b.y - a.y) / dt);
      }
      drag = null;
    }
    if (!pointers.size) setTimeout(() => { suppressClick = false; }, 0);
  }
  vp.addEventListener('pointerup', endPointer);
  vp.addEventListener('pointercancel', endPointer);
  vp.addEventListener('lostpointercapture', (e) => { if (pointers.has(e.pointerId) && e.pointerType !== 'mouse') endPointer(e); });

  let toastTimer = 0;
  function toast(msg, ms = 1800) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), ms);
  }
  const modKey = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? 'Cmd' : 'Ctrl';
  let lastHint = -Infinity;
  vp.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey || active) {
      e.preventDefault();
      stopMotion();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const dy = clamp(e.deltaY * unit, -60, 60), r = vp.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, view.s * Math.exp(-dy * 0.006));
    } else if (Math.abs(e.deltaY) > 2) {
      const now = performance.now();
      if (now - lastHint > 2400) { lastHint = now; toast(`Hold ${modKey} and scroll to zoom, or click the map first.`); }
    }
  }, { passive: false });

  function setActive(on) { active = on; sec.classList.toggle('is-active', on); }
  frame.addEventListener('mouseleave', () => setActive(false));
  vp.addEventListener('click', (e) => {
    if (suppressClick) return;
    const node = e.target.closest('.map__node');
    if (node) { open(node.dataset.id, node); return; }
    if (current) { close(); return; }
    if (!touched && !active) { setActive(true); toast('Map active. Scroll to zoom, move away to let go.', 1600); }
  });
  nodesEl.addEventListener('click', (e) => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); } }, true);

  $('#map-in').addEventListener('click', () => zoomBy(1.35));
  $('#map-out').addEventListener('click', () => zoomBy(1 / 1.35));
  $('#map-reset').addEventListener('click', () => tweenTo(fitView, 520));
  const exploreBtn = $('#map-explore');
  exploreBtn.addEventListener('click', () => {
    exploring = !exploring;
    exploreBtn.setAttribute('aria-pressed', String(exploring));
    sec.classList.toggle('is-exploring', exploring);
    if (exploring) toast('One finger pans, two fingers zoom.', 1600);
  });

  vp.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const step = 90;
    switch (e.key) {
      case 'ArrowLeft': tweenTo({ ...view, x: view.x + step }, 200); break;
      case 'ArrowRight': tweenTo({ ...view, x: view.x - step }, 200); break;
      case 'ArrowUp': tweenTo({ ...view, y: view.y + step }, 200); break;
      case 'ArrowDown': tweenTo({ ...view, y: view.y - step }, 200); break;
      case '+': case '=': zoomBy(1.35); break;
      case '-': case '_': zoomBy(1 / 1.35); break;
      case '0': tweenTo(fitView, 400); break;
      case 'Escape':
        if (active) setActive(false); else if (exploring) exploreBtn.click(); else return;
        break;
      default: return;
    }
    e.preventDefault();
  });

  // Keep a focused node on screen, and show where it really measures.
  nodesEl.addEventListener('focusin', (e) => {
    const node = e.target.closest('.map__node');
    if (!node) return;
    showTether(node.dataset.id);
    if (!node.matches(':focus-visible')) return;
    const r = node.getBoundingClientRect(), v = vp.getBoundingClientRect(), m = 40;
    if (r.left < v.left + m || r.right > v.right - m || r.top < v.top + m || r.bottom > v.bottom - m) {
      const n = layout.nodes[node.dataset.id];
      tweenTo({ s: view.s, x: v.width / 2 - n.x * view.s, y: v.height / 2 - n.y * view.s }, 360);
    }
  });
  nodesEl.addEventListener('focusout', () => hideTether());
  nodesEl.addEventListener('pointerover', (e) => { const n = e.target.closest('.map__node'); if (n && e.pointerType === 'mouse') showTether(n.dataset.id); });
  nodesEl.addEventListener('pointerout', (e) => { const n = e.target.closest('.map__node'); if (n && !n.contains(e.relatedTarget)) hideTether(); });

  function placeLine(el, x1, y1, x2, y2, grow) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    el.style.left = `${x1}px`;
    el.style.top = `${y1}px`;
    el.style.width = `${len}px`;
    el.style.transform = `rotate(${Math.atan2(y2 - y1, x2 - x1)}rad) scaleX(${grow})`;
    return len;
  }
  function showTether(id) {
    const n = layout.nodes[id];
    if (placeLine(tether, n.trueX, n.trueY, n.x, n.y, 1) >= 4) tether.classList.add('is-on');
  }
  function hideTether() { tether.classList.remove('is-on'); }

  /* ---------- selection lines ---------- */
  let current = null;
  function drawLinks(id, instant = false) {
    clearLinks();
    const a = layout.nodes[id];
    nodeEls.get(id).classList.add('is-sel');
    byId.get(id).neighbours.forEach((nb, i) => {
      const b = layout.nodes[nb.id], line = document.createElement('i');
      line.className = 'map__link';
      linksEl.appendChild(line);
      const grow = instant || reduced ? 1 : 0;
      placeLine(line, a.x, a.y, b.x, b.y, grow);
      if (!grow) {
        line.style.transitionDelay = `${120 + i * 90}ms`;
        requestAnimationFrame(() => requestAnimationFrame(() => placeLine(line, a.x, a.y, b.x, b.y, 1)));
      }
      const el = nodeEls.get(nb.id), badge = document.createElement('span');
      el.classList.add('is-near');
      badge.className = 'map__badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = String(i + 1);
      el.appendChild(badge);
    });
  }
  function clearLinks() {
    linksEl.textContent = '';
    for (const el of nodeEls.values()) {
      el.classList.remove('is-sel', 'is-near');
      const b = el.querySelector('.map__badge');
      if (b) b.remove();
    }
  }

  /* ---------- detail panel ---------- */
  let isOpen = false, lastFocus = null, closeTimer = 0, filmObserver = null;
  function visibleRect(el) {
    if (!el || !el.isConnected) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return null;
    if (el.closest('.map__vp')) {
      const v = vp.getBoundingClientRect();
      if (cx < v.left || cx > v.right || cy < v.top || cy > v.bottom) return null;
    }
    return r;
  }
  const innerW = () => { const cs = getComputedStyle(scroller); return scroller.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); };
  function sizeMedia(p) {
    const w = Math.round(Math.min(innerW(), innerHeight * (wideMq.matches ? 0.62 : 0.5) * p.ratio));
    media.style.width = `${w}px`;
    media.style.height = `${Math.round(w / p.ratio)}px`;
    return w;
  }
  function fillDetail(p) {
    const w = sizeMedia(p), pr = p.project;
    media.style.backgroundImage = `url("${thumb(p)}")`;
    mediaImg.classList.remove('is-loaded');
    mediaImg.onload = () => mediaImg.classList.add('is-loaded');
    mediaImg.removeAttribute('src');
    mediaImg.sizes = `${w}px`;
    mediaImg.srcset = srcset(p);
    mediaImg.src = p.src['960'] || thumb(p);
    mediaImg.width = p.width;
    mediaImg.height = p.height;
    mediaImg.alt = p.alt;
    if (mediaImg.complete && mediaImg.naturalWidth) mediaImg.classList.add('is-loaded');

    $('#md-kicker').textContent = `No. ${p.n} of ${order.length}${viewOf(p)}`;
    $('#md-title').textContent = pr.title;
    const facts = [['Made', pr.dateLabel], ['Tools', pr.tools.join(', ')], ['Frame', `${p.width} × ${p.height} px`]];
    if (p.video) facts.push(['Clip', `${p.video.duration} s, ${p.video.width} × ${p.video.height}`]);
    $('#md-facts').innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');

    const out = $('#md-out'), pct = (c) => (c.weight * 100).toFixed(1);
    const show = (c) => { out.textContent = `${c.hex} · ${pct(c)}%`; };
    $('#md-pal').innerHTML = p.palette.map((c, i) => `<button type="button" class="seg" style="--w:${c.weight};--c:${c.hex}" data-i="${i}" aria-label="${c.hex}, ${pct(c)} percent of the image"></button>`).join('');
    show(p.palette[0]);
    $('#md-pal').querySelectorAll('.seg').forEach((s) => {
      const c = p.palette[+s.dataset.i];
      ['mouseenter', 'focus', 'click'].forEach((ev) => s.addEventListener(ev, () => show(c)));
    });
    const f = p.features, num = (v, d) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
    $('#md-measure').innerHTML = `Measured lightness <b>${num(f.lightness, 2)}</b> and warmth <b>${num(f.warmth, 3)}</b> in OKLab: ` +
      `<b>${Math.round(f.lightnessScaled * 100)}%</b> of the way from my darkest still to my brightest, <b>${Math.round(f.warmthScaled * 100)}%</b> from coolest to warmest.`;

    fillFilm(p);

    $('#md-near').innerHTML = p.neighbours.map((nb, i) => {
      const q = byId.get(nb.id);
      return `<li><button class="map__nb" type="button" data-open="${q.id}"><span class="map__nn" aria-hidden="true">${i + 1}</span><span class="map__nt">${thumbImg(q, 72, 48)}</span>` +
        `<span class="map__nm">${esc(q.project.title)}<small>${esc(q.project.dateLabel)}${viewOf(q)}</small></span><span class="map__nd">distance ${nb.distance.toFixed(3)}</span></button></li>`;
    }).join('');
    const sibs = pr.pieces.filter((id) => id !== p.id).map((id) => byId.get(id)).filter(Boolean);
    $('#md-sibs-wrap').hidden = !sibs.length;
    $('#md-sibs').innerHTML = sibs.map((q) => `<li><button class="map__sb" type="button" data-open="${q.id}" aria-label="${esc(pr.title)}, view ${q.sib} of ${pr.pieces.length}: ${esc(q.alt)}">${thumbImg(q, 200, 88)}</button></li>`).join('');
    const be = $('#md-be');
    be.hidden = !pr.behanceUrl;
    if (pr.behanceUrl) be.href = pr.behanceUrl;
  }

  const playIcon = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 1l9 5-9 5z" fill="currentColor"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor"/></svg>';
  function stopFilm() {
    if (filmObserver) { filmObserver.disconnect(); filmObserver = null; }
    const v = $('#md-film video');
    if (v) v.pause();
  }
  function fillFilm(p) {
    stopFilm();
    const fig = $('#md-film'), v = p.video;
    if (!v) { fig.hidden = true; fig.textContent = ''; return; }
    fig.hidden = false;
    const ratio = v.width / v.height, w = Math.round(Math.min(innerW(), innerHeight * 0.6 * ratio)), h = Math.round(w / ratio);
    fig.style.width = `${w}px`;
    fig.innerHTML = `<video muted playsinline loop preload="none" poster="${v.poster}" width="${w}" height="${h}" style="width:${w}px;height:${h}px" aria-label="${esc(v.description)}"><source src="${v.src}" type="video/mp4"></video>` +
      `<button class="play" type="button">${playIcon}Play film</button><figcaption>${esc(v.description)} ${v.duration} seconds, no sound.</figcaption>`;
    const video = $('video', fig), btn = $('.play', fig);
    let userPaused = false;
    const sync = () => { btn.innerHTML = video.paused ? `${playIcon}Play film` : `${pauseIcon}Pause film`; };
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    btn.addEventListener('click', () => {
      if (video.paused) { userPaused = false; video.play().catch(() => {}); } else { userPaused = true; video.pause(); }
    });
    if (!reduced && 'IntersectionObserver' in window) {
      filmObserver = new IntersectionObserver((es) => {
        for (const en of es) {
          if (en.isIntersecting && !userPaused) video.play().catch(() => {});
          else if (!en.isIntersecting) video.pause();
        }
      }, { root: scroller, threshold: 0.5 });
      filmObserver.observe(video);
    }
  }

  function fly(src, from, to, r0, r1, done) {
    const el = document.createElement('div');
    el.className = 'map__flyer';
    el.style.backgroundImage = `url("${src}")`;
    el.style.width = `${to.width}px`;
    el.style.height = `${to.height}px`;
    document.body.appendChild(el);
    const sx = from.width / to.width, sy = from.height / to.height;
    const anim = el.animate([
      { transform: `translate(${from.left}px, ${from.top}px) scale(${sx}, ${sy})`, borderRadius: `${r0 / sx}px / ${r0 / sy}px` },
      { transform: `translate(${to.left}px, ${to.top}px) scale(1, 1)`, borderRadius: `${r1}px` },
    ], { duration: 640, easing: EASE, fill: 'forwards' });
    anim.onfinish = () => { done(); requestAnimationFrame(() => el.remove()); };
  }

  function panToSelection(id, instant) {
    if (!wideMq.matches) return; // on a phone the panel covers the map: keep the reader's view for when it closes
    const ids = [id, ...byId.get(id).neighbours.map((n) => n.id)];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const k of ids) {
      const n = layout.nodes[k];
      x0 = Math.min(x0, n.x - n.w / 2); x1 = Math.max(x1, n.x + n.w / 2);
      y0 = Math.min(y0, n.y - n.h / 2); y1 = Math.max(y1, n.y + n.h / 2);
    }
    const v = vp.getBoundingClientRect();
    const left = wideMq.matches ? Math.max(24, panel.getBoundingClientRect().right - v.left + 28) : 24;
    const right = v.width - 24, top = 40, bottom = v.height - 40, rw = right - left, rh = bottom - top;
    if (rw < 160 || rh < 160) return;
    const s = clamp(Math.min(rw / (x1 - x0), rh / (y1 - y0)), minS, Math.max(view.s, fitView.s));
    const target = { s, x: left + (rw - (x1 - x0) * s) / 2 - x0 * s, y: top + (rh - (y1 - y0) * s) / 2 - y0 * s };
    if (instant) setView(target); else tweenTo(target, 700);
  }

  // On desktop the map stays live beside the panel, so bring the frame into view first if it is mostly off screen.
  function frameIntoView() {
    if (!wideMq.matches) return;
    const r = frame.getBoundingClientRect(), vis = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    if (vis < r.height * 0.7) scrollTo({ top: scrollY + r.top - Math.max(0, (innerHeight - r.height) / 2), behavior: 'instant' });
  }

  function open(id, origin, opts = {}) {
    const p = byId.get(id);
    if (!p) return;
    clearTimeout(closeTimer);
    const wasOpen = isOpen;
    if (!wasOpen) lastFocus = document.activeElement;
    const instant = reduced || opts.instant;
    const img = origin && (origin.tagName === 'IMG' ? origin : origin.querySelector('img'));
    const from = instant ? null : visibleRect(img);
    if (!wasOpen) frameIntoView();
    current = id;
    isOpen = true;
    detail.hidden = false;
    html.classList.add('map-lock', 'map-detail');
    fillDetail(p);
    scroller.scrollTop = 0;
    try { history.replaceState(null, '', `${location.pathname}?open=${encodeURIComponent(id)}#map`); } catch (_) { /* file:// */ }
    drawLinks(id, instant);
    const fromNode = origin && origin.classList && origin.classList.contains('map__node') ? origin : null;
    if (from) {
      const to = media.getBoundingClientRect();
      media.style.visibility = 'hidden';
      if (fromNode) fromNode.classList.add('is-flying');
      fly(thumb(p), from, to, (fromNode && layoutName !== 'wide' ? 8 : 12) * (fromNode ? view.s : 1), 12, () => {
        media.style.visibility = '';
        if (fromNode) fromNode.classList.remove('is-flying');
      });
    }
    if (!wasOpen) {
      if (instant) detail.classList.add('is-open');
      else requestAnimationFrame(() => requestAnimationFrame(() => detail.classList.add('is-open')));
    } else if (!instant) {
      $('.map__body', detail).animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: EASE });
    }
    panToSelection(id, instant);
    $('.map__back', detail).focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    const p = byId.get(current), node = nodeEls.get(current);
    stopFilm();
    const to = reduced ? null : visibleRect(node);
    if (to) {
      const from = media.getBoundingClientRect();
      media.style.visibility = 'hidden';
      node.classList.add('is-flying');
      fly(thumb(p), from, to, 12, (layoutName !== 'wide' ? 8 : 12) * view.s, () => node.classList.remove('is-flying'));
    }
    detail.classList.remove('is-open');
    isOpen = false;
    current = null;
    clearLinks();
    const finish = () => { detail.hidden = true; media.style.visibility = ''; html.classList.remove('map-lock', 'map-detail'); };
    if (reduced) finish(); else closeTimer = setTimeout(finish, 520);
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (_) { /* file:// */ }
    const back = lastFocus && lastFocus.isConnected && lastFocus !== document.body ? lastFocus : node;
    if (back && back.focus) back.focus({ preventScroll: true });
  }

  detail.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { close(); return; }
    const b = e.target.closest('[data-open]');
    if (b) open(b.dataset.open, b);
  });
  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...panel.querySelectorAll('button, a[href], [tabindex="0"]')].filter((el) => !el.closest('[hidden]') && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // the plain list (built into the page) opens the panel once the map is here
  $('#map-list').addEventListener('click', (e) => {
    const a = e.target.closest('[data-open]');
    if (!a || !byId.size) return;
    e.preventDefault();
    open(a.dataset.open, null);
  });

  /* ---------- boot ---------- */
  async function boot() {
    try { await load(); } catch (err) { sec.dispatchEvent(new Event('map:fail')); return; }
    buildNodes();
    vp.setAttribute('aria-label', `Colour map of ${order.length} renders. Arrow keys pan, plus and minus zoom, 0 resets. Tab moves through the pieces in my order.`);
    applyLayout(chooseLayout());
    computeFit();
    Object.assign(view, fitView);
    paint();
    sec.classList.add('map--ready');
    let lastW = vp.clientWidth, lastH = vp.clientHeight;
    new ResizeObserver(() => {
      const w = vp.clientWidth, h = vp.clientHeight;
      if (w === lastW && h === lastH) return;
      lastW = w; lastH = h;
      const name = chooseLayout();
      if (name !== layoutName) applyLayout(name);
      computeFit();
      setView(fitView);
      if (isOpen) { sizeMedia(byId.get(current)); panToSelection(current, true); }
    }).observe(vp);
    const want = new URLSearchParams(location.search).get('open');
    if (want && byId.has(want)) {
      frame.scrollIntoView({ block: 'start', behavior: 'instant' });
      open(want, null, { instant: true });
    }
  }
  boot();
})();
