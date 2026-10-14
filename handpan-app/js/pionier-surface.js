/**
 * pionier-surface.js — shared handpan visual surface for all instruments
 * Layout, drawing (body + tonefields + slits), hit testing.
 * Skins + LED color read from window.PionierSettings each frame.
 * Two-pass draw: solid pads first, then glow — notes never disappear on hit.
 * NaN-hardened rgba/mixLed so color stops never crash the core.
 */
import { MIN_NOTES, ringAngles, ringPadScale } from './pad-layout.js';

export const WORLD_ZONE_INDICES = [0, 1, 3, 5, 7];

const ADD_NOTE_MS = 520;

export function createSurface(canvas) {
  const ctx2 = canvas.getContext('2d');

  function getTheme() {
    const s = (typeof window !== 'undefined' && window.PionierSettings) || {};
    const led = s.led || { r: 110, g: 200, b: 255 };
    const skins = {
      classic: {
        body: ['#6a6e7a', '#2e323c', '#0e1014'],
        rim: [240, 246, 255],
        pad: [[175, 182, 198], [88, 92, 105], [38, 40, 48]],
        lip: [200, 208, 222],
        stroke: [230, 236, 248],
        glow: [[250, 252, 255], [200, 220, 250]],
        sheen: 0.2,
      },
      bronze: {
        body: ['#b07030', '#5c3814', '#1c1006'],
        rim: [255, 220, 140],
        pad: [[240, 175, 90], [155, 100, 45], [72, 44, 18]],
        lip: [255, 210, 130],
        stroke: [255, 230, 170],
        glow: [[255, 245, 200], [255, 185, 80]],
        sheen: 0.28,
      },
      steel: {
        body: ['#5a7898', '#243848', '#080e16'],
        rim: [210, 235, 255],
        pad: [[180, 205, 230], [85, 110, 135], [32, 48, 62]],
        lip: [200, 225, 245],
        stroke: [220, 240, 255],
        glow: [[240, 250, 255], [150, 205, 255]],
        sheen: 0.24,
      },
      obsidian: {
        body: ['#4a3460', '#1a1424', '#06040a'],
        rim: [240, 210, 255],
        pad: [[130, 95, 165], [58, 40, 78], [22, 14, 30]],
        lip: [180, 145, 210],
        stroke: [235, 210, 255],
        glow: [[255, 235, 255], [200, 150, 255]],
        sheen: 0.2,
      },
    };
    const skin = skins[s.skin] || skins.classic;
    return { skin, led: { r: led.r | 0, g: led.g | 0, b: led.b | 0 } };
  }

  function rgba(c, a) {
    if (Array.isArray(c)) {
      const r = Number.isFinite(c[0]) ? c[0] : 0;
      const g = Number.isFinite(c[1]) ? c[1] : 0;
      const b = Number.isFinite(c[2]) ? c[2] : 0;
      const alpha = Number.isFinite(a) ? a : 0;
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }
    return c;
  }

  function mixLed(base, led, t) {
    const pick = (obj, arrIdx, key) => {
      if (!obj) return 0;
      if (Array.isArray(obj)) return Number.isFinite(obj[arrIdx]) ? obj[arrIdx] : 0;
      const v = obj[key];
      return Number.isFinite(v) ? v : 0;
    };
    const b0 = pick(base, 0, 'r');
    const b1 = pick(base, 1, 'g');
    const b2 = pick(base, 2, 'b');
    const lr = pick(led, 0, 'r');
    const lg = pick(led, 1, 'g');
    const lb = pick(led, 2, 'b');
    const tt = Number.isFinite(t) ? t : 0;
    return [
      Math.round(b0 * (1 - tt) + lr * tt),
      Math.round(b1 * (1 - tt) + lg * tt),
      Math.round(b2 * (1 - tt) + lb * tt),
    ];
  }

  let W = 800, H = 800, R = 0, CX = 0, CY = 0;
  let fields = [];
  let anim = null;
  let armed = false;
  let slitPhase = 0;
  let reducedMotion = false;
  try {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {}

  const RIM_COUNT = reducedMotion ? 28 : 48;
  const rimParticles = Array.from({ length: RIM_COUNT }, (_, i) => ({
    a: (i / RIM_COUNT) * Math.PI * 2 + Math.random() * 0.04,
    rJ: (Math.random() - 0.5) * 0.012,
    size: 0.55 + Math.random() * 0.55,
    phase: Math.random() * Math.PI * 2,
    speed: 0.18 + Math.random() * 0.12,
    gold: Math.random() < 0.35
  }));
  let rimTime = 0;

  function pathPad(f) {
    ctx2.beginPath();
    ctx2.ellipse(f.x, f.y, f.rx, f.ry, f.rot || 0, 0, Math.PI * 2);
  }

  function layoutHandpanFields(handpanNotes, isFieldPlayable) {
    const list = handpanNotes || [];
    const wasArmed = armed;
    armed = false;
    const previous = wasArmed && fields.length
      ? fields.map((f) => ({ ...f }))
      : null;

    const stock = list.slice(0, MIN_NOTES || 9);
    const stockMidis = stock.map((n) => n.midi).filter((m) => m != null);
    const midiMin = stockMidis.length ? Math.min(...stockMidis) : 48;
    const midiMax = stockMidis.length ? Math.max(...stockMidis) : 72;
    const midiSpan = Math.max(1, midiMax - midiMin);
    const ringCount = Math.max(1, list.length - 1);
    let angles, padScale;
    try {
      angles = ringAngles(ringCount);
      padScale = ringPadScale(ringCount);
    } catch (_) {
      angles = Array.from({ length: ringCount }, (_, i) => (i / ringCount) * 360);
      padScale = 1;
    }

    fields = list.map((n, pos) => {
      const lowAmount = Math.max(0, Math.min(1, (midiMax - (n.midi || 60)) / midiSpan));
      const size = 1.12 + lowAmount * 0.36;
      const playable = typeof isFieldPlayable === 'function' ? isFieldPlayable(n.index) : true;
      if (n.kind === 'ding') {
        const rr = R * 0.185 * size;
        return {
          i: n.index, index: n.index, x: CX, y: CY,
          rx: rr, ry: rr, rot: 0, label: n.name, playable, kind: 'ding'
        };
      }
      const slot = (n.index != null ? n.index : pos) - 1;
      const deg = angles[slot] != null ? angles[slot] : (n.angle != null ? n.angle : (slot / ringCount) * 360);
      const a = (deg * Math.PI) / 180;
      const d = R * 0.58;
      const radial = R * 0.155 * size * padScale;
      const tangential = R * 0.112 * size * padScale;
      const ux = Math.sin(a);
      const uy = -Math.cos(a);
      return {
        i: n.index, index: n.index,
        x: CX + ux * d, y: CY + uy * d,
        rx: radial, ry: tangential,
        rot: Math.atan2(uy, ux), ux, uy,
        label: n.name, playable, kind: 'ring'
      };
    });

    anim = previous && !reducedMotion
      ? { t0: performance.now(), dur: ADD_NOTE_MS, from: new Map(previous.map((f) => [f.index, f])) }
      : null;
    return fields;
  }

  function animatedView(now) {
    if (!anim) return fields;
    const t = (now - anim.t0) / anim.dur;
    if (t >= 1) { anim = null; return fields; }
    const e = 1 - Math.pow(1 - Math.max(0, t), 3);
    const mix = (a, b) => a + (b - a) * e;
    return fields.map((f) => {
      const from = anim.from.get(f.index);
      if (!from) return { ...f, rx: f.rx * e, ry: f.ry * e, appear: e };
      let dr = f.rot - (from.rot || 0);
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      return {
        ...f,
        x: mix(from.x, f.x), y: mix(from.y, f.y),
        rx: mix(from.rx, f.rx), ry: mix(from.ry, f.ry),
        rot: (from.rot || 0) + dr * e,
        ux: f.ux != null ? mix(from.ux ?? f.ux, f.ux) : f.ux,
        uy: f.uy != null ? mix(from.uy ?? f.uy, f.uy) : f.uy
      };
    });
  }

  function drawSlit(f, glow, playable) {
    const isDing = f.kind === 'ding';
    const slitLen = isDing ? Math.min(f.rx, f.ry) * 0.42 : Math.min(f.rx, f.ry) * 0.55;
    const slitW = Math.max(1.05, R * 0.0052);
    const g = Math.max(0, Math.min(1, glow || 0));
    const idle = playable ? 1 : 0.14;
    const coreAlpha = (0.22 + g * 0.55) * idle;
    const halfL = slitLen * 0.5;
    const th = getTheme();
    const ledMix = mixLed([205, 221, 239], th.led, 0.45);
    ctx2.save();
    ctx2.translate(f.x, f.y);
    ctx2.rotate(isDing ? 0 : (f.rot || 0) + Math.PI / 2);
    ctx2.globalCompositeOperation = 'source-over';
    const recess = ctx2.createLinearGradient(0, -slitW * 2.7, 0, slitW * 2.7);
    recess.addColorStop(0, 'rgba(0,0,0,0)');
    recess.addColorStop(0.28, 'rgba(0,0,0,' + (0.2 * idle) + ')');
    recess.addColorStop(0.5, 'rgba(0,0,0,' + (0.72 * idle) + ')');
    recess.addColorStop(0.72, 'rgba(0,0,0,' + (0.2 * idle) + ')');
    recess.addColorStop(1, 'rgba(0,0,0,0)');
    ctx2.fillStyle = recess;
    ctx2.beginPath();
    ctx2.ellipse(0, 0, halfL * 1.05, slitW * 2.8, 0, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.strokeStyle = rgba(mixLed([218, 226, 236], th.led, 0.3), 0.1 * idle + g * 0.18);
    ctx2.lineWidth = Math.max(0.6, R * 0.0022);
    ctx2.beginPath();
    ctx2.ellipse(0, 0, halfL * 0.98, slitW * 1.05, 0, 0, Math.PI * 2);
    ctx2.stroke();
    ctx2.fillStyle = 'rgba(3,5,8,' + (0.78 * idle) + ')';
    ctx2.beginPath();
    ctx2.ellipse(0, 0, halfL * 0.92, slitW * 0.72, 0, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.globalCompositeOperation = 'lighter';
    const core = ctx2.createLinearGradient(-halfL, 0, halfL, 0);
    core.addColorStop(0, rgba(ledMix, 0));
    core.addColorStop(0.2, rgba(ledMix, coreAlpha * 0.28));
    core.addColorStop(0.5, rgba([255, 255, 255], coreAlpha * 0.72));
    core.addColorStop(0.8, rgba(ledMix, coreAlpha * 0.28));
    core.addColorStop(1, rgba(ledMix, 0));
    ctx2.fillStyle = core;
    ctx2.beginPath();
    ctx2.ellipse(0, 0, halfL * 0.88, slitW * 0.42, 0, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.restore();
  }

  function drawRimGlow(t) {
    if (R < 8) return;
    rimTime = t || rimTime;
    const breath = reducedMotion
      ? 0.55
      : 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(rimTime * 0.75));
    const rimR = R * 0.965;
    const th = getTheme();
    const lc = [th.led.r, th.led.g, th.led.b];
    ctx2.save();
    ctx2.globalCompositeOperation = 'lighter';

    const halo = ctx2.createRadialGradient(CX, CY, rimR * 0.92, CX, CY, rimR * 1.06);
    halo.addColorStop(0, rgba(lc, 0));
    halo.addColorStop(0.55, rgba(mixLed([210, 220, 235], th.led, 0.5), 0.018 * breath));
    halo.addColorStop(0.78, rgba(mixLed([230, 236, 248], th.led, 0.55), 0.045 * breath));
    halo.addColorStop(0.92, rgba(mixLed([240, 244, 252], th.led, 0.5), 0.028 * breath));
    halo.addColorStop(1, rgba(lc, 0));
    ctx2.fillStyle = halo;
    ctx2.beginPath();
    ctx2.arc(CX, CY, rimR * 1.08, 0, Math.PI * 2);
    ctx2.arc(CX, CY, rimR * 0.88, 0, Math.PI * 2, true);
    ctx2.fill();

    for (const p of rimParticles) {
      const local = 0.55 + 0.45 * Math.sin(rimTime * p.speed + p.phase);
      const a = breath * local * 0.22;
      if (a < 0.01) continue;
      const rr = rimR * (1 + p.rJ);
      const x = CX + Math.cos(p.a) * rr;
      const y = CY + Math.sin(p.a) * rr;
      const s = Math.max(0.6, R * 0.0045 * p.size);
      const col = p.gold
        ? rgba(mixLed([228, 205, 140], th.led, 0.35), a)
        : rgba(mixLed(lc, th.led, 0.15), a);
      const grad = ctx2.createRadialGradient(x, y, 0, x, y, s * 3.2);
      grad.addColorStop(0, col);
      grad.addColorStop(0.35, p.gold
        ? rgba(mixLed([212, 180, 90], th.led, 0.4), a * 0.35)
        : rgba(mixLed(lc, { r: 190, g: 205, b: 225 }, 0.3), a * 0.3));
      grad.addColorStop(1, rgba(lc, 0));
      ctx2.fillStyle = grad;
      ctx2.beginPath();
      ctx2.arc(x, y, s * 3.2, 0, Math.PI * 2);
      ctx2.fill();
    }
    ctx2.restore();
  }

  function drawBody(inst, catchActive, waveTargets) {
    ctx2.clearRect(0, 0, W, H);
    const theme = getTheme();

    const g = ctx2.createRadialGradient(CX - R * 0.2, CY - R * 0.28, R * 0.04, CX, CY, R);
    g.addColorStop(0, theme.skin.body[0]);
    g.addColorStop(0.5, theme.skin.body[1]);
    g.addColorStop(1, theme.skin.body[2]);
    ctx2.fillStyle = g;
    ctx2.beginPath();
    ctx2.arc(CX, CY, R, 0, Math.PI * 2);
    ctx2.fill();

    ctx2.strokeStyle = rgba(theme.skin.rim, 0.28);
    ctx2.lineWidth = Math.max(2, R * 0.013);
    ctx2.beginPath();
    ctx2.arc(CX, CY, R * 0.93, 0, Math.PI * 2);
    ctx2.stroke();

    const sheen = ctx2.createRadialGradient(CX - R * 0.28, CY - R * 0.32, 0, CX, CY, R * 0.9);
    sheen.addColorStop(0, rgba(theme.skin.rim, theme.skin.sheen || 0.12));
    sheen.addColorStop(0.4, rgba(theme.skin.rim, 0.03));
    sheen.addColorStop(1, rgba(theme.skin.rim, 0));
    ctx2.fillStyle = sheen;
    ctx2.beginPath();
    ctx2.arc(CX, CY, R * 0.92, 0, Math.PI * 2);
    ctx2.fill();

    const view = animatedView(performance.now());

    // PASS 1: solid pads + metallic lip
    ctx2.globalCompositeOperation = 'source-over';
    ctx2.globalAlpha = catchActive ? 0.88 : 1;
    view.forEach((f) => {
      const isDing = f.kind === 'ding';
      const playable = f.playable !== false;
      const dim = (playable ? 1 : 0.32) * (f.appear ?? 1);
      const hlx = f.ux != null ? f.ux : -0.35;
      const hly = f.uy != null ? f.uy : -0.45;
      const baseR = Math.max(f.rx, f.ry);

      const lipCol = theme.skin.lip || theme.skin.stroke;
      ctx2.fillStyle = rgba(theme.skin.pad[2], 0.95 * dim);
      pathPad({ x: f.x, y: f.y, rx: f.rx * 1.08, ry: f.ry * 1.08, rot: f.rot });
      ctx2.fill();

      const pad = ctx2.createRadialGradient(
        f.x + hlx * f.rx * 0.38, f.y + hly * f.ry * 0.38, 0,
        f.x, f.y, baseR
      );
      pad.addColorStop(0, rgba(theme.skin.pad[0], 1 * dim));
      pad.addColorStop(0.45, rgba(theme.skin.pad[1], 1 * dim));
      pad.addColorStop(0.85, rgba(theme.skin.pad[2], 1 * dim));
      pad.addColorStop(1, rgba(theme.skin.pad[2], 0.92 * dim));
      ctx2.fillStyle = pad;
      pathPad(f);
      ctx2.fill();

      ctx2.strokeStyle = rgba(lipCol, (playable ? 0.55 : 0.18) * dim);
      ctx2.lineWidth = isDing ? 2.4 : 1.7;
      pathPad(f);
      ctx2.stroke();

      ctx2.strokeStyle = rgba(theme.skin.pad[0], (playable ? 0.35 : 0.1) * dim);
      ctx2.lineWidth = Math.max(1, R * 0.003);
      pathPad({ x: f.x, y: f.y, rx: f.rx * 0.78, ry: f.ry * 0.78, rot: f.rot });
      ctx2.stroke();
    });

    // PASS 2: constrained hit glow + slits
    view.forEach((f) => {
      const glow = inst && inst.glow ? (inst.glow[f.index] || 0) : 0;
      const radial = inst && inst.zoneFlash ? (inst.zoneFlash[f.index] || 0) : 0;
      const playable = f.playable !== false;

      if (glow > 0.02 && playable) {
        ctx2.save();
        ctx2.globalCompositeOperation = 'lighter';
        const gAmt = Math.min(1, glow);
        const g0 = mixLed(theme.skin.glow[0], theme.led, 0.65);
        const g1 = mixLed(theme.skin.glow[1], theme.led, 0.5);
        const baseR = Math.max(f.rx, f.ry);

        const outer = baseR * (1.02 + radial * 0.22 + gAmt * 0.08);
        const hg = ctx2.createRadialGradient(f.x, f.y, 0, f.x, f.y, outer);
        hg.addColorStop(0, rgba(g0, gAmt * 0.32));
        hg.addColorStop(0.5, rgba(g1, gAmt * 0.14));
        hg.addColorStop(1, rgba(g1, 0));
        ctx2.fillStyle = hg;
        pathPad({ x: f.x, y: f.y, rx: f.rx * 1.08, ry: f.ry * 1.08, rot: f.rot });
        ctx2.fill();

        const core = ctx2.createRadialGradient(f.x, f.y, 0, f.x, f.y, baseR * 0.7);
        core.addColorStop(0, rgba([255, 255, 255], gAmt * 0.22));
        core.addColorStop(0.55, rgba(g0, gAmt * 0.12));
        core.addColorStop(1, rgba(g0, 0));
        ctx2.fillStyle = core;
        pathPad(f);
        ctx2.fill();

        ctx2.strokeStyle = rgba(g0, gAmt * 0.55);
        ctx2.lineWidth = Math.max(1.2, R * 0.0045);
        pathPad({ x: f.x, y: f.y, rx: f.rx * 1.02, ry: f.ry * 1.02, rot: f.rot });
        ctx2.stroke();
        ctx2.restore();
      }

      drawSlit(f, glow, playable);
    });

    drawRimGlow(performance.now() * 0.001);
    ctx2.globalCompositeOperation = 'source-over';
    ctx2.globalAlpha = 1;
  }

  function drawCatchWaves(waves) {
    if (!waves) return;
    for (const w of waves) {
      const target = fields.find((f) => f.index === w.targetIndex) || fields[w.targetIndex];
      if (!target) continue;
      const p = Math.min(1.2, w.progress);
      const x = CX + (target.x - CX) * p;
      const y = CY + (target.y - CY) * p;
      const padR = Math.max(target.rx, target.ry);
      const rr = R * 0.065 + p * padR * 1.22;
      const windowDist = Math.abs(p - 0.92);
      const alpha = Math.max(0, 0.88 * (1 - windowDist * 2.0));
      if (alpha < 0.04) continue;
      ctx2.save();
      ctx2.globalCompositeOperation = 'lighter';
      const bloom = ctx2.createRadialGradient(x, y, rr * 0.2, x, y, rr * 1.35);
      bloom.addColorStop(0, 'rgba(255,230,160,' + (alpha * 0.55) + ')');
      bloom.addColorStop(0.4, 'rgba(228,195,90,' + (alpha * 0.28) + ')');
      bloom.addColorStop(1, 'rgba(201,162,39,0)');
      ctx2.fillStyle = bloom;
      ctx2.beginPath();
      ctx2.arc(x, y, rr * 1.35, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.restore();
    }
  }

  function hitVector(cx, cy) {
    let best = null;
    let bestD = Infinity;
    for (const f of fields) {
      if (f.playable === false) continue;
      const dx = cx - f.x;
      const dy = cy - f.y;
      const rot = f.rot || 0;
      const cos = Math.cos(-rot);
      const sin = Math.sin(-rot);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      const d = Math.hypot(lx / f.rx, ly / f.ry);
      const minAxis = Math.min(f.rx, f.ry);
      const refAxis = R * 0.14;
      const expand = Math.max(0, Math.min(0.55, (refAxis - minAxis) / (R * 0.09)));
      const hitLimit = 1.78 + expand;
      if (d <= hitLimit && d < bestD) {
        bestD = d;
        best = {
          idx: f.index, index: f.index, radial: d,
          angleRad: Math.atan2(dy, dx),
          nx: 0.5 + (f.x - CX) / (R * 2),
          ny: 0.5 + (f.y - CY) / (R * 2),
          x: cx, y: cy
        };
      }
    }
    return best;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(rect.width * dpr));
    H = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = W;
    canvas.height = H;
    CX = W / 2;
    CY = H / 2;
    R = Math.min(W, H) * 0.48;
  }

  function canvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const dpr = W / rect.width;
    return { x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr };
  }

  function armTransition() { armed = true; }

  return {
    resize,
    layoutHandpanFields,
    armTransition,
    drawBody,
    drawCatchWaves,
    hitVector,
    canvasCoords,
    get fields() { return fields; },
    set fields(v) { fields = v || []; },
    setSlitPhase(t) { slitPhase = t; },
    get metrics() { return { W, H, R, CX, CY }; }
  };
}
