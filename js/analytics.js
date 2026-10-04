/**
 * analytics.js
 * Lightweight, non-blocking event tracking.
 * Does not load any third-party scripts by default.
 * Events are queued and can be forwarded later if a provider is configured.
 */

const Analytics = (() => {
  const queue = [];
  let enabled = true;

  function track(eventName, payload = {}) {
    if (!enabled) return;
    const entry = {
      event: eventName,
      ts: Date.now(),
      path: typeof location !== 'undefined' ? location.pathname : '',
      ...payload
    };
    queue.push(entry);
    // Keep memory bounded
    if (queue.length > 200) queue.shift();

    // Optional: console in development
    if (typeof window !== 'undefined' && window.__ANALYTICS_DEBUG) {
      console.debug('[analytics]', entry);
    }

    // Dispatch so an optional provider can listen
    try {
      window.dispatchEvent(new CustomEvent('ivar-analytics', { detail: entry }));
    } catch (_) {}
  }

  function getQueue() { return queue.slice(); }
  function setEnabled(v) { enabled = !!v; }

  // Auto-track a few high-value interactions when DOM is ready
  function bindAuto() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-track], #tipButton, #tipButtonMobile, .rh-tip-link-btn, a[href*="busk.co"]');
      if (!t) return;
      if (t.id === 'tipButton' || t.id === 'tipButtonMobile' || t.classList.contains('rh-tip-link-btn') || (t.href && t.href.includes('busk.co'))) {
        track('tip_button_click', { id: t.id || null });
      } else if (t.dataset.track) {
        track(t.dataset.track, { id: t.id || null });
      }
    }, { passive: true });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindAuto);
    } else {
      bindAuto();
    }
  }

  // Public API
  window.IvarAnalytics = { track, getQueue, setEnabled };

  return { track, getQueue, setEnabled };
})();
