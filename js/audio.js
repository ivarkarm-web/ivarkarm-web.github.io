// ============================================================================
// RESONANCE AUDIO ENGINE — Procedural Physical Modeling & Soundscapes
// Handpan in D Celtic Minor / Kurd: D3, A3, Bb3, C4, D4, E4, F4, G4, A4, C5
// Modeled with fundamental, octave, and compound fifth harmonic overtones
// ============================================================================

const ResonanceAudio = {

  ctx: null,
  masterGain: null,
  ambientGain: null,
  isMuted: false,
  initialized: false,
  scale: [
    { name: 'D3', freq: 146.83, pan: 0 },       // Ding fundamental
    { name: 'A3', freq: 220.00, pan: -0.35 },   // Note 1
    { name: 'Bb3', freq: 233.08, pan: 0.35 },   // Note 2
    { name: 'C4', freq: 261.63, pan: -0.6 },    // Note 3
    { name: 'D4', freq: 293.66, pan: 0.6 },     // Note 4
    { name: 'E4', freq: 329.63, pan: -0.4 },    // Note 5
    { name: 'F4', freq: 349.23, pan: 0.4 },     // Note 6
    { name: 'G4', freq: 392.00, pan: -0.2 },    // Note 7
    { name: 'A4', freq: 440.00, pan: 0.2 },     // Note 8
    { name: 'C5', freq: 523.25, pan: 0 }        // High overtone
  ],
  rollingGain: null,
  rollingFilter: null,
  ambientFilter: null,
  lastNoteTime: 0,

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.20, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      this.setupRollingSound();
      this.setupAmbientSoundscape();
      this.initialized = true;
      this.isMuted = localStorage.getItem('ivar_resonance_muted') === 'true';
      if (this.isMuted) this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.updateUIIcon();
    } catch (e) {
      console.warn('Web Audio not available:', e);
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  },

  toggleMute() {
    if (!this.initialized) this.init();
    this.resume();
    this.isMuted = !this.isMuted;
    try { localStorage.setItem('ivar_resonance_muted', this.isMuted ? 'true' : 'false'); } catch (_) {}

    // 1. Procedural master gain
    if (this.masterGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.7, now + 0.08);
      } catch (_) {}
    }

    // 2. Audio orb playback
    if (typeof currentAudio !== 'undefined' && currentAudio) {
      try { currentAudio.muted = this.isMuted; } catch (_) {}
    }

    // 3. Album music player
    if (typeof musicPlayer !== 'undefined' && musicPlayer.audio) {
      try { musicPlayer.audio.muted = this.isMuted; } catch (_) {}
    }

    // 4. Rabbit Hole preview audio
    if (typeof rhScrollManager !== 'undefined' && rhScrollManager.activePreviewAudio) {
      try { rhScrollManager.activePreviewAudio.muted = this.isMuted; } catch (_) {}
    }

    this.updateUIIcon();
    return this.isMuted;
  },

  updateUIIcon() {
    const btn = document.getElementById('audioToggleBtn');
    if (!btn) return;
    const onIcon = btn.querySelector('.icon-sound-on');
    const offIcon = btn.querySelector('.icon-sound-off');
    if (onIcon) onIcon.style.display = this.isMuted ? 'none' : 'block';
    if (offIcon) offIcon.style.display = this.isMuted ? 'block' : 'none';
    const label = btn.querySelector('.nav-btn-label');
    if (label) label.textContent = this.isMuted ? 'Muted' : 'Acoustic';
    btn.setAttribute('aria-pressed', this.isMuted ? 'true' : 'false');
    btn.classList.toggle('is-muted', this.isMuted);
    btn.classList.toggle('active', !this.isMuted);
  },

  // Physical model of a single handpan tone field strike
  playTone(index = 0, velocity = 0.5, customOptions = {}) {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const note = this.scale[index % this.scale.length];
    const now = this.ctx.currentTime;
    const freq = note.freq * (customOptions.octaveOffset ? Math.pow(2, customOptions.octaveOffset) : 1);
    const duration = customOptions.duration || (1.6 + velocity * 1.6);
    const strikeVol = Math.max(0.04, Math.min(0.65, velocity * 0.48));

    let output = this.masterGain;
    if (this.ctx.createStereoPanner) {
      const panNode = this.ctx.createStereoPanner();
      panNode.pan.setValueAtTime(note.pan, now);
      panNode.connect(this.masterGain);
      output = panNode;
    }

    // 1. Fundamental
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);
    osc1.frequency.exponentialRampToValueAtTime(freq * 0.998, now + 0.12);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(strikeVol, now + 0.005);
    gain1.gain.exponentialRampToValueAtTime(strikeVol * 0.42, now + 0.3);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.connect(gain1);
    gain1.connect(output);
    osc1.start(now);
    osc1.stop(now + duration);

    // 2. Octave overtone (2x)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);
    const vol2 = strikeVol * 0.45;
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(vol2, now + 0.004);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.65);
    osc2.connect(gain2);
    gain2.connect(output);
    osc2.start(now);
    osc2.stop(now + duration * 0.65);

    // 3. Compound fifth overtone (3x)
    const osc3 = this.ctx.createOscillator();
    const gain3 = this.ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 3, now);
    const vol3 = strikeVol * 0.22;
    gain3.gain.setValueAtTime(0, now);
    gain3.gain.linearRampToValueAtTime(vol3, now + 0.003);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.4);
    osc3.connect(gain3);
    gain3.connect(output);
    osc3.start(now);
    osc3.stop(now + duration * 0.4);

    // 4. Soft transient strike click
    this.playStrikeNoise(now, output, strikeVol);
    this.lastNoteTime = performance.now();
  },

  playStrikeNoise(now, output, vol) {
    if (!this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.02);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const outputData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      outputData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1850, now);
    filter.Q.setValueAtTime(3.0, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(output);
    noise.start(now);
  },

  playImpact(vy) {
    const v = Math.min(1, Math.max(0.1, (Math.abs(vy) - 2.0) / 12));
    this.playTone(0, v, { duration: 2.2 }); // Ding fundamental (D3)
  },

  playJump() {
    this.playTone(4, 0.42, { duration: 1.2 }); // D4 overtone
  },

  playDash() {
    // Ethereal rising chord sweep
    [1, 4, 7].forEach((idx, step) => {
      setTimeout(() => this.playTone(idx, 0.4, { duration: 1.5 }), step * 70);
    });
  },

  setupRollingSound() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(360, this.ctx.currentTime);
    filter.Q.setValueAtTime(3.5, this.ctx.currentTime);

    this.rollingGain = this.ctx.createGain();
    this.rollingGain.gain.setValueAtTime(0, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.rollingGain);
    this.rollingGain.connect(this.masterGain);
    noise.start();
    this.rollingFilter = filter;
  },

  updateRolling(speed, onGround) {
    if (!this.rollingGain || !this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const targetVol = onGround ? Math.min(0.16, (speed / 16) * 0.16) : 0;
    this.rollingGain.gain.setTargetAtTime(targetVol, now, 0.08);
    if (this.rollingFilter) {
      const targetFreq = 280 + Math.min(520, speed * 30);
      this.rollingFilter.frequency.setTargetAtTime(targetFreq, now, 0.1);
    }
  },

  setupAmbientSoundscape() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(73.42, this.ctx.currentTime); // D2 sub drone

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    osc.start();
    this.ambientFilter = filter;
  },

  updateAmbientBiome(biome) {
    if (!this.ambientFilter || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (biome === 'berlin') {
      this.ambientFilter.frequency.setTargetAtTime(130, now, 1.5);
    } else if (biome === 'travel') {
      this.ambientFilter.frequency.setTargetAtTime(210, now, 1.5);
    } else if (biome === 'greece') {
      this.ambientFilter.frequency.setTargetAtTime(270, now, 1.5);
    }
  }
};

// Physics variables
