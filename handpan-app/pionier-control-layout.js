/* Keep the original selector layout intact; relocate only utility shortcuts. */
(function () {
  if (window.__pionierShortcutLayoutV2) return;
  window.__pionierShortcutLayoutV2 = true;

  function ensureShortcuts() {
    var rail = document.getElementById('looperRail');
    if (!rail) return;

    var shortcuts = document.getElementById('pionierLooperShortcuts');
    if (!shortcuts) {
      shortcuts = document.createElement('div');
      shortcuts.id = 'pionierLooperShortcuts';
      shortcuts.setAttribute('aria-label', 'Sound and app controls');
      rail.appendChild(shortcuts);
    }

    var ids = ['openSoundscapes', 'fxPanelOpen', 'settingsOpenBtn'];
    ids.forEach(function (id) {
      var button = document.getElementById(id);
      if (button && button.parentElement !== shortcuts) shortcuts.appendChild(button);
    });
  }

  function boot() {
    ensureShortcuts();
    var observer = new MutationObserver(ensureShortcuts);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();