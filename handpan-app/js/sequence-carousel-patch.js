/**
 * Card-carousel open/close override for Pionier Sequence.
 * Runs after mountAmbientSequencer and rewires open/close + edge swipe.
 */
(function () {
  const TRANSITION_MS = 480;

  function wire(api) {
    if (!api || api.__carouselWired) return api;
    const panel = document.getElementById('pionierSequence');
    const edge = document.getElementById('pionierSequenceEdge');
    if (!panel) return api;

    let closeTimer = 0;

    function open() {
      if (panel.classList.contains('is-open')) return;
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = 0; }
      panel.classList.remove('is-settled');
      panel.hidden = false;
      if (edge) edge.hidden = true;
      document.body.classList.add('pionier-sequence-open');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          panel.classList.add('is-open');
        });
      });
    }

    function close() {
      if (!panel.classList.contains('is-open') && panel.hidden) return;
      panel.classList.remove('is-open');
      document.body.classList.remove('pionier-sequence-open');
      const finish = () => {
        if (panel.classList.contains('is-open')) return;
        panel.hidden = true;
        panel.classList.add('is-settled');
        if (edge) edge.hidden = false;
        closeTimer = 0;
      };
      const onEnd = (event) => {
        if (event.target !== panel) return;
        if (event.propertyName !== 'transform' && event.propertyName !== 'opacity') return;
        panel.removeEventListener('transitionend', onEnd);
        finish();
      };
      panel.addEventListener('transitionend', onEnd);
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = window.setTimeout(finish, TRANSITION_MS);
    }

    api.open = open;
    api.close = close;
    api.__carouselWired = true;

    // Rebind close button + edge so they use the animated path
    const closeBtn = panel.querySelector('.sequence-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => { e.stopImmediatePropagation(); close(); }, true);
    }
    if (edge) {
      edge.addEventListener('click', (e) => { e.stopImmediatePropagation(); open(); }, true);
    }

    // Edge swipe: open from right, close from left of sequencer
    let gesture = null;
    document.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const isOpen = panel.classList.contains('is-open');
      if (!isOpen && event.clientX > window.innerWidth - 28) {
        gesture = { x: event.clientX, y: event.clientY, id: event.pointerId, mode: 'open' };
      } else if (isOpen && event.clientX < 36) {
        gesture = { x: event.clientX, y: event.clientY, id: event.pointerId, mode: 'close' };
      } else {
        gesture = null;
      }
    }, true);
    document.addEventListener('pointerup', (event) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (Math.abs(dx) > 56 && Math.abs(dy) < 100) {
        if (gesture.mode === 'open' && dx < 0) open();
        else if (gesture.mode === 'close' && dx > 0) close();
      }
      gesture = null;
    }, true);
    document.addEventListener('pointercancel', () => { gesture = null; }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && panel.classList.contains('is-open')) close();
    }, true);

    return api;
  }

  function tryWire() {
    if (window.PionierSequence) {
      wire(window.PionierSequence);
      return true;
    }
    return false;
  }

  if (!tryWire()) {
    const iv = setInterval(() => {
      if (tryWire()) clearInterval(iv);
    }, 120);
    setTimeout(() => clearInterval(iv), 15000);
  }

  // Hook future mounts
  const desc = Object.getOwnPropertyDescriptor(window, 'PionierSequence');
  if (!desc || desc.configurable) {
    let current = window.PionierSequence;
    Object.defineProperty(window, 'PionierSequence', {
      configurable: true,
      enumerable: true,
      get() { return current; },
      set(v) { current = v ? wire(v) : v; }
    });
  }
})();
