/**
 * TonePad v33 — assemble local parts (no CDN pin).
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    window.__tpParts = [];
    const base = import.meta.url;
    const n = 5;
    for (let i = 0; i < n; i++) {
      await import(new URL('./tp-part-' + i + '.js?v=33', base).href);
    }
    let src = window.__tpParts.join('');
    // Resolve audio-core against this module (same origin), not blob:
    const audioUrl = new URL('./audio-core.js?v=2', base).href;
    src = src.replace(/from\s+['"]\.\/audio-core\.js\?v=2['"]/, "from '" + audioUrl + "'");
    const blob = new Blob([src], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      const mod = await import(/* @vite-ignore */ url);
      const api = await mod.mountTonepad();
      try {
        if (!document.getElementById('tonepad-smooth-v33')) {
          const style = document.createElement('style');
          style.id = 'tonepad-smooth-v33';
          style.textContent = '#pan,.tonepad-layer{transition-timing-function:cubic-bezier(0.22,1,0.36,1)!important;will-change:transform;backface-visibility:hidden}';
          document.head.appendChild(style);
        }
      } catch (_) {}
      try {
        const btn = document.getElementById('tonepadToggle');
        if (btn && !btn.dataset.tpWired) {
          btn.dataset.tpWired = '1';
          btn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
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
    } finally {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }
  })().catch((err) => {
    console.error('[tonepad] mount failed', err);
    window.__tonepadMounting = null;
    throw err;
  });
  return window.__tonepadMounting;
}
