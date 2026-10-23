/* Pionier mobile control layout v6: enforce a dedicated top selector stack and a separate utility row. */
(function () {
  if (window.__pionierShortcutLayoutV6) return;
  window.__pionierShortcutLayoutV6 = true;
  function ensureLayout() {
    var app = document.getElementById('app');
    var topbar = app && app.querySelector('.topbar');
    var rail = document.getElementById('looperRail');
    if (!app || !topbar || !rail) return;

    var nav = document.getElementById('instrumentNav');
    var center = topbar.querySelector('.center-nav');
    if (nav && center && nav.parentElement !== center) center.appendChild(nav);
    if (center && center.parentElement !== topbar) topbar.insertBefore(center, topbar.firstChild);

    var scaleBlock = app.querySelector('.control-scale');
    if (scaleBlock && scaleBlock.parentElement !== topbar) topbar.appendChild(scaleBlock);

    var stepper = scaleBlock && scaleBlock.querySelector('.scale-stepper');
    var rootBtn = document.getElementById('looperRootMenuBtn');
    if (stepper && rootBtn && rootBtn.parentElement !== stepper) stepper.appendChild(rootBtn);

    var shortcuts = document.getElementById('pionierLooperShortcuts');
    if (!shortcuts) {
      shortcuts = document.createElement('div');
      shortcuts.id = 'pionierLooperShortcuts';
      shortcuts.setAttribute('aria-label', 'Sound and app controls');
    }
    /* Never overlay the recorder, BPM, or loop tracks: shortcuts get their own row. */
    if (shortcuts.parentElement !== app || shortcuts.previousElementSibling !== rail) {
      rail.insertAdjacentElement('afterend', shortcuts);
    }
    ['openSoundscapes', 'fxPanelOpen', 'settingsOpenBtn'].forEach(function (id) {
      var button = document.getElementById(id);
      if (button && button.parentElement !== shortcuts) shortcuts.appendChild(button);
    });
  }
  function boot() {
    ensureLayout();
    var observer = new MutationObserver(ensureLayout);
    observer.observe(document.body, { childList: true, subtree: true });
    window.setInterval(ensureLayout, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();