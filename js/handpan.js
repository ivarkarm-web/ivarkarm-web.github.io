/**
 * handpan.js — hidden Handpan instrument (Ivar Karm – Resonance)
 *
 * Standalone page script (handpan.html). Does not touch the main site's
 * scripts or audio: this page owns its own AudioContext.
 *
 *  1. Scale + geometry   9 × 13-note scales, two-ring zig-zag layout
 *  2. HandpanEngine      polyphonic Web Audio synth
 *  3. Atmosphere         ambient particles, ripples, sparks
 *  4. Instrument view    pre-rendered steel body + live glow
 *  5. Input              keyboard + multi-touch
 *  6. Scale switcher     arrows + swipe + keyboard
 */
(function () {
  'use strict';

  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var COARSE = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  var NOTE_OFFSET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteToMidi(name) {
    var m = String(name).trim().match(/^([A-G])([#b♯♭]?)(\d+)$/i);
    if (!m) return 60;
    var base = NOTE_OFFSET[m[1].toUpperCase()];
    var acc = m[2];
    if (acc === '#' || acc === '♯') base += 1;
    else if (acc === 'b' || acc === '♭') base -= 1;
    return (parseInt(m[3], 10) + 1) * 12 + base;
  }

  function prettyNote(name) {
    return String(name).replace(/#/g, '♯').replace(/b/g, '♭');
  }

  var KEYS = [
    { key: 'q', code: 'KeyQ' },
    { key: 'w', code: 'KeyW' },
    { key: 'e', code: 'KeyE' },
    { key: 'r', code: 'KeyR' },
    { key: 't', code: 'KeyT' },
    { key: 'y', code: 'KeyY' },
    { key: 'u', code: 'KeyU' },
    { key: 'i', code: 'KeyI' },
    { key: 'o', code: 'KeyO' },
    { key: 'p', code: 'KeyP' },
    { key: 'a', code: 'KeyA' },
    { key: 's', code: 'KeyS' },
    { key: 'd', code: 'KeyD' }
  ];

  // Maker-style zig-zag with roomy spacing:
  // Inner 8 (larger fields) at 45° — ascending L/R from bottom → top
  // Outer 4 (high notes) in upper gaps — same ascending direction (B4→C5→D5→E5)
  var INNER_ANGLES = [180, 225, 135, 270, 90, 315, 45, 0];
  var OUTER_ANGLES = [67.5, 292.5, 22.5, 337.5];

  var SHAPE = {
    ding: { dist: 0,    rx: 0.175, ry: 0.175 },
    ring: { dist: 0.52, rx: 0.155, ry: 0.125 },
    rim:  { dist: 0.82, rx: 0.095, ry: 0.115 }
  };

  var SCALES = [
    { id: 'd-kurd', label: 'D Kurd', ding: 'D3', tones: ['A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'] },
    { id: 'fs-romanian-hijaz', label: 'F♯ Romanian Hijaz', ding: 'F#3', tones: ['B3', 'C#4', 'D4', 'F4', 'F#4', 'G#4', 'A4', 'B4', 'C#5', 'D5', 'F5', 'F#5'] },
    { id: 'b-minor-ext', label: 'B Minor Extended', ding: 'B2', tones: ['D3', 'E3', 'F#3', 'G3', 'A3', 'B3', 'C#4', 'D4', 'E4', 'F#4', 'G4', 'A4'] },
    { id: 'c-aegean-ext', label: 'C Aegean Extended', ding: 'C3', tones: ['E3', 'F#3', 'G3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C5'] },
    { id: 'd-amara-ext', label: 'D Amara Extended', ding: 'D3', tones: ['A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5', 'D5', 'E5', 'F5', 'G5'] },
    { id: 'cs-annaziska-ext', label: 'C♯ Annaziska Extended', ding: 'C#3', tones: ['G#3', 'A3', 'B3', 'C#4', 'D#4', 'E4', 'F#4', 'G#4', 'A4', 'B4', 'C#5', 'D#5'] },
    { id: 'd-pygmy-ext', label: 'D Pygmy Extended', ding: 'D3', tones: ['G3', 'A3', 'Bb3', 'D4', 'F4', 'G4', 'A4', 'Bb4', 'C5', 'D5', 'E5', 'F5'] },
    { id: 'c-sabye-ext', label: 'C Sabye Extended', ding: 'C3', tones: ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'] },
    { id: 'e-integral-ext', label: 'E Integral Extended', ding: 'E3', tones: ['B3', 'C4', 'D4', 'E4', 'F#4', 'G4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'] }
  ];

  var scaleIndex = 0;
  var NOTES = [];
  var KEY_TO_IDX = {};
  var CODE_TO_IDX = {};

  function buildNotesFromScale(scale) {
    var list = [];
    list.push({
      key: KEYS[0].key, code: KEYS[0].code,
      name: prettyNote(scale.ding), midi: noteToMidi(scale.ding),
      kind: 'ding', a: 0
    });
    for (var i = 0; i < 12; i++) {
      var isRim = i >= 8;
      var angle = isRim ? OUTER_ANGLES[i - 8] : INNER_ANGLES[i];
      list.push({
        key: KEYS[i + 1].key, code: KEYS[i + 1].code,
        name: prettyNote(scale.tones[i]), midi: noteToMidi(scale.tones[i]),
        kind: isRim ? 'rim' : 'ring', a: angle
      });
    }
    list.forEach(function (n) {
      n.freq = mtof(n.midi);
      n.pan = n.kind === 'ding' ? 0 : Math.max(-0.6, Math.min(0.6, Math.sin(n.a * Math.PI / 180) * 0.55));
    });
    return list;
  }

  function reindexKeys() {
    KEY_TO_IDX = {}; CODE_TO_IDX = {};
    NOTES.forEach(function (n, i) {
      KEY_TO_IDX[n.key] = i; CODE_TO_IDX[n.code] = i;
    });
  }

  function applyScale(idx, dir) {
    if (idx < 0) idx = SCALES.length - 1;
    if (idx >= SCALES.length) idx = 0;
    scaleIndex = idx;
    var scale = SCALES[scaleIndex];
    NOTES = buildNotesFromScale(scale);
    reindexKeys();

    var sub = document.getElementById('hpSub');
    if (sub) sub.textContent = scale.label + ' · 13 notes';
    var canvasEl = document.getElementById('hpStage');
    if (canvasEl) {
      canvasEl.setAttribute('aria-label',
        'Handpan in ' + scale.label + ', thirteen notes. Press Q W E R T Y U I O P A S D, or touch the steel, to play. Several notes can sound at once.');
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
    if (window.HandpanGame) window.HandpanGame.notes = NOTES;
  }

  NOTES = buildNotesFromScale(SCALES[0]);
  reindexKeys();

  var MAX_VOICES = 40;

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
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
      try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { this.ctx = new AC(); }
      this._build();
    }
    if (this.ctx.state === 'suspended') {
      var p = this.ctx.resume();
      if (p && p.catch) p.catch(function () {});
    }
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
    convolver.buffer = makeImpulse(ctx, 2.8, 3.2);
    var send = ctx.createGain(); send.gain.value = 0.34;
    var wet = ctx.createGain(); wet.gain.value = 0.9;
    this.bus.connect(comp); comp.connect(this.master); comp.connect(send);
    send.connect(convolver); convolver.connect(wet); wet.connect(this.master);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256; this.analyser.smoothingTimeConstant = 0.82;
    this.analyserData = new Uint8Array(this.analyser.fftSize);
    this.master.connect(this.analyser); this.master.connect(ctx.destination);
    var nlen = Math.floor(ctx.sampleRate * 0.12);
    this.noise = ctx.createBuffer(1, nlen, ctx.sampleRate);
    var nd = this.noise.getChannelData(0);
    for (var i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
    this.ready = true;
  };

  HandpanEngine.prototype.level = function () {
    if (!this.ready || this.ctx.state !== 'running') return 0;
    this.analyser.getByteTimeDomainData(this.analyserData);
    var sum = 0;
    for (var i = 0; i < this.analyserData.length; i++) {
      var v = (this.analyserData[i] - 128) / 128; sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.analyserData.length) * 3.2);
  };

  HandpanEngine.prototype._release = function (voice, t, tc) {
    if (voice.released) return;
    voice.released = true;
    try { voice.out.gain.cancelScheduledValues(t); voice.out.gain.setTargetAtTime(0, t, tc); } catch (e) {}
    var stopAt = t + tc * 8 + 0.02;
    voice.oscs.forEach(function (o) { try { o.stop(stopAt); } catch (e) {} });
  };

  HandpanEngine.prototype._detach = function (voice) {
    var i = this.voices.indexOf(voice);
    if (i >= 0) this.voices.splice(i, 1);
    if (this.active.get(voice.idx) === voice) this.active.delete(voice.idx);
  };

  HandpanEngine.prototype._cleanup = function (voice) {
    this._detach(voice);
    try { voice.out.disconnect(); } catch (e) {}
    if (voice.pan) { try { voice.pan.disconnect(); } catch (e) {} }
  };

  HandpanEngine.prototype.strike = function (idx, vel) {
    if (!this.ensure() || !this.ready) return null;
    var ctx = this.ctx;
    var note = NOTES[idx];
    var f = note.freq;
    var t = ctx.currentTime + 0.003;
    vel = Math.max(0.2, Math.min(1, vel || 0.8));
    var prev = this.active.get(idx);
    if (prev) this._release(prev, t, 0.03);
    while (this.voices.length >= MAX_VOICES) {
      var oldest = this.voices[0];
      this._release(oldest, t, 0.02);
      this._detach(oldest);
    }
    var out = ctx.createGain(); out.gain.value = 1;
    var panNode = null;
    if (ctx.createStereoPanner) {
      panNode = ctx.createStereoPanner();
      panNode.pan.value = note.pan;
      out.connect(panNode); panNode.connect(this.bus);
    } else { out.connect(this.bus); }
    var T0 = Math.max(1.8, 6.2 - 1.1 * Math.log(f / 164.81) / Math.LN2);
    var base = 0.2 + 0.14 * vel;
    var oscs = [];
    var partials = [
      { r: 1.0, g: 0.5, dec: T0, det: 0.0009 },
      { r: 1.0, g: 0.5, dec: T0 * 0.98, det: -0.0009 },
      { r: 2.0, g: 0.34, dec: T0 * 0.62, det: 0.0004 },
      { r: 2.997, g: 0.16, dec: T0 * 0.36, det: 0 },
      { r: 4.02, g: 0.045, dec: T0 * 0.2, det: 0 }
    ];
    for (var i = 0; i < partials.length; i++) {
      var p = partials[i];
      var osc = ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.value = f * p.r * (1 + p.det);
      var g = ctx.createGain();
      var peak = base * p.g * (i >= 2 ? (0.75 + 0.25 * vel) : 1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.0035);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.dec);
      osc.connect(g); g.connect(out);
      osc.start(t); osc.stop(t + p.dec + 0.1);
      oscs.push(osc);
    }
    var src = ctx.createBufferSource(); src.buffer = this.noise;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = Math.min(f * 3.6, 6200); bp.Q.value = 1.1;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(0.2 * vel, t + 0.0015);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(bp); bp.connect(ng); ng.connect(out);
    src.start(t); src.stop(t + 0.07);
    var voice = { idx: idx, out: out, pan: panNode, oscs: oscs, released: false, born: ctx.currentTime, ringUntil: ctx.currentTime + Math.min(T0, 3.2) };
    var self = this;
    oscs[0].onended = function () { self._cleanup(voice); };
    this.voices.push(voice);
    this.active.set(idx, voice);
    return voice;
  };

  HandpanEngine.prototype.shutdown = function () {
    if (!this.ctx) return;
    try { this.ctx.close(); } catch (e) {}
  };

  var engine = new HandpanEngine();

  var canvas = document.getElementById('hpStage');
  var ctx2 = canvas.getContext('2d');
  var headEl = document.getElementById('hpHead');
  var footEl = document.getElementById('hpFoot');
  var chordEl = document.getElementById('hpChord');

  var W = 0, H = 0, DPR = 1;
  var layout = { cx: 0, cy: 0, S: 0, R: 0 };
  var fields = [];
  var panCache = null;
  var introT = 0;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function easeOutExpo(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }

  function makeSprite(r, g, b) {
    var s = document.createElement('canvas');
    s.width = s.height = 64;
    var c = s.getContext('2d');
    var grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
    grad.addColorStop(0.18, 'rgba(' + r + ',' + g + ',' + b + ',0.55)');
    grad.addColorStop(0.5, 'rgba(' + r + ',' + g + ',' + b + ',0.14)');
    grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    c.fillStyle = grad; c.fillRect(0, 0, 64, 64);
    return s;
  }
  var SPRITE_GOLD = makeSprite(235, 200, 100);
  var SPRITE_COOL = makeSprite(205, 215, 235);

  var particles = [];
  var ripples = [];
  var sparks = [];
  var MAX_RIPPLES = 28;
  var MAX_SPARKS = 420;

  function particleTarget() {
    var n = Math.round((W * H) / 9500);
    if (W < 700) n = Math.round(n * 0.7);
    if (REDUCED) n = Math.round(n * 0.5);
    return clamp(n, 60, 190);
  }

  function spawnParticle(anywhere) {
    var z = 0.3 + Math.random() * 0.7;
    return {
      x: Math.random() * W, y: anywhere ? Math.random() * H : H + 12 + Math.random() * 30,
      vx: 0, vy: 0, z: z,
      r: (0.7 + Math.random() * 1.9) * (0.55 + z * 0.7),
      gold: Math.random() < 0.62, ph: Math.random() * Math.PI * 2,
      tw: 0.6 + Math.random() * 1.6, glow: 0
    };
  }

  function syncParticleCount() {
    var target = particleTarget();
    while (particles.length < target) particles.push(spawnParticle(true));
    if (particles.length > target) particles.length = target;
  }

  function addRipple(x, y, strength) {
    if (ripples.length >= MAX_RIPPLES) ripples.shift();
    ripples.push({ x: x, y: y, r: 6, speed: 430 + 160 * strength, strength: strength, life: 1 });
  }

  function addBurst(x, y, strength, gold) {
    var n = REDUCED ? 6 : Math.round(12 + 14 * strength);
    for (var i = 0; i < n; i++) {
      if (sparks.length >= MAX_SPARKS) sparks.shift();
      var a = Math.random() * Math.PI * 2;
      var sp = 55 + Math.random() * (150 + 120 * strength);
      sparks.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 18,
        life: 1, decay: 0.55 + Math.random() * 0.7,
        size: 5 + Math.random() * 11, gold: gold || Math.random() < 0.7
      });
    }
  }

  function updateAtmosphere(dt, time) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var driftX = Math.sin(time * 0.17 + p.ph + p.y * 0.0035) * 9 * p.z;
      var driftY = -(5 + 13 * p.z) + Math.cos(time * 0.13 + p.ph) * 3;
      var k = Math.min(1, dt * 0.9);
      p.vx += (driftX - p.vx) * k; p.vy += (driftY - p.vy) * k;
      for (var j = 0; j < ripples.length; j++) {
        var rp = ripples[j];
        var dx = p.x - rp.x, dy = p.y - rp.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        var band = Math.abs(d - rp.r);
        if (band < 52) {
          var f = 1 - band / 52; f = f * f * rp.strength * rp.life;
          var a = 980 * f * p.z * dt;
          p.vx += (dx / d) * a; p.vy += (dy / d) * a;
          if (f > p.glow) p.glow = f;
        }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.glow *= Math.pow(0.05, dt);
      if (p.y < -16 || p.x < -24 || p.x > W + 24 || p.y > H + 60) {
        particles[i] = spawnParticle(false);
        if (p.y < -16) particles[i].y = H + 12 + Math.random() * 30;
      }
    }
    for (var r = ripples.length - 1; r >= 0; r--) {
      var rp2 = ripples[r];
      rp2.r += rp2.speed * dt; rp2.speed *= Math.pow(0.55, dt);
      rp2.life -= dt * 0.55;
      if (rp2.life <= 0) ripples.splice(r, 1);
    }
    for (var s = sparks.length - 1; s >= 0; s--) {
      var sp = sparks[s];
      sp.x += sp.vx * dt; sp.y += sp.vy * dt;
      var drag = Math.pow(0.12, dt);
      sp.vx *= drag; sp.vy = sp.vy * drag - 6 * dt;
      sp.life -= sp.decay * dt;
      if (sp.life <= 0) sparks.splice(s, 1);
    }
  }

  function drawAtmosphere(time, level, intro) {
    var c = ctx2;
    var glowA = (0.05 + level * 0.2) * intro;
    var g = c.createRadialGradient(layout.cx, layout.cy, layout.R * 0.1, layout.cx, layout.cy, layout.R * 1.9);
    g.addColorStop(0, 'rgba(212,175,55,' + glowA + ')');
    g.addColorStop(0.5, 'rgba(212,175,55,' + (glowA * 0.28) + ')');
    g.addColorStop(1, 'rgba(212,175,55,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var tw = 0.65 + 0.35 * Math.sin(time * p.tw + p.ph);
      var a = ((p.gold ? 0.5 : 0.3) * tw * (0.55 + p.z * 0.45) + p.glow * 0.75 + level * 0.12) * intro;
      if (a < 0.01) continue;
      var size = (p.r * 5.2 + p.glow * 16) * (0.9 + level * 0.2);
      c.globalAlpha = Math.min(1, a);
      c.drawImage(p.gold ? SPRITE_GOLD : SPRITE_COOL, p.x - size / 2, p.y - size / 2, size, size);
    }
    for (var s = 0; s < sparks.length; s++) {
      var sp = sparks[s];
      var sa = sp.life * sp.life;
      var ss = sp.size * (0.5 + sp.life * 0.7);
      c.globalAlpha = Math.min(1, sa * 0.95);
      c.drawImage(sp.gold ? SPRITE_GOLD : SPRITE_COOL, sp.x - ss / 2, sp.y - ss / 2, ss, ss);
    }
    c.globalAlpha = 1; c.lineWidth = 1.2;
    for (var r = 0; r < ripples.length; r++) {
      var rp = ripples[r];
      var ra = Math.max(0, rp.life) * 0.34 * rp.strength;
      if (ra < 0.01) continue;
      c.strokeStyle = 'rgba(228,195,90,' + ra + ')';
      c.beginPath(); c.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = 'rgba(228,195,90,' + (ra * 0.4) + ')';
      c.beginPath(); c.arc(rp.x, rp.y, rp.r * 0.82, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  function computeLayout() {
    var topLimit = 8, bottomLimit = H - 8;
    var hr = headEl.getBoundingClientRect();
    if (hr.height > 0 && getComputedStyle(headEl).display !== 'none') topLimit = Math.max(topLimit, hr.bottom + 10);
    else topLimit = Math.max(topLimit, 62);
    var fr = footEl.getBoundingClientRect();
    var fcs = getComputedStyle(footEl);
    if (fr.height > 0 && fcs.display !== 'none') {
      var hint = document.getElementById('hpHint');
      var hintHidden = getComputedStyle(hint).display === 'none';
      if (!hintHidden) bottomLimit = Math.min(bottomLimit, fr.top - 6);
    }
    var scalesEl = document.getElementById('hpScales');
    if (scalesEl) {
      var sr = scalesEl.getBoundingClientRect();
      if (sr.height > 0) bottomLimit = Math.min(bottomLimit, sr.top - 10);
    }
    var availH = Math.max(160, bottomLimit - topLimit);
    var S = Math.min(W * 0.96, availH, 900);
    layout.S = S; layout.R = S / 2 * 0.985;
    layout.cx = W / 2; layout.cy = topLimit + availH / 2;
  }

  function buildFields() {
    fields = NOTES.map(function (n, i) {
      var sh = SHAPE[n.kind];
      var a = (n.a || 0) * Math.PI / 180;
      var ux = Math.sin(a), uy = -Math.cos(a);
      var R = layout.R;
      return {
        i: i, cx: layout.cx + ux * sh.dist * R, cy: layout.cy + uy * sh.dist * R,
        ux: ux, uy: uy, rx: sh.rx * R, ry: sh.ry * R,
        rot: Math.atan2(uy, ux), glow: 0, held: 0, hover: 0
      };
    });
  }

  function fieldDist2(f, px, py, tol) {
    var dx = px - f.cx, dy = py - f.cy;
    var along = dx * f.ux + dy * f.uy;
    var across = dx * (-f.uy) + dy * f.ux;
    var a = along / (f.rx * tol), b = across / (f.ry * tol);
    return a * a + b * b;
  }

  function hitTest(px, py, pointerType) {
    var tol = pointerType === 'touch' ? 1.28 : (pointerType === 'pen' ? 1.12 : 1.0);
    var best = -1, bestD = Infinity;
    for (var i = 0; i < fields.length; i++) {
      var d = fieldDist2(fields[i], px, py, tol);
      if (d <= 1 && d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function ellipsePath(c, cx, cy, rx, ry, rot) {
    c.beginPath(); c.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  }

  function renderPan() {
    var S = layout.S;
    if (!S || S < 10) return;
    var px = Math.ceil(S * DPR);
    var off = document.createElement('canvas');
    off.width = off.height = px;
    var c = off.getContext('2d');
    c.scale(DPR, DPR);
    var cx = S / 2, cy = S / 2, R = layout.R;

    var shell = c.createRadialGradient(cx - R * 0.28, cy - R * 0.32, R * 0.05, cx, cy, R);
    shell.addColorStop(0, '#2c2d32'); shell.addColorStop(0.5, '#17181b');
    shell.addColorStop(0.86, '#0d0d10'); shell.addColorStop(1, '#070708');
    c.fillStyle = shell; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();

    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 46; i++) {
      var rr = R * (0.08 + rnd() * 0.9);
      var st = rnd() * Math.PI * 2, sp = 0.5 + rnd() * 2.2;
      var gold = rnd() < 0.3;
      c.strokeStyle = gold ? 'rgba(201,170,90,' + (0.025 + rnd() * 0.04) + ')' : 'rgba(255,255,255,' + (0.018 + rnd() * 0.04) + ')';
      c.lineWidth = 0.5 + rnd() * 0.7;
      c.beginPath(); c.arc(cx, cy, rr, st, st + sp); c.stroke();
    }

    var rim = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    rim.addColorStop(0, 'rgba(232,200,100,0.7)'); rim.addColorStop(0.5, 'rgba(120,96,40,0.28)');
    rim.addColorStop(1, 'rgba(228,195,90,0.5)');
    c.strokeStyle = rim; c.lineWidth = Math.max(1.4, R * 0.012);
    c.beginPath(); c.arc(cx, cy, R - c.lineWidth / 2, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, R * 0.955, 0, Math.PI * 2); c.stroke();

    for (var n = 0; n < NOTES.length; n++) {
      var f = fields[n];
      if (!f) continue;
      var fx = cx + (f.cx - layout.cx), fy = cy + (f.cy - layout.cy);
      var note = NOTES[n];

      c.save(); c.translate(fx, fy); c.rotate(f.rot); c.scale(1, f.ry / f.rx);
      var dish = c.createRadialGradient(-f.rx * 0.22, 0, f.rx * 0.05, 0, 0, f.rx);
      dish.addColorStop(0, 'rgba(255,255,255,0.075)'); dish.addColorStop(0.55, 'rgba(0,0,0,0.12)');
      dish.addColorStop(1, 'rgba(0,0,0,0.5)');
      c.fillStyle = dish; c.beginPath(); c.arc(0, 0, f.rx, 0, Math.PI * 2); c.fill();
      c.restore();

      ellipsePath(c, fx, fy, f.rx, f.ry, f.rot);
      c.strokeStyle = note.kind === 'ding' ? 'rgba(212,175,55,0.5)' : 'rgba(212,175,55,0.36)';
      c.lineWidth = note.kind === 'ding' ? 1.6 : 1.15; c.stroke();

      ellipsePath(c, fx, fy, f.rx * 0.82, f.ry * 0.82, f.rot);
      c.strokeStyle = 'rgba(255,255,255,0.045)'; c.lineWidth = 1; c.stroke();

      if (note.kind === 'ding') {
        var dome = c.createRadialGradient(fx - f.rx * 0.25, fy - f.rx * 0.3, f.rx * 0.05, fx, fy, f.rx * 0.8);
        dome.addColorStop(0, 'rgba(255,240,200,0.16)'); dome.addColorStop(1, 'rgba(255,240,200,0)');
        c.fillStyle = dome; c.beginPath(); c.arc(fx, fy, f.rx * 0.8, 0, Math.PI * 2); c.fill();
      }

      var small = note.kind === 'rim';
      var fs = Math.max(8, R * (note.kind === 'ding' ? 0.072 : (small ? 0.044 : 0.058)));
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '500 ' + fs + 'px Inter, system-ui, sans-serif';
      c.fillStyle = 'rgba(235,228,212,0.42)';
      var showKey = !COARSE;
      c.fillText(note.name, fx, fy - (showKey ? fs * 0.38 : 0));
      if (showKey) {
        c.font = '600 ' + Math.max(7, fs * 0.74) + 'px Inter, system-ui, sans-serif';
        c.fillStyle = 'rgba(212,175,55,0.7)';
        c.fillText(note.key.toUpperCase(), fx, fy + fs * 0.78);
      }
    }
    panCache = off;
  }

  function drawPan(time, level, intro) {
    if (!panCache) return;
    var c = ctx2;
    var S = layout.S;
    var e = easeOutExpo(intro);
    var scale = (0.84 + 0.16 * e) * (1 + level * 0.006);
    c.save();
    c.globalAlpha = clamp(intro * 1.4, 0, 1);
    c.translate(layout.cx, layout.cy); c.scale(scale, scale);
    var sh = c.createRadialGradient(0, S * 0.02, S * 0.38, 0, S * 0.02, S * 0.64);
    sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sh; c.fillRect(-S * 0.7, -S * 0.7, S * 1.4, S * 1.4);
    c.drawImage(panCache, -S / 2, -S / 2, S, S);
    c.restore();

    c.save();
    c.translate(layout.cx, layout.cy); c.scale(scale, scale);
    c.translate(-layout.cx, -layout.cy);
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (f.glow < 0.01 && f.held < 0.01) continue;
      var a = Math.min(1, f.glow * 0.9 + f.held * 0.35);
      var size = (f.rx + f.ry) * (1.1 + f.glow * 0.6);
      c.globalAlpha = a;
      c.drawImage(SPRITE_GOLD, f.cx - size / 2, f.cy - size / 2, size, size);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.restore();
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, REDUCED ? 1.5 : 2);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx2.setTransform(DPR, 0, 0, DPR, 0, 0);
    computeLayout(); buildFields(); syncParticleCount(); renderPan();
  }

  var resizeTimer = null;
  function queueResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 60);
  }
  window.addEventListener('resize', queueResize);
  window.addEventListener('orientationchange', function () { setTimeout(queueResize, 120); });

  var heldKeys = new Set();
  var pointerMap = new Map();

  function strikeNote(idx, vel) {
    if (idx < 0 || idx >= NOTES.length) return;
    engine.strike(idx, vel);
    if (fields[idx]) {
      fields[idx].glow = 1;
      addRipple(fields[idx].cx, fields[idx].cy, vel || 0.8);
      addBurst(fields[idx].cx, fields[idx].cy, vel || 0.8, true);
    }
    document.body.classList.add('hp-played');
    updateChord();
  }

  function releaseNote(idx) {
    if (fields[idx]) fields[idx].held = 0;
    updateChord();
  }

  function updateChord() {
    if (!chordEl) return;
    var names = [];
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].held > 0 || (fields[i].glow > 0.3 && heldKeys.has(NOTES[i].key))) {
        names.push(NOTES[i].name);
      }
    }
    if (names.length) {
      chordEl.textContent = names.join(' · ');
      chordEl.classList.add('is-on');
    } else {
      chordEl.classList.remove('is-on');
    }
  }

  function releaseEverything() {
    heldKeys.clear();
    pointerMap.forEach(function (idx) { releaseNote(idx); });
    pointerMap.clear();
    for (var i = 0; i < fields.length; i++) fields[i].held = 0;
    updateChord();
  }

  window.addEventListener('keydown', function (e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    var idx = CODE_TO_IDX[e.code] !== undefined ? CODE_TO_IDX[e.code] : KEY_TO_IDX[e.key.toLowerCase()];
    if (idx === undefined) return;
    e.preventDefault();
    if (heldKeys.has(NOTES[idx].key)) return;
    heldKeys.add(NOTES[idx].key);
    if (fields[idx]) fields[idx].held = 1;
    strikeNote(idx, 0.85);
  });

  window.addEventListener('keyup', function (e) {
    var idx = CODE_TO_IDX[e.code] !== undefined ? CODE_TO_IDX[e.code] : KEY_TO_IDX[e.key.toLowerCase()];
    if (idx === undefined) return;
    heldKeys.delete(NOTES[idx].key);
    releaseNote(idx);
  });

  function pointerDown(e) {
    if (e.button && e.button !== 0) return;
    engine.ensure();
    var rect = canvas.getBoundingClientRect();
    var px = e.clientX - rect.left, py = e.clientY - rect.top;
    var idx = hitTest(px, py, e.pointerType || 'mouse');
    if (idx < 0) return;
    e.preventDefault();
    pointerMap.set(e.pointerId, idx);
    if (fields[idx]) fields[idx].held = 1;
    strikeNote(idx, e.pointerType === 'touch' ? 0.9 : 0.75);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }

  function pointerUp(e) {
    var idx = pointerMap.get(e.pointerId);
    if (idx === undefined) return;
    pointerMap.delete(e.pointerId);
    releaseNote(idx);
  }

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('pointerleave', function (e) {
    if (pointerMap.has(e.pointerId)) pointerUp(e);
  });

  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('dblclick', function (e) { e.preventDefault(); });
  document.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

  function goScale(delta) { applyScale(scaleIndex + delta, delta); }

  (function initScaleSwitcher() {
    var prevBtn = document.getElementById('hpScalePrev');
    var nextBtn = document.getElementById('hpScaleNext');
    var track = document.getElementById('hpScaleTrack');
    if (prevBtn) prevBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); goScale(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); goScale(1); });

    var startX = 0, dragging = false;
    function onDown(e) {
      var t = e.touches ? e.touches[0] : e;
      startX = t.clientX; dragging = true;
    }
    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      var t = (e.changedTouches && e.changedTouches[0]) || e;
      var dx = t.clientX - startX;
      if (Math.abs(dx) > 42) goScale(dx < 0 ? 1 : -1);
    }
    if (track) {
      track.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);
      track.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
    }

    window.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var ae = document.activeElement;
      if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goScale(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goScale(1); }
    });

    applyScale(0, 0);
  })();

  var last = performance.now();
  var smoothLevel = 0;
  var introFired = [false, false, false];

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    var time = now / 1000;
    introT += dt;
    var intro = clamp((introT - 0.15) / (REDUCED ? 0.2 : 1.7), 0, 1);
    var cues = [0.45, 0.85, 1.25];
    for (var k = 0; k < cues.length; k++) {
      if (!introFired[k] && introT > cues[k]) {
        introFired[k] = true;
        if (!REDUCED || k === 0) addRipple(layout.cx, layout.cy, 0.55 + k * 0.12);
      }
    }
    var lvl = engine.level();
    smoothLevel += (lvl - smoothLevel) * Math.min(1, dt * 6);
    for (var i = 0; i < fields.length; i++) {
      fields[i].glow *= Math.pow(0.16, dt);
      if (fields[i].glow < 0.004) fields[i].glow = 0;
    }
    updateAtmosphere(dt, time);
    ctx2.clearRect(0, 0, W, H);
    drawAtmosphere(time, smoothLevel, Math.max(0.0, intro));
    drawPan(time, smoothLevel, intro);
  }

  var leaving = false;
  function goBack(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (leaving) return;
    leaving = true;
    document.body.classList.add('hp-leaving');
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
    else if (engine.ctx && engine.ctx.state === 'running') { try { engine.ctx.suspend(); } catch (err) {} }
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

  window.HandpanGame = { notes: NOTES, scales: SCALES, scaleIndex: function () { return scaleIndex; }, setScale: applyScale, engine: engine, strike: strikeNote, fields: function () { return fields; } };
})();
