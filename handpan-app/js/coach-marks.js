/**
 * First-run coach marks for Pionier (phase 14).
 * Persists dismissal in localStorage key pionier.coach.v1
 */
(function () {
  const KEY = 'pionier.coach.v1';
  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
      return {};
    }
  }
  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function ensureStyles() {
    if (document.getElementById('pionierCoachStyles')) return;
    const s = document.createElement('style');
    s.id = 'pionierCoachStyles';
    s.textContent = `
      .pionier-coach {
        position: fixed; z-index: 6000; max-width: 260px;
        background: rgba(12,12,14,.94); color: #f2e6c9;
        border: 1px solid rgba(212,175,55,.55); border-radius: 12px;
        padding: 12px 14px; font: 13px/1.4 system-ui,sans-serif;
        box-shadow: 0 8px 28px rgba(0,0,0,.45);
      }
      .pionier-coach button {
        margin-top: 8px; background: #d4af37; color: #1a1408;
        border: 0; border-radius: 8px; padding: 6px 12px; font-weight: 600; cursor: pointer;
      }
      .pionier-coach[hidden] { display: none !important; }
    `;
    document.head.appendChild(s);
  }

  function placeNear(el, tip) {
    const r = el.getBoundingClientRect();
    const top = Math.min(window.innerHeight - 120, r.bottom + 10);
    const left = Math.max(12, Math.min(window.innerWidth - 280, r.left));
    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
  }

  function showTip(id, targetSelector, text) {
    const state = load();
    if (state[id]) return;
    const target = document.querySelector(targetSelector);
    if (!target) return;
    ensureStyles();
    const tip = document.createElement('div');
    tip.className = 'pionier-coach';
    tip.setAttribute('role', 'status');
    tip.innerHTML = '<div>' + text + '</div><button type="button">Got it</button>';
    document.body.appendChild(tip);
    placeNear(target, tip);
    tip.querySelector('button').addEventListener('click', () => {
      const next = load();
      next[id] = true;
      save(next);
      tip.remove();
    });
    setTimeout(() => {
      if (tip.isConnected) {
        const next = load();
        next[id] = true;
        save(next);
        tip.remove();
      }
    }, 12000);
  }

  function run() {
    const state = load();
    if (state.doneAll) return;
    showTip('scale', '#scaleLabel', 'Choose a scale here. Use the base-note control for the root.');
    showTip('loop', '#looperBtn', 'Record a loop layer, then overdub. Clear with ×.');
    const s = load();
    s.doneAll = true;
    save(s);
  }

  window.PionierCoach = { run, reset: () => localStorage.removeItem(KEY) };

  window.addEventListener('pionier:user-enter', () => {
    setTimeout(run, 900);
  });
  if (document.documentElement.dataset.pionierEntered === '1') {
    setTimeout(run, 900);
  }
})();
