/**
 * TonePad entry — direct pin import (reliable mount).
 * Pin includes layers, VEL/PROB/HUM, infinite carousel, shared BPM.
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const pinned =
      'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@0bf964545e733bfb6002a78e7738e1e2aabf2c75/handpan-app/js/tonepad.js';
    const mod = await import(/* @vite-ignore */ pinned);
    const api = await mod.mountTonepad();

    try {
      if (!document.getElementById('tonepad-smooth-v32')) {
        const style = document.createElement('style');
        style.id = 'tonepad-smooth-v32';
        style.textContent = [
          '#pan, .tonepad-layer {',
          '  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1) !important;',
          '  will-change: transform;',
          '  backface-visibility: hidden;',
          '  -webkit-backface-visibility: hidden;',
          '}',
        ].join('\n');
        document.head.appendChild(style);
      }
      document.documentElement.style.setProperty('--tp-ease', 'cubic-bezier(0.22, 1, 0.36, 1)');
    } catch (_) {}

    try {
      const btn = document.getElementById('tonepadToggle');
      if (btn && !btn.dataset.tpWired) {
        btn.dataset.tpWired = '1';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const tp = window.PionierTonepad;
          if (!tp) return;
          if (typeof tp.toggle === 'function') tp.toggle();
          else if (document.body.classList.contains('tonepad-open') && tp.close) tp.close();
          else if (tp.open) tp.open();
        });
      }
    } catch (_) {}

    try { window.PionierTonepad = api || window.PionierTonepad; } catch (_) {}
    return api;
  })().catch((err) => {
    console.error('[tonepad] mount failed', err);
    window.__tonepadMounting = null;
    throw err;
  });
  return window.__tonepadMounting;
}
