import { loadAppState, saveSettings, completeFirstRun } from './storage.js';

const modes = {
  play: { label:'PLAY MODE', copy:'Play freely.' },
  learn: { label:'LEARN MODE', copy:'Guided lessons.' },
  loop: { label:'LOOP MODE', copy:'Record, loop and layer ideas.' },
  ambient: { label:'AMBIENT MODE', copy:'Create evolving scale-safe landscapes.' }
};

const buttons = document.querySelectorAll('.app-mode');
const panel = document.getElementById('appPanel');
const dock = document.getElementById('soundDock');
const dockToggle = document.getElementById('soundDockToggle');
const state = loadAppState();

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

function setMode(mode) {
  if (!modes[mode]) return;
  buttons.forEach((button) => button.classList.toggle('is-active', button.dataset.mode === mode));
  if (panel) {
    panel.querySelector('.app-panel-kicker').textContent = modes[mode].label;
    panel.querySelector('.app-panel-copy').textContent = modes[mode].copy;
  }
  document.body.dataset.appMode = mode;
  document.body.classList.toggle('loop-mode', mode === 'loop');
  if (mode !== 'learn') document.body.classList.remove('learn-active');
  if (mode !== 'ambient' && window.HandpanAtmosphere) {
    window.HandpanAtmosphere.backing('off');
    window.HandpanAtmosphere.set('off');
  }
  setDock(mode === 'loop' || mode === 'ambient');
  if (mode === 'learn' && window.HandpanLearn) window.HandpanLearn.open();
}

function restoreControls() {
  const backingSelect = document.getElementById('backingSelect');
  const backingVolume = document.getElementById('backingVolume');
  const natureSelect = document.getElementById('natureSelect');
  const natureVolume = document.getElementById('natureVolume');
  if (backingSelect) backingSelect.value = state.settings.backing;
  if (backingVolume) backingVolume.value = state.settings.backingVolume;
  if (natureSelect) natureSelect.value = state.settings.nature;
  if (natureVolume) natureVolume.value = state.settings.natureVolume;
  backingSelect?.addEventListener('change', () => saveSettings({ backing: backingSelect.value }));
  backingVolume?.addEventListener('input', () => saveSettings({ backingVolume: Number(backingVolume.value) }));
  natureSelect?.addEventListener('change', () => saveSettings({ nature: natureSelect.value }));
  natureVolume?.addEventListener('input', () => saveSettings({ natureVolume: Number(natureVolume.value) }));
}

buttons.forEach((button) => button.addEventListener('click', () => { uiHaptic(); setMode(button.dataset.mode); }));
dockToggle?.addEventListener('click', () => {
  if (document.body.dataset.appMode !== 'loop' && document.body.dataset.appMode !== 'ambient') return;
  setDock(dock.classList.contains('is-hidden'));
});

document.getElementById('aboutOpen')?.addEventListener('click', () => {
  document.getElementById('aboutPanel')?.removeAttribute('hidden');
  document.getElementById('aboutClose')?.focus();
});
document.getElementById('aboutClose')?.addEventListener('click', () => document.getElementById('aboutPanel')?.setAttribute('hidden',''));
document.getElementById('firstRunAbout')?.addEventListener('click', () => {
  document.getElementById('aboutPanel')?.removeAttribute('hidden');
});
document.getElementById('firstRunEnter')?.addEventListener('click', () => {
  completeFirstRun();
  document.getElementById('firstRun')?.setAttribute('hidden','');
});

let installPrompt = null;
const installButton = document.getElementById('installApp');
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton?.removeAttribute('hidden');
});
installButton?.addEventListener('click', async () => {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  await prompt.prompt();
  installButton.setAttribute('hidden','');
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installButton?.setAttribute('hidden','');
});

restoreControls();
if (!state.firstRunComplete) document.getElementById('firstRun')?.removeAttribute('hidden');
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
}

window.HandpanApp = {
  version: '0.4.1',
  modes,
  setMode,
  instrument: window.HandpanGame || null,
  persisted: state
};

setMode('play');
