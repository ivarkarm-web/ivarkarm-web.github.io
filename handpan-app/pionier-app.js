/**
 * pionier-app.js — thin boot orchestrator for the Pionier handpan app.
 * Loads core modules, mounts scale selector, wires randomize (scale/instrument only).
 */
(async function () {
  const BASE = new URL('.', import.meta.url);
  const degraded = [];

  function setBootStatus(state, detail, isWarn) {
    try {
      const el = document.getElementById('bootStatus');
      if (el) {
        el.dataset.state = state || '';
        if (detail) el.textContent = detail;
        el.classList.toggle('is-warn', !!isWarn);
      }
      document.documentElement.dataset.boot = state || '';
    } catch (_) {}
  }

  function unlockAudioFromGesture() {
    try { window.PionierCore?.ensureAudio?.(); } catch (_) {}
  }

  async function loadArps() {
    try {
      await import(new URL('./js/instruments/arp-family.js', BASE).href);
    } catch (e) {
      console.warn('[boot] arps', e);
      degraded.push('arpeggiators');
    }
  }

  function scheduleDeferredFeatures() {
    // Reserved for lazy feature mounts; keep empty for stability.
  }

  async function boot() {
    setBootStatus('loading', 'Starting…');

    // Core is expected to self-init via its own module load from index.html.
    // Ensure it is present before wiring UI that depends on it.
    let tries = 0;
    while (!window.PionierCore && tries < 40) {
      await new Promise((r) => setTimeout(r, 50));
      tries++;
    }
    if (!window.PionierCore) {
      setBootStatus('error', 'Core failed to load', true);
      return false;
    }

    try {
      const { mountScaleSelector } = await import(new URL('./js/scale-selector.js', BASE).href);
      mountScaleSelector({
        getScales: () => window.HANDPAN_SCALES || [],
        getIndex: () => window.PionierCore?.handpan?.scaleIndex ?? 0,
        setIndex: (i) => {
          try {
            window.PionierCore?.setScaleIndex?.(i);
            window.PionierCore?.draw?.();
          } catch (_) {}
        },
      });
    } catch (err) {
      console.warn('[scale-selector] mount failed', err);
      degraded.push('scale-selector');
    }

    document.getElementById('randomizeSetup')?.addEventListener('click', async () => {
      const dice = document.getElementById('randomizeSetup');
      if (dice?.dataset.rolling === '1') return;
      if (dice) { dice.dataset.rolling = '1'; dice.classList.add('is-rolling'); }
      try {
        unlockAudioFromGesture();
        await loadArps().catch(() => {});
        const { InstrumentRegistry } = await import(new URL('./js/instrument.js', BASE).href);
        const instruments = InstrumentRegistry.list().filter((item) => item?.id);
        const scales = window.HANDPAN_SCALES || [];
        const currentId = window.PionierCore?.activeInstrument?.()?.id;
        const choices = instruments.filter((item) => item.id !== currentId);
        const instrument = (choices.length ? choices : instruments)[Math.floor(Math.random() * Math.max(1, (choices.length || instruments.length)))];
        if (instrument?.id) await window.PionierCore?.setInstrument?.(instrument.id);
        const handpan = window.PionierCore?.handpan;
        if (handpan && scales.length > 1) {
          const next = Math.floor(Math.random() * scales.length);
          handpan.setScaleIndex(next);
          window.PionierCore?.refreshPitch?.();
          window.PionierCore?.draw?.();
          const label = document.getElementById('scaleLabel');
          const scale = scales[next];
          if (label && scale) label.textContent = (scale.short || scale.label || 'Scale') + ' ▾';
        }
        // Phase 1: note count is scale-driven only — do not randomize pad count.
      } catch (err) { console.warn('[randomize] setup selection failed', err); }
      finally {
        if (dice) { delete dice.dataset.rolling; dice.classList.remove('is-rolling'); }
      }
    });

    scheduleDeferredFeatures();

    if (degraded.length) {
      const labels = degraded.map(name => ({ soundscapes: 'Soundscapes', 'note-plus': 'note controls', looper: 'Loop Studio', 'scale-selector': 'scale selector', arpeggiators: 'arpeggiators' }[name] || name));
      setBootStatus('degraded', 'Some features unavailable: ' + labels.join(', '), true);
    } else {
      setBootStatus('ready');
    }
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { boot().catch(console.error); });
  } else {
    boot().catch(console.error);
  }
})();
