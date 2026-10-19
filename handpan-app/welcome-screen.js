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

  enter.addEventListener('click', () => {
    if (entered) return;
    entered = true;
    enter.disabled = true;

    let showHeadphoneHint = false;
    try {
      showHeadphoneHint = localStorage.getItem('pionier-headphones-tip-seen-v1') !== '1';
      if (showHeadphoneHint) localStorage.setItem('pionier-headphones-tip-seen-v1', '1');
    } catch (_) {
      showHeadphoneHint = true;
    }

    // Let the welcome begin fading before the tonefields start materialising.
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