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
      window.PionierCore?.ensureAudio?.();
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('pionier:user-enter'));
    } catch (_) {}
  }

  /** Reveal tonefields + force a surface layout/draw after the welcome gate. */
  function revealInstrument() {
    window.PionierWelcomeState.hideTonefields = false;
    try { window.dispatchEvent(new CustomEvent('pionier:welcome-closed')); } catch (_) {}
    const paint = () => {
      try { window.PionierCore?.resize?.(); } catch (_) {}
      try { window.PionierCore?.draw?.(); } catch (_) {}
      try { if (typeof window.__pionierCenterPan === 'function') window.__pionierCenterPan(); } catch (_) {}
    };
    // Paint immediately and again after layout settles (dock measure / CSS transitions).
    paint();
    requestAnimationFrame(() => {
      paint();
      requestAnimationFrame(paint);
    });
    setTimeout(paint, 120);
    setTimeout(paint, 400);
    setTimeout(paint, 900);
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
    root.classList.remove('pionier-welcome-active');
    revealInstrument();

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
