/* hero loop: the still dissolves into the clip and back. Nothing is requested before window load + idle,
   and nothing at all under reduced motion, Save-Data or ?hero=still. ?herot=<s> shows the clip frozen at that time. */
var hp = document.querySelector('.piece--hero'), hv = hp.querySelector('video'), hb = hp.querySelector('.motion');
var hMode = params.get('hero') === 'still' ? 'off' : params.has('herot') ? 'frozen' : 'cycle';
var hState = { loaded: false, started: false, userPaused: false, timer: 0, phase: 'idle' };
function saveData() { var c = navigator.connection; return !!(c && c.saveData); }
function heroOK() { return hMode !== 'off' && !mqMotion.matches && !saveData(); }
function heroWant() { return heroOK() && hState.loaded && !hState.userPaused && active === 0 && !document.hidden; }
function heroShow(on) {
  if (on) { hp.setAttribute('data-hv', ''); if (hp.hasAttribute('data-hv-instant')) hp.setAttribute('data-hv-done', ''); }
  else { hp.removeAttribute('data-hv'); hp.removeAttribute('data-hv-done'); }
}
/* once the clip is fully opaque the still underneath is dropped, so its edges cannot ghost through the clip's feathered mask */
hv.addEventListener('transitionend', function () { if (hp.hasAttribute('data-hv')) hp.setAttribute('data-hv-done', ''); });
function heroStop() {
  clearTimeout(hState.timer); hState.phase = 'idle';
  if (!hv.paused) hv.pause();
  heroShow(false);
}
function heroHold(ms) { clearTimeout(hState.timer); hState.phase = 'hold'; hState.timer = setTimeout(heroPlay, ms); }
function heroPlay() {
  if (!heroWant()) return;
  hState.phase = 'play';
  try { hv.currentTime = 0; } catch (e) {}
  var pr = hv.play();
  if (pr && pr.catch) pr.catch(function () { heroStop(); });
}
hv.addEventListener('playing', function () { if (hState.phase === 'play') heroShow(true); });
hv.addEventListener('ended', function () {
  if (hState.phase !== 'play') return;
  heroShow(false); heroHold(600 + 2500);
});
function heroSync() {
  if (!hState.started) return;
  if (hMode === 'frozen') return;
  if (hb) hb.hidden = !heroOK();
  if (!heroOK()) { heroStop(); return; }
  if (heroWant()) { if (hState.phase === 'idle') heroHold(900); }
  else if (hState.phase !== 'idle') heroStop();
}
function heroStart() {
  if (!heroOK() || hState.started) return;
  hState.started = true;
  function ready() {
    if (hState.loaded) return;
    hState.loaded = true;
    if (hMode === 'frozen') {
      var t = Math.max(0, parseFloat(params.get('herot')) || 0);
      hp.setAttribute('data-hv-instant', '');
      hv.addEventListener('seeked', function () { heroShow(true); }, { once: true });
      try { hv.currentTime = Math.min(t, (hv.duration || t) - 0.001); } catch (e) {}
      hv.pause();
      return;
    }
    hb.hidden = false;
    heroSync();
  }
  hv.addEventListener('canplaythrough', ready, { once: true });
  hv.addEventListener('loadeddata', function () { setTimeout(ready, 1500); }, { once: true });
  hv.preload = 'auto';
  hv.src = 'art/video/boat-hero.mp4';
  hv.load();
}
if (hb) hb.addEventListener('click', function () {
  hState.userPaused = !hState.userPaused;
  hb.setAttribute('aria-pressed', hState.userPaused ? 'true' : 'false');
  hb.setAttribute('aria-label', hState.userPaused ? 'Play the headphone animation' : 'Pause the headphone animation');
  heroSync();
});
function heroBoot() { if ('requestIdleCallback' in window) requestIdleCallback(heroStart, { timeout: 2000 }); else setTimeout(heroStart, 200); }
if (document.readyState === 'complete') heroBoot(); else addEventListener('load', heroBoot);

/* hooks into core: the active room changes, the motion preference flips, the tab hides */
onActive.push(function () { heroSync(); });
onMode.push(function () { if (!mqMotion.matches) heroBoot(); heroSync(); });
document.addEventListener('visibilitychange', function () { heroSync(); });
