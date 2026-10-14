/**
 * pionier-surface.js — shared handpan visual surface for all instruments
 * Layout, drawing (body + tonefields + slits), hit testing.
 * Skins + LED color read from window.PionierSettings each frame.
 * Two-pass draw: solid pads first, then glow — notes never disappear on hit.
 * NaN-hardened rgba/mixLed so color stops never crash the core.
 */
import { MIN_NOTES, ringAngles, ringPadScale } from './pad-layout.js';

export const WORLD_ZONE_INDICES = [0, 1, 3, 5, 7];

export function createSurface(canvas) {
  const ctx2 = canvas.getContext('2d', { alpha: true });

  function getTheme() {
    const s = window.PionierSettings || {};
    const led = s.led || { r: 140, g: 190, b: 230 };
    const skins = {
      classic: {
        body: ['#1a1c22', '#12141a', '#0a0b0e'],
        rim: [200, 210, 225],
        sheen: 0.14,
        pad: { base: [42, 46, 56], lip: [72, 78, 92], highlight: [110, 120, 140] },
      },
      bronze: {
        body: ['#2a2218', '#1c1710', '#0e0b08'],
        rim: [210, 175, 120],
        sheen: 0.16,
        pad: { base: [58, 48, 36], lip: [95, 78, 55], highlight: [140, 115, 80] },
      },
      graphite: {
        body: ['#181a1e', '#101214', '#08090a'],
        rim: [180, 190, 205],
        sheen: 0.12,
        pad: { base: [38, 40, 46], lip: [62, 66, 76], highlight: [95, 102, 118] },
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
    const b0 = Array.isArray(base) ? (Number.isFinite(base[0]) ? base[0] : 0) : 0;
    const b1 = Array.isArray(base) ? (Number.isFinite(base[1]) ? base[1] : 0) : 0;
    const b2 = Array.isArray(base) ? (Number.isFinite(base[2]) ? base[2] : 0) : 0;
    const lr = (led && Number.isFinite(led.r != null ? led.r : led[0])) ? (led.r != null ? led.r : led[0]) : 0;
    const lg = (led && Number.isFinite(led.g != null ? led.g : led[1])) ? (led.g != null ? led.g : led[1]) : 0;
    const lb = (led && Number.isFinite(led.b != null ? led.b : led[2])) ? (led.b != null ? led.b : led[2]) : 0;
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

  function layout(n) {
    const count = Math.max(MIN_NOTES, Math.min(14, n | 0));
    fields = [];
    const angles = ringAngles(count);
    const scale = ringPadScale(count);
    for (let i = 0; i < count; i++) {
      const a = angles[i];
      const isCenter = i === 0;
      const pr = isCenter ? R * 0.16 : R * 0.13 * scale;
      const dist = isCenter ? 0 : R * 0.58;
      fields.push({
        index: i,
        cx: CX + Math.cos(a) * dist,
        cy: CY + Math.sin(a) * dist,
        r: pr,
        angle: a,
        isCenter,
      });
    }
    return fields;
  }

  function hitTest(x, y) {
    for (const f of fields) {
      const dx = x - f.cx, dy = y - f.cy;
      if (dx * dx + dy * dy <= f.r * f.r * 1.15) return f;
    }
    return null;
  }

  function drawPadSolid(f, idle, g, th) {
    const { cx, cy, r } = f;
    const pad = th.skin.pad;
    // recess
    const recess = ctx2.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.05);
    recess.addColorStop(0, 'rgba(0,0,0,0)');
    recess.addColorStop(0.28, 'rgba(0,0,0,' + (0.2 * idle) + ')');
    recess.addColorStop(0.5, 'rgba(0,0,0,' + (0.72 * idle) + ')');
    recess.addColorStop(0.72, 'rgba(0,0,0,' + (0.2 * idle) + ')');
    recess.addColorStop(1, 'rgba(0,0,0,0)');
    ctx2.fillStyle = recess;
    ctx2.beginPath(); ctx2.arc(cx, cy, r * 1.08, 0, Math.PI * 2); ctx2.fill();

    // solid pad body
    const body = ctx2.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r);
    body.addColorStop(0, rgba(pad.highlight, 0.95));
    body.addColorStop(0.45, rgba(pad.base, 1));
    body.addColorStop(1, rgba([pad.base[0] * 0.55, pad.base[1] * 0.55, pad.base[2] * 0.55], 1));
    ctx2.fillStyle = body;
    ctx2.beginPath(); ctx2.arc(cx, cy, r * 0.92, 0, Math.PI * 2); ctx2.fill();

    // metallic lip ring
    ctx2.strokeStyle = rgba(mixLed(pad.lip, th.led, 0.25), 0.55 + g * 0.25);
    ctx2.lineWidth = Math.max(1.2, r * 0.06);
    ctx2.beginPath(); ctx2.arc(cx, cy, r * 0.92, 0, Math.PI * 2); ctx2.stroke();

    // inner highlight arc
    ctx2.strokeStyle = rgba(mixLed([218, 226, 236], th.led, 0.3), 0.1 * idle + g * 0.18);
    ctx2.lineWidth = Math.max(0.8, r * 0.035);
    ctx2.beginPath(); ctx2.arc(cx, cy, r * 0.72, -2.4, -0.6); ctx2.stroke();

    // LED core
    const ledMix = mixLed([205, 221, 239], th.led, 0.45);
    const coreAlpha = 0.12 * idle + g * 0.55;
    const core = ctx2.createRadialGradient(cx, cy, 0, cx, cy, r * 0.55);
    core.addColorStop(0, rgba(ledMix, 0));
    core.addColorStop(0.2, rgba(ledMix, coreAlpha * 0.28));
    core.addColorStop(0.5, rgba([255, 255, 255], coreAlpha * 0.72));
    core.addColorStop(0.8, rgba(ledMix, coreAlpha * 0.28));
    core.addColorStop(1, rgba(ledMix, 0));
    ctx2.fillStyle = core;
    ctx2.beginPath(); ctx2.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx2.fill();

    if (g > 0.05) {
      const bloom = ctx2.createRadialGradient(cx, cy, 0, cx, cy, r * 1.4);
      bloom.addColorStop(0, rgba(mixLed([238, 246, 255], th.led, 0.5), g * 0.16));
      bloom.addColorStop(0.45, rgba(mixLed([177, 204, 232], th.led, 0.55), g * 0.07));
      bloom.addColorStop(1, rgba(th.led, 0));
      ctx2.fillStyle = bloom;
      ctx2.beginPath(); ctx2.arc(cx, cy, r * 1.4, 0, Math.PI * 2); ctx2.fill();
    }
  }

  function drawRimGlow(t) {
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

  function drawBody(inst, catchActive, waveTargets = null) {
    ctx2.clearRect(0, 0, W, H);
    const theme = getTheme();

    // body disc
    const g = ctx2.createRadialGradient(CX - R * 0.2, CY - R * 0.25, R * 0.1, CX, CY, R);
    g.addColorStop(0, theme.skin.body[0]);
    g.addColorStop(0.5, theme.skin.body[1]);
    g.addColorStop(1, theme.skin.body[2]);
    ctx2.fillStyle = g;
    ctx2.beginPath(); ctx2.arc(CX, CY, R * 0.98, 0, Math.PI * 2); ctx2.fill();

    // rim sheen
    const sheen = ctx2.createRadialGradient(CX, CY, R * 0.88, CX, CY, R * 1.02);
    sheen.addColorStop(0, rgba(theme.skin.rim, theme.skin.sheen || 0.12));
    sheen.addColorStop(0.4, rgba(theme.skin.rim, 0.03));
    sheen.addColorStop(1, rgba(theme.skin.rim, 0));
    ctx2.fillStyle = sheen;
    ctx2.beginPath(); ctx2.arc(CX, CY, R * 1.02, 0, Math.PI * 2); ctx2.fill();

    // PASS 1: solid pads + lips (always visible)
    for (const f of fields) {
      const idle = 0.85;
      const hit = (anim && anim[f.index]) || 0;
      drawPadSolid(f, idle, hit, theme);
    }

    // PASS 2: tight outer glow only (does not cover pads)
    drawRimGlow(performance.now() / 1000);
  }

  function resize(w, h) {
    W = w; H = h;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(w, h) * 0.46;
    CX = w / 2; CY = h / 2;
  }

  function setAnim(map) { anim = map; }
  function setArmed(v) { armed = !!v; }
  function setSlitPhase(t) { slitPhase = t; }

  return {
    layout, hitTest, drawBody, resize,
    setAnim, setArmed, setSlitPhase,
    get metrics() { return { W, H, R, CX, CY }; }
  };
}
