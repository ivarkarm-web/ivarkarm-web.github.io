/**
 * TonePad v31 — working pin mount + singing-bowl / Om drone voice.
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const pinBase =
      'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@0bf964545e733bfb6002a78e7738e1e2aabf2c75/handpan-app/js/';
    const loaderUrl = pinBase + 'tonepad.js';
    const res = await fetch(loaderUrl, { cache: 'force-cache' });
    if (!res.ok) throw new Error('tonepad pin ' + res.status);
    let loaderSrc = await res.text();

    // Keep import.meta-based base pointing at the CDN pin so ./tb and ./audio-core resolve
    loaderSrc = loaderSrc.replace(
      /const base = import\.meta\.url;/,
      "const base = '" + pinBase + "tonepad.js';"
    );

    // Load chunks from absolute pin URLs
    loaderSrc = loaderSrc.replace(
      /const urls = \[0, 1, 2, 3, 4, 5, 6, 7\]\.map\(\(i\) => new URL\('\.\/tb' \+ i \+ '\.js\?v=27', base\)\);/,
      "const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => '" + pinBase + "' + 'tb' + i + '.js');"
    );

    // Drone / singing-bowl / Om voice injected before blob build
    const droneFn =
      "function trigger(row, when, vel) {\n" +
      "    if (!audioCtx || !bus) return;\n" +
      "    const f = freqForRow(row);\n" +
      "    const t0 = Math.max(audioCtx.currentTime + 0.003, when);\n" +
      "    const v = Math.max(0.05, Math.min(1, vel == null ? 0.6 : vel));\n" +
      "    const attack = 0.09 + (1 - v) * 0.14;\n" +
      "    const sustain = 0.55 + v * 0.9;\n" +
      "    const release = 2.4 + (ROWS - row) * 0.06 + v * 1.4;\n" +
      "    const life = attack + sustain + release + 0.08;\n" +
      "    const masterPeak = 0.045 + v * 0.085;\n" +
      "    const fil = audioCtx.createBiquadFilter();\n" +
      "    fil.type = 'lowpass';\n" +
      "    fil.Q.setValueAtTime(0.7, t0);\n" +
      "    fil.frequency.setValueAtTime(Math.min(4200, f * 5.5), t0);\n" +
      "    fil.frequency.exponentialRampToValueAtTime(Math.min(1800, f * 2.2), t0 + life * 0.85);\n" +
      "    const mix = audioCtx.createGain();\n" +
      "    mix.gain.setValueAtTime(1, t0);\n" +
      "    mix.connect(fil);\n" +
      "    fil.connect(bus);\n" +
      "    function partial(type, freq, level, cents) {\n" +
      "      const osc = audioCtx.createOscillator();\n" +
      "      const g = audioCtx.createGain();\n" +
      "      osc.type = type;\n" +
      "      osc.frequency.setValueAtTime(freq, t0);\n" +
      "      if (cents) osc.detune.setValueAtTime(cents, t0);\n" +
      "      const peak = Math.max(0.0002, masterPeak * level);\n" +
      "      g.gain.setValueAtTime(0.0001, t0);\n" +
      "      g.gain.exponentialRampToValueAtTime(peak, t0 + attack);\n" +
      "      g.gain.exponentialRampToValueAtTime(peak * 0.72, t0 + attack + sustain);\n" +
      "      g.gain.exponentialRampToValueAtTime(0.0001, t0 + life);\n" +
      "      osc.connect(g);\n" +
      "      g.connect(mix);\n" +
      "      osc.start(t0);\n" +
      "      osc.stop(t0 + life + 0.05);\n" +
      "    }\n" +
      "    partial('sine', f, 1.0, 0);\n" +
      "    partial('sine', f, 0.42, 5.5);\n" +
      "    partial('sine', f * 2.002, 0.22, 0);\n" +
      "    partial('sine', f * 2.997, 0.1, -3);\n" +
      "    partial('triangle', f * 0.5, 0.08, 0);\n" +
      "  }";

    const droneInject =
      "\n    // --- v31 drone / singing-bowl voice ---\n" +
      "    src = src.replace(\n" +
      "      /function trigger\\(row, when, vel\\) \\{[\\s\\S]*?osc\\.stop\\(t0 \\+ 0\\.8\\);\\s*\\}/,\n" +
      "      " + JSON.stringify(droneFn) + "\n" +
      "    );\n" +
      "    src = src.replace(/const look = 0\\.12;/, 'const look = 0.18;');\n" +
      "    // --- end v31 drone ---\n";

    if (loaderSrc.includes('const blob = new Blob([src]')) {
      loaderSrc = loaderSrc.replace(
        'const blob = new Blob([src]',
        droneInject + '\n    const blob = new Blob([src]'
      );
    } else {
      console.warn('[tonepad] inject point missing');
    }

    // Smooth carousel CSS only (logic stays with working pin)
    const blob = new Blob([loaderSrc], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      const mod = await import(/* @vite-ignore */ url);
      const api = await mod.mountTonepad();
      try {
        if (!document.getElementById('tonepad-smooth-v31')) {
          const style = document.createElement('style');
          style.id = 'tonepad-smooth-v31';
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
