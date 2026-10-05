/**
 * booking.js
 * Sends the visitor from the road into the dedicated inquiry page.
 * The road remains the main experience; booking is a separate room.
 */
(function(){
  'use strict';
  var TARGET = './inquire.html?from=road';
  var STORAGE_KEY = 'ivar_booking_audio_state';

  function rememberAndFreezeTrack(){
    try {
      if (typeof musicPlayer === 'undefined' || !musicPlayer.audio) return;
      var audio = musicPlayer.audio;
      var wasPlaying = !audio.paused && !audio.ended;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        wasPlaying: wasPlaying,
        currentTime: Number(audio.currentTime || 0),
        src: audio.currentSrc || audio.src || ''
      }));
      if (wasPlaying) audio.pause();
    } catch (_) {}
  }

  function restoreTrack(){
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      sessionStorage.removeItem(STORAGE_KEY);
      var state = JSON.parse(raw);
      if (!state || !state.wasPlaying || typeof musicPlayer === 'undefined' || !musicPlayer.audio) return;
      var audio = musicPlayer.audio;

      if (Number.isFinite(state.currentTime) && state.currentTime >= 0) {
        try { audio.currentTime = state.currentTime; } catch (_) {}
      }

      setTimeout(function(){
        try {
          var p = audio.play();
          if (p && p.catch) p.catch(function(){});
        } catch (_) {}
      }, 140);
    } catch (_) {}
  }

  function openInquiry(e){
    if (e) { e.preventDefault(); e.stopPropagation(); }
    rememberAndFreezeTrack();
    try {
      if (typeof trackEvent === 'function') trackEvent('booking_open', { source: 'invite' });
    } catch (_) {}
    window.location.href = TARGET;
  }

  var button = document.getElementById('bookMeButton');
  if (button) {
    button.addEventListener('click', openInquiry);
    button.setAttribute('aria-haspopup', 'page');
    button.removeAttribute('aria-controls');
  }

  window.addEventListener('pageshow', restoreTrack);
})();