/**
 * debug.js — hidden developer mode for Pionier
 * Activate with ?debug=1
 */
export function isDebugEnabled() {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get('debug') === '1' || q.get('debug') === 'true';
  } catch { return false; }
}

export function mountDebugPanel(api) {
  if (document.getElementById('pionier-debug')) return;
  const panel = document.createElement('aside');
  panel.id = 'pionier-debug';
  panel.setAttribute('aria-label', 'Developer debug panel');
  panel.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:99999;max-width:min(360px,92vw);max-height:50vh;overflow:auto;background:rgba(10,10,12,0.92);color:#e8e4d8;font:12px/1.4 ui-monospace,monospace;border:1px solid rgba(201,162,39,0.35);border-radius:10px;padding:10px 12px;box-shadow:0 8px 32px rgba(0,0,0,0.5)';
  panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong style="color:#c9a227">Pionier Debug</strong><button type="button" id="dbgClose" style="background:none;border:0;color:#aaa;cursor:pointer;font-size:16px">×</button></div><div id="dbgStats" style="margin-bottom:8px;opacity:0.9"></div><div style="display:flex;flex-wrap:wrap;gap:6px"><button type="button" data-act="instrument-handpan">Handpan</button><button type="button" data-act="instrument-kitchen">Kitchen</button><button type="button" data-act="instrument-bird">Bird</button><button type="button" data-act="catch-start">Catch start</button><button type="button" data-act="catch-reset">Catch reset</button><button type="button" data-act="onboarding-reset">Onboarding reset</button></div>`;
  panel.querySelectorAll('button[data-act]').forEach((b) => { b.style.cssText = 'background:#1a1a1e;border:1px solid #333;color:#ddd;border-radius:6px;padding:4px 8px;cursor:pointer;font:11px monospace'; });
  document.body.appendChild(panel);
  panel.querySelector('#dbgClose')?.addEventListener('click', () => panel.remove());
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    if (act === 'instrument-handpan') api.setInstrument?.('handpan');
    if (act === 'instrument-kitchen') api.setInstrument?.('kitchen');
    if (act === 'instrument-bird') api.setInstrument?.('bird');
    if (act === 'catch-start') api.startCatch?.();
    if (act === 'catch-reset') api.resetCatch?.();
    if (act === 'onboarding-reset') api.resetOnboarding?.();
  });
  const statsEl = panel.querySelector('#dbgStats');
  function refresh() {
    if (!document.body.contains(panel)) return;
    const s = api.getStats?.() || {};
    statsEl.textContent = [`inst: ${s.instrument || '—'}`, `voices: ${s.voices ?? '—'}`, `touches: ${s.touches ?? '—'}`, `vel: ${s.velocity != null ? s.velocity.toFixed(2) : '—'}`, `ctx: ${s.audioState || '—'}`, `fps: ${s.fps ?? '—'}`, `dpr: ${s.dpr ?? '—'}`, `tier: ${s.tier || '—'}`, `catch: ${s.catchPhase || '—'}`].join(' · ');
    requestAnimationFrame(refresh);
  }
  requestAnimationFrame(refresh);
  return panel;
}
