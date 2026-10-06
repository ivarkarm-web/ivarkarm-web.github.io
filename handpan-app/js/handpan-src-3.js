export default `onvolver.buffer = makeImpulse(ctx, 2.8, 3.2);
    var send = ctx.createGain(); send.gain.value = 0.34;
    var wet = ctx.createGain(); wet.gain.value = 0.9;
    this.bus.connect(comp); comp.connect(this.master); comp.connect(send);
    send.connect(convolver); convolver.connect(wet); wet.connect(this.master);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256; this.analyser.smoothingTimeConstant = 0.82;
    this.analyserData = new Uint8Array(this.analyser.fftSize);
    this.master.connect(this.analyser); this.master.connect(getAudioMaster());
    this.sampleBank = new SampleBank(ctx, this.bus);
    this.sampleBank.loadManifest();
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
    (voice.oscs || []).forEach(function (o) { try { o.stop(stopAt); } catch (e) {} });
    if (voice.source) { try { voice.source.stop(stopAt); } catch (e) {} }
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

  var EXPERIMENTS = VOICE_PRESETS;
  var instrumentIndex=0;
  HandpanEngine.prototype.setInstrument=function(i){instrumentIndex=resolveVoiceIndex(i);return EXPERIMENTS[instrumentIndex];};
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
    var sampleKey = preset.id + ':' + note.name;
    if`;
