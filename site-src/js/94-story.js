/* Story: draw the learning curve by scroll, light dots as the line reaches them, first tap shows a thumbnail on touch. */
(function () {
  var chart = document.querySelector('[data-chart]');
  if (!chart) return;
  var lines = chart.querySelectorAll('.curve__line'), dots = chart.querySelectorAll('.dot');
  var fz = params.has('draw') ? clamp(parseFloat(params.get('draw')) || 0) : null;
  function set(p, desk) {
    each(lines, function (l) { l.style.strokeDashoffset = p === null ? '' : 1 - p; });
    each(dots, function (d) {
      var f = parseFloat(d.getAttribute(desk ? 'data-fh' : 'data-fv'));
      d.classList.toggle('off', p !== null && p < f - 0.005);
    });
  }
  /* geometry is cached in measure (00-core.js); the frame only uses scrollY, so this rides on the one scroll handler */
  var cTop = 0, cH = 0, last = null;
  onMeasure.push(function () { var b = chart.getBoundingClientRect(); cTop = b.top + scrollY; cH = b.height; last = null; });
  function upd() {
    var v = mqMotion.matches && fz === null ? null : fz !== null ? fz : Math.round(clamp((H * 0.85 - (cTop - Y)) / (cH + H * 0.35)) * 1000) / 1000;
    if (v === last) return; /* nothing changed (the chart is off screen, or the line is fully drawn) */
    last = v; set(v, mqDesk.matches);
  }
  onFrame.push(upd);
  onMode.push(function () { last = undefined; upd(); });
  var touch = matchMedia('(hover: none)');
  chart.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('.dot__pt') : null;
    each(dots, function (d) { if (!a || d !== a.parentNode) d.classList.remove('show'); });
    if (!a || !touch.matches || a.parentNode.classList.contains('show')) return;
    e.preventDefault(); a.parentNode.classList.add('show'); a.scrollIntoView({ block: 'center', behavior: mqMotion.matches ? 'instant' : 'smooth' });
  });
  document.addEventListener('click', function (e) { if (!chart.contains(e.target)) each(dots, function (d) { d.classList.remove('show'); }); });
})();
