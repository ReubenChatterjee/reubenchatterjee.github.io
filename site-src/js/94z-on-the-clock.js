/* On the clock: cards and timeline entries below the first screen fade up as they arrive. Motion only; without script, or with
   reduced motion, nothing is hidden. Numbers are static (no count-up). */
(function () {
  var sec = document.getElementById('on-the-clock');
  if (!sec || !('IntersectionObserver' in window) || mqMotion.matches) return;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  each(sec.querySelectorAll('.otc__bio,.feat,.pcard,.tl__i'), function (el) {
    var r = el.getBoundingClientRect();
    if (r.top < innerHeight) return; /* already on screen (deep link): leave visible */
    el.setAttribute('data-rv', ''); io.observe(el);
  });
})();
