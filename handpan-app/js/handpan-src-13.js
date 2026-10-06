export default ` document.body.classList.add('hp-leaving');
    var cameFromRoad = false;
    try {
      cameFromRoad = !!document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1;
    } catch (err) { cameFromRoad = false; }
    setTimeout(function () {
      if (cameFromRoad) history.back();
      else location.href = './index.html';
    }, REDUCED ? 30 : 380);
    setTimeout(function () { if (document.visibilityState === 'visible') location.href = './index.html'; }, 1800);
  }
  document.getElementById('hpBack').addEventListener('click', goBack);

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      leaving = false;
      document.body.classList.remove('hp-leaving');
      releaseEverything();
    }
  });
  window.addEventListener('pagehide', function (e) {
    releaseEverything();
    if (!e.persisted) engine.shutdown();
    else if (engine.ctx && engine.ctx.state === 'running') { suspendAudio(); }
  });

  function boot() {
    resize();
    requestAnimationFrame(function (t) { last = t; requestAnimationFrame(frame); });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { document.body.classList.remove('hp-entering'); });
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { queueResize(); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.HandpanGame = {
    notes: NOTES,
    scales: SCALES,
    scaleIndex: function () { return scaleIndex; },
    setScale: applyScale,
    baseMidi: baseMidi,
    octaveOffset: octaveOffset,
    shiftRoot: shiftRoot,
    shiftOctave: shiftOctave,
    currentRootName: currentRootName,
    engine: engine,
    instruments: EXPERIMENTS,
    setInstrument: function(i){ return engine.setInstrument(i); },
    instrumentIndex: function(){ return instrumentIndex; },
    strike: strikeNote,
    release: releaseNote,
    fields: function () { return fields; },
    keyMap: function () { return KEY_TO_IDX; },
    setGuideTargets: function (indices) {
      var map = {};
      (indices || []).forEach(function (idx) { map[idx] = true; });
      fields.forEach(function (f) { f.guideTarget = map[f.i] ? 1 : 0; });
    },
    clearGuideTargets: function () {
      fields.forEach(function (f) { f.guideTarget = 0; });
    }
  };
})();
`;
