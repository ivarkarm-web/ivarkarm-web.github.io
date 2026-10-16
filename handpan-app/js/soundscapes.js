import { createMandalaRenderer } from './mandala-canvas.js';

const page = document.getElementById('soundscapesPage') || document.getElementById('soundscapesPanel');
const app = document.getElementById('app');
const pan = document.getElementById('pan');
const audio = document.getElementById('soundscapeAudio');
if (page && app && pan && audio) {
  const play = document.getElementById('soundscapePlay') || document.getElementById('mandalaPlay');
  const title = document.getElementById('soundscapeTitle') || document.getElementById('soundscapeTrackTitle');
  const status = document.getElementById('soundscapeStatus');
  const openButton = document.getElementById('openSoundscapes');
  const closeButton = document.getElementById('closeSoundscapes');
  const drawer = document.getElementById('mobileControlDrawer');
  const drawerToggle = document.getElementById('mobileControlsToggle');

  function setControls(open) {
    if (!drawer || !drawerToggle) return;
    drawer.classList.toggle('is-open', open);
    drawerToggle.setAttribute('aria-expanded', String(open));
    const label = drawerToggle.querySelector('.mobile-controls-label');
    if (label) label.textContent = open ? 'Hide' : 'Controls';
  }

  function showSoundscapes(show) {
    if (show) {
      setControls(false);
      page.hidden = false;
      page.classList.add('is-active');
      page.setAttribute('aria-hidden', 'false');
      app.classList.add('soundscapes-away');
      document.body.classList.add('soundscapes-active');
    } else {
      setControls(false);
      page.hidden = true;
      page.setAttribute('aria-hidden', 'true');
      page.classList.remove('is-active');
      app.classList.remove('soundscapes-away');
      document.body.classList.remove('soundscapes-active');
    }
  }

  openButton?.addEventListener('click', () => showSoundscapes(true));
  closeButton?.addEventListener('click', () => showSoundscapes(false));
  play?.addEventListener('click', () => {
    if (status) status.textContent = 'Bedroom Sessions player arrives next';
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && page.classList.contains('is-active')) showSoundscapes(false);
  });

  if (title) title.textContent = 'Bedroom Sessions';
  if (status) status.textContent = 'Owner tracks only — player next';
}
