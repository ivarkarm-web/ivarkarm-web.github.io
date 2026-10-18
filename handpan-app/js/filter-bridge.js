/**
 * filter-bridge.js — connect UI filter/volume events to the live FxChain
 * Loaded after pionier-app (module). Polls briefly until chain is ready.
 */
(function filterBridge() {
  function chain() {
    try {
      return window.PionierCore?.getFxChain?.() || window.PionierCore?.app?.fxChain || null;
    } catch (_) {
      return null;
    }
  }

  window.addEventListener('pionier:filter', (e) => {
    const fx = chain();
    if (!fx) return;
    const d = e.detail || {};
    if (typeof fx.setFilterParams === 'function') {
      fx.setFilterParams({
        cutoff: d.cutoff,
        resonance: d.resonance,
        type: d.type === 'band' ? 'bandpass' : d.type,
      });
    } else {
      const mod = fx.modules?.find((m) => m.id === 'filter');
      if (mod && typeof mod.setFilterParams === 'function') {
        mod.setFilterParams(d, fx.ctx);
      } else if (mod && typeof mod.setValue === 'function') {
        mod.setValue(Number(d.cutoff) || 0.55, fx.ctx);
      }
    }
  });

  window.addEventListener('pionier:master-volume', (e) => {
    const fx = chain();
    const v = Number(e.detail?.value);
    if (!fx || !Number.isFinite(v)) return;
    if (typeof fx.setMaster === 'function') fx.setMaster(v);
    else if (fx.master?.gain) {
      try {
        fx.master.gain.setTargetAtTime(v * 1.15, fx.ctx?.currentTime || 0, 0.03);
      } catch (_) {}
    }
  });
})();
