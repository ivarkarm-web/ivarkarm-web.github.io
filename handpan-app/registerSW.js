/**
 * Register SW, surface update-ready reload, and offline network pill (Phase 7).
 * Stamp: registerSW.js?v=2 in index.html
 */
(function () {
  function el(id) {
    return document.getElementById(id);
  }

  function ensureChrome() {
    if (!el('pionierNetPill')) {
      const pill = document.createElement('div');
      pill.id = 'pionierNetPill';
      pill.className = 'pionier-net-pill';
      pill.setAttribute('role', 'status');
      pill.setAttribute('aria-live', 'polite');
      pill.hidden = true;
      pill.textContent = 'Offline';
      document.body.appendChild(pill);
    }
    if (!el('pionierUpdateToast')) {
      const toast = document.createElement('div');
      toast.id = 'pionierUpdateToast';
      toast.className = 'pionier-update-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.hidden = true;
      const msg = document.createElement('span');
      msg.className = 'pionier-update-msg';
      msg.textContent = 'Update ready';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'pionierUpdateReload';
      btn.className = 'pionier-update-reload';
      btn.textContent = 'Reload';
      toast.appendChild(msg);
      toast.appendChild(btn);
      document.body.appendChild(toast);
    }
  }

  function setOffline(offline) {
    const pill = el('pionierNetPill');
    if (!pill) return;
    pill.hidden = !offline;
    pill.dataset.state = offline ? 'offline' : 'online';
  }

  function showUpdateToast(reg) {
    const toast = el('pionierUpdateToast');
    const btn = el('pionierUpdateReload');
    if (!toast || !btn) return;
    toast.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Reload';
    btn.onclick = () => {
      document.documentElement.dataset.pionierSwReload = '1';
      btn.disabled = true;
      btn.textContent = 'Reloading…';
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      setTimeout(() => {
        window.location.reload();
      }, 500);
    };
  }

  function wireNetwork() {
    const sync = () => setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    sync();
  }

  function wireServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      if (document.documentElement.dataset.pionierSwReload === '1') {
        refreshing = true;
        window.location.reload();
      }
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js', { scope: './' })
        .then((reg) => {
          if (reg.waiting && navigator.serviceWorker.controller) {
            showUpdateToast(reg);
          } else if (reg.waiting && !navigator.serviceWorker.controller) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          reg.addEventListener('updatefound', () => {
            const w = reg.installing;
            if (!w) return;
            w.addEventListener('statechange', () => {
              if (w.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateToast(reg);
              }
            });
          });
        })
        .catch(() => {});
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureChrome();
      wireNetwork();
      wireServiceWorker();
    });
  } else {
    ensureChrome();
    wireNetwork();
    wireServiceWorker();
  }
})();
