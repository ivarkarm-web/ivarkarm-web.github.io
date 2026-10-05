/**
 * analytics.js
 * Privacy-first, non-blocking analytics for Ivar Karm – Resonance.
 *
 * - No third-party scripts loaded by default
 * - Respects Do Not Track / Global Privacy Control when present
 * - Events stay in-memory (bounded queue) + CustomEvent for optional sinks
 * - Enable debug: window.__ANALYTICS_DEBUG = true
 * - Optional remote sink: window.__ANALYTICS_ENDPOINT = 'https://...'
 */

const Analytics = (() => {
  const queue = [];
  const MAX_QUEUE = 250;
  let enabled = true;

  function privacyBlocked() {
    try {
      if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return true;
      if (navigator.globalPrivacyControl === true) return true;
    } catch (_) {}
    return false;
  }

  function track(eventName, payload = {}) {
    if (!enabled || privacyBlocked()) return;
    if (!eventName || typeof eventName !== 'string') return;

    const entry = {
      event: String(eventName).slice(0, 80),
      ts: Date.now(),
      path: typeof location !== 'undefined' ? location.pathname : '',
      ...sanitize(payload)
    };

    queue.push(entry);
    if (queue.length > MAX_QUEUE) queue.shift();

    if (typeof window !== 'undefined' && window.__ANALYTICS_DEBUG) {
      try { console.debug('[analytics]', entry); } catch (_) {}
    }

    try {
      window.dispatchEvent(new CustomEvent('ivar-analytics', { detail: entry }));
    } catch (_) {}

    // Optional beacon/fetch sink (only if page author configures endpoint)
    try {
      const endpoint = window.__ANALYTICS_ENDPOINT;
      if (endpoint && typeof endpoint === 'string' && endpoint.indexOf('https://') === 0) {
        const body = JSON.stringify(entry);
        if (navigator.sendBeacon) {
          navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
        } else if (typeof fetch === 'function') {
          fetch(endpoint, {
            method: 'POST',
            body,
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            mode: 'cors',
            credentials: 'omit'
          }).catch(() => {});
        }
      }
    } catch (_) {}
  }

  function sanitize(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach((k) => {
      const v = obj[k];
      if (v == null) return;
      if (typeof v === 'string') out[k] = v.slice(0, 120);
      else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    });
    return out;
  }

  function getQueue() { return queue.slice(); }
  function setEnabled(v) { enabled = !!v; }
  function isEnabled() { return enabled && !privacyBlocked(); }

  function bindAuto() {
    // Page view once
    track('page_view', {
      ref: (typeof document !== 'undefined' && document.referrer)
        ? String(document.referrer).slice(0, 120)
        : ''
    });

    document.addEventListener('click', (e) => {
      const t = e.target && e.target.closest && e.target.closest(
        '[data-track], #tipButton, #tipButtonMobile, .rh-tip-link-btn, a[href*="busk.co"], #welcomeEnter, #monographToggleBtn, #audioToggleBtn, #mpPullCue, #s7EnterRabbitHoleBtn'
      );
      if (!t) return;

      if (t.id === 'tipButton' || t.id === 'tipButtonMobile' || (t.classList && t.classList.contains('rh-tip-link-btn'))) {
        track('tip_open', { id: t.id || 'tip' });
      } else if (t.href && String(t.href).indexOf('busk.co') !== -1) {
        track('tip_outbound', { href: 'busk.co' });
      } else if (t.id === 'welcomeEnter') {
        track('enter_click');
      } else if (t.id === 'monographToggleBtn') {
        track('monograph_toggle');
      } else if (t.id === 'audioToggleBtn') {
        track('audio_toggle');
      } else if (t.id === 'mpPullCue') {
        track('player_open_cue');
      } else if (t.id === 's7EnterRabbitHoleBtn') {
        track('rabbit_hole_cta');
      } else if (t.dataset && t.dataset.track) {
        track(t.dataset.track, { id: t.id || null });
      }
    }, { passive: true });

    // Visibility for session quality (not invasive)
    document.addEventListener('visibilitychange', () => {
      track(document.hidden ? 'page_hidden' : 'page_visible');
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindAuto);
    } else {
      bindAuto();
    }
  }

  window.IvarAnalytics = { track, getQueue, setEnabled, isEnabled };
  return { track, getQueue, setEnabled, isEnabled };
})();

/** Safe global helper used by other modules */
function trackEvent(name, payload) {
  try {
    if (typeof window !== 'undefined' && window.IvarAnalytics && window.IvarAnalytics.track) {
      window.IvarAnalytics.track(name, payload || {});
    }
  } catch (_) {}
}
window.trackEvent = trackEvent;
