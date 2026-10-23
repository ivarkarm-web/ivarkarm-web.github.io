/* Pionier control placement; idempotent because legacy compatibility scripts can re-run. */
(function () {
  if (window.__pionierRequestedControlLayoutV1) return;
  window.__pionierRequestedControlLayoutV1 = true;
  function ensureLayout() {
    var app = document.getElementById('app');
    var topbar = app && app.querySelector('.topbar');
    var nav = document.getElementById('instrumentNav');
    var rail = document.getElementById('looperRail');
    if (!app || !topbar || !nav || !rail) return;
    var controlNav = document.getElementById('pionierControlNav');
    if (!controlNav) {
      controlNav = document.createElement('div');
      controlNav.id = 'pionierControlNav';
      topbar.appendChild(controlNav);
    }
    if (nav.parentElement !== controlNav) controlNav.insertBefore(nav, controlNav.firstChild);
    var random = document.getElementById('randomizeSetup');
    var sound = document.getElementById('openSoundscapes');
    if (random && random.parentElement !== nav) {
      var next = document.getElementById('voiceNext');
      if (next && next.parentElement === nav) next.insertAdjacentElement('afterend', random);
      else nav.appendChild(random);
    }
    var scaleBlock = document.querySelector('.control-scale');
    var scaleNav = document.getElementById('pionierScaleNav');
    if (!scaleNav) {
      scaleNav = document.createElement('div');
      scaleNav.id = 'pionierScaleNav';
      controlNav.appendChild(scaleNav);
    }
    if (scaleBlock && scaleBlock.parentElement !== scaleNav) scaleNav.insertBefore(scaleBlock, scaleNav.firstChild);
    var rootBtn = document.getElementById('looperRootMenuBtn');
    if (rootBtn && rootBtn.parentElement !== scaleNav) scaleNav.appendChild(rootBtn);
    if (sound) {
      var shortcuts = document.getElementById('pionierLooperShortcuts');
      if (!shortcuts) {
        shortcuts = document.createElement('div');
        shortcuts.id = 'pionierLooperShortcuts';
        shortcuts.setAttribute('aria-label', 'Sound and app controls');
        rail.appendChild(shortcuts);
      }
      if (sound.parentElement !== shortcuts) shortcuts.appendChild(sound);
    }
    var fx = document.getElementById('fxPanelOpen');
    var settings = document.getElementById('settingsOpenBtn');
    var shortcutsEl = document.getElementById('pionierLooperShortcuts');
    if (shortcutsEl) {
      if (fx && fx.parentElement !== shortcutsEl) shortcutsEl.appendChild(fx);
      if (settings && settings.parentElement !== shortcutsEl) shortcutsEl.appendChild(settings);
    }
  }
  function observeMenus() {
    var observer = new MutationObserver(function () {
      ['scaleMenu','instrumentMenu'].forEach(function (id) {
        var menu = document.getElementById(id);
        if (!menu || menu.hidden || !menu.classList.contains('picker-popover')) return;
        var toggle = document.getElementById(id === 'scaleMenu' ? 'scaleLabel' : 'instrumentDropdownToggle');
        if (!toggle) return;
        var r = toggle.getBoundingClientRect();
        var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        var vw = document.documentElement.clientWidth;
        var width = Math.min(320, vw - 24);
        var left = Math.max(12, Math.min(r.left + r.width / 2 - width / 2, vw - width - 12));
        var below = Math.max(0, vh - r.bottom - 12);
        var above = Math.max(0, r.top - 12);
        var maxH = Math.max(120, Math.min(400, vh * .52, Math.max(below, above)));
        menu.style.position = 'fixed';
        menu.style.left = left + 'px';
        menu.style.right = 'auto';
        menu.style.width = width + 'px';
        menu.style.maxWidth = 'calc(100vw - 24px)';
        menu.style.maxHeight = maxH + 'px';
        menu.style.top = below >= Math.min(220, maxH) ? (r.bottom + 8) + 'px' : 'auto';
        menu.style.bottom = below >= Math.min(220, maxH) ? 'auto' : (vh - r.top + 8) + 'px';
        menu.style.display = 'flex';
        menu.style.flexDirection = 'column';
        menu.style.overflow = 'hidden';
        menu.style.zIndex = '7200';
      });
    });
    observer.observe(document.body, { subtree:true, attributes:true, attributeFilter:['class','hidden','style'] });
  }
  function boot() {
    ensureLayout();
    observeMenus();
    var mo = new MutationObserver(function () { ensureLayout(); });
    mo.observe(document.body, { childList:true, subtree:true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
