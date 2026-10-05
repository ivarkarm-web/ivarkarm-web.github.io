/**
 * music-player.js
 * Dedicated playback controller for the Resonance music catalogue.
 * Depends on: music-data.js, audio.js, utilities.js and DOM markup in index.html.
 * Keeps playback state and transport behavior isolated from the broader UI controller.
 */

const MUSIC_TRACKS = window.MUSIC_TRACKS || [];

const musicPlayer = window.musicPlayer = {
  audio: null,
  index: 0,
  isPlaying: false,
  els: {},
  fadeTimer: null,
  isEndingFade: false,
  isDrawerOpen: false
};

function mpFormatTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function mpFadeVolume(targetVol, durationMs, onComplete) {
  if (musicPlayer.fadeTimer) {
    clearInterval(musicPlayer.fadeTimer);
    musicPlayer.fadeTimer = null;
  }
  const a = musicPlayer.audio;
  if (!a) {
    if (onComplete) onComplete();
    return;
  }

  const startVol = typeof a.volume === 'number' ? a.volume : 1;
  const startTime = Date.now();
  durationMs = Math.max(80, durationMs || 450);

  musicPlayer.fadeTimer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    const factor = 0.5 - 0.5 * Math.cos(progress * Math.PI);
    const curVol = Math.max(0, Math.min(1, startVol + (targetVol - startVol) * factor));

    try { a.volume = curVol; } catch (_) {}

    if (progress >= 1) {
      clearInterval(musicPlayer.fadeTimer);
      musicPlayer.fadeTimer = null;
      try { a.volume = targetVol; } catch (_) {}
      if (onComplete) onComplete();
    }
  }, 25);
}

function mpUpdateProgress() {
  const a = musicPlayer.audio;
  if (!a) return;
  const track = MUSIC_TRACKS[musicPlayer.index] || MUSIC_TRACKS[0];
  const dur = (isFinite(a.duration) && a.duration > 0) ? a.duration : (track.duration || 85);
  const curTime = (isFinite(a.currentTime) && a.currentTime > 0) ? a.currentTime : 0;

  if (dur > 0) {
    const p = Math.max(0, Math.min(100, (curTime / dur) * 100));
    if (musicPlayer.els.filled) musicPlayer.els.filled.style.width = p + '%';
    if (musicPlayer.els.handle) musicPlayer.els.handle.style.left = p + '%';
    if (musicPlayer.els.current) musicPlayer.els.current.textContent = mpFormatTime(curTime);
    if (musicPlayer.els.duration) musicPlayer.els.duration.textContent = mpFormatTime(dur);
    if (musicPlayer.els.progress) musicPlayer.els.progress.setAttribute('aria-valuenow', Math.round(p));

    const timeLeft = dur - curTime;
    if (timeLeft <= 2.2 && !musicPlayer.isEndingFade && !a.paused && dur > 6) {
      musicPlayer.isEndingFade = true;
      mpFadeVolume(0, Math.max(400, timeLeft * 1000 - 150));
    }
  }
}

function mpSetPlayingUI(playing) {
  musicPlayer.isPlaying = playing;
  if (typeof trackEvent === 'function') {
    trackEvent(playing ? 'music_play' : 'music_pause', {
      track: (typeof MUSIC_TRACKS !== 'undefined' && MUSIC_TRACKS[musicPlayer.index])
        ? MUSIC_TRACKS[musicPlayer.index].title
        : ''
    });
  }
  const pi = musicPlayer.els.playBtn && musicPlayer.els.playBtn.querySelector('.mp-icon-play');
  const pa = musicPlayer.els.playBtn && musicPlayer.els.playBtn.querySelector('.mp-icon-pause');
  if (pi) pi.style.display = playing ? 'none' : 'block';
  if (pa) pa.style.display = playing ? 'block' : 'none';

  if (musicPlayer.els.tracklist) {
    musicPlayer.els.tracklist.querySelectorAll('.mp-track').forEach((li, idx) => {
      if (idx === musicPlayer.index) {
        li.classList.toggle('is-playing', playing);
      } else {
        li.classList.remove('is-playing');
      }
    });
  }
}

function mpHighlightTrack(i) {
  if (!musicPlayer.els.tracklist) return;
  musicPlayer.els.tracklist.querySelectorAll('.mp-track').forEach((li, j) => {
    const isActive = j === i;
    li.classList.toggle('active', isActive);
    li.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (isActive && musicPlayer.isPlaying) {
      li.classList.add('is-playing');
    } else {
      li.classList.remove('is-playing');
    }
  });
}

function mpSelectAndPlayTrack(index) {
  if (index < 0 || index >= MUSIC_TRACKS.length) return;
  const track = MUSIC_TRACKS[index];
  musicPlayer.index = index;
  musicPlayer.isEndingFade = false;
  const a = musicPlayer.audio;
  if (!a) return;

  // 1. Immediately update active class
  mpHighlightTrack(index);

  // 2. Immediately reset progress bar and timer to zero
  if (musicPlayer.els.filled) musicPlayer.els.filled.style.width = '0%';
  if (musicPlayer.els.handle) musicPlayer.els.handle.style.left = '0%';
  if (musicPlayer.els.current) musicPlayer.els.current.textContent = '0:00';
  if (musicPlayer.els.duration) musicPlayer.els.duration.textContent = mpFormatTime(track.duration);
  if (musicPlayer.els.progress) musicPlayer.els.progress.setAttribute('aria-valuenow', '0');

  // 3. Immediately update titles and track number
  if (musicPlayer.els.title) musicPlayer.els.title.textContent = track.title;
  if (musicPlayer.els.subtitle) musicPlayer.els.subtitle.textContent = track.subtitle;
  if (musicPlayer.els.trackNum) musicPlayer.els.trackNum.textContent = track.num || String(musicPlayer.index + 1).padStart(2, '0');
  if (musicPlayer.els.note) musicPlayer.els.note.textContent = track.note || '';
  if (musicPlayer.els.location) musicPlayer.els.location.textContent = track.location || '';
  if (musicPlayer.els.trackNum) musicPlayer.els.trackNum.textContent = String(index + 1).padStart(2, '0');

  // 4. Fade out any background audio orb
  if (typeof currentAudio !== 'undefined' && currentAudio) {
    const orbAudio = currentAudio;
    currentAudio = null;
    if (typeof fadeOutAudio === 'function') fadeOutAudio(orbAudio);
  }

  // 5. Cancel any pending volume fade timer
  if (musicPlayer.fadeTimer) {
    clearInterval(musicPlayer.fadeTimer);
    musicPlayer.fadeTimer = null;
  }

  // 6. Set source, reset currentTime to 0, and start playback
  if (a.src !== track.src) {
    a.src = track.src;
  }
  a.currentTime = 0;
  try { a.volume = 0; } catch (_) {}

  mpSetPlayingUI(true);

  const playPromise = a.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      mpSetPlayingUI(true);
      mpFadeVolume(1.0, 600);
    }).catch((err) => {
      console.warn('Audio playback notice:', err);
      mpSetPlayingUI(false);
    });
  }
}

function mpTogglePlay() {
  const a = musicPlayer.audio;
  if (!a) return;

  if (a.paused) {
    if (typeof currentAudio !== 'undefined' && currentAudio) {
      const orbAudio = currentAudio;
      currentAudio = null;
      if (typeof fadeOutAudio === 'function') fadeOutAudio(orbAudio);
    }

    const currentTrack = MUSIC_TRACKS[musicPlayer.index] || MUSIC_TRACKS[0];
    if (!a.src || a.src === window.location.href) {
      a.src = currentTrack.src;
      a.currentTime = 0;
    }

    try { a.volume = 0; } catch (_) {}
    mpSetPlayingUI(true);

    const p = a.play();
    if (p !== undefined) {
      p.then(() => {
        mpSetPlayingUI(true);
        mpFadeVolume(1.0, 600);
      }).catch((err) => {
        console.warn('Play error:', err);
        mpSetPlayingUI(false);
      });
    }
  } else {
    mpSetPlayingUI(false);
    mpFadeVolume(0, 200, () => {
      try { a.pause(); } catch (_) {}
      mpSetPlayingUI(false);
    });
  }
}

function mpPrev() {
  const prevIdx = (musicPlayer.index - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
  mpSelectAndPlayTrack(prevIdx);
}

function mpNext() {
  const nextIdx = (musicPlayer.index + 1) % MUSIC_TRACKS.length;
  mpSelectAndPlayTrack(nextIdx);
}

// ============================================================================
// IMPROV SESSIONS DRAWER CONTROLLER (PULL UP / PULL DOWN)
// ============================================================================
function openMusicDrawer() {
  const overlay = document.getElementById('mpDrawerOverlay');
  if (!overlay || musicPlayer.isDrawerOpen) return;
  musicPlayer.isDrawerOpen = true;
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('mp-drawer-open');
  if (typeof triggerHaptic === 'function') triggerHaptic('medium');

  // Freeze the platformer: no momentum, no held keys, no active touches
  vx = 0;
  keys = {};
  if (typeof activeTouchAssignments !== 'undefined') activeTouchAssignments.clear();

  const closeBtn = document.getElementById('mpCloseDrawerBtn');
  if (closeBtn) { try { closeBtn.focus({ preventScroll: true }); } catch (_) {} }
}

function closeMusicDrawer() {
  const overlay = document.getElementById('mpDrawerOverlay');
  if (!overlay) return;
  musicPlayer.isDrawerOpen = false;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('mp-drawer-open');
  if (typeof triggerHaptic === 'function') triggerHaptic('light');

  // Reset any sheet drag inline styles
  const sheet = document.getElementById('mpDrawerSheet');
  if (sheet) {
    sheet.classList.remove('dragging');
    sheet.style.transform = '';
  }
  keys = {};
  if (typeof canvas !== 'undefined' && canvas) {
    try { canvas.focus({ preventScroll: true }); } catch (_) {}
  }
}

function initMusicDrawerGestures() {
  const openBtn = document.getElementById('mpPullCue');
  const closeBtn = document.getElementById('mpCloseDrawerBtn');
  const backdrop = document.getElementById('mpDrawerBackdrop');
  const header = document.getElementById('mpDrawerHeader');
  const sheet = document.getElementById('mpDrawerSheet');
  const s4Section = document.getElementById('s4');

  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMusicDrawer();
    });
    // Swipe / pull down on the cue pulls the player open
    let cueStartY = 0;
    openBtn.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) cueStartY = e.touches[0].clientY;
    }, { passive: true });
    openBtn.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0] && e.touches[0].clientY - cueStartY > 16) {
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });
    openBtn.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientY - cueStartY > 16) {
        if (e.cancelable) e.preventDefault();
        openMusicDrawer();
      }
    }, { passive: false });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMusicDrawer();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMusicDrawer();
    });
  }

  // Swipe UP on Section 4 to reveal drawer
  if (s4Section) {
    let touchStartY = 0;
    s4Section.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) touchStartY = e.touches[0].clientY;
    }, { passive: true });

    s4Section.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        const deltaY = touchStartY - e.changedTouches[0].clientY;
        if (deltaY > 60 && !musicPlayer.isDrawerOpen) {
          openMusicDrawer();
        }
      }
    }, { passive: true });
  }

  // Swipe / Drag DOWN on Drawer Header or Sheet to dismiss
  if (header && sheet) {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const onTouchStart = (e) => {
      if (!e.touches || !e.touches[0]) return;
      startY = e.touches[0].clientY;
      currentY = startY;
      isDragging = true;
      sheet.classList.add('dragging');
    };

    const onTouchMove = (e) => {
      if (!isDragging || !e.touches || !e.touches[0]) return;
      currentY = e.touches[0].clientY;
      const delta = currentY - startY;
      if (delta > 0) {
        // Resistance curve
        sheet.style.transform = `translateY(${delta}px)`;
      }
    };

    const onTouchEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      sheet.classList.remove('dragging');
      const delta = currentY - startY;
      if (delta > 75) {
        closeMusicDrawer();
      } else {
        sheet.style.transform = '';
      }
    };

    header.addEventListener('touchstart', onTouchStart, { passive: true });
    header.addEventListener('touchmove', onTouchMove, { passive: true });
    header.addEventListener('touchend', onTouchEnd, { passive: true });
  }
}

function initMusicPlayer() {
  const playerEl = document.getElementById('musicPlayer');
  if (!playerEl) return;

  musicPlayer.audio = document.getElementById('mpAudio');
  musicPlayer.els = {
    title: document.getElementById('mpTitle'),
    subtitle: document.getElementById('mpSubtitle'),
    trackNum: document.getElementById('mpTrackNum'),
    note: document.getElementById('mpNote'),
    location: document.getElementById('mpLocation'),
    filled: document.getElementById('mpProgressFilled'),
    handle: document.getElementById('mpProgressHandle'),
    progress: document.getElementById('mpProgress'),
    current: document.getElementById('mpCurrentTime'),
    duration: document.getElementById('mpDuration'),
    playBtn: document.getElementById('mpPlay'),
    prevBtn: document.getElementById('mpPrev'),
    nextBtn: document.getElementById('mpNext'),
    tracklist: document.getElementById('mpTracklist')
  };

  const a = musicPlayer.audio;
  if (!a) return;

  // Pre-load track 0 immediately
  const initialTrack = MUSIC_TRACKS[0];
  if (musicPlayer.els.title) musicPlayer.els.title.textContent = initialTrack.title;
  if (musicPlayer.els.subtitle) musicPlayer.els.subtitle.textContent = initialTrack.subtitle;
  if (musicPlayer.els.trackNum) musicPlayer.els.trackNum.textContent = '01';
  if (musicPlayer.els.duration) musicPlayer.els.duration.textContent = mpFormatTime(initialTrack.duration);
  if (musicPlayer.els.current) musicPlayer.els.current.textContent = '0:00';
  a.src = initialTrack.src;
  mpHighlightTrack(0);

  a.addEventListener('timeupdate', mpUpdateProgress);
  a.addEventListener('loadedmetadata', mpUpdateProgress);
  a.addEventListener('durationchange', mpUpdateProgress);
  a.addEventListener('canplay', mpUpdateProgress);

  a.addEventListener('play', () => {
    mpSetPlayingUI(true);
    if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.masterGain) {
      try { ResonanceAudio.masterGain.gain.setValueAtTime(0.04, ResonanceAudio.ctx.currentTime); } catch (_) {}
    }
  });

  a.addEventListener('pause', () => {
    if (!musicPlayer.fadeTimer) {
      mpSetPlayingUI(false);
    }
    if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.masterGain && !ResonanceAudio.isMuted) {
      try { ResonanceAudio.masterGain.gain.setValueAtTime(0.7, ResonanceAudio.ctx.currentTime); } catch (_) {}
    }
  });

  a.addEventListener('ended', () => {
    mpNext();
  });

  const bindControl = (el, action) => {
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (typeof triggerHaptic === 'function') triggerHaptic('light');
      action();
    });
  };

  bindControl(musicPlayer.els.playBtn, mpTogglePlay);
  bindControl(musicPlayer.els.prevBtn, mpPrev);
  bindControl(musicPlayer.els.nextBtn, mpNext);

  if (musicPlayer.els.progress) {
    const handleSeek = (e) => {
      e.stopPropagation();
      const rect = musicPlayer.els.progress.getBoundingClientRect();
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const track = MUSIC_TRACKS[musicPlayer.index] || initialTrack;
      const dur = (isFinite(a.duration) && a.duration > 0) ? a.duration : (track.duration || 85);
      a.currentTime = frac * dur;
      mpUpdateProgress();
    };

    musicPlayer.els.progress.addEventListener('click', handleSeek);
  }

  // Enhanced mpTracklist event delegation
  if (musicPlayer.els.tracklist) {
    let lastTrackClickTime = 0;

    const handleTracklistInteraction = (e) => {
      const trackEl = e.target.closest('.mp-track');
      if (!trackEl) return;

      const now = performance.now();
      if (now - lastTrackClickTime < 250) return;
      lastTrackClickTime = now;

      e.stopPropagation();
      if (e.cancelable) e.preventDefault();

      const idx = parseInt(trackEl.getAttribute('data-index'), 10);
      if (!isNaN(idx) && idx >= 0 && idx < MUSIC_TRACKS.length) {
        if (typeof triggerHaptic === 'function') triggerHaptic('light');
        mpSelectAndPlayTrack(idx);
      }
    };

    musicPlayer.els.tracklist.addEventListener('click', handleTracklistInteraction);
    musicPlayer.els.tracklist.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleTracklistInteraction(e);
      }
    });
  }

  initMusicDrawerGestures();
}

