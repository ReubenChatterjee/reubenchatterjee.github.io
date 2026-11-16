/* Model card: palette readout, and the details panel (open on desktop, a pop-over on phones) */
each(document.querySelectorAll('.card'), function (c) {
  var out = c.querySelector('.pal__out');
  each(c.querySelectorAll('.seg'), function (s) {
    function show() { out.textContent = s.dataset.hex + ' · ' + s.dataset.pc + '%'; }
    s.addEventListener('mouseenter', show); s.addEventListener('focus', show); s.addEventListener('click', show);
  });
  c.querySelector('summary').addEventListener('click', function (e) { if (mqDesk.matches) e.preventDefault(); });
});
function cards() {
  each(document.querySelectorAll('.card__d'), function (d) {
    if (mqDesk.matches) d.setAttribute('open', ''); else d.removeAttribute('open');
  });
}
mqDesk.addEventListener('change', cards); cards();
