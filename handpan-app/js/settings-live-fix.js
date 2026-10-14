/**
 * settings-live-fix — light mode, live skin, Controls label, Apply button
 */
(function () {
  function syncControlsLabel() {
    const drawer = document.getElementById('mobileControlDrawer');
    const toggle = document.getElementById('mobileControlsToggle');
    if (!toggle) return;
    const open = !!(drawer && drawer.classList.contains('is-open'));
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    const label = toggle.querySelector('.mobile-controls-label');
    if (label) label.textContent = open ? 'Hide' : 'Controls';
  }

  function onSettings(e) {
    const d = (e && e.detail) || {};
    const root = document.documentElement;
    if (d.lightMode) {
      root.classList.add('theme-light');
      root.classList.remove('dark');
      root.style.setProperty('--bg', '#e8e6e1');
      root.style.setProperty('--bg-elevated', '#f2f0eb');
      root.style.setProperty('--text', '#1a1a1c');
    } else if (d.lightMode === false) {
      root.classList.remove('theme-light');
      root.classList.add('dark');
      root.style.setProperty('--bg', '#070708');
      root.style.setProperty('--bg-elevated', '#0e0e10');
      root.style.removeProperty('--text');
    }
    if (window.PionierSettings) {
      if (d.skin != null) window.PionierSettings.skin = d.skin;
      if (d.tonefield != null) window.PionierSettings.tonefield = d.tonefield;
      if (d.ambient != null) window.PionierSettings.ambient = d.ambient;
      if (d.transparency != null) window.PionierSettings.transparency = d.transparency;
      if (d.mandala != null) window.PionierSettings.mandala = d.mandala;
      if (d.lightMode != null) window.PionierSettings.lightMode = !!d.lightMode;
      if (d.led) window.PionierSettings.led = Object.assign({}, d.led);
    }
    if (d.skin != null) root.dataset.skin = d.skin;
    if (d.tonefield != null) root.dataset.tonefield = d.tonefield;
    if (d.ambient != null) root.dataset.ambient = d.ambient;
    syncControlsLabel();
  }

  function ensureApplyBtn() {
    if (document.getElementById('settingsApplyBtn')) return;
    const close = document.getElementById('settingsSheetClose');
    if (!close || !close.parentElement) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'settingsApplyBtn';
    btn.className = 'settings-apply-btn';
    btn.textContent = 'Apply';
    btn.addEventListener('click', function () {
      try {
        var s = window.PionierSettings;
        if (s) {
          var detail = typeof s.get === 'function' ? s.get() : {
            skin: s.skin, ambient: s.ambient, tonefield: s.tonefield,
            transparency: s.transparency, mandala: s.mandala, lightMode: s.lightMode, led: s.led
          };
          window.dispatchEvent(new CustomEvent('pionier:settings', { detail: detail }));
        }
      } catch (e) {}
      var sheet = document.getElementById('settingsSheet');
      var backdrop = document.getElementById('settingsSheetBackdrop');
      if (sheet) {
        sheet.classList.remove('is-open');
        setTimeout(function () { if (!sheet.classList.contains('is-open')) sheet.hidden = true; }, 320);
      }
      if (backdrop) {
        backdrop.classList.remove('is-open');
        backdrop.hidden = true;
      }
      var gear = document.getElementById('settingsOpenBtn');
      if (gear) gear.setAttribute('aria-expanded', 'false');
      syncControlsLabel();
    });
    if (!close.parentElement.classList.contains('settings-sheet-actions')) {
      var wrap = document.createElement('div');
      wrap.className = 'settings-sheet-actions';
      close.parentElement.insertBefore(wrap, close);
      wrap.appendChild(btn);
      wrap.appendChild(close);
    } else {
      close.parentElement.insertBefore(btn, close);
    }
  }

  if (!document.getElementById('settingsApplyStyles')) {
    var st = document.createElement('style');
    st.id = 'settingsApplyStyles';
    st.textContent = '.settings-sheet-actions{display:flex;align-items:center;gap:8px}.settings-apply-btn{min-height:32px;padding:6px 14px;border-radius:999px;border:1px solid rgba(212,176,74,.45);background:rgba(212,176,74,.18);color:#e8c86a;font-size:13px;font-weight:600;cursor:pointer}.settings-apply-btn:hover{background:rgba(212,176,74,.28)}html.theme-light .settings-apply-btn{background:rgba(212,176,74,.22);color:#7a5c12;border-color:rgba(180,140,40,.45)}';
    (document.head || document.documentElement).appendChild(st);
  }

  window.addEventListener('pionier:settings', onSettings);
  setInterval(function () { syncControlsLabel(); ensureApplyBtn(); }, 800);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { syncControlsLabel(); ensureApplyBtn(); });
  } else {
    syncControlsLabel();
    ensureApplyBtn();
  }
})();
