/**
 * favorites.js — heart favorites for scales & instruments
 * Storage: pionier.favorites.v1
 */
(function pionierFavorites() {
  const STORAGE_KEY = 'pionier.favorites.v1';
  const HEART = '\u2665';
  const HEART_OUTLINE = '\u2661';

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { scales: [], instruments: [] };
      const p = JSON.parse(raw);
      return {
        scales: Array.isArray(p.scales) ? p.scales : [],
        instruments: Array.isArray(p.instruments) ? p.instruments : [],
      };
    } catch (_) {
      return { scales: [], instruments: [] };
    }
  }

  function save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  let state = load();

  function isScaleFav(id) {
    return state.scales.some((x) => x.id === id);
  }
  function isInstrumentFav(id) {
    return state.instruments.some((x) => x.id === id);
  }

  function toggleScale(entry) {
    if (!entry || !entry.id) return false;
    const i = state.scales.findIndex((x) => x.id === entry.id);
    if (i >= 0) state.scales.splice(i, 1);
    else state.scales.unshift({ id: entry.id, label: entry.label || entry.id, index: entry.index });
    save(state);
    refreshUI();
    return isScaleFav(entry.id);
  }

  function toggleInstrument(entry) {
    if (!entry || !entry.id) return false;
    const i = state.instruments.findIndex((x) => x.id === entry.id);
    if (i >= 0) state.instruments.splice(i, 1);
    else state.instruments.unshift({ id: entry.id, name: entry.name || entry.id });
    save(state);
    refreshUI();
    return isInstrumentFav(entry.id);
  }

  function makeHeartBtn(active, aria, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fav-heart-btn' + (active ? ' is-fav' : '');
    b.setAttribute('aria-label', aria);
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
    b.textContent = active ? HEART : HEART_OUTLINE;
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    });
    return b;
  }

  function decorateScaleItem(button, scale, index) {
    if (!button || !scale) return;
    const row = button.parentElement;
    const menuRow = !!(row && row.classList.contains('scale-menu-row'));
    const existing = (menuRow ? row : button).querySelector('.fav-heart-btn');
    if (existing) existing.remove();
    const id = scale.id || ('scale-' + index);
    const active = isScaleFav(id);
    const heart = makeHeartBtn(active, active ? 'Remove from favorites' : 'Add to favorites', () => {
      const now = toggleScale({ id, label: scale.label || scale.short || id, index });
      heart.classList.toggle('is-fav', now);
      if (heart.getAttribute('role') === 'menuitemcheckbox') heart.setAttribute('aria-checked', String(now));
      else heart.setAttribute('aria-pressed', String(now));
      heart.textContent = now ? HEART : HEART_OUTLINE;
    });
    if (menuRow) {
      heart.setAttribute('role', 'menuitemcheckbox');
      heart.setAttribute('aria-checked', String(active));
      heart.removeAttribute('aria-pressed');
      row.appendChild(heart);
    } else {
      button.classList.add('fav-row');
      button.appendChild(heart);
    }
  }

  function decorateInstrumentItem(button, item) {
    if (!button || !item || !item.id) return;
    const row = button.parentElement;
    const menuRow = !!(row && row.classList.contains('instrument-menu-row'));
    const existing = (menuRow ? row : button).querySelector('.fav-heart-btn');
    if (existing) existing.remove();
    const active = isInstrumentFav(item.id);
    const heart = makeHeartBtn(active, active ? 'Remove from favorites' : 'Add to favorites', () => {
      const now = toggleInstrument({ id: item.id, name: item.name || item.id });
      heart.classList.toggle('is-fav', now);
      if (heart.getAttribute('role') === 'menuitemcheckbox') heart.setAttribute('aria-checked', String(now));
      else heart.setAttribute('aria-pressed', String(now));
      heart.textContent = now ? HEART : HEART_OUTLINE;
    });
    if (menuRow) {
      heart.setAttribute('role', 'menuitemcheckbox');
      heart.setAttribute('aria-checked', String(active));
      heart.removeAttribute('aria-pressed');
      row.appendChild(heart);
    } else {
      button.classList.add('fav-row');
      button.appendChild(heart);
    }
  }

  function ensureDom() {
    let btn = document.getElementById('favoritesOpenBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'favoritesOpenBtn';
      btn.className = 'favorites-open-btn';
      btn.setAttribute('aria-label', 'Open favorites');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<span class="favorites-open-icon" aria-hidden="true">' + HEART + '</span>';
      document.body.appendChild(btn);
    }
    let backdrop = document.getElementById('favoritesSheetBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'favoritesSheetBackdrop';
      backdrop.className = 'favorites-sheet-backdrop';
      backdrop.hidden = true;
      document.body.appendChild(backdrop);
    }
    let sheet = document.getElementById('favoritesSheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'favoritesSheet';
      sheet.className = 'favorites-sheet';
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'true');
      sheet.setAttribute('aria-labelledby', 'favoritesSheetTitle');
      sheet.hidden = true;
      sheet.innerHTML =
        '<div class="favorites-sheet-header">' +
        '  <span class="favorites-sheet-title" id="favoritesSheetTitle">Favorites</span>' +
        '  <button type="button" class="favorites-sheet-close" id="favoritesSheetClose" aria-label="Close">\u00D7</button>' +
        '</div>' +
        '<div class="favorites-sheet-body" id="favoritesSheetBody"></div>';
      document.body.appendChild(sheet);
    }
    return { btn, sheet, backdrop };
  }

  function buildBody() {
    const body = document.getElementById('favoritesSheetBody');
    if (!body) return;
    body.innerHTML = '';

    const instSec = document.createElement('section');
    instSec.className = 'favorites-section';
    instSec.innerHTML = '<div class="favorites-section-label">Instruments</div>';
    body.appendChild(instSec);
    if (!state.instruments.length) {
      const empty = document.createElement('p');
      empty.className = 'favorites-empty';
      empty.textContent = 'Tap the heart next to an instrument to save it here.';
      instSec.appendChild(empty);
    } else {
      state.instruments.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'favorites-row';
        const pick = document.createElement('button');
        pick.type = 'button';
        pick.className = 'favorites-row-main';
        pick.textContent = item.name || item.id;
        pick.addEventListener('click', () => {
          window.PionierCore?.setInstrument?.(item.id)?.catch?.(() => {});
          closeSheet();
        });
        const heart = makeHeartBtn(true, 'Remove from favorites', () => {
          toggleInstrument(item);
          buildBody();
        });
        row.appendChild(pick);
        row.appendChild(heart);
        instSec.appendChild(row);
      });
    }

    const scaleSec = document.createElement('section');
    scaleSec.className = 'favorites-section';
    scaleSec.innerHTML = '<div class="favorites-section-label">Scales</div>';
    body.appendChild(scaleSec);
    if (!state.scales.length) {
      const empty = document.createElement('p');
      empty.className = 'favorites-empty';
      empty.textContent = 'Tap the heart next to a scale to save it here.';
      scaleSec.appendChild(empty);
    } else {
      state.scales.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'favorites-row';
        const pick = document.createElement('button');
        pick.type = 'button';
        pick.className = 'favorites-row-main';
        pick.textContent = item.label || item.id;
        pick.addEventListener('click', () => {
          const core = window.PionierCore;
          const scales = window.HANDPAN_SCALES || [];
          let idx = typeof item.index === 'number' ? item.index : scales.findIndex((s) => s.id === item.id);
          if (idx < 0) idx = scales.findIndex((s) => (s.label || s.short) === item.label);
          if (idx >= 0 && typeof core?.setScaleIndex === 'function') {
            core.setScaleIndex(idx);
            core.draw?.();
          }
          closeSheet();
        });
        const heart = makeHeartBtn(true, 'Remove from favorites', () => {
          toggleScale(item);
          buildBody();
        });
        row.appendChild(pick);
        row.appendChild(heart);
        scaleSec.appendChild(row);
      });
    }
  }

  let open = false;
  function openSheet() {
    const els = ensureDom();
    buildBody();
    els.sheet.hidden = false;
    els.sheet.removeAttribute('hidden');
    els.backdrop.hidden = false;
    els.backdrop.removeAttribute('hidden');
    requestAnimationFrame(() => els.sheet.classList.add('is-open'));
    els.btn.setAttribute('aria-expanded', 'true');
    open = true;
  }
  function closeSheet() {
    const els = ensureDom();
    els.sheet.classList.remove('is-open');
    els.btn.setAttribute('aria-expanded', 'false');
    open = false;
    setTimeout(() => {
      els.sheet.hidden = true;
      els.backdrop.hidden = true;
    }, 200);
  }

  function refreshUI() {
    if (open) buildBody();
  }

  function boot() {
    const els = ensureDom();
    els.btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (open) closeSheet();
      else openSheet();
    });
    els.backdrop.addEventListener('click', closeSheet);
    document.getElementById('favoritesSheetClose')?.addEventListener('click', closeSheet);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) closeSheet();
    });
  }

  window.PionierFavorites = {
    isScaleFav,
    isInstrumentFav,
    toggleScale,
    toggleInstrument,
    decorateScaleItem,
    decorateInstrumentItem,
    getState: () => ({ scales: state.scales.slice(), instruments: state.instruments.slice() }),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
