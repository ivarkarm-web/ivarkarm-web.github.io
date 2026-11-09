/**
 * drum-voices.js — shared drum synthesis for TonePad and (future) handpan percussion.
 * Pure synthesis, no samples. Exports kit data + trigger/createDrumEngine.
 */
export const DRUM_VOICES = ['kick', 'snare', 'clap', 'ch', 'oh', 'lowtom', 'hightom', 'rim'];
export const DRUM_KIT_LIST = [
  { id: 'classic', name: 'Classic' },
  { id: 'deep', name: 'Deep' },
  { id: 'punchy', name: 'Punchy' },
  { id: 'lofi', name: 'Lo-fi' },
  { id: 'industrial', name: 'Industrial' },
  { id: 'tribal', name: 'Tribal' },
];
export const DRUM_KIT_IDS = new Set(DRUM_KIT_LIST.map((k) => k.id));
export const DEFAULT_DRUM_KIT = 'classic';
// Kit params (Classic preserved in character; quality changes allowed in stage 2).
export const KITS = {
  classic: { kick:{base:52,sweep:3.2,sweepEnd:52,sweepT:0.06,peak:0.95,dur:0.42,sub:{f0:90,f1:42,sweepT:0.07,peak:0.35,dur:0.22}}, snare:{dur:0.22,peak:0.55,bp:1800,bpQ:0.7,hp:700,body:220,bodyEnd:160,bodyDur:0.11,bodyPeak:0.45}, clap:{dur:0.24,peak:0.38,bp:1400}, ch:{dur:0.055,peak:0.22,hp:6500,bp:9500}, oh:{dur:0.42,peak:0.18,hp:5200,bp:9500}, lowtom:{base:110,sweep:2.1,sweepEnd:110,sweepT:0.09,peak:0.55,dur:0.32}, hightom:{base:165,sweep:2.1,sweepEnd:165,sweepT:0.09,peak:0.55,dur:0.32}, rim:{dur:0.045,peak:0.28,bp:1800,bpQ:5}, perc:{dur:0.09,peak:0.2,bp:3200,bpQ:2.2} },
  deep:    { kick:{base:42,sweep:2.6,sweepEnd:38,sweepT:0.09,peak:1.0,dur:0.62,sub:{f0:70,f1:34,sweepT:0.11,peak:0.42,dur:0.34},lp:220}, snare:{dur:0.26,peak:0.45,bp:1500,bpQ:0.6,hp:500,body:180,bodyEnd:130,bodyDur:0.14,bodyPeak:0.4}, clap:{dur:0.22,peak:0.3,bp:1200}, ch:{dur:0.075,peak:0.16,hp:5200,bp:8000}, oh:{dur:0.55,peak:0.14,hp:4200,bp:7800}, lowtom:{base:92,sweep:1.9,sweepEnd:88,sweepT:0.11,peak:0.6,dur:0.42}, hightom:{base:140,sweep:1.9,sweepEnd:132,sweepT:0.1,peak:0.55,dur:0.38}, rim:{dur:0.055,peak:0.22,bp:1500,bpQ:3.5}, perc:{dur:0.11,peak:0.17,bp:2600,bpQ:1.8} },
  punchy:  { kick:{base:58,sweep:4.2,sweepEnd:55,sweepT:0.035,peak:1.05,dur:0.24,sub:{f0:110,f1:50,sweepT:0.04,peak:0.28,dur:0.12}}, snare:{dur:0.16,peak:0.62,bp:2100,bpQ:0.9,hp:900,body:240,bodyEnd:190,bodyDur:0.07,bodyPeak:0.55}, clap:{dur:0.18,peak:0.42,bp:1700}, ch:{dur:0.038,peak:0.24,hp:7000,bp:10500}, oh:{dur:0.28,peak:0.17,hp:5800,bp:10000}, lowtom:{base:120,sweep:2.4,sweepEnd:115,sweepT:0.06,peak:0.58,dur:0.22}, hightom:{base:180,sweep:2.4,sweepEnd:172,sweepT:0.055,peak:0.58,dur:0.2}, rim:{dur:0.035,peak:0.32,bp:2200,bpQ:6}, perc:{dur:0.06,peak:0.22,bp:3800,bpQ:2.6} },
  lofi:    { drive:0.9, kick:{base:50,sweep:2.8,sweepEnd:48,sweepT:0.07,peak:0.85,dur:0.3,sub:{f0:80,f1:40,sweepT:0.08,peak:0.3,dur:0.16},lp:180}, snare:{dur:0.15,peak:0.46,bp:1400,bpQ:0.5,hp:600,body:190,bodyEnd:140,bodyDur:0.08,bodyPeak:0.35,lp:3200}, clap:{dur:0.16,peak:0.3,bp:1100,lp:2800}, ch:{dur:0.04,peak:0.17,hp:5500,bp:7500,lp:7000}, oh:{dur:0.26,peak:0.13,hp:4500,bp:7000,lp:6500}, lowtom:{base:105,sweep:1.8,sweepEnd:100,sweepT:0.08,peak:0.48,dur:0.24,lp:900}, hightom:{base:155,sweep:1.8,sweepEnd:148,sweepT:0.075,peak:0.48,dur:0.22,lp:1100}, rim:{dur:0.04,peak:0.22,bp:1400,bpQ:3,lp:2600}, perc:{dur:0.07,peak:0.16,bp:2400,bpQ:1.5,lp:3200} },
  industrial:{ drive:1.6, kick:{base:55,sweep:3.8,sweepEnd:48,sweepT:0.05,peak:1.1,dur:0.34,sub:{f0:95,f1:44,sweepT:0.06,peak:0.38,dur:0.18},type:'triangle'}, snare:{dur:0.2,peak:0.58,bp:2300,bpQ:1.1,hp:1000,body:260,bodyEnd:170,bodyDur:0.09,bodyPeak:0.5}, clap:{dur:0.2,peak:0.4,bp:1900,bpQ:1.0}, ch:{dur:0.045,peak:0.26,hp:7500,bp:11000,bpQ:1.8}, oh:{dur:0.34,peak:0.2,hp:6200,bp:10500,bpQ:1.6}, lowtom:{base:115,sweep:2.3,sweepEnd:105,sweepT:0.07,peak:0.6,dur:0.28,type:'triangle'}, hightom:{base:175,sweep:2.3,sweepEnd:160,sweepT:0.065,peak:0.6,dur:0.26,type:'triangle'}, rim:{dur:0.04,peak:0.34,bp:2400,bpQ:7}, perc:{dur:0.08,peak:0.24,bp:4200,bpQ:3.2} },
  tribal:  { kick:{base:48,sweep:2.4,sweepEnd:44,sweepT:0.1,peak:0.88,dur:0.5,sub:{f0:75,f1:38,sweepT:0.12,peak:0.4,dur:0.28}}, snare:{dur:0.18,peak:0.4,bp:1300,bpQ:0.5,hp:450,body:170,bodyEnd:125,bodyDur:0.12,bodyPeak:0.38}, clap:{dur:0.2,peak:0.28,bp:1000}, ch:{dur:0.065,peak:0.15,hp:5000,bp:7200}, oh:{dur:0.36,peak:0.13,hp:4000,bp:6800}, lowtom:{base:95,sweep:1.7,sweepEnd:82,sweepT:0.13,peak:0.72,dur:0.46}, hightom:{base:145,sweep:1.7,sweepEnd:128,sweepT:0.12,peak:0.68,dur:0.4}, rim:{dur:0.07,peak:0.3,bp:1200,bpQ:2.5}, perc:{dur:0.12,peak:0.18,bp:2200,bpQ:1.2} },
};
export function getKit(id) { return KITS[DRUM_KIT_IDS.has(id) ? id : DEFAULT_DRUM_KIT] || KITS.classic; }

const clamp01 = (v, fb) => (Number.isFinite(+v) ? Math.max(0, Math.min(1, +v)) : fb);
// Keep knob mapping identical to TonePad (ranges/behavior must not change)
export const fxTuneMul = (v) => Math.pow(2, (clamp01(v, 0.5) - 0.5) * 1.0);
export const fxDecayMul = (v) => Math.pow(2, (clamp01(v, 0.5) - 0.5) * 2.64);

function fadeToZero(g, t0, dur) {
  const d = Math.max(0.008, dur); // >=8ms on forced/any fade stop
  try {
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  } catch (_) { try { g.gain.setValueAtTime(0.0001, t0 + d); } catch (_) {} }
}
function stopSrc(src, t) { try { src.stop(Math.max(0, t)); } catch (_) {} }

export function createDrumEngine() {
  let drumNoiseBuf = null, drumNoiseCtx = null;
  let activeDrumVoices = 0;
  const DRUM_VOICE_CAP = 24;
  let openHatChokes = [];
  const _driveCurves = {};
  let drumBus = null, drumBusCtx = null, drumBusDest = null;

  function getDrumNoise(ctx) {
    if (drumNoiseBuf && drumNoiseCtx === ctx) return drumNoiseBuf;
    const len = Math.max(1, Math.floor(ctx.sampleRate * 1.0));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; // stage 1: preserve behavior
    drumNoiseBuf = buf; drumNoiseCtx = ctx; return buf;
  }
  function ensureDrumBus(ctx, dest) {
    if (drumBus && drumBusCtx === ctx && drumBusDest === dest) return drumBus.input;
    try {
      // mild glue (2.5:1) + soft ceiling to prevent clips/pump vs master
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 2.5; comp.attack.value = 0.01; comp.release.value = 0.12;
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -8; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.06;
      comp.connect(lim); lim.connect(dest);
      drumBus = { input: comp, comp, lim }; drumBusCtx = ctx; drumBusDest = dest;
      return comp;
    } catch (_) { return dest; }
  }
  function driveCurve(amount) {
    const k = Math.max(0, Math.min(40, Math.round(amount * 10) / 10));
    if (_driveCurves[k]) return _driveCurves[k];
    const n = 1024, c = new Float32Array(n);
    const a = 1 + k * 4;
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(a * x) / Math.tanh(a || 1); }
    _driveCurves[k] = c; return c;
  }
  function maybeDrive(ctx, dest, nodes, amount) {
    if (!(amount > 0)) return dest;
    const ws = ctx.createWaveShaper(); ws.curve = driveCurve(amount); ws.oversample = '2x';
    ws.connect(dest); nodes.push(ws); return ws;
  }
  function drumTrack(nodes, src, life, onDone) {
    activeDrumVoices += 1;
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      activeDrumVoices = Math.max(0, activeDrumVoices - 1);
      try { nodes.forEach((n) => { try { n.disconnect(); } catch (_) {} }); } catch (_) {}
      if (typeof onDone === 'function') try { onDone(); } catch (_) {}
    };
    try { src.onended = finish; } catch (_) {}
    try { setTimeout(finish, Math.max(50, Math.ceil((life + 0.2) * 1000))); } catch (_) {}
  }
  function chokeOpenHats(t0) {
    const list = openHatChokes.slice();
    openHatChokes = [];
    list.forEach((ch) => {
      try {
        fadeToZero(ch.g, t0, 0.02); // >=8ms fade; stop after fade completes
        stopSrc(ch.src, t0 + 0.03);
      } catch (_) {}
    });
  }

  function triggerDrum(ctx, { row, when, vel, kit, tune = 0.5, decay = 0.5, drive = 0, space = 0, dest, tapSend }) {
    if (!ctx || !dest) return 0;
    if (activeDrumVoices >= DRUM_VOICE_CAP) return 0;
    const t0 = Math.max(ctx.currentTime + 0.003, when);
    const v = Math.max(0.05, Math.min(1, vel == null ? 0.6 : vel));
    const voice = DRUM_VOICES[Math.max(0, Math.min(DRUM_VOICES.length - 1, row))] || 'kick';
    const kitDef = kit || KITS.classic;
    const tm = fxTuneMul(tune), dm = fxDecayMul(decay);
    const effDrive = (kitDef.drive || 0) + clamp01(drive, 0) * 2.0;
    const drumDest = ensureDrumBus(ctx, dest);
    const out = ctx.createGain();
    const post = maybeDrive(ctx, drumDest, [out], effDrive);
    out.connect(post);
    const nodes = [out];
    if (post !== drumDest) nodes.push(post);

    const addLP = (chainIn, freq) => {
      if (!(freq > 0)) return chainIn;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(freq, t0); lp.Q.setValueAtTime(0.5, t0);
      chainIn.connect(lp); nodes.push(lp); return lp;
    };
    let voiceDur = 0.2;

    if (voice === 'kick' || voice === 'lowtom' || voice === 'hightom') {
      const p = kitDef[voice] || KITS.classic[voice];
      // preserve original behavior: voiceDur (tapSend timing) stays at default 0.2 for kick/toms
      const base = p.base * tm, peak = p.peak * (0.5 + v * 0.7), dur = p.dur * dm;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = p.type || 'sine';
      osc.frequency.setValueAtTime(base * p.sweep, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, p.sweepEnd * tm), t0 + p.sweepT * dm);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      const tail = addLP(g, p.lp);
      osc.connect(g); tail.connect(out); nodes.push(osc, g);
      if (p.sub) {
        const s = p.sub; const sd = s.dur * dm;
        const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
        o2.type = 'triangle'; o2.frequency.setValueAtTime(s.f0 * tm, t0);
        o2.frequency.exponentialRampToValueAtTime(Math.max(20, s.f1 * tm), t0 + s.sweepT * dm);
        g2.gain.setValueAtTime(0.0001, t0); g2.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * s.peak), t0 + 0.005);
        g2.gain.exponentialRampToValueAtTime(0.0001, t0 + sd);
        const t2 = addLP(g2, p.lp);
        o2.connect(g2); t2.connect(out); nodes.push(o2, g2);
        o2.start(t0); stopSrc(o2, t0 + sd + 0.02);
      }
      osc.start(t0); stopSrc(osc, t0 + dur + 0.02);
      drumTrack(nodes, osc, dur);
    } else if (voice === 'snare') {
      const p = kitDef.snare || KITS.classic.snare;
      const dur = voiceDur = p.dur * dm, bodyDur = p.bodyDur * dm, peak = p.peak * (0.45 + v * 0.7);
      const nsrc = ctx.createBufferSource(); nsrc.buffer = getDrumNoise(ctx);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(p.bp * tm, t0); bp.Q.setValueAtTime(p.bpQ, t0);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime(p.hp * tm, t0);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t0); ng.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.003);
      ng.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.25), t0 + 0.04); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      nsrc.connect(hp); hp.connect(bp); bp.connect(ng); addLP(ng, p.lp).connect(out);
      const osc = ctx.createOscillator(); const og = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.setValueAtTime(p.body * tm, t0); osc.frequency.exponentialRampToValueAtTime(Math.max(20, p.bodyEnd * tm), t0 + 0.06 * dm);
      og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * p.bodyPeak), t0 + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + bodyDur);
      osc.connect(og); og.connect(out);
      nodes.push(nsrc, bp, hp, ng, osc, og);
      nsrc.start(t0); stopSrc(nsrc, t0 + dur + 0.02); osc.start(t0); stopSrc(osc, t0 + bodyDur + 0.02);
      drumTrack(nodes, nsrc, dur);
    } else if (voice === 'ch' || voice === 'oh') {
      if (voice === 'ch') chokeOpenHats(t0);
      const p = kitDef[voice] || KITS.classic[voice];
      const dur = voiceDur = p.dur * dm, peak = p.peak * (0.45 + v * 0.7);
      const nsrc = ctx.createBufferSource(); nsrc.buffer = getDrumNoise(ctx);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime(p.hp * tm, t0);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(p.bp * tm, t0); bp.Q.setValueAtTime(p.bpQ || 0.9, t0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      nsrc.connect(hp); hp.connect(bp); bp.connect(g); addLP(g, p.lp).connect(out);
      nodes.push(nsrc, hp, bp, g);
      nsrc.start(t0); stopSrc(nsrc, t0 + dur + 0.02);
      if (voice === 'oh') {
        const entry = { g, src: nsrc };
        openHatChokes.push(entry);
        drumTrack(nodes, nsrc, dur, () => { openHatChokes = openHatChokes.filter((x) => x !== entry); });
      } else {
        drumTrack(nodes, nsrc, dur);
      }
    } else if (voice === 'clap') {
      const p = kitDef.clap || KITS.classic.clap;
      const dur = voiceDur = p.dur * dm, peak = p.peak * (0.45 + v * 0.7);
      let lastSrc = null;
      [0, 0.011, 0.023].forEach((off, k) => {
        const nsrc = ctx.createBufferSource(); nsrc.buffer = getDrumNoise(ctx);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(p.bp * tm + k * 120, t0 + off); bp.Q.setValueAtTime(p.bpQ || 0.8, t0 + off);
        const g = ctx.createGain();
        const segDur = (k === 2 ? dur : 0.03);
        g.gain.setValueAtTime(0.0001, t0 + off); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * (k === 2 ? 1 : 0.65)), t0 + off + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + segDur);
        nsrc.connect(bp); bp.connect(g); addLP(g, p.lp).connect(out); nodes.push(nsrc, bp, g);
        nsrc.start(t0 + off); stopSrc(nsrc, t0 + off + segDur + 0.01); lastSrc = nsrc;
      });
      drumTrack(nodes, lastSrc, dur);
    } else if (voice === 'rim' || voice === 'perc') {
      const p = kitDef[voice] || KITS.classic[voice] || KITS.classic.rim;
      const dur = voiceDur = p.dur * dm, peak = p.peak * (0.45 + v * 0.7);
      const nsrc = ctx.createBufferSource(); nsrc.buffer = getDrumNoise(ctx);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.setValueAtTime(p.bp * tm, t0); bp.Q.setValueAtTime(p.bpQ, t0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      nsrc.connect(bp); bp.connect(g); addLP(g, p.lp).connect(out); nodes.push(nsrc, bp, g);
      nsrc.start(t0); stopSrc(nsrc, t0 + dur + 0.02);
      drumTrack(nodes, nsrc, dur);
    } else {
      const dur = voiceDur = 0.08;
      const nsrc = ctx.createBufferSource(); nsrc.buffer = getDrumNoise(ctx);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.2 * v, t0 + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      nsrc.connect(g); g.connect(out); nodes.push(nsrc, g);
      nsrc.start(t0); stopSrc(nsrc, t0 + dur + 0.02);
      drumTrack(nodes, nsrc, dur);
    }
    if (tapSend && space > 0.001) tapSend(out, 'rev', clamp01(space, 0) * 0.7, nodes, t0 + voiceDur + 0.25);
    return voiceDur;
  }

  return { triggerDrum, get activeVoices() { return activeDrumVoices; }, DRUM_VOICE_CAP };
}
