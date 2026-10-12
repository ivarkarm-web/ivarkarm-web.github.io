import { createMandalaRenderer } from './mandala-canvas.js';

const page = document.getElementById('soundscapesPage');
const app = document.getElementById('app');
const pan = document.getElementById('pan');
const audio = document.getElementById('soundscapeAudio');
if (page && app && pan && audio) {
  const mandala = document.getElementById('mandalaWrap');
  const play = document.getElementById('mandalaPlay');
  const playIcon = document.getElementById('mandalaPlayIcon');
  const previous = document.getElementById('mandalaPreviousTrack');
  const next = document.getElementById('mandalaNextTrack');
  const fileInput = document.getElementById('soundscapeFile');
  const addButton = document.getElementById('addSoundscapeTrack');
  const title = document.getElementById('soundscapeTrackTitle');
  const subtitle = document.getElementById('soundscapeTrackSubtitle');
  const status = document.getElementById('soundscapeStatus');
  const drawer = document.getElementById('mobileControlDrawer');
  const drawerToggle = document.getElementById('mobileControlsToggle');
  const controlPanel = document.getElementById('mobileControlPanel');
  if (drawer && drawer.parentElement !== document.body) document.body.appendChild(drawer);
  if (controlPanel && !document.getElementById('soundscapeVolume')) {
    const extra = document.createElement('section');
    extra.className = 'soundscape-only';
    extra.innerHTML = '<div class="soundscape-only-heading">SOUNDSCAPE PLAYBACK</div><label class="soundscape-control-row"><span>Track volume</span><input id="soundscapeVolume" type="range" min="0" max="1" step="0.01" value="0.8" aria-label="Soundscape volume"></label><label class="soundscape-control-row"><span>Playback</span><select id="soundscapePlayback" aria-label="Soundscape playback"><option value="loop">Loop track</option><option value="once">Play once</option></select></label>';
    controlPanel.appendChild(extra);
  }
  const volume = document.getElementById('soundscapeVolume');
  const progress = document.getElementById('soundscapeProgress');
  const elapsed = document.getElementById('soundscapeTimeElapsed');
  const total = document.getElementById('soundscapeTimeTotal');
  const playback = document.getElementById('soundscapePlayback');
  const back = document.getElementById('backToHandpan');
  const openButton = document.getElementById('openSoundscapes');
  const renderer = createMandalaRenderer(mandala);

  let tracks = [];
  let activeIndex = -1;
  let objectUrls = [];
  let seeking = false;
  let swipeStart = null;
  let transitionTimer = 0;

  function fmtTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
  }
  function syncProgress() {
    if (seeking) return;
    const duration = audio.duration;
    const current = audio.currentTime;
    if (elapsed) elapsed.textContent = fmtTime(current);
    if (total) total.textContent = fmtTime(Number.isFinite(duration) ? duration : 0);
    if (progress && Number.isFinite(duration) && duration > 0) {
      progress.value = String(Math.round((current / duration) * 1000));
    }
  }
  function setPlaying(playing) {
    page.classList.toggle('is-playing', playing);
    if (playIcon) playIcon.textContent = playing ? 'Ⅱ' : '▶';
    play?.setAttribute('aria-label', playing ? 'Pause soundscape' : 'Play soundscape');
    if (status) status.textContent = playing ? 'NOW PLAYING' : (audio.src ? 'PAUSED' : 'READY WHEN YOU ARE');
  }
  function setControls(open) {
    if (!drawer || !drawerToggle) return;
    drawer.classList.toggle('is-open', open);
    drawerToggle.setAttribute('aria-expanded', String(open));
    const label = drawerToggle.querySelector('.mobile-controls-label');
    if (label) label.textContent = open ? 'Hide' : 'Controls';
  }
  function loadTrack(index, autoplay = true) {
    if (!tracks.length) {
      status.textContent = 'ADD AN AUDIO FILE TO BEGIN';
      fileInput?.click();
      return;
    }
    activeIndex = (index + tracks.length) % tracks.length;
    const track = tracks[activeIndex];
    audio.pause();
    audio.src = track.url;
    audio.load();
    audio.loop = playback?.value !== 'once';
    title.textContent = track.name;
    subtitle.textContent = tracks.length > 1 ? 'TRACK ' + (activeIndex + 1) + ' / ' + tracks.length : 'ONE TRACK LOADED';
    if (status) status.textContent = 'TRACK LOADED';
    if (autoplay) {
      audio.play().then(() => setPlaying(true)).catch(() => {
        setPlaying(false);
        if (status) status.textContent = 'PRESS PLAY TO START';
      });
    } else setPlaying(false);
  }
  function showSoundscapes(show) {
    if (transitionTimer) {
      clearTimeout(transitionTimer);
      transitionTimer = 0;
    }
    if (show) {
      setControls(false);
      page.classList.add('is-active');
      page.setAttribute('aria-hidden', 'false');
      app.classList.add('soundscapes-away');
      document.body.classList.add('soundscapes-active');
      renderer?.start();
    } else {
      setControls(false);
      page.setAttribute('aria-hidden', 'true');
      page.classList.remove('is-active');
      app.classList.remove('soundscapes-away');
      document.body.classList.remove('soundscapes-active');
      renderer?.stop();
    }
  }
  function interactiveTarget(target) {
    return !!target?.closest?.('button, input, select, textarea, a, .soundscape-control-drawer, .mobile-control-drawer');
  }

  addButton?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []).filter((file) =>
      file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(file.name)
    );
    if (!files.length) return;
    audio.pause();
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];
    tracks = files.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrls.push(url);
      return { name: file.name.replace(/\.[^.]+$/, ''), url };
    });
    activeIndex = -1;
    loadTrack(0, true);
    fileInput.value = '';
  });
  play?.addEventListener('click', () => {
    if (!audio.src) { fileInput?.click(); return; }
    if (audio.paused) {
      audio.play().then(() => setPlaying(true)).catch(() => {
        if (status) status.textContent = 'PLAYBACK UNAVAILABLE';
      });
    } else {
      audio.pause();
      setPlaying(false);
    }
  });
  previous?.addEventListener('click', () => loadTrack(activeIndex - 1, true));
  next?.addEventListener('click', () => loadTrack(activeIndex + 1, true));
  back?.addEventListener('click', () => showSoundscapes(false));
  openButton?.addEventListener('click', () => showSoundscapes(true));
  // The core owns the shared drawer toggle listener; do not toggle it twice.
  volume?.addEventListener('input', () => { audio.volume = Number(volume.value); });
  playback?.addEventListener('change', () => { audio.loop = playback.value !== 'once'; });
  progress?.addEventListener('pointerdown', () => { seeking = true; });
  progress?.addEventListener('input', () => {
    if (seeking && Number.isFinite(audio.duration) && audio.duration > 0 && elapsed) {
      elapsed.textContent = fmtTime((Number(progress.value) / 1000) * audio.duration);
    }
  });
  function seek() {
    if (Number.isFinite(audio.duration) && audio.duration > 0 && progress) {
      audio.currentTime = Math.max(0, Math.min(audio.duration, Number(progress.value) / 1000 * audio.duration));
    }
    seeking = false;
    syncProgress();
  }
  progress?.addEventListener('change', seek);
  progress?.addEventListener('pointerup', seek);
  audio.addEventListener('timeupdate', syncProgress);
  audio.addEventListener('loadedmetadata', syncProgress);
  audio.addEventListener('play', () => setPlaying(true));
  audio.addEventListener('pause', () => setPlaying(false));
  audio.addEventListener('ended', () => {
    if (playback?.value === 'loop') {
      audio.currentTime = 0;
      audio.play().catch(() => setPlaying(false));
    } else if (activeIndex < tracks.length - 1) loadTrack(activeIndex + 1, true);
    else setPlaying(false);
  });
  audio.volume = Number(volume?.value ?? 0.8);
  audio.loop = true;

  // Swipe left on the instrument to enter; swipe right on the page to return.
  // Ignore UI controls so slider and transport gestures never trigger navigation.
  window.addEventListener('pointerdown', (event) => {
    if (interactiveTarget(event.target) || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const active = page.classList.contains('is-active');
    if (!active && !event.target.closest?.('#pan')) return;
    // Allow swipes anywhere on the non-interactive Soundscapes surface.
    swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY, active };
  }, { passive: true });
  window.addEventListener('pointerup', (event) => {
    if (!swipeStart || swipeStart.id !== event.pointerId) return;
    const start = swipeStart;
    swipeStart = null;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 78 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    if (!start.active && dx < 0) showSoundscapes(true);
    else if (start.active && dx > 0) showSoundscapes(false);
  }, { passive: true });
  window.addEventListener('pointercancel', () => { swipeStart = null; }, { passive: true });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && page.classList.contains('is-active')) showSoundscapes(false);
  });
  window.addEventListener('beforeunload', () => objectUrls.forEach((url) => URL.revokeObjectURL(url)));
}
