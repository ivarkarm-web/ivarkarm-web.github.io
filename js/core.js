/**
 * core.js
 * Application lifecycle, device/capability detection, and performance modes.
 * Loaded first after utilities. Exposes a stable AppCore API used by engine/UI/scenes.
 */

const AppCore = (() => {
  // ----- Capability detection -----
  const caps = {
    isTouch: false,
    isMobileUA: false,
    isFinePointer: false,
    maxTouchPoints: 0,
    deviceMemory: 4,
    hardwareConcurrency: 4,
    reducedMotion: false,
    saveData: false,
    connectionType: 'unknown',
    dpr: 1,
    isLowEnd: false
  };

  function detectCapabilities() {
    caps.maxTouchPoints = (typeof navigator !== 'undefined' && navigator.maxTouchPoints) || 0;
    caps.isTouch = caps.maxTouchPoints > 0 || ('ontouchstart' in window);
    caps.isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    caps.isFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    caps.deviceMemory = (navigator.deviceMemory) || 4;
    caps.hardwareConcurrency = (navigator.hardwareConcurrency) || 4;
    caps.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    caps.saveData = !!(navigator.connection && navigator.connection.saveData);
    caps.connectionType = (navigator.connection && navigator.connection.effectiveType) || 'unknown';
    caps.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Heuristic low-end detection
    caps.isLowEnd =
      caps.deviceMemory <= 2 ||
      caps.hardwareConcurrency <= 2 ||
      caps.saveData ||
      caps.connectionType === 'slow-2g' ||
      caps.connectionType === '2g' ||
      (caps.isMobileUA && caps.deviceMemory <= 4 && caps.hardwareConcurrency <= 4);

    return caps;
  }

  // ----- Performance modes -----
  // high | balanced | low
  let mode = 'balanced';
  const modeSettings = {
    high: {
      dprCap: 2,
      vegDensityScale: 1.0,
      particleMax: 120,
      starCountScale: 1.0,
      enableAmbientParticles: true,
      enableComplexFoliage: true,
      targetFps: 60
    },
    balanced: {
      dprCap: 1.75,
      vegDensityScale: 0.75,
      particleMax: 70,
      starCountScale: 0.7,
      enableAmbientParticles: true,
      enableComplexFoliage: true,
      targetFps: 50
    },
    low: {
      dprCap: 1.25,
      vegDensityScale: 0.45,
      particleMax: 30,
      starCountScale: 0.4,
      enableAmbientParticles: false,
      enableComplexFoliage: false,
      targetFps: 30
    }
  };

  function chooseMode() {
    if (caps.reducedMotion) return 'low';
    if (caps.isLowEnd || caps.saveData) return 'low';
    if (caps.isMobileUA || caps.deviceMemory <= 4) return 'balanced';
    return 'high';
  }

  function setMode(m) {
    if (!modeSettings[m]) return;
    mode = m;
    document.documentElement.dataset.perfMode = mode;
    // Dispatch so other modules can react
    window.dispatchEvent(new CustomEvent('perfmodechange', { detail: { mode, settings: modeSettings[mode] } }));
  }

  function getMode() { return mode; }
  function getSettings() { return modeSettings[mode]; }

  // ----- Visibility / lifecycle -----
  let pageVisible = true;
  let rafPaused = false;

  function onVisibilityChange() {
    pageVisible = document.visibilityState === 'visible';
    if (!pageVisible) {
      rafPaused = true;
    } else {
      rafPaused = false;
      // Let the engine resume cleanly
      window.dispatchEvent(new CustomEvent('appresume'));
    }
  }

  function isPageVisible() { return pageVisible; }
  function isRafPaused() { return rafPaused; }

  // ----- Init -----
  function init() {
    detectCapabilities();
    setMode(chooseMode());

    document.addEventListener('visibilitychange', onVisibilityChange);

    // Listen for reduced-motion changes
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handler = () => {
        caps.reducedMotion = mq.matches;
        if (caps.reducedMotion) setMode('low');
        else setMode(chooseMode());
      };
      if (mq.addEventListener) mq.addEventListener('change', handler);
      else if (mq.addListener) mq.addListener(handler);
    }

    // Expose for debugging
    window.__AppCore = {
      caps,
      getMode,
      getSettings,
      setMode,
      isPageVisible,
      isRafPaused
    };

    return { caps, mode, settings: modeSettings[mode] };
  }

  function getVegDensityScale() {
    return modeSettings[mode].vegDensityScale;
  }
  function getParticleMax() {
    return modeSettings[mode].particleMax;
  }
  function getStarCountScale() {
    return modeSettings[mode].starCountScale;
  }
  function shouldDrawComplexFoliage() {
    return modeSettings[mode].enableComplexFoliage;
  }

  return {
    init,
    detectCapabilities,
    getCapabilities: () => caps,
    getMode,
    getSettings,
    setMode,
    isPageVisible,
    isRafPaused,
    getVegDensityScale,
    getParticleMax,
    getStarCountScale,
    shouldDrawComplexFoliage
  };
})();

// Auto-init when script loads (deferred, after utilities)
if (typeof window !== 'undefined') {
  // Delay slightly so other early scripts can register listeners if needed
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AppCore.init());
  } else {
    AppCore.init();
  }
}
