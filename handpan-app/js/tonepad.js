/**
 * TonePad v28 — smoother infinite carousel, layers, VEL/PROB/HUM (BPM via looper).
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=28', base));
    const parts = await Promise.all(
      urls.map((u) =>
        fetch(u, { cache: 'no-cache' }).then((r) => {
          if (!r.ok) throw new Error('missing ' + u);
          return r.text();
        })
      )
    );
    const b64 = parts.join('').replace(/\s+/g, '');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    let src = new TextDecoder().decode(bytes);

    const dirUrl = new URL('./', base).href;
    src = src.replace(/from\s+(['"])(\.\/[^'"]+)\1/g, (m, q, rel) => `from ${q}${new URL(rel, dirUrl).href}${q}`);

    src = src.replace(
      /const bpmDial = layer\.querySelector\('\.tonepad-bpm-dial'\);\s*const bpmCanvas = bpmDial\.querySelector\('canvas'\);\s*const bpmVal = layer\.querySelector\('\[data-bpm-val\]'\);/,
      `const bpmDial = layer.querySelector('.tonepad-bpm-dial');\n  const bpmCanvas = bpmDial && bpmDial.querySelector('canvas');\n  const bpmVal = layer.querySelector('[data-bpm-val]');`
    );
    src = src.replace(/function paintBpmKnob\(\) \{\s*const c = bpmCanvas\.getContext\('2d'\);/, `function paintBpmKnob() {\n    if (!bpmCanvas) return;\n    const c = bpmCanvas.getContext('2d');`);
    src = src.replace(/\(function wireBpm\(\) \{\s*let drag = false;/, `(function wireBpm() {\n    if (!bpmDial) return;\n    let drag = false;`);

    src = src.replace(
      /const grid = new Uint8Array\(COLS \* ROWS\);\s*let bpm = 92;/,
      `const LAYER_COUNT = 5;\nconst layers = Array.from({ length: LAYER_COUNT }, () => new Uint8Array(COLS * ROWS));\nconst grid = layers[0];\nlet activeLayer = 0;\nlet playLayer = 0;\nlet bpm = 92;\nlet velocity = 0.7;\nlet probability = 1;\nlet humanize = 0.15;\n\nfunction layerHasNotes(i) {\n  const g = layers[i];\n  for (let n = 0; n < g.length; n++) if (g[n]) return true;\n  return false;\n}\nfunction nextNonEmptyLayer(from) {\n  for (let n = 1; n <= LAYER_COUNT; n++) {\n    const i = (from + n) % LAYER_COUNT;\n    if (layerHasNotes(i)) return i;\n  }\n  return from;\n}`
    );

    src = src.replace(
      /function save\(\) \{\s*try \{\s*localStorage\.setItem\(STORE, JSON\.stringify\(\{ cells: Array\.from\(grid\), bpm, version: 1 \}\)\);\s*\} catch \(_\) \{\}\s*\}/,
      `function save() {\n  try {\n    localStorage.setItem(STORE, JSON.stringify({\n      cells: Array.from(layers[activeLayer]),\n      layers: layers.map((g) => Array.from(g)),\n      activeLayer, bpm, velocity, probability, humanize, version: 3\n    }));\n  } catch (_) {}\n}`
    );
    src = src.replace(
      /function load\(\) \{\s*try \{\s*const saved = JSON\.parse\(localStorage\.getItem\(STORE\) \|\| 'null'\);\s*if \(saved && Array\.isArray\(saved\.cells\) && saved\.cells\.length === grid\.length\) \{\s*saved\.cells\.forEach\(\(v, i\) => \{ grid\[i\] = v \? 1 : 0; \}\);\s*\}\s*if \(saved && saved\.bpm\) bpm = Math\.max\(48, Math\.min\(160, Number\(saved\.bpm\) \|\| bpm\)\);\s*\} catch \(_\) \{\}\s*\}/,
      `function load() {\n  try {\n    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');\n    if (!saved) return;\n    if (Array.isArray(saved.layers) && saved.layers.length) {\n      saved.layers.forEach((cells, li) => {\n        if (li >= LAYER_COUNT || !Array.isArray(cells)) return;\n        for (let i = 0; i < Math.min(cells.length, layers[li].length); i++) layers[li][i] = cells[i] ? 1 : 0;\n      });\n    } else if (Array.isArray(saved.cells) && saved.cells.length === COLS * ROWS) {\n      saved.cells.forEach((v, i) => { layers[0][i] = v ? 1 : 0; });\n    }\n    if (Number.isFinite(saved.activeLayer)) activeLayer = Math.max(0, Math.min(LAYER_COUNT - 1, saved.activeLayer | 0));\n    if (saved.bpm) bpm = Math.max(48, Math.min(160, Number(saved.bpm) || bpm));\n    if (Number.isFinite(saved.velocity)) velocity = Math.max(0, Math.min(1, Number(saved.velocity)));\n    if (Number.isFinite(saved.probability)) probability = Math.max(0, Math.min(1, Number(saved.probability)));\n    if (Number.isFinite(saved.humanize)) humanize = Math.max(0, Math.min(1, Number(saved.humanize)));\n    playLayer = layerHasNotes(activeLayer) ? activeLayer : nextNonEmptyLayer(activeLayer);\n  } catch (_) {}\n}`
    );

    src = src.replace(
      /layer\.innerHTML =\s*'<div class="tonepad-chrome">' \+[\s\S]*?'<canvas id="tonepadCanvas" aria-label="Pentatonic step sequencer"><\/canvas>';/,
      `layer.innerHTML =\n    '<div class="tonepad-chrome">' +\n      '<div class="tonepad-knobs" role="group" aria-label="Sequencer feel">' +\n        '<div class="tonepad-knob" data-knob="velocity">' +\n          '<span class="tonepad-knob-label">VEL</span>' +\n          '<div class="tonepad-knob-dial" tabindex="0" role="slider" aria-label="Velocity" aria-valuemin="0" aria-valuemax="100">' +\n            '<canvas width="72" height="72"></canvas>' +\n          '</div>' +\n          '<span class="tonepad-knob-val" data-knob-val="velocity">70</span>' +\n        '</div>' +\n        '<div class="tonepad-knob" data-knob="probability">' +\n          '<span class="tonepad-knob-label">PROB</span>' +\n          '<div class="tonepad-knob-dial" tabindex="0" role="slider" aria-label="Probability" aria-valuemin="0" aria-valuemax="100">' +\n            '<canvas width="72" height="72"></canvas>' +\n          '</div>' +\n          '<span class="tonepad-knob-val" data-knob-val="probability">100</span>' +\n        '</div>' +\n        '<div class="tonepad-knob" data-knob="humanize">' +\n          '<span class="tonepad-knob-label">HUM</span>' +\n          '<div class="tonepad-knob-dial" tabindex="0" role="slider" aria-label="Humanize" aria-valuemin="0" aria-valuemax="100">' +\n            '<canvas width="72" height="72"></canvas>' +\n          '</div>' +\n          '<span class="tonepad-knob-val" data-knob-val="humanize">15</span>' +\n        '</div>' +\n      '</div>' +\n      '<div class="tonepad-layers" role="tablist" aria-label="Sequencer layers">' +\n        '<button type="button" class="tonepad-layer-btn is-active" data-layer="0" aria-pressed="true">L1</button>' +\n        '<button type="button" class="tonepad-layer-btn" data-layer="1" aria-pressed="false">L2</button>' +\n        '<button type="button" class="tonepad-layer-btn" data-layer="2" aria-pressed="false">L3</button>' +\n        '<button type="button" class="tonepad-layer-btn" data-layer="3" aria-pressed="false">L4</button>' +\n        '<button type="button" class="tonepad-layer-btn" data-layer="4" aria-pressed="false">L5</button>' +\n      '</div>' +\n    '</div>' +\n    '<canvas id="tonepadCanvas" aria-label="Pentatonic step sequencer"></canvas>';`
    );

    // Rest of patches: load from concatenated continuation in second write if needed - USE FILE
    throw new Error('incomplete');
  })();
}
