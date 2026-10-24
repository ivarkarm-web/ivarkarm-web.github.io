/** Soundscapes: Ivar's Bedroom Sessions only (owner archive.org recordings).
 *  No community uploads — removed for scale and product scope.
 */

/** Mirror of ../js/music-data.js — keep in sync; MP3 preferred for streaming. */
const BEDROOM_SESSIONS = [
  {
    num: '01',
    title: 'E Amara · Improvisation 1',
    note: 'Raw take. Kept as it was.',
    instrument: 'E Amara handpan',
    duration: 85,
    mp3: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%201.mp3',
    wav: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%201.wav',
  },
  {
    num: '02',
    title: 'E Amara · Improvisation 2',
    note: 'Second pass the same night.',
    instrument: 'E Amara handpan',
    duration: 106,
    mp3: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%202.mp3',
    wav: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%202.wav',
  },
  {
    num: '03',
    title: 'E Amara · Improvisation 3',
    note: 'Shorter breath between phrases.',
    instrument: 'E Amara handpan',
    duration: 89,
    mp3: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%203.mp3',
    wav: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%203.wav',
  },
  {
    num: '04',
    title: 'E Amara · Improvisation 4',
    note: 'Compact form.',
    instrument: 'E Amara handpan',
    duration: 65,
    mp3: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%204.mp3',
    wav: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%204.wav',
  },
  {
    num: '05',
    title: 'E Amara · Improvisation 5',
    note: 'Longer sustained lines.',
    instrument: 'E Amara handpan',
    duration: 106,
    mp3: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%205.mp3',
    wav: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%205.wav',
  },
  {
    num: '06',
    title: 'E Amara · Improvisation 7',
    note: 'Session seven in the series.',
    instrument: 'E Amara handpan',
    duration: 77,
    mp3: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%207.mp3',
    wav: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%207.wav',
  },
  {
    num: '07',
    title: 'E Amara · Improvisation 8',
    note: 'Closing short take.',
    instrument: 'E Amara handpan',
    duration: 68,
    mp3: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%208.mp3',
    wav: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%208.wav',
  },
  {
    num: '08',
    title: 'E Amara · Bedroom Sessions (Master)',
    note: 'Longer continuous improvisation.',
    instrument: 'E Amara handpan',
    duration: 180,
    mp3: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20sessions%20-%2003.10.2026%2C%2022.29.mp3',
    wav: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20sessions%20-%2003.10.2026%2C%2022.29.wav',
  },
];

const page = document.getElementById('soundscapesPage') || document.getElementById('soundscapesPanel');
const audio = document.getElementById('soundscapeAudio');

if (page && audio) {
  const playBtn = document.getElementById('soundscapePlay');
  const prevBtn = document.getElementById('soundscapePrev');
  const nextBtn = document.getElementById('soundscapeNext');
  const titleEl = document.getElementById('soundscapeTitle');
  const noteEl = document.getElementById('soundscapeNote');
  const statusEl = document.getElementById('soundscapeStatus');
  const timeEl = document.getElementById('soundscapeTime');
  const totalEl = document.getElementById('soundscapeTimeTotal');
  const seekEl = document.getElementById('soundscapeSeek');
  const volEl = document.getElementById('soundscapeVolume');
  const queueEl = document.getElementById('soundscapeQueue');
  const openButton = document.getElementById('openSoundscapes');
  const closeButton = document.getElementById('closeSoundscapes');
  const repeatBtn = document.getElementById('soundscapeRepeat');

  const tracks = BEDROOM_SESSIONS;
  let index = 0;
  let seeking = false;
  let repeat = false;

  function fmt(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  // Media load failures must be visible even when autoplay was not requested.
  audio.addEventListener('error', () => {
    setStatus(networkStatusMessage());
    playBtn?.setAttribute('aria-label', 'Play');
    if (playBtn) playBtn.textContent = '▶';
  });

  function networkStatusMessage() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'Needs network — Bedroom Sessions load from archive.org';
    }
    return 'Could not load track — check connection';
  }

  function syncMeta() {
    const track = tracks[index];
    if (!track) return;
    if (titleEl) titleEl.textContent = track.title;
    if (noteEl) noteEl.textContent = track.note || track.instrument || '';
    if (totalEl) totalEl.textContent = fmt(track.duration);
    if (queueEl) {
      queueEl.querySelectorAll('[data-track-index]').forEach((btn) => {
        btn.classList.toggle('is-active', Number(btn.dataset.trackIndex) === index);
      });
    }
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: 'Ivar Karm',
          album: 'Bedroom Sessions',
        });
      } catch (_) {}
    }
  }

  function loadTrack(i, autoplay) {
    if (!tracks.length) {
      setStatus('No tracks available');
      return;
    }
    index = (i + tracks.length) % tracks.length;
    const track = tracks[index];
    syncMeta();
    setStatus('Loading…');
    audio.pause();
    audio.src = track.mp3 || track.audioUrl;
    audio.preload = 'metadata';
    audio.load();
    if (autoplay) {
      audio.play().then(() => setStatus('Playing')).catch(() => {
        setStatus(audio.error ? networkStatusMessage() : 'Press play');
        playBtn?.setAttribute('aria-label', 'Play');
        if (playBtn) playBtn.textContent = '▶';
      });
    } else {
      setStatus('Ready');
    }
  }

  function renderQueue() {
    if (!queueEl) return;
    queueEl.replaceChildren();
    tracks.forEach((track, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'soundscape-queue-item' + (i === index ? ' is-active' : '');
      btn.dataset.trackIndex = String(i);
      btn.setAttribute('role', 'listitem');
      const num = document.createElement('span');
      num.className = 'sq-num';
      num.textContent = String(track.num ?? i + 1);
      const title = document.createElement('span');
      title.className = 'sq-title';
      title.textContent = track.title || ('Track ' + (i + 1));
      const dur = document.createElement('span');
      dur.className = 'sq-dur';
      dur.textContent = fmt(track.duration);
      btn.append(num, title, dur);
      btn.addEventListener('click', () => loadTrack(i, true));
      queueEl.appendChild(btn);
    });
  }

  function showSoundscapes(show) {
    if (show) {
      page.hidden = false;
      page.removeAttribute('hidden');
      page.classList.add('is-active');
      page.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => {
        if (!page.hidden && page.classList.contains('is-active')) page.classList.add('is-open');
      });
    } else {
      page.classList.remove('is-open', 'is-active');
      page.setAttribute('aria-hidden', 'true');
      window.setTimeout(() => {
        if (!page.classList.contains('is-open') && !page.classList.contains('is-active')) {
          page.hidden = true;
          page.setAttribute('hidden', '');
        }
      }, 220);
      try { openButton?.focus?.(); } catch (_) {}
    }
  }

  openButton?.addEventListener('click', () => {
    if (page.classList.contains('is-active') && !page.hidden) {
      showSoundscapes(false);
      return;
    }
    window.PionierOverlay?.closeAll?.('soundscapes');
    showSoundscapes(true);
  });
  closeButton?.addEventListener('click', () => showSoundscapes(false));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && page.classList.contains('is-active')) showSoundscapes(false);
  });

  playBtn?.addEventListener('click', () => {
    if (!audio.src) {
      loadTrack(index, true);
      return;
    }
    if (audio.paused) {
      audio.play().then(() => setStatus('Playing')).catch(() => setStatus('Playback blocked'));
    } else {
      audio.pause();
      setStatus('Paused');
    }
  });
  prevBtn?.addEventListener('click', () => loadTrack(index - 1, true));
  nextBtn?.addEventListener('click', () => loadTrack(index + 1, true));
  repeatBtn?.addEventListener('click', () => {
    repeat = !repeat;
    audio.loop = repeat;
    repeatBtn.classList.toggle('is-active', repeat);
    repeatBtn.setAttribute('aria-pressed', String(repeat));
  });

  volEl?.addEventListener('input', () => {
    audio.volume = Number(volEl.value);
  });
  if (volEl) audio.volume = Number(volEl.value || 0.85);

  seekEl?.addEventListener('pointerdown', () => {
    seeking = true;
  });
  seekEl?.addEventListener('input', () => {
    if (!seeking || !Number.isFinite(audio.duration) || !timeEl) return;
    timeEl.textContent = fmt((Number(seekEl.value) / 1000) * audio.duration);
  });
  function commitSeek() {
    if (Number.isFinite(audio.duration) && audio.duration > 0 && seekEl) {
      audio.currentTime = Math.max(0, Math.min(audio.duration, (Number(seekEl.value) / 1000) * audio.duration));
    }
    seeking = false;
  }
  seekEl?.addEventListener('change', commitSeek);
  seekEl?.addEventListener('pointerup', commitSeek);

  audio.addEventListener('timeupdate', () => {
    if (seeking) return;
    if (timeEl) timeEl.textContent = fmt(audio.currentTime);
    if (totalEl && Number.isFinite(audio.duration)) totalEl.textContent = fmt(audio.duration);
    if (seekEl && Number.isFinite(audio.duration) && audio.duration > 0) {
      seekEl.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
    }
  });
  audio.addEventListener('play', () => {
    if (playBtn) {
      playBtn.textContent = 'Ⅱ';
      playBtn.setAttribute('aria-label', 'Pause');
    }
    setStatus('Playing');
  });
  audio.addEventListener('pause', () => {
    if (playBtn) {
      playBtn.textContent = '▶';
      playBtn.setAttribute('aria-label', 'Play');
    }
    if (!audio.ended) setStatus('Paused');
  });
  audio.addEventListener('ended', () => {
    if (repeat) return;
    if (index < tracks.length - 1) loadTrack(index + 1, true);
    else setStatus('Finished');
  });
  audio.addEventListener('error', () => {
    const track = tracks[index];
    if (track && track.mp3 && audio.src && audio.src.indexOf('archive.org') !== -1 && track.wav && !audio.dataset.triedWav) {
      audio.dataset.triedWav = '1';
      setStatus('Trying WAV fallback…');
      audio.src = track.wav;
      audio.load();
      audio.play().catch(() => setStatus(networkStatusMessage()));
    } else {
      delete audio.dataset.triedWav;
      setStatus(networkStatusMessage());
    }
  });
  audio.addEventListener('loadedmetadata', () => {
    if (totalEl && Number.isFinite(audio.duration)) totalEl.textContent = fmt(audio.duration);
  });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => audio.play());
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => loadTrack(index - 1, true));
      navigator.mediaSession.setActionHandler('nexttrack', () => loadTrack(index + 1, true));
    } catch (_) {}
  }

  renderQueue();
  syncMeta();
  setStatus('Bedroom Sessions · 8 tracks');
}

export { BEDROOM_SESSIONS };
