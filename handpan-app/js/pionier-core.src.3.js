  ctx.fill();
}

function wireKnobs() {
  if (!app.fxChain) return;
  const map = [
    { knobId: 'knobCompress', valId: 'valCompress', fxId: 'compressor', def: 0.4, size: 68 },
    { knobId: 'knobDelay', valId: 'valDelay', fxId: 'delay', def: 0.15, size: 68 },
    { knobId: 'knobReverb', valId: 'valReverb', fxId: 'reverb', def: 0.25, size: 68 },
    { knobId: 'knobFilter', valId: 'valFilter', fxId: 'filter', def: 0.12, size: 68 },
    { knobId: 'knobBass', valId: 'valBass', tone: 'bass', def: 0.5, size: 72 },
    { knobId: 'knobLow', valId: 'valLow', tone: 'low', def: 0.5, size: 72 },
    { knobId: 'knobMid', valId: 'valMid', tone: 'mid', def: 0.5, size: 72 },
    { knobId: 'knobMaster', valId: 'valMaster', tone: 'master', def: 0.82, size: 72 }
  ];
  for (const m of map) {
    const el = document.getElementById(m.knobId);
    const val = document.getElementById(m.valId);
    if (!el) continue;
    const canvasEl = el.querySelector('.knob-canvas');
    let value = m.def;
    const apply = (v) => {
      value = Math.max(0, Math.min(1, v));
      if (m.tone === 'bass') app.fxChain.setBass(value);
      else if (m.tone === 'low') app.fxChain.setLow(value);
      else if (m.tone === 'mid') app.fxChain.setMid(value);
      else if (m.tone === 'master') app.fxChain.setMaster(value);
      else app.fxChain.setValue(m.fxId, value);
      paintKnob(canvasEl, value, m.size || 88);
      if (val) val.textContent = String(Math.round(value * 100));
      el.setAttribute('aria-valuenow', String(Math.round(value * 100)));
    };
    apply(value);
    let dragging = false;
    let startY = 0;
    let startVal = 0;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragging = true;
      startY = e.clientY;
      startVal = value;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      apply(startVal + (startY - e.clientY) / 140);
    });
    el.addEventListener('pointerup', () => { dragging = false; });
    el.addEventListener('pointercancel', () => { dragging = false; });
  }

  const wireType = (attr, moduleId) => {
    document.querySelectorAll(`[${attr}]`).forEach((btn) => {
      btn.addEventListener('click', () => {
        const mod = app.fxChain?.modules?.find((x) => x.id === moduleId);
        if (mod) mod.type = btn.getAttribute(attr);
        mod?._apply?.(getAudioContext());
        document.querySelectorAll(`[${attr}]`).forEach((b) => {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
      });
    });
  };
  wireType('data-comp', 'compressor');
  wireType('data-delay', 'delay');
  wireType('data-reverb', 'reverb');
  wireType('data-filter', 'filter');

  document.querySelectorAll('[data-delay]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mod = app.fxChain?.modules?.find((x) => x.id === 'delay');
      if (!mod) return;
      const t = btn.getAttribute('data-delay');
      mod.type = t === 'dub' ? 'ambient' : t;
      mod._apply?.(getAudioContext());
    });
  });

  document.querySelectorAll('.knob-effect-trigger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('aria-controls');
      const bubble = id ? document.getElementById(id) : null;
      if (!bubble) return;
      const open = bubble.hasAttribute('hidden');
      document.querySelectorAll('.effect-bubble').forEach((b) => b.setAttribute('hidden', ''));
      document.querySelectorAll('.knob-effect-trigger').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      if (open) {
        bubble.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
