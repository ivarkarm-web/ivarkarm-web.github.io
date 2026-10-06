export default ` (this.sampleBank) {
      if (this.sampleBank.has(sampleKey, vel)) {
        var sampled = this.sampleBank.play(sampleKey, t, vel);
        if (sampled) {
          var sampleVoice = { idx: idx, out: sampled.gain, source: sampled.source, pan: null, oscs: [], released: false, born: ctx.currentTime, ringUntil: ctx.currentTime + Math.min(sampled.source.buffer.duration, 3.2) };
          var sampleSelf = this;
          sampled.source.onended = function () { sampleSelf._cleanup(sampleVoice); };
          this.voices.push(sampleVoice);
          this.active.set(idx, sampleVoice);
          return sampleVoice;
        }
      } else {
        this.sampleBank.load(sampleKey, vel).catch(function () {});
      }
    }
    var partials = preset.partials.map(function(ratio,i){
      var gains = [0.5,0.32,0.18,0.095,0.045];
      return {r:ratio,g:gains[i]||0.03,dec:T0*(preset.decay/6.2)*(1-i*0.07),det:(i%2?-1:1)*preset.spread*(i>1?0.65:1)};
    });
    for (var i = 0; i < partials.length; i++) {
      var p = partials[i];
      var osc = ctx.createOscillator(); osc.type = preset.wave || 'sine';
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
    bp.frequency.value = Math.min(f * preset.noiseRatio, 6200); bp.Q.value = preset.noiseQ;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(preset.noiseLevel * vel, t + 0.0015);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + preset.noiseDecay);
    src.connect(bp); bp.connect(ng); ng.connect(out);
    src.start(t); src.stop(t + preset.noiseDecay + 0.02);
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
    try { closeAudio(); } catch (e) {}
    this.ctx = null;
  };

  var engine = new HandpanEngine();

  var canvas = document.getElementById('hpStage');
  var ctx2 = canvas.getContext('2d');
  var headEl = document.getElementById('hpHead');
  var footEl = document.getElementById('hpFoot');
  var chordEl = document.getElementById('hpChord');

  var W = 0, H = 0,`;
