/* "More views" strips and the lightbox. Any <ul class="views"> of <button class="views__b"> thumbnails opens here (event delegation,
   so a room needs only the markup). The set is the clicked strip; the colour world is the strip's room. Each button carries
   data-big (960/1600 srcset) and data-lqip; its img carries the native width/height and the alt text, shown as the caption.
   Open and close fly the image between the thumbnail and the centre (FLIP); instant under reduced motion. */
var lb = document.getElementById('lb');
if (lb && lb.showModal) (function () {
  var stage = lb.querySelector('.lb__stage'), bg = lb.querySelector('.lb__bg'), img = new Image();
  var capN = lb.querySelector('.lb__n'), capT = lb.querySelector('.lb__t');
  var prev = lb.querySelector('.lb__prev'), next = lb.querySelector('.lb__next'), close = lb.querySelector('.lb__x');
  var set = [], at = 0, tm = 0, isOpen = false, closing = false, x0 = null, y0 = 0, swiped = false, EASE = 'cubic-bezier(.2,.7,.2,1)';
  img.className = 'lb__img'; img.alt = ''; img.decoding = 'async'; img.draggable = false;
  stage.appendChild(img);

  function thumb() { return set[at].querySelector('img'); }
  function still() { return mqMotion.matches; }
  /* largest native-ratio box that fits the stage */
  function fit() {
    var t = thumb(), w = +t.getAttribute('width'), h = +t.getAttribute('height');
    var s = Math.min(stage.clientWidth / w, stage.clientHeight / h);
    img.style.width = Math.floor(w * s) + 'px'; img.style.height = Math.floor(h * s) + 'px';
    return w * s;
  }
  function show(i) {
    at = (i + set.length) % set.length;
    var b = set[at], t = thumb(), want = at, url = '';
    capN.textContent = set.length > 1 ? (at + 1) + ' of ' + set.length : '';
    capT.textContent = t.alt; /* caption first: its height decides the stage's */
    var need = fit() * (devicePixelRatio || 1);
    img.style.backgroundImage = 'url("' + b.getAttribute('data-lqip') + '")';
    img.src = t.currentSrc || t.src; /* the 480 thumbnail is already loaded: it holds the place until the big file is decoded */
    b.getAttribute('data-big').split(',').some(function (c) {
      var p = c.trim().split(' '); url = p[0]; return parseInt(p[1], 10) >= need;
    });
    var big = new Image(); big.src = url;
    var swap = function () { if (isOpen && at === want) img.src = url; };
    if (big.decode) big.decode().then(swap, function () {}); else big.onload = swap;
  }
  /* FLIP between the thumbnail and the centred image */
  function fly(out) {
    var a = thumb().getBoundingClientRect(), z = img.getBoundingClientRect();
    var tf = 'translate(' + (a.left - z.left) + 'px,' + (a.top - z.top) + 'px) scale(' + (a.width / z.width) + ')';
    return img.animate([{ transform: out ? 'none' : tf }, { transform: out ? tf : 'none' }], { duration: 420, easing: EASE, fill: out ? 'forwards' : 'none' });
  }
  function lock(on) {
    var sb = innerWidth - root.clientWidth;
    root.style.overflow = on ? 'hidden' : '';
    document.body.style.paddingRight = on && sb > 0 ? sb + 'px' : '';
  }
  function open(b) {
    var ul = b.closest('.views'), room = b.closest('[data-world]');
    set = [].slice.call(ul.querySelectorAll('.views__b'));
    lb.setAttribute('data-world', room ? room.getAttribute('data-world') : 'boat');
    prev.hidden = next.hidden = set.length < 2;
    lock(true); lb.showModal(); isOpen = true;
    show(set.indexOf(b));
    close.focus({ preventScroll: true });
    if (still()) { lb.classList.add('is-in'); return; }
    bg.offsetWidth; /* commit the faded-out state so the backdrop transition runs */
    lb.classList.add('is-in'); fly(false);
  }
  function done() {
    clearTimeout(tm);
    if (!isOpen) return;
    isOpen = closing = false;
    if (lb.open) lb.close();
    lb.classList.remove('is-in');
    each(img.getAnimations ? img.getAnimations() : [], function (a) { a.cancel(); });
    img.removeAttribute('src');
    lock(false);
    set[at].focus({ preventScroll: true });
  }
  function shut() {
    if (!isOpen || closing) return;
    closing = true;
    /* bring the current thumbnail into its strip's view so the image has somewhere to land */
    var b = set[at], ul = b.closest('.views'), ur = ul.getBoundingClientRect(), br = b.getBoundingClientRect();
    if (br.left < ur.left || br.right > ur.right) ul.scrollLeft += br.left - ur.left - 4;
    if (still()) return done();
    lb.classList.remove('is-in');
    fly(true).onfinish = done; tm = setTimeout(done, 700);
  }
  function step(d) {
    if (set.length < 2) return;
    show(at + d);
    if (!still()) img.animate([{ opacity: 0, transform: 'translateX(' + d * 48 + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: EASE });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.views__b');
    if (b) open(b);
  });
  prev.addEventListener('click', function () { step(-1); });
  next.addEventListener('click', function () { step(1); });
  close.addEventListener('click', shut);
  lb.addEventListener('cancel', function (e) { e.preventDefault(); shut(); });
  lb.addEventListener('close', done); /* a dialog closed by the browser itself still cleans up */
  /* backdrop click closes (not a click on the image or the controls, and not the end of a swipe) */
  lb.addEventListener('click', function (e) {
    if (swiped) { swiped = false; return; }
    if (e.target === lb || e.target === stage || e.target === bg) shut();
  });
  lb.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
    else if (e.key === 'Tab') { /* focus trap over the visible buttons */
      var f = [].filter.call(lb.querySelectorAll('button'), function (x) { return !x.hidden; }), i = f.indexOf(document.activeElement);
      if (e.shiftKey ? i <= 0 : i === f.length - 1) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
    }
  });
  /* swipe: left/right moves within the set, down closes */
  stage.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; swiped = false; });
  stage.addEventListener('pointerup', function (e) {
    if (x0 === null) return;
    var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { swiped = true; step(dx < 0 ? 1 : -1); }
    else if (dy > 80 && dy > Math.abs(dx)) { swiped = true; shut(); }
  });
  stage.addEventListener('pointercancel', function () { x0 = null; });

  /* strips: fade the right edge while thumbnails are hidden off to the right */
  var strips = document.querySelectorAll('.views');
  function hint() { each(strips, function (ul) { ul.toggleAttribute('data-more', ul.scrollWidth - ul.clientWidth - ul.scrollLeft > 2); }); }
  each(strips, function (ul) { ul.addEventListener('scroll', hint, { passive: true }); });
  addEventListener('resize', function () { hint(); if (isOpen) fit(); });
  hint();
})();
