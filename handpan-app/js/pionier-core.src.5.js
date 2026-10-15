  const menu = document.getElementById('instrumentMenu');
  if (!menu) return;
  menu.replaceChildren();
  for (const item of InstrumentRegistry.list()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'instrument-menu-item';
    btn.setAttribute('role', 'menuitem');
    btn.textContent = item.name || item.id;
    btn.addEventListener('click', () => {
      setInstrument(item.id);
      menu.hidden = true;
      document.getElementById('instrumentDropdownToggle')?.setAttribute('aria-expanded', 'false');
    });
    menu.appendChild(btn);
  }
}

document.getElementById('instrumentDropdownToggle')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const menu = document.getElementById('instrumentMenu');
  if (!menu) return;
  const open = menu.hidden;
  menu.hidden = !open;
  e.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) renderInstrumentMenu();
});
document.getElementById('voicePrev')?.addEventListener('click', () => {
  const list = InstrumentRegistry.list();
  const cur = InstrumentRegistry.active?.id || 'handpan';
  const i = list.findIndex((x) => x.id === cur);
  const next = list[(i - 1 + list.length) % list.length];
  if (next) setInstrument(next.id);
});
document.getElementById('voiceNext')?.addEventListener('click', () => {
  const list = InstrumentRegistry.list();
  const cur = InstrumentRegistry.active?.id || 'handpan';
  const i = list.findIndex((x) => x.id === cur);
  const next = list[(i + 1) % list.length];
  if (next) setInstrument(next.id);
});

function padCount() { return handpan.noteCount || 9; }
function changeNoteCount(delta) {
  const MIN = 9;
  const MAX = 14;
  const before = Number.isFinite(handpan.noteCount) ? handpan.noteCount : MIN;
  const after = Math.max(MIN, Math.min(MAX, before + delta));
  if (after === before) return false;
  handpan.setNoteCount(after);
  if (typeof surface.armTransition === 'function') surface.armTransition();
  syncWorldPitch();
  layoutFields();
  const active = activeInstrument();
  if (active && active.glow) {
    for (let i = 0; i < active.glow.length; i++) active.glow[i] = i === after - 1 ? 1 : 0;
  }
  if (active && active.zoneFlash && after > before && after - 1 < active.zoneFlash.length) active.zoneFlash[after - 1] = 0.3;
  updateLabels();
  draw();
  return true;
}

window.PionierCore = {
  handpan, surface,
  activeInstrument: () => activeInstrument(),
  ensureAudio: () => ensureAudio(),
  getInstrumentBus: () => {
    if (!app.instrumentBus) ensureAudio();
    return app.instrumentBus;
  },
  health: () => ({
    audioAvailable: !!getAudioContext(),
    audioState: audioState(),
    storageAvailable,
    instrumentReady: !!InstrumentRegistry.active?.ready
  }),
  draw() { draw(); },
  addNote() { return changeNoteCount(1); },
  removeNote() { return changeNoteCount(-1); },
  setScaleIndex(i) {
    handpan.setScaleIndex(i);
    refreshPitch();
  },
  refreshPitch() { refreshPitch(); },
  noteCount: () => {
    if (Number.isFinite(handpan?.noteCount) && handpan.noteCount > 0) return handpan.noteCount;
    const fields = surface?.fields;
    if (Array.isArray(fields) && fields.length) return fields.length;
    return padCount();
  }
};

async function boot() {
  ensureAudio();
  const saved = readSavedInstrumentId();
  await setInstrument(saved);
  refreshPitch();
  resize();
  window.addEventListener('resize', resize);
  const unlock = () => { ensureAudio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
  if (isDebugEnabled?.()) mountDebugPanel?.({ setInstrument });
}

await boot();
