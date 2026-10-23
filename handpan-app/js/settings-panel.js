/**
 * settings-panel.js — Phase 2: Dark/Light toggle + remaining prefs (skins removed).
 */
(function settingsPanel() {
  const STORAGE_KEY = 'pionier.settings.v2';

  function systemPrefersLight() {
    try { return window.matchMedia('(prefers-color-scheme: light)').matches; } catch (_) { return false; }
  }

  const DEFAULTS = {
    lightMode: null,
    ambient: 'none',
    transparency: 1,
    touchFeedback: false,
    led: { r: 110, g: 200, b: 255, strength: 0.35 },
  };

  function resolveLightMode(state) {
    if (state && (state.lightMode === true || state.lightMode === false)) return !!state.lightMode;
    return systemPrefersLight();
  }

  function catalog() {
    const c = window.PionierCatalog || {};
    return { AMBIENTS: c.AMBIENTS || [{ id: 'none', label: 'None' }] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('pionier.settings.v1');
      if (!raw) return { ...DEFAULTS, led: { ...DEFAULTS.led }, lightMode: null };
      const parsed = JSON.parse(raw);
      const { skin: _s, mandala: _m, auraStyle: _a, tonefield: _t, ...rest } = parsed;
      const lightMode = (rest.lightMode === true || rest.lightMode === false) ? rest.lightMode : null;
      return {
        ...DEFAULTS,
        ...rest,
        lightMode,
        led: { ...DEFAULTS.led, ...(parsed.led || {}) },
        transparency: parsed.transparency != null ? Number(parsed.transparency) : 1,
      };
    } catch {
      return { ...DEFAULTS, led: { ...DEFAULTS.led }, lightMode: null };
    }
  }

  function save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function apply(state) {
    const light = resolveLightMode(state);
    document.documentElement.classList.toggle('theme-light', light);
    document.documentElement.classList.toggle('dark', !light);
    document.body.classList.toggle('theme-light', light);
    document.documentElement.dataset.ambient = state.ambient || 'none';
    const led = state.led || DEFAULTS.led;
    document.documentElement.style.setProperty('--led-color', 'rgb(' + led.r + ',' + led.g + ',' + led.b + ')');
    document.documentElement.style.setProperty('--led-strength', String(led.strength));
    document.documentElement.style.setProperty('--handpan-alpha', String(state.transparency));
    window.PionierSettings = {
      get: () => ({ ...state, lightMode: resolveLightMode(state), led: { ...led } }),
      ambient: state.ambient,
      transparency: state.transparency,
      mandala: false,
      auraStyle: 'none',
      skin: 'neutral',
      tonefield: 'classic',
      lightMode: resolveLightMode(state),
      touchFeedback: state.touchFeedback === true,
      led: { ...led },
    };
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#e8e6e1' : '#070708');
    window.dispatchEvent(new CustomEvent('pionier:settings', { detail: { ...state, led: { ...led } }));
  }

  function isLightTheme() {
    return resolveLightMode(load());
  }

  function labelFor(list, id) {
    const hit = (list || []).find((x) => x.id === id);
    return hit ? hit.label : id;
  }

  let openMenuEl = null;
  let openToggleEl = null;

  function closeMenus() {
    if (openMenuEl) { openMenuEl.hidden = true; openMenuEl.classList.remove('is-open'); openMenuEl = null; }
    if (openToggleEl) { openToggleEl.setAttribute('aria-expanded', 'false'); openToggleEl = null; }
  }

  function positionMenu(menu, toggle) {
    const rect = toggle.getBoundingClientRect();
    const width = Math.max(rect.width, Math.min(320, window.innerWidth - 24));
    let left = rect.left;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - 12 - width;
    if (left < 12) left = 12;
    const spaceBelow = Math.max(80, window.innerHeight - rect.bottom - 16);
    const spaceAbove = Math.max(80, rect.top - 16);
    const preferBelow = spaceBelow >= 140 || spaceBelow >= spaceAbove;
    const maxH = Math.min(window.innerHeight * 0.55, 360, preferBelow ? spaceBelow : spaceAbove);
    let top = preferBelow ? (rect.bottom + 6) : (rect.top - 6 - maxH);
    if (top < 8) top = 8;
    const light = isLightTheme();
    const surface = light ? '#fcfbf8' : '#17171a';
    const text = light ? '#24221e' : '#e6e0d2';
    const border = light ? 'rgba(46,40,28,0.085)' : 'rgba(230,224,210,0.09)';
    menu.style.cssText = [
      'position:fixed', 'z-index:99999', 'left:' + left + 'px', 'top:' + top + 'px',
      'width:' + width + 'px', 'max-height:' + maxH + 'px', 'display:block',
      'background:' + surface, 'color:' + text, 'border:1px solid ' + border,
      'border-radius:16px', 'padding:8px', 'overflow-y:auto',
    ].join(';');
  }

  function buildDropdown(sectionEl, { id, label, items, activeId, onPick }) {
    const row = document.createElement('div');
    row.className = 'settings-dd';
    row.innerHTML =
      '<div class="settings-dd-label">' + label + '</div>' +
      '<button type="button" class="settings-dd-toggle" id="' + id + 'Toggle" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="settings-dd-value" id="' + id + 'Value">' + labelFor(items, activeId) + '</span>' +
      '<span class="settings-dd-chevron" aria-hidden="true">\u25BE</span></button>';
    sectionEl.appendChild(row);
    let menu = document.getElementById(id + 'Menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = id + 'Menu';
      menu.className = 'settings-dd-menu';
      menu.setAttribute('role', 'listbox');
      menu.hidden = true;
      document.body.appendChild(menu);
    }
    const toggle = row.querySelector('.settings-dd-toggle');
    const valueEl = row.querySelector('.settings-dd-value');
    function renderMenu() {
      menu.innerHTML = '';
      let lastGroup = null;
      items.forEach((item) => {
        if (item.group && item.group !== lastGroup) {
          lastGroup = item.group;
          const g = document.createElement('div');
          g.className = 'settings-dd-group';
          g.textContent = item.group;
          menu.appendChild(g);
        }
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'settings-dd-item' + (item.id === activeId ? ' is-active' : '');
        b.setAttribute('role', 'option');
        b.textContent = item.label;
        b.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          activeId = item.id;
          valueEl.textContent = item.label;
          onPick(item.id);
          closeMenus();
        });
        menu.appendChild(b);
      });
    }
    toggle.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const wasOpen = openMenuEl === menu && !menu.hidden;
      closeMenus();
      if (wasOpen) return;
      renderMenu();
      menu.hidden = false;
      menu.removeAttribute('hidden');
      menu.classList.add('is-open');
      positionMenu(menu, toggle);
      toggle.setAttribute('aria-expanded', 'true');
      openMenuEl = menu;
      openToggleEl = toggle;
    });
  }

  function ensureDom() {
    let btn = document.getElementById('settingsOpenBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'settingsOpenBtn';
      btn.className = 'settings-open-btn';
      btn.setAttribute('aria-label', 'Open settings');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'settingsSheet');
      btn.innerHTML = '<svg class="settings-orbit-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2"></circle><circle cx="12" cy="12" r="2.3"></circle></svg>';
      document.body.appendChild(btn);
    }
    const bottomBtn = document.getElementById('btnSettings');
    let backdrop = document.getElementById('settingsSheetBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'settingsSheetBackdrop';
      backdrop.className = 'settings-sheet-backdrop';
      backdrop.hidden = true;
      document.body.appendChild(backdrop);
    }
    let sheet = document.getElementById('settingsSheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'settingsSheet';
      sheet.className = 'settings-sheet';
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'true');
      sheet.hidden = true;
      sheet.innerHTML =
        '<div class="settings-sheet-header">' +
        '  <span class="settings-sheet-title" id="settingsSheetTitle">Customize</span>' +
        '  <button type="button" class="settings-sheet-close" id="settingsSheetClose" aria-label="Close">\u00D7</button>' +
        '</div><div class="settings-sheet-body" id="settingsSheetBody"></div>';
      document.body.appendChild(sheet);
    }
    return { btn, sheet, backdrop, bottomBtn };
  }

  function buildBody(state) {
    const body = document.getElementById('settingsSheetBody');
    if (!body) return;
    body.innerHTML = '';
    const cat = catalog();

    const app = document.createElement('section');
    app.className = 'settings-section';
    app.innerHTML =
      '<div class="settings-section-label">Appearance</div>' +
      '<div class="settings-row">' +
      '  <span class="settings-row-label">Light mode</span>' +
      '  <label class="settings-toggle"><input type="checkbox" id="settingLightMode" /><span class="settings-toggle-track"></span></label>' +
      '</div>' +
      '<div class="settings-row settings-row-touch-feedback">' +
      '  <div class="settings-row-copy"><span class="settings-row-label">Touch ripples</span><span class="settings-row-hint">Expanding rings + haptic feedback</span></div>' +
      '  <label class="settings-toggle"><input type="checkbox" id="settingTouchFeedback" /><span class="settings-toggle-track"></span></label>' +
      '</div>';
    body.appendChild(app);

    const trSec = document.createElement('section');
    trSec.className = 'settings-section';
    trSec.innerHTML =
      '<div class="settings-section-label">Handpan transparency</div>' +
      '<div class="settings-row settings-slider-row">' +
      '  <input type="range" id="settingTransparency" min="35" max="100" value="' + Math.round(state.transparency * 100) + '" />' +
      '  <span class="settings-rgb-val" id="settingTransparencyVal">' + Math.round(state.transparency * 100) + '%</span>' +
      '</div>';
    body.appendChild(trSec);

    const ambSec = document.createElement('section');
    ambSec.className = 'settings-section';
    ambSec.innerHTML = '<div class="settings-section-label">Background atmosphere</div>';
    body.appendChild(ambSec);
    buildDropdown(ambSec, {
      id: 'settingAmbient',
      label: 'Ambient',
      items: cat.AMBIENTS,
      activeId: state.ambient,
      onPick: (id) => { state.ambient = id; save(state); apply(state); },
    });

    const light = document.getElementById('settingLightMode');
    if (light) {
      light.checked = resolveLightMode(state);
      light.addEventListener('change', () => { state.lightMode = light.checked; save(state); apply(state); });
    }
    const touchFeedback = document.getElementById('settingTouchFeedback');
    if (touchFeedback) {
      touchFeedback.checked = state.touchFeedback === true;
      touchFeedback.addEventListener('change', () => {
        state.touchFeedback = touchFeedback.checked;
        save(state); apply(state);
      });
    }
    const tr = document.getElementById('settingTransparency');
    const trVal = document.getElementById('settingTransparencyVal');
    function syncRangeFill(el) {
      if (!el) return;
      const min = Number(el.min) || 0;
      const max = Number(el.max) || 100;
      const val = Number(el.value);
      const pct = max === min ? 0 : ((val - min) / (max - min)) * 100;
      el.style.setProperty('--range-fill', pct + '%');
    }
    if (tr) {
      syncRangeFill(tr);
      tr.addEventListener('input', () => {
        state.transparency = Number(tr.value) / 100;
        if (trVal) trVal.textContent = tr.value + '%';
        syncRangeFill(tr);
        save(state); apply(state);
        try { window.PionierCore?.draw?.(); } catch (_) {}
      });
    }
  }

  function openSheet(els, state) {
    const fx = document.getElementById('fxPanel');
    if (fx && !fx.hidden) {
      fx.hidden = true;
      document.getElementById('fxPanelOpen')?.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('is-fx-open');
    }
    document.getElementById('soundscapesPanel')?.setAttribute('hidden', '');
    document.body.classList.remove('soundscapes-active');
    buildBody(state);
    els.sheet.hidden = false;
    els.sheet.removeAttribute('hidden');
    els.backdrop.hidden = false;
    els.backdrop.removeAttribute('hidden');
    requestAnimationFrame(() => els.sheet.classList.add('is-open'));
    els.btn.setAttribute('aria-expanded', 'true');
  }

  function closeSheet(els) {
    closeMenus();
    els.sheet.classList.remove('is-open');
    els.btn.setAttribute('aria-expanded', 'false');
    setTimeout(() => {
      els.sheet.hidden = true;
      els.backdrop.hidden = true;
    }, 220);
  }

  function wire(state, els) {
    const open = () => openSheet(els, state);
    els.btn.addEventListener('click', (e) => { e.preventDefault(); open(); });
    if (els.bottomBtn) els.bottomBtn.addEventListener('click', (e) => { e.preventDefault(); open(); });
    document.getElementById('settingsSheetClose')?.addEventListener('click', () => closeSheet(els));
    els.backdrop.addEventListener('click', () => closeSheet(els));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(els); });
    document.addEventListener('pointerdown', (e) => {
      if (!openMenuEl) return;
      const t = e.target;
      if (t && (openMenuEl.contains(t) || (openToggleEl && openToggleEl.contains(t)))) return;
      closeMenus();
    }, true);
  }

  function boot() {
    const state = load();
    apply(state);
    const els = ensureDom();
    wire(state, els);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 300);
})();
