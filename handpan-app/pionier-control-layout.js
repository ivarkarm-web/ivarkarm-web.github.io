/* Keep instrument navigation in its original wrapper, place scale row visibly below it, and relocate utility shortcuts only. */
(function () {
  if (window.__pionierShortcutLayoutV3) return;
  window.__pionierShortcutLayoutV3 = true;

  function ensureLayout() {
    var app = document.getElementById('app');
    var topbar = app && app.querySelector('.topbar');
    var rail = document.getElementById('looperRail');
    if (!app || !topbar || !rail) return;

    /* Do not reparent #instrumentNav: existing app layout code owns that node. */
    var scaleBlock = app.querySelector('.control-scale');
    if (scaleBlock && scaleBlock.parentElement !== topbar) topbar.appendChild(scaleBlock);

    var shortcuts = document.getElementById('pionierLooperShortcuts');
    if (!shortcuts) {
      shortcuts = document.createElement('div');
      shortcuts.id = 'pionierLooperShortcuts';
      shortcuts.setAttribute('aria-label', 'Sound and app controls');
      rail.appendChild(shortcuts);
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();