/**
 * Sequencer loader — last good build + Play/Pause transport (panel + edge).
 */
const SOURCE =
  'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@dcbb7bae36652186eb2148839f2d88a38bf22463/handpan-app/js/ambient-sequencer-grid.js';

let _modPromise = null;

function loadModule() {
  if (_modPromise) return _modPromise;
  _modPromise = (async () => {
    const res = await fetch(SOURCE, { cache: 'force-cache' });
    if (!res.ok) throw new Error('Failed to load sequencer source: ' + res.status);
    let src = await res.text();
    const audioCore = new URL('./audio-core.js?v=2', import.meta.url).href;
    src = src.replace(/from\s+['\"]\.\/audio-core\.js\?v=2['\"]/g, 'from ' + JSON.stringify(audioCore));

    // Panel transport: Stop → Pause
    src = src.replace(
      "playButton.innerHTML = '<span>Ⅱ</span> Stop';",
      "playButton.innerHTML = '<span>❚❚</span> Pause';"
    );
    src = src.replace(
      "status.textContent = 'Stopped · pattern kept';",
      "status.textContent = 'Paused · press Play to continue';"
    );
    src = src.replace(
      '<button type="button" class="sequence-play" aria-pressed="false"><span>▶</span> Play</button>',
      '<button type="button" class="sequence-play" aria-pressed="false" aria-label="Play sequence"><span>▶</span> Play</button>'
    );

    const blob = new Blob([src], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    return await import(/* @vite-ignore */ url);
  })();
  return _modPromise;
}

function injectEdgePlay(api) {
  if (!api || document.getElementById('pionierSequenceEdgePlay')) return;

  const style = document.createElement('style');
  style.textContent = `
    .pionier-sequence-edge-wrap {
      position: fixed; right: 0; top: 50%; transform: translateY(-50%);
      z-index: 40; display: flex; flex-direction: column; align-items: flex-end;
      gap: 8px; pointer-events: none;
    }
    .pionier-sequence-edge-wrap .pionier-sequence-edge,
    .pionier-sequence-edge-wrap .sequence-edge-play { pointer-events: auto; }
    .sequence-edge-play {
      width: 40px; height: 40px; margin-right: 6px; border-radius: 50%;
      border: 1px solid rgba(215,201,161,.35); background: rgba(18,22,19,.94);
      color: #e8dfc4; font-size: 13px; line-height: 1; display: grid; place-items: center;
      cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.4);
      transition: background .15s ease, border-color .15s ease, transform .12s ease;
    }
    .sequence-edge-play:hover, .sequence-edge-play:focus-visible {
      border-color: rgba(240,217,154,.6); background: rgba(28,34,28,.98);
    }
    .sequence-edge-play.is-playing {
      background: linear-gradient(180deg, #d8c47f, #a78c4e);
      color: #1a1810; border-color: #f0d99a;
    }
    .sequence-edge-play:active { transform: scale(.94); }
    body.pionier-sequence-open .sequence-edge-play { display: none; }
  `;
  document.head.appendChild(style);

  // Re-parent existing edge into a wrap + add play button
  let edge = document.getElementById('pionierSequenceEdge');
  if (!edge) return;
  if (!edge.classList.contains('pionier-sequence-edge-wrap')) {
    const wrap = document.createElement('div');
    wrap.id = 'pionierSequenceEdgeWrap';
    wrap.className = 'pionier-sequence-edge-wrap';
    edge.parentNode.insertBefore(wrap, edge);
    wrap.appendChild(edge);
    edge = wrap;
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'pionierSequenceEdgePlay';
  btn.className = 'sequence-edge-play';
  btn.setAttribute('aria-label', 'Play sequence');
  btn.setAttribute('aria-pressed', 'false');
  btn.title = 'Play / Pause sequence';
  btn.innerHTML = '<span class="sequence-edge-play-icon" aria-hidden="true">▶</span>';
  edge.appendChild(btn);

  const playBtn = () => document.querySelector('#pionierSequence .sequence-play');

  function syncFromPanel() {
    const panelBtn = playBtn();
    const playing = panelBtn && panelBtn.getAttribute('aria-pressed') === 'true';
    const ico = btn.querySelector('.sequence-edge-play-icon');
    if (ico) ico.textContent = playing ? '❚❚' : '▶';
    btn.setAttribute('aria-pressed', String(!!playing));
    btn.setAttribute('aria-label', playing ? 'Pause sequence' : 'Play sequence');
    btn.classList.toggle('is-playing', !!playing);
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const panelBtn = playBtn();
    if (panelBtn) panelBtn.click();
    // Sync after the panel handler runs
    requestAnimationFrame(syncFromPanel);
    setTimeout(syncFromPanel, 50);
  });

  // Keep edge button in sync when panel play is used
  const observer = new MutationObserver(syncFromPanel);
  const attach = () => {
    const panelBtn = playBtn();
    if (panelBtn) observer.observe(panelBtn, { attributes: true, attributeFilter: ['aria-pressed'] });
  };
  attach();
  setTimeout(attach, 500);
  setTimeout(attach, 2000);
}

export async function createAmbientSequenceEngine(opts) {
  const mod = await loadModule();
  return mod.createAmbientSequenceEngine(opts);
}

export async function mountAmbientSequencer() {
  const mod = await loadModule();
  const api = mod.mountAmbientSequencer();
  try { injectEdgePlay(api); } catch (e) { console.warn('[sequence] edge play', e); }
  return api;
}

loadModule().catch((e) => console.warn('[sequence] restore load', e));
