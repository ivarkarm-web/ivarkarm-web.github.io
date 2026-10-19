/** Coordinates non-selector overlays. Native selects use browser-owned popups. */
(function overlayController() {
  function closePickers() {}
  function ensureBackdrop() { return document.getElementById('pickerBackdrop'); }
  function clearInlineLayout(el) {
    if (!el?.style) return;
    ['position','left','right','top','bottom','width','max-width','max-height','transform','display','visibility','opacity','pointer-events','z-index','border-radius']
      .forEach((property) => el.style.removeProperty(property));
  }
  function closeFx() {
    const panel = document.getElementById('fxPanel');
    if (panel) { panel.hidden = true; clearInlineLayout(panel); }
    document.getElementById('fxPanelOpen')?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-fx-open');
  }
  function closeSettings() {
    const sheet = document.getElementById('settingsSheet');
    const backdrop = document.getElementById('settingsSheetBackdrop');
    if (sheet) { sheet.classList.remove('is-open'); sheet.hidden = true; sheet.setAttribute('hidden', ''); }
    if (backdrop) { backdrop.classList.remove('is-open'); backdrop.hidden = true; backdrop.setAttribute('hidden', ''); }
    document.getElementById('settingsOpenBtn')?.setAttribute('aria-expanded', 'false');
  }
  function closeSoundscapes() {
    const panel = document.getElementById('soundscapesPanel') || document.getElementById('soundscapesPage');
    if (panel) { panel.hidden = true; panel.classList.remove('is-active', 'is-open'); panel.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('soundscapes-active');
    document.getElementById('app')?.classList.remove('soundscapes-away');
  }
  function closeAll(except) {
    if (except !== 'pickers') closePickers();
    if (except !== 'fx') closeFx();
    if (except !== 'settings') closeSettings();
    if (except !== 'soundscapes') closeSoundscapes();
  }
  function openFx() {
    closeAll('fx');
    const panel = document.getElementById('fxPanel');
    if (!panel) return;
    panel.hidden = false; panel.removeAttribute('hidden'); panel.style.removeProperty('display');
    document.getElementById('fxPanelOpen')?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-fx-open');
    try { window.PionierCore?.ensureAudio?.(); } catch (_) {}
    try { window.PionierCore?.paintFxKnobs?.(); } catch (_) {}
  }
  function toggleFx() {
    const panel = document.getElementById('fxPanel');
    if (panel && !panel.hidden) { closeFx(); document.getElementById('fxPanelOpen')?.focus?.(); }
    else openFx();
  }
  window.PionierOverlay = { closeAll, closePickers, closeFx, closeSettings, closeSoundscapes, openPicker() {}, togglePicker() {}, openFx, toggleFx, ensureBackdrop };
  function wire() {
    const fxOpen = document.getElementById('fxPanelOpen');
    const fxClose = document.getElementById('fxPanelClose');
    if (fxOpen && !fxOpen.dataset.overlayWired) {
      fxOpen.dataset.overlayWired = '1';
      fxOpen.addEventListener('click', (event) => { event.stopPropagation(); toggleFx(); });
    }
    if (fxClose && !fxClose.dataset.overlayWired) {
      fxClose.dataset.overlayWired = '1';
      fxClose.addEventListener('click', () => { closeFx(); document.getElementById('fxPanelOpen')?.focus?.(); });
    }
  }
  function recoverChrome() {
    const ss = document.getElementById('soundscapesPanel') || document.getElementById('soundscapesPage');
    const open = ss && !ss.hidden && (ss.classList.contains('is-active') || ss.classList.contains('is-open'));
    if (!open) {
      document.body.classList.remove('soundscapes-active');
      document.getElementById('app')?.classList.remove('soundscapes-away');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
  setInterval(recoverChrome, 1500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recoverChrome(); });
})();
