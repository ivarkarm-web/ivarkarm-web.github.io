/* Editorial welcome, staged tonefield reveal, and one-time headphone note. */
(() => {
  const root = document.documentElement;
  const welcome = document.getElementById('pionierWelcome');
  const enter = document.getElementById('enterPionier');
  const hint = document.getElementById('headphonesHint');
  if (!welcome || !enter) return;

  root.classList.add('pionier-welcome-active');
  window.PionierWelcomeState = window.PionierWelcomeState || { hideTonefields: true };
  window.PionierWelcomeState.hideTonefields = true;
  let entered = false;

  function unlockAudio() {
    try {
      const HA = window.HandpanAudio;
      const ctx = HA?.getAudioContext?.() || null;
      if (ctx) {
        if (ctx.state !== 'running') {
          try {
            const buf = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            src.start(0);
          } catch (_) {}
        }
        HA.resumeAudio?.();
      }
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('pionier:user-enter'));
    } catch (_) {}
  }

  enter.addEventListener('pointerdown', unlockAudio, { passive: true });
  enter.addEventListener('click', () => {
    if (entered) return;
    entered = true;
    enter.disabled = true;
    unlockAudio();

    let showHeadphoneHint = false;
    try {
      showHeadphoneHint = localStorage.getItem('pionier-headphones-tip-seen-v1') !== '1';
      if (showHeadphoneHint) localStorage.setItem('pionier-headphones-tip-seen-v1', '1');
    } catch (_) {
      showHeadphoneHint = true;
    }

    try { if (window.__pionierArrangeLayout) window.__pionierArrangeLayout(); } catch (_) {}
    root.classList.add('pionier-entering');
    welcome.classList.add('is-leaving');
    window.PionierWelcomeState.hideTonefields = false;
    root.classList.remove('pionier-welcome-active');

    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.remove('pionier-entering');
    }));

    window.setTimeout(() => {
      welcome.hidden = true;
      if (showHeadphoneHint && hint) {
        hint.classList.add('is-visible');
        window.setTimeout(() => hint.classList.remove('is-visible'), 4700);
      }
    }, 1080);
  });
})();
