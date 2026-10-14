/**
 * settings-panel.js
 * Settings gear on the CONTROLS bar → sheet with:
 *   - Light mode
 *   - Handpan skins (preference stored; surface can read later)
 *   - Ambient templates (preference)
 *   - LED RGB controls (CSS vars + soft stage glow)
 */
(function settingsPanel() {
  const STORAGE_KEY = 'pionier.settings.v1';

  const DEFAULTS = {
    lightMode: false,
    skin: 'classic',
    ambient: 'none',
    led: { r: 110, g: 200, b: 255, strength: 0.35 },
  };

  const SKINS = [
    { id: 'classic', label: 'Classic' },
    { id: 'bronze', label: 'Bronze' },
    { id: 'steel', label: 'Steel' },
    { id: 'obsidian', label: 'Obsidian' },
  ];

  const AMBIENTS = [
    { id: 'none', label: 'None' },
    { id: 'forest', label: 'Forest' },
    { id: 'rain', label: 'Rain' },
    { id: 'night', label: 'Night' },
    { id: 'fire', label: 'Fire' },
  ];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS, led: { ...DEFAULTS.led } };
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULTS,
        ...parsed,
        led: { ...DEFAULTS.led, ...(parsed.led || {}) },
      };
    } catch {
      return { ...DEFAULTS, led: { ...DEFAULTS.led } };
    }
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }

  function ledCss(led) {
    const { r, g, b, strength } = led;
    return {
      color: `rgb(${r}, ${g}, ${b})`,
      strength: String(strength),
    };
  }

  function apply(state) {
    document.documentElement.classList.toggle('theme-light', !!state.lightMode);
    document.documentElement.dataset.skin = state.skin || 'classic';
    document.documentElement.dataset.ambient = state.ambient || 'none';

    const { color, strength } = ledCss(state.led);
    document.documentElement.style.setProperty('--led-color', color);
    document.documentElement.style.setProperty('--led-strength', strength);

    // Expose for surface / future modules
    window.PionierSettings = {
      get: () => ({ ...state, led: { ...state.led } }),
      skin: state.skin,
      ambient: state.ambient,
      lightMode: state.lightMode,
      led: { ...state.led },
    };

    // Theme-color meta
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.lightMode ? '#e8e6e1' : '#070708');

    window.dispatchEvent(new CustomEvent('pionier:settings', { detail: { ...state, led: { ...state.led } } }));
  }

  function ensureDom() {
    const drawer = document.getElementById('mobileControlDrawer');
    if (!drawer) return null;

    // Wrap toggle in bar if needed
    let bar = drawer.querySelector('.mobile-controls-bar');
    const toggle = document.getElementById('mobileControlsToggle');
    if (!bar && toggle) {
      bar = document.createElement('div');
      bar.className = 'mobile-controls-bar';
      toggle.parentElement.insertBefore(bar, toggle);
      bar.appendChild(toggle);
    }

    let btn = document.getElementById('settingsOpenBtn');
    if (!btn && bar) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'settingsOpenBtn';
      btn.className = 'settings-open-btn';
      btn.setAttribute('aria-label', 'Open settings');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'settingsSheet');
      btn.innerHTML = '⚙';
      bar.appendChild(btn);
    }

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
      sheet.innerHTML = `
        <div class="settings-sheet-header">
          <span class="settings-sheet-title" id="settingsSheetTitle">Settings</span>
          <button type="button" class="settings-sheet-close" id="settingsSheetClose" aria-label="Close settings">×</button>
        </div>
        <div class="settings-sheet-body">
          <section class="settings-section" aria-label="Appearance">
            <div class="settings-section-label">Appearance</div>
            <div class="settings-row">
              <span class="settings-row-label">Light mode</span>
              <label class="settings-toggle">
                <input type="checkbox" id="settingLightMode" />
                <span class="settings-toggle-track"></span>
              </label>
            </div>
          </section>

          <section class="settings-section" aria-label="Handpan skins">
            <div class="settings-section-label">Handpan skin</div>
            <div class="settings-chips" id="settingSkinChips"></div>
          </section>

          <section class="settings-section" aria-label="Ambient templates">
            <div class="settings-section-label">Ambient</div>
            <div class="settings-chips" id="settingAmbientChips"></div>
          </section>

          <section class="settings-section" aria-label="LED color">
            <div class="settings-section-label">LED color</div>
            <div class="settings-row">
              <span class="settings-row-label">Preview</span>
              <span class="settings-led-preview" id="settingLedPreview" aria-hidden="true"></span>
            </div>
            <div class="settings-rgb-grid">
              <label for="ledR">R</label>
              <input type="range" id="ledR" min="0" max="255" />
              <span class="settings-rgb-val" id="ledRVal">0</span>
              <label for="ledG">G</label>
              <input type="range" id="ledG" min="0" max="255" />
              <span class="settings-rgb-val" id="ledGVal">0</span>
              <label for="ledB">B</label>
              <input type="range" id="ledB" min="0" max="255" />
              <span class="settings-rgb-val" id="ledBVal">0</span>
              <label for="ledStrength">Glow</label>
              <input type="range" id="ledStrength" min="0" max="100" />
              <span class="settings-rgb-val" id="ledStrengthVal">0%</span>
            </div>
          </section>
        </div>
      `;
      document.body.appendChild(sheet);
    }

    return { bar, btn, sheet, backdrop };
  }

  function fillChips(container, items, activeId, onPick) {
    if (!container) return;
    container.innerHTML = '';
    items.forEach((item) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'settings-chip' + (item.id === activeId ? ' is-active' : '');
      b.textContent = item.label;
      b.dataset.id = item.id;
      b.addEventListener('click', () => onPick(item.id));
      container.appendChild(b);
    });
  }

  function syncUi(state, els) {
    const light = document.getElementById('settingLightMode');
    if (light) light.checked = !!state.lightMode;

    fillChips(document.getElementById('settingSkinChips'), SKINS, state.skin, (id) => {
      state.skin = id;
      save(state);
      apply(state);
      syncUi(state, els);
    });

    fillChips(document.getElementById('settingAmbientChips'), AMBIENTS, state.ambient, (id) => {
      state.ambient = id;
      save(state);
      apply(state);
      syncUi(state, els);
    });

    const { r, g, b, strength } = state.led;
    const setRange = (id, valId, val, fmt) => {
      const input = document.getElementById(id);
      const label = document.getElementById(valId);
      if (input) input.value = String(val);
      if (label) label.textContent = fmt ? fmt(val) : String(val);
    };
    setRange('ledR', 'ledRVal', r);
    setRange('ledG', 'ledGVal', g);
    setRange('ledB', 'ledBVal', b);
    setRange('ledStrength', 'ledStrengthVal', Math.round(strength * 100), (v) => v + '%');

    const preview = document.getElementById('settingLedPreview');
    if (preview) {
      preview.style.background = `rgb(${r},${g},${b})`;
      preview.style.boxShadow = `0 0 16px rgb(${r},${g},${b})`;
    }
  }

  function openSheet(els, state) {
    els.sheet.hidden = false;
    els.backdrop.hidden = false;
    requestAnimationFrame(() => {
      els.sheet.classList.add('is-open');
      els.backdrop.classList.add('is-open');
    });
    if (els.btn) els.btn.setAttribute('aria-expanded', 'true');
    syncUi(state, els);
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
    if (els.btn && !els.btn.dataset.wired) {
      els.btn.dataset.wired = '1';
      els.btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close controls drawer if open so sheets don't stack awkwardly
        const drawer = document.getElementById('mobileControlDrawer');
        if (drawer?.classList.contains('is-open')) {
          drawer.classList.remove('is-open');
          document.getElementById('mobileControlsToggle')?.setAttribute('aria-expanded', 'false');
        }
        if (els.sheet.classList.contains('is-open')) closeSheet(els);
        else openSheet(els, state);
      });
    }

    document.getElementById('settingsSheetClose')?.addEventListener('click', () => closeSheet(els));
    els.backdrop.addEventListener('click', () => closeSheet(els));

    document.getElementById('settingLightMode')?.addEventListener('change', (e) => {
      state.lightMode = !!e.target.checked;
      save(state);
      apply(state);
    });

    const bindLed = (id, key, scale) => {
      const input = document.getElementById(id);
      if (!input || input.dataset.wired) return;
      input.dataset.wired = '1';
      input.addEventListener('input', () => {
        const n = Number(input.value);
        state.led[key] = scale ? n / 100 : n;
        save(state);
        apply(state);
        syncUi(state, els);
      });
    };
    bindLed('ledR', 'r');
    bindLed('ledG', 'g');
    bindLed('ledB', 'b');
    bindLed('ledStrength', 'strength', true);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.sheet.classList.contains('is-open')) closeSheet(els);
    });
  }

  function boot() {
    const state = load();
    apply(state);
    const els = ensureDom();
    if (!els) return;
    wire(state, els);
    syncUi(state, els);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setTimeout(boot, 400);
  setTimeout(boot, 1200);
})();
