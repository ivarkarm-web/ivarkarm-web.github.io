/**
 * pionier-surface.js — shared handpan visual surface for all instruments
 * Layout, drawing (body + tonefields + slits), hit testing.
 */
import { MIN_NOTES, ringAngles, ringPadScale } from './pad-layout.js';

export const WORLD_ZONE_INDICES = [0, 1, 3, 5, 7];

/** How long existing pads glide and the new pad grows when a note is added. */
const ADD_NOTE_MS = 520;

export function createSurface(canvas) {
  const ctx2 = canvas.getContext('2d');
  let W = 800, H = 800, R = 0, CX = 0, CY = 0;
  let fields = [];
  let anim = null;
  let armed = false;
  let slitPhase = 0;
  let reducedMotion = false;
  try {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {}

  // Thin elegant rim particles — slow breathe in/out around the handpan edge
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

  function drawSlit(f, glow, playable) {
    const isDing = f.kind === 'ding';
    const slitLen = isDing ? Math.min(f.rx, f.ry) * 0.42 : Math.min(f.rx, f.ry) * 0.55;
    const slitW = Math.max(1.05, R * 0.0052);
    const g = Math.max(0, Math.min(1, glow || 0));
    const idle = playable ? 1 : 0.14;
    // Near-static core — no busy LED flicker; strike still lifts brightness
    const coreAlpha = (0.22 + g * 0.55) * idle;
    const halfL = slitLen * 0.5;
    ctx2.save();
    ctx2.translate(f.x, f.y);
    ctx2.rotate(isDing ? 0 : (f.rot || 0) + Math.PI / 2);
    const recess = ctx2.createLinearGradient(0, -slitW * 2.7, 0, slitW * 2.7);
    recess.addColorStop(0, 'rgba(0,0,0,0)');
    recess.addColorStop(0.28, `rgba(0,0,0,${0.2 * idle})`);
    recess.addColorStop(0.5, `rgba(0,0,0,${0.72 * idle})`);
    recess.addColorStop(0.72, `rgba(0,0,0,${0.2 * idle})`);
    recess.addColorStop(1, 'rgba(0,0,0,0)');
    ctx2.fillStyle = recess;
    ctx2.beginPath();
    ctx2.ellipse(0, 0, halfL * 1.05, slitW * 2.8, 0, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.strokeStyle = `rgba(218,226,236,${0.1 * idle + g * 0.18})`;
    ctx2.lineWidth = Math.max(0.6, R * 0.0022);
    ctx2.beginPath();
    ctx2.ellipse(0, 0, halfL * 0.98, slitW * 1.05, 0, 0, Math.PI * 2);
    ctx2.stroke();
    ctx2.fillStyle = `rgba(3,5,8,${0.78 * idle})`;
    ctx2.beginPath();
    ctx2.ellipse(0, 0, halfL * 0.92, slitW * 0.72, 0, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.globalCompositeOperation = 'lighter';
    const core = ctx2.createLinearGradient(-halfL, 0, halfL, 0);
    core.addColorStop(0, 'rgba(242,248,255,0)');
    core.addColorStop(0.2, `rgba(205,221,239,${coreAlpha * 0.28})`);
    core.addColorStop(0.5, `rgba(255,255,255,${coreAlpha * 0.72})`);
    core.addColorStop(0.8, `rgba(205,221,239,${coreAlpha * 0.28})`);
    core.addColorStop(1, 'rgba(242,248,255,0)');
    ctx2.fillStyle = core;
    ctx2.beginPath();
    ctx2.ellipse(0, 0, halfL * 0.88, slitW * 0.42, 0, 0, Math.PI * 2);
    ctx2.fill();
    if (g > 0.03 && playable) {
      const bloom = ctx2.createRadialGradient(0, 0, 0, 0, 0, halfL * 1.05);
      bloom.addColorStop(0, `rgba(238,246,255,${g * 0.16})`);
      bloom.addColorStop(0.45, `rgba(177,204,232,${g * 0.07})`);
      bloom.addColorStop(1, 'rgba(177,204,232,0)');
      ctx2.fillStyle = bloom;
      ctx2.beginPath();
      ctx2.ellipse(0, 0, halfL * 1.08, slitW * 3.2, 0, 0, Math.PI * 2);
      ctx2.fill();
    }
    ctx2.restore();
  }

  /** Call right before relayout to glide existing pads and grow the new one. */
  function armTransition() {
    armed = true;
  }

  /** Pad geometry for this frame: eased between old and new layout while a note is being added. */
  function animatedView(now) {
    if (!anim) return fields;
    const t = (now - anim.t0) / anim.dur;
    if (t >= 1) {
      anim = null;
      return fields;
    }
    const e = 1 - Math.pow(1 - Math.max(0, t), 3);
    const mix = (a, b) => a + (b - a) * e;
    return fields.map((f) => {
      const from = anim.from.get(f.index);
      if (!from) return { ...f, rx: f.rx * e, ry: f.ry * e, appear: e };
      let dr = f.rot - (from.rot || 0);
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      return {
        ...f,
        x: mix(from.x, f.x),
        y: mix(from.y, f.y),
        rx: mix(from.rx, f.rx),
        ry: mix(from.ry, f.ry),
        rot: (from.rot || 0) + dr * e,
        ux: f.ux != null ? mix(from.ux ?? f.ux, f.ux) : f.ux,
        uy: f.uy != null ? mix(from.uy ?? f.uy, f.uy) : f.uy
      };
    });
  }

  function layoutHandpanFields(handpanNotes, isFieldPlayable) {
    const list = handpanNotes;
    const wasArmed = armed;
    armed = false;
    const previous = wasArmed && fields.length
      ? animatedView(performance.now()).map((f) => ({ ...f }))
      : null;

    const stock = list.slice(0, MIN_NOTES);
    const stockMidis = stock.map((n) => n.midi);
    const midiMin = Math.min(...stockMidis);
    const midiMax = Math.max(...stockMidis);
    const midiSpan = Math.max(1, midiMax - midiMin);
    const ringCount = Math.max(1, list.length - 1);
    const angles = ringAngles(ringCount);
    const padScale = ringPadScale(ringCount);

    fields = list.map((n, pos) => {
      const lowAmount = Math.max(0, Math.min(1, (midiMax - n.midi) / midiSpan));
      const size = 1.12 + lowAmount * 0.36;
      const playable = isFieldPlayable(n.index);
      if (n.kind === 'ding') {
        const rr = R * 0.185 * size;
        return {
          i: n.index, index: n.index, x: CX, y: CY,
          rx: rr, ry: rr, rot: 0, label: n.name, playable, kind: 'ding'
        };
      }
      const slot = (n.index != null ? n.index : pos) - 1;
      const a = ((angles[slot] ?? n.angle) * Math.PI) / 180;
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

  function drawRimGlow(t) {
    if (R < 8) return;
    rimTime = t || rimTime;
    // Global breath ~0.12 Hz — whole ring eases in and out together
    const breath = reducedMotion
      ? 0.55
      : 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(rimTime * 0.75));
    const rimR = R * 0.965;
    ctx2.save();
    ctx2.globalCompositeOperation = 'lighter';

    // Soft continuous halo along the rim (cohesive base)
    const halo = ctx2.createRadialGradient(CX, CY, rimR * 0.92, CX, CY, rimR * 1.06);
    halo.addColorStop(0, 'rgba(200, 210, 230, 0)');
    halo.addColorStop(0.55, `rgba(210, 220, 235, ${0.018 * breath})`);
    halo.addColorStop(0.78, `rgba(230, 236, 248, ${0.045 * breath})`);
    halo.addColorStop(0.92, `rgba(240, 244, 252, ${0.028 * breath})`);
    halo.addColorStop(1, 'rgba(200, 210, 230, 0)');
    ctx2.fillStyle = halo;
    ctx2.beginPath();
    ctx2.arc(CX, CY, rimR * 1.08, 0, Math.PI * 2);
    ctx2.arc(CX, CY, rimR * 0.88, 0, Math.PI * 2, true);
    ctx2.fill();

    // Thin particle motes on the rim
    for (const p of rimParticles) {
      const local = 0.55 + 0.45 * Math.sin(rimTime * p.speed + p.phase);
      const a = breath * local * 0.22;
      if (a < 0.01) continue;
      const rr = rimR * (1 + p.rJ);
      const x = CX + Math.cos(p.a) * rr;
      const y = CY + Math.sin(p.a) * rr;
      const s = Math.max(0.6, R * 0.0045 * p.size);
      const col = p.gold
        ? `rgba(228, 205, 140, ${a})`
        : `rgba(220, 230, 245, ${a})`;
      const grad = ctx2.createRadialGradient(x, y, 0, x, y, s * 3.2);
      grad.addColorStop(0, col);
      grad.addColorStop(0.35, p.gold
        ? `rgba(212, 180, 90, ${a * 0.35})`
        : `rgba(190, 205, 225, ${a * 0.3})`);
      grad.addColorStop(1, 'rgba(180, 190, 210, 0)');
      ctx2.fillStyle = grad;
      ctx2.beginPath();
      ctx2.arc(x, y, s * 3.2, 0, Math.PI * 2);
      ctx2.fill();
    }
    ctx2.restore();
  }

  function drawBody(inst, catchActive, waveTargets = null) {
    ctx2.clearRect(0, 0, W, H);

    const g = ctx2.createRadialGradient(CX - R * 0.2, CY - R * 0.28, R * 0.04, CX, CY, R);
    g.addColorStop(0, '#2c2d32');
    g.addColorStop(0.5, '#16171b');
    g.addColorStop(1, '#0a0a0c');
    ctx2.fillStyle = g;
    ctx2.beginPath();
    ctx2.arc(CX, CY, R, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.strokeStyle = 'rgba(220,232,246,0.13)';
    ctx2.lineWidth = Math.max(1.5, R * 0.01);
    ctx2.beginPath();
    ctx2.arc(CX, CY, R * 0.93, 0, Math.PI * 2);
    ctx2.stroke();

    if (catchActive) ctx2.globalAlpha = 0.78;

    const view = animatedView(performance.now());
    view.forEach((f) => {
      const glow = inst.glow?.[f.index] || 0;
      const radial = inst.zoneFlash?.[f.index] || 0;
      const isDing = f.kind === 'ding';
      const playable = f.playable !== false;
      const dim = (playable ? 1 : 0.26) * (f.appear ?? 1);
      const hlx = f.ux != null ? f.ux : -0.35;
      const hly = f.uy != null ? f.uy : -0.45;
      const wp = waveTargets?.get?.(f.index);
      let approach = 0;
      if (wp != null && playable) {
        approach = Math.max(0, 1 - Math.abs(wp - 0.92) * 2.4);
        approach = Math.min(1, approach * (0.25 + Math.min(1, wp) * 0.8));
      }

      const pad = ctx2.createRadialGradient(
        f.x + hlx * f.rx * 0.35, f.y + hly * f.ry * 0.35, 0,
        f.x, f.y, Math.max(f.rx, f.ry)
      );
      pad.addColorStop(0, `rgba(78,80,88,${0.95 * dim})`);
      pad.addColorStop(0.55, `rgba(40,42,48,${0.95 * dim})`);
      pad.addColorStop(1, `rgba(22,23,27,${0.98 * dim})`);
      ctx2.fillStyle = pad;
      pathPad(f);
      ctx2.fill();

      const strokeLight = Math.max(
        glow > 0.035 && playable ? 0.16 + glow * 0.42 : 0,
        approach * 0.72
      );
      ctx2.strokeStyle = strokeLight > 0.04
        ? `rgba(224,236,250,${strokeLight})`
        : `rgba(220,230,242,${0.09 * dim})`;
      ctx2.lineWidth = isDing ? 1.8 : 1.2;
      pathPad(f);
      ctx2.stroke();

      if ((glow > 0.02 || approach > 0.08) && playable) {
        ctx2.save();
        ctx2.globalCompositeOperation = 'lighter';
        const gAmt = Math.max(glow, approach * 0.85);
        const gr = Math.max(f.rx, f.ry) * (0.95 + radial * 0.45 + approach * 0.2);
        const hg = ctx2.createRadialGradient(f.x, f.y, 0, f.x, f.y, gr);
        hg.addColorStop(0, `rgba(226,239,255,${gAmt * (0.19 + (1 - radial) * 0.12)})`);
        hg.addColorStop(0.5, `rgba(166,198,230,${gAmt * (radial * 0.14 + approach * 0.1)})`);
        hg.addColorStop(1, 'rgba(166,198,230,0)');
        ctx2.fillStyle = hg;
        pathPad({ x: f.x, y: f.y, rx: f.rx * 1.12, ry: f.ry * 1.12, rot: f.rot });
        ctx2.fill();
        ctx2.restore();
      }

      drawSlit(f, Math.max(glow, approach * 0.9), playable);
    });

    drawRimGlow(performance.now() * 0.001);
    ctx2.globalAlpha = 1;
  }

  function drawCatchWaves(waves) {
    for (const w of waves) {
      const target =
        fields.find((f) => f.index === w.targetIndex) || fields[w.targetIndex];
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
      bloom.addColorStop(0, `rgba(255,230,160,${alpha * 0.55})`);
      bloom.addColorStop(0.4, `rgba(228,195,90,${alpha * 0.28})`);
      bloom.addColorStop(1, 'rgba(201,162,39,0)');
      ctx2.fillStyle = bloom;
      ctx2.beginPath();
      ctx2.arc(x, y, rr * 1.35, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.strokeStyle = `rgba(255,242,190,${alpha * 0.95})`;
      ctx2.lineWidth = Math.max(2.2, R * 0.011);
      ctx2.beginPath();
      ctx2.arc(x, y, rr * 0.78, 0, Math.PI * 2);
      ctx2.stroke();
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
          idx: f.index,
          index: f.index,
          radial: d,
          angleRad: Math.atan2(dy, dx),
          nx: 0.5 + (f.x - CX) / (R * 2),
          ny: 0.5 + (f.y - CY) / (R * 2),
          x: cx,
          y: cy
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

  return {
    resize,
    layoutHandpanFields,
    armTransition,
    drawBody,
    drawCatchWaves,
    hitVector,
    canvasCoords,
    get fields() { return fields; },
    set fields(v) { fields = v; },
    setSlitPhase(t) { slitPhase = t; },
    get metrics() { return { W, H, R, CX, CY }; }
  };
}
