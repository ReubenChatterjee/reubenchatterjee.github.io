/* Colour map loader. The map section is plain HTML (an ordered list of the pieces). This script is added after the first paint,
   and it then fetches css/map.css (the map's own styles, off the first-paint path); the plot stays hidden until that sheet is in,
   so nothing shows unstyled. When the section comes within about two screens (or ?open=<piece-id> asks), js/map.js is added, but
   never before the stylesheet has loaded; it fetches art/embedding.json, art/projects.json and the 480 thumbnails.
   If the stylesheet, the script or its data fail, the plain list comes back. */
var mapSec = document.getElementById('map');
if (mapSec) (function () {
  var all = document.getElementById('map-all'), asked = false, styled = false, added = false;
  function fail() {
    mapSec.classList.remove('map--js'); mapSec.classList.add('map--broken');
    if (all) all.open = true;
  }
  function add() {
    if (added || !asked || !styled) return;
    added = true;
    var s = document.createElement('script');
    s.src = 'js/map.js'; s.async = true; s.onerror = fail;
    document.head.appendChild(s);
  }
  function load() { asked = true; add(); }
  var l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = 'css/map.css'; l.onerror = fail;
  /* the sheet changes the map's height, which can happen after a /#on-the-clock landing. Until the reader touches the page
     (or 5 s pass), land again whenever the map section changes height. */
  var touched = false;
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (n) { addEventListener(n, function () { touched = true; }, { passive: true, once: true }); });
  if ('ResizeObserver' in window && extraForHash(location.hash) && !params.has('open')) {
    var ro = new ResizeObserver(function () { if (touched) ro.disconnect(); else openHash(); });
    ro.observe(mapSec);
    setTimeout(function () { ro.disconnect(); }, 5000);
  }
  l.onload = function () { styled = true; add(); };
  document.head.appendChild(l);
  mapSec.classList.add('map--js');
  if (all) all.open = false;
  mapSec.addEventListener('map:fail', fail);
  if (params.has('open') || !('IntersectionObserver' in window)) { load(); return; }
  var io = new IntersectionObserver(function (es) {
    if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); load(); }
  }, { rootMargin: '150% 0px 150% 0px' });
  io.observe(mapSec);
})();
