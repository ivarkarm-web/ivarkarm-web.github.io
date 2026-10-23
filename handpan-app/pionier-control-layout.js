/* Pionier control layout: apply after welcome transition, then keep late-created shortcut buttons aligned. */
(function () {
  if (window.__pionierShortcutLayoutV8) return;
  window.__pionierShortcutLayoutV8 = true;
  var observer = null;
  var scheduled = false;

  function welcomeActive() {
    var welcome = document.getElementById('pionierWelcome');
    /* The html class can remain stale after the welcome screen closes. Only the
       actual visible welcome overlay should defer layout; otherwise controls
       never get reparented and the mobile drawer hides the scale selector. */
    return !!(welcome && !welcome.hidden && getComputedStyle(welcome).display !== 'none' &&
      getComputedStyle(welcome).visibility !== 'hidden' && welcome.getAttribute('aria-hidden') !== 'true');
  }

  function ensureLayout() {
    scheduled = false;
    if (welcomeActive()) return;
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

    var shortcuts = document.getElementById('pionierLooperShortcuts');
    if (!shortcuts) {
      shortcuts = document.createElement('div');
      shortcuts.id = 'pionierLooperShortcuts';
      shortcuts.setAttribute('aria-label', 'Sound and app controls');
    }
    if (shortcuts.parentElement !== rail) {
      rail.appendChild(shortcuts);
    }
    ['openSoundscapes', 'fxPanelOpen', 'settingsOpenBtn'].forEach(function (id) {
      var button = document.getElementById(id);
      if (button && button.parentElement !== shortcuts) shortcuts.appendChild(button);
    });
  }

  function scheduleLayout() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(ensureLayout);
  }

  function boot() {
    scheduleLayout();
    if (observer) return;
    observer = new MutationObserver(scheduleLayout);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('pionier:welcome-closed', scheduleLayout);
    document.getElementById('enterPionier')?.addEventListener('click', function () {
      setTimeout(scheduleLayout, 0);
      setTimeout(scheduleLayout, 250);
    }, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();