/**
 * Mniej hałasu na Pulpicie: chowa zbędne banery diagnostyczne.
 * Zostawia: profil sesji, hero handlu, autonomie, why-0.
 */
(function () {
  var HIDE = [
    'btx-daytrader-mode',
    'btx-unblock',
    'btx-live-gate',
    'btx-engine-hard',
    'btx-api-budget',
    'btx-active-dt-banner',
    'btx-plain-legend'
  ];

  function hide() {
    HIDE.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.style.display = 'none';
        el.setAttribute('data-btx-hidden', '1');
      }
    });
  }

  function boot() {
    hide();
    setInterval(hide, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
