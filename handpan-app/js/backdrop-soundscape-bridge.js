/**
 * backdrop-soundscape-bridge.js
 * Connects Soundscapes page playlist to the bottom backdrop player transport.
 * Loaded after both modules; safe if either is missing.
 */
(function bridge() {
  function soundscapeActive() {
    const ss = window.PionierSoundscapes;
    return !!(ss && ss.hasTracks && ss.hasTracks());
  }

  function wire() {
    const api = window.PionierBackdropPlayer;
    if (!api || api.__soundscapeWired) return;
    api.__soundscapeWired = true;

    const el = document.getElementById('backdropPlayer');
    const nameEl = el?.querySelector('[data-track-name]');
    const volEl = el?.querySelector('[data-volume]');
    const btnPlay = el?.querySelector('[data-act="play"]');

    function syncFromSoundscape() {
      const ss = window.PionierSoundscapes;
      if (!ss) return;
      const st = ss.getState();
      if (nameEl && st.title) nameEl.textContent = st.title;
      if (btnPlay) {
        const playing = !!st.playing;
        btnPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        btnPlay.textContent = playing ? '\u25AE\u25AE' : '\u25B6';
        btnPlay.classList.toggle('is-playing', playing);
        if (el) el.dataset.playing = String(playing);
      }
    }

    const origPlay = api.play.bind(api);
    const origPause = api.pause.bind(api);
    const origNext = api.next.bind(api);
    const origPrev = api.prev.bind(api);

    api.play = function () {
      if (soundscapeActive()) { window.PionierSoundscapes.play(); syncFromSoundscape(); return; }
      return origPlay();
    };
    api.pause = function () {
      if (soundscapeActive()) { window.PionierSoundscapes.pause(); syncFromSoundscape(); return; }
      return origPause();
    };
    api.next = function () {
      if (soundscapeActive()) { window.PionierSoundscapes.next(); syncFromSoundscape(); return; }
      return origNext();
    };
    api.prev = function () {
      if (soundscapeActive()) { window.PionierSoundscapes.prev(); syncFromSoundscape(); return; }
      return origPrev();
    };

    el?.addEventListener('click', (e) => {
      const act = e.target?.closest?.('[data-act]')?.getAttribute('data-act');
      if (!act || !soundscapeActive()) return;
      if (act === 'play') {
        e.stopPropagation();
        e.preventDefault();
        window.PionierSoundscapes.toggle();
        syncFromSoundscape();
      } else if (act === 'next') {
        e.stopPropagation();
        e.preventDefault();
        window.PionierSoundscapes.next();
        syncFromSoundscape();
      } else if (act === 'prev') {
        e.stopPropagation();
        e.preventDefault();
        window.PionierSoundscapes.prev();
        syncFromSoundscape();
      }
    }, true);

    volEl?.addEventListener('input', () => {
      if (!soundscapeActive()) return;
      const ssVol = document.getElementById('soundscapeVolume');
      const a = document.getElementById('soundscapeAudio');
      if (ssVol) ssVol.value = String(Number(volEl.value) / 100);
      if (a) a.volume = Number(volEl.value) / 100;
    });

    window.addEventListener('pionier:soundscape', () => {
      if (soundscapeActive()) {
        try { origPause(); } catch (_) {}
        syncFromSoundscape();
      }
    });
  }

  function ensureSoundscapeNotify() {
    const audio = document.getElementById('soundscapeAudio');
    if (!audio || window.__pionierSsNotify) return;
    window.__pionierSsNotify = true;
    const notify = () => {
      try {
        const ss = window.PionierSoundscapes;
        const detail = ss ? ss.getState() : {};
        window.dispatchEvent(new CustomEvent('pionier:soundscape', { detail }));
      } catch (_) {}
    };
    audio.addEventListener('play', notify);
    audio.addEventListener('pause', notify);
    audio.addEventListener('ended', notify);
    document.getElementById('soundscapeFile')?.addEventListener('change', () => setTimeout(notify, 80));
  }

  function ensureSoundscapeApi() {
    if (window.PionierSoundscapes) return;
    const audio = document.getElementById('soundscapeAudio');
    const fileInput = document.getElementById('soundscapeFile');
    if (!audio) return;
    let tracks = [];
    let activeIndex = -1;
    fileInput?.addEventListener('change', () => {
      const files = Array.from(fileInput.files || []).filter((f) =>
        f.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(f.name)
      );
      files.forEach((file) => {
        tracks.push({ name: file.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(file) });
      });
      if (tracks.length && activeIndex < 0) {
        activeIndex = 0;
        audio.src = tracks[0].url;
        audio.load();
        audio.play().catch(() => {});
      }
      try {
        window.dispatchEvent(new CustomEvent('pionier:soundscape', {
          detail: { trackCount: tracks.length, activeIndex, title: tracks[activeIndex]?.name || '', playing: !audio.paused, src: audio.src }
        }));
      } catch (_) {}
    });
    window.PionierSoundscapes = {
      hasTracks: () => tracks.length > 0 || !!audio.src,
      getState: () => ({
        trackCount: tracks.length || (audio.src ? 1 : 0),
        activeIndex,
        title: tracks[activeIndex]?.name || document.getElementById('soundscapeTrackTitle')?.textContent || '',
        playing: !audio.paused && !!audio.src,
        src: audio.src || ''
      }),
      play: () => audio.play().catch(() => false),
      pause: () => { audio.pause(); },
      toggle: () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); },
      next: () => {
        if (!tracks.length) return;
        activeIndex = (activeIndex + 1) % tracks.length;
        audio.src = tracks[activeIndex].url;
        audio.play().catch(() => {});
      },
      prev: () => {
        if (!tracks.length) return;
        activeIndex = (activeIndex - 1 + tracks.length) % tracks.length;
        audio.src = tracks[activeIndex].url;
        audio.play().catch(() => {});
      }
    };
  }

  function boot() {
    ensureSoundscapeApi();
    ensureSoundscapeNotify();
    wire();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0));
  else setTimeout(boot, 0);
  setTimeout(boot, 500);
  setTimeout(boot, 1500);
})();
