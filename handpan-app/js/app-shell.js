import './handpan.js';
import './learn.js';
import './ambient.js';

'use strict';

const modes = {
  play: { label: 'PLAY MODE', copy: 'Play freely.' },
  learn: { label: 'LEARN MODE', copy: 'Guided lessons.' },
  loop: { label: 'LOOP MODE', copy: 'Record, loop and layer ideas.' },
  ambient: { label: 'AMBIENT MODE', copy: 'Create evolving scale-safe landscapes.' }
};

const buttons = document.querySelectorAll('.app-mode');
const panel = document.getElementById('appPanel');
const dock = document.getElementById('soundDock');
const dockToggle = document.getElementById('soundDockToggle');

function uiHaptic() {
  if (navigator.vibrate && window.matchMedia?.('(pointer: coarse)').matches) {
    try { navigator.vibrate(4); } catch {}
  }
}

function setDock(open) {
  if (!dock || !dockToggle) return;
  const allowed = document.body.dataset.appMode === 'loop' || document.body.dataset.appMode === 'ambient';
  dock.classList.toggle('is-hidden', !open || !allowed);
  dockToggle.classList.toggle('is-open', open && allowed);
  dockToggle.setAttribute('aria-expanded', String(open && allowed));
}

dockToggle?.addEventListener('click', () => {
  if (document.body.dataset.appMode !== 'loop' && document.body.dataset.appMode !== 'ambient') return;
  setDock(dock.classList.contains('is-hidden'));
});

function setMode(mode) {
  if (!modes[mode]) return;
  buttons.forEach((button) => button.classList.toggle('is-active', button.dataset.mode === mode));
  if (panel) {
    panel.querySelector('.app-panel-kicker').textContent = modes[mode].label;
    panel.querySelector('.app-panel-copy').textContent = modes[mode].copy;
  }

  document.body.dataset.appMode = mode;
  document.body.classList.toggle('loop-mode', mode === 'loop');

  if (mode !== 'learn') {
    document.body.classList.remove('learn-active');
    window.HandpanLearn?.close?.();
  }

  setDock(mode === 'loop' || mode === 'ambient');
  if (mode === 'learn') window.HandpanLearn?.open?.();
}

buttons.forEach((button) => {
  button.addEventListener('click', () => {
    uiHaptic();
    setMode(button.dataset.mode);
  });
});

window.HandpanApp = {
  version: '0.4.1',
  modes,
  setMode,
  instrument: window.HandpanGame || null
};

setMode('play');
