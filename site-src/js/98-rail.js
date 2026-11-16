/* Rail: the build writes one thumbnail per section[data-room] and one chip per later section with data-rail-text (tools/build-site.mjs).
   Over the rooms it is the full filmstrip (at phone widths the chips sit behind a "more" button). Over normal-flow content it gets out
   of the way: it tucks away while you scroll down, comes back as a small pill when you scroll up (and tucks again after a few idle
   seconds), and it stays away while the footer is showing. The pill opens the full rail. Focus inside the rail always shows it. */
var rail = document.getElementById('rail');
var railNow = rail.querySelector('.rail__now'), railNowT = rail.querySelector('.rail__nt');
var railMore = rail.querySelector('.rail__more'), railChips = rail.querySelector('.rail__chips');
var railLinks = rooms.map(function (r) { return rail.querySelector('.rail__rooms a[href="#' + r.id + '"]'); });
var railExtraLinks = [].slice.call(rail.querySelectorAll('.rail__chips a'));
each(railLinks, bindNav);
each(railExtraLinks, bindNav);
if (!railExtraLinks.length) railMore.hidden = true;
rail.classList.add('rail--js');
follow(rail, function () { return [mqDesk.matches ? 100 : VW / 2, H - 36]; });

var railFace = 'full', railTucked = false, railAcc = 0, railOpenAt = null, railIdle = 0, railHover = false;
function railSet(face, tucked) {
  if (face !== railFace) { railFace = face; rail.classList.toggle('is-compact', face === 'compact'); if (face === 'compact') railMoreSet(false); }
  if (tucked !== railTucked) { railTucked = tucked; rail.classList.toggle('is-tucked', tucked); if (tucked) railMoreSet(false); }
}
function railMoreSet(on) {
  if (rail.classList.contains('is-more') === on) return;
  rail.classList.toggle('is-more', on); railMore.setAttribute('aria-expanded', on ? 'true' : 'false');
}
function railIdleArm() {
  clearTimeout(railIdle);
  railIdle = setTimeout(function () {
    if (railFace === 'compact' && !railTucked && !railHover && !rail.contains(document.activeElement)) railSet('compact', true);
  }, 4000);
}
/* the pill (or focus) opens the full rail; it closes again after a real scroll, a pick, Escape or a tap outside */
function railOpen(moveFocus) {
  railOpenAt = Y; railSet('full', false); rail.classList.add('is-open'); railNow.setAttribute('aria-expanded', 'true');
  if (!mqDesk.matches && railExtraLinks.length) railMoreSet(true);
  if (moveFocus) { var c = rail.querySelector('.rail__body [aria-current="true"]') || rail.querySelector('.rail__body a'); if (c) c.focus({ preventScroll: true }); }
}
function railClose() {
  if (railOpenAt === null) return;
  railOpenAt = null; rail.classList.remove('is-open'); railNow.setAttribute('aria-expanded', 'false'); railMoreSet(false); onScroll();
}
railNow.addEventListener('click', function (e) { railOpen(e.detail === 0); });
railMore.addEventListener('click', function () { railMoreSet(!rail.classList.contains('is-more')); });
each(railLinks.concat(railExtraLinks), function (l) { l.addEventListener('click', function () { railMoreSet(false); railClose(); }); });
/* Escape closes the chip menu, then the opened rail (from anywhere: a tap on the pill leaves focus on the page) */
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape' || (!rail.classList.contains('is-more') && railOpenAt === null)) return;
  var inside = rail.contains(document.activeElement);
  if (rail.classList.contains('is-more') && railOpenAt === null) { railMoreSet(false); if (inside) railMore.focus(); }
  else { railClose(); if (inside) railNow.focus(); }
});
document.addEventListener('click', function (e) { if (!rail.contains(e.target)) { railMoreSet(false); railClose(); } });
rail.addEventListener('pointerenter', function () { railHover = true; clearTimeout(railIdle); });
rail.addEventListener('pointerleave', function () { railHover = false; if (railFace === 'compact') railIdleArm(); });
rail.addEventListener('focusin', function () { clearTimeout(railIdle); if (railTucked) railSet(railFace, false); });
rail.addEventListener('focusout', function (e) { if (!rail.contains(e.relatedTarget) && railFace === 'compact') railIdleArm(); });

/* where the rail sits: over the rooms (full), over normal-flow content (pill / tucked), or with the footer showing (tucked) */
function railZone() {
  if (foot && Y + H - 8 > footTop) return 'foot';
  if (!wiping()) return Y < 8 ? 'rooms' : 'flow';
  return flowAt(H - 36) ? 'flow' : 'rooms';
}
onFrame.push(function (y, dy) {
  var z = railZone();
  if (railOpenAt !== null) { if (z !== 'foot' && Math.abs(y - railOpenAt) < 140) return; railClose(); }
  if (z === 'rooms') { railAcc = 0; railSet('full', false); return; }
  if (z === 'foot') { railSet(railFace, true); return; }
  if (dy) railAcc = (dy > 0) === (railAcc > 0) ? railAcc + dy : dy;
  if (railAcc < -30) { if (railFace !== 'compact' || railTucked) { railSet('compact', false); } railIdleArm(); }
  else if (railAcc > 8 || railFace === 'full') railSet(railFace, true);
});

function markRail(a, ex) {
  railLinks.forEach(function (l, i) { if (!ex && i === a) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current'); });
  var cur = null;
  railExtraLinks.forEach(function (l) { if (ex && l.getAttribute('href') === '#' + ex.id) { l.setAttribute('aria-current', 'true'); cur = l; } else l.removeAttribute('aria-current'); });
  railMore.classList.toggle('is-cur', !!cur);
  railNowT.textContent = cur ? cur.textContent : 'Rooms';
  railNow.setAttribute('aria-label', railNowT.textContent + ': show all rooms and sections');
}
onActive.push(function (a) { markRail(a, activeExtra); });
onExtra.push(function (ex) { markRail(active, ex); });
markRail(0, null);
