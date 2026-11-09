/**
 * drum-voices.js — shared drum synthesis for TonePad and (future) handpan percussion.
 * Stage 2: redesigned voices (no samples), pre-rendered metallic hat buffer,
 * pink-ish noise, declick everywhere, normalized levels. Knob FX math/ranges preserved.
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

// Normalization targets (vel 1, post-drum-bus, measured peak dBFS; RMS 100ms considered)
// kick -3, snare -5, clap -6, ch -10, oh -9, lowtom -4, hightom -4.5, rim -9
const TARGET = { kick:-3, snare:-5, clap:-6, ch:-10, oh:-9, lowtom:-4, hightom:-4.5, rim:-9 };
// Kit params: timbre/decay/pitch define character; `peak` calibrated toward TARGET.
export const KITS = {
  classic: {
    kick:{peak:0.7888, base:52, sweepStart:150, sweepEnd:45, sweepT:0.055, dur:0.38, atk:0.002, click:0.22, clickHp:1800, sat:0.15},
    snare:{peak:1.1505, dur:0.20, noiseDur:0.22, b1:185,b2:330, bDrop:0.55, bDur:0.055, bLvl:0.38, bp:1900,bpQ:0.8, hp:750, snap:0.28},
    clap:{peak:1.4804, dur:0.18, bursts:[0,0.010,0.020,0.032], burstDur:0.022, tail:0.14, bp:1500,bpQ:0.9, spread:90},
    ch:{peak:2.737, dur:0.048, rate:1.0, hp:8000, bp:9500, bpQ:0.8},
    oh:{peak:1.6115, dur:0.32, rate:0.95, hp:6500, bp:9000, bpQ:0.8},
    lowtom:{peak:0.6759, base:110, sweep:2.0, sweepEnd:78, sweepT:0.09, dur:0.30, nAtk:0.10},
    hightom:{peak:0.5968, base:165, sweep:2.0, sweepEnd:120, sweepT:0.08, dur:0.26, nAtk:0.09},
    rim:{peak:1.263, dur:0.038, f1:820, f2:1650, click:0.55, noise:0.35, hp:1200, bp:2200, bpQ:3.5},
  },
  deep: {
    drive:0.15,
    kick:{peak:0.9164, base:42, sweepStart:120, sweepEnd:36, sweepT:0.085, dur:0.55, atk:0.002, click:0.16, clickHp:1400, sat:0.12, lp:260},
    snare:{peak:0.4746, dur:0.24, noiseDur:0.28, b1:155,b2:275, bDrop:0.58, bDur:0.075, bLvl:0.40, bp:1500,bpQ:0.7, hp:520, snap:0.22},
    clap:{peak:0.6859, dur:0.20, bursts:[0,0.011,0.022,0.036], burstDur:0.026, tail:0.17, bp:1250,bpQ:0.8, spread:70},
    ch:{peak:0.9169, dur:0.065, rate:0.92, hp:6500, bp:8000, bpQ:0.7},
    oh:{peak:0.5444, dur:0.46, rate:0.88, hp:5200, bp:7500, bpQ:0.7},
    lowtom:{peak:0.3765, base:92, sweep:1.8, sweepEnd:62, sweepT:0.12, dur:0.40, nAtk:0.09},
    hightom:{peak:0.3223, base:140, sweep:1.8, sweepEnd:98, sweepT:0.10, dur:0.34, nAtk:0.08},
    rim:{peak:0.566, dur:0.045, f1:680, f2:1380, click:0.50, noise:0.38, hp:900, bp:1800, bpQ:3.0},
  },
  punchy: {
    kick:{peak:0.7976, base:58, sweepStart:175, sweepEnd:50, sweepT:0.040, dur:0.24, atk:0.002, click:0.30, clickHp:2200, sat:0.18},
    snare:{peak:1.3282, dur:0.15, noiseDur:0.16, b1:210,b2:380, bDrop:0.48, bDur:0.040, bLvl:0.42, bp:2300,bpQ:1.0, hp:950, snap:0.36},
    clap:{peak:1.8953, dur:0.14, bursts:[0,0.009,0.018,0.028], burstDur:0.018, tail:0.10, bp:1850,bpQ:1.0, spread:110},
    ch:{peak:2.6681, dur:0.040, rate:1.08, hp:8500, bp:10500, bpQ:0.9},
    oh:{peak:1.4975, dur:0.26, rate:1.02, hp:7200, bp:10000, bpQ:0.9},
    lowtom:{peak:0.6687, base:120, sweep:2.2, sweepEnd:88, sweepT:0.065, dur:0.22, nAtk:0.11},
    hightom:{peak:0.6109, base:180, sweep:2.2, sweepEnd:135, sweepT:0.058, dur:0.20, nAtk:0.10},
    rim:{peak:1.2402, dur:0.032, f1:950, f2:1950, click:0.60, noise:0.30, hp:1500, bp:2600, bpQ:4.0},
  },
  lofi: {
    drive:0.7,
    kick:{peak:0.9035, base:50, sweepStart:130, sweepEnd:44, sweepT:0.065, dur:0.30, atk:0.003, click:0.12, clickHp:1200, sat:0.22, lp:220},
    snare:{peak:0.3245, dur:0.16, noiseDur:0.17, b1:175,b2:300, bDrop:0.60, bDur:0.060, bLvl:0.34, bp:1400,bpQ:0.6, hp:600, snap:0.18, lp:3600},
    clap:{peak:0.38, dur:0.15, bursts:[0,0.011,0.023,0.035], burstDur:0.020, tail:0.12, bp:1150,bpQ:0.7, spread:60, lp:3200},
    ch:{peak:0.5186, dur:0.042, rate:0.96, hp:6000, bp:7200, bpQ:0.7, lp:8000},
    oh:{peak:0.3145, dur:0.28, rate:0.92, hp:4800, bp:6800, bpQ:0.5, lp:7500},
    lowtom:{peak:0.3437, base:105, sweep:1.8, sweepEnd:76, sweepT:0.085, dur:0.24, nAtk:0.08, lp:1100},
    hightom:{peak:0.2192, base:155, sweep:1.8, sweepEnd:115, sweepT:0.078, dur:0.22, nAtk:0.08, lp:1400},
    rim:{peak:0.2668, dur:0.040, f1:720, f2:1400, click:0.45, noise:0.40, hp:900, bp:1700, bpQ:2.5, lp:3000},
  },
  industrial: {
    drive:1.5,
    kick:{peak:0.8756, base:55, sweepStart:165, sweepEnd:46, sweepT:0.050, dur:0.32, atk:0.002, click:0.32, clickHp:2400, sat:0.35, type:'triangle'},
    snare:{peak:0.2171, dur:0.19, noiseDur:0.21, b1:220,b2:410, bDrop:0.50, bDur:0.050, bLvl:0.28, bp:2400,bpQ:1.2, hp:1050, snap:0.18, grit:0.25},
    clap:{peak:0.18, dur:0.17, bursts:[0,0.009,0.018,0.029], burstDur:0.016, tail:0.1, bp:2000,bpQ:0.8, spread:130},
    ch:{peak:0.3581, dur:0.044, rate:1.12, hp:8500, bp:11200, bpQ:1.1},
    oh:{peak:0.1617, dur:0.34, rate:1.06, hp:7800, bp:10600, bpQ:0.6},
    lowtom:{peak:0.3701, base:115, sweep:2.2, sweepEnd:82, sweepT:0.070, dur:0.27, nAtk:0.12, type:'triangle'},
    hightom:{peak:0.2413, base:175, sweep:2.2, sweepEnd:128, sweepT:0.065, dur:0.25, nAtk:0.11, type:'triangle'},
    rim:{peak:0.1629, dur:0.034, f1:980, f2:2100, click:0.62, noise:0.32, hp:1600, bp:2800, bpQ:4.5},
  },
  tribal: {
    drive:0.1,
    kick:{peak:0.9118, base:48, sweepStart:135, sweepEnd:40, sweepT:0.095, dur:0.48, atk:0.003, click:0.14, clickHp:1300, sat:0.10},
    snare:{peak:0.6964, dur:0.22, noiseDur:0.20, b1:165,b2:280, bDrop:0.62, bDur:0.085, bLvl:0.36, bp:1350,bpQ:0.6, hp:480, snap:0.16},
    clap:{peak:0.8421, dur:0.19, bursts:[0,0.011,0.023,0.037], burstDur:0.024, tail:0.15, bp:1100,bpQ:0.7, spread:65},
    ch:{peak:1.1118, dur:0.060, rate:0.90, hp:5800, bp:7200, bpQ:0.6},
    oh:{peak:0.6793, dur:0.40, rate:0.86, hp:4600, bp:6800, bpQ:0.6},
    lowtom:{peak:0.4204, base:95, sweep:1.7, sweepEnd:65, sweepT:0.13, dur:0.44, nAtk:0.11},
    hightom:{peak:0.3779, base:145, sweep:1.7, sweepEnd:102, sweepT:0.11, dur:0.38, nAtk:0.10},
    rim:{peak:0.5657, dur:0.055, f1:620, f2:1250, click:0.48, noise:0.42, hp:800, bp:1550, bpQ:2.2},
  },
};
export function getKit(id) { return KITS[DRUM_KIT_IDS.has(id) ? id : DEFAULT_DRUM_KIT] || KITS.classic; }

const clamp01 = (v, fb) => (Number.isFinite(+v) ? Math.max(0, Math.min(1, +v)) : fb);
export const fxTuneMul = (v) => Math.pow(2, (clamp01(v, 0.5) - 0.5) * 1.0);
export const fxDecayMul = (v) => Math.pow(2, (clamp01(v, 0.5) - 0.5) * 2.64);

function fadeToZero(g, t0, dur) {
  const d = Math.max(0.008, dur); // >=8ms on any forced stop
  try {
    g.gain.cancelScheduledValues(t0);
    const v0 = (typeof g.gain.value === 'number' && isFinite(g.gain.value)) ? Math.max(0.0001, g.gain.value) : 0.0002;
    g.gain.setValueAtTime(v0, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  } catch (_) { try { g.gain.setValueAtTime(0.0001, t0 + d); } catch (_) {} }
}
function stopSrc(src, t) { try { src.stop(Math.max(0, t)); } catch (_) {} }

export function createDrumEngine() {
  let drumNoiseBuf = null, drumNoiseCtx = null;
  let hatBuf = null, hatCtx = null;
  let activeDrumVoices = 0;
  const DRUM_VOICE_CAP = 24;
  let openHatChokes = [];
  const _driveCurves = {};
  let drumBus = null, drumBusCtx = null, drumBusDest = null;

  function getDrumNoise(ctx) {
    if (drumNoiseBuf && drumNoiseCtx === ctx) return drumNoiseBuf;
    // pink-ish noise via Voss-McCartney approximation (deterministic for reproducible renders/tests)
    const len = Math.max(1, Math.floor(ctx.sampleRate * 1.0));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    // mulberry32 seeded PRNG (fixed seed) — stable buffer per context, deterministic across runs
    let seed = 0x6d2b79f5 >>> 0;
    const rnd = () => { seed += 0x6d2b79f5; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < len; i++) {
      const white = rnd() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    drumNoiseBuf = buf; drumNoiseCtx = ctx; return buf;
  }

  function getHatBuffer(ctx) {
    if (hatBuf && hatCtx === ctx) return hatBuf;
    // pre-render 6-square metallic cluster once/ctx (no live oscs per hit)
    // band-limited additive squares at inharmonic ratios for strong, alias-free HF energy
    const sr = ctx.sampleRate, len = Math.floor(sr * 1.0);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const freqs = [296, 413, 521, 637, 811, 1083]; // inharmonic metallic ratios
    const nyq = sr * 0.48;
    for (let i = 0; i < len; i++) {
      const t = i / sr; let s = 0;
      for (let k = 0; k < freqs.length; k++) {
        const f = freqs[k];
        // odd harmonics of square: (4/pi)*sum sin(2*pi*n*f*t)/n, n odd
        let h = 0, n = 1;
        while (n * f < nyq && n < 64) { h += Math.sin(2 * Math.PI * n * f * t) / n; n += 2; }
        s += h;
      }
      d[i] = s;
    }
    // normalize to ~0.9 peak for healthy headroom
    let pk = 0; for (let i = 0; i < len; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; }
    const sc = pk > 1e-6 ? 0.9 / pk : 1;
    for (let i = 0; i < len; i++) d[i] *= sc;
    hatBuf = buf; hatCtx = ctx; return buf;
  }

  function ensureDrumBus(ctx, dest) {
    if (drumBus && drumBusCtx === ctx && drumBusDest === dest) return drumBus.input;
    try {
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
  function addLP(ctx, chainIn, freq, t0, nodes) {
    if (!(freq > 0)) return chainIn;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(freq, t0); lp.Q.setValueAtTime(0.5, t0);
    chainIn.connect(lp); nodes.push(lp); return lp;
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
    try { setTimeout(finish, Math.max(50, Math.ceil((life + 0.25) * 1000))); } catch (_) {}
  }
  function chokeOpenHats(t0) {
    const list = openHatChokes.slice();
    openHatChokes = [];
    list.forEach((ch) => {
      try { fadeToZero(ch.g, t0, 0.02); stopSrc(ch.src, t0 + 0.035); } catch (_) {}
    });
  }
  function velTimbre(v) { // velocity -> timbre factor (brightness/sweep depth)
    return 0.55 + v * 0.45;
  }

  function triggerDrum(ctx, { row, when, vel, kit, tune = 0.5, decay = 0.5, drive = 0, space = 0, dest, tapSend }) {
    if (!ctx || !dest) return 0;
    if (activeDrumVoices >= DRUM_VOICE_CAP) return 0;
    const t0 = Math.max(ctx.currentTime + 0.003, when);
    const v = Math.max(0.05, Math.min(1, vel == null ? 0.6 : vel));
    const vt = velTimbre(v);
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
    let voiceDur = 0.2;

    if (voice === 'kick') {
      const p = kitDef.kick || KITS.classic.kick;
      const dur = voiceDur = p.dur * dm;
      const swStart = (p.sweepStart || 150) * (0.7 + vt * 0.4) * tm;
      const swEnd = Math.max(25, (p.sweepEnd || 45) * tm);
      const swT = (p.sweepT || 0.055) * dm * (0.85 + vt * 0.2);
      const pk = p.peak * (0.35 + v * 0.75);
      // body
      const osc = ctx.createOscillator(); osc.type = p.type || 'sine';
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(swStart, t0);
      osc.frequency.exponentialRampToValueAtTime(swEnd, t0 + swT);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk), t0 + (p.atk || 0.002));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      // per-kit intrinsic body saturation (subtle) when DRIVE/kit drive is not engaged;
      // click transient stays on a separate path to out so it remains defined.
      // curve is cached (driveCurve); one shaper node added to `nodes` for cleanup.
      let bodyDest = out;
      if ((p.sat || 0) > 0 && effDrive < 0.05) {
        const ws = ctx.createWaveShaper();
        ws.curve = driveCurve(p.sat); ws.oversample = '2x';
        ws.connect(out); nodes.push(ws); bodyDest = ws;
      }
      osc.connect(g); addLP(ctx, g, p.lp, t0, nodes).connect(bodyDest);
      nodes.push(osc, g);
      osc.start(t0); stopSrc(osc, t0 + dur + 0.02);
      // HP click transient (bypasses body saturation to keep transient defined)
      if ((p.click || 0) > 0) {
        const cn = ctx.createBufferSource(); cn.buffer = getDrumNoise(ctx);
        const chp = ctx.createBiquadFilter(); chp.type = 'highpass'; chp.frequency.setValueAtTime((p.clickHp || 1800) * (0.8 + vt * 0.4), t0);
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.0001, t0);
        cg.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk * p.click * vt), t0 + 0.0015);
        cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.012);
        cn.connect(chp); chp.connect(cg); cg.connect(out); nodes.push(cn, chp, cg);
        cn.start(t0); stopSrc(cn, t0 + 0.03);
      }
      drumTrack(nodes, osc, dur);

    } else if (voice === 'snare') {
      const p = kitDef.snare || KITS.classic.snare;
      const dur = voiceDur = Math.max(p.dur, p.noiseDur || 0) * dm;
      const pk = p.peak * (0.35 + v * 0.75);
      // noise (BP+HP), longer decay
      const nd = (p.noiseDur || p.dur) * dm;
      const nsrc = ctx.createBufferSource(); nsrc.buffer = getDrumNoise(ctx);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime((p.hp || 700) * tm * (0.8 + vt * 0.3), t0);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime((p.bp || 1900) * tm * (0.75 + vt * 0.35), t0); bp.Q.setValueAtTime(p.bpQ || 0.8, t0);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk), t0 + 0.0025);
      ng.gain.exponentialRampToValueAtTime(Math.max(0.0001, pk * 0.22), t0 + 0.045 * dm);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + nd);
      nsrc.connect(hp); hp.connect(bp); bp.connect(ng); addLP(ctx, ng, p.lp, t0, nodes).connect(out);
      nodes.push(nsrc, hp, bp, ng);
      nsrc.start(t0); stopSrc(nsrc, t0 + nd + 0.02);
      // two detuned tonal bodies with fast pitch drop
      const bDur = (p.bDur || 0.055) * dm;
      [ (p.b1||185)*tm, (p.b2||330)*tm*1.01 ].forEach((bf, bi) => {
        const o = ctx.createOscillator(); o.type = 'triangle';
        const og = ctx.createGain();
        o.frequency.setValueAtTime(bf, t0);
        o.frequency.exponentialRampToValueAtTime(Math.max(40, bf * (p.bDrop || 0.55)), t0 + bDur);
        const bl = pk * (p.bLvl || 0.38) * (bi ? 0.85 : 1);
        og.gain.setValueAtTime(0.0001, t0);
        og.gain.exponentialRampToValueAtTime(Math.max(0.0002, bl), t0 + 0.0025);
        og.gain.exponentialRampToValueAtTime(0.0001, t0 + bDur);
        o.connect(og); og.connect(out); nodes.push(o, og);
        o.start(t0); stopSrc(o, t0 + bDur + 0.02);
      });
      // snap transient
      if ((p.snap || 0) > 0) {
        const sn = ctx.createBufferSource(); sn.buffer = getDrumNoise(ctx);
        const shp = ctx.createBiquadFilter(); shp.type = 'highpass'; shp.frequency.setValueAtTime(2500 * (0.8 + vt * 0.4), t0);
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0.0001, t0);
        sg.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk * p.snap * vt), t0 + 0.001);
        sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.01);
        sn.connect(shp); shp.connect(sg); sg.connect(out); nodes.push(sn, shp, sg);
        sn.start(t0); stopSrc(sn, t0 + 0.025);
      }
      drumTrack(nodes, nsrc, dur);

    } else if (voice === 'ch' || voice === 'oh') {
      if (voice === 'ch') chokeOpenHats(t0);
      const p = kitDef[voice] || KITS.classic[voice];
      const dur = voiceDur = p.dur * dm;
      const pk = p.peak * (0.35 + v * 0.75);
      // pre-rendered metallic cluster buffer, 1 source (no 6 live oscs)
      const src = ctx.createBufferSource(); src.buffer = getHatBuffer(ctx);
      src.playbackRate.setValueAtTime((p.rate || 1) * tm * (0.97 + vt * 0.06), t0);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime((p.hp || 7000) * (0.85 + vt * 0.25), t0);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime((p.bp || 9000) * tm * (0.85 + vt * 0.25), t0); bp.Q.setValueAtTime(p.bpQ || 1.1, t0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk), t0 + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(hp); hp.connect(bp); bp.connect(g); addLP(ctx, g, p.lp, t0, nodes).connect(out);
      nodes.push(src, hp, bp, g);
      src.start(t0); stopSrc(src, t0 + dur + 0.02);
      if (voice === 'oh') {
        const entry = { g, src };
        openHatChokes.push(entry);
        drumTrack(nodes, src, dur, () => { openHatChokes = openHatChokes.filter((x) => x !== entry); });
      } else {
        drumTrack(nodes, src, dur);
      }

    } else if (voice === 'clap') {
      const p = kitDef.clap || KITS.classic.clap;
      const bursts = p.bursts || [0,0.010,0.020,0.032];
      const tail = (p.tail || p.dur || 0.14) * dm;
      voiceDur = Math.max((bursts[bursts.length - 1] || 0) + (p.burstDur || 0.02), tail);
      const pk = p.peak * (0.35 + v * 0.75);
      let lastSrc = null;
      bursts.forEach((off, k) => {
        const nsrc = ctx.createBufferSource(); nsrc.buffer = getDrumNoise(ctx);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.setValueAtTime((p.bp || 1500) * tm + (k - 1.5) * (p.spread || 80) * (0.7 + vt * 0.4), t0 + off);
        bp.Q.setValueAtTime(p.bpQ || 1.1, t0 + off);
        const g = ctx.createGain();
        const bd = (k === bursts.length - 1) ? Math.max(tail, p.burstDur || 0.02) : (p.burstDur || 0.02);
        const gp = pk * (k === bursts.length - 1 ? 0.95 : (0.55 + k * 0.1));
        g.gain.setValueAtTime(0.0001, t0 + off);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gp), t0 + off + 0.0015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + bd);
        nsrc.connect(bp); bp.connect(g); addLP(ctx, g, p.lp, t0, nodes).connect(out);
        nodes.push(nsrc, bp, g);
        nsrc.start(t0 + off); stopSrc(nsrc, t0 + off + bd + 0.015);
        lastSrc = nsrc;
      });
      drumTrack(nodes, lastSrc, voiceDur);

    } else if (voice === 'lowtom' || voice === 'hightom') {
      const p = kitDef[voice] || KITS.classic[voice];
      const dur = voiceDur = p.dur * dm;
      const base = (p.base || 120) * tm;
      const pk = p.peak * (0.35 + v * 0.75);
      const swD = (0.8 + vt * 0.3);
      const osc = ctx.createOscillator(); osc.type = p.type || 'sine';
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(base * (p.sweep || 2.0) * swD, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, (p.sweepEnd || base * 0.7) * tm), t0 + (p.sweepT || 0.09) * dm);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk), t0 + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); addLP(ctx, g, p.lp, t0, nodes).connect(out);
      nodes.push(osc, g);
      osc.start(t0); stopSrc(osc, t0 + dur + 0.02);
      // little noise at attack
      if ((p.nAtk || 0) > 0) {
        const nn = ctx.createBufferSource(); nn.buffer = getDrumNoise(ctx);
        const nbp = ctx.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.setValueAtTime(base * 4 * (0.8 + vt * 0.4), t0); nbp.Q.setValueAtTime(1.2, t0);
        const ngg = ctx.createGain();
        ngg.gain.setValueAtTime(0.0001, t0);
        ngg.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk * p.nAtk * vt), t0 + 0.002);
        ngg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03 * dm);
        nn.connect(nbp); nbp.connect(ngg); ngg.connect(out); nodes.push(nn, nbp, ngg);
        nn.start(t0); stopSrc(nn, t0 + 0.05);
      }
      drumTrack(nodes, osc, dur);

    } else { // rim (and perc fallback)
      const p = kitDef.rim || KITS.classic.rim;
      const dur = voiceDur = p.dur * dm;
      const pk = p.peak * (0.35 + v * 0.75);
      // two-tone click
      [(p.f1||820)*tm, (p.f2||1650)*tm].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = (i === 0) ? 'triangle' : 'square';
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime((p.bp||2200)*tm, t0); bp.Q.setValueAtTime(p.bpQ||3.5, t0);
        const og = ctx.createGain();
        o.frequency.setValueAtTime(f * (0.95 + vt * 0.1), t0);
        og.gain.setValueAtTime(0.0001, t0);
        og.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk * (p.click || 0.55) * (i ? 0.7 : 1)), t0 + 0.001);
        og.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(bp); bp.connect(og); og.connect(out); nodes.push(o, bp, og);
        o.start(t0); stopSrc(o, t0 + dur + 0.02);
      });
      // very short noise burst
      if ((p.noise || 0) > 0) {
        const nn = ctx.createBufferSource(); nn.buffer = getDrumNoise(ctx);
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime((p.hp||1200)*tm, t0);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, t0);
        ng.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk * p.noise), t0 + 0.001);
        ng.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.min(dur, 0.02));
        nn.connect(hp); hp.connect(ng); addLP(ctx, ng, p.lp, t0, nodes).connect(out);
        nodes.push(nn, hp, ng);
        nn.start(t0); stopSrc(nn, t0 + 0.04);
        drumTrack(nodes, nn, Math.max(dur, 0.03));
      } else {
        drumTrack(nodes, nodes[1], dur);
      }
    }

    if (tapSend && space > 0.001) tapSend(out, 'rev', clamp01(space, 0) * 0.7, nodes, t0 + voiceDur + 0.25);
    return voiceDur;
  }

  return { triggerDrum, get activeVoices() { return activeDrumVoices; }, DRUM_VOICE_CAP, TARGET };
}
