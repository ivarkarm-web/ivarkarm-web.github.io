/** Soundscapes: Ivar's Bedroom Sessions plus the community-created song library. */
import { fetchCommunitySongs } from './repository-loop-save.js?v=2';

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
const app = document.getElementById('app');
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
  const communityQueueEl = document.getElementById('soundscapeCommunityQueue');
  const bedroomTab = document.getElementById('soundscapeBedroomTab');
  const communityTab = document.getElementById('soundscapeCommunityTab');
  const bedroomQueue = document.getElementById('soundscapeQueue');
  const bedroomTracks = BEDROOM_SESSIONS;
  let communityTracks = [];
  let activeCollection = 'bedroom';
  let communityConfigured = false;

  function currentTracks() { return activeCollection === 'community' ? communityTracks : bedroomTracks; }
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

  function syncMeta() {
    const track = currentTracks()[index];
    if (!track) return;
    if (titleEl) titleEl.textContent = track.title;
    if (noteEl) noteEl.textContent = track.note || track.instrument || '';
    if (totalEl) totalEl.textContent = fmt(track.duration);
    if (queueEl) queueEl.querySelectorAll('[data-track-index]').forEach((btn) => {
      btn.classList.toggle('is-active', activeCollection === 'bedroom' && Number(btn.dataset.trackIndex) === index);
    });
    if (communityQueueEl) communityQueueEl.querySelectorAll('[data-community-index]').forEach((btn) => {
      btn.classList.toggle('is-active', activeCollection === 'community' && Number(btn.dataset.communityIndex) === index);
    });
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: 'Ivar Karm',
          album: activeCollection === 'community' ? 'User-Created' : 'Bedroom Sessions',
        });
      } catch (_) {}
    }
  }

  function loadTrack(i, autoplay) {
    const tracks = currentTracks();
    if (!tracks.length) { setStatus(activeCollection === 'community' ? 'No community songs yet' : 'No tracks available'); return; }
    index = (i + tracks.length) % tracks.length;
    const track = tracks[index];
    syncMeta();
    setStatus('Loading…');
    audio.pause();
    // Prefer MP3; browser will error → we can fall back once
    audio.src = track.mp3 || track.audioUrl;
    audio.preload = 'metadata';
    audio.load();
    if (autoplay) {
      audio.play().then(() => setStatus('Playing')).catch(() => {
        setStatus('Press play');
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
    BEDROOM_SESSIONS.forEach((track, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'soundscape-queue-item' + (i === index ? ' is-active' : '');
      btn.dataset.trackIndex = String(i);
      btn.innerHTML = '<span class="sq-num">' + track.num + '</span><span class="sq-title">' + track.title + '</span><span class="sq-dur">' + fmt(track.duration) + '</span>';
      btn.addEventListener('click', () => loadTrack(i, true));
      queueEl.appendChild(btn);
    });
  }


  function setCollection(collection) {
    activeCollection = collection;
    index = 0;
    if (bedroomQueue) bedroomQueue.hidden = collection !== 'bedroom';
    if (communityQueueEl) communityQueueEl.hidden = collection !== 'community';
    bedroomTab?.classList.toggle('is-active', collection === 'bedroom');
    communityTab?.classList.toggle('is-active', collection === 'community');
    bedroomTab?.setAttribute('aria-pressed', String(collection === 'bedroom'));
    communityTab?.setAttribute('aria-pressed', String(collection === 'community'));
    const heading = document.querySelector('.soundscapes-header h2');
    if (heading) heading.textContent = collection === 'community' ? 'User-Created' : 'Bedroom Sessions';
    if (collection === 'community' && !communityConfigured) {
      setStatus('Community songs need the upload service to be configured.');
      return;
    }
    renderActiveQueue();
    if (currentTracks().length) loadTrack(0, false);
    else setStatus(collection === 'community' ? 'No community songs yet — be the first to share one.' : 'Bedroom Sessions · 8 tracks');
  }

  function renderCommunityQueue() {
    if (!communityQueueEl) return;
    communityQueueEl.replaceChildren();
    if (!communityConfigured) {
      const p = document.createElement('p');
      p.className = 'soundscape-community-empty';
      p.textContent = 'Community sharing is almost ready. The upload service has not been connected yet.';
      communityQueueEl.appendChild(p);
      return;
    }
    if (!communityTracks.length) {
      const p = document.createElement('p');
      p.className = 'soundscape-community-empty';
      p.textContent = 'No songs yet. Record a loop, tap Save, and share your first song.';
      communityQueueEl.appendChild(p);
      return;
    }
    communityTracks.forEach((track, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'soundscape-queue-item' + (activeCollection === 'community' && i === index ? ' is-active' : '');
      btn.dataset.communityIndex = String(i);
      const duration = fmt(Number(track.durationSeconds) || 0);
      const title = document.createElement('span'); title.className = 'sq-title'; title.textContent = track.title || 'Untitled';
      const num = document.createElement('span'); num.className = 'sq-num'; num.textContent = String(i + 1).padStart(2, '0');
      const dur = document.createElement('span'); dur.className = 'sq-dur'; dur.textContent = duration;
      const creator = document.createElement('span'); creator.className = 'sq-creator'; creator.textContent = track.creator ? 'by ' + track.creator : 'Pionier player';
      btn.append(num, title, dur, creator);
      btn.addEventListener('click', () => loadTrack(i, true));
      communityQueueEl.appendChild(btn);
    });
  }

  function renderActiveQueue() {
    if (activeCollection === 'bedroom') renderQueue();
    else renderCommunityQueue();
    syncMeta();
  }

  async function refreshCommunitySongs() {
    if (!communityQueueEl) return;
    try {
      const result = await fetchCommunitySongs();
      communityConfigured = result.configured;
      communityTracks = result.songs;
      renderCommunityQueue();
      if (activeCollection === 'community') {
        if (communityTracks.length) loadTrack(Math.min(index, communityTracks.length - 1), false);
        else setStatus(communityConfigured ? 'No community songs yet — be the first to share one.' : 'Community uploads are not configured yet.');
      }
    } catch (_) {
      communityConfigured = true;
      communityTracks = [];
      renderCommunityQueue();
      if (activeCollection === 'community') setStatus('Could not load community songs. Try again later.');
    }
  }

  function showSoundscapes(show) {
    if (show) {
      page.hidden = false;
      page.classList.add('is-active');
      page.setAttribute('aria-hidden', 'false');
      app?.classList.add('soundscapes-away');
      document.body.classList.add('soundscapes-active');
      // Hide instrument chrome while panel is open
      const bar = document.getElementById('stageScaleBar');
      if (bar) bar.style.visibility = 'hidden';
      const dock = document.getElementById('pionierTopDock');
      if (dock) dock.style.visibility = 'hidden';
    } else {
      page.hidden = true;
      page.setAttribute('aria-hidden', 'true');
      page.classList.remove('is-active');
      app?.classList.remove('soundscapes-away');
      document.body.classList.remove('soundscapes-active');
      const bar = document.getElementById('stageScaleBar');
      if (bar) bar.style.visibility = '';
      const dock = document.getElementById('pionierTopDock');
      if (dock) dock.style.visibility = '';
    }
  }

  bedroomTab?.addEventListener('click', () => setCollection('bedroom'));
  communityTab?.addEventListener('click', () => { setCollection('community'); refreshCommunitySongs(); });
  openButton?.addEventListener('click', () => { showSoundscapes(true); refreshCommunitySongs(); });
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

  seekEl?.addEventListener('pointerdown', () => { seeking = true; });
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
    if (playBtn) { playBtn.textContent = 'Ⅱ'; playBtn.setAttribute('aria-label', 'Pause'); }
    setStatus('Playing');
  });
  audio.addEventListener('pause', () => {
    if (playBtn) { playBtn.textContent = '▶'; playBtn.setAttribute('aria-label', 'Play'); }
    if (!audio.ended) setStatus('Paused');
  });
  audio.addEventListener('ended', () => {
    if (repeat) return;
    if (index < currentTracks().length - 1) loadTrack(index + 1, true);
    else setStatus('Finished');
  });
  audio.addEventListener('error', () => {
    const track = currentTracks()[index];
    if (activeCollection === 'bedroom' && track && audio.src === track.mp3) {
      setStatus('Trying WAV fallback…');
      audio.src = track.wav;
      audio.load();
      audio.play().catch(() => setStatus('Could not load track'));
    } else {
      setStatus('Could not load track');
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
  renderCommunityQueue();
  syncMeta();
  setStatus('Bedroom Sessions · 8 tracks');
}

export { BEDROOM_SESSIONS };
