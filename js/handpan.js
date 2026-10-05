/**
 * handpan.js — hidden Handpan instrument (Ivar Karm – Resonance)
 *
 * Standalone page script (handpan.html). Does not touch the main site's
 * scripts or audio: this page owns its own AudioContext.
 *
 *  1. Scale + geometry   E minor / Kurd, 13 notes, top-down layout
 *  2. HandpanEngine      polyphonic Web Audio synth (partials + strike + reverb)
 *  3. Atmosphere         ambient particles, ripples, sparks (canvas)
 *  4. Instrument view    pre-rendered steel body + live glow per note
 *  5. Input              keyboard (no key-repeat), multi-touch pointers
 */
(function () {
  'use strict';

  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var COARSE = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  /* ======================================================================
     1. SCALE + GEOMETRY
     ====================================================================== */

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // kind: ding (centre) | ring (8 inner fields) | rim (4 high notes on the shoulder)
  // a: angle in degrees, clockwise from the top of the instrument
  var NOTES = [
    { key: 'q', code: 'KeyQ', name: 'E3',  midi: 52, kind: 'ding' },
    { key: 'w', code: 'KeyW', name: 'B3',  midi: 59, kind: 'ring', a: 157.5 },
    { key: 'e', code: 'KeyE', name: 'D4',  midi: 62, kind: 'ring', a: 202.5 },
    { key: 'r', code: 'KeyR', name: 'E4',  midi: 64, kind: 'ring', a: 112.5 },
    { key: 't', code: 'KeyT', name: 'F♯4', midi: 66, kind: 'ring', a: 247.5 },
    { key: 'y', code: 'KeyY', name: 'G4',  midi: 67, kind: 'ring', a: 67.5 },
    { key: 'u', code: 'KeyU', name: 'A4',  midi: 69, kind: 'ring', a: 292.5 },
    { key: 'i', code: 'KeyI', name: 'B4',  midi: 71, kind: 'ring', a: 22.5 },
    { key: 'o', code: 'KeyO', name: 'D5',  midi: 74, kind: 'ring', a: 337.5 },
    { key: 'p', code: 'KeyP', name: 'E5',  midi: 76, kind: 'rim',  a: 308 },
    { key: 'a', code: 'KeyA', name: 'F♯5', midi: 78, kind: 'rim',  a: 343 },
    { key: 's', code: 'KeyS', name: 'G5',  midi: 79, kind: 'rim',  a: 17 },
    { key: 'd', code: 'KeyD', name: 'B5',  midi: 83, kind: 'rim',  a: 52 }
  ];

  var KEY_TO_IDX = {};
  var CODE_TO_IDX = {};
  NOTES.forEach(function (n, i) {
    n.freq = mtof(n.midi);
    n.pan = n.kind === 'ding' ? 0 : Math.max(-0.6, Math.min(0.6, Math.sin(n.a * Math.PI / 180) * 0.55));
    KEY_TO_IDX[n.key] = i;
    CODE_TO_IDX[n.code] = i;
  });

  // Field shapes in units of the shell radius (R = 1)
  var SHAPE = {
    ding: { dist: 0,     rx: 0.19,  ry: 0.19 },
    ring: { dist: 0.545, rx: 0.205, ry: 0.158 },
    rim:  { dist: 0.885, rx: 0.075, ry: 0.125 }
  };

  /* ======================================================================
     2. HANDPAN ENGINE — polyphonic Web Audio
     ====================================================================== */

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
        var c = 0.06 + 0.5 * (1 - t) * (1 - t);      // tail gets darker
        lp += (n - lp) * c;
        var fadeIn = i < pre ? 0 : Math.min(1, (i - pre) / (rate * 0.008));
        d[i] = lp * Math.pow(1 - t, decay) * fadeIn * 2.2;
      }
    }
    return buf;
  }

  function HandpanEngine() {
    this.ctx = null;
    this.bus = null;
    this.master = null;
    this.analyser = null;
    this.analyserData = null;
    this.noise = null;
    this.active = new Map();   // note index -> voice (for clean retrigger)
    this.voices = [];          // all live voices, oldest first
    this.ready = false;
  }

  // Must be called from a user gesture the first time (autoplay policy / iOS).
  HandpanEngine.prototype.ensure = function () {
    if (!this.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        if (navigator.audioSession) navigator.audioSession.type = 'playback'; // iOS: sound even in silent mode
      } catch (e) { /* optional API */ }
      try {
        this.ctx = new AC({ latencyHint: 'interactive' });
      } catch (e) {
        this.ctx = new AC();
      }
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

    this.bus = ctx.createGain();
    this.bus.gain.value = 1;

    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 20;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.004;
    comp.release.value = 0.24;

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;

    // Warm room: procedurally generated impulse response
    var convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx, 2.8, 3.2);
    var send = ctx.createGain();
    send.gain.value = 0.34;
    var wet = ctx.createGain();
    wet.gain.value = 0.9;

    this.bus.connect(comp);
    comp.connect(this.master);
    comp.connect(send);
    send.connect(convolver);
    convolver.connect(wet);
    wet.connect(this.master);

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.82;
    this.analyserData = new Uint8Array(this.analyser.fftSize);
    this.master.connect(this.analyser);
    this.master.connect(ctx.destination);

    // One shared noise buffer for strike transients
    var nlen = Math.floor(ctx.sampleRate * 0.12);
    this.noise = ctx.createBuffer(1, nlen, ctx.sampleRate);
    var nd = this.noise.getChannelData(0);
    for (var i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;

    this.ready = true;
  };

  // 0..1 smoothed loudness for visuals
  HandpanEngine.prototype.level = function () {
    if (!this.ready || this.ctx.state !== 'running') return 0;
    this.analyser.getByteTimeDomainData(this.analyserData);
    var sum = 0;
    for (var i = 0; i < this.analyserData.length; i++) {
      var v = (this.analyserData[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.analyserData.length) * 3.2);
  };

  HandpanEngine.prototype._release = function (voice, t, tc) {
    if (voice.released) return;
    voice.released = true;
    try {
      voice.out.gain.cancelScheduledValues(t);
      voice.out.gain.setTargetAtTime(0, t, tc);
    } catch (e) { /* ignore */ }
    var stopAt = t + tc * 8 + 0.02;
    voice.oscs.forEach(function (o) { try { o.stop(stopAt); } catch (e) { /* already stopped */ } });
  };

  // Stop tracking a voice (it may still be fading out audibly)
  HandpanEngine.prototype._detach = function (voice) {
    var i = this.voices.indexOf(voice);
    if (i >= 0) this.voices.splice(i, 1);
    if (this.active.get(voice.idx) === voice) this.active.delete(voice.idx);
  };

  // Called once the voice has actually finished sounding
  HandpanEngine.prototype._cleanup = function (voice) {
    this._detach(voice);
    try { voice.out.disconnect(); } catch (e) { /* ignore */ }
    if (voice.pan) { try { voice.pan.disconnect(); } catch (e) { /* ignore */ } }
  };

  // Strike one note. Any number of notes can sound at the same time.
  HandpanEngine.prototype.strike = function (idx, vel) {
    if (!this.ensure() || !this.ready) return null;
    var ctx = this.ctx;
    var note = NOTES[idx];
    var f = note.freq;
    var t = ctx.currentTime + 0.003;
    vel = Math.max(0.2, Math.min(1, vel || 0.8));

    // Re-striking the same field: let the old ring fade quickly (no clicks, no stacking)
    var prev = this.active.get(idx);
    if (prev) this._release(prev, t, 0.03);

    // Voice stealing keeps CPU bounded during very dense playing
    while (this.voices.length >= MAX_VOICES) {
      var oldest = this.voices[0];
      this._release(oldest, t, 0.02);
      this._detach(oldest);          // keep its node alive until the fade ends (no click)
    }

    var out = ctx.createGain();
    out.gain.value = 1;
    var panNode = null;
    if (ctx.createStereoPanner) {
      panNode = ctx.createStereoPanner();
      panNode.pan.value = note.pan;
      out.connect(panNode);
      panNode.connect(this.bus);
    } else {
      out.connect(this.bus);
    }

    // Lower notes ring longer, high notes sing shorter
    var T0 = Math.max(1.8, 6.2 - 1.1 * Math.log(f / 164.81) / Math.LN2);
    var base = 0.2 + 0.14 * vel;
    var oscs = [];

    // Handpan spectrum: strong fundamental, octave, compound fifth (+ faint 4th)
    var partials = [
      { r: 1.0,   g: 0.5,  dec: T0,        det: 0.0009 },   // fundamental, slightly detuned pair
      { r: 1.0,   g: 0.5,  dec: T0 * 0.98, det: -0.0009 },  //   → gentle natural beating
      { r: 2.0,   g: 0.34, dec: T0 * 0.62, det: 0.0004 },   // octave
      { r: 2.997, g: 0.16, dec: T0 * 0.36, det: 0 },        // compound fifth
      { r: 4.02,  g: 0.045, dec: T0 * 0.2, det: 0 }         // shimmer
    ];

    for (var i = 0; i < partials.length; i++) {
      var p = partials[i];
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f * p.r * (1 + p.det);
      var g = ctx.createGain();
      var peak = base * p.g * (i >= 2 ? (0.75 + 0.25 * vel) : 1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.0035);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.dec);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + p.dec + 0.1);
      oscs.push(osc);
    }

    // Strike transient: short band-passed noise "tick" of the hand on steel
    var src = ctx.createBufferSource();
    src.buffer = this.noise;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(f * 3.6, 6200);
    bp.Q.value = 1.1;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(0.2 * vel, t + 0.0015);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(out);
    src.start(t);
    src.stop(t + 0.07);

    var voice = { idx: idx, out: out, pan: panNode, oscs: oscs, released: false, born: ctx.currentTime, ringUntil: ctx.currentTime + Math.min(T0, 3.2) };
    var self = this;
    oscs[0].onended = function () { self._cleanup(voice); };
    this.voices.push(voice);
    this.active.set(idx, voice);
    return voice;
  };

  HandpanEngine.prototype.shutdown = function () {
    if (!this.ctx) return;
    try { this.ctx.close(); } catch (e) { /* ignore */ }
  };

  var engine = new HandpanEngine();

  /* ======================================================================
     3 + 4. STAGE: atmosphere + instrument
     ====================================================================== */

  var canvas = document.getElementById('hpStage');
  var ctx2 = canvas.getContext('2d');
  var headEl = document.getElementById('hpHead');
  var footEl = document.getElementById('hpFoot');
  var chordEl = document.getElementById('hpChord');

  var W = 0, H = 0, DPR = 1;
  var layout = { cx: 0, cy: 0, S: 0, R: 0 };
  var fields = [];               // per-note screen geometry + live state
  var panCache = null;           // pre-rendered steel body
  var introT = 0;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function easeOutExpo(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }

  // Glow sprites (gold + cool) so thousands of draws stay cheap
  function makeSprite(r, g, b) {
    var s = document.createElement('canvas');
    s.width = s.height = 64;
    var c = s.getContext('2d');
    var grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
    grad.addColorStop(0.18, 'rgba(' + r + ',' + g + ',' + b + ',0.55)');
    grad.addColorStop(0.5, 'rgba(' + r + ',' + g + ',' + b + ',0.14)');
    grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, 64, 64);
    return s;
  }
  var SPRITE_GOLD = makeSprite(235, 200, 100);
  var SPRITE_COOL = makeSprite(205, 215, 235);

  // ---------- Particles, ripples, sparks ----------
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
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : H + 12 + Math.random() * 30,
      vx: 0,
      vy: 0,
      z: z,
      r: (0.7 + Math.random() * 1.9) * (0.55 + z * 0.7),
      gold: Math.random() < 0.62,
      ph: Math.random() * Math.PI * 2,
      tw: 0.6 + Math.random() * 1.6,
      glow: 0
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
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 18,
        life: 1,
        decay: 0.55 + Math.random() * 0.7,
        size: 5 + Math.random() * 11,
        gold: gold || Math.random() < 0.7
      });
    }
  }

  function updateAtmosphere(dt, time) {
    // ambient drift + ripple response
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var driftX = Math.sin(time * 0.17 + p.ph + p.y * 0.0035) * 9 * p.z;
      var driftY = -(5 + 13 * p.z) + Math.cos(time * 0.13 + p.ph) * 3;
      var k = Math.min(1, dt * 0.9);
      p.vx += (driftX - p.vx) * k;
      p.vy += (driftY - p.vy) * k;

      for (var j = 0; j < ripples.length; j++) {
        var rp = ripples[j];
        var dx = p.x - rp.x;
        var dy = p.y - rp.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        var band = Math.abs(d - rp.r);
        if (band < 52) {
          var f = 1 - band / 52;
          f = f * f * rp.strength * rp.life;
          var a = 980 * f * p.z * dt;
          p.vx += (dx / d) * a;
          p.vy += (dy / d) * a;
          if (f > p.glow) p.glow = f;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.glow *= Math.pow(0.05, dt);   // fades out in ~1s

      if (p.y < -16 || p.x < -24 || p.x > W + 24 || p.y > H + 60) {
        particles[i] = spawnParticle(false);
        if (p.y < -16) particles[i].y = H + 12 + Math.random() * 30;
      }
    }

    for (var r = ripples.length - 1; r >= 0; r--) {
      var rp2 = ripples[r];
      rp2.r += rp2.speed * dt;
      rp2.speed *= Math.pow(0.55, dt);
      rp2.life -= dt * 0.55;
      if (rp2.life <= 0) ripples.splice(r, 1);
    }

    for (var s = sparks.length - 1; s >= 0; s--) {
      var sp = sparks[s];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      var drag = Math.pow(0.12, dt);
      sp.vx *= drag;
      sp.vy = sp.vy * drag - 6 * dt;
      sp.life -= sp.decay * dt;
      if (sp.life <= 0) sparks.splice(s, 1);
    }
  }

  function drawAtmosphere(time, level, intro) {
    var c = ctx2;

    // breathing centre glow that follows how loud the instrument is
    var glowA = (0.05 + level * 0.2) * intro;
    var g = c.createRadialGradient(layout.cx, layout.cy, layout.R * 0.1, layout.cx, layout.cy, layout.R * 1.9);
    g.addColorStop(0, 'rgba(212,175,55,' + glowA + ')');
    g.addColorStop(0.5, 'rgba(212,175,55,' + (glowA * 0.28) + ')');
    g.addColorStop(1, 'rgba(212,175,55,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    c.globalCompositeOperation = 'lighter';

    // ambient particles
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var tw = 0.65 + 0.35 * Math.sin(time * p.tw + p.ph);
      var a = ((p.gold ? 0.5 : 0.3) * tw * (0.55 + p.z * 0.45) + p.glow * 0.75 + level * 0.12) * intro;
      if (a < 0.01) continue;
      var size = (p.r * 5.2 + p.glow * 16) * (0.9 + level * 0.2);
      c.globalAlpha = Math.min(1, a);
      c.drawImage(p.gold ? SPRITE_GOLD : SPRITE_COOL, p.x - size / 2, p.y - size / 2, size, size);
    }

    // sparks from struck notes
    for (var s = 0; s < sparks.length; s++) {
      var sp = sparks[s];
      var sa = sp.life * sp.life;
      var ss = sp.size * (0.5 + sp.life * 0.7);
      c.globalAlpha = Math.min(1, sa * 0.95);
      c.drawImage(sp.gold ? SPRITE_GOLD : SPRITE_COOL, sp.x - ss / 2, sp.y - ss / 2, ss, ss);
    }

    // ripple rings
    c.globalAlpha = 1;
    c.lineWidth = 1.2;
    for (var r = 0; r < ripples.length; r++) {
      var rp = ripples[r];
      var ra = Math.max(0, rp.life) * 0.34 * rp.strength;
      if (ra < 0.01) continue;
      c.strokeStyle = 'rgba(228,195,90,' + ra + ')';
      c.beginPath();
      c.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = 'rgba(228,195,90,' + (ra * 0.4) + ')';
      c.beginPath();
      c.arc(rp.x, rp.y, rp.r * 0.82, 0, Math.PI * 2);
      c.stroke();
    }

    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  // ---------- Layout ----------
  function computeLayout() {
    var topLimit = 8;
    var bottomLimit = H - 8;
    var hr = headEl.getBoundingClientRect();
    if (hr.height > 0 && getComputedStyle(headEl).display !== 'none') topLimit = Math.max(topLimit, hr.bottom + 10);
    else topLimit = Math.max(topLimit, 62);
    var fr = footEl.getBoundingClientRect();
    var fcs = getComputedStyle(footEl);
    if (fr.height > 0 && fcs.display !== 'none') {
      // in short landscape the hint is hidden and the chord floats in a corner, so don't reserve space
      var hint = document.getElementById('hpHint');
      var hintHidden = getComputedStyle(hint).display === 'none';
      if (!hintHidden) bottomLimit = Math.min(bottomLimit, fr.top - 6);
    }
    var availH = Math.max(160, bottomLimit - topLimit);
    var S = Math.min(W * 0.96, availH, 900);
    layout.S = S;
    layout.R = S / 2 * 0.985;
    layout.cx = W / 2;
    layout.cy = topLimit + availH / 2;
  }

  function buildFields() {
    fields = NOTES.map(function (n, i) {
      var sh = SHAPE[n.kind];
      var a = (n.a || 0) * Math.PI / 180;
      var ux = Math.sin(a), uy = -Math.cos(a);
      var R = layout.R;
      return {
        i: i,
        cx: layout.cx + ux * sh.dist * R,
        cy: layout.cy + uy * sh.dist * R,
        ux: ux, uy: uy,
        rx: sh.rx * R, ry: sh.ry * R,
        rot: Math.atan2(uy, ux),
        glow: 0,          // decays after a strike
        held: 0,          // >0 while a key / finger is down
        hover: 0
      };
    });
  }

  // Normalised distance² to a field's ellipse (<=1 means inside)
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

  // ---------- Pre-rendered steel body ----------
  function ellipsePath(c, cx, cy, rx, ry, rot) {
    c.beginPath();
    c.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  }

  function renderPan() {
    var S = layout.S;
    var px = Math.ceil(S * DPR);
    var off = document.createElement('canvas');
    off.width = off.height = px;
    var c = off.getContext('2d');
    c.scale(DPR, DPR);
    var cx = S / 2, cy = S / 2, R = layout.R;

    // outer shell
    var shell = c.createRadialGradient(cx - R * 0.28, cy - R * 0.32, R * 0.05, cx, cy, R);
    shell.addColorStop(0, '#2c2d32');
    shell.addColorStop(0.5, '#17181b');
    shell.addColorStop(0.86, '#0d0d10');
    shell.addColorStop(1, '#070708');
    c.fillStyle = shell;
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();

    // brushed-steel rings
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 46; i++) {
      var rr = R * (0.08 + rnd() * 0.9);
      var st = rnd() * Math.PI * 2;
      var sp = 0.5 + rnd() * 2.2;
      var gold = rnd() < 0.3;
      c.strokeStyle = gold ? 'rgba(201,170,90,' + (0.025 + rnd() * 0.04) + ')' : 'rgba(255,255,255,' + (0.018 + rnd() * 0.04) + ')';
      c.lineWidth = 0.5 + rnd() * 0.7;
      c.beginPath(); c.arc(cx, cy, rr, st, st + sp); c.stroke();
    }

    // metallic rim line + inner shoulder
    var rim = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    rim.addColorStop(0, 'rgba(232,200,100,0.7)');
    rim.addColorStop(0.5, 'rgba(120,96,40,0.28)');
    rim.addColorStop(1, 'rgba(228,195,90,0.5)');
    c.strokeStyle = rim;
    c.lineWidth = Math.max(1.4, R * 0.012);
    c.beginPath(); c.arc(cx, cy, R - c.lineWidth / 2, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.05)';
    c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, R * 0.955, 0, Math.PI * 2); c.stroke();

    // tone fields
    for (var n = 0; n < NOTES.length; n++) {
      var f = fields[n];
      var fx = cx + (f.cx - layout.cx), fy = cy + (f.cy - layout.cy);
      var note = NOTES[n];

      // hammered dish: darker well, lit rim
      c.save();
      c.translate(fx, fy);
      c.rotate(f.rot);
      c.scale(1, f.ry / f.rx);
      var dish = c.createRadialGradient(-f.rx * 0.22, 0, f.rx * 0.05, 0, 0, f.rx);
      dish.addColorStop(0, 'rgba(255,255,255,0.075)');
      dish.addColorStop(0.55, 'rgba(0,0,0,0.12)');
      dish.addColorStop(1, 'rgba(0,0,0,0.5)');
      c.fillStyle = dish;
      c.beginPath(); c.arc(0, 0, f.rx, 0, Math.PI * 2); c.fill();
      c.restore();

      ellipsePath(c, fx, fy, f.rx, f.ry, f.rot);
      c.strokeStyle = note.kind === 'ding' ? 'rgba(212,175,55,0.5)' : 'rgba(212,175,55,0.36)';
      c.lineWidth = note.kind === 'ding' ? 1.6 : 1.15;
      c.stroke();

      ellipsePath(c, fx, fy, f.rx * 0.82, f.ry * 0.82, f.rot);
      c.strokeStyle = 'rgba(255,255,255,0.045)';
      c.lineWidth = 1;
      c.stroke();

      if (note.kind === 'ding') {
        var dome = c.createRadialGradient(fx - f.rx * 0.25, fy - f.rx * 0.3, f.rx * 0.05, fx, fy, f.rx * 0.8);
        dome.addColorStop(0, 'rgba(255,240,200,0.16)');
        dome.addColorStop(1, 'rgba(255,240,200,0)');
        c.fillStyle = dome;
        c.beginPath(); c.arc(fx, fy, f.rx * 0.8, 0, Math.PI * 2); c.fill();
      }

      // labels
      var small = note.kind === 'rim';
      var fs = Math.max(8, R * (note.kind === 'ding' ? 0.072 : (small ? 0.044 : 0.058)));
      c.textAlign = 'center';
      c.textBaseline = 'middle';
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
    c.translate(layout.cx, layout.cy);
    c.scale(scale, scale);
    // soft ground shadow
    var sh = c.createRadialGradient(0, S * 0.02, S * 0.38, 0, S * 0.02, S * 0.64);
    sh.addColorStop(0, 'rgba(0,0,0,0.55)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sh;
    c.fillRect(-S * 0.7, -S * 0.7, S * 1.4, S * 1.4);
    c.drawImage(panCache, -S / 2, -S / 2, S, S);
    c.restore();

    // live glow per field
    c.save();
    c.translate(layout.cx, layout.cy);
    c.scale(scale, scale);
    c.translate(-layout.cx, -layout.cy);
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      var g = Math.max(f.glow, f.held ? 0.62 : 0, f.hover * 0.22);
      if (g < 0.01) continue;
      c.save();
      c.translate(f.cx, f.cy);
      c.rotate(f.rot);
      c.scale(1, f.ry / f.rx);
      var rad = f.rx * (1.04 + g * 0.22);
      var grd = c.createRadialGradient(0, 0, 0, 0, 0, rad);
      grd.addColorStop(0, 'rgba(255,226,140,' + (0.52 * g) + ')');
      grd.addColorStop(0.55, 'rgba(228,180,70,' + (0.26 * g) + ')');
      grd.addColorStop(1, 'rgba(212,160,40,0)');
      c.fillStyle = grd;
      c.beginPath(); c.arc(0, 0, rad, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,224,130,' + Math.min(1, 0.95 * g) + ')';
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(0, 0, f.rx, 0, Math.PI * 2); c.stroke();
      c.restore();
    }
    c.restore();
  }

  // ---------- Resize ----------
  var resizeQueued = false;
  function resize() {
    resizeQueued = false;
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx2.setTransform(DPR, 0, 0, DPR, 0, 0);
    computeLayout();
    var prev = fields;
    buildFields();
    // keep live state across a resize (e.g. device rotation mid-chord)
    for (var i = 0; i < prev.length && i < fields.length; i++) {
      fields[i].glow = prev[i].glow;
      fields[i].held = prev[i].held;
      fields[i].hover = prev[i].hover;
    }
    renderPan();
    syncParticleCount();
  }
  function queueResize() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(resize);
  }
  window.addEventListener('resize', queueResize);
  window.addEventListener('orientationchange', function () { setTimeout(queueResize, 120); });

  /* ======================================================================
     5. NOTE TRIGGERING + INPUT
     ====================================================================== */

  var chordTimer = null;
  var lastChordText = '';
  var played = false;

  function ringingNames() {
    if (!engine.ready) return [];
    var now = engine.ctx.currentTime;
    var names = [];
    engine.voices.forEach(function (v) {
      if (!v.released && v.ringUntil > now) names.push({ midi: NOTES[v.idx].midi, name: NOTES[v.idx].name });
    });
    names.sort(function (a, b) { return a.midi - b.midi; });
    var seen = {};
    return names.filter(function (n) { if (seen[n.name]) return false; seen[n.name] = 1; return true; }).map(function (n) { return n.name; });
  }

  function refreshChord() {
    var list = ringingNames();
    var text = list.length ? list.join(' · ') : '';
    if (text !== lastChordText) {
      lastChordText = text;
      if (text) chordEl.textContent = text;
      chordEl.classList.toggle('is-on', !!text);
    }
  }

  function strikeNote(idx, vel) {
    if (idx < 0 || idx >= NOTES.length) return;
    var v = clamp((vel || 0.8) + (Math.random() - 0.5) * 0.12, 0.25, 1);
    engine.strike(idx, v);
    var f = fields[idx];
    f.glow = 1;
    // ripple + burst start exactly at this note's vector
    addRipple(f.cx, f.cy, 0.62 + 0.4 * v);
    addBurst(f.cx, f.cy, v, NOTES[idx].kind !== 'rim');
    if (!played) {
      played = true;
      document.body.classList.add('hp-played');
    }
    if (chordTimer) clearInterval(chordTimer);
    refreshChord();
    chordTimer = setInterval(function () {
      refreshChord();
      if (!lastChordText) { clearInterval(chordTimer); chordTimer = null; }
    }, 120);
    if (navigator.vibrate && COARSE) { try { navigator.vibrate(6); } catch (e) { /* optional */ } }
  }

  function setHeld(idx, delta) {
    if (idx < 0 || !fields[idx]) return;
    fields[idx].held = Math.max(0, fields[idx].held + delta);
  }

  // ----- Keyboard: one strike per physical press, never on auto-repeat -----
  var keysDown = {};   // e.code -> note index currently held by that key

  function noteForKeyEvent(e) {
    var k = (e.key || '').toLowerCase();
    if (KEY_TO_IDX.hasOwnProperty(k)) return KEY_TO_IDX[k];
    // non-Latin layouts: fall back to the physical key position
    if ((k.length !== 1 || !/[a-z]/.test(k)) && CODE_TO_IDX.hasOwnProperty(e.code)) return CODE_TO_IDX[e.code];
    return -1;
  }

  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { goBack(); return; }
    var idx = noteForKeyEvent(e);
    if (idx < 0) return;
    e.preventDefault();                                   // no find-as-you-type, no page shortcuts
    if (e.repeat || keysDown[e.code] !== undefined) return; // block key-repeat loops
    keysDown[e.code] = idx;
    setHeld(idx, 1);
    strikeNote(idx, 0.8);
  }, { passive: false });

  window.addEventListener('keyup', function (e) {
    if (keysDown[e.code] === undefined) return;
    var idx = keysDown[e.code];
    delete keysDown[e.code];
    setHeld(idx, -1);
    e.preventDefault();
  }, { passive: false });

  function releaseEverything() {
    Object.keys(keysDown).forEach(function (code) { setHeld(keysDown[code], -1); delete keysDown[code]; });
    pointers.forEach(function (st) { setHeld(st.idx, -1); });
    pointers.clear();
    fields.forEach(function (f) { f.held = 0; f.hover = 0; });
  }
  window.addEventListener('blur', releaseEverything);
  document.addEventListener('visibilitychange', function () { if (document.hidden) releaseEverything(); });

  // ----- Pointers: mouse, pen and unlimited simultaneous touches -----
  var pointers = new Map();   // pointerId -> { idx }

  function localXY(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function pressureVelocity(e) {
    if (e.pointerType === 'pen' && e.pressure > 0) return 0.45 + e.pressure * 0.5;
    return 0.8;
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    engine.ensure();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    var p = localXY(e);
    var idx = hitTest(p.x, p.y, e.pointerType);
    pointers.set(e.pointerId, { idx: idx });
    if (idx >= 0) { setHeld(idx, 1); strikeNote(idx, pressureVelocity(e)); }
  }, { passive: false });

  canvas.addEventListener('pointermove', function (e) {
    var p = localXY(e);
    var st = pointers.get(e.pointerId);
    if (st) {
      e.preventDefault();
      var idx = hitTest(p.x, p.y, e.pointerType);
      if (idx !== st.idx) {                 // sliding a finger onto another field plays it
        setHeld(st.idx, -1);
        st.idx = idx;
        if (idx >= 0) { setHeld(idx, 1); strikeNote(idx, 0.7); }
      }
    } else if (e.pointerType === 'mouse') {
      var h = hitTest(p.x, p.y, 'mouse');
      for (var i = 0; i < fields.length; i++) fields[i].hover = (i === h) ? 1 : 0;
      canvas.style.cursor = h >= 0 ? 'pointer' : 'default';
    }
  }, { passive: false });

  function endPointer(e) {
    var st = pointers.get(e.pointerId);
    if (!st) return;
    setHeld(st.idx, -1);
    pointers.delete(e.pointerId);
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);
  canvas.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse' && !pointers.has(e.pointerId)) fields.forEach(function (f) { f.hover = 0; });
  });

  // ----- Block zoom / scroll / long-press menus (multi-touch chords must stay clean) -----
  ['touchstart', 'touchmove'].forEach(function (type) {
    canvas.addEventListener(type, function (e) { e.preventDefault(); }, { passive: false });
  });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (type) {
    document.addEventListener(type, function (e) { e.preventDefault(); }, { passive: false });
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('dblclick', function (e) { e.preventDefault(); });
  document.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

  /* ======================================================================
     MAIN LOOP
     ====================================================================== */

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

    // soft silent ripples from the centre as the page opens
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
      fields[i].glow *= Math.pow(0.16, dt);   // ~1s fade after a strike
      if (fields[i].glow < 0.004) fields[i].glow = 0;
    }

    updateAtmosphere(dt, time);

    ctx2.clearRect(0, 0, W, H);
    drawAtmosphere(time, smoothLevel, Math.max(0.0, intro));
    drawPan(time, smoothLevel, intro);
  }

  /* ======================================================================
     NAVIGATION BACK TO THE ROAD
     ====================================================================== */

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
      if (cameFromRoad) history.back();      // restores the road exactly as it was (bfcache)
      else location.href = './index.html';
    }, REDUCED ? 30 : 380);
    // if history.back() does nothing (e.g. deep link), still get home
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
    else if (engine.ctx && engine.ctx.state === 'running') { try { engine.ctx.suspend(); } catch (err) { /* ignore */ } }
  });

  /* ======================================================================
     BOOT
     ====================================================================== */

  function boot() {
    resize();
    requestAnimationFrame(function (t) { last = t; requestAnimationFrame(frame); });
    // veil dissolves on the next frame, revealing the atmosphere
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { document.body.classList.remove('hp-entering'); });
    });
    // fonts change label metrics: redraw the steel once they're in
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { queueResize(); });
    }
  }

  // Layout depends on header/footer metrics, so wait for styles
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Small hook for debugging and automated tests
  window.HandpanGame = { notes: NOTES, engine: engine, strike: strikeNote, fields: function () { return fields; } };
})();
