/* First-run welcome reveal. The welcome appears each visit; the audio tip appears only once. */
(() => {
  const root = document.documentElement;
  const welcome = document.getElementById('pionierWelcome');
  const enter = document.getElementById('enterPionier');
  const hint = document.getElementById('headphonesHint');
  if (!welcome || !enter) return;

  root.classList.add('pionier-welcome-active');
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
      // Storage may be unavailable in private or restricted browser contexts.
      showHeadphoneHint = true;
    }

    welcome.classList.add('is-leaving');
    root.classList.remove('pionier-welcome-active');

    window.setTimeout(() => {
      welcome.hidden = true;
      if (showHeadphoneHint && hint) {
        hint.classList.add('is-visible');
        window.setTimeout(() => hint.classList.remove('is-visible'), 4300);
      }
    }, 820);
  });
})();