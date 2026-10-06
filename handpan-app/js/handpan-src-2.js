export default `RootName() + ' · 9 notes';
    var canvasEl = document.getElementById('hpStage');
    if (canvasEl) {
      canvasEl.setAttribute('aria-label',
        'Handpan in ' + scale.label + ' rooted at ' + currentRootName() +
        ', nine notes. Press Q W E R T Y U I O, or touch the steel, to play. Several notes can sound at once.');
    }

    var label = document.getElementById('hpScaleLabel');
    if (label) {
      if (dir) label.style.setProperty('--slide-dir', dir > 0 ? '10px' : '-10px');
      label.classList.add('is-out');
      setTimeout(function () {
        label.textContent = scale.label;
        label.style.setProperty('--slide-dir', dir > 0 ? '-10px' : '10px');
        void label.offsetWidth;
        label.style.setProperty('--slide-dir', '0px');
        label.classList.remove('is-out');
      }, 160);
    }
    var dots = document.getElementById('hpScaleDots');
    if (dots) {
      var html = '';
      for (var d = 0; d < SCALES.length; d++) html += '<i' + (d === scaleIndex ? ' class="is-on"' : '') + '></i>';
      dots.innerHTML = html;
    }

    if (typeof buildFields === 'function') buildFields();
    if (typeof renderPan === 'function') renderPan();
    if (window.HandpanGame) {
      window.HandpanGame.notes = NOTES;
      window.HandpanGame.baseMidi = baseMidi;
      window.HandpanGame.octaveOffset = octaveOffset;
    }
  }

  function applyScale(idx, dir) {
    if (idx < 0) idx = SCALES.length - 1;
    if (idx >= SCALES.length) idx = 0;
    scaleIndex = idx;
    rebuildNotes(dir || 0);
  }

  /** Chromatic step of the central Ding (root). */
  function shiftRoot(delta) {
    baseMidi = Math.max(36, Math.min(72, baseMidi + delta)); // C2–C5 safety range
    rebuildNotes(0);
  }

  /** Octave shift: -1, 0, +1 */
  function shiftOctave(delta) {
    octaveOffset = Math.max(-1, Math.min(1, octaveOffset + delta));
    rebuildNotes(0);
  }

  NOTES = buildNotesFromScale(SCALES[0]);
  reindexKeys();


  var MAX_VOICES = COARSE ? 24 : 40;

  function makeImpulse(ctx, seconds, decay) {
    var rate = ctx.sampleRate;
    var len = Math.floor(rate * seconds);
    var buf = ctx.createBuffer(2, len, rate);
    var pre = Math.floor(rate * 0.018);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      var lp = 0;
      for (var i = 0; i < len; i++) {
        var t = i / len;
        var n = Math.random() * 2 - 1;
        var c = 0.06 + 0.5 * (1 - t) * (1 - t);
        lp += (n - lp) * c;
        var fadeIn = i < pre ? 0 : Math.min(1, (i - pre) / (rate * 0.008));
        d[i] = lp * Math.pow(1 - t, decay) * fadeIn * 2.2;
      }
    }
    return buf;
  }

  function HandpanEngine() {
    this.ctx = null; this.bus = null; this.master = null;
    this.analyser = null; this.analyserData = null; this.noise = null;
    this.active = new Map(); this.voices = []; this.ready = false;
  }

  HandpanEngine.prototype.ensure = function () {
    if (!this.ctx) {
      this.ctx = getAudioContext();
      if (!this.ctx) return false;
      this._build();
    }
    resumeAudio();
    return true;
  };

  HandpanEngine.prototype._build = function () {
    var ctx = this.ctx;
    this.bus = ctx.createGain(); this.bus.gain.value = 1;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 20; comp.ratio.value = 3.5;
    comp.attack.value = 0.004; comp.release.value = 0.24;
    this.master = ctx.createGain(); this.master.gain.value = 0.85;
    var convolver = ctx.createConvolver();
    c`;
