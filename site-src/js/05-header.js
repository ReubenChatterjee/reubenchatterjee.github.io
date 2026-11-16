/* Header: the name and the controls each follow the colour world under them; the switch marks the side of the active room. */
var hdrName = document.querySelector('.hdr__name');
var hdrCtl = document.querySelector('.hdr__ctl');
var switchLinks = [].slice.call(document.querySelectorAll('.switch__i'));
/* solid bar behind the header in the ground colour of whatever is under it, shown while normal-flow content scrolls beneath (05-header.css) */
var hdrBar = document.querySelector('.hdr__bar');
var hdrCtlX = 0;
onMeasure.push(function () { var b = hdrCtl.getBoundingClientRect(); hdrCtlX = b.left + b.width / 2; });
follow(hdrBar, function () { return [VW / 2, 34]; });
follow(hdrName, function () { return [VW < 900 ? 60 : 110, 34]; });
follow(hdrCtl, function () { return [hdrCtlX, 34]; });
each(document.querySelectorAll('.hdr__name,.switch__i'), bindNav);
function syncSwitch(a, ex) {
  var side = (ex || rooms[a]).getAttribute('data-side') || 'off';
  each(switchLinks, function (l) {
    var i = roomIndexForHash(l.getAttribute('href')), t = i >= 0 ? rooms[i] : extraForHash(l.getAttribute('href')),
      on = !!t && (t.getAttribute('data-side') || 'off') === side;
    if (on) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
  });
}
onActive.push(function (a) { syncSwitch(a, activeExtra); });
onExtra.push(function (ex) { syncSwitch(active, ex); });
