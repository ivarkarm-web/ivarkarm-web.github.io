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
    auraStyle: 'petals',
    touchFeedback: false,
    rippleStyle: 'ambient',
    led: { r: 110, g: 200, b: 255, strength: 0.35 },
  };

  function catalog() {
    const c = window.PionierCatalog || {};
    return {
      SKINS: c.SKINS || [{ id: 'classic', label: 'Classic' }],
      AMBIENTS: c.AMBIENTS || [{ id: 'none', label: 'None' }],
      TONEFIELDS: c.TONEFIELDS || [{ id: 'classic', label: 'Classic Oval' }],
      AURAS: c.AURAS || [{ id: 'petals', label: 'Petal Crown' }],
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
    document.documentElement.classList.toggle('dark', !state.lightMode);
    document.body.classList.toggle('theme-light', !!state.lightMode);
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
      auraStyle: state.auraStyle || 'petals',
      touchFeedback: state.touchFeedback === true,
      rippleStyle: state.rippleStyle || 'ambient',
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

  function buildDropdown(sectionEl, { id, label, items, activeId, onPick }) {
    const row = document.createElement('div');
    row.className = 'settings-dd';
    const labelEl = document.createElement('label');
    labelEl.className = 'settings-dd-label';
    labelEl.htmlFor = id + 'Select';
    labelEl.textContent = label;
    const select = document.createElement('select');
    select.id = id + 'Select';
    select.className = 'pionier-select settings-native-select';
    select.setAttribute('aria-label', label);
    let lastGroup = null, group = null;
    items.forEach((item) => {
      if (item.group) {
        if (item.group !== lastGroup) {
          lastGroup = item.group;
          group = document.createElement('optgroup');
          group.label = item.group;
          select.appendChild(group);
        }
      } else {
        lastGroup = null;
        group = null;
      }
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.label;
      (group || select).appendChild(option);
    });
    select.value = activeId;
    select.addEventListener('change', () => {
      activeId = select.value;
      onPick(activeId);
    });
    row.append(labelEl, select);
    sectionEl.appendChild(row);
    return { setActive(idNext) { activeId = idNext; select.value = idNext; } };
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
      '</div>' +
      '<div class="settings-row settings-row-touch-feedback">' +
      '  <div class="settings-row-copy"><span class="settings-row-label">Touch ripples</span><span class="settings-row-hint">Expanding rings + haptic feedback</span></div>' +
      '  <label class="settings-toggle"><input type="checkbox" id="settingTouchFeedback" /><span class="settings-toggle-track"></span></label>' +
      '</div>';
    body.appendChild(app);

    const auraSec = document.createElement('section');
    auraSec.className = 'settings-section';
    auraSec.innerHTML = '<div class="settings-section-label">Rim aura style</div>';
    body.appendChild(auraSec);
    buildDropdown(auraSec, {
      id: 'settingAuraStyle',
      label: 'Aura',
      items: cat.AURAS,
      activeId: state.auraStyle || 'petals',
      onPick: (id) => { state.auraStyle = id; save(state); apply(state); },
    });

    const rippleStyleSec = document.createElement('section');
    rippleStyleSec.className = 'settings-section';
    rippleStyleSec.innerHTML = '<div class="settings-section-label">Touch ripple style</div>';
    body.appendChild(rippleStyleSec);
    buildDropdown(rippleStyleSec, {
      id: 'settingRippleStyle',
      label: 'Ripple',
      items: [
        { id: 'ambient', label: 'Ambient Rings' },
        { id: 'halo', label: 'Soft Halo' },
        { id: 'double-wave', label: 'Double Wave' },
        { id: 'liquid', label: 'Liquid' },
        { id: 'pulse', label: 'Pulse Bloom' },
      ],
      activeId: state.rippleStyle || 'ambient',
      onPick: (id) => { state.rippleStyle = id; save(state); apply(state); },
    });

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

    body.querySelectorAll('input[type="range"]').forEach(syncRangeFill);

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
    const touchFeedback = document.getElementById('settingTouchFeedback');
    if (touchFeedback) {
      touchFeedback.checked = state.touchFeedback === true;
      touchFeedback.addEventListener('change', () => {
        state.touchFeedback = touchFeedback.checked;
        save(state);
        apply(state);
      });
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

  function syncRangeFill(input) {
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const value = Number(input.value || 0);
    const pct = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
    input.style.setProperty('--range-fill', pct + '%');
  }

  // Keep the visual track in sync during touch drags without layout work.
  document.addEventListener('input', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.type === 'range' && input.closest('.settings-sheet')) {
      syncRangeFill(input);
    }
  }, { passive: true });

  function openSheet(els, state) {
    // Single open-panel policy: close FX / soundscapes when Settings opens
    const fx = document.getElementById('fxPanel');
    if (fx && !fx.hidden) {
      fx.hidden = true;
      document.getElementById('fxPanelOpen')?.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('is-fx-open');
    }
    document.getElementById('soundscapesPanel')?.setAttribute('hidden', '');
    document.body.classList.remove('soundscapes-active');
    buildBody(state);
    // Recover empty sheet (e.g. catalog raced or body was cleared)
    const body = document.getElementById('settingsSheetBody');
    if (body && body.children.length === 0) buildBody(state);
    els.sheet.hidden = false;
    els.sheet.removeAttribute('hidden');
    els.backdrop.hidden = false;
    els.backdrop.removeAttribute('hidden');
    requestAnimationFrame(() => {
      els.sheet.classList.add('is-open');
      els.backdrop.classList.add('is-open');
    });
    if (els.btn) els.btn.setAttribute('aria-expanded', 'true');
  }

  function closeSheet(els) {
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
    if (window.__settingsPanelWired) {
      // Still (re)bind open buttons below; skip document-level listeners
    }
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

    if (!window.__settingsPanelWired) {
      window.__settingsPanelWired = true;
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !document.getElementById('settingsSheet')?.classList.contains('is-open')) return;
        closeSheet(els);
      });
    }
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
