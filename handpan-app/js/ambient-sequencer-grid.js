/**
 * Sequencer loader — pulls the last good build, rewrites relative imports
 * for same-origin resolution, and patches the transport to Play/Pause.
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

    // Patch transport button labels: Stop → Pause
    src = src.replace(
      "playButton.innerHTML = '<span>Ⅱ</span> Stop';",
      "playButton.innerHTML = '<span>❚❚</span> Pause';"
    );
    src = src.replace(
      "status.textContent = 'Stopped · pattern kept';",
      "status.textContent = 'Paused · press Play to continue';"
    );
    src = src.replace(
      "<button type=\"button\" class=\"sequence-play\" aria-pressed=\"false\"><span>▶</span> Play</button>",
      "<button type=\"button\" class=\"sequence-play\" aria-pressed=\"false\" aria-label=\"Play sequence\"><span>▶</span> Play</button>"
    );

    const blob = new Blob([src], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      return await import(/* @vite-ignore */ url);
    } finally {
      // Keep blob URL alive for the lifetime of the module
    }
  })();
  return _modPromise;
}

export async function createAmbientSequenceEngine(opts) {
  const mod = await loadModule();
  return mod.createAmbientSequenceEngine(opts);
}

export async function mountAmbientSequencer() {
  const mod = await loadModule();
  return mod.mountAmbientSequencer();
}

// Eager load so boot path stays sync-friendly when possible
loadModule().catch((e) => console.warn('[sequence] restore load', e));
