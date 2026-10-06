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
  // Outer 4 ascending B4→C5→D5→E5, no overlap:
  //   B4 by G4 @ 45°, C5 by F4 @ 315°,
  //   D5 toward A4 @ 20°, E5 toward A4 @ 350°
  var INNER_ANGLES = [180, 225, 135, 270, 90, 315, 45, 0];
  var OUTER_ANGLES = [45, 315, 20, 350];

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

  var EXPERIMENTS = [
    {name:'Glass Bloom',type:'glass',partials:[1,1.01,2.01,3.01,4.98],decay:5.8,release:0.7,spread:0.012},
    {name:'Soft Bells',type:'bell',partials:[1,2.01,3.98,6.01,8.02],decay:4.8,release:0.55,spread:0.006},
    {name:'Moon Pluck',type:'pluck',partials:[1,1,2,3,5],decay:3.8,release:0.42,spread:0.004},
    {name:'Shimmer',type:'shimmer',partials:[1,2,4.01,8.03,12.1],decay:6.8,release:1.0,spread:0.02},
    {name:'Soft Pulse',type:'pulse',partials:[1,2,3,4],decay:4.6,release:0.8,spread:0.018},
    {name:'Air Choir',type:'air',partials:[1,1.005,1.5,2.005,3],decay:7.2,release:1.2,spread:0.025},
    {name:'Glass Pluck',type:'glasspluck',partials:[1,2.5,4.2,6.8],decay:3.2,release:0.35,spread:0.009},
    {name:'Deep Resonator',type:'deep',partials:[0.5,1,2,3,4],decay:8.5,release:1.4,spread:0.008},
    {name:'Drift Arp',type:'arp',partials:[1,2,3,5,7],decay:5.5,release:1.0,spread:0.018}
  ];
  var instrumentIndex=0;
  HandpanEngine.prototype.setInstrument=function(i){instrumentIndex=Math.max(0,Math.min(EXPERIMENTS.length-1,i|0));return EXPERIMENTS[instrumentIndex];};
  HandpanEngine.prototype.instrument=function(){return EXPERIMENTS[instrumentIndex];};
  HandpanEngine.prototype.instruments=EXPERIMENTS;

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
    var preset = EXPERIMENTS[instrumentIndex];
    var partials = preset.partials.map(function(ratio,i){
      var gains = [0.5,0.32,0.18,0.095,0.045];
      return {r:ratio,g:gains[i]||0.03,dec:T0*(preset.decay/6.2)*(1-i*0.07),det:(i%2?-1:1)*preset.spread*(i>1?0.65:1)};
    });
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

  HandpanEngine.prototype.damp = function (idx, amount) {
    var voice = this.active.get(idx);
    if (!voice || !this.ctx) return;
    var t = this.ctx.currentTime;
    amount = Math.max(0, Math.min(1, amount == null ? 0.9 : amount));
    var tc = Math.max(0.014, 0.018 + (1 - amount) * 0.07);
    // Touch damping leaves a little living resonance rather than hard-cutting
    // the voice. Repeated calls while a finger remains down create a natural
    // palm/finger mute curve.
    var target = 0.0001 + 0.055 * (1 - amount);
    try {
      voice.out.gain.cancelScheduledValues(t);
      voice.out.gain.setTargetAtTime(target, t, tc);
    } catch (e) {}
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
    var count = REDUCED ? 2 : 4;
    for (var k = 0; k < count; k++) {
      if (ripples.length >= MAX_RIPPLES) ripples.shift();
      ripples.push({ x: x, y: y, r: 10 + k * 18, speed: 300 + 95 * strength - k * 12, strength: strength * (1 - k * 0.12), life: 1, width: k === 0 ? 2.2 : 1.15 });
    }
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
      c.lineWidth = rp.width || 1.2;
      c.shadowColor = 'rgba(228,195,90,' + (ra * 0.9) + ')';
      c.shadowBlur = 16 + rp.width * 5;
      c.strokeStyle = 'rgba(238,211,119,' + ra + ')';
      c.beginPath(); c.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2); c.stroke();
      c.shadowBlur = 0;
      c.strokeStyle = 'rgba(228,195,90,' + (ra * 0.28) + ')';
      c.beginPath(); c.arc(rp.x, rp.y, rp.r * 0.72, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  function computeLayout() {
    var topLimit = 8, bottomLimit = H - 8;
    var hr = headEl.getBoundingClientRect();
    if (hr.height > 0 && getComputedStyle(headEl).display !== 'none') {
      topLimit = Math.max(topLimit, hr.bottom + 10);
    } else {
      topLimit = Math.max(topLimit, 54);
    }

    var fr = footEl.getBoundingClientRect();
    var fcs = getComputedStyle(footEl);
    if (fr.height > 0 && fcs.display !== 'none') {
      var hint = document.getElementById('hpHint');
      var hintHidden = !hint || getComputedStyle(hint).display === 'none';
      if (!hintHidden) bottomLimit = Math.min(bottomLimit, fr.top - 8);
    }

    // The mobile scale/instrument strip lives at the TOP of the screen.
    // The old layout always treated it as a bottom constraint, which collapsed
    // the available canvas to ~160px and made the handpan effectively disappear.
    var scalesEl = document.getElementById('hpScales');
    if (scalesEl) {
      var sr = scalesEl.getBoundingClientRect();
      if (sr.height > 0) {
        if (sr.top < H * 0.5) {
          topLimit = Math.max(topLimit, sr.bottom + 14);
        } else {
          bottomLimit = Math.min(bottomLimit, sr.top - 12);
        }
      }
    }

    // Keep the instrument clear of the bottom navigation even when the hint is hidden.
    var modebar = document.querySelector('.app-modebar');
    if (modebar) {
      var mr = modebar.getBoundingClientRect();
      if (mr.height > 0) bottomLimit = Math.min(bottomLimit, mr.top - 12);
    }

    var availH = Math.max(220, bottomLimit - topLimit);
    var widthLimit = W < 700 ? W * 0.88 : W * 0.96;
    var S = Math.min(widthLimit, availH, 900);
    layout.S = S;
    layout.R = S / 2 * 0.985;
    layout.cx = W / 2;
    layout.cy = topLimit + Math.max(0, (availH - S) / 2) + S / 2;
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
        rot: Math.atan2(uy, ux), glow: 0, held: 0, hover: 0, guide: 0, guideTarget: 0, guideSuccess: 0
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

  function drawGuideFields(c, time, scale) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (f.guide < 0.01) continue;
      var pulse = 0.72 + 0.28 * Math.sin(time * 3.2 + i * 0.35);
      var a = Math.min(0.82, f.guide * pulse);
      f.guideSuccess = Math.max(0, f.guideSuccess - 0.035);
      var rx = f.rx * (1.05 + f.guide * 0.22);
      var ry = f.ry * (1.05 + f.guide * 0.22);
      var g = c.createRadialGradient(f.cx - f.rx * 0.18, f.cy - f.ry * 0.2, 0, f.cx, f.cy, Math.max(rx, ry) * 1.45);
      g.addColorStop(0, 'rgba(255,226,112,' + (a * 0.9) + ')');
      g.addColorStop(0.32, 'rgba(230,191,65,' + (a * 0.42) + ')');
      g.addColorStop(0.72, 'rgba(212,175,55,' + (a * 0.12) + ')');
      g.addColorStop(1, 'rgba(212,175,55,0)');
      c.fillStyle = g;
      c.save();
      c.translate(f.cx, f.cy);
      c.rotate(f.rot);
      c.scale(1, f.ry / f.rx);
      c.beginPath();
      c.arc(0, 0, rx * 1.38, 0, Math.PI * 2);
      c.fill();
      c.restore();
      if (f.guideSuccess > 0.01) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = f.guideSuccess * 0.72;
        c.strokeStyle = 'rgba(255,245,188,0.95)';
        c.lineWidth = Math.max(2, f.rx * 0.032);
        c.beginPath();
        c.ellipse(f.cx, f.cy, rx * (1.12 + (1 - f.guideSuccess) * 0.18), ry * (1.12 + (1 - f.guideSuccess) * 0.18), f.rot, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
      c.globalAlpha = Math.min(1, f.guide * 0.95);
      c.strokeStyle = 'rgba(255,221,112,' + (0.35 + f.guide * 0.45) + ')';
      c.lineWidth = Math.max(1.4, f.rx * 0.025);
      c.beginPath();
      c.ellipse(f.cx, f.cy, rx, ry, f.rot, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.restore();
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
    drawGuideFields(c, time, scale);
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
  var lastPointerDown = {time: 0, noteIndex: -1};
  var TWO_FINGER_WINDOW = 110;

  function haptic(kind) {
    if (!COARSE || !navigator.vibrate || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    try {
      navigator.vibrate(kind === 'accent' ? [4, 8, 4] : 5);
    } catch (e) {}
  }

  function getImpact(px, py, field) {
    var dx = px - field.cx, dy = py - field.cy;
    var along = dx * field.ux + dy * field.uy;
    var across = dx * (-field.uy) + dy * field.ux;
    var nx = along / Math.max(1, field.rx);
    var ny = across / Math.max(1, field.ry);
    var d = Math.sqrt(nx * nx + ny * ny);
    return {
      x: nx,
      y: ny,
      distance: Math.min(1, d),
      center: Math.max(0, Math.min(1, 1 - d))
    };
  }

  function touchVelocity(state, px, py, now) {
    var dx = px - state.lastX, dy = py - state.lastY;
    var dt = Math.max(4, now - state.lastTime);
    var speed = Math.sqrt(dx * dx + dy * dy) / dt;
    return Math.max(0.22, Math.min(1, 0.30 + speed * 0.68));
  }

  function strikeNote(idx, vel, impact) {
    if (idx < 0 || idx >= NOTES.length) return;
    var finalVel = vel || 0.8;
    if (impact && impact.center !== undefined) finalVel *= (0.72 + impact.center * 0.28);
    engine.strike(idx, finalVel);
    try { window.dispatchEvent(new CustomEvent('handpan:note', { detail: { noteIndex: idx, velocity: finalVel, impact: impact || null } })); } catch (err) {}
    if (fields[idx]) {
      fields[idx].glow = 1;
      if (fields[idx].guideTarget > 0.5) fields[idx].guideSuccess = 1;
      addRipple(fields[idx].cx, fields[idx].cy, finalVel);
      addBurst(fields[idx].cx, fields[idx].cy, finalVel, true);
      haptic(finalVel > 0.82 ? 'accent' : 'hit');
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
    pointerMap.forEach(function (state) {
      if (state && state.dampingTimer) clearInterval(state.dampingTimer);
      releaseNote(state.noteIndex !== undefined ? state.noteIndex : state);
    });
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
    e.preventDefault();
    engine.ensure();
    var rect = canvas.getBoundingClientRect();
    var px = e.clientX - rect.left, py = e.clientY - rect.top;
    var idx = hitTest(px, py, e.pointerType || 'mouse');
    if (idx < 0) return;
    var now = performance.now();
    var impact = getImpact(px, py, fields[idx]);
    var state = {
      pointerId: e.pointerId,
      noteIndex: idx,
      startX: px, startY: py,
      lastX: px, lastY: py,
      startTime: now, lastTime: now,
      velocity: e.pointerType === 'touch' ? 0.72 : 0.68,
      dampingTimer: null,
      dampingStarted: false
    };
    pointerMap.set(e.pointerId, state);
    if (fields[idx]) fields[idx].held = 1;
    var wasTwoFinger = pointerMap.size > 0 &&
      (now - lastPointerDown.time <= TWO_FINGER_WINDOW) &&
      lastPointerDown.noteIndex >= 0 &&
      lastPointerDown.noteIndex !== idx;
    strikeNote(idx, wasTwoFinger ? Math.min(1, state.velocity + 0.12) : state.velocity, impact);
    if (wasTwoFinger) haptic('accent');
    lastPointerDown = {time: now, noteIndex: idx};
    state.dampingTimer = setInterval(function () {
      if (!pointerMap.has(e.pointerId) || state.noteIndex !== idx) {
        clearInterval(state.dampingTimer);
        return;
      }
      state.dampingStarted = true;
      if (engine.damp) engine.damp(idx, 0.9);
    }, 105);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }

  function pointerMove(e) {
    var state = pointerMap.get(e.pointerId);
    if (!state) return;
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var px = e.clientX - rect.left, py = e.clientY - rect.top;
    var now = performance.now();
    var velocity = touchVelocity(state, px, py, now);
    var next = hitTest(px, py, e.pointerType || 'touch');
    state.lastX = px; state.lastY = py; state.lastTime = now;
    state.velocity = velocity;
    if (next < 0 || next === state.noteIndex) return;
    clearInterval(state.dampingTimer);
    var previous = state.noteIndex;
    releaseNote(previous);
    state.noteIndex = next;
    if (fields[next]) fields[next].held = 1;
    strikeNote(next, velocity, getImpact(px, py, fields[next]));
    state.dampingTimer = setInterval(function () {
      if (!pointerMap.has(e.pointerId) || state.noteIndex !== next) {
        clearInterval(state.dampingTimer);
        return;
      }
      state.dampingStarted = true;
      if (engine.damp) engine.damp(next, 0.9);
    }, 105);
  }

  function pointerUp(e) {
    var state = pointerMap.get(e.pointerId);
    if (!state) return;
    clearInterval(state.dampingTimer);
    pointerMap.delete(e.pointerId);
    releaseNote(state.noteIndex);
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  }

  canvas.addEventListener('pointerdown', pointerDown, { passive: false });
  canvas.addEventListener('pointermove', pointerMove, { passive: false });
  canvas.addEventListener('pointerup', pointerUp, { passive: false });
  canvas.addEventListener('pointercancel', pointerUp, { passive: false });
  // Pointer capture keeps a swipe/glissando alive even when the finger crosses
  // the canvas edge; release is owned by pointerup/pointercancel instead.

  canvas.style.touchAction = 'none';
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('dblclick', function (e) { e.preventDefault(); });
  document.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

  function goScale(delta) { applyScale(scaleIndex + delta, delta); }

  (function initScalePicker() {
    var trigger = document.getElementById('hpScaleMenuToggle');
    var sheet = document.getElementById('hpScaleSheet');
    var closeBtn = document.getElementById('hpScaleSheetClose');
    var backdrop = document.getElementById('hpScaleSheetBackdrop');
    var list = document.getElementById('hpScaleList');

    function closePicker(){
      if(!sheet) return;
      sheet.hidden = true;
      if(trigger) trigger.setAttribute('aria-expanded','false');
    }
    function openPicker(){
      if(!sheet) return;
      sheet.hidden = false;
      if(trigger) trigger.setAttribute('aria-expanded','true');
      var active = sheet.querySelector('.hp-scale-option.is-active');
      if(active && active.scrollIntoView) active.scrollIntoView({block:'nearest'});
    }
    function refreshList(){
      if(!list) return;
      list.innerHTML = '';
      SCALES.forEach(function(scale,i){
        var b=document.createElement('button');
        b.type='button';
        b.className='hp-scale-option'+(i===scaleIndex?' is-active':'');
        b.setAttribute('aria-pressed',String(i===scaleIndex));
        var title=document.createElement('strong');
        title.textContent=scale.label;
        var meta=document.createElement('small');
        meta.textContent='Ding '+scale.ding+' · 13 notes';
        b.appendChild(title); b.appendChild(meta);
        b.addEventListener('click',function(){
          applyScale(i, i===scaleIndex ? 0 : (i>scaleIndex ? 1 : -1));
          refreshList();
          closePicker();
        });
        list.appendChild(b);
      });
    }
    if(trigger) trigger.addEventListener('click',function(e){
      e.preventDefault(); e.stopPropagation();
      if(sheet && !sheet.hidden) closePicker(); else openPicker();
    });
    if(closeBtn) closeBtn.addEventListener('click',closePicker);
    if(backdrop) backdrop.addEventListener('click',closePicker);
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape') closePicker();
    });
    refreshList();
    applyScale(0,0);
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
      var guideRate = fields[i].guideTarget > fields[i].guide ? 1.15 : 3.2;
      fields[i].guide += (fields[i].guideTarget - fields[i].guide) * Math.min(1, dt * guideRate);
      if (Math.abs(fields[i].guide - fields[i].guideTarget) < 0.002) fields[i].guide = fields[i].guideTarget;
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

  window.HandpanGame = {
    notes: NOTES,
    scales: SCALES,
    scaleIndex: function () { return scaleIndex; },
    setScale: applyScale,
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
