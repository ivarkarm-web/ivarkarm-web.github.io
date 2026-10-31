/**
 * Pionier Sequence — card carousel, BPM knob, playhead polish.
 */
(function () {
  const TRANSITION_MS = 420;

  function paintKnob(canvas, t) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width || 96;
    const h = canvas.height || 96;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.38;
    const start = Math.PI * 0.75;
    const span = Math.PI * 1.5;
    const tt = Math.max(0, Math.min(1, t));
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = Math.max(3, w * 0.06);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(120, 130, 118, 0.35)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + span);
    ctx.stroke();
    ctx.strokeStyle = '#e1cc8b';
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + span * tt);
    ctx.stroke();
    const a = start + span * tt;
    ctx.fillStyle = '#f0d99a';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.max(3, w * 0.05), 0, Math.PI * 2);
    ctx.fill();
  }

  function wireBpmKnob(panel, api) {
    if (!panel || panel.classList.contains('has-bpm-knob')) return;
    const engine = api && api.engine;
    if (!engine || typeof engine.setBpm !== 'function') return;

    const knobsRow = panel.querySelector('.sequence-knobs-row');
    const topbarMain = panel.querySelector('.sequence-topbar-main');
    const host = knobsRow || topbarMain;
    if (!host) return;

    const wrap = document.createElement('div');
    wrap.className = 'sequence-knob';
    wrap.dataset.knob = 'bpm';
    wrap.innerHTML =
      '<span class="sequence-knob-label">BPM</span>' +
      '<div class="sequence-knob-dial" tabindex="0" role="slider" aria-label="Tempo" aria-valuemin="40" aria-valuemax="140">' +
      '<canvas width="96" height="96"></canvas></div>' +
      '<span class="sequence-knob-value" data-value="bpm-knob">72</span>';

    if (knobsRow) {
      host.insertBefore(wrap, host.firstChild);
    } else {
      const slot = document.createElement('div');
      slot.className = 'sequence-bpm-knob-slot';
      slot.appendChild(wrap);
      host.appendChild(slot);
    }

    panel.classList.add('has-bpm-knob');

    const dial = wrap.querySelector('.sequence-knob-dial');
    const canvas = wrap.querySelector('canvas');
    const out = wrap.querySelector('[data-value="bpm-knob"]');
    const rangeMin = 40;
    const rangeMax = 140;
    let value = 72;
    try {
      const snap = engine.snapshot && engine.snapshot();
      if (snap && snap.freeBpm) value = Math.round(snap.freeBpm);
    } catch (_) {}

    const render = () => {
      const t = (value - rangeMin) / (rangeMax - rangeMin);
      paintKnob(canvas, t);
      if (out) out.textContent = String(value);
      dial.setAttribute('aria-valuenow', String(value));
      panel.querySelectorAll('[data-value="bpm"]').forEach((el) => {
        el.textContent = String(value);
      });
      panel.querySelectorAll('[data-control="bpm"]').forEach((el) => {
        el.value = String(value);
      });
    };

    const apply = (v) => {
      value = Math.max(rangeMin, Math.min(rangeMax, Math.round(v)));
      try {
        engine.setBpm(value);
        window.PionierClock && window.PionierClock.setBpm && window.PionierClock.setBpm(value);
        engine.save && engine.save();
      } catch (_) {}
      render();
    };

    let drag = false;
    let startY = 0;
    let startVal = 0;
    dial.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      drag = true;
      startY = e.clientY;
      startVal = value;
      dial.setPointerCapture && dial.setPointerCapture(e.pointerId);
    });
    dial.addEventListener('pointermove', (e) => {
      if (!drag) return;
      apply(startVal + (startY - e.clientY) / 1.15);
    });
    const stop = () => { drag = false; };
    dial.addEventListener('pointerup', stop);
    dial.addEventListener('pointercancel', stop);
    dial.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        apply(value + 1);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        apply(value - 1);
      }
    });

    render();
  }

  function wirePlayheadBeats(panel, api) {
    if (!panel || panel.__playheadBeats) return;
    panel.__playheadBeats = true;
    const engine = api && api.engine;
    if (!engine || typeof engine.setStepCallback !== 'function') return;

    const updateBeats = (step) => {
      const nums = panel.querySelectorAll('.sequence-beat-numbers span');
      nums.forEach((el, i) => {
        el.classList.toggle('is-playhead', i === step);
      });
      panel.querySelectorAll('.sequence-step.is-current').forEach((btn) => {
        btn.style.animation = 'none';
        void btn.offsetWidth;
        btn.style.animation = '';
      });
    };

    try {
      engine.setStepCallback((step, snap) => {
        updateBeats(typeof step === 'number' ? step : (snap && snap.stepIndex) || -1);
      });
    } catch (_) {}

    const rows = panel.querySelector('.sequence-rows');
    if (rows && typeof MutationObserver !== 'undefined') {
      const mo = new MutationObserver(() => {
        const current = panel.querySelector('.sequence-step.is-current');
        if (!current) return;
        const cells = current.parentElement && current.parentElement.children;
        if (!cells) return;
        const idx = Array.prototype.indexOf.call(cells, current);
        if (idx >= 0) updateBeats(idx);
      });
      mo.observe(rows, { attributes: true, subtree: true, attributeFilter: ['class'] });
    }
  }

  function wireCarousel(api) {
    if (!api || api.__carouselWired) return api;
    const panel = document.getElementById('pionierSequence');
    const edge = document.getElementById('pionierSequenceEdge');
    if (!panel) return api;

    let closeTimer = 0;
    let closeGeneration = 0;

    function open() {
      if (panel.classList.contains('is-open') && !panel.classList.contains('is-closing')) return;
      // A transitionend may have completed a close while its fallback timer is
      // still queued. Invalidate that close before making the panel visible.
      closeGeneration += 1;
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = 0;
      }
      panel.classList.remove('is-settled', 'is-closing');
      panel.hidden = false;
      if (edge) edge.hidden = true;
      document.body.classList.add('pionier-sequence-open');
      panel.classList.remove('is-open');
      void panel.offsetWidth;
      panel.classList.add('is-open');
    }

    function close() {
      if (panel.classList.contains('is-closing')) return;
      if (!panel.classList.contains('is-open') && panel.hidden) return;
      const generation = ++closeGeneration;
      panel.classList.remove('is-open');
      panel.classList.add('is-closing');
      document.body.classList.remove('pionier-sequence-open');
      const finish = () => {
        if (generation !== closeGeneration || !panel.classList.contains('is-closing')) return;
        if (closeTimer) {
          clearTimeout(closeTimer);
          closeTimer = 0;
        }
        panel.classList.remove('is-closing');
        panel.classList.add('is-settled');
        panel.hidden = true;
        if (edge) edge.hidden = false;
      };
      const onEnd = (event) => {
        if (event.target !== panel) return;
        panel.removeEventListener('animationend', onEnd);
        panel.removeEventListener('transitionend', onEnd);
        finish();
      };
      panel.addEventListener('animationend', onEnd);
      panel.addEventListener('transitionend', onEnd);
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = window.setTimeout(finish, TRANSITION_MS);
    }

    api.open = open;
    api.close = close;
    api.__carouselWired = true;

    const interceptOpen = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      open();
    };
    const interceptClose = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    };
    if (edge) edge.addEventListener('click', interceptOpen, true);
    const closeBtn = panel.querySelector('.sequence-close');
    if (closeBtn) closeBtn.addEventListener('click', interceptClose, true);

    let gesture = null;
    document.addEventListener(
      'pointerdown',
      (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        const isOpen = panel.classList.contains('is-open') && !panel.classList.contains('is-closing');
        if (!isOpen && event.clientX > window.innerWidth - 36) {
          gesture = { x: event.clientX, y: event.clientY, id: event.pointerId, mode: 'open' };
        } else if (isOpen && event.clientX < 48) {
          gesture = { x: event.clientX, y: event.clientY, id: event.pointerId, mode: 'close' };
        } else {
          gesture = null;
        }
      },
      true
    );
    document.addEventListener(
      'pointerup',
      (event) => {
        if (!gesture || gesture.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (Math.abs(dx) > 48 && Math.abs(dy) < 110) {
          if (gesture.mode === 'open' && dx < 0) open();
          else if (gesture.mode === 'close' && dx > 0) close();
        }
        gesture = null;
      },
      true
    );
    document.addEventListener('pointercancel', () => {
      gesture = null;
    }, true);

    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape' && panel.classList.contains('is-open')) {
          event.stopImmediatePropagation();
          close();
        }
      },
      true
    );

    wireBpmKnob(panel, api);
    wirePlayheadBeats(panel, api);

    return api;
  }

  function tryWire() {
    if (window.PionierSequence) {
      wireCarousel(window.PionierSequence);
      return true;
    }
    return false;
  }

  if (!tryWire()) {
    const iv = setInterval(() => {
      if (tryWire()) clearInterval(iv);
    }, 80);
    setTimeout(() => clearInterval(iv), 20000);
  }

  try {
    let current = window.PionierSequence;
    Object.defineProperty(window, 'PionierSequence', {
      configurable: true,
      enumerable: true,
      get() {
        return current;
      },
      set(v) {
        current = v ? wireCarousel(v) : v;
      },
    });
  } catch (_) {}

  if (typeof MutationObserver !== 'undefined') {
    const mo = new MutationObserver(() => {
      if (window.PionierSequence) wireCarousel(window.PionierSequence);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
