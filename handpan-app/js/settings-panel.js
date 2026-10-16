/**
 * settings-panel.js — premium customization sheet
 * Dropdowns match instrument/scale pickers (large, clear, reliable).
 */
(function settingsPanel() {
  const STORAGE_KEY = 'pionier.settings.v2';

  const DEFAULTS = {
    lightMode: false,
    skin: 'classic',
    ambient: 'none',
    tonefield: 'classic',
    transparency: 1,
    mandala: true,
    led: { r: 110, g: 200, b: 255, strength: 0.35 },
  };

  function catalog() {
    const c = window.PionierCatalog || {};
    return {
      SKINS: c.SKINS || [{ id: 'classic', label: 'Classic' }],
      AMBIENTS: c.AMBIENTS || [{ id: 'none', label: 'None' }],
      TONEFIELDS: c.TONEFIELDS || [{ id: 'classic', label: 'Classic Oval' }],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('pionier.settings.v1');
      if (!raw) return { ...DEFAULTS, led: { ...DEFAULTS.led } };
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULTS,
        ...parsed,
        led: { ...DEFAULTS.led, ...(parsed.led || {}) },
        transparency: parsed.transparency != null ? Number(parsed.transparency) : 1,
      };
    } catch {
      return { ...DEFAULTS, led: { ...DEFAULTS.led } };
    }
  }

  function save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function apply(state) {
    document.documentElement.classList.toggle('theme-light', !!state.lightMode);
    document.documentElement.dataset.skin = state.skin || 'classic';
    document.documentElement.dataset.ambient = state.ambient || 'none';
    document.documentElement.dataset.tonefield = state.tonefield || 'classic';

    const led = state.led;
    document.documentElement.style.setProperty('--led-color', 'rgb(' + led.r + ',' + led.g + ',' + led.b + ')');
    document.documentElement.style.setProperty('--led-strength', String(led.strength));
    document.documentElement.style.setProperty('--handpan-alpha', String(state.transparency));

    window.PionierSettings = {
      get: () => ({ ...state, led: { ...state.led } }),
      skin: state.skin,
      ambient: state.ambient,
      tonefield: state.tonefield,
      transparency: state.transparency,
      mandala: state.mandala,
      lightMode: state.lightMode,
      led: { ...state.led },
    };

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.lightMode ? '#e8e6e1' : '#070708');

    window.dispatchEvent(new CustomEvent('pionier:settings', {
      detail: { ...state, led: { ...state.led } },
    }));
  }

  function labelFor(list, id) {
    const hit = list.find((x) => x.id === id);
    return hit ? hit.label : id;
  }

  let openMenuEl = null;
  let openToggleEl = null;

  function closeMenus() {
    if (openMenuEl) {
      openMenuEl.hidden = true;
      openMenuEl.classList.remove('is-open');
      openMenuEl = null;
    }
    if (openToggleEl) {
      openToggleEl.setAttribute('aria-expanded', 'false');
      openToggleEl = null;
    }
    document.querySelectorAll('.settings-dd-toggle[aria-expanded="true"]').forEach((t) => {
      t.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.settings-dd-menu.is-open').forEach((m) => {
      m.hidden = true;
      m.classList.remove('is-open');
    });
  }

  function positionMenu(menu, toggle) {
    const rect = toggle.getBoundingClientRect();
    const maxH = Math.min(window.innerHeight * 0.5, 360);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const width = Math.max(rect.width, Math.min(320, window.innerWidth - 24));
    let left = rect.left;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - 12 - width;
    if (left < 12) left = 12;

    menu.style.position = 'fixed';
    menu.style.zIndex = '3200';
    menu.style.width = width + 'px';
    menu.style.left = left + 'px';
    menu.style.maxHeight = Math.min(maxH, openUp ? spaceAbove : spaceBelow) + 'px';
    if (openUp) {
      menu.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
      menu.style.top = 'auto';
    } else {
      menu.style.top = (rect.bottom + 6) + 'px';
      menu.style.bottom = 'auto';
    }
  }

  function buildDropdown(sectionEl, { id, label, items, activeId, onPick }) {
    const row = document.createElement('div');
    row.className = 'settings-dd';
    row.innerHTML =
      '<div class="settings-dd-label">' + label + '</div>' +
      '<button type="button" class="settings-dd-toggle" id="' + id + 'Toggle" ' +
      'aria-haspopup="listbox" aria-expanded="false" aria-controls="' + id + 'Menu">' +
      '<span class="settings-dd-value" id="' + id + 'Value">' + labelFor(items, activeId) + '</span>' +
      '<span class="settings-dd-chevron" aria-hidden="true">▾</span>' +
      '</button>';
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
          e.preventDefault();
          e.stopPropagation();
          activeId = item.id;
          valueEl.textContent = item.label;
          onPick(item.id);
          closeMenus();
        });
        menu.appendChild(b);
      });
    }

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const wasOpen = openMenuEl === menu && !menu.hidden;
      closeMenus();
      if (wasOpen) return;
      renderMenu();
      positionMenu(menu, toggle);
      menu.hidden = false;
      menu.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      openMenuEl = menu;
      openToggleEl = toggle;
    });

    return {
      setActive(idNext) {
        activeId = idNext;
        valueEl.textContent = labelFor(items, idNext);
      },
    };
  }

  function ensureDom() {
    // Prefer a fixed top-right gear so settings work without the Controls drawer.
    let btn = document.getElementById('settingsOpenBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'settingsOpenBtn';
      btn.className = 'settings-open-btn';
      btn.setAttribute('aria-label', 'Open settings');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'settingsSheet');
      btn.innerHTML = '⚙';
      document.body.appendChild(btn);
    }
    btn.hidden = false;
    btn.style.display = '';
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
      sheet.setAttribute('aria-labelledby', 'settingsSheetTitle');
      sheet.hidden = true;
      sheet.innerHTML =
        '<div class="settings-sheet-header">' +
        '  <span class="settings-sheet-title" id="settingsSheetTitle">Customize</span>' +
        '  <button type="button" class="settings-sheet-close" id="settingsSheetClose" aria-label="Close">×</button>' +
        '</div>' +
        '<div class="settings-sheet-body" id="settingsSheetBody"></div>';
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
      '<div class="settings-row">' +
      '  <span class="settings-row-label">Mandala aura</span>' +
      '  <label class="settings-toggle"><input type="checkbox" id="settingMandala" /><span class="settings-toggle-track"></span></label>' +
      '</div>';
    body.appendChild(app);

    const skinSec = document.createElement('section');
    skinSec.className = 'settings-section';
    skinSec.innerHTML = '<div class="settings-section-label">Handpan skin</div>';
    body.appendChild(skinSec);
    buildDropdown(skinSec, {
      id: 'settingSkin',
      label: 'Skin',
      items: cat.SKINS,
      activeId: state.skin,
      onPick: (id) => { state.skin = id; save(state); apply(state); },
    });

    const tfSec = document.createElement('section');
    tfSec.className = 'settings-section';
    tfSec.innerHTML = '<div class="settings-section-label">Tonefields</div>';
    body.appendChild(tfSec);
    buildDropdown(tfSec, {
      id: 'settingTonefield',
      label: 'Shape',
      items: cat.TONEFIELDS,
      activeId: state.tonefield,
      onPick: (id) => { state.tonefield = id; save(state); apply(state); },
    });

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

    const ledSec = document.createElement('section');
    ledSec.className = 'settings-section';
    ledSec.innerHTML =
      '<div class="settings-section-label">LED color</div>' +
      '<div class="settings-row"><span class="settings-row-label">Preview</span><span class="settings-led-preview" id="settingLedPreview" aria-hidden="true"></span></div>' +
      '<div class="settings-rgb-grid">' +
      '  <label for="ledR">R</label><input type="range" id="ledR" min="0" max="255" /><span class="settings-rgb-val" id="ledRVal">0</span>' +
      '  <label for="ledG">G</label><input type="range" id="ledG" min="0" max="255" /><span class="settings-rgb-val" id="ledGVal">0</span>' +
      '  <label for="ledB">B</label><input type="range" id="ledB" min="0" max="255" /><span class="settings-rgb-val" id="ledBVal">0</span>' +
      '  <label for="ledStrength">Glow</label><input type="range" id="ledStrength" min="0" max="100" /><span class="settings-rgb-val" id="ledStrengthVal">0%</span>' +
      '</div>';
    body.appendChild(ledSec);

    const light = document.getElementById('settingLightMode');
    if (light) {
      light.checked = !!state.lightMode;
      light.addEventListener('change', () => { state.lightMode = light.checked; save(state); apply(state); });
    }
    const mandala = document.getElementById('settingMandala');
    if (mandala) {
      mandala.checked = state.mandala !== false;
      mandala.addEventListener('change', () => { state.mandala = mandala.checked; save(state); apply(state); });
    }
    const tr = document.getElementById('settingTransparency');
    const trVal = document.getElementById('settingTransparencyVal');
    if (tr) {
      tr.addEventListener('input', () => {
        state.transparency = Number(tr.value) / 100;
        if (trVal) trVal.textContent = tr.value + '%';
        save(state); apply(state);
      });
    }

    const bindLed = (id, key, scale) => {
      const input = document.getElementById(id);
      const label = document.getElementById(id + 'Val');
      if (!input) return;
      const val = scale ? Math.round(state.led[key] * 100) : state.led[key];
      input.value = String(val);
      if (label) label.textContent = scale ? val + '%' : String(val);
      input.addEventListener('input', () => {
        const n = Number(input.value);
        state.led[key] = scale ? n / 100 : n;
        if (label) label.textContent = scale ? n + '%' : String(n);
        const preview = document.getElementById('settingLedPreview');
        if (preview) {
          preview.style.background = 'rgb(' + state.led.r + ',' + state.led.g + ',' + state.led.b + ')';
          preview.style.boxShadow = '0 0 16px rgb(' + state.led.r + ',' + state.led.g + ',' + state.led.b + ')';
        }
        save(state); apply(state);
      });
    };
    bindLed('ledR', 'r');
    bindLed('ledG', 'g');
    bindLed('ledB', 'b');
    bindLed('ledStrength', 'strength', true);
    const preview = document.getElementById('settingLedPreview');
    if (preview) {
      preview.style.background = 'rgb(' + state.led.r + ',' + state.led.g + ',' + state.led.b + ')';
      preview.style.boxShadow = '0 0 16px rgb(' + state.led.r + ',' + state.led.g + ',' + state.led.b + ')';
    }
  }

  function openSheet(els, state) {
    buildBody(state);
    els.sheet.hidden = false;
    els.backdrop.hidden = false;
    requestAnimationFrame(() => {
      els.sheet.classList.add('is-open');
      els.backdrop.classList.add('is-open');
    });
    if (els.btn) els.btn.setAttribute('aria-expanded', 'true');
  }

  function closeSheet(els) {
    closeMenus();
    els.sheet.classList.remove('is-open');
    els.backdrop.classList.remove('is-open');
    if (els.btn) els.btn.setAttribute('aria-expanded', 'false');
    setTimeout(() => {
      if (!els.sheet.classList.contains('is-open')) {
        els.sheet.hidden = true;
        els.backdrop.hidden = true;
      }
    }, 320);
  }

  function wire(state, els) {
    const open = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const drawer = document.getElementById('mobileControlDrawer');
      if (drawer && drawer.classList.contains('is-open')) {
        drawer.classList.remove('is-open');
        document.getElementById('mobileControlsToggle')?.setAttribute('aria-expanded', 'false');
      }
      if (els.sheet.classList.contains('is-open')) closeSheet(els);
      else openSheet(els, state);
    };

    if (els.btn && !els.btn.dataset.wired) {
      els.btn.dataset.wired = '1';
      els.btn.addEventListener('click', open);
    }
    if (els.bottomBtn && !els.bottomBtn.dataset.wired) {
      els.bottomBtn.dataset.wired = '1';
      els.bottomBtn.addEventListener('click', open);
    }

    document.getElementById('settingsSheetClose')?.addEventListener('click', () => closeSheet(els));
    els.backdrop.addEventListener('click', () => closeSheet(els));

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.settings-dd-toggle') && !e.target.closest('.settings-dd-menu')) {
        closeMenus();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (openMenuEl) closeMenus();
        else if (els.sheet.classList.contains('is-open')) closeSheet(els);
      }
    });
    window.addEventListener('resize', () => closeMenus());
  }

  function boot() {
    const state = load();
    apply(state);
    const els = ensureDom();
    if (!els) { setTimeout(boot, 200); return; }
    wire(state, els);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 300);
})();
